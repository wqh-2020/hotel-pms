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

  // ─── 权限辅助函数 ────────────────────────────────────────
  function hasPerm(userRole, permCode) {
    const row = db.prepare(`
      SELECT COUNT(*) as cnt FROM role_permissions rp
      JOIN roles r ON rp.role_id=r.id
      JOIN permissions p ON rp.permission_id=p.id
      WHERE r.code=? AND p.code=?
    `).get(userRole, permCode)
    return row && row.cnt > 0
  }

  // ─── 权限管理 API ────────────────────────────────────────

  // 获取所有权限定义列表
  router.get('/permissions', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    const rows = db.prepare('SELECT * FROM permissions ORDER BY category, sort_order').all()
    res.json({ code: 0, data: rows })
  })

  // 获取所有角色列表（含权限数量）
  router.get('/roles', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    const roles = db.prepare(`
      SELECT r.*,
        (SELECT COUNT(*) FROM role_permissions WHERE role_id=r.id) as perm_count
      FROM roles r ORDER BY r.code
    `).all()
    res.json({ code: 0, data: roles })
  })

  // 获取某个角色的权限代码列表
  router.get('/roles/:code/permissions', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    const role = db.prepare('SELECT id, name, code FROM roles WHERE code=?').get(req.params.code)
    if (!role) return res.json({ code: 1, msg: '角色不存在' })
    const perms = db.prepare(`
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id=rp.permission_id
      WHERE rp.role_id=?
      ORDER BY p.category, p.sort_order
    `).all(role.id)
    res.json({ code: 0, data: { role, permissions: perms.map(p => p.code) } })
  })

  // 更新角色的权限分配（仅管理员）
  router.put('/roles/:code/permissions', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    if (!hasPerm(req.user.role, 'role.manage')) return res.status(403).json({ code: 1, msg: '无权限管理角色' })
    const { permissions } = req.body
    if (!Array.isArray(permissions)) return res.json({ code: 1, msg: 'permissions 必须是数组' })
    const role = db.prepare('SELECT id FROM roles WHERE code=?').get(req.params.code)
    if (!role) return res.json({ code: 1, msg: '角色不存在' })
    db.prepare('DELETE FROM role_permissions WHERE role_id=?').run(role.id)
    const ins = db.prepare('INSERT INTO role_permissions(role_id,permission_id) VALUES(?,?)')
    for (const code of permissions) {
      const p = db.prepare('SELECT id FROM permissions WHERE code=?').get(code)
      if (p) ins.run(role.id, p.id)
    }
    res.json({ code: 0, msg: '权限已更新' })
  })

  // ─── 用户管理 API ────────────────────────────────────────

  // 用户列表
  router.get('/users', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    if (!hasPerm(req.user.role, 'user.view')) return res.status(403).json({ code: 1, msg: '无查看用户权限' })
    const list = db.prepare('SELECT id,username,realname,role,status,created_at FROM users ORDER BY id').all()
    res.json({ code: 0, data: list })
  })

  // 新增用户
  router.post('/users', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    if (!hasPerm(req.user.role, 'user.create')) return res.status(403).json({ code: 1, msg: '无新增用户权限' })
    const { username, password, realname, role } = req.body
    if (!username || !password) return res.json({ code: 1, msg: '账号密码不能为空' })
    const roleCheck = db.prepare('SELECT code FROM roles WHERE code=?').get(role)
    if (!roleCheck) return res.json({ code: 1, msg: '无效角色' })
    try {
      db.prepare('INSERT INTO users(username,password_hash,realname,role) VALUES(?,?,?,?)')
        .run(username, hashPwd(password), realname || username, role)
      res.json({ code: 0, msg: '创建成功' })
    } catch (e) {
      res.json({ code: 1, msg: '账号已存在' })
    }
  })

  // 更新用户
  router.put('/users/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    if (!hasPerm(req.user.role, 'user.edit')) return res.status(403).json({ code: 1, msg: '无编辑用户权限' })
    const { realname, role, status } = req.body
    if (role) {
      const roleCheck = db.prepare('SELECT code FROM roles WHERE code=?').get(role)
      if (!roleCheck) return res.json({ code: 1, msg: '无效角色' })
    }
    db.prepare('UPDATE users SET realname=?,role=?,status=? WHERE id=?')
      .run(realname, role || req.user.role, status || 'active', req.params.id)
    res.json({ code: 0, msg: '更新成功' })
  })

  // 重置密码
  router.put('/users/:id/password', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    if (!hasPerm(req.user.role, 'user.reset_pwd')) return res.status(403).json({ code: 1, msg: '无重置密码权限' })
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 4) return res.json({ code: 1, msg: '密码至少4位' })
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPwd(newPassword), req.params.id)
    res.json({ code: 0, msg: '密码已重置' })
  })

  // 删除用户
  router.delete('/users/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    if (!hasPerm(req.user.role, 'user.delete')) return res.status(403).json({ code: 1, msg: '无删除用户权限' })
    const u = db.prepare('SELECT role FROM users WHERE id=?').get(req.params.id)
    if (u && u.role === 'admin') return res.json({ code: 1, msg: '不能删除管理员' })
    db.prepare('DELETE FROM tokens WHERE user_id=?').run(req.params.id)
    db.prepare('DELETE FROM users WHERE id=?').run(req.params.id)
    res.json({ code: 0, msg: '删除成功' })
  })

  // 修改自己密码
  router.put('/my-password', (req, res) => {
    if (!req.user) return res.status(401).json({ code: 1, msg: '未登录' })
    const { oldPassword, newPassword } = req.body
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)
    if (user.password_hash !== hashPwd(oldPassword)) return res.json({ code: 1, msg: '原密码错误' })
    if (newPassword.length < 4) return res.json({ code: 1, msg: '新密码至少4位' })
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPwd(newPassword), req.user.id)
    db.prepare('DELETE FROM tokens WHERE user_id=?').run(req.user.id)
    res.json({ code: 0, msg: '密码已修改，请重新登录' })
  })

  return router
}
