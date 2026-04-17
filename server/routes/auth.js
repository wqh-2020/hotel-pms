const express = require('express')
const crypto = require('crypto')
const SALT = '_hotel_pms_salt'
const hashPwd = (p) => crypto.createHash('sha256').update(p + SALT).digest('hex')

module.exports = function(db) {
  const router = express.Router()

  // 登录
  router.post('/login', (req, res) => {
    const { username, password } = req.body
    if (!username || !password) return res.json({ code: 1, msg: '账号密码不能为空' })
    const user = db.prepare('SELECT * FROM users WHERE username=? AND status=?').get(username, 'active')
    if (!user || user.password_hash !== hashPwd(password)) return res.json({ code: 1, msg: '账号或密码错误' })
    const token = crypto.randomBytes(64).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19)
    db.prepare('INSERT INTO tokens(token,user_id,expires_at) VALUES(?,?,?)').run(token, user.id, expiresAt)
    res.json({ code: 0, data: { token, user: { id: user.id, username: user.username, realname: user.realname, role: user.role } } })
  })

  // 登出
  router.post('/logout', (req, res) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
    if (token) db.prepare('DELETE FROM tokens WHERE token=?').run(token)
    res.json({ code: 0, msg: '已登出' })
  })

  // 当前用户
  router.get('/current', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    res.json({ code: 0, data: req.user })
  })

  // 当前用户 (别名)
  router.get('/me', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    res.json({ code: 0, data: req.user })
  })

  // 用户列表
  router.get('/users', (req, res) => {
    const list = db.prepare('SELECT id,username,realname,role,status,created_at FROM users ORDER BY id').all()
    res.json({ code: 0, data: list })
  })

  // 新增用户
  router.post('/users', (req, res) => {
    const { username, password, realname, role } = req.body
    if (!username || !password) return res.json({ code: 1, msg: '账号密码不能为空' })
    try {
      db.prepare('INSERT INTO users(username,password_hash,realname,role) VALUES(?,?,?,?)').run(username, hashPwd(password), realname || username, role || 'staff')
      res.json({ code: 0, msg: '创建成功' })
    } catch (e) {
      res.json({ code: 1, msg: '账号已存在' })
    }
  })

  // 更新用户
  router.put('/users/:id', (req, res) => {
    const { realname, role, status } = req.body
    db.prepare('UPDATE users SET realname=?,role=?,status=? WHERE id=?').run(realname, role, status, req.params.id)
    res.json({ code: 0, msg: '更新成功' })
  })

  // 重置密码
  router.put('/users/:id/password', (req, res) => {
    const { newPassword } = req.body
    if (!newPassword) return res.json({ code: 1, msg: '密码不能为空' })
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPwd(newPassword), req.params.id)
    res.json({ code: 0, msg: '密码重置成功' })
  })

  // 删除用户
  router.delete('/users/:id', (req, res) => {
    const u = db.prepare('SELECT role FROM users WHERE id=?').get(req.params.id)
    if (u && u.role === 'admin') return res.json({ code: 1, msg: '不能删除管理员' })
    db.prepare('DELETE FROM users WHERE id=?').run(req.params.id)
    res.json({ code: 0, msg: '删除成功' })
  })

  // 修改自己密码
  router.put('/my-password', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    const { oldPassword, newPassword } = req.body
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)
    if (user.password_hash !== hashPwd(oldPassword)) return res.json({ code: 1, msg: '原密码错误' })
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPwd(newPassword), req.user.id)
    res.json({ code: 0, msg: '密码修改成功' })
  })

  return router
}
