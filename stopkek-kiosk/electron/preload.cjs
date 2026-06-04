const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stopkekKiosk', {
  onConfig: (cb) => ipcRenderer.on('config', (_e, cfg) => cb(cfg)),
  onDisplayMode: (cb) => ipcRenderer.on('display-mode', (_e, mode) => cb(mode)),
  onStaffQuitRequest: (cb) => ipcRenderer.on('staff-quit-request', () => cb()),
  setDisplayMode: (mode) => ipcRenderer.invoke('set-display-mode', mode),
  verifyStaffPassword: (password) =>
    ipcRenderer.invoke('verify-staff-password', password),
  confirmStaffQuit: () => ipcRenderer.send('staff-quit-confirmed'),
  dismissStaffQuit: () => ipcRenderer.send('staff-quit-dismiss'),
});
