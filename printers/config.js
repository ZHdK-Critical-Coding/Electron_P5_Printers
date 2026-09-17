// Printer configuration
//
// Every printer has a `connection`. `vendorId` and `productId` are optional: without them,
// the first printer that no other printer has claimed with its ids is used.
// Run `npm run list-printers` to see the connected printers and their ids.
//
//   { type: 'file', vendorId, productId }
//     Linux (default there): writes to the printer device file of the kernel driver,
//     /dev/usb/lp0, /dev/usb/lp1, ... (USB) or /dev/lp0, ... (parallel port).
//     The matching file is found by the USB ids. The user needs to be in the group `lp`.
//
//   { type: 'file', path: '/dev/usb/lp0' }
//     Linux: always this device file. `path` can be a list; the first existing file is used.
//
//   { type: 'usb', vendorId, productId }
//     macOS and Windows (default there), also works on Linux: talks to the printer
//     directly over USB (libusb).
//
//   { type: 'cups', queue: 'EPSON_TM_T88V' }
//     macOS and Linux: sends the jobs unchanged (raw) to a CUPS printer queue.
//     `lpstat -p` lists the queues. Useful when the printer is already set up in the system
//     and the operating system does not let the app access it over USB.
//
// Starting the app with `--simulate` (`npm run dev:simulate`) ignores the connections and saves
// every job to the folder `simulated-output/` instead: the raw printer bytes (.bin)
// and, for images, a preview of what the printer will print (.png).

// Linux uses the device files of the kernel driver, macOS and Windows talk USB directly
const type = process.platform === 'linux' ? 'file' : 'usb';

module.exports = {
  // Epson dot matrix printer (ESC/P)
  lineprinter: {
    connection: { type },
    // Text encoding and matching character table (ESC t 1 = PC437 on Epson ESC/P printers)
    encoding: 'cp437',
    characterTable: 1,
    image: {
      // Maximum width in dots. At 60 dpi, 480 dots are 8 inches.
      maxWidth: 480,
      // Bit image mode for ESC *: 0 = 60 dpi, 1 = 120 dpi, 2 = 120 dpi (fast), 3 = 240 dpi
      mode: 0,
      // 'floyd-steinberg' (dithering, good for photos) or 'threshold' (hard black and white)
      dither: 'floyd-steinberg',
      threshold: 128,
    },
  },

  // Epson TM thermal receipt printer (ESC/POS)
  thermalprinter: {
    connection: { type, vendorId: 0x04b8, productId: 0x0e02 },
    // Text encoding and matching code page (ESC t 0 = PC437 on Epson TM printers)
    encoding: 'cp437',
    codePage: 0,
    image: {
      // 's8': 256 dots wide, big and fast. 'd24': 512 dots wide, small and detailed.
      density: 's8',
      dither: 'threshold',
      threshold: 128,
    },
  },
};
