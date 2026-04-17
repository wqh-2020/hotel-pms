const express = require('express')

module.exports = function(db) {
  const router = express.Router()

  // 获取所有客房（含房型信息）
  router.get('/', (req, res) => {
    const { status, floor, type_id } = req.query
    let sql = `SELECT r.*, t.name as type_name, t.base_price, t.capacity as type_capacity, t.facilities
      FROM hotel_rooms r LEFT JOIN room_types t ON r.room_type_id=t.id WHERE 1=1`
    const params = []
    if (status) { sql += ' AND r.status=?'; params.push(status) }
    if (floor) { sql += ' AND r.floor=?'; params.push(floor) }
    if (type_id) { sql += ' AND r.room_type_id=?'; params.push(type_id) }
    sql += ' ORDER BY r.room_no'
    res.json({ code: 0, data: db.prepare(sql).all(...params) })
  })

  // 新增客房
  router.post('/', (req, res) => {
    const { room_no, room_type_id, floor, price, remark } = req.body
    if (!room_no) return res.json({ code: 1, msg: '房间号不能为空' })
    try {
      db.prepare('INSERT INTO hotel_rooms(room_no,room_type_id,floor,price,remark) VALUES(?,?,?,?,?)').run(room_no, room_type_id, floor || 1, price || 0, remark || '')
      res.json({ code: 0, msg: '创建成功' })
    } catch (e) {
      res.json({ code: 1, msg: '房间号已存在' })
    }
  })

  // 更新客房
  router.put('/:id', (req, res) => {
    const { room_no, room_type_id, floor, price, remark } = req.body
    db.prepare('UPDATE hotel_rooms SET room_no=?,room_type_id=?,floor=?,price=?,remark=? WHERE id=?').run(room_no, room_type_id, floor, price, remark, req.params.id)
    res.json({ code: 0, msg: '更新成功' })
  })

  // 删除客房
  router.delete('/:id', (req, res) => {
    const room = db.prepare('SELECT status FROM hotel_rooms WHERE id=?').get(req.params.id)
    if (room && room.status !== 'vacant') return res.json({ code: 1, msg: '房间使用中，无法删除' })
    db.prepare('DELETE FROM hotel_rooms WHERE id=?').run(req.params.id)
    res.json({ code: 0, msg: '删除成功' })
  })

  // 房型列表
  router.get('/types', (req, res) => {
    res.json({ code: 0, data: db.prepare('SELECT * FROM room_types ORDER BY sort_order').all() })
  })

  // 新增房型
  router.post('/types', (req, res) => {
    const { name, description, base_price, capacity, area, facilities } = req.body
    db.prepare('INSERT INTO room_types(name,description,base_price,capacity,area,facilities) VALUES(?,?,?,?,?,?)').run(name, description, base_price || 0, capacity || 2, area || 0, facilities || '')
    res.json({ code: 0, msg: '创建成功' })
  })

  // 更新房型
  router.put('/types/:id', (req, res) => {
    const { name, description, base_price, capacity, area, facilities } = req.body
    db.prepare('UPDATE room_types SET name=?,description=?,base_price=?,capacity=?,area=?,facilities=? WHERE id=?').run(name, description, base_price, capacity, area, facilities, req.params.id)
    res.json({ code: 0, msg: '更新成功' })
  })

  // 删除房型
  router.delete('/types/:id', (req, res) => {
    const used = db.prepare('SELECT id FROM hotel_rooms WHERE room_type_id=? LIMIT 1').get(req.params.id)
    if (used) return res.json({ code: 1, msg: '该房型有客房，无法删除' })
    db.prepare('DELETE FROM room_types WHERE id=?').run(req.params.id)
    res.json({ code: 0, msg: '删除成功' })
  })

  return router
}
