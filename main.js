const { app, BrowserWindow } = require('electron/main')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let serverProcess = null
const SERVER_PORT = 5001
const SERVER_URL = `http://localhost:${SERVER_PORT}`
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://photomaton-5b71.onrender.com'

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
      ...process.env,
      PUBLIC_BASE_URL,
    },
    stdio: 'inherit',
  })
  serverProcess.on('error', (error) => {
    console.error('Error iniciando el servidor local:', error)
    serverProcess = null
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

const createWindow = (serverReady = true) => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  })

  const loadLocalFile = () => {
    win.loadFile(path.join(__dirname, 'public', 'index.html'))
  }

  if (serverReady) {
    win.webContents.once('did-fail-load', () => {
      loadLocalFile()
    })
    win.loadURL(SERVER_URL)
  } else {
    loadLocalFile()
  }
}

app.whenReady().then(() => {
  startServer()
    .then(() => {
      createWindow(true)
    })
    .catch((error) => {
      console.error('No se pudo iniciar el servidor local:', error)
      createWindow(false)
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
