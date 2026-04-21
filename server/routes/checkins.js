const express = require('express')

function genNo(prefix) {
  return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()
}

module.exports = function(db) {
  const router = express.Router()

  // 入住单列表
router.get('/', (req, res) => {
    const { status, date, room_id, page = 1, pageSize = 20 } = req.query
    let sql = `SELECT c.*, r.room_no, t.name as room_type_name
      FROM checkins c LEFT JOIN hotel_rooms r ON c.room_id=r.id
      LEFT JOIN room_types t ON r.room_type_id=t.id WHERE 1=1`
    const params = []
    if (status) { sql += ' AND c.status=?'; params.push(status) }
    if (room_id) { sql += ' AND c.room_id=?'; params.push(room_id) }
    if (date) { sql += ' AND date(c.checkin_date)=?'; params.push(date) }
    const pageNum = Math.max(1, Number(page) || 1)
    const pageSizeNum = Math.max(1, Number(pageSize) || 20)
    const total = db.prepare(sql.replace('SELECT c.*,', 'SELECT count(*) as cnt,').split('ORDER BY')[0]).get(...params)
    sql += ' ORDER BY c.id DESC LIMIT ? OFFSET ?'
    params.push(pageSizeNum, (pageNum - 1) * pageSizeNum)
    res.json({ code: 0, data: { list: db.prepare(sql).all(...params), total: total ? total.cnt : 0 } })
  })

  // 入住详情
  router.get('/:id', (req, res) => {
    const checkin = db.prepare(`SELECT c.*, r.room_no, t.name as room_type_name
      FROM checkins c LEFT JOIN hotel_rooms r ON c.room_id=r.id
      LEFT JOIN room_types t ON r.room_type_id=t.id
      WHERE c.id=?`).get(req.params.id)
    if (!checkin) return res.json({ code: 1, msg: '记录不存在' })
    const charges = db.prepare('SELECT * FROM checkin_charges WHERE checkin_id=? ORDER BY id').all(req.params.id)
    res.json({ code: 0, data: { ...checkin, charges } })
  })

  // 办理入住
  router.post('/', (req, res) => {
    const { room_id, guest_name, guest_phone, guest_id_no, guest_count = 1,
      checkin_date, expected_checkout, price_per_night, nights = 1,
      deposit = 0, paid_amount = 0, pay_type, remark } = req.body
    if (!room_id || !guest_name) return res.json({ code: 1, msg: '房间和姓名必填' })
    const roomIdNum = Number(room_id)
    const nightsNum = Number(nights)
    if (isNaN(roomIdNum) || roomIdNum <= 0) return res.json({ code: 1, msg: '房间ID无效' })
    if (isNaN(nightsNum) || nightsNum <= 0) return res.json({ code: 1, msg: '入住天数必须大于0' })
    if (deposit < 0 || paid_amount < 0) return res.json({ code: 1, msg: '金额不能为负数' })
    const room = db.prepare('SELECT * FROM hotel_rooms WHERE id=?').get(roomIdNum)
    if (!room) return res.json({ code: 1, msg: '房间不存在' })
    if (room.status === 'occupied') return res.json({ code: 1, msg: '房间已入住' })
    const checkinNo = genNo('CI')
    const totalAmount = (price_per_night || room.price) * nightsNum
    db.prepare(`INSERT INTO checkins(checkin_no,room_id,guest_name,guest_phone,guest_id_no,guest_count,
      checkin_date,expected_checkout,price_per_night,nights,deposit,total_amount,paid_amount,status,pay_type,remark)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      checkinNo, roomIdNum, guest_name, guest_phone || null, guest_id_no || null, Number(guest_count),
      checkin_date, expected_checkout || null, Number(price_per_night || room.price), nightsNum,
      Number(deposit), Number(totalAmount), Number(paid_amount), 'checked_in', pay_type || null, remark || ''
    )
    db.prepare("UPDATE hotel_rooms SET status='occupied' WHERE id=?").run(roomIdNum)
    res.json({ code: 0, msg: '入住成功', data: { checkin_no: checkinNo } })
  })

  // 办理退房
  router.post('/:id/checkout', (req, res) => {
    const { pay_amount, pay_type, remark } = req.body
    if (pay_amount !== undefined && pay_amount < 0) return res.json({ code: 1, msg: '金额不能为负数' })
    const checkin = db.prepare('SELECT * FROM checkins WHERE id=?').get(req.params.id)
    if (!checkin) return res.json({ code: 1, msg: '记录不存在' })
    if (checkin.status !== 'checked_in') return res.json({ code: 1, msg: '非在住状态' })
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    // 计算额外费用
    const charges = db.prepare('SELECT SUM(amount) as total FROM checkin_charges WHERE checkin_id=?').get(req.params.id)
    const extraTotal = charges?.total || 0
    const finalAmount = checkin.total_amount + extraTotal
    db.prepare(`UPDATE checkins SET status='checked_out',actual_checkout=?,total_amount=?,paid_amount=?,pay_type=?,remark=? WHERE id=?`).run(
      now, finalAmount, pay_amount || finalAmount, pay_type || checkin.pay_type, remark || checkin.remark, req.params.id
    )
    db.prepare("UPDATE hotel_rooms SET status='vacant' WHERE id=?").run(checkin.room_id)
    res.json({ code: 0, msg: '退房成功' })
  })

  // 追加费用
  router.post('/:id/charges', (req, res) => {
    const { charge_type, description, amount } = req.body
    const amountNum = Number(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) return res.json({ code: 1, msg: '金额必须大于0' })
    const checkin = db.prepare('SELECT * FROM checkins WHERE id=?').get(req.params.id)
    if (!checkin) return res.json({ code: 1, msg: '记录不存在' })
    if (checkin.status !== 'checked_in') return res.json({ code: 1, msg: '非在住状态' })
    db.prepare('INSERT INTO checkin_charges(checkin_id,charge_type,description,amount) VALUES(?,?,?,?)').run(req.params.id, charge_type || 'extra', description || '', amountNum)
    res.json({ code: 0, msg: '已添加费用' })
  })

  // 删除费用
  router.delete('/:id/charges/:cid', (req, res) => {
    db.prepare('DELETE FROM checkin_charges WHERE id=? AND checkin_id=?').run(req.params.cid, req.params.id)
    res.json({ code: 0, msg: '已删除' })
  })

  // 取消入住（未退房前强制）
  router.post('/:id/cancel', (req, res) => {
    const checkin = db.prepare('SELECT * FROM checkins WHERE id=?').get(req.params.id)
    if (!checkin) return res.json({ code: 1, msg: '记录不存在' })
    if (checkin.status === 'cancelled') return res.json({ code: 1, msg: '已取消' })
    if (checkin.status === 'checked_out') return res.json({ code: 1, msg: '已退房无法取消' })
    db.prepare("UPDATE checkins SET status='cancelled' WHERE id=?").run(req.params.id)
    db.prepare("UPDATE hotel_rooms SET status='vacant' WHERE id=?").run(checkin.room_id)
    res.json({ code: 0, msg: '已取消' })
  })

  return router
}
