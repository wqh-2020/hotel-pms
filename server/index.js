/**
 * 聚云酒店管理系统 — 后端入口
 * Node.js 22+ | Express | node:sqlite
 */
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const { DatabaseSync } = require('node:sqlite')

const PORT = process.env.PORT || 3001
const IS_PACKAGED = process.env.IS_PACKAGED === 'true'
const BASE_PATH = process.env.BASE_PATH || path.join(__dirname, '..')

// ─── 数据库路径 ──────────────────────────────────────────────
const dbDir = IS_PACKAGED
  ? path.join(process.env.APPDATA || '', 'hotel-pms-data')
  : path.join(__dirname)
fs.mkdirSync(dbDir, { recursive: true })
const DB_PATH = path.join(dbDir, 'hotel.db')

// ─── 初始化数据库 ────────────────────────────────────────────
const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode=WAL')
db.exec('PRAGMA foreign_keys=ON')

// ─── 建表 ─────────────────────────────────────────────────────
db.exec(`
-- ========== 公用 ==========
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  realname TEXT,
  role TEXT DEFAULT 'staff',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  user_id INTEGER,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name TEXT,
  category TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name TEXT,
  description TEXT,
  is_system INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER,
  permission_id INTEGER,
  PRIMARY KEY(role_id, permission_id)
);

-- ========== 住宿管理 ==========
CREATE TABLE IF NOT EXISTS room_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  base_price REAL DEFAULT 0,
  capacity INTEGER DEFAULT 2,
  area REAL,
  facilities TEXT,
  image TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS hotel_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no TEXT UNIQUE NOT NULL,
  room_type_id INTEGER,
  floor INTEGER DEFAULT 1,
  status TEXT DEFAULT 'vacant',
  price REAL DEFAULT 0,
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  id_no TEXT,
  phone TEXT,
  gender TEXT,
  nationality TEXT DEFAULT '中国',
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checkin_no TEXT UNIQUE NOT NULL,
  room_id INTEGER,
  guest_id INTEGER,
  guest_name TEXT,
  guest_phone TEXT,
  guest_id_no TEXT,
  guest_count INTEGER DEFAULT 1,
  checkin_date TEXT,
  expected_checkout TEXT,
  actual_checkout TEXT,
  price_per_night REAL,
  nights INTEGER DEFAULT 1,
  deposit REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'checked_in',
  pay_type TEXT,
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS checkin_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checkin_id INTEGER,
  charge_type TEXT,
  description TEXT,
  amount REAL,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_no TEXT UNIQUE NOT NULL,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_id_no TEXT,
  room_type_id INTEGER,
  room_id INTEGER,
  checkin_date TEXT,
  checkout_date TEXT,
  nights INTEGER DEFAULT 1,
  guest_count INTEGER DEFAULT 1,
  deposit REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- ========== 餐饮管理 ==========
CREATE TABLE IF NOT EXISTS food_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  name TEXT NOT NULL,
  price REAL DEFAULT 0,
  unit TEXT DEFAULT '份',
  description TEXT,
  image TEXT,
  is_available INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS dining_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  table_type TEXT DEFAULT 'hall',
  capacity INTEGER DEFAULT 4,
  sort_order INTEGER DEFAULT 0,
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS table_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER,
  status TEXT DEFAULT 'free',
  open_time TEXT,
  guest_count INTEGER DEFAULT 0,
  reservation_name TEXT,
  reservation_phone TEXT,
  reservation_time TEXT,
  order_id INTEGER,
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS session_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  dish_id INTEGER,
  dish_name TEXT,
  dish_price REAL,
  quantity INTEGER DEFAULT 1,
  subtotal REAL,
  add_time TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS food_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  order_type TEXT DEFAULT 'dine_in',
  table_no TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  total_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  pay_amount REAL DEFAULT 0,
  pay_type TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'paid',
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS food_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  dish_id INTEGER,
  dish_name TEXT,
  dish_price REAL,
  quantity INTEGER,
  subtotal REAL
);

-- ========== 商品零售 ==========
CREATE TABLE IF NOT EXISTS product_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  name TEXT NOT NULL,
  barcode TEXT,
  price REAL DEFAULT 0,
  cost_price REAL DEFAULT 0,
  unit TEXT DEFAULT '个',
  stock INTEGER DEFAULT 0,
  description TEXT,
  image TEXT,
  is_available INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS retail_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  checkin_id INTEGER,
  total_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  pay_amount REAL DEFAULT 0,
  pay_type TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'paid',
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS retail_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  product_id INTEGER,
  product_name TEXT,
  product_price REAL,
  quantity INTEGER,
  subtotal REAL
);
`)

// ─── 初始化权限系统（只在首次运行）───
const permCount = db.prepare('SELECT COUNT(*) as cnt FROM permissions').get()
if (permCount.cnt === 0) {
  // ===== 权限定义 =====
  const insPerm = db.prepare('INSERT INTO permissions(code,name,category,description,sort_order) VALUES(?,?,?,?,?)')
  const perms = [
    // 住宿管理
    ['room.view',        '查看房型',      'accommodation', '查看客房类型列表',              1],
    ['room.create',      '新增房型',      'accommodation', '创建新的客房类型',              2],
    ['room.edit',        '编辑房型',      'accommodation', '修改客房类型信息/价格',          3],
    ['room.delete',      '删除房型',      'accommodation', '删除客房类型',                  4],
    ['hotel_room.view',  '查看客房',      'accommodation', '查看客房列表和状态',              10],
    ['hotel_room.edit',  '编辑客房',      'accommodation', '修改客房信息/状态',              11],
    ['checkin.view',     '查看入住',      'accommodation', '查看入住记录列表',               20],
    ['checkin.create',   '新增入住',      'accommodation', '办理新入住登记',                 21],
    ['checkin.edit',     '编辑入住',      'accommodation', '修改入住信息',                   22],
    ['checkin.delete',   '删除入住',      'accommodation', '删除入住记录',                   23],
    ['checkin.checkout', '退房结账',      'accommodation', '执行退房并结账操作',             24],
    ['reservation.view', '查看预订',      'accommodation', '查看客房预订记录',               30],
    ['reservation.create','新增预订',     'accommodation', '创建新的客房预订',                31],
    ['reservation.edit', '编辑预订',      'accommodation', '修改预订信息',                   32],
    ['reservation.delete','删除预订',     'accommodation', '删除预订记录',                    33],
    ['reservation.cancel','取消预订',     'accommodation', '取消已确认的预订',                34],
    // 餐饮管理
    ['table.view',       '查看餐桌',      'dining',        '查看餐桌列表和状态',               50],
    ['table.create',     '新增餐桌',      'dining',        '添加新的餐桌/包间',                51],
    ['table.edit',       '编辑餐桌',      'dining',        '修改餐桌信息',                    52],
    ['table.delete',     '删除餐桌',      'dining',        '删除餐桌',                        53],
    ['dishes.view',      '查看菜品',      'dining',        '查看菜品列表',                    60],
    ['dishes.create',    '新增菜品',      'dining',        '添加新菜品',                      61],
    ['dishes.edit',      '编辑菜品',      'dining',        '修改菜品信息/价格',                62],
    ['dishes.delete',    '删除菜品',      'dining',        '删除菜品',                        63],
    ['food_order.view',  '查看餐饮订单',  'dining',        '查看餐饮订单记录',                 70],
    ['food_order.delete','删除餐饮订单',  'dining',        '删除餐饮订单',                     71],
    ['food_checkout',    '餐饮结账',      'dining',        '对餐饮消费进行结账',               72],
    // 零售管理
    ['product.view',     '查看商品',      'retail',         '查看商品列表',                    80],
    ['product.create',   '新增商品',      'retail',         '添加新商品',                      81],
    ['product.edit',     '编辑商品',      'retail',         '修改商品信息/价格',               82],
    ['product.delete',   '删除商品',      'retail',         '删除商品',                       83],
    ['retail_order.view','查看零售订单',  'retail',         '查看零售订单记录',                 90],
    ['retail_order.delete','删除零售订单','retail',         '删除零售订单',                    91],
    ['retail_checkout',  '零售结账',      'retail',         '对零售消费进行结账',              92],
    // 报表
    ['stats.view',       '查看报表',      'stats',          '查看营业统计报表',                 100],
    ['stats.export',     '导出报表',      'stats',          '导出/下载营业报表',               101],
    // 系统
    ['user.view',        '查看用户',     'system',         '查看用户列表',                    200],
    ['user.create',      '新增用户',     'system',         '创建新用户账号',                  201],
    ['user.edit',        '编辑用户',     'system',         '修改用户信息（角色/状态）',        202],
    ['user.reset_pwd',   '重置密码',     'system',         '为其他用户重置密码',              203],
    ['user.delete',      '删除用户',     'system',         '删除用户账号',                    204],
    ['role.manage',      '权限管理',     'system',         '管理角色和权限分配（仅管理员）',    210],
    ['settings.manage',   '系统设置',     'system',         '修改系统配置/Logo等',             211],
  ]
  for (const p of perms) insPerm.run(...p)

  // ===== 角色定义（幂等，避免重启报 duplicate key） =====
  const insRole = db.prepare('INSERT OR IGNORE INTO roles(code,name,description,is_system) VALUES(?,?,?,?)')
  const roles = [
    ['admin',         '系统管理员', '拥有全部权限，可管理所有模块',         1],
    ['regular_admin', '普通管理员', '与系统管理员相同，但不能编辑/删除订单', 0],
    ['front_desk',    '前台接待',   '负责入住/退房/预订等前台业务',        0],
    ['cashier',       '收银员',     '负责收银结算、管账务和报表',          0],
    ['waiter',        '服务员',     '负责客房服务/餐饮服务等基础工作',     0],
  ]
  for (const r of roles) insRole.run(...r)

  // ===== 角色权限分配（幂等，避免重启重复插入） =====
  const insRP = db.prepare('INSERT OR IGNORE INTO role_permissions(role_id,permission_id) VALUES(?,?)')
  const adminId     = db.prepare("SELECT id FROM roles WHERE code='admin'").get().id
  const regularId    = db.prepare("SELECT id FROM roles WHERE code='regular_admin'").get().id
  const fdId     = db.prepare("SELECT id FROM roles WHERE code='front_desk'").get().id
  const cashierId = db.prepare("SELECT id FROM roles WHERE code='cashier'").get().id
  const waiterId  = db.prepare("SELECT id FROM roles WHERE code='waiter'").get().id

  // 管理员：全部权限
  const allPerms = db.prepare('SELECT id FROM permissions').all()
  for (const p of allPerms) insRP.run(adminId, p.id)

  // 普通管理员：全部权限（除订单编辑/删除）
  const noOrderPerms = [
    'checkin.edit', 'checkin.delete',
    'reservation.edit', 'reservation.delete',
    'food_order.delete', 'retail_order.delete',
  ]
  for (const p of allPerms) {
    const code = db.prepare('SELECT code FROM permissions WHERE id=?').get(p.id)
    if (code && !noOrderPerms.includes(code.code)) insRP.run(regularId, p.id)
  }

  // 前台：住宿全部 + 餐桌查看 + 报表查看
  const fdCodes = [
    'room.view','room.create','room.edit','room.delete',
    'hotel_room.view','hotel_room.edit',
    'checkin.view','checkin.create','checkin.edit','checkin.delete','checkin.checkout',
    'reservation.view','reservation.create','reservation.edit','reservation.delete','reservation.cancel',
    'table.view',
    'stats.view',
  ]
  for (const code of fdCodes) {
    const p = db.prepare('SELECT id FROM permissions WHERE code=?').get(code)
    if (p) insRP.run(fdId, p.id)
  }

  // 收银员：住宿 + 餐饮 + 零售全部 + 报表 + 用户查看
  const cashierCodes = [
    'room.view','hotel_room.view',
    'checkin.view','checkin.create','checkin.edit','checkin.delete','checkin.checkout',
    'reservation.view','reservation.create','reservation.edit','reservation.delete','reservation.cancel',
    'table.view','table.create','table.edit',
    'dishes.view','dishes.create','dishes.edit','dishes.delete',
    'food_order.view','food_order.delete','food_checkout',
    'product.view','product.create','product.edit','product.delete',
    'retail_order.view','retail_order.delete','retail_checkout',
    'stats.view','stats.export',
    'user.view',
  ]
  for (const code of cashierCodes) {
    const p = db.prepare('SELECT id FROM permissions WHERE code=?').get(code)
    if (p) insRP.run(cashierId, p.id)
  }

  // 服务员：基础查看 + 餐桌操作
  const waiterCodes = [
    'room.view','hotel_room.view',
    'checkin.view',
    'reservation.view',
    'table.view','table.create',
    'dishes.view',
    'product.view',
    'food_order.view',
    'retail_order.view',
  ]
  for (const code of waiterCodes) {
    const p = db.prepare('SELECT id FROM permissions WHERE code=?').get(code)
    if (p) insRP.run(waiterId, p.id)
  }

  console.log('[系统] 权限系统和角色数据初始化完成')
}
const crypto = require('crypto')
const SALT = '_hotel_pms_salt'
const hashPwd = (p) => crypto.createHash('sha256').update(p + SALT).digest('hex')

function initData() {
  const adminExists = db.prepare('SELECT id FROM users WHERE username=?').get('admin')
  if (!adminExists) {
    db.prepare(`INSERT OR IGNORE INTO users(username,password_hash,realname,role) VALUES(?,?,?,?)`).run('admin', hashPwd('123456'), '系统管理员', 'admin')
    db.prepare(`INSERT OR IGNORE INTO users(username,password_hash,realname,role) VALUES(?,?,?,?)`).run('front_desk', hashPwd('123456'), '前台接待', 'front_desk')
    db.prepare(`INSERT OR IGNORE INTO users(username,password_hash,realname,role) VALUES(?,?,?,?)`).run('cashier1', hashPwd('123456'), '收银员', 'cashier')
    db.prepare(`INSERT OR IGNORE INTO users(username,password_hash,realname,role) VALUES(?,?,?,?)`).run('waiter1', hashPwd('123456'), '服务员', 'waiter')
  }
  // 默认设置
  const defaults = [
    ['hotel_name', '聚云大酒店'],
    ['logo_url', ''],
    ['theme', 'light'],
    ['theme_color', '#1890ff'],
    ['sidebar_width', '220'],
    ['address', ''],
    ['phone', ''],
  ]
  for (const [k, v] of defaults) {
    db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(k, v)
  }
  // 默认房型
  const hasRoomType = db.prepare('SELECT id FROM room_types LIMIT 1').get()
  if (!hasRoomType) {
    const roomTypes = [
      ['标准单间', '适合单人入住', 188, 1, 20],
      ['标准双床房', '两张单人床，适合朋友出行', 258, 2, 25],
      ['豪华大床房', '大床房，适合情侣/夫妻', 368, 2, 30],
      ['商务套房', '含客厅，商务设施完备', 588, 2, 45],
      ['总统套房', '顶级住宿体验', 1288, 4, 80],
    ]
    for (const [name, desc, price, cap, area] of roomTypes) {
      db.prepare('INSERT INTO room_types(name,description,base_price,capacity,area) VALUES(?,?,?,?,?)').run(name, desc, price, cap, area)
    }
    // 创建示例客房
    const floors = [1, 2, 3, 4, 5]
    let roomNo = 101
    for (const floor of floors) {
      for (let i = 1; i <= 8; i++) {
        const typeId = Math.ceil(i / 2)
        const no = `${floor}0${i}`
        const price = [188, 258, 368, 588, 1288][typeId - 1] || 258
        db.prepare('INSERT OR IGNORE INTO hotel_rooms(room_no,room_type_id,floor,status,price) VALUES(?,?,?,?,?)').run(no, typeId <= 5 ? typeId : 2, floor, 'vacant', price)
      }
    }
  }
  // 默认餐饮分类
  const hasFoodCat = db.prepare('SELECT id FROM food_categories LIMIT 1').get()
  if (!hasFoodCat) {
    ['热菜', '凉菜', '汤类', '主食', '饮品'].forEach((name, i) => {
      db.prepare('INSERT INTO food_categories(name,sort_order) VALUES(?,?)').run(name, i)
    })
    // 默认菜品
    const dishes = [
      ['糖醋排骨', 38, 1], ['红烧肉', 42, 1], ['宫保鸡丁', 28, 1], ['鱼香肉丝', 26, 1],
      ['凉拌黄瓜', 12, 2], ['凉拌木耳', 15, 2], ['拍黄瓜', 10, 2],
      ['西红柿蛋汤', 18, 3], ['紫菜蛋汤', 15, 3],
      ['白米饭', 3, 4], ['馒头', 2, 4],
      ['可乐', 5, 5], ['雪碧', 5, 5], ['橙汁', 8, 5], ['矿泉水', 3, 5]
    ]
    dishes.forEach(([name, price, catId]) => {
      db.prepare('INSERT INTO dishes(category_id,name,price,unit,is_available) VALUES(?,?,?,?,?)').run(catId, name, price, '份', 1)
    })
    // 餐桌
    for (let i = 1; i <= 8; i++) {
      db.prepare('INSERT INTO dining_tables(name,table_type,capacity,sort_order) VALUES(?,?,?,?)').run(`${i}号桌`, 'hall', 4, i)
      db.prepare('INSERT INTO table_sessions(table_id,status) VALUES(?,?)').run(i, 'free')
    }
    for (let i = 1; i <= 4; i++) {
      db.prepare('INSERT INTO dining_tables(name,table_type,capacity,sort_order) VALUES(?,?,?,?)').run(`${i}号包厢`, 'private', 10, i + 10)
      db.prepare('INSERT INTO table_sessions(table_id,status) VALUES(?,?)').run(8 + i, 'free')
    }
  }
  // 默认商品分类
  const hasProdCat = db.prepare('SELECT id FROM product_categories LIMIT 1').get()
  if (!hasProdCat) {
    ['日用百货', '零食饮料', '烟酒', '个人护理', '其他'].forEach((name, i) => {
      db.prepare('INSERT INTO product_categories(name,sort_order) VALUES(?,?)').run(name, i)
    })
  }
}
initData()

// ─── Express App ────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Auth 中间件
const authMiddleware = require('./middleware/auth')
app.use(authMiddleware(db))

// 静态资源
const uploadsPath = IS_PACKAGED ? path.join(BASE_PATH, 'server', 'uploads') : path.join(__dirname, 'uploads')
app.use('/uploads', express.static(uploadsPath))
const frontendDist = IS_PACKAGED ? path.join(BASE_PATH, 'frontend', 'dist') : path.join(__dirname, '../frontend/dist')
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
}

// 健康检查
app.get('/api/health', (req, res) => res.json({ code: 0, data: { status: 'ok', time: new Date().toISOString() } }))

// 将 db 挂载到 req
app.use((req, res, next) => { req.db = db; next() })

// ─── 全局细粒度权限检查 ──────────────────────────────────────
// 管理员直接放行，非写操作（GET）直接放行
app.use((req, res, next) => {
  if (!req.user) return next()
  if (req.user.role === 'admin') return next()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next()

  const url = req.originalUrl
  let requiredPerm = null
  // 住宿模块
  if (/\/api\/hotel-rooms/.test(url)) {
    if (req.method === 'POST') requiredPerm = 'room.create'
    else if (req.method === 'PUT') requiredPerm = 'room.edit'
    else if (req.method === 'DELETE') requiredPerm = 'room.delete'
  }
  else if (/\/api\/checkins/.test(url)) {
    if (req.method === 'POST') requiredPerm = 'checkin.create'
    else if (req.method === 'PUT') requiredPerm = url.includes('/checkout') ? 'checkin.checkout' : 'checkin.edit'
    else if (req.method === 'DELETE') requiredPerm = 'checkin.delete'
  }
  else if (/\/api\/reservations/.test(url)) {
    if (req.method === 'POST') requiredPerm = 'reservation.create'
    else if (req.method === 'PUT') {
      if (url.includes('/cancel')) requiredPerm = 'reservation.cancel'
      else requiredPerm = 'reservation.edit'
    }
    else if (req.method === 'DELETE') requiredPerm = 'reservation.delete'
  }
  // 餐饮模块
  else if (/\/api\/food\/categories/.test(url)) {
    if (req.method === 'POST') requiredPerm = 'dishes.create'  // 共用菜品权限
    else if (req.method === 'PUT') requiredPerm = 'dishes.edit'
    else if (req.method === 'DELETE') requiredPerm = 'dishes.delete'
  }
  else if (/\/api\/food\/tables/.test(url)) {
    if (req.method === 'POST') requiredPerm = 'table.create'
    else if (req.method === 'PUT') requiredPerm = 'table.edit'
    else if (req.method === 'DELETE') requiredPerm = 'table.delete'
  }
  else if (/\/api\/food\/dishes/.test(url)) {
    if (req.method === 'POST') requiredPerm = 'dishes.create'
    else if (req.method === 'PUT') requiredPerm = 'dishes.edit'
    else if (req.method === 'DELETE') requiredPerm = 'dishes.delete'
  }
  else if (/\/api\/food\/orders/.test(url) && req.method === 'DELETE') {
    requiredPerm = 'food_order.delete'
  }
  else if (/\/api\/food\/checkout/.test(url)) {
    requiredPerm = 'food_checkout'
  }
  // 零售模块
  else if (/\/api\/retail\/categories/.test(url)) {
    if (req.method === 'POST') requiredPerm = 'product.create'
    else if (req.method === 'PUT') requiredPerm = 'product.edit'
    else if (req.method === 'DELETE') requiredPerm = 'product.delete'
  }
  else if (/\/api\/retail\/products/.test(url)) {
    if (req.method === 'POST') requiredPerm = 'product.create'
    else if (req.method === 'PUT') requiredPerm = 'product.edit'
    else if (req.method === 'DELETE') requiredPerm = 'product.delete'
  }
  else if (/\/api\/retail\/orders/.test(url) && req.method === 'DELETE') {
    requiredPerm = 'retail_order.delete'
  }
  else if (/\/api\/retail\/checkout/.test(url)) {
    requiredPerm = 'retail_checkout'
  }
  // 报表
  else if (/\/api\/stats\/export/.test(url) || /\/api\/orders\/export/.test(url)) {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) requiredPerm = 'stats.export'
  }
  // 系统设置
  else if (/\/api\/settings/.test(url)) {
    if (req.method !== 'GET') requiredPerm = 'settings.manage'
  }
  // 用户管理（auth.js 内部已判断，这里做兜底）
  else if (/\/api\/auth\/users/.test(url)) {
    if (req.method === 'GET') requiredPerm = 'user.view'
    else if (req.method === 'POST') requiredPerm = 'user.create'
    else if (req.method === 'PUT') requiredPerm = 'user.edit'
    else if (req.method === 'DELETE') requiredPerm = 'user.delete'
  }
  else if (/\/api\/auth\/roles/.test(url)) {
    requiredPerm = 'role.manage'
  }

  if (!requiredPerm) return next()

  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM role_permissions rp
    JOIN roles r ON rp.role_id=r.id
    JOIN permissions p ON rp.permission_id=p.id
    WHERE r.code=? AND p.code=?
  `).get(req.user.role, requiredPerm)

  if (!row || row.cnt === 0) {
    return res.status(403).json({ code: 1, msg: `无权限：${requiredPerm}` })
  }
  next()
})

// ─── 路由注册 ────────────────────────────────────────────────
const authRouter = require('./routes/auth')
const hotelRoomsRouter = require('./routes/hotelRooms')
const checkinsRouter = require('./routes/checkins')
const reservationsRouter = require('./routes/reservations')
const foodRouter = require('./routes/food')
const retailRouter = require('./routes/retail')
const statsRouter = require('./routes/stats')
const settingsRouter = require('./routes/settings')
const ordersRouter = require('./routes/orders')

app.use('/api/auth', authRouter(db))
app.use('/api/hotel-rooms', hotelRoomsRouter(db))
app.use('/api/checkins', checkinsRouter(db))
app.use('/api/reservations', reservationsRouter(db))
app.use('/api/food', foodRouter(db))
app.use('/api/retail', retailRouter(db))
app.use('/api/stats', statsRouter(db))
app.use('/api/settings', settingsRouter(db, uploadsPath))
app.use('/api/orders', ordersRouter(db))

// SPA fallback
app.get('*', (req, res) => {
  const idx = path.join(frontendDist, 'index.html')
  if (fs.existsSync(idx)) res.sendFile(idx)
  else res.status(404).json({ code: 1, msg: 'Not found' })
})

// ─── 全局错误处理器 ──────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', req.method, req.originalUrl, err.message)
  res.status(500).json({ code: 1, msg: err.message || '服务器内部错误' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[hotel-pms] 后端启动成功: http://localhost:${PORT}`)
})
