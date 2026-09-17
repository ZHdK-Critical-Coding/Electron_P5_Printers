const { contextBridge, ipcRenderer } = require('electron');

// Everything the sketch may use from the main process, available as `window.printerBridge`
contextBridge.exposeInMainWorld('printerBridge', {
  call: (printer, action, ...args) => ipcRenderer.invoke('printer', printer, action, ...args),
  status: () => ipcRenderer.invoke('printer-status'),
  onStatus: (callback) => ipcRenderer.on('printer-status', (event, status) => callback(status)),
});
