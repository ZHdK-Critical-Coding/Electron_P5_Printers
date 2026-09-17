const iconv = require('iconv-lite');
const { toDots, toBands, preview } = require('./image');

// Epson dot matrix printer, ESC/P commands
const ESC = 0x1b;
const CRLF = [0x0d, 0x0a];

// Horizontal resolution of the ESC * bit image modes; vertical is always 72 dpi (8 dots per 8/72 inch)
const MODE_DPI = { 0: 60, 1: 120, 2: 120, 3: 240 };

class LinePrinter {
  constructor(config) {
    this.config = config;
  }

  // style: 'b' bold, 'u' underline, 'bu' both. w, h: 0 = normal, 1 = double width / height
  text(text, { w = 0, h = 0, style = '' } = {}) {
    const lines = String(text).replace(/\r?\n/g, '\r\n');
    return Buffer.concat([
      Buffer.from([ESC, 0x40]), // Initialize
      Buffer.from([ESC, 0x74, this.config.characterTable]), // Character table
      Buffer.from(style.includes('b') ? [ESC, 0x45] : [ESC, 0x46]), // Bold on / off
      Buffer.from([ESC, 0x2d, style.includes('u') ? 1 : 0]), // Underline
      Buffer.from([ESC, 0x57, w ? 1 : 0]), // Double width
      Buffer.from([ESC, 0x77, h ? 1 : 0]), // Double height
      iconv.encode(lines, this.config.encoding),
      Buffer.from(CRLF),
    ]);
  }

  // direction: 'down' feeds the paper out, 'up' pulls it back in. One step is 1/216 inch.
  feed(direction = 'down', steps = 1) {
    if (direction !== 'up' && direction !== 'down') {
      throw new Error(`Direction must be 'up' or 'down', not '${direction}'`);
    }
    const command = direction === 'down' ? 0x4a : 0x6a; // ESC J / ESC j
    const bytes = [ESC, 0x40];
    for (let left = Math.max(1, Math.round(steps)); left > 0; left -= 255) {
      bytes.push(ESC, command, Math.min(left, 255));
    }
    return Buffer.from(bytes);
  }

  image(png) {
    const { mode, maxWidth, dither, threshold } = this.config.image;
    const dpi = MODE_DPI[mode];
    const image = toDots(
      png,
      (width, height) => {
        const w = Math.min(width, maxWidth);
        // Compensate the different horizontal and vertical resolution
        return { width: w, height: Math.round((height * w) / width * (72 / dpi)) };
      },
      { dither, threshold }
    );

    const bytes = [
      Buffer.from([ESC, 0x40]),
      Buffer.from([ESC, 0x33, 24]), // Line spacing 24/216 inch = exactly one band
    ];
    for (const band of toBands(image, 8)) {
      bytes.push(Buffer.from([ESC, 0x2a, mode, image.width & 0xff, image.width >> 8]), band, Buffer.from(CRLF));
    }
    bytes.push(Buffer.from([ESC, 0x32]), Buffer.from([...CRLF, ...CRLF]));

    return { data: Buffer.concat(bytes), preview: preview(image, dpi / 72) };
  }
}

module.exports = LinePrinter;
