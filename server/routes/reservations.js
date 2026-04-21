const express = require('express')

function genNo(prefix) {
  return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()
}

module.exports = function(db) {
  const router = express.Router()

  // 预订列表
  router.get('/', (req, res) => {
    const { status, date, page = 1, pageSize = 20 } = req.query
    let sql = `SELECT r.*, t.name as room_type_name, h.room_no
      FROM reservations r
      LEFT JOIN room_types t ON r.room_type_id=t.id
      LEFT JOIN hotel_rooms h ON r.room_id=h.id WHERE 1=1`
    const params = []
    if (status) { sql += ' AND r.status=?'; params.push(status) }
    if (date) { sql += ' AND date(r.checkin_date)=?'; params.push(date) }
    sql += ' ORDER BY r.id DESC LIMIT ? OFFSET ?'
    params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize))
    res.json({ code: 0, data: db.prepare(sql).all(...params) })
  })

  // 新增预订
  router.post('/', (req, res) => {
    const { guest_name, guest_phone, guest_id_no, room_type_id, room_id,
      checkin_date, checkout_date, nights, guest_count, deposit, remark } = req.body
    if (!guest_name || !checkin_date) return res.json({ code: 1, msg: '姓名和入住日期必填' })
    const nightsNum = Number(nights) || 1
    if (nightsNum <= 0) return res.json({ code: 1, msg: '入住天数必须大于0' })
    if (deposit < 0) return res.json({ code: 1, msg: '押金不能为负数' })
    if (checkout_date && new Date(checkout_date) < new Date(checkin_date)) return res.json({ code: 1, msg: '退房日期不能早于入住日期' })
    const no = genNo('RV')
    db.prepare(`INSERT INTO reservations(reservation_no,guest_name,guest_phone,guest_id_no,room_type_id,room_id,
      checkin_date,checkout_date,nights,guest_count,deposit,status,remark) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      no, guest_name, guest_phone || null, guest_id_no || null, room_type_id || null, room_id || null,
      checkin_date, checkout_date || null, nightsNum, guest_count || 1, deposit || 0, 'pending', remark || ''
    )
    if (room_id) db.prepare("UPDATE hotel_rooms SET status='reserved' WHERE id=?").run(room_id)
    res.json({ code: 0, msg: '预订成功', data: { reservation_no: no } })
  })

  // 确认预订（转入住）
  router.post('/:id/confirm', (req, res) => {
    const rv = db.prepare('SELECT * FROM reservations WHERE id=?').get(req.params.id)
    if (!rv) return res.json({ code: 1, msg: '预订不存在' })
    db.prepare("UPDATE reservations SET status='confirmed' WHERE id=?").run(req.params.id)
    res.json({ code: 0, msg: '预订已确认' })
  })

  // 取消预订
  router.post('/:id/cancel', (req, res) => {
    const rv = db.prepare('SELECT * FROM reservations WHERE id=?').get(req.params.id)
    if (!rv) return res.json({ code: 1, msg: '预订不存在' })
    db.prepare("UPDATE reservations SET status='cancelled' WHERE id=?").run(req.params.id)
    if (rv.room_id) db.prepare("UPDATE hotel_rooms SET status='vacant' WHERE id=?").run(rv.room_id)
    res.json({ code: 0, msg: '预订已取消' })
  })

  // 更新预订
  router.put('/:id', (req, res) => {
    const { guest_name, guest_phone, room_type_id, checkin_date, checkout_date, nights, guest_count, remark } = req.body
    db.prepare('UPDATE reservations SET guest_name=?,guest_phone=?,room_type_id=?,checkin_date=?,checkout_date=?,nights=?,guest_count=?,remark=? WHERE id=?').run(
      guest_name, guest_phone || null, room_type_id || null, checkin_date, checkout_date || null, nights, guest_count, remark || '', req.params.id
    )
    res.json({ code: 0, msg: '更新成功' })
  })

  return router
}
