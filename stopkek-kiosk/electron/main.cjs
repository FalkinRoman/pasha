const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULT_CONFIG = {
  apiUrl: 'https://stopkek.site/api',
  seatNumber: 1,
  kioskKey: 'stopkek-kiosk-prod-2026',
};

function resolveConfigPath() {
  const besideExe = path.join(path.dirname(process.execPath), 'config.json');
  if (fs.existsSync(besideExe)) return besideExe;
  return path.join(__dirname, '..', 'config.json');
}

function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(resolveConfigPath(), 'utf8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
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
