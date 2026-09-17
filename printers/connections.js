const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const usb = require('usb');

const PRINTER_CLASS = 0x07;
const CHUNK_SIZE = 16 * 1024;

const hex = (n) => '0x' + n.toString(16).padStart(4, '0');

// Do the ids of a printer ({ vendorId, productId }, missing ids = unknown) match the wanted ids?
function matches(ids, { vendorId = null, productId = null }) {
  return (vendorId == null || ids.vendorId === vendorId) && (productId == null || ids.productId === productId);
}

// Only printers with both ids set can reserve a device for themselves
function onlyComplete(reserved) {
  return reserved.filter((ids) => ids.vendorId != null && ids.productId != null);
}

function isPrinter(device) {
  try {
    return device.configDescriptor.interfaces.some((alts) =>
      alts.some((alt) => alt.bInterfaceClass === PRINTER_CLASS)
    );
  } catch (e) {
    return false;
  }
}

function listUsbPrinters() {
  return usb.getDeviceList().filter(isPrinter);
}

const usbIds = (device) => ({
  vendorId: device.deviceDescriptor.idVendor,
  productId: device.deviceDescriptor.idProduct,
});

// Sends data over USB to a printer-class device (libusb)
class UsbConnection {
  // `reserved` lists the ids of the other printers, so they are skipped when no ids are given
  constructor({ vendorId = null, productId = null }, reserved = []) {
    this.ids = { vendorId, productId };
    this.reserved = onlyComplete(reserved);
  }

  find() {
    return listUsbPrinters().find(
      (device) => matches(usbIds(device), this.ids) && !this.reserved.some((ids) => matches(usbIds(device), ids))
    );
  }

  describe() {
    const device = this.find();
    if (!device) return null;
    const { vendorId, productId } = usbIds(device);
    return `USB ${hex(vendorId)}:${hex(productId)}`;
  }

  async write(data) {
    const device = this.find();
    if (!device) throw new Error('Printer not found on USB');

    device.open();
    const iface = device.interfaces.find((i) => i.descriptor.bInterfaceClass === PRINTER_CLASS);
    try {
      // On Linux the kernel printer driver (usblp) has to let go of the printer first
      if (process.platform !== 'win32' && iface.isKernelDriverActive()) {
        iface.detachKernelDriver();
      }
      iface.claim();
      const endpoint = iface.endpoints.find((e) => e.direction === 'out');
      if (!endpoint) throw new Error('Printer has no USB out endpoint');
      endpoint.timeout = 60000;

      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        await endpoint.transferAsync(data.subarray(i, i + CHUNK_SIZE));
      }
      await iface.releaseAsync();
    } finally {
      device.close();
    }
  }
}

// Linux printer device files: /dev/usb/lp0, /dev/usb/lp1, ... (USB) and /dev/lp0, ... (parallel port).
// For USB printers, the ids are read from sysfs. Returns [{ file, vendorId, productId }].
function listDeviceFiles(dev = '/dev', sys = '/sys/class/usbmisc') {
  const scan = (dir) => {
    try {
      return fs
        .readdirSync(dir)
        .filter((name) => /^lp\d+$/.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((name) => ({ name, file: path.join(dir, name) }));
    } catch (e) {
      return [];
    }
  };

  const readId = (name, id) => {
    try {
      // .../usbmisc/lp0/device links to the USB interface, its parent folder is the USB device with the ids
      const iface = fs.realpathSync(path.join(sys, name, 'device'));
      return parseInt(fs.readFileSync(path.join(path.dirname(iface), id), 'utf8'), 16);
    } catch (e) {
      return null;
    }
  };

  return [
    ...scan(path.join(dev, 'usb')).map(({ name, file }) => ({
      file,
      vendorId: readId(name, 'idVendor'),
      productId: readId(name, 'idProduct'),
    })),
    ...scan(dev).map(({ file }) => ({ file, vendorId: null, productId: null })),
  ];
}

// Writes to a printer device file (Linux). Either a fixed `path` (or a list of paths, the first
// existing one is used), or no path: then the device files are searched for the given ids.
class FileConnection {
  constructor({ path: paths = null, vendorId = null, productId = null }, reserved = []) {
    this.paths = paths ? [].concat(paths) : null;
    this.ids = { vendorId, productId };
    this.reserved = onlyComplete(reserved);
  }

  find() {
    if (this.paths) {
      const file = this.paths.find((p) => fs.existsSync(p));
      return file ? { file, vendorId: null, productId: null } : null;
    }
    const wantsIds = this.ids.vendorId != null || this.ids.productId != null;
    return (
      listDeviceFiles().find((device) => {
        const known = device.vendorId != null;
        if (wantsIds) return known && matches(device, this.ids);
        return !(known && this.reserved.some((ids) => matches(device, ids)));
      }) || null
    );
  }

  describe() {
    const device = this.find();
    if (!device) return null;
    return device.vendorId != null
      ? `${device.file} (${hex(device.vendorId)}:${hex(device.productId)})`
      : device.file;
  }

  async write(data) {
    const device = this.find();
    if (!device) {
      throw new Error(this.paths ? `Printer not found at ${this.paths.join(' or ')}` : 'No printer device file found');
    }

    let handle;
    try {
      handle = await fs.promises.open(device.file, 'w');
      // Write in chunks, the printer driver accepts only a limited amount at once
      for (let offset = 0; offset < data.length; ) {
        const { bytesWritten } = await handle.write(data, offset, Math.min(CHUNK_SIZE, data.length - offset));
        offset += bytesWritten;
      }
    } catch (e) {
      if (e.code === 'EACCES') {
        throw new Error(`No permission for ${device.file}. Run: sudo usermod -aG lp $USER (then log in again)`);
      }
      throw e;
    } finally {
      if (handle) await handle.close();
    }
  }
}

// Sends the job as raw data to a CUPS printer queue (macOS and Linux)
class CupsConnection {
  constructor({ queue }) {
    if (!queue) throw new Error("CUPS connection needs a 'queue', see `lpstat -p`");
    this.queue = queue;
  }

  describe() {
    try {
      execFileSync('lpstat', ['-p', this.queue], { stdio: 'ignore' });
      return `CUPS ${this.queue}`;
    } catch (e) {
      return null;
    }
  }

  write(data) {
    return new Promise((resolve, reject) => {
      const lp = spawn('lp', ['-d', this.queue, '-o', 'raw']);
      let errors = '';
      lp.stderr.on('data', (chunk) => (errors += chunk));
      lp.on('error', reject);
      lp.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(errors.trim() || `lp exited with code ${code}`))
      );
      lp.stdin.end(data);
    });
  }
}

// Saves every job to a folder instead of printing
class SimulatedConnection {
  constructor(name, folder) {
    this.name = name;
    this.folder = folder;
    this.count = 0;
  }

  describe() {
    return `Simulated: ${this.folder}`;
  }

  async write(data, preview) {
    await fs.promises.mkdir(this.folder, { recursive: true });
    const base = path.join(this.folder, `${this.name}-${Date.now()}-${++this.count}`);
    await fs.promises.writeFile(`${base}.bin`, data);
    if (preview) await fs.promises.writeFile(`${base}.png`, preview);
  }
}

module.exports = {
  UsbConnection,
  FileConnection,
  CupsConnection,
  SimulatedConnection,
  listUsbPrinters,
  listDeviceFiles,
  hex,
};
