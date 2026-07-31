import { app, BrowserWindow, dialog, shell } from 'electron'
import { createServer } from 'node:net'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HOST = '127.0.0.1'
const STARTUP_TIMEOUT_MS = 30_000
const CN_GITHUB_RAW_ENDPOINT = 'https://gh-proxy.com/https://raw.githubusercontent.com'

let mainWindow
let appUrl

function getOutputDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, '.output')
    : path.resolve(app.getAppPath(), '..', '.output')
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()

    server.once('error', reject)
    server.listen(0, HOST, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : undefined

      server.close((error) => {
        if (error) reject(error)
        else if (port) resolve(port)
        else reject(new Error('Unable to determine an available local port.'))
      })
    })
  })
}

async function waitForServer(url) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(1_000) })
      return
    }
    catch {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  throw new Error(`The local server did not start within ${STARTUP_TIMEOUT_MS / 1_000} seconds.`)
}

async function startNitroServer() {
  const port = await findAvailablePort()
  const outputDirectory = getOutputDirectory()
  const serverEntry = path.join(outputDirectory, 'server', 'index.mjs')

  if (app.getLocaleCountryCode().toUpperCase() === 'CN'
    && !process.env.NUXT_PUBLIC_GITHUB_RAW_ENDPOINT
    && !process.env.GITHUB_RAW_ENDPOINT) {
    process.env.NUXT_PUBLIC_GITHUB_RAW_ENDPOINT = CN_GITHUB_RAW_ENDPOINT
  }

  process.env.NODE_ENV = 'production'
  process.env.HOST = HOST
  process.env.NITRO_HOST = HOST
  process.env.PORT = String(port)
  process.env.NITRO_PORT = String(port)

  await import(pathToFileURL(serverEntry).href)

  appUrl = `http://${HOST}:${port}/`
  await waitForServer(appUrl)

  return outputDirectory
}

function openExternal(url) {
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    void shell.openExternal(url.href)
  }
}

function createMainWindow(outputDirectory) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(outputDirectory, 'public', 'favicon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const target = new URL(url)
    if (target.origin !== new URL(appUrl).origin) openExternal(target)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url)
    if (target.origin === new URL(appUrl).origin) return

    event.preventDefault()
    openExternal(target)
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = undefined
  })

  void mainWindow.loadURL(appUrl)
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
}
else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady()
    .then(startNitroServer)
    .then(createMainWindow)
    .catch((error) => {
      console.error(error)
      dialog.showErrorBox('Collection Down failed to start', error instanceof Error ? error.message : String(error))
      app.quit()
    })

  app.on('window-all-closed', () => app.quit())
}
