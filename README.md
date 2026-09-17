# Electron P5 Printers — Line Printer and Thermal Printer from p5.js

> A p5.js sketch in an [Electron](https://www.electronjs.org/) app that prints directly on an Epson dot matrix printer (line printer) and an Epson TM thermal printer — text and images. Based on [Electron_P5_Starter](https://github.com/ZHdK-Critical-Coding/Electron_P5_Starter).
> Ein p5.js-Sketch in einer [Electron](https://www.electronjs.org/)-App, der direkt auf einem Epson-Nadeldrucker und einem Epson-TM-Thermodrucker druckt — Text und Bilder. Basiert auf [Electron_P5_Starter](https://github.com/ZHdK-Critical-Coding/Electron_P5_Starter).

---

## 🇬🇧 English

### Overview

The browser examples [P5_Output_Printers_LinePrinter](https://github.com/ZHdK-Critical-Coding/P5_Output_Printers_LinePrinter), [P5_Output_Printers_ThermalPrinter_Lines](https://github.com/ZHdK-Critical-Coding/P5_Output_Printers_ThermalPrinter_Lines) and [P5_Output_Printers_ThermalPrinter_Bitmap](https://github.com/ZHdK-Critical-Coding/P5_Output_Printers_ThermalPrinter_Bitmap) need a Raspberry Pi running a WebSocket server ([Servers_RaspberriPi](https://github.com/ZHdK-Critical-Coding/Servers_RaspberriPi)) that passes the data on to the printer.

This app does not need a server: the printers are plugged into the computer running the app. The sketch talks to the Electron main process via IPC, and the main process sends the printer commands to the printer — on Linux via the printer device files (`/dev/usb/lp0`), on macOS and Windows directly over USB. The image conversion (resizing, dithering) that the servers did with ImageMagick, netpbm and sharp is built in, so nothing else has to be installed.

| Mode                            | Before (WebSocket)                        | Now (in the sketch)                               |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| Line printer, text              | `{ text, w, h, style }` to port 8090      | `lineprinter.text(text, { w, h, style })`         |
| Line printer, paper feed        | `{ direction, steps }` to port 8090       | `lineprinter.feed(direction, steps)`              |
| Line printer, image (binary)    | PNG blob to port 8090                     | `lineprinter.image(canvas)`                       |
| Thermal printer, text           | `{ text, w, h, style, cut }` to port 8080 | `thermalprinter.text(text, { w, h, style, cut })` |
| Thermal printer, image (binary) | PNG blob to port 8080, then `'cut'`       | `thermalprinter.image(canvas, { cut })`           |
| Thermal printer, cut            | `'cut'` to port 8080                      | `thermalprinter.cut()`                            |

All functions return a promise that resolves when the printer has received the job. Jobs for the same printer are queued, so there is no more "busy".

### Project Structure

```
Electron_P5_Printers/
├── printers/
│   ├── config.js           # Printer connections and settings — adjust here
│   ├── connections.js      # Device file, USB, CUPS and simulation
│   ├── image.js            # PNG → black and white dots (dithering, bit image bands)
│   ├── index.js            # IPC handlers, job queue, printer status
│   ├── lineprinter.js      # ESC/P commands for the dot matrix printer
│   └── thermalprinter.js   # ESC/POS commands for the thermal printer
├── scripts/
│   └── list-printers.js    # Lists printers, device files and CUPS queues
├── sketch/
│   ├── libraries/
│   │   ├── p5.min.js
│   │   ├── p5.sound.min.js
│   │   └── printers.js     # lineprinter / thermalprinter for the sketch
│   ├── index.html
│   ├── sketch.js           # Example sketch — edit this file
│   └── style.css
├── main.js                 # Electron main process
├── preload.js              # Bridge between sketch and main process
└── package.json            # Scripts and build configuration
```

### Getting Started

1. Install [Node.js](https://nodejs.org/) (LTS) and open the folder in Visual Studio Code.
2. Install the dependencies (only needed once):
   ```sh
   npm install
   ```
3. Plug in the printers and check that they are found:
   ```sh
   npm run list-printers
   ```
4. Start the develop mode:
   ```sh
   npm run dev
   ```

The example sketch shows the connection status of both printers, an image to print (click it to change the letter) and a panel with buttons for all modes.

### Without a Printer: Simulation

```sh
npm run dev:simulate
```

Every job is saved to the folder `simulated-output/` instead of being printed: the raw printer bytes (`.bin`) and, for images, a `.png` showing exactly the dots the printer would print. Ideal to work on a sketch at home.

### Using the Printers in Your Sketch

```js
// Text: style '' | 'b' | 'u' | 'bu', w and h: 0 = normal, 1 = double
await lineprinter.text('Hello', { style: 'b', w: 1, h: 0 });
await thermalprinter.text('Hello', { style: 'bu', w: 1, h: 1, cut: true });

// Paper feed on the line printer: 'up' or 'down', 1 step = 1/216 inch
await lineprinter.feed('down', 36);

// Images: the sketch canvas (default), a p5.Graphics or a p5.Image
await lineprinter.image();
await thermalprinter.image(myGraphics, { cut: true });
await thermalprinter.cut();

// Errors (e.g. printer not connected) can be caught
try {
  await thermalprinter.text('Hello');
} catch (e) {
  console.log(e.message);
}

// Status: { lineprinter: { connected, device }, thermalprinter: { connected, device } }
printers.onStatus((status) => console.log(status));
```

Images should be black on white. The line printer prints at most 480 dots wide (8 inches at 60 dpi) and uses dithering, so gray values become dot patterns. The thermal printer always prints at full width (256 dots) with a hard black and white threshold. Both are set in `printers/config.js`.

### Configuration

`printers/config.js` defines how each printer is connected. The printers are told apart by their USB ids: the thermal printer has `0x04b8:0x0e02` (as on the Raspberry Pi), the line printer has no ids and uses the first other printer. With more printers connected, enter the ids shown by `npm run list-printers`.

| Connection | Where | How |
| --- | --- | --- |
| `{ type: 'file', vendorId, productId }` | Linux (default) | Writes to the device file of the Linux printer driver: `/dev/usb/lp0`, `/dev/usb/lp1`, … for USB, `/dev/lp0`, … for the parallel port. The right file is found by the USB ids, so it does not matter in which order the printers were plugged in. |
| `{ type: 'file', path: '/dev/usb/lp0' }` | Linux | Always this file, like the old line printer server. `path` can be a list, the first existing file is used. |
| `{ type: 'usb', vendorId, productId }` | macOS, Windows (default), Linux | Talks to the printer directly over USB (libusb). |
| `{ type: 'cups', queue: 'EPSON_TM_T88V' }` | macOS, Linux | Sends the jobs unchanged ("raw") to a printer queue of the system (CUPS). |

Text encoding, image width, dithering and resolution are set there too.

### Operating Systems

- **Linux / Raspberry Pi:** the device files belong to the group `lp`. Add your user once, then log out and in again:
  ```sh
  sudo usermod -aG lp $USER
  ```
  Parallel port printers (`/dev/lp0`) have no USB ids — use `{ type: 'file', path: '/dev/lp0' }` for them.
- **macOS:** there are no device files for printers on macOS. The app talks to the printer directly over USB, which works without any setup as long as no print job from the system is running on the printer. If the printer is already set up in *System Settings → Printers* and USB access does not work, use its queue instead: `{ type: 'cups', queue: '...' }` — `npm run list-printers` shows the queue names. CUPS passes the bytes on unchanged, just like a device file.
- **Windows:** USB printers belong to the Windows printer driver, which the app cannot use. Install the WinUSB driver for the printer with [Zadig](https://zadig.akeo.ie/).

### Keys

| Key              | Action                           |
| ---------------- | -------------------------------- |
| `Escape`         | Quit the app                     |
| `Cmd/Ctrl` + `F` | Toggle fullscreen                |
| `F12`            | Toggle developer tools (console) |

### Develop and Build

| Command                  | Result                                                               |
| ------------------------ | -------------------------------------------------------------------- |
| `npm run dev`            | Window, dev tools, reload on save (restart on changes in `printers/`) |
| `npm run dev:simulate`   | Same, but jobs go to `simulated-output/`                             |
| `npm start`              | Fullscreen, as in the exhibition                                     |
| `npm run start:simulate` | Fullscreen with simulation                                           |
| `npm run list-printers`  | List connected printers, device files and CUPS queues                |
| `npm run pack`           | Quick test build for your own computer                               |
| `npm run build:mac`      | macOS `.dmg` and `.zip`                                              |
| `npm run build:win`      | Windows installer and portable `.exe`                                |
| `npm run build:linux`    | Linux `.AppImage` (x64)                                              |
| `npm run build:pi`       | Linux `.AppImage` for Raspberry Pi (arm64)                           |
| `npm run build:all`      | macOS, Windows and Linux x64                                         |

A built app started with `--simulate` saves the jobs to `Documents/simulated-output/`. For app icon, signing warnings and more build details, see [Electron_P5_Starter](https://github.com/ZHdK-Critical-Coding/Electron_P5_Starter).

---

## 🇩🇪 Deutsch

### Überblick

Die Browser-Beispiele [P5_Output_Printers_LinePrinter](https://github.com/ZHdK-Critical-Coding/P5_Output_Printers_LinePrinter), [P5_Output_Printers_ThermalPrinter_Lines](https://github.com/ZHdK-Critical-Coding/P5_Output_Printers_ThermalPrinter_Lines) und [P5_Output_Printers_ThermalPrinter_Bitmap](https://github.com/ZHdK-Critical-Coding/P5_Output_Printers_ThermalPrinter_Bitmap) brauchen einen Raspberry Pi mit WebSocket-Server ([Servers_RaspberriPi](https://github.com/ZHdK-Critical-Coding/Servers_RaspberriPi)), der die Daten an den Drucker weitergibt.

Diese App braucht keinen Server: Die Drucker sind am Computer angeschlossen, auf dem die App läuft. Der Sketch spricht per IPC mit dem Electron-Hauptprozess, und dieser schickt die Druckbefehle an den Drucker — unter Linux über die Gerätedateien (`/dev/usb/lp0`), unter macOS und Windows direkt per USB. Die Bildumwandlung (Skalieren, Dithering), die die Server mit ImageMagick, netpbm und sharp erledigt haben, ist eingebaut — es muss nichts zusätzlich installiert werden.

| Modus                         | Vorher (WebSocket)                        | Jetzt (im Sketch)                                 |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------- |
| Nadeldrucker, Text            | `{ text, w, h, style }` an Port 8090      | `lineprinter.text(text, { w, h, style })`         |
| Nadeldrucker, Papiervorschub  | `{ direction, steps }` an Port 8090       | `lineprinter.feed(direction, steps)`              |
| Nadeldrucker, Bild (Binär)    | PNG-Blob an Port 8090                     | `lineprinter.image(canvas)`                       |
| Thermodrucker, Text           | `{ text, w, h, style, cut }` an Port 8080 | `thermalprinter.text(text, { w, h, style, cut })` |
| Thermodrucker, Bild (Binär)   | PNG-Blob an Port 8080, danach `'cut'`     | `thermalprinter.image(canvas, { cut })`           |
| Thermodrucker, Schneiden      | `'cut'` an Port 8080                      | `thermalprinter.cut()`                            |

Alle Funktionen geben ein Promise zurück, das erfüllt wird, sobald der Drucker den Auftrag erhalten hat. Aufträge an denselben Drucker werden nacheinander abgearbeitet — ein «busy» gibt es nicht mehr.

### Erste Schritte

1. [Node.js](https://nodejs.org/) (LTS) installieren und den Ordner in Visual Studio Code öffnen.
2. Abhängigkeiten installieren (nur einmal nötig):
   ```sh
   npm install
   ```
3. Drucker einstecken und prüfen, ob sie gefunden werden:
   ```sh
   npm run list-printers
   ```
4. Entwicklungsmodus starten:
   ```sh
   npm run dev
   ```

Der Beispiel-Sketch zeigt den Verbindungsstatus beider Drucker, ein Bild zum Drucken (Klick darauf wechselt den Buchstaben) und ein Panel mit Knöpfen für alle Modi.

### Ohne Drucker: Simulation

```sh
npm run dev:simulate
```

Jeder Auftrag wird im Ordner `simulated-output/` gespeichert statt gedruckt: die Druckerdaten (`.bin`) und bei Bildern ein `.png`, das genau die Punkte zeigt, die der Drucker drucken würde. Ideal, um zuhause am Sketch zu arbeiten.

### Drucker im eigenen Sketch verwenden

```js
// Text: style '' | 'b' | 'u' | 'bu', w und h: 0 = normal, 1 = doppelt
await lineprinter.text('Hallo', { style: 'b', w: 1, h: 0 });
await thermalprinter.text('Hallo', { style: 'bu', w: 1, h: 1, cut: true });

// Papiervorschub am Nadeldrucker: 'up' oder 'down', 1 Step = 1/216 Zoll
await lineprinter.feed('down', 36);

// Bilder: das Canvas des Sketches (Standard), ein p5.Graphics oder ein p5.Image
await lineprinter.image();
await thermalprinter.image(meineGrafik, { cut: true });
await thermalprinter.cut();

// Fehler (z. B. Drucker nicht angeschlossen) abfangen
try {
  await thermalprinter.text('Hallo');
} catch (e) {
  console.log(e.message);
}

// Status: { lineprinter: { connected, device }, thermalprinter: { connected, device } }
printers.onStatus((status) => console.log(status));
```

Bilder sollten schwarz auf weiss sein. Der Nadeldrucker druckt höchstens 480 Punkte breit (8 Zoll bei 60 dpi) und verwendet Dithering, Grauwerte werden zu Punktmustern. Der Thermodrucker druckt immer in voller Breite (256 Punkte) mit harter Schwarz-Weiss-Schwelle. Beides lässt sich in `printers/config.js` einstellen.

### Konfiguration

In `printers/config.js` steht, wie die Drucker angeschlossen sind. Die Drucker werden über ihre USB-IDs unterschieden: Der Thermodrucker hat `0x04b8:0x0e02` (wie auf dem Raspberry Pi), der Nadeldrucker hat keine IDs und verwendet den ersten anderen Drucker. Sind mehr Drucker angeschlossen, die IDs aus `npm run list-printers` eintragen.

| Verbindung | Wo | Wie |
| --- | --- | --- |
| `{ type: 'file', vendorId, productId }` | Linux (Standard) | Schreibt in die Gerätedatei des Linux-Druckertreibers: `/dev/usb/lp0`, `/dev/usb/lp1`, … für USB, `/dev/lp0`, … für die Parallelschnittstelle. Die richtige Datei wird über die USB-IDs gefunden — egal, in welcher Reihenfolge die Drucker eingesteckt wurden. |
| `{ type: 'file', path: '/dev/usb/lp0' }` | Linux | Immer diese Datei, wie beim alten Nadeldrucker-Server. `path` kann eine Liste sein, die erste vorhandene Datei wird verwendet. |
| `{ type: 'usb', vendorId, productId }` | macOS, Windows (Standard), Linux | Spricht direkt per USB mit dem Drucker (libusb). |
| `{ type: 'cups', queue: 'EPSON_TM_T88V' }` | macOS, Linux | Schickt die Aufträge unverändert («raw») an eine Druckerwarteschlange des Systems (CUPS). |

Dort lassen sich auch Textkodierung, Bildbreite, Dithering und Auflösung anpassen.

### Betriebssysteme

- **Linux / Raspberry Pi:** Die Gerätedateien gehören der Gruppe `lp`. Den eigenen Benutzer einmalig hinzufügen, danach ab- und wieder anmelden:
  ```sh
  sudo usermod -aG lp $USER
  ```
  Drucker an der Parallelschnittstelle (`/dev/lp0`) haben keine USB-IDs — für sie `{ type: 'file', path: '/dev/lp0' }` verwenden.
- **macOS:** macOS kennt keine Gerätedateien für Drucker. Die App spricht direkt per USB mit dem Drucker; das funktioniert ohne Einrichtung, solange kein Druckauftrag des Systems auf dem Drucker läuft. Ist der Drucker bereits unter *Systemeinstellungen → Drucker* eingerichtet und der USB-Zugriff klappt nicht, stattdessen seine Warteschlange verwenden: `{ type: 'cups', queue: '...' }` — `npm run list-printers` zeigt die Namen. CUPS reicht die Daten unverändert weiter, wie eine Gerätedatei.
- **Windows:** USB-Drucker gehören dem Windows-Druckertreiber, den die App nicht verwenden kann. Mit [Zadig](https://zadig.akeo.ie/) den WinUSB-Treiber für den Drucker installieren.

### Tasten

| Taste            | Aktion                            |
| ---------------- | --------------------------------- |
| `Escape`         | App beenden                       |
| `Cmd/Ctrl` + `F` | Vollbild ein/aus                  |
| `F12`            | Entwicklertools (Konsole) ein/aus |

### Entwickeln und Bauen

| Befehl                   | Ergebnis                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| `npm run dev`            | Fenster, Entwicklertools, Reload beim Speichern (Neustart bei Änderungen in `printers/`) |
| `npm run dev:simulate`   | Dasselbe, Aufträge landen in `simulated-output/`                      |
| `npm start`              | Vollbild, wie in der Ausstellung                                      |
| `npm run start:simulate` | Vollbild mit Simulation                                               |
| `npm run list-printers`  | Angeschlossene Drucker, Gerätedateien und CUPS-Warteschlangen         |
| `npm run pack`           | Schneller Test-Build für den eigenen Computer                         |
| `npm run build:mac`      | macOS `.dmg` und `.zip`                                               |
| `npm run build:win`      | Windows-Installer und portable `.exe`                                 |
| `npm run build:linux`    | Linux-`.AppImage` (x64)                                               |
| `npm run build:pi`       | Linux-`.AppImage` für Raspberry Pi (arm64)                            |
| `npm run build:all`      | macOS, Windows und Linux x64                                          |

Eine gebaute App, die mit `--simulate` gestartet wird, speichert die Aufträge in `Dokumente/simulated-output/`. App-Icon, Warnungen wegen fehlender Signatur und weitere Build-Details: siehe [Electron_P5_Starter](https://github.com/ZHdK-Critical-Coding/Electron_P5_Starter).
