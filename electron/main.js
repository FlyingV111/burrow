import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, safeStorage, shell } from 'electron'
import { setSecretCodec } from '../src/config.js'
import { startServer } from '../src/server.js'
import { stopTunnel } from '../src/tunnel.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.png')

/** @type {import('node:http').Server | null} */
let apiServer = null
/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null
let isQuitting = false

// Der Authtoken wird mit dem Schlüsselspeicher des Betriebssystems (DPAPI) verschlüsselt.
setSecretCodec({
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
  decrypt: (cipher) => safeStorage.decryptString(Buffer.from(cipher, 'base64')),
})

/** Externe Links nur über https im Standardbrowser öffnen. */
function openExternalSafely(url) {
  try {
    if (new URL(url).protocol === 'https:') shell.openExternal(url)
  } catch {
    // ungültige URL ignorieren
  }
}

async function createWindow() {
  const { port, server } = await startServer({ updateChecks: true })
  apiServer = server
  const origin = `http://localhost:${port}`

  mainWindow = new BrowserWindow({
    width: 420,
    height: 500,
    resizable: false,
    maximizable: false,
    title: 'Burrow',
    icon: ICON_PATH,
    autoHideMenuBar: true,
    backgroundColor: '#0c0c0c',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url)
    return { action: 'deny' }
  })

  // Die Oberfläche darf nie auf fremde Seiten navigieren.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== origin) {
      event.preventDefault()
      openExternalSafely(url)
    }
  })

  mainWindow.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  )

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  await mainWindow.loadURL(origin)
}

async function cleanup() {
  await stopTunnel()
  if (apiServer) {
    await new Promise((resolve) => apiServer.close(resolve))
    apiServer = null
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(createWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('window-all-closed', () => app.quit())

  app.on('before-quit', (event) => {
    if (isQuitting) return
    event.preventDefault()
    isQuitting = true
    cleanup()
      .catch(() => {})
      .finally(() => app.quit())
  })
}
