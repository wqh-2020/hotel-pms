/**
 * 订单管理路由 —— 导出(xlsx)、导入模板(csv)、批量删除（仅管理员）
 */
const express = require('express')
const ExcelJS = require('exceljs')

module.exports = function (db) {
  const router = express.Router()

  // ─── 权限中间件 ───────────────────────────────────────────
  function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') return res.json({ code: 403, msg: '无权限，仅管理员可操作' })
    next()
  }

  // 导出 CSV 工具（带 UTF-8 BOM，解决 Excel 打开中文乱码）
  function writeCSV(res, headers, rows) {
    const BOM = '\uFEFF'
    const escape = (v) => {
      const s = String(v == null ? '' : v)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
      return s
    }
    const lines = [headers.map(escape).join(',')]
    for (const row of rows) lines.push(row.map(escape).join(','))
    res.setHeader('Content-Type', 'text/csv;charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\'import_template.csv')
    res.end(BOM + lines.join('\r\n'))
  }

  // ─── 统一查询（合并三表）─────────────────────────────────
  function queryOrders({ type, dateStart, dateEnd, search, status }) {
    const rows = []

    // 住宿
    if (!type || type === 'hotel') {
      let sql = `SELECT c.id, c.checkin_no as order_no, 'hotel' as type,
        r.room_no, c.guest_name, c.paid_amount as pay_amount, c.pay_type,
        c.status, c.checkin_date as order_date, c.created_at, c.remark
        FROM checkins c LEFT JOIN hotel_rooms r ON c.room_id = r.id WHERE 1=1`
      const p = []
      if (dateStart) { sql += ' AND date(c.checkin_date) >= ?'; p.push(dateStart) }
      if (dateEnd)   { sql += ' AND date(c.checkin_date) <= ?'; p.push(dateEnd) }
      if (status)    { sql += ' AND c.status = ?'; p.push(status) }
      if (search)    { sql += ' AND (c.checkin_no LIKE ? OR c.guest_name LIKE ?)'; p.push(`%${search}%`, `%${search}%`) }
      rows.push(...db.prepare(sql).all(...p).map(r => ({ ...r, type: 'hotel' })))
    }

    // 餐饮
    if (!type || type === 'food') {
      let sql = `SELECT id, order_no, 'food' as type, table_no as room_no,
        '' as guest_name, pay_amount, pay_type, status,
        date(created_at) as order_date, created_at, remark
        FROM food_orders WHERE 1=1`
      const p = []
      if (dateStart) { sql += ' AND date(created_at) >= ?'; p.push(dateStart) }
      if (dateEnd)   { sql += ' AND date(created_at) <= ?'; p.push(dateEnd) }
      if (status)    { sql += ' AND status = ?'; p.push(status) }
      if (search)    { sql += ' AND order_no LIKE ?'; p.push(`%${search}%`) }
      rows.push(...db.prepare(sql).all(...p).map(r => ({ ...r, type: 'food' })))
    }

    // 零售
    if (!type || type === 'retail') {
      let sql = `SELECT id, order_no, 'retail' as type, '' as room_no,
        '' as guest_name, pay_amount, pay_type, status,
        date(created_at) as order_date, created_at, remark
        FROM retail_orders WHERE 1=1`
      const p = []
      if (dateStart) { sql += ' AND date(created_at) >= ?'; p.push(dateStart) }
      if (dateEnd)   { sql += ' AND date(created_at) <= ?'; p.push(dateEnd) }
      if (status)    { sql += ' AND status = ?'; p.push(status) }
      if (search)    { sql += ' AND order_no LIKE ?'; p.push(`%${search}%`) }
      rows.push(...db.prepare(sql).all(...p).map(r => ({ ...r, type: 'retail' })))
    }

    rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    return rows
  }

  // ─── 列表查询（带分页）────────────────────────────────────
  router.get('/list', (req, res) => {
    try {
      const { page = 1, pageSize = 20 } = req.query
      const pageNum = Math.max(1, Number(page) || 1)
      const pageSizeNum = Math.min(200, Math.max(1, Number(pageSize) || 20))
      const allRows = queryOrders(req.query)
      const total = allRows.length
      const list = allRows.slice((pageNum - 1) * pageSizeNum, pageNum * pageSizeNum)
      res.json({ code: 0, data: { list, total, page: pageNum, pageSize: pageSizeNum } })
    } catch (e) {
      console.error('orders list error', e)
      res.json({ code: 1, msg: '查询失败: ' + e.message })
    }
  })

  // ─── 导出 Excel (.xlsx) ───────────────────────────────────
  router.get('/export', adminOnly, async (req, res) => {
    try {
      const rows = queryOrders(req.query)
      const TYPE_MAP   = { hotel: '住宿', food: '餐饮', retail: '零售' }
      const STATUS_MAP = { paid: '已完成', refunded: '已退款', checked_out: '已完成', checked_in: '在住', cancelled: '已取消', pending: '待处理' }
      const PAY_MAP    = { cash: '现金', wechat: '微信支付', alipay: '支付宝', card: '银行卡' }

      const workbook  = new ExcelJS.Workbook()
      workbook.creator = '聚云酒店管理系统'
      const sheet = workbook.addWorksheet('订单列表')

      // 表头
      sheet.columns = [
        { header: '单号',       key: 'order_no',   width: 22 },
        { header: '类型',       key: 'type',        width: 8  },
        { header: '房间/桌号',  key: 'room_no',     width: 10 },
        { header: '姓名',       key: 'guest_name',  width: 10 },
        { header: '金额(元)',   key: 'pay_amount',  width: 10 },
        { header: '支付方式',   key: 'pay_type',    width: 10 },
        { header: '状态',       key: 'status',      width: 10 },
        { header: '日期',       key: 'order_date',  width: 12 },
        { header: '创建时间',   key: 'created_at',  width: 20 },
        { header: '备注',       key: 'remark',      width: 20 },
      ]

      // 表头样式
      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1890FF' } }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
      headerRow.height = 22

      // 数据行
      for (const r of rows) {
        sheet.addRow({
          order_no:   r.order_no || '',
          type:       TYPE_MAP[r.type] || r.type || '',
          room_no:    r.room_no || '',
          guest_name: r.guest_name || '',
          pay_amount: Number(r.pay_amount) || 0,
          pay_type:   PAY_MAP[r.pay_type] || r.pay_type || '',
          status:     STATUS_MAP[r.status] || r.status || '',
          order_date: r.order_date || '',
          created_at: r.created_at || '',
          remark:     r.remark || '',
        })
      }

      // 金额列数字格式
      sheet.getColumn('pay_amount').numFmt = '#,##0.00'

      // 奇偶行背景
      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNum % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF' } }
        })
      })

      const date = new Date().toISOString().slice(0, 10)
      const filename = encodeURIComponent(`orders_${date}.xlsx`)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`)
      await workbook.xlsx.write(res)
      res.end()
    } catch (e) {
      console.error('导出失败', e)
      res.status(500).json({ code: 1, msg: '导出失败: ' + e.message })
    }
  })

  // ─── 下载导入模板 CSV（含 UTF-8 BOM，Excel 直接打开无乱码）────────
  router.get('/import-template', adminOnly, (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const headers = ['单号(留空自动生成)', '类型(hotel/food/retail)', '房间号/桌号',
        '姓名', '金额', '支付方式(cash/wechat/alipay/card)', '状态(paid/cancelled)', '日期(YYYY-MM-DD)', '备注']
      const rows = [
        ['', 'retail', '', '示例客户', '100', 'wechat', 'paid', today, '示例备注'],
        ['', 'food',   'A01', '',       '288', 'alipay',  'paid', today, ''],
      ]
      writeCSV(res, headers, rows)
    } catch (e) {
      res.status(500).json({ code: 1, msg: '模板生成失败: ' + e.message })
    }
  })

  // ─── 导入（支持 xlsx/csv 解析后的 JSON 数组）─────────────
  router.post('/import', adminOnly, (req, res) => {
    try {
      const { rows } = req.body
      if (!Array.isArray(rows) || rows.length === 0) return res.json({ code: 1, msg: '数据为空' })

      let success = 0, fail = 0
      const errors = []
      const genNo = (prefix) => prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const rowNum = i + 2
        try {
          const type = (r.type || '').trim().toLowerCase()
          const pay_amount = parseFloat(r.pay_amount) || 0
          const status = r.status || 'paid'
          const created_at = r.order_date || new Date().toISOString().slice(0, 10)
          const remark = r.remark || ''

          if (!['hotel', 'food', 'retail'].includes(type)) {
            errors.push(`第${rowNum}行: 类型无效(${type})，应为 hotel/food/retail`)
            fail++; continue
          }

          if (type === 'retail') {
            const no = r.order_no || genNo('RT')
            db.prepare(`INSERT OR IGNORE INTO retail_orders(order_no,pay_amount,pay_type,status,remark,created_at)
              VALUES(?,?,?,?,?,?)`).run(no, pay_amount, r.pay_type || 'cash', status, remark, created_at + ' 00:00:00')
          } else if (type === 'food') {
            const no = r.order_no || genNo('FO')
            db.prepare(`INSERT OR IGNORE INTO food_orders(order_no,table_no,pay_amount,pay_type,status,remark,created_at)
              VALUES(?,?,?,?,?,?,?)`).run(no, r.room_no || '', pay_amount, r.pay_type || 'cash', status, remark, created_at + ' 00:00:00')
          } else if (type === 'hotel') {
            const no = r.order_no || genNo('CI')
            db.prepare(`INSERT OR IGNORE INTO checkins(checkin_no,room_id,guest_name,checkin_date,nights,price_per_night,deposit,total_amount,paid_amount,pay_type,status,remark,created_at)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
              no, null, r.guest_name || '导入客户', created_at, 1, pay_amount, 0, pay_amount, pay_amount,
              r.pay_type || 'cash', status, remark, created_at + ' 00:00:00'
            )
          }
          success++
        } catch (e) {
          errors.push(`第${rowNum}行: ${e.message}`)
          fail++
        }
      }

      res.json({ code: 0, msg: `导入完成：成功 ${success} 条，失败 ${fail} 条`, data: { success, fail, errors } })
    } catch (e) {
      res.json({ code: 1, msg: '导入失败: ' + e.message })
    }
  })

  // ─── 批量删除 ──────────────────────────────────────────────
  router.post('/batch-delete', adminOnly, (req, res) => {
    const { items } = req.body
    if (!Array.isArray(items) || items.length === 0) return res.json({ code: 1, msg: '请选择要删除的订单' })

    let success = 0, fail = 0
    try {
      for (const item of items) {
        try {
          const id = Number(item.id)
          const type = item.type
          if (!id || !type) { fail++; continue }

          if (type === 'hotel') {
            const checkin = db.prepare('SELECT room_id, status FROM checkins WHERE id=?').get(id)
            if (checkin && checkin.status === 'checked_in') {
              db.prepare("UPDATE hotel_rooms SET status='vacant' WHERE id=?").run(checkin.room_id)
            }
            db.prepare('DELETE FROM checkin_charges WHERE checkin_id=?').run(id)
            db.prepare('DELETE FROM checkins WHERE id=?').run(id)
          } else if (type === 'food') {
            db.prepare('DELETE FROM food_order_items WHERE order_id=?').run(id)
            db.prepare('DELETE FROM food_orders WHERE id=?').run(id)
          } else if (type === 'retail') {
            db.prepare('DELETE FROM retail_order_items WHERE order_id=?').run(id)
            db.prepare('DELETE FROM retail_orders WHERE id=?').run(id)
          } else { fail++; continue }
          success++
        } catch (e) {
          console.error('删除单条失败', e)
          fail++
        }
      }
      res.json({ code: 0, msg: `删除完成：成功 ${success} 条，失败 ${fail} 条`, data: { success, fail } })
    } catch (e) {
      console.error('批量删除失败', e)
      res.json({ code: 1, msg: '删除失败: ' + e.message })
    }
  })

  return router
}
