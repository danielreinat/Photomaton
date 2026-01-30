const { app, BrowserWindow } = require('electron/main')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let serverProcess = null
const SERVER_PORT = 5001
const SERVER_URL = `http://localhost:${SERVER_PORT}`

const waitForServer = (timeoutMs = 8000) => new Promise((resolve, reject) => {
  const start = Date.now()
  const attempt = () => {
    const req = http.get(`${SERVER_URL}/index.html`, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
        res.resume()
        resolve()
        return
      }
      res.resume()
      if (Date.now() - start >= timeoutMs) {
        reject(new Error('Servidor no responde'))
        return
      }
      setTimeout(attempt, 300)
    })
    req.on('error', () => {
      if (Date.now() - start >= timeoutMs) {
        reject(new Error('Servidor no responde'))
        return
      }
      setTimeout(attempt, 300)
    })
  }
  attempt()
})

const startServer = async () => {
  if (serverProcess) {
    return
  }
  const pythonCommand = process.platform === 'win32' ? 'python' : 'python3'
  const serverPath = path.join(app.getAppPath(), 'app.py')
  serverProcess = spawn(pythonCommand, [serverPath], {
    env: {
      ...process.env,ain
    },
    stdio: 'inherit',
  })
  serverProcess.on('exit', () => {
    serverProcess = null
  })
  await waitForServer()
}

const stopServer = () => {
  if (!serverProcess) {
    return
  }
  serverProcess.kill()
  serverProcess = null
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  })

  win.loadURL(SERVER_URL)
}

app.whenReady().then(() => {
  startServer()
    .then(() => {
      createWindow()
    })
    .catch((error) => {
      console.error('No se pudo iniciar el servidor local:', error)
      createWindow()
    })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopServer()
})
