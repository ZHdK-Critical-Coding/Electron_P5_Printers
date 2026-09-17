// Zwei Drucker direkt aus p5.js ansteuern:
// Nadeldrucker (lineprinter) und Thermodrucker (thermalprinter), je mit Text und Bild.
// Die Funktionen kommen aus libraries/printers.js.

let bild;                  // Grafik, die als Bild gedruckt wird
let txt = 'ZHDK';          // Buchstaben, die in der Grafik erscheinen
let count = 0;             // Welcher Buchstabe gerade angezeigt wird
let status = {};           // Verbindungsstatus der Drucker
let message = 'Bereit';    // Letzte Meldung

// UI-Elemente
let prompt, styleSelect, wideCheckbox, highCheckbox, cutCheckbox, stepsInput;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  bild = createGraphics(512, 512);
  bild.pixelDensity(1);

  createPanel();

  // Druckerstatus abfragen und bei Änderungen aktualisieren
  printers.status().then((s) => (status = s));
  printers.onStatus((s) => (status = s));
}

function draw() {
  background(40);
  drawBild();

  // Grafik links, zwischen Status und Meldung
  const size = min(height - 120, width - 420);
  image(bild, 40, 70, size, size);

  // Status und Meldung
  fill(255);
  noStroke();
  textSize(16);
  textAlign(LEFT, TOP);
  text(`Nadeldrucker: ${statusText(status.lineprinter)}`, 40, 16);
  text(`Thermodrucker: ${statusText(status.thermalprinter)}`, 40, 38);
  textAlign(LEFT, BOTTOM);
  text(message, 40, height - 16);
}

// Die Grafik, die gedruckt wird: schwarz auf weiss
function drawBild() {
  bild.background(255);
  bild.noFill();
  bild.stroke(0);
  bild.strokeWeight(4);
  bild.rect(2, 2, bild.width - 4, bild.height - 4);
  bild.line(0, 0, bild.width, bild.height);
  bild.line(0, bild.height, bild.width, 0);
  for (let d = 0.25; d <= 1; d += 0.25) {
    bild.circle(bild.width / 2, bild.height / 2, bild.width * d);
  }
  bild.noStroke();
  bild.fill(0);
  bild.textSize(bild.width);
  bild.text(txt[count % txt.length], bild.width * 0.14, bild.height * 0.87);
}

function statusText(printer) {
  if (!printer) return '...';
  return printer.connected ? `verbunden (${printer.device})` : 'nicht gefunden';
}

// Führt einen Druckauftrag aus und zeigt das Ergebnis an
async function run(label, job) {
  message = `${label} ...`;
  try {
    await job();
    message = `${label}: ok`;
  } catch (e) {
    message = `${label}: Fehler – ${e.message}`;
    console.error(e);
  }
}

// Optionen aus dem Formular
function textOptions() {
  return {
    style: styleSelect.value(),
    w: wideCheckbox.checked() ? 1 : 0,
    h: highCheckbox.checked() ? 1 : 0,
  };
}

function createPanel() {
  const panel = createDiv().class('panel');

  prompt = createElement('textarea', 'Schreib etwas...').parent(panel);

  styleSelect = createSelect().parent(panel);
  styleSelect.option('normal', '');
  styleSelect.option('fett', 'b');
  styleSelect.option('unterstrichen', 'u');
  styleSelect.option('fett + unterstrichen', 'bu');

  wideCheckbox = createCheckbox('doppelt breit').parent(panel);
  highCheckbox = createCheckbox('doppelt hoch').parent(panel);

  // Nadeldrucker
  createElement('h2', 'Nadeldrucker').parent(panel);
  createButton('Text drucken').parent(panel).mousePressed(() =>
    run('Nadeldrucker Text', () => lineprinter.text(prompt.value(), textOptions()))
  );
  createButton('Bild drucken').parent(panel).mousePressed(() =>
    run('Nadeldrucker Bild', () => lineprinter.image(bild))
  );
  const feedRow = createDiv().class('row').parent(panel);
  stepsInput = createInput('36', 'number').parent(feedRow);
  createButton('&uarr;').parent(feedRow).mousePressed(() =>
    run('Papier hoch', () => lineprinter.feed('up', Number(stepsInput.value()) || 1))
  );
  createButton('&darr;').parent(feedRow).mousePressed(() =>
    run('Papier runter', () => lineprinter.feed('down', Number(stepsInput.value()) || 1))
  );

  // Thermodrucker
  createElement('h2', 'Thermodrucker').parent(panel);
  cutCheckbox = createCheckbox('danach schneiden', true).parent(panel);
  createButton('Text drucken').parent(panel).mousePressed(() =>
    run('Thermodrucker Text', () =>
      thermalprinter.text(prompt.value(), { ...textOptions(), cut: cutCheckbox.checked() })
    )
  );
  createButton('Bild drucken').parent(panel).mousePressed(() =>
    run('Thermodrucker Bild', () => thermalprinter.image(bild, { cut: cutCheckbox.checked() }))
  );
  createButton('Schneiden').parent(panel).mousePressed(() =>
    run('Schneiden', () => thermalprinter.cut())
  );
}

// Klick auf die Grafik: nächster Buchstabe
function mousePressed() {
  if (mouseX < width - 380) count++;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
