const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stopkekKiosk', {
  onConfig: (cb) => ipcRenderer.on('config', (_e, cfg) => cb(cfg)),
});
