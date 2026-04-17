/**
 * 认证中间件
 */
const crypto = require('crypto')
const SALT = '_hotel_pms_salt'
const hashPwd = (p) => crypto.createHash('sha256').update(p + SALT).digest('hex')

function createAuthMiddleware(db) {
  return function authMiddleware(req, res, next) {
    // 跳过公开路径
    const pub = [
      { method: 'POST', path: '/api/auth/login' },
      { method: 'GET',  path: '/api/health' },
      { method: 'GET',  path: '/api/settings' },
    ]
    if (pub.some(p => req.method === p.method && req.path === p.path)) return next()
    if (req.method === 'GET' && req.path.startsWith('/uploads')) return next()

    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return res.status(401).json({ code: 1, msg: '未登录' })

    const row = db.prepare(`SELECT t.*, u.id as uid, u.role, u.status, u.realname, u.username
      FROM tokens t JOIN users u ON t.user_id=u.id
      WHERE t.token=? AND t.expires_at > datetime('now','localtime')`).get(token)
    if (!row) return res.status(401).json({ code: 1, msg: 'Token 无效或已过期' })
    if (row.status === 'disabled') return res.status(403).json({ code: 1, msg: '账号已被禁用' })

    req.user = { id: row.uid, username: row.username, realname: row.realname, role: row.role }
    next()
  }
}

module.exports = createAuthMiddleware
