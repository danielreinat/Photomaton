const { app, BrowserWindow } = require('electron/main')
const { spawn } = require('child_process')
const http = require('http')
const path = require('path')

const SERVER_PORT = 5002
const SERVER_URL = `http://localhost:${SERVER_PORT}`
const SERVER_TIMEOUT_MS = 15000

let backendProcess = null

const waitForServer = (url, timeoutMs = SERVER_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const startTime = Date.now()
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume()
        resolve()
      })
      request.on('error', () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Servidor no disponible'))
          return
        }
        setTimeout(attempt, 400)
      })
    }
    attempt()
  })

const spawnBackend = (pythonCommand) => {
  const scriptPath = path.join(__dirname, 'app.py')
  backendProcess = spawn(pythonCommand, [scriptPath], { stdio: 'inherit' })
  backendProcess.on('exit', () => {
    backendProcess = null
  })
  return backendProcess
}

const startBackend = () => {
  if (backendProcess) {
    return
  }
  const isWindows = process.platform === 'win32'
  const pythonCandidates = isWindows ? ['python'] : ['python3', 'python']
  const [primary, fallback] = pythonCandidates
  const processRef = spawnBackend(primary)
  processRef.on('error', () => {
    if (fallback && !backendProcess) {
      spawnBackend(fallback)
    }
  })
}

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  })

  startBackend()
  try {
    await waitForServer(SERVER_URL)
    await win.loadURL(SERVER_URL)
  } catch (error) {
    await win.loadFile('public/index.html')
  }
}

app.whenReady().then(async () => {
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill()
  }
})
