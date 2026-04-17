/**
 * 聚云酒店管理系统 - 自动化测试脚本
 */
const http = require('http')

const BASE = 'http://localhost:3001'
let token = ''
let passed = 0, failed = 0, testCount = 0

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE)
    const opt = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    }
    if (token) opt.headers['Authorization'] = `Bearer ${token}`
    const r = http.request(opt, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve({ s: res.statusCode, d: JSON.parse(d) }) }
        catch { resolve({ s: res.statusCode, d }) }
      })
    })
    r.on('error', reject)
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
}

function assert(name, condition, msg = '') {
  testCount++
  if (condition) {
    console.log(`✅ [${testCount}] ${name}`)
    passed++
  } else {
    console.log(`❌ [${testCount}] ${name}`)
    if (msg) console.log(`   └─ ${msg}`)
    failed++
  }
}

async function run() {
  console.log('\n========== 聚云酒店管理系统 自动化测试 ==========\n')

  // 1. 健康检查
  let r = await req('GET', '/api/health')
  assert('健康检查', r.s === 200 && r.d.code === 0)

  // 2. 登录
  r = await req('POST', '/api/auth/login', { username: 'admin', password: '123456' })
  assert('登录 admin/123456', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))
  token = r.d.data?.token || ''

  // 3. 获取当前用户
  r = await req('GET', '/api/auth/current')
  assert('获取当前用户', r.s === 200 && r.d.code === 0)

  // 4. 获取设置
  r = await req('GET', '/api/settings')
  assert('获取系统设置', r.s === 200 && r.d.code === 0)

  // ========== 住宿管理 ==========
  console.log('\n--- 住宿管理 ---')

  // 5. 客房列表
  r = await req('GET', '/api/hotel-rooms')
  assert('客房列表', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))
  const rooms = Array.isArray(r.d.data) ? r.d.data : (r.d.data?.list || [])
  // 找一个空闲的房间
  const vacantRoom = rooms.find(r => r.status === 'vacant')
  const roomId = vacantRoom?.id || rooms[0]?.id

  // 6. 房型列表
  r = await req('GET', '/api/hotel-rooms/types')
  assert('房型列表', r.s === 200 && r.d.code === 0)

  // 7. 预订列表
  r = await req('GET', '/api/reservations')
  assert('预订列表', r.s === 200 && r.d.code === 0)

  // 8. 入住列表
  r = await req('GET', '/api/checkins')
  assert('入住列表', r.s === 200 && r.d.code === 0)

  // 9. 办理入住
  r = await req('POST', '/api/checkins', {
    room_id: roomId,
    guest_name: '测试客户',
    guest_phone: '13800138000',
    checkin_date: '2026-04-17',
    nights: 1,
    price_per_night: 120,
    deposit: 50,
    paid_amount: 120,
    pay_type: 'wechat'
  })
  assert('办理入住', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))
  // 从 checkin_no 获取最新入住 ID
  const checkinNo = r.d.data?.checkin_no
  let checkinId = null
  if (checkinNo) {
    const list = await req('GET', '/api/checkins')
    const found = list.d.data?.list?.find(c => c.checkin_no === checkinNo)
    checkinId = found?.id
  }

  // 10. 补全订单查询（有 id）
  if (checkinId) {
    r = await req('GET', `/api/checkins/${checkinId}`)
    assert('入住详情查询', r.s === 200 && r.d.code === 0)
  } else {
    assert('入住详情查询', false, '无 checkinId')
  }

  // 11. 取消测试入住
  if (checkinId) {
    r = await req('POST', `/api/checkins/${checkinId}/cancel`)
    assert('取消入住', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))
  }

  // 12. 添加预订
  r = await req('POST', '/api/reservations', {
    guest_name: '预订测试',
    guest_phone: '13900139000',
    checkin_date: '2026-04-20',
    checkout_date: '2026-04-22',
    nights: 2,
    deposit: 100
  })
  assert('添加预订', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // 13. 再次办理入住（用另一个空房）
  const rooms2 = Array.isArray((await req('GET', '/api/hotel-rooms')).d.data) ? (await req('GET', '/api/hotel-rooms')).d.data : []
  const vacantRoom2 = rooms2.find(r => r.status === 'vacant')
  r = await req('POST', '/api/checkins', {
    room_id: vacantRoom2?.id || roomId,
    guest_name: '正式入住测试',
    guest_phone: '13700137000',
    checkin_date: '2026-04-17',
    nights: 1,
    price_per_night: 120,
    paid_amount: 120,
    pay_type: 'cash'
  })
  assert('正式入住', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // 14. 退房（从正式入住的记录退房，不是取消的那个）
  // 先获取最新的入住记录
  const checkinList = await req('GET', '/api/checkins?status=checked_in')
  const activeCheckin = Array.isArray(checkinList.d.data) ? checkinList.d.data[0] : (checkinList.d.data?.list?.[0])
  if (activeCheckin?.id) {
    r = await req('POST', `/api/checkins/${activeCheckin.id}/checkout`, { pay_amount: 120, pay_type: 'cash' })
    assert('退房', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))
  } else {
    assert('退房', false, '无在住记录')
  }

  // 15. 追加费用
  if (checkinId) {
    r = await req('POST', `/api/checkins/${checkinId}/charges`, { charge_type: 'extra', description: '加床', amount: 50 })
    assert('追加费用', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))
  }

  // ========== 餐饮管理 ==========
  console.log('\n--- 餐饮管理 ---')

  // 16. 菜品分类
  r = await req('GET', '/api/food/categories')
  assert('菜品分类列表', r.s === 200 && r.d.code === 0)

  // 17. 菜品列表
  r = await req('GET', '/api/food/dishes')
  assert('菜品列表', r.s === 200 && r.d.code === 0)

  // 18. 餐桌状态
  r = await req('GET', '/api/food/tables')
  assert('餐桌状态', r.s === 200 && r.d.code === 0)

  // 找一个空闲的餐桌及其 session_id
  const tables = Array.isArray(r.d.data) ? r.d.data : []
  const freeTable = tables.find(t => t.status === 'free')
  const testSessionId = freeTable?.session_id || 1
  const testTableId = freeTable?.id || 1

  // 19. 开台
  r = await req('POST', `/api/food/tables/${testTableId}/open`, { guest_count: 2 })
  assert('开台', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // 20. 点菜（找一个有菜品的 ID）
  const dishes = await req('GET', '/api/food/dishes')
  const dishId = Array.isArray(dishes.d.data) && dishes.d.data.length > 0 ? dishes.d.data[0].id : 1
  r = await req('POST', `/api/food/tables/${testTableId}/items`, { dish_id: dishId, quantity: 2 })
  assert('点菜', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // 21. 结账
  r = await req('POST', `/api/food/tables/${testTableId}/checkout`, { pay_type: 'wechat' })
  assert('结账', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // 22. 餐饮订单
  r = await req('GET', '/api/food/orders')
  assert('餐饮订单列表', r.s === 200 && r.d.code === 0)

  // ========== 商品零售 ==========
  console.log('\n--- 商品零售 ---')

  // 23. 商品分类
  r = await req('GET', '/api/retail/categories')
  assert('商品分类', r.s === 200 && r.d.code === 0)

  // 24. 商品列表
  r = await req('GET', '/api/retail/products')
  assert('商品列表', r.s === 200 && r.d.code === 0)

  // 25. 创建零售订单
  r = await req('POST', '/api/retail/orders', {
    items: [{ product_id: 1, quantity: 2 }],
    pay_type: 'cash'
  })
  assert('创建零售订单', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // 26. 零售订单列表
  r = await req('GET', '/api/retail/orders')
  assert('零售订单列表', r.s === 200 && r.d.code === 0)

  // ========== 统计报表 ==========
  console.log('\n--- 统计报表 ---')

  // 27. 今日营收
  r = await req('GET', '/api/stats/today')
  assert('今日营收', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // 28. 日期范围统计
  r = await req('GET', '/api/stats/range?start=2026-04-01&end=2026-04-30')
  assert('月统计报表', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // ========== 错误处理 ==========
  console.log('\n--- 错误处理 ---')

  // 29. 重复入住（找一个已入住的房间）
  const occupiedRooms = Array.isArray((await req('GET', '/api/hotel-rooms')).d.data) ? (await req('GET', '/api/hotel-rooms')).d.data : []
  const occupiedRoom = occupiedRooms.find(r => r.status === 'occupied')
  if (occupiedRoom) {
    r = await req('POST', '/api/checkins', {
      room_id: occupiedRoom.id,
      guest_name: '重复入住测试',
      checkin_date: '2026-04-17',
      nights: 1
    })
    assert('重复入住拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))
  } else {
    assert('重复入住拦截', false, '无已入住房间可测试')
  }

  // 30. 空参数校验
  r = await req('POST', '/api/checkins', {})
  assert('空参数校验', r.s === 200 && r.d.code === 1)

  // ========== 总结 ==========
  console.log('\n========== 测试结果 ==========')
  console.log(`总计: ${testCount} | 通过: ${passed} | 失败: ${failed}`)
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！系统可以安全上线！\n')
  } else {
    console.log('\n⚠️  有测试失败，请检查上述问题后再上线。\n')
  }
}

run().catch(e => {
  console.error('测试执行失败:', e)
  process.exit(1)
})
