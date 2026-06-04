const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
} = require('electron');
const path = require('path');
const fs = require('fs');

const HEADER_HEIGHT = 72;

const DEFAULT_CONFIG = {
  apiUrl: 'https://stopkek.site/api',
  seatNumber: 1,
  kioskKey: 'stopkek-kiosk-prod-2026',
  staffPassword: 'stopkek-staff',
};

let mainWindow = null;
let displayMode = 'overlay';
let staffQuitOpen = false;
let displayModeBeforeStaffQuit = 'overlay';

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

function primaryBounds() {
  return screen.getPrimaryDisplay().bounds;
}

function applyHeaderMode(win) {
  const { width } = primaryBounds();
  displayMode = 'header';
  win.setKiosk(false);
  win.setFullScreen(false);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setSkipTaskbar(true);
  win.setResizable(false);
  win.setMovable(false);
  win.setFocusable(true);

  const bounds = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const finish = () => {
    win.setBounds(bounds);
    win.show();
    win.webContents.send('display-mode', 'header');
  };

  // На Windows после fullscreen/kiosk bounds иногда не схлопываются без задержки
  if (process.platform === 'win32') setTimeout(finish, 80);
  else finish();
}

function applyOverlayMode(win) {
  const b = primaryBounds();
  displayMode = 'overlay';
  win.setResizable(false);
  win.setMovable(false);
  win.setSkipTaskbar(true);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setKiosk(true);
  win.setFullScreen(true);
  win.setBounds(b);
  win.setFocusable(true);
  win.show();
  win.focus();
  win.webContents.send('display-mode', 'overlay');
}

function applyStaffQuitOverlay(win) {
  const b = primaryBounds();
  staffQuitOpen = true;
  // Не setFullScreen(true) — на Windows потом хедер не схлопывается обратно
  win.setKiosk(false);
  win.setFullScreen(false);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setSkipTaskbar(true);
  win.setResizable(false);
  win.setMovable(false);
  win.setFocusable(true);

  const finish = () => {
    win.setBounds(b);
    win.show();
    win.focus();
  };
  if (process.platform === 'win32') setTimeout(finish, 80);
  else finish();
}

function dismissStaffQuitOverlay(win) {
  if (!staffQuitOpen) return;
  staffQuitOpen = false;
  if (displayModeBeforeStaffQuit === 'header') applyHeaderMode(win);
  else applyOverlayMode(win);
}

function setDisplayMode(mode) {
  if (!mainWindow || mainWindow.isDestroyed() || staffQuitOpen) return;
  if (mode === 'header') applyHeaderMode(mainWindow);
  else applyOverlayMode(mainWindow);
}

function openStaffQuit() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  displayModeBeforeStaffQuit = displayMode;
  applyStaffQuitOverlay(mainWindow);
  mainWindow.webContents.send('staff-quit-request');
}

function createWindow() {
  const cfg = loadConfig();
  const win = new BrowserWindow({
    fullscreen: true,
    frame: false,
    kiosk: true,
    autoHideMenuBar: true,
    backgroundColor: '#0A0A0A',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;

  win.once('ready-to-show', () => {
    applyOverlayMode(win);
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('config', cfg);
    win.webContents.send('display-mode', displayMode);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL('http://127.0.0.1:5174');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      openStaffQuit();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    openStaffQuit();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (displayMode === 'overlay') applyOverlayMode(mainWindow);
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    ipcMain.handle('set-display-mode', (_e, mode) => {
      if (mode === 'header' || mode === 'overlay') setDisplayMode(mode);
    });
    ipcMain.handle('verify-staff-password', (_e, password) => {
      const cfg = loadConfig();
      const expected = String(cfg.staffPassword ?? '').trim();
      return Boolean(expected && password === expected);
    });
    ipcMain.on('staff-quit-dismiss', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        dismissStaffQuitOverlay(mainWindow);
      }
    });
    ipcMain.on('staff-quit-confirmed', () => {
      app.isQuitting = true;
      app.exit(0);
    });
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {});
