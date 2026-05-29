const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {
      apiUrl: 'http://46.149.71.92/api',
      seatNumber: 1,
      kioskKey: 'dev-kiosk-key-change-me',
    };
  }
}

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    frame: false,
    kiosk: true,
    autoHideMenuBar: true,
    backgroundColor: '#0A0A0A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const cfg = loadConfig();
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('config', cfg);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL('http://127.0.0.1:5174');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Только для персонала клуба — закрыть подложку
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    app.quit();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
