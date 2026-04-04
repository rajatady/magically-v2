const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

const RUNTIME_PORT = 4321;
const WEB_DIR = path.join(__dirname, '..', 'web-dist');
const RUNTIME_DIR = path.join(__dirname, '..', '..', '..', 'packages', 'runtime');

let mainWindow = null;
let tray = null;
let runtimeProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#0a0a0b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,  // Allow file:// to fetch from localhost API
      partition: 'persist:magically',  // Persistent localStorage across launches
    },
  });

  // Load the bundled React app
  mainWindow.loadFile(path.join(WEB_DIR, 'index.html'));

  mainWindow.on('close', (e) => {
    // Hide instead of quit — keep running in tray
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Simple tray icon — 16x16 template image
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAEJJREFUOI1jYBhsgJGBgYGBgYEhkIGBIRCbJCMDA0MgNs2M2AQZGBgYArFpZsQmyMDAwBCITTMjNkEGBgaGQGwAAHbhBAvHhLCuAAAAAElFTkSuQmCC'
  );
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Magically',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Magically');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function check() {
      const socket = new net.Socket();
      socket.setTimeout(500);

      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });

      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for port ${port}`));
        } else {
          setTimeout(check, 300);
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        setTimeout(check, 300);
      });

      socket.connect(port, '127.0.0.1');
    }

    check();
  });
}

function startRuntime() {
  // Start the NestJS server as a child process
  runtimeProcess = spawn('bun', ['run', 'start:dev'], {
    cwd: RUNTIME_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(RUNTIME_PORT) },
  });

  runtimeProcess.stdout.on('data', (data) => {
    console.log(`[runtime] ${data.toString().trim()}`);
  });

  runtimeProcess.stderr.on('data', (data) => {
    console.error(`[runtime] ${data.toString().trim()}`);
  });

  runtimeProcess.on('exit', (code) => {
    console.log(`[runtime] exited with code ${code}`);
    runtimeProcess = null;
  });
}

async function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

app.whenReady().then(async () => {
  const alreadyRunning = await isPortInUse(RUNTIME_PORT);

  if (alreadyRunning) {
    console.log('[desktop] Runtime already running on port', RUNTIME_PORT);
  } else {
    startRuntime();
    console.log('[desktop] Waiting for runtime...');
    try {
      await waitForPort(RUNTIME_PORT);
      console.log('[desktop] Runtime ready');
    } catch (err) {
      console.error('[desktop] Runtime failed to start:', err.message);
    }
  }

  createWindow();
  createTray();
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (runtimeProcess) {
    runtimeProcess.kill();
    runtimeProcess = null;
  }
});

app.on('window-all-closed', () => {
  // Don't quit on macOS — stay in tray
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
