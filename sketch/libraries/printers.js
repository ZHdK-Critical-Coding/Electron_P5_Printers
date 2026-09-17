// Drucker-Bibliothek für den Sketch
//
// Stellt zwei Objekte bereit, alle Funktionen geben ein Promise zurück (mit `await` warten):
//
//   lineprinter.text(text, { w, h, style })    Text auf dem Nadeldrucker
//   lineprinter.feed(direction, steps)         Papier bewegen: 'up' oder 'down', 1 Step = 1/216 Zoll
//   lineprinter.image(bild)                    Bild auf dem Nadeldrucker (Binärmodus)
//
//   thermalprinter.text(text, { w, h, style, cut })  Text auf dem Thermodrucker
//   thermalprinter.image(bild, { cut })              Bild auf dem Thermodrucker (Binärmodus)
//   thermalprinter.cut()                             Papier schneiden
//
//   style: '' normal, 'b' fett, 'u' unterstrichen, 'bu' beides
//   w, h:  0 normal, 1 doppelte Breite / Höhe
//   bild:  das Canvas des Sketches (Standard), ein p5.Graphics oder ein p5.Image
//
//   printers.status()         { lineprinter: { connected, device }, thermalprinter: { ... } }
//   printers.onStatus(fn)     fn(status) wird aufgerufen, sobald ein Drucker ein- oder ausgesteckt wird

(function () {
  const bridge = window.printerBridge;

  // Fehlermeldung ohne den technischen Electron-Vorspann
  async function call(printer, action, ...args) {
    try {
      return await bridge.call(printer, action, ...args);
    } catch (e) {
      throw new Error(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    }
  }

  // Canvas, p5.Graphics oder p5.Image als PNG-Daten
  async function toPng(source) {
    source = source || document.querySelector('canvas');
    const canvas = source.elt || source.canvas || source;
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Bild muss ein Canvas, p5.Graphics oder p5.Image sein');
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }

  window.lineprinter = {
    text: (text, options = {}) => call('lineprinter', 'text', String(text), options),
    feed: (direction = 'down', steps = 1) => call('lineprinter', 'feed', direction, steps),
    image: async (source) => call('lineprinter', 'image', await toPng(source)),
  };

  window.thermalprinter = {
    text: (text, options = {}) => call('thermalprinter', 'text', String(text), options),
    image: async (source, options = {}) => call('thermalprinter', 'image', await toPng(source), options),
    cut: () => call('thermalprinter', 'cut'),
  };

  window.printers = {
    status: () => bridge.status(),
    onStatus: (callback) => bridge.onStatus(callback),
  };
})();
