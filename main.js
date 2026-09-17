const { app, BrowserWindow, powerSaveBlocker } = require('electron');
const fs = require('fs');
const path = require('path');
const setupPrinters = require('./printers');

// `npm run dev` starts the app with --dev: windowed, with dev tools and live reload
const isDev = process.argv.includes('--dev');
// `--simulate` saves print jobs to simulated-output/ instead of printing
const isSimulated = process.argv.includes('--simulate');
const sketchDir = path.join(__dirname, 'sketch');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: !isDev,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.join(sketchDir, 'index.html'));

  // Escape quits the app, F12 toggles the dev tools, Cmd/Ctrl+F toggles fullscreen
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'Escape') app.quit();
    if (input.key === 'F12') win.webContents.toggleDevTools();
    if (input.key.toLowerCase() === 'f' && (input.meta || input.control)) win.setFullScreen(!win.isFullScreen());
  });

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

function watchForChanges() {
  // Reload the page when a file in sketch/ changes
  let timeout;
  fs.watch(sketchDir, { recursive: true }, () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => win && win.webContents.reloadIgnoringCache(), 100);
  });

  // Restart the whole app when main.js, preload.js or a file in printers/ changes
  const restart = () => {
    app.relaunch();
    app.exit(0);
  };
  fs.watch(__filename, restart);
  fs.watch(path.join(__dirname, 'preload.js'), restart);
  fs.watch(path.join(__dirname, 'printers'), restart);
}

// Only allow one running instance of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) win.focus();
  });

  app.whenReady().then(() => {
    setupPrinters(() => win, {
      simulateFolder: isSimulated ? path.join(app.isPackaged ? app.getPath('documents') : __dirname, 'simulated-output') : null,
    });
    createWindow();

    if (isDev) {
      watchForChanges();
    } else {
      // Keep the display awake, e.g. for installations
      powerSaveBlocker.start('prevent-display-sleep');
    }
  });

  app.on('window-all-closed', () => app.quit());
}
