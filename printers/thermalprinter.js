const iconv = require('iconv-lite');
const { toDots, toBands, preview } = require('./image');

// Epson TM thermal receipt printer, ESC/POS commands
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const DENSITIES = {
  // mode: ESC * mode, rows: dots per band, stretch: how much taller the dots are than wide
  s8: { mode: 0, width: 256, rows: 8, stretch: 1.6 },
  d24: { mode: 33, width: 512, rows: 24, stretch: 1 },
};

const CUT = [LF, LF, LF, GS, 0x56, 0x00]; // Feed 3 lines, full cut

class ThermalPrinter {
  constructor(config) {
    this.config = config;
  }

  // style: 'b' bold, 'u' underline, 'bu' both. w, h: 0 = normal, 1 = double ... 7 = eight times
  text(text, { w = 0, h = 0, style = '', cut = false } = {}) {
    const size = (Math.min(Math.max(w, 0), 7) << 4) | Math.min(Math.max(h, 0), 7);
    return Buffer.concat([
      Buffer.from([ESC, 0x40]), // Initialize
      Buffer.from([ESC, 0x74, this.config.codePage]), // Code page
      Buffer.from([ESC, 0x61, 0]), // Align left
      Buffer.from([ESC, 0x45, style.includes('b') ? 1 : 0]), // Bold
      Buffer.from([ESC, 0x2d, style.includes('u') ? 1 : 0]), // Underline
      Buffer.from([GS, 0x21, size]), // Character size
      iconv.encode(`${text}\n`, this.config.encoding),
      Buffer.from(cut ? [LF, ...CUT] : []),
    ]);
  }

  cut() {
    return Buffer.from(CUT);
  }

  image(png, { cut = false } = {}) {
    const { density, dither, threshold } = this.config.image;
    const d = DENSITIES[density];
    if (!d) throw new Error(`Unknown density '${density}', use 's8' or 'd24'`);

    // Always print at the full width, squeezed vertically so the proportions stay right
    const image = toDots(
      png,
      (width, height) => ({ width: d.width, height: Math.round((d.width / width) * height / d.stretch) }),
      { dither, threshold }
    );

    const bytes = [
      Buffer.from([ESC, 0x40]),
      Buffer.from([ESC, 0x61, 1]), // Center
      Buffer.from([ESC, 0x33, 0]), // No line spacing between the bands
    ];
    for (const band of toBands(image, d.rows)) {
      bytes.push(Buffer.from([ESC, 0x2a, d.mode, image.width & 0xff, image.width >> 8]), band, Buffer.from([LF]));
    }
    bytes.push(Buffer.from([ESC, 0x32]), Buffer.from([ESC, 0x61, 0])); // Default line spacing, align left
    if (cut) bytes.push(Buffer.from(CUT));

    return { data: Buffer.concat(bytes), preview: preview(image, d.stretch) };
  }
}

module.exports = ThermalPrinter;
