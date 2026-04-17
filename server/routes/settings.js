const express = require('express')
const path = require('path')
const multer = require('multer')
const fs = require('fs')

module.exports = function(db, uploadsPath) {
  const router = express.Router()
  const logoDir = path.join(uploadsPath, 'logo')
  fs.mkdirSync(logoDir, { recursive: true })
  const logoStorage = multer.diskStorage({
    destination: logoDir,
    filename: (req, file, cb) => cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`)
  })
  const uploadLogo = multer({ storage: logoStorage, limits: { fileSize: 2 * 1024 * 1024 } })

  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all()
    const settings = {}
    rows.forEach(r => { settings[r.key] = r.value })
    res.json({ code: 0, data: settings })
  })

  router.put('/', (req, res) => {
    const { key, value } = req.body
    if (!key) return res.json({ code: 1, msg: 'key 不能为空' })
    db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run(key, value)
    res.json({ code: 0, msg: '设置已更新' })
  })

  router.post('/logo', uploadLogo.single('logo'), (req, res) => {
    if (!req.file) return res.json({ code: 1, msg: '未上传文件' })
    const logoUrl = `/uploads/logo/${req.file.filename}`
    db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run('logo_url', logoUrl)
    res.json({ code: 0, data: { url: logoUrl } })
  })

  router.delete('/logo', (req, res) => {
    db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run('logo_url', '')
    res.json({ code: 0, msg: '已删除' })
  })

  router.get('/backup', (req, res) => {
    // 简单导出所有表数据为 JSON
    const tables = ['users', 'settings', 'room_types', 'hotel_rooms', 'guests', 'checkins', 'checkin_charges',
      'reservations', 'food_categories', 'dishes', 'dining_tables', 'table_sessions', 'session_items',
      'food_orders', 'food_order_items', 'product_categories', 'products', 'retail_orders', 'retail_order_items']
    const backup = {}
    for (const t of tables) {
      try { backup[t] = db.prepare(`SELECT * FROM ${t}`).all() } catch {}
    }
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="hotel-backup-${Date.now()}.json"`)
    res.send(JSON.stringify(backup, null, 2))
  })

  return router
}
