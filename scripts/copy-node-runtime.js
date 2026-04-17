/**
 * 从系统 PATH 中找到 node.exe 并拷贝到 _node_runtime/
 * electron-builder 打包时会将 _node_runtime/node.exe 打入 extraResources
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const root = path.join(__dirname, '..')

let nodePath
try {
  nodePath = execSync('where node', { encoding: 'utf8' }).split('\n')[0].trim()
} catch {
  console.error('[copy-node-runtime] 找不到 node.exe，请确保 Node.js 已安装并在 PATH 中')
  process.exit(1)
}

const dstDir = path.join(root, '_node_runtime')
fs.mkdirSync(dstDir, { recursive: true })
fs.copyFileSync(nodePath, path.join(dstDir, 'node.exe'))
console.log('[copy-node-runtime] 已拷贝:', nodePath, '->', path.join(dstDir, 'node.exe'))
