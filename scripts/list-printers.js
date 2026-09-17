// Lists the connected printers with their ids, for printers/config.js
const { execFileSync } = require('child_process');
const { listUsbPrinters, listDeviceFiles, hex } = require('../printers/connections');

const ids = (vendorId, productId) => `vendorId: ${hex(vendorId)}, productId: ${hex(productId)}`;

async function main() {
  console.log('USB printers (type: usb)');
  const printers = listUsbPrinters();
  if (printers.length === 0) console.log('  none');
  for (const device of printers) {
    const { idVendor, idProduct } = device.deviceDescriptor;
    let name = '';
    try {
      device.open();
      const read = (index) =>
        new Promise((resolve) => device.getStringDescriptor(index, (err, value) => resolve(err ? '' : value)));
      const { iManufacturer, iProduct } = device.deviceDescriptor;
      name = `${await read(iManufacturer)} ${await read(iProduct)}`.trim();
      device.close();
    } catch (e) {
      // No permission to open the device, the ids are enough
    }
    console.log(`  ${ids(idVendor, idProduct)}  ${name}`);
  }

  if (process.platform === 'linux') {
    console.log('\nDevice files (type: file)');
    const files = listDeviceFiles();
    if (files.length === 0) console.log('  none');
    for (const { file, vendorId, productId } of files) {
      console.log(`  ${file}  ${vendorId != null ? ids(vendorId, productId) : ''}`);
    }
  }

  if (process.platform !== 'win32') {
    console.log('\nCUPS queues (type: cups)');
    try {
      const queues = execFileSync('lpstat', ['-e'], { encoding: 'utf8' }).trim();
      console.log(queues ? queues.replace(/^/gm, '  ') : '  none');
    } catch (e) {
      console.log('  CUPS not available');
    }
  }
}

main();
