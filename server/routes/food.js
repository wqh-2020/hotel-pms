const express = require('express')

function genNo() {
  return 'FO' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()
}

module.exports = function(db) {
  const router = express.Router()

  // ─── 菜品分类 ─────────────────────────────────────────────
  router.get('/categories', (req, res) => {
    res.json({ code: 0, data: db.prepare('SELECT * FROM food_categories ORDER BY sort_order').all() })
  })
  router.post('/categories', (req, res) => {
    const { name, sort_order } = req.body
    db.prepare('INSERT INTO food_categories(name,sort_order) VALUES(?,?)').run(name, sort_order || 0)
    res.json({ code: 0, msg: '创建成功' })
  })
  router.put('/categories/:id', (req, res) => {
    const { name, sort_order } = req.body
    db.prepare('UPDATE food_categories SET name=?,sort_order=? WHERE id=?').run(name, sort_order, req.params.id)
    res.json({ code: 0, msg: '更新成功' })
  })
  router.delete('/categories/:id', (req, res) => {
    const has = db.prepare('SELECT id FROM dishes WHERE category_id=? LIMIT 1').get(req.params.id)
    if (has) return res.json({ code: 1, msg: '该分类有菜品，无法删除' })
    db.prepare('DELETE FROM food_categories WHERE id=?').run(req.params.id)
    res.json({ code: 0, msg: '删除成功' })
  })

  // ─── 菜品管理 ─────────────────────────────────────────────
  router.get('/dishes', (req, res) => {
    const { category_id, available } = req.query
    let sql = 'SELECT d.*, c.name as category_name FROM dishes d LEFT JOIN food_categories c ON d.category_id=c.id WHERE 1=1'
    const params = []
    if (category_id) { sql += ' AND d.category_id=?'; params.push(category_id) }
    if (available !== undefined) { sql += ' AND d.is_available=?'; params.push(available) }
    sql += ' ORDER BY d.sort_order, d.id'
    res.json({ code: 0, data: db.prepare(sql).all(...params) })
  })
  router.get('/dishes/:id', (req, res) => {
    const d = db.prepare('SELECT * FROM dishes WHERE id=?').get(req.params.id)
    res.json({ code: 0, data: d })
  })
  router.post('/dishes', (req, res) => {
    const { category_id, name, price, unit, description, image, is_available, sort_order } = req.body
    db.prepare('INSERT INTO dishes(category_id,name,price,unit,description,image,is_available,sort_order) VALUES(?,?,?,?,?,?,?,?)').run(category_id, name, price || 0, unit || '份', description, image, is_available !== false ? 1 : 0, sort_order || 0)
    res.json({ code: 0, msg: '创建成功' })
  })
  router.put('/dishes/:id', (req, res) => {
    const { category_id, name, price, unit, description, image, is_available, sort_order } = req.body
    db.prepare('UPDATE dishes SET category_id=?,name=?,price=?,unit=?,description=?,image=?,is_available=?,sort_order=? WHERE id=?').run(category_id, name, price, unit, description, image, is_available ? 1 : 0, sort_order, req.params.id)
    res.json({ code: 0, msg: '更新成功' })
  })
  router.patch('/dishes/:id/toggle', (req, res) => {
    db.prepare('UPDATE dishes SET is_available=1-is_available WHERE id=?').run(req.params.id)
    res.json({ code: 0, msg: '状态切换成功' })
  })
  router.delete('/dishes/:id', (req, res) => {
    db.prepare('DELETE FROM dishes WHERE id=?').run(req.params.id)
    res.json({ code: 0, msg: '删除成功' })
  })

  // ─── 餐桌管理 ─────────────────────────────────────────────
  router.get('/tables', (req, res) => {
    const tables = db.prepare('SELECT t.*, s.id as session_id, s.status, s.open_time, s.guest_count, s.reservation_name FROM dining_tables t LEFT JOIN table_sessions s ON s.table_id=t.id ORDER BY t.sort_order').all()
    res.json({ code: 0, data: tables })
  })
  router.post('/tables', (req, res) => {
    const { name, table_type, capacity, sort_order, remark } = req.body
    const result = db.prepare('INSERT INTO dining_tables(name,table_type,capacity,sort_order,remark) VALUES(?,?,?,?,?)').run(name, table_type || 'hall', capacity || 4, sort_order || 0, remark || '')
    db.prepare('INSERT INTO table_sessions(table_id,status) VALUES(?,?)').run(result.lastInsertRowid, 'free')
    res.json({ code: 0, msg: '创建成功' })
  })
  router.put('/tables/:id', (req, res) => {
    const { name, table_type, capacity, sort_order, remark } = req.body
    db.prepare('UPDATE dining_tables SET name=?,table_type=?,capacity=?,sort_order=?,remark=? WHERE id=?').run(name, table_type, capacity, sort_order, remark, req.params.id)
    res.json({ code: 0, msg: '更新成功' })
  })
  router.delete('/tables/:id', (req, res) => {
    const s = db.prepare('SELECT status FROM table_sessions WHERE table_id=?').get(req.params.id)
    if (s && s.status !== 'free') return res.json({ code: 1, msg: '餐桌使用中，无法删除' })
    db.prepare('DELETE FROM dining_tables WHERE id=?').run(req.params.id)
    db.prepare('DELETE FROM table_sessions WHERE table_id=?').run(req.params.id)
    res.json({ code: 0, msg: '删除成功' })
  })

  // ─── 会话操作（通过 table_id 便捷路由）─────────────────────
  // 开台：POST /api/food/tables/:id/open
  router.post('/tables/:id/open', (req, res) => {
    const { guest_count, remark } = req.body
    const guestCountNum = Number(guest_count) || 1
    if (guestCountNum < 1) return res.json({ code: 1, msg: '人数必须大于0' })
    const session = db.prepare('SELECT * FROM table_sessions WHERE table_id=? AND status=?').get(req.params.id, 'free')
    if (!session) return res.json({ code: 1, msg: '餐桌非空闲状态或不存在' })
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    db.prepare("UPDATE table_sessions SET status='occupied',open_time=?,guest_count=?,remark=? WHERE id=?").run(now, guestCountNum, remark || '', session.id)
    res.json({ code: 0, msg: '开台成功', data: { session_id: session.id } })
  })

  // 点菜：POST /api/food/tables/:id/items
  router.post('/tables/:id/items', (req, res) => {
    const { dish_id, quantity = 1 } = req.body
    if (!dish_id) return res.json({ code: 1, msg: '菜品ID不能为空' })
    const qtyNum = Number(quantity)
    if (isNaN(qtyNum) || qtyNum <= 0) return res.json({ code: 1, msg: '数量必须大于0' })
    const session = db.prepare('SELECT * FROM table_sessions WHERE table_id=? AND status=?').get(req.params.id, 'occupied')
    if (!session) return res.json({ code: 1, msg: '餐桌未开台' })
    const dish = db.prepare('SELECT * FROM dishes WHERE id=?').get(dish_id)
    if (!dish) return res.json({ code: 1, msg: '菜品不存在' })
    const existing = db.prepare('SELECT * FROM session_items WHERE session_id=? AND dish_id=?').get(session.id, dish_id)
    if (existing) {
      const newQty = existing.quantity + qtyNum
      db.prepare('UPDATE session_items SET quantity=?,subtotal=? WHERE id=?').run(newQty, newQty * dish.price, existing.id)
    } else {
      db.prepare('INSERT INTO session_items(session_id,dish_id,dish_name,dish_price,quantity,subtotal) VALUES(?,?,?,?,?,?)').run(session.id, dish_id, dish.name, dish.price, qtyNum, qtyNum * dish.price)
    }
    res.json({ code: 0, msg: '已加菜' })
  })

  // 结账：POST /api/food/tables/:id/checkout
  router.post('/tables/:id/checkout', (req, res) => {
    const { pay_type } = req.body
    if (!pay_type) return res.json({ code: 1, msg: '支付方式不能为空' })
    const session = db.prepare('SELECT ts.*, dt.name as table_name FROM table_sessions ts LEFT JOIN dining_tables dt ON ts.table_id=dt.id WHERE ts.table_id=?').get(req.params.id)
    if (!session) return res.json({ code: 1, msg: '会话不存在' })
    if (session.status === 'free') return res.json({ code: 1, msg: '餐桌未开台' })
    const items = db.prepare('SELECT * FROM session_items WHERE session_id=?').all(session.id)
    if (!items.length) return res.json({ code: 1, msg: '没有点菜记录' })
    const { discount_amount = 0 } = req.body
    const total = items.reduce((s, i) => s + i.subtotal, 0)
    const payAmount = total - discount_amount
    const orderNo = genNo()
    db.prepare(`INSERT INTO food_orders(order_no,order_type,table_no,customer_name,total_amount,discount_amount,pay_amount,pay_type,status)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(orderNo, 'dine_in', session.table_name, '', total, discount_amount, payAmount, pay_type, 'paid')
    const orderId = db.prepare('SELECT last_insert_rowid() as id').get().id
    for (const item of items) {
      db.prepare('INSERT INTO food_order_items(order_id,dish_id,dish_name,dish_price,quantity,subtotal) VALUES(?,?,?,?,?,?)').run(orderId, item.dish_id, item.dish_name, item.dish_price, item.quantity, item.subtotal)
    }
    db.prepare('DELETE FROM session_items WHERE session_id=?').run(session.id)
    db.prepare("UPDATE table_sessions SET status='free',open_time=NULL,guest_count=0,order_id=? WHERE id=?").run(orderId, session.id)
    res.json({ code: 0, msg: '结账成功', data: { order_no: orderNo, pay_amount: payAmount } })
  })

  // ─── 会话操作 ─────────────────────────────────────────────
  // 通过 session_id 操作（主要）
  router.post('/sessions/:id/open', (req, res) => {
    const { guest_count, remark } = req.body
    const session = db.prepare('SELECT * FROM table_sessions WHERE id=?').get(req.params.id)
    if (!session) return res.json({ code: 1, msg: '会话不存在' })
    if (session.status !== 'free') return res.json({ code: 1, msg: '餐桌非空闲状态' })
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    db.prepare("UPDATE table_sessions SET status='occupied',open_time=?,guest_count=?,remark=? WHERE id=?").run(now, guest_count || 0, remark || '', req.params.id)
    res.json({ code: 0, msg: '开台成功' })
  })
  router.post('/sessions/:id/reserve', (req, res) => {
    const { reservation_name, reservation_phone, reservation_time } = req.body
    db.prepare("UPDATE table_sessions SET status='reserved',reservation_name=?,reservation_phone=?,reservation_time=? WHERE id=?").run(reservation_name, reservation_phone, reservation_time, req.params.id)
    res.json({ code: 0, msg: '预定成功' })
  })
  router.post('/sessions/:id/cancel-reserve', (req, res) => {
    db.prepare("UPDATE table_sessions SET status='free',reservation_name=NULL,reservation_phone=NULL,reservation_time=NULL WHERE id=?").run(req.params.id)
    res.json({ code: 0, msg: '取消预定成功' })
  })
  router.post('/sessions/:id/checkin', (req, res) => {
    const { guest_count } = req.body
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    db.prepare("UPDATE table_sessions SET status='occupied',open_time=?,guest_count=? WHERE id=?").run(now, guest_count || 1, req.params.id)
    res.json({ code: 0, msg: '入座成功' })
  })
  router.post('/sessions/:id/release', (req, res) => {
    db.prepare('DELETE FROM session_items WHERE session_id=?').run(req.params.id)
    db.prepare("UPDATE table_sessions SET status='free',open_time=NULL,guest_count=0,reservation_name=NULL,reservation_phone=NULL,reservation_time=NULL,order_id=NULL WHERE id=?").run(req.params.id)
    res.json({ code: 0, msg: '释放成功' })
  })

  // ─── 点菜 ─────────────────────────────────────────────────
  router.get('/sessions/:id/items', (req, res) => {
    const items = db.prepare('SELECT * FROM session_items WHERE session_id=? ORDER BY id').all(req.params.id)
    res.json({ code: 0, data: items })
  })
  router.post('/sessions/:id/items', (req, res) => {
    const { dish_id, quantity = 1 } = req.body
    const dish = db.prepare('SELECT * FROM dishes WHERE id=?').get(dish_id)
    if (!dish) return res.json({ code: 1, msg: '菜品不存在' })
    const existing = db.prepare('SELECT * FROM session_items WHERE session_id=? AND dish_id=?').get(req.params.id, dish_id)
    if (existing) {
      const newQty = existing.quantity + quantity
      db.prepare('UPDATE session_items SET quantity=?,subtotal=? WHERE id=?').run(newQty, newQty * dish.price, existing.id)
    } else {
      db.prepare('INSERT INTO session_items(session_id,dish_id,dish_name,dish_price,quantity,subtotal) VALUES(?,?,?,?,?,?)').run(req.params.id, dish_id, dish.name, dish.price, quantity, quantity * dish.price)
    }
    res.json({ code: 0, msg: '已加菜' })
  })
  router.patch('/sessions/:id/items/:itemId', (req, res) => {
    const { quantity } = req.body
    if (quantity <= 0) {
      db.prepare('DELETE FROM session_items WHERE id=?').run(req.params.itemId)
    } else {
      const item = db.prepare('SELECT * FROM session_items WHERE id=?').get(req.params.itemId)
      if (item) db.prepare('UPDATE session_items SET quantity=?,subtotal=? WHERE id=?').run(quantity, quantity * item.dish_price, req.params.itemId)
    }
    res.json({ code: 0, msg: '更新成功' })
  })
  router.delete('/sessions/:id/items/:itemId', (req, res) => {
    db.prepare('DELETE FROM session_items WHERE id=? AND session_id=?').run(req.params.itemId, req.params.id)
    res.json({ code: 0, msg: '删除成功' })
  })

  // ─── 结账 ─────────────────────────────────────────────────
  router.post('/sessions/:id/checkout', (req, res) => {
    const session = db.prepare('SELECT ts.*, dt.name as table_name FROM table_sessions ts LEFT JOIN dining_tables dt ON ts.table_id=dt.id WHERE ts.id=?').get(req.params.id)
    if (!session) return res.json({ code: 1, msg: '会话不存在' })
    const items = db.prepare('SELECT * FROM session_items WHERE session_id=?').all(req.params.id)
    if (!items.length) return res.json({ code: 1, msg: '没有点菜记录' })
    const { discount_amount = 0, pay_type = 'cash' } = req.body
    const total = items.reduce((s, i) => s + i.subtotal, 0)
    const payAmount = total - discount_amount
    const orderNo = genNo()
    db.prepare(`INSERT INTO food_orders(order_no,order_type,table_no,customer_name,total_amount,discount_amount,pay_amount,pay_type,status)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(orderNo, 'dine_in', session.table_name, '', total, discount_amount, payAmount, pay_type, 'paid')
    const orderId = db.prepare('SELECT last_insert_rowid() as id').get().id
    for (const item of items) {
      db.prepare('INSERT INTO food_order_items(order_id,dish_id,dish_name,dish_price,quantity,subtotal) VALUES(?,?,?,?,?,?)').run(orderId, item.dish_id, item.dish_name, item.dish_price, item.quantity, item.subtotal)
    }
    db.prepare('DELETE FROM session_items WHERE session_id=?').run(req.params.id)
    db.prepare("UPDATE table_sessions SET status='free',open_time=NULL,guest_count=0,order_id=? WHERE id=?").run(orderId, req.params.id)
    res.json({ code: 0, msg: '结账成功', data: { order_no: orderNo, pay_amount: payAmount } })
  })

  // ─── 订单管理 ─────────────────────────────────────────────
  router.get('/orders', (req, res) => {
    const { date, status, page = 1, pageSize = 20 } = req.query
    let sql = 'SELECT * FROM food_orders WHERE 1=1'
    const params = []
    if (date) { sql += ' AND date(created_at)=?'; params.push(date) }
    if (status) { sql += ' AND status=?'; params.push(status) }
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?'
    params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize))
    res.json({ code: 0, data: db.prepare(sql).all(...params) })
  })
  router.get('/orders/:id', (req, res) => {
    const order = db.prepare('SELECT * FROM food_orders WHERE id=?').get(req.params.id)
    const items = db.prepare('SELECT * FROM food_order_items WHERE order_id=?').all(req.params.id)
    res.json({ code: 0, data: { ...order, items } })
  })

  return router
}
