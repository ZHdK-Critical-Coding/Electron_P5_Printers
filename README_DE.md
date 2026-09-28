# Electron: Printers

[English](README.md)

Ein p5.js-Sketch in einer [Electron](https://www.electronjs.org/)-App, der
Text und Bilder direkt auf einem Epson-Nadeldrucker (Line Printer) und einem
Epson-TM-Thermodrucker druckt. Anders als bei den Browser-Beispielen braucht
es keinen Raspberry Pi und keinen WebSocket-Server: Die Drucker sind am
Computer angeschlossen, auf dem die App läuft. Basiert auf
[Electron_P5_Starter](https://github.com/ZHdK-Critical-Coding/Electron_P5_Starter).

## Installation

Voraussetzungen: [Node.js](https://nodejs.org/) (LTS), Visual Studio Code,
ein Epson-Nadeldrucker (ESC/P) und/oder ein Epson-TM-Thermodrucker
(ESC/POS) per USB. Ohne Drucker läuft die App im Simulationsmodus.

Die Browser-Versionen
([P5_Output_Printers_LinePrinter](https://github.com/ZHdK-Critical-Coding/P5_Output_Printers_LinePrinter),
[P5_Output_Printers_ThermalPrinter_Lines](https://github.com/ZHdK-Critical-Coding/P5_Output_Printers_ThermalPrinter_Lines),
[P5_Output_Printers_ThermalPrinter_Bitmap](https://github.com/ZHdK-Critical-Coding/P5_Output_Printers_ThermalPrinter_Bitmap))
brauchen einen Raspberry Pi mit
[Servers_RaspberriPi](https://github.com/ZHdK-Critical-Coding/Servers_RaspberriPi).
Diese App erledigt die Bildumwandlung (Skalieren, Dithering) selbst, es
muss nichts zusätzlich installiert werden.

1. Den Ordner in Visual Studio Code öffnen und die Abhängigkeiten
   installieren (nur einmal nötig):
   ```sh
   npm install
   ```
2. Drucker einstecken und prüfen, ob sie gefunden werden:
   ```sh
   npm run list-printers
   ```

Abhängigkeiten (`package.json`): Electron 44, electron-builder 26, `usb`
(USB-Zugriff über libusb), `iconv-lite` (Textkodierung). Bibliotheken in
`sketch/libraries/`: p5.js 1.10.0, p5.sound 1.0.1 (eingebunden, nicht
verwendet), `printers.js` (Druckerfunktionen für den Sketch).

### Druckerverbindung

In `printers/config.js` steht, wie die Drucker angeschlossen sind. Die
Drucker werden über ihre USB-IDs unterschieden: Der Thermodrucker hat
`0x04b8:0x0e02`, der Nadeldrucker hat keine IDs und verwendet den ersten
anderen Drucker. Sind mehr Drucker angeschlossen, die IDs aus
`npm run list-printers` eintragen.

| Verbindung | Wo | Wie |
| --- | --- | --- |
| `{ type: 'file', vendorId, productId }` | Linux (Standard) | Schreibt in die Gerätedatei des Linux-Druckertreibers: `/dev/usb/lp0`, `/dev/usb/lp1`, … für USB, `/dev/lp0`, … für die Parallelschnittstelle. Die richtige Datei wird über die USB-IDs gefunden, die Reihenfolge beim Einstecken spielt keine Rolle. |
| `{ type: 'file', path: '/dev/usb/lp0' }` | Linux | Immer diese Datei. `path` kann eine Liste sein, die erste vorhandene Datei wird verwendet. |
| `{ type: 'usb', vendorId, productId }` | macOS, Windows (Standard), Linux | Spricht direkt per USB mit dem Drucker (libusb). |
| `{ type: 'cups', queue: 'EPSON_TM_T88V' }` | macOS, Linux | Schickt die Aufträge unverändert («raw») an eine CUPS-Druckerwarteschlange. |

- **Linux / Raspberry Pi:** Die Gerätedateien gehören der Gruppe `lp`. Den
  eigenen Benutzer einmalig hinzufügen, danach ab- und wieder anmelden:
  `sudo usermod -aG lp $USER`. Drucker an der Parallelschnittstelle haben
  keine USB-IDs – für sie `{ type: 'file', path: '/dev/lp0' }` verwenden.
- **macOS:** Es gibt keine Gerätedateien für Drucker; die App spricht direkt
  per USB mit dem Drucker. Das klappt, solange kein Druckauftrag des Systems
  auf dem Drucker läuft. Ist der Drucker unter *Systemeinstellungen →
  Drucker* eingerichtet und der USB-Zugriff klappt nicht, stattdessen seine
  Warteschlange verwenden: `{ type: 'cups', queue: '...' }` –
  `npm run list-printers` zeigt die Namen.
- **Windows:** USB-Drucker gehören dem Windows-Druckertreiber, den die App
  nicht verwenden kann. Mit [Zadig](https://zadig.akeo.ie/) den
  WinUSB-Treiber für den Drucker installieren.

## Ausführen

Entwicklungsmodus starten:

```sh
npm run dev
```

Der Beispiel-Sketch zeigt den Verbindungsstatus beider Drucker, eine Grafik
zum Drucken (Klick darauf wechselt den Buchstaben) und ein Panel mit Knöpfen
für alle Modi.

### Ohne Drucker: Simulation

```sh
npm run dev:simulate
```

Jeder Auftrag wird in `simulated-output/` gespeichert statt gedruckt: die
Druckerdaten (`.bin`) und bei Bildern ein `.png`, das genau die Punkte
zeigt, die der Drucker drucken würde. Eine gebaute App, die mit
`--simulate` gestartet wird, speichert die Aufträge in
`Dokumente/simulated-output/`.

### Tasten, Entwickeln und Bauen

`Escape` beendet die App, `Cmd/Ctrl` + `F` schaltet Vollbild ein/aus, `F12`
die Entwicklertools.

| Befehl                   | Ergebnis                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `npm run dev`            | Fenster, Entwicklertools, Reload beim Speichern (Neustart bei Änderungen in `printers/`) |
| `npm run dev:simulate`   | Dasselbe, Aufträge landen in `simulated-output/`                                         |
| `npm start`              | Vollbild, wie in der Ausstellung                                                         |
| `npm run start:simulate` | Vollbild mit Simulation                                                                  |
| `npm run list-printers`  | Angeschlossene Drucker, Gerätedateien und CUPS-Warteschlangen                            |
| `npm run pack`           | Schneller Test-Build für den eigenen Computer                                            |
| `npm run build:mac`      | macOS `.dmg` und `.zip`                                                                  |
| `npm run build:win`      | Windows-Installer und portable `.exe`                                                    |
| `npm run build:linux`    | Linux-`.AppImage` (x64)                                                                  |
| `npm run build:pi`       | Linux-`.AppImage` für Raspberry Pi (arm64)                                               |
| `npm run build:all`      | macOS, Windows und Linux x64                                                             |

App-Icon, Warnungen wegen fehlender Signatur und weitere Build-Details:
siehe
[Electron_P5_Starter](https://github.com/ZHdK-Critical-Coding/Electron_P5_Starter).

## Coding-Hilfe

### Projektstruktur

```
Electron_P5_Printers/
├── printers/
│   ├── config.js           # Druckerverbindungen und Einstellungen — hier anpassen
│   ├── connections.js      # Gerätedatei, USB, CUPS und Simulation
│   ├── image.js            # PNG → schwarze und weisse Punkte (Dithering, Bit-Image-Bänder)
│   ├── index.js            # IPC-Handler, Auftragswarteschlange, Druckerstatus
│   ├── lineprinter.js      # ESC/P-Befehle für den Nadeldrucker
│   └── thermalprinter.js   # ESC/POS-Befehle für den Thermodrucker
├── scripts/
│   └── list-printers.js    # Listet Drucker, Gerätedateien und CUPS-Warteschlangen
├── sketch/
│   ├── libraries/
│   │   ├── p5.min.js
│   │   ├── p5.sound.min.js
│   │   └── printers.js     # lineprinter / thermalprinter für den Sketch
│   ├── index.html
│   ├── sketch.js           # Beispiel-Sketch — diese Datei bearbeiten
│   └── style.css
├── main.js                 # Electron-Hauptprozess
├── preload.js              # Brücke zwischen Sketch und Hauptprozess
└── package.json            # Scripts und Build-Konfiguration
```

### Druckerfunktionen im Sketch

Alle Funktionen geben ein Promise zurück, das erfüllt wird, sobald der
Drucker den Auftrag erhalten hat. Aufträge an denselben Drucker werden
nacheinander abgearbeitet – ein «busy» gibt es nicht.

| Modus                    | Funktion                                          |
| ------------------------ | ------------------------------------------------- |
| Nadeldrucker, Text       | `lineprinter.text(text, { w, h, style })`         |
| Nadeldrucker, Vorschub   | `lineprinter.feed(direction, steps)`              |
| Nadeldrucker, Bild       | `lineprinter.image(canvas)`                       |
| Thermodrucker, Text      | `thermalprinter.text(text, { w, h, style, cut })` |
| Thermodrucker, Bild      | `thermalprinter.image(canvas, { cut })`           |
| Thermodrucker, Schneiden | `thermalprinter.cut()`                            |
| Status                   | `printers.status()`, `printers.onStatus(fn)`      |

```js
// Text: style '' | 'b' | 'u' | 'bu', w und h: 0 = normal, 1 = doppelt
await lineprinter.text('Hallo', { style: 'b', w: 1, h: 0 });
await thermalprinter.text('Hallo', { style: 'bu', w: 1, h: 1, cut: true });

// Papiervorschub am Nadeldrucker: 'up' oder 'down', 1 Step = 1/216 Zoll
await lineprinter.feed('down', 36);

// Bilder: das Canvas des Sketches (Standard), ein p5.Graphics oder ein p5.Image
await lineprinter.image();
await thermalprinter.image(meineGrafik, { cut: true });

// Fehler (z. B. Drucker nicht angeschlossen) abfangen
try {
  await thermalprinter.text('Hallo');
} catch (e) {
  console.log(e.message);
}
```

### Was passiert wo

- **`sketch/sketch.js`**: das Beispiel. `setup()` erstellt die
  Zeichenfläche, eine 512×512-`p5.Graphics` (`bild`) und das Panel mit den
  Knöpfen (`createPanel()`) und abonniert den Druckerstatus. `drawBild()`
  zeichnet die schwarz-weisse Grafik, die gedruckt wird; `draw()` zeigt sie
  zusammen mit Status und letzter Meldung. `run()` umschliesst jeden
  Druckauftrag und zeigt «ok» oder den Fehler an.
- **`sketch/libraries/printers.js`**: definiert `lineprinter`,
  `thermalprinter` und `printers`. Bilder werden mit `toPng()` in PNG
  umgewandelt und über `window.printerBridge` (aus **`preload.js`**) an den
  Hauptprozess geschickt.
- **`main.js`**: erstellt das Fenster (Vollbild, ausser mit `--dev`),
  behandelt die Tasten und den Live-Reload im Entwicklungsmodus und ruft
  `setupPrinters()` auf.
- **`printers/index.js`**: registriert die IPC-Handler, führt pro Drucker
  eine `Queue` und prüft alle 2 Sekunden den Druckerstatus.
- **`printers/lineprinter.js` / `thermalprinter.js`**: erzeugen die rohen
  ESC/P- und ESC/POS-Bytes für Text, Vorschub, Bild und Schneiden.
- **`printers/image.js`**: skaliert das PNG und wandelt es in schwarze und
  weisse Punkte um (`toDots()`), danach in Bit-Image-Bänder (`toBands()`).
- **`printers/config.js`**: hier werden Verbindungen, Textkodierung und
  Bildeinstellungen angepasst. Der Nadeldrucker druckt höchstens 480 Punkte
  breit (8 Zoll bei 60 dpi, `mode: 0`) mit Floyd-Steinberg-Dithering; der
  Thermodrucker druckt in voller Breite (256 Punkte mit `density: 's8'`,
  512 mit `'d24'`) mit harter Schwelle bei 128.
