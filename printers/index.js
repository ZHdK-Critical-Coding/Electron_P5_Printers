const { ipcMain } = require('electron');
const config = require('./config');
const LinePrinter = require('./lineprinter');
const ThermalPrinter = require('./thermalprinter');
const { UsbConnection, FileConnection, CupsConnection, SimulatedConnection } = require('./connections');

const STATUS_INTERVAL = 2000;

function createConnection(name, connection, simulateFolder) {
  if (simulateFolder) return new SimulatedConnection(name, simulateFolder);

  // Printers without ids skip the devices of the printers that have ids
  const others = Object.entries(config)
    .filter(([other]) => other !== name)
    .map(([, c]) => c.connection);

  if (connection.type === 'usb') return new UsbConnection(connection, others);
  if (connection.type === 'file') return new FileConnection(connection, others);
  if (connection.type === 'cups') return new CupsConnection(connection);
  throw new Error(`Unknown connection type '${connection.type}' for ${name}`);
}

// Runs the jobs of one printer one after the other
class Queue {
  constructor(connection) {
    this.connection = connection;
    this.last = Promise.resolve();
  }

  add(job) {
    const run = this.last.then(async () => {
      const result = job();
      const { data, preview } = Buffer.isBuffer(result) ? { data: result } : result;
      await this.connection.write(data, preview);
      return 'ok';
    });
    this.last = run.catch(() => {});
    return run;
  }
}

// Registers the IPC handlers the sketch uses via preload.js
function setupPrinters(getWindow, { simulateFolder } = {}) {
  const drivers = {
    lineprinter: new LinePrinter(config.lineprinter),
    thermalprinter: new ThermalPrinter(config.thermalprinter),
  };

  const queues = {};
  for (const name of Object.keys(drivers)) {
    queues[name] = new Queue(createConnection(name, config[name].connection, simulateFolder));
  }

  // Which actions the sketch may call on which printer
  const actions = {
    lineprinter: {
      text: (text, options) => drivers.lineprinter.text(text, options),
      feed: (direction, steps) => drivers.lineprinter.feed(direction, steps),
      image: (png) => drivers.lineprinter.image(png),
    },
    thermalprinter: {
      text: (text, options) => drivers.thermalprinter.text(text, options),
      image: (png, options) => drivers.thermalprinter.image(png, options),
      cut: () => drivers.thermalprinter.cut(),
    },
  };

  ipcMain.handle('printer', (event, name, action, ...args) => {
    const run = actions[name] && actions[name][action];
    if (!run) throw new Error(`Unknown printer action ${name}.${action}`);
    return queues[name].add(() => run(...args));
  });

  function getStatus() {
    const status = {};
    for (const [name, queue] of Object.entries(queues)) {
      let device = null;
      try {
        device = queue.connection.describe();
      } catch (e) {
        // Device list not readable, treat as not connected
      }
      status[name] = { connected: device !== null, device, simulated: Boolean(simulateFolder) };
    }
    return status;
  }

  ipcMain.handle('printer-status', () => getStatus());

  // Tell the sketch when a printer is plugged in or out
  let last = '';
  setInterval(() => {
    const status = getStatus();
    const json = JSON.stringify(status);
    const win = getWindow();
    if (json !== last && win && !win.isDestroyed()) {
      last = json;
      win.webContents.send('printer-status', status);
    }
  }, STATUS_INTERVAL);
}

module.exports = setupPrinters;
