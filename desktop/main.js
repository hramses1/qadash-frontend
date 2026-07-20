const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Puerto del backend embebido. Debe coincidir con preload.js (apiBase).
const PORT = 3001;
let mainWindow = null;

// Levanta el backend Express/Socket.io reutilizando el server.js REAL del
// proyecto (no se reimplementa: evita duplicar rutas/sockets y desincronizar).
function startBackend() {
  // Datos en carpeta escribible del usuario: en la app empaquetada los
  // recursos son de solo lectura. profileManager/featureFlags ya honran
  // QADASH_DATA_DIR, así que perfiles/config/reportes viven aquí.
  process.env.QADASH_DATA_DIR = process.env.QADASH_DATA_DIR
    || path.join(app.getPath('userData'), 'data');
  process.env.PORT = String(PORT);

  const candidates = [
    path.join(__dirname, '..', '..', 'qadash-backend', 'server.js'),        // dev: repos hermanos
    path.join(process.resourcesPath || '', 'qadash-backend', 'server.js'),  // empaquetado (extraResources)
    path.join(__dirname, 'qadash-backend', 'server.js'),                    // empaquetado (files)
  ];
  const serverPath = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
  if (!serverPath) {
    throw new Error('No se encontró qadash-backend/server.js. ¿Está el backend junto a la app?');
  }
  require(serverPath); // arranca express + socket.io + scheduler y hace listen(PORT)
}

// Espera a que el backend responda antes de abrir la ventana (evita fetch en
// blanco al inicio). Reintenta ~10s.
function waitForBackend(retries = 50) {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/profile-admin', timeout: 800 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (left <= 0) return reject(new Error('El backend no respondió a tiempo'));
        setTimeout(() => tryOnce(left - 1), 200);
      });
      req.on('timeout', () => { req.destroy(); });
    };
    tryOnce(retries);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // seguridad: el frontend no accede a Node directo
      nodeIntegration: false,
    },
  });

  // Build de Vue (Vite) con base './' + hash router. Dev: ../dist.
  // Empaquetado: resources/dist (copiado por extraResources).
  const indexCandidates = [
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(process.resourcesPath || '', 'dist', 'index.html'),
  ];
  const indexPath = indexCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } })
    || indexCandidates[0];
  mainWindow.loadFile(indexPath);
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  try {
    startBackend();
    await waitForBackend();
  } catch (e) {
    console.error('[electron] fallo al iniciar backend:', e.message);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
