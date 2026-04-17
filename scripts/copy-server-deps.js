/**
 * 将 server/node_modules 拷贝到 _server_deps/
 * electron-builder 打包时会将 _server_deps/ 打入 extraResources -> node_modules/
 */
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')

const src = path.join(root, 'server', 'node_modules')
const dst = path.join(root, '_server_deps')

if (!fs.existsSync(src)) {
  console.log('[copy-server-deps] server/node_modules 不存在，跳过')
  process.exit(0)
}

fs.rmSync(dst, { recursive: true, force: true })
fs.mkdirSync(dst, { recursive: true })

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const item of fs.readdirSync(from)) {
    const s = path.join(from, item), d = path.join(to, item)
    const stat = fs.statSync(s)
    if (stat.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

copyDir(src, dst)
console.log('[copy-server-deps] 完成: _server_deps/')
