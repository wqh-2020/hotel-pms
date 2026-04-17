const express = require('express')

module.exports = function(db) {
  const router = express.Router()

  // 今日综合统计
  router.get('/today', (req, res) => {
    const today = new Date().toISOString().slice(0, 10)
    // 住宿
    const hotelStats = db.prepare(`SELECT count(*) as count, IFNULL(SUM(paid_amount),0) as revenue FROM checkins WHERE date(checkin_date)=? AND status!='cancelled'`).get(today)
    const occupiedRooms = db.prepare("SELECT count(*) as cnt FROM hotel_rooms WHERE status='occupied'").get()
    const totalRooms = db.prepare('SELECT count(*) as cnt FROM hotel_rooms').get()
    // 餐饮
    const foodStats = db.prepare(`SELECT count(*) as count, IFNULL(SUM(pay_amount),0) as revenue FROM food_orders WHERE date(created_at)=? AND status='paid'`).get(today)
    // 零售
    const retailStats = db.prepare(`SELECT count(*) as count, IFNULL(SUM(pay_amount),0) as revenue FROM retail_orders WHERE date(created_at)=? AND status='paid'`).get(today)
    // TOP菜品
    const topDishes = db.prepare(`SELECT i.dish_name, SUM(i.quantity) as qty FROM food_order_items i
      JOIN food_orders o ON i.order_id=o.id WHERE date(o.created_at)=? AND o.status='paid'
      GROUP BY i.dish_name ORDER BY qty DESC LIMIT 5`).all(today)
    // TOP商品
    const topProducts = db.prepare(`SELECT i.product_name, SUM(i.quantity) as qty FROM retail_order_items i
      JOIN retail_orders o ON i.order_id=o.id WHERE date(o.created_at)=? AND o.status='paid'
      GROUP BY i.product_name ORDER BY qty DESC LIMIT 5`).all(today)
    res.json({ code: 0, data: {
      hotel: { ...hotelStats, occupied: occupiedRooms.cnt, total: totalRooms.cnt, occupancy: totalRooms.cnt ? Math.round(occupiedRooms.cnt / totalRooms.cnt * 100) : 0 },
      food: foodStats,
      retail: retailStats,
      totalRevenue: (hotelStats.revenue || 0) + (foodStats.revenue || 0) + (retailStats.revenue || 0),
      topDishes,
      topProducts
    }})
  })

  // 日期范围统计
  router.get('/range', (req, res) => {
    const { start, end } = req.query
    if (!start || !end) return res.json({ code: 1, msg: '请提供日期范围' })

    const hotelRevenue = db.prepare(`SELECT IFNULL(SUM(paid_amount),0) as revenue, count(*) as checkins FROM checkins WHERE date(checkin_date) BETWEEN ? AND ? AND status!='cancelled'`).get(start, end)
    const foodRevenue  = db.prepare(`SELECT IFNULL(SUM(pay_amount),0) as revenue, count(*) as orders FROM food_orders WHERE date(created_at) BETWEEN ? AND ? AND status='paid'`).get(start, end)
    const retailRevenue= db.prepare(`SELECT IFNULL(SUM(pay_amount),0) as revenue, count(*) as orders FROM retail_orders WHERE date(created_at) BETWEEN ? AND ? AND status='paid'`).get(start, end)

    // 每日营收 — 合并为统一数组 [{date, hotel, food, retail}]
    const dailyHotel  = db.prepare(`SELECT date(checkin_date) as date, IFNULL(SUM(paid_amount),0) as amount FROM checkins WHERE date(checkin_date) BETWEEN ? AND ? AND status!='cancelled' GROUP BY date ORDER BY date`).all(start, end)
    const dailyFood   = db.prepare(`SELECT date(created_at) as date, IFNULL(SUM(pay_amount),0) as amount FROM food_orders WHERE date(created_at) BETWEEN ? AND ? AND status='paid' GROUP BY date ORDER BY date`).all(start, end)
    const dailyRetail = db.prepare(`SELECT date(created_at) as date, IFNULL(SUM(pay_amount),0) as amount FROM retail_orders WHERE date(created_at) BETWEEN ? AND ? AND status='paid' GROUP BY date ORDER BY date`).all(start, end)

    // 生成日期范围内所有日期
    const dateSet = new Set([
      ...dailyHotel.map(d => d.date),
      ...dailyFood.map(d => d.date),
      ...dailyRetail.map(d => d.date),
    ])
    const hotelMap  = Object.fromEntries(dailyHotel.map(d => [d.date, d.amount]))
    const foodMap   = Object.fromEntries(dailyFood.map(d => [d.date, d.amount]))
    const retailMap = Object.fromEntries(dailyRetail.map(d => [d.date, d.amount]))
    const daily = [...dateSet].sort().map(date => ({
      date,
      hotel:  hotelMap[date]  || 0,
      food:   foodMap[date]   || 0,
      retail: retailMap[date] || 0,
    }))

    // 支付方式汇总（餐饮 + 零售合并）
    const foodPay   = db.prepare(`SELECT pay_type, IFNULL(SUM(pay_amount),0) as amount FROM food_orders WHERE date(created_at) BETWEEN ? AND ? AND status='paid' GROUP BY pay_type`).all(start, end)
    const retailPay = db.prepare(`SELECT pay_type, IFNULL(SUM(pay_amount),0) as amount FROM retail_orders WHERE date(created_at) BETWEEN ? AND ? AND status='paid' GROUP BY pay_type`).all(start, end)
    const hotelPay  = db.prepare(`SELECT pay_type, IFNULL(SUM(paid_amount),0) as amount FROM checkins WHERE date(checkin_date) BETWEEN ? AND ? AND status!='cancelled' GROUP BY pay_type`).all(start, end)
    const payMap = {}
    for (const row of [...foodPay, ...retailPay, ...hotelPay]) {
      if (!row.pay_type) continue
      payMap[row.pay_type] = (payMap[row.pay_type] || 0) + (row.amount || 0)
    }
    const pay_types = Object.entries(payMap).map(([pay_type, amount]) => ({ pay_type, amount }))

    // TOP菜品 & TOP商品
    const top_dishes = db.prepare(`SELECT i.dish_name as name, SUM(i.quantity) as qty, SUM(i.subtotal) as amount FROM food_order_items i JOIN food_orders o ON i.order_id=o.id WHERE date(o.created_at) BETWEEN ? AND ? AND o.status='paid' GROUP BY i.dish_name ORDER BY qty DESC LIMIT 10`).all(start, end)
    const top_products = db.prepare(`SELECT i.product_name as name, SUM(i.quantity) as qty, SUM(i.subtotal) as amount FROM retail_order_items i JOIN retail_orders o ON i.order_id=o.id WHERE date(o.created_at) BETWEEN ? AND ? AND o.status='paid' GROUP BY i.product_name ORDER BY qty DESC LIMIT 10`).all(start, end)

    res.json({ code: 0, data: {
      hotel_revenue: hotelRevenue.revenue, hotel_count: hotelRevenue.checkins,
      food_revenue:  foodRevenue.revenue,  food_count:  foodRevenue.orders,
      retail_revenue: retailRevenue.revenue, retail_count: retailRevenue.orders,
      total_revenue: (hotelRevenue.revenue || 0) + (foodRevenue.revenue || 0) + (retailRevenue.revenue || 0),
      daily,
      pay_types,
      top_dishes,
      top_products,
    }})
  })

  return router
}
