const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')

// ─── 日志系统 ────────────────────────────────────────────────
const logDir = path.join(app.getPath('appData'), '聚云酒店管理系统', 'logs')
fs.mkdirSync(logDir, { recursive: true })
const logFile = path.join(logDir, `main-${Date.now()}.log`)
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`
  process.stdout.write(line)
  fs.appendFileSync(logFile, line)
}

const isDev = !app.isPackaged
const BASE_PATH = isDev ? path.join(__dirname, '..') : process.resourcesPath

let serverProcess = null
let mainWindow = null

// ─── 启动后端 ────────────────────────────────────────────────
function startServer() {
  const nodePath = isDev ? process.execPath : path.join(BASE_PATH, 'node.exe')
  const serverPath = path.join(BASE_PATH, 'server', 'index.js')
  const env = {
    ...process.env,
    PORT: '3001',
    ELECTRON: 'true',
    IS_PACKAGED: String(!isDev),
    BASE_PATH,
    NODE_PATH: isDev ? undefined : path.join(BASE_PATH, 'node_modules')
  }
  log('启动后端:', nodePath, serverPath)
  serverProcess = spawn(nodePath, [serverPath], { env, stdio: 'pipe' })
  serverProcess.stdout.on('data', d => log('[server]', d.toString().trim()))
  serverProcess.stderr.on('data', d => log('[server:err]', d.toString().trim()))
  serverProcess.on('exit', code => log('[server] 退出 code=', code))
}

// ─── 等待后端就绪 ────────────────────────────────────────────
function waitForServer(retries = 30) {
  return new Promise((resolve, reject) => {
    const check = (n) => {
      http.get('http://localhost:3001/api/health', res => {
        if (res.statusCode === 200) resolve()
        else retry(n)
      }).on('error', () => retry(n))
    }
    const retry = (n) => {
      if (n <= 0) return reject(new Error('后端启动超时'))
      setTimeout(() => check(n - 1), 500)
    }
    check(retries)
  })
}

// ─── 创建窗口 ────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 1200, minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  const url = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(BASE_PATH, 'frontend/dist/index.html')}`
  mainWindow.loadURL(url)
  mainWindow.webContents.on('before-input-event', (e, input) => {
    if (input.key === 'F12') mainWindow.webContents.openDevTools()
  })
}

// ─── App 生命周期 ─────────────────────────────────────────────
const lock = app.requestSingleInstanceLock()
if (!lock) { app.quit() }
else {
  app.on('second-instance', () => { if (mainWindow) mainWindow.focus() })
  app.whenReady().then(async () => {
    startServer()
    try {
      await waitForServer()
      createWindow()
    } catch (e) {
      log('ERROR:', e.message)
      const { dialog } = require('electron')
      dialog.showErrorBox('启动失败', '系统后台有问题，请查看日志：' + logFile)
      app.quit()
    }
  })
  app.on('before-quit', () => { if (serverProcess) serverProcess.kill() })
  app.on('window-all-closed', () => {
    if (serverProcess) serverProcess.kill()
    if (process.platform !== 'darwin') app.quit()
  })
}
