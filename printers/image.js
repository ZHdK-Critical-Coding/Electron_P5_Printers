const { nativeImage } = require('electron');

// Turns a PNG into black and white dots for the printer.
// `size(width, height)` returns the size in printer dots for an image of the given size.
// Returns { width, height, dots } where dots[y * width + x] is 1 for a black dot.
function toDots(png, size, { dither, threshold }) {
  const image = nativeImage.createFromBuffer(Buffer.from(png));
  if (image.isEmpty()) throw new Error('Image could not be read');

  const original = image.getSize();
  const target = size(original.width, original.height);
  const resized = image.resize({ width: target.width, height: Math.max(1, target.height), quality: 'best' });
  const { width, height } = resized.getSize();
  const bitmap = resized.toBitmap(); // BGRA

  // Grayscale, transparent pixels become white
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const b = bitmap[i * 4];
    const g = bitmap[i * 4 + 1];
    const r = bitmap[i * 4 + 2];
    const a = bitmap[i * 4 + 3] / 255;
    gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
  }

  const dots = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const black = gray[i] < threshold;
      dots[i] = black ? 1 : 0;

      if (dither === 'floyd-steinberg') {
        // Spread the error to the neighbouring pixels
        const error = gray[i] - (black ? 0 : 255);
        if (x + 1 < width) gray[i + 1] += (error * 7) / 16;
        if (y + 1 < height) {
          if (x > 0) gray[i + width - 1] += (error * 3) / 16;
          gray[i + width] += (error * 5) / 16;
          if (x + 1 < width) gray[i + width + 1] += (error * 1) / 16;
        }
      }
    }
  }

  return { width, height, dots };
}

// Builds ESC * bit image bands: every band is `rows` dots high (8 or 24),
// one column is `rows / 8` bytes, most significant bit on top.
function toBands({ width, height, dots }, rows) {
  const bytesPerColumn = rows / 8;
  const bands = [];
  for (let top = 0; top < height; top += rows) {
    const band = Buffer.alloc(width * bytesPerColumn);
    for (let x = 0; x < width; x++) {
      for (let bit = 0; bit < rows; bit++) {
        const y = top + bit;
        if (y < height && dots[y * width + x]) {
          band[x * bytesPerColumn + (bit >> 3)] |= 0x80 >> (bit & 7);
        }
      }
    }
    bands.push(band);
  }
  return bands;
}

// PNG of the dots, stretched by `scaleY` to show the real proportions on paper
function preview({ width, height, dots }, scaleY = 1) {
  const bitmap = Buffer.alloc(width * height * 4);
  for (let i = 0; i < dots.length; i++) {
    const v = dots[i] ? 0 : 255;
    bitmap.fill(v, i * 4, i * 4 + 3);
    bitmap[i * 4 + 3] = 255;
  }
  const image = nativeImage.createFromBitmap(bitmap, { width, height });
  return image.resize({ width, height: Math.round(height * scaleY), quality: 'good' }).toPNG();
}

module.exports = { toDots, toBands, preview };
