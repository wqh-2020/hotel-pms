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

// ─── 初始化数据 ─────────────────────────────────────────────
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

// ─── 路由注册 ────────────────────────────────────────────────
const authRouter = require('./routes/auth')
const hotelRoomsRouter = require('./routes/hotelRooms')
const checkinsRouter = require('./routes/checkins')
const reservationsRouter = require('./routes/reservations')
const foodRouter = require('./routes/food')
const retailRouter = require('./routes/retail')
const statsRouter = require('./routes/stats')
const settingsRouter = require('./routes/settings')

app.use('/api/auth', authRouter(db))
app.use('/api/hotel-rooms', hotelRoomsRouter(db))
app.use('/api/checkins', checkinsRouter(db))
app.use('/api/reservations', reservationsRouter(db))
app.use('/api/food', foodRouter(db))
app.use('/api/retail', retailRouter(db))
app.use('/api/stats', statsRouter(db))
app.use('/api/settings', settingsRouter(db, uploadsPath))

// SPA fallback
app.get('*', (req, res) => {
  const idx = path.join(frontendDist, 'index.html')
  if (fs.existsSync(idx)) res.sendFile(idx)
  else res.status(404).json({ code: 1, msg: 'Not found' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[hotel-pms] 后端启动成功: http://localhost:${PORT}`)
})
