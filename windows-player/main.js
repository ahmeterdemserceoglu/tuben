const http = require('http');
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, shell } = require('electron');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

let mainWindow;
let staticServer;

function webRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'web')
    : path.join(__dirname, '..', 'dist-windows');
}

function startStaticServer() {
  const root = path.resolve(webRoot());
  staticServer = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, 'http://127.0.0.1');
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const candidate = path.resolve(root, `.${decodedPath}`);
    const requestedFile = candidate.startsWith(`${root}${path.sep}`) || candidate === root
      ? candidate
      : path.join(root, 'index.html');
    const filePath = fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()
      ? requestedFile
      : path.join(root, 'index.html');

    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(filePath).pipe(response);
  });

  return new Promise((resolve, reject) => {
    staticServer.once('error', reject);
    staticServer.listen(0, '127.0.0.1', () => {
      staticServer.removeListener('error', reject);
      resolve(staticServer.address());
    });
  });
}

async function createWindow() {
  const address = await startStaticServer();
  const localOrigin = `http://127.0.0.1:${address.port}`;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    fullscreenable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(localOrigin)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  await mainWindow.loadURL(localOrigin);
  mainWindow.maximize();
  mainWindow.show();
}

app.whenReady().then(createWindow).catch((error) => {
  console.error(error);
  app.quit();
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  if (staticServer?.listening) staticServer.close();
});
