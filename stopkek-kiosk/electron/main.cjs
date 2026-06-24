const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const HEADER_HEIGHT = 72;
const HEADER_HIDDEN_Y = -(HEADER_HEIGHT - 4); // показываем 4px полоску снизу окна

let headerPollId = null;
let headerHideTimer = null;

function showHeaderNow(win) {
  if (!win || win.isDestroyed() || displayMode !== 'header') return;
  clearTimeout(headerHideTimer);
  const { width } = primaryBounds();
  win.setFocusable(true);
  win.setIgnoreMouseEvents(false);
  win.setBounds({ x: 0, y: 0, width, height: HEADER_HEIGHT });
  headerHideTimer = setTimeout(() => {
    if (!win || win.isDestroyed() || displayMode !== 'header') return;
    win.setBounds({ x: 0, y: HEADER_HIDDEN_Y, width, height: HEADER_HEIGHT });
    win.setFocusable(false);
    win.setIgnoreMouseEvents(true, { forward: true }); // кликтуз — события уходят на рабочий стол
  }, 3000);
}

function startHeaderAutoHide(win) {
  stopHeaderAutoHide();
  showHeaderNow(win);
  headerPollId = setInterval(() => {
    if (!win || win.isDestroyed() || displayMode !== 'header') return;
    const cursor = screen.getCursorScreenPoint();
    if (cursor.y <= 4) showHeaderNow(win);
  }, 100);
}

function stopHeaderAutoHide() {
  clearInterval(headerPollId);
  headerPollId = null;
  clearTimeout(headerHideTimer);
  headerHideTimer = null;
}

const DEFAULT_CONFIG = {
  apiUrl: 'https://stopkek.site/api',
  seatNumber: 1,
  kioskKey: 'stopkek-kiosk-prod-2026',
  staffPassword: '12345678',
};

let mainWindow = null;
let displayMode = 'overlay';
let staffQuitOpen = false;
let displayModeBeforeStaffQuit = 'overlay';

// Шорткаты, которые блокируем в overlay-режиме
const OVERLAY_BLOCK_SHORTCUTS = [
  'Super+D',            // Показать рабочий стол
  'Super+Tab',          // Task View (Win+Tab)
  'Super+M',            // Свернуть все окна
  'Super+E',            // Проводник
  'Super+R',            // Диалог "Выполнить"
  'Super+L',            // Блокировка экрана
  'Super+X',            // Меню быстрого доступа
  'Super+I',            // Параметры Windows
  'Super+A',            // Центр уведомлений
  'Ctrl+Shift+Escape',  // Диспетчер задач
  'Alt+F4',             // Закрыть приложение
];

function regAdd(key, name, type, value) {
  execSync(
    `reg add "${key}" /v ${name} /t ${type} /d ${value} /f`,
    { stdio: 'ignore', windowsHide: true }
  );
}

function regDel(key, name) {
  try {
    execSync(
      `reg delete "${key}" /v ${name} /f`,
      { stdio: 'ignore', windowsHide: true }
    );
  } catch {}
}

// Заблокировать системные шорткаты через реестр (только Windows)
function disableSystemShortcuts() {
  if (process.platform !== 'win32') return;
  try {
    // Диспетчер задач
    regAdd(
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
      'DisableTaskMgr', 'REG_DWORD', '1'
    );
    // Все Win+* шорткаты (Win+D, Win+Tab, Win+E, Win+R, Win+L и т.д.)
    regAdd(
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer',
      'NoWinKeys', 'REG_DWORD', '1'
    );
  } catch {}
}

// Вернуть всё обратно при выходе
function enableSystemShortcuts() {
  if (process.platform !== 'win32') return;
  regDel(
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
    'DisableTaskMgr'
  );
  regDel(
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer',
    'NoWinKeys'
  );
}

function registerOverlayBlockShortcuts() {
  OVERLAY_BLOCK_SHORTCUTS.forEach((key) => {
    try { globalShortcut.register(key, () => {}); } catch {}
  });
}

function unregisterOverlayBlockShortcuts() {
  OVERLAY_BLOCK_SHORTCUTS.forEach((key) => {
    try { globalShortcut.unregister(key); } catch {}
  });
}

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
  unregisterOverlayBlockShortcuts();
  enableSystemShortcuts();
  // setSkipTaskbar до выхода из kiosk/fullscreen — иначе окно мигает в панели задач
  win.setSkipTaskbar(true);
  win.setKiosk(false);
  win.setFullScreen(false);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setResizable(false);
  win.setMovable(false);
  win.setFocusable(true);

  const bounds = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const finish = () => {
    win.setSkipTaskbar(true); // повторно после fullscreen/kiosk
    win.setBounds(bounds);
    win.show();
    win.webContents.send('display-mode', 'header');
    startHeaderAutoHide(win);
  };

  // На Windows после fullscreen/kiosk bounds иногда не схлопываются без задержки
  if (process.platform === 'win32') setTimeout(finish, 150);
  else finish();
}

function applyOverlayMode(win) {
  stopHeaderAutoHide();
  const b = primaryBounds();
  displayMode = 'overlay';
  registerOverlayBlockShortcuts();
  disableSystemShortcuts();
  win.setFocusable(true);
  win.setResizable(false);
  win.setMovable(false);
  win.setSkipTaskbar(true);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setKiosk(true);
  win.setFullScreen(true);
  win.setBounds(b);
  win.setSkipTaskbar(true); // повторно после kiosk/fullscreen
  win.show();
  win.focus();
  win.webContents.send('display-mode', 'overlay');
}

function applyStaffQuitOverlay(win) {
  stopHeaderAutoHide();
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
    skipTaskbar: true,
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

  // Блокировать все клавиатурные события в overlay-режиме (Chromium-уровень)
  win.webContents.on('before-input-event', (event, input) => {
    if (displayMode === 'overlay' && !staffQuitOpen) {
      // Пропускаем только Ctrl+Shift+Q для персонала
      const isStaffShortcut =
        (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'q';
      if (!isStaffShortcut) {
        event.preventDefault();
        return;
      }
    }

    // ☆ НОВОЕ: Блокировать Alt+F4 везде (не только в overlay)
    if (input.alt && input.key.toLowerCase() === 'f4') {
      event.preventDefault();
      return;
    }

    // ☆ НОВОЕ: Блокировать Alt+Tab везде
    if (input.alt && input.key.toLowerCase() === 'tab') {
      event.preventDefault();
      return;
    }
  });

  // Steal focus: если окно теряет фокус в overlay-режиме — немедленно забираем обратно
  win.on('blur', () => {
    if (displayMode === 'overlay' && !staffQuitOpen) {
      setTimeout(() => {
        if (!win.isDestroyed() && displayMode === 'overlay' && !staffQuitOpen) {
          win.setSkipTaskbar(true); // сброс taskbar-кнопки до show(), иначе иконка прыгает
          win.show();
          win.setAlwaysOnTop(true, 'screen-saver');
          win.focus();
        }
      }, 50);
    }
  });

  // ☆ НОВОЕ: Перехватывать попытку скрыть окно (minimize)
  win.on('minimize', (e) => {
    if (displayMode === 'overlay' && !staffQuitOpen) {
      e.preventDefault();
      win.show();
      win.focus();
    }
  });

  // ☆ НОВОЕ: Дополнительная защита от скрытия окна
  win.on('hide', () => {
    if (displayMode === 'overlay' && !staffQuitOpen && !win.isDestroyed()) {
      setTimeout(() => {
        win.setSkipTaskbar(true);
        win.show();
        win.focus();
      }, 100);
    }
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
    ipcMain.handle('show-header', () => {
      if (mainWindow && !mainWindow.isDestroyed()) showHeaderNow(mainWindow);
    });
    ipcMain.on('session-expired', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      [0, 400, 800].forEach((delay) => {
        setTimeout(() => {
          if (!mainWindow || mainWindow.isDestroyed()) return;
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
          mainWindow.show();
          mainWindow.focus();
        }, delay);
      });
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
      enableSystemShortcuts();
      globalShortcut.unregisterAll();
      app.isQuitting = true;
      app.exit(0); // чистый выход → watchdog видит код 0 → не перезапускает
    });
  });
}

app.on('will-quit', () => {
  enableSystemShortcuts();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {});
