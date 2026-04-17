const express = require('express')

function genNo() {
  return 'RO' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()
}

module.exports = function(db) {
  const router = express.Router()

  // ─── 商品分类 ─────────────────────────────────────────────
  router.get('/categories', (req, res) => {
    res.json({ code: 0, data: db.prepare('SELECT * FROM product_categories ORDER BY sort_order').all() })
  })
  router.post('/categories', (req, res) => {
    const { name, sort_order } = req.body
    db.prepare('INSERT INTO product_categories(name,sort_order) VALUES(?,?)').run(name, sort_order || 0)
    res.json({ code: 0, msg: '创建成功' })
  })
  router.put('/categories/:id', (req, res) => {
    const { name, sort_order } = req.body
    db.prepare('UPDATE product_categories SET name=?,sort_order=? WHERE id=?').run(name, sort_order, req.params.id)
    res.json({ code: 0, msg: '更新成功' })
  })
  router.delete('/categories/:id', (req, res) => {
    const has = db.prepare('SELECT id FROM products WHERE category_id=? LIMIT 1').get(req.params.id)
    if (has) return res.json({ code: 1, msg: '该分类有商品，无法删除' })
    db.prepare('DELETE FROM product_categories WHERE id=?').run(req.params.id)
    res.json({ code: 0, msg: '删除成功' })
  })

  // ─── 商品管理 ─────────────────────────────────────────────
  router.get('/products', (req, res) => {
    const { category_id, available, keyword } = req.query
    let sql = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN product_categories c ON p.category_id=c.id WHERE 1=1'
    const params = []
    if (category_id) { sql += ' AND p.category_id=?'; params.push(category_id) }
    if (available !== undefined) { sql += ' AND p.is_available=?'; params.push(available) }
    if (keyword) { sql += ' AND (p.name LIKE ? OR p.barcode LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`) }
    sql += ' ORDER BY p.sort_order, p.id'
    res.json({ code: 0, data: db.prepare(sql).all(...params) })
  })
  router.get('/products/:id', (req, res) => {
    const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id)
    res.json({ code: 0, data: p })
  })
  router.post('/products', (req, res) => {
    const { category_id, name, barcode, price, cost_price, unit, stock, description, image, is_available, sort_order } = req.body
    if (!name) return res.json({ code: 1, msg: '商品名称不能为空' })
    db.prepare('INSERT INTO products(category_id,name,barcode,price,cost_price,unit,stock,description,image,is_available,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(
      category_id, name, barcode, price || 0, cost_price || 0, unit || '个', stock || 0, description, image, is_available !== false ? 1 : 0, sort_order || 0
    )
    res.json({ code: 0, msg: '创建成功' })
  })
  router.put('/products/:id', (req, res) => {
    const { category_id, name, barcode, price, cost_price, unit, stock, description, image, is_available, sort_order } = req.body
    db.prepare('UPDATE products SET category_id=?,name=?,barcode=?,price=?,cost_price=?,unit=?,stock=?,description=?,image=?,is_available=?,sort_order=? WHERE id=?').run(
      category_id, name, barcode, price, cost_price, unit, stock, description, image, is_available ? 1 : 0, sort_order, req.params.id
    )
    res.json({ code: 0, msg: '更新成功' })
  })
  router.patch('/products/:id/toggle', (req, res) => {
    db.prepare('UPDATE products SET is_available=1-is_available WHERE id=?').run(req.params.id)
    res.json({ code: 0, msg: '状态切换成功' })
  })
  router.delete('/products/:id', (req, res) => {
    db.prepare('DELETE FROM products WHERE id=?').run(req.params.id)
    res.json({ code: 0, msg: '删除成功' })
  })

  // ─── 零售收银 ─────────────────────────────────────────────
  router.post('/orders', (req, res) => {
    const { items, customer_name, checkin_id, discount_amount = 0, pay_type, remark } = req.body
    if (!items || !items.length) return res.json({ code: 1, msg: '购物车不能为空' })
    if (!pay_type) return res.json({ code: 1, msg: '支付方式不能为空' })
    let total = 0
    for (const item of items) {
      const qty = Number(item.quantity) || 1
      if (qty <= 0) return res.json({ code: 1, msg: '商品数量必须大于0' })
      const pid = item.product_id || item.id
      if (pid) {
        const prod = db.prepare('SELECT id FROM products WHERE id=?').get(pid)
        if (!prod) return res.json({ code: 1, msg: `商品ID ${pid} 不存在` })
      }
      total += (item.price || 0) * qty
    }
    const payAmount = total - discount_amount
    const orderNo = genNo()
    db.prepare(`INSERT INTO retail_orders(order_no,customer_name,checkin_id,total_amount,discount_amount,pay_amount,pay_type,status,remark) VALUES(?,?,?,?,?,?,?,?,?)`).run(
      orderNo, customer_name || null, checkin_id || null, total, discount_amount, payAmount, pay_type, 'paid', remark || ''
    )
    const orderId = db.prepare('SELECT last_insert_rowid() as id').get().id
    for (const item of items) {
      const pid = item.product_id || item.id
      let pname = item.name
      let price = item.price || 0
      // 如果没有提供名称/价格，尝试从商品表查询
      if ((!pname || !price) && pid) {
        const prod = db.prepare('SELECT name, price FROM products WHERE id=?').get(pid)
        if (prod) {
          pname = pname || prod.name
          price = price || prod.price
        }
      }
      const qty = item.quantity || 1
      db.prepare('INSERT INTO retail_order_items(order_id,product_id,product_name,product_price,quantity,subtotal) VALUES(?,?,?,?,?,?)').run(orderId, pid || null, pname || '未知商品', price, qty, price * qty)
      // 扣库存
      if (pid) db.prepare('UPDATE products SET stock=MAX(0,stock-?) WHERE id=?').run(qty, pid)
    }
    res.json({ code: 0, msg: '结算成功', data: { order_no: orderNo, pay_amount: payAmount } })
  })

  // 订单列表
  router.get('/orders', (req, res) => {
    const { date, status, page = 1, pageSize = 20 } = req.query
    let sql = 'SELECT * FROM retail_orders WHERE 1=1'
    const params = []
    if (date) { sql += ' AND date(created_at)=?'; params.push(date) }
    if (status) { sql += ' AND status=?'; params.push(status) }
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?'
    params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize))
    res.json({ code: 0, data: db.prepare(sql).all(...params) })
  })

  // 订单详情
  router.get('/orders/:id', (req, res) => {
    const order = db.prepare('SELECT * FROM retail_orders WHERE id=?').get(req.params.id)
    const items = db.prepare('SELECT * FROM retail_order_items WHERE order_id=?').all(req.params.id)
    res.json({ code: 0, data: { ...order, items } })
  })

  // 退单
  router.patch('/orders/:id/refund', (req, res) => {
    const order = db.prepare('SELECT * FROM retail_orders WHERE id=?').get(req.params.id)
    if (!order) return res.json({ code: 1, msg: '订单不存在' })
    db.prepare("UPDATE retail_orders SET status='refunded' WHERE id=?").run(req.params.id)
    // 恢复库存
    const items = db.prepare('SELECT * FROM retail_order_items WHERE order_id=?').all(req.params.id)
    for (const item of items) {
      db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(item.quantity, item.product_id)
    }
    res.json({ code: 0, msg: '退单成功' })
  })

  return router
}
