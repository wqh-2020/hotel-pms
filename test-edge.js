/**
 * 聚云酒店管理系统 - 边界与特殊情况测试
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

function warn(name, msg = '') {
  console.log(`⚠️  [${name}] ${msg}`)
}

async function run() {
  console.log('\n========== 聚云酒店管理系统 - 边界与特殊情况测试 ==========\n')

  // 先登录获取 token
  let r = await req('POST', '/api/auth/login', { username: 'admin', password: '123456' })
  token = r.d.data?.token || ''

  // ========== 1. 住宿管理边界 ==========
  console.log('\n--- 住宿管理边界 ---')

  // B1: 入住 - nights 为 0
  const rooms = await req('GET', '/api/hotel-rooms')
  const vacantRoom = Array.isArray(rooms.d.data) ? rooms.d.data.find(r => r.status === 'vacant') : null
  r = await req('POST', '/api/checkins', {
    room_id: vacantRoom?.id || 1,
    guest_name: '边界测试',
    checkin_date: '2026-04-17',
    nights: 0,
    paid_amount: 0
  })
  assert('入住 nights=0 应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B2: 入住 - nights 为负数
  r = await req('POST', '/api/checkins', {
    room_id: vacantRoom?.id || 1,
    guest_name: '边界测试',
    checkin_date: '2026-04-17',
    nights: -1,
    paid_amount: 0
  })
  assert('入住 nights=-1 应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B3: 入住 - 价格为空（应使用房间默认价格）
  r = await req('POST', '/api/checkins', {
    room_id: vacantRoom?.id || 1,
    guest_name: '边界测试-空价格',
    checkin_date: '2026-04-17',
    nights: 1,
    paid_amount: 0
  })
  assert('入住价格为空应使用默认价', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // B4: 入住 - 押金为负数
  r = await req('POST', '/api/checkins', {
    room_id: vacantRoom?.id || 1,
    guest_name: '边界测试',
    checkin_date: '2026-04-17',
    nights: 1,
    deposit: -50,
    paid_amount: -50
  })
  assert('押金为负数应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B5: 入住 - 实收金额为负数
  r = await req('POST', '/api/checkins', {
    room_id: vacantRoom?.id || 1,
    guest_name: '边界测试',
    checkin_date: '2026-04-17',
    nights: 1,
    deposit: 50,
    paid_amount: -100
  })
  assert('实收金额为负应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B6: 入住 - 人数为 0
  r = await req('POST', '/api/checkins', {
    room_id: vacantRoom?.id || 1,
    guest_name: '边界测试',
    checkin_date: '2026-04-17',
    nights: 1,
    guest_count: 0,
    paid_amount: 0
  })
  assert('入住人数为0应使用默认值1', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // B7: 入住 - 不存在的房间 ID
  r = await req('POST', '/api/checkins', {
    room_id: 99999,
    guest_name: '边界测试',
    checkin_date: '2026-04-17',
    nights: 1,
    paid_amount: 0
  })
  assert('不存在的房间ID应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B8: 入住 - 缺少必填字段 guest_name
  r = await req('POST', '/api/checkins', {
    room_id: vacantRoom?.id || 1,
    checkin_date: '2026-04-17',
    nights: 1,
    paid_amount: 0
  })
  assert('缺少 guest_name 应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B9: 入住 - 缺少必填字段 room_id
  r = await req('POST', '/api/checkins', {
    guest_name: '边界测试',
    checkin_date: '2026-04-17',
    nights: 1,
    paid_amount: 0
  })
  assert('缺少 room_id 应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B10: 入住 - 房间 ID 为字符串
  r = await req('POST', '/api/checkins', {
    room_id: 'abc',
    guest_name: '边界测试',
    checkin_date: '2026-04-17',
    nights: 1,
    paid_amount: 0
  })
  assert('房间ID为字符串应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // ========== 退房边界 ==========
  console.log('\n--- 退房边界 ---')

  // 先找一个已入住的记录
  const checkinList = await req('GET', '/api/checkins?status=checked_in')
  const activeCheckin = Array.isArray(checkinList.d.data) ? checkinList.d.data[0] : (checkinList.d.data?.list?.[0])

  // B11: 退房 - 金额为负数
  if (activeCheckin?.id) {
    r = await req('POST', `/api/checkins/${activeCheckin.id}/checkout`, { pay_amount: -100, pay_type: 'cash' })
    assert('退房金额为负应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))
  } else {
    warn('退房金额测试', '无在住记录，跳过')
  }

  // B12: 退房 - 金额为0（可能允许，取决于业务规则）
  if (activeCheckin?.id) {
    r = await req('POST', `/api/checkins/${activeCheckin.id}/checkout`, { pay_amount: 0, pay_type: 'cash' })
    assert('退房金额为0', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))
  }

  // B13: 退房 - 不存在的入住ID
  r = await req('POST', '/api/checkins/99999/checkout', { pay_amount: 100, pay_type: 'cash' })
  assert('退房不存在的ID应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B14: 退房 - 缺少 pay_type
  if (activeCheckin?.id) {
    r = await req('POST', `/api/checkins/${activeCheckin.id}/checkout`, { pay_amount: 100 })
    assert('退房缺少支付方式', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))
  }

  // ========== 追加费用边界 ==========
  console.log('\n--- 追加费用边界 ---')

  // B15: 追加费用 - 金额为 0
  if (activeCheckin?.id) {
    r = await req('POST', `/api/checkins/${activeCheckin.id}/charges`, { charge_type: 'extra', description: '测试', amount: 0 })
    assert('追加费用金额为0应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))
  }

  // B16: 追加费用 - 金额为负数
  if (activeCheckin?.id) {
    r = await req('POST', `/api/checkins/${activeCheckin.id}/charges`, { charge_type: 'extra', description: '测试', amount: -50 })
    assert('追加费用金额为负应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))
  }

  // B17: 追加费用 - 缺少 description
  if (activeCheckin?.id) {
    r = await req('POST', `/api/checkins/${activeCheckin.id}/charges`, { charge_type: 'extra', amount: 50 })
    assert('追加费用缺少描述', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))
  }

  // B18: 追加费用 - 不存在的入住ID
  r = await req('POST', '/api/checkins/99999/charges', { charge_type: 'extra', description: '测试', amount: 50 })
  assert('追加费用不存在的ID应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // ========== 预订边界 ==========
  console.log('\n--- 预订边界 ---')

  // B19: 预订 - 人数为 0
  r = await req('POST', '/api/reservations', {
    guest_name: '预订边界测试',
    guest_phone: '13900139000',
    checkin_date: '2026-04-25',
    checkout_date: '2026-04-27',
    nights: 2,
    guest_count: 0
  })
  assert('预订人数为0应使用默认值', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // B20: 预订 - 押金为负数
  r = await req('POST', '/api/reservations', {
    guest_name: '预订边界测试',
    guest_phone: '13900139000',
    checkin_date: '2026-04-26',
    checkout_date: '2026-04-28',
    nights: 2,
    deposit: -100
  })
  assert('预订押金为负应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B21: 预订 - checkout_date 早于 checkin_date
  r = await req('POST', '/api/reservations', {
    guest_name: '预订边界测试',
    checkin_date: '2026-04-28',
    checkout_date: '2026-04-26',
    nights: -2
  })
  assert('退房日期早于入住日期应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // ========== 餐饮管理边界 ==========
  console.log('\n--- 餐饮管理边界 ---')

  // B22: 开台 - 人数为 0
  const tables = await req('GET', '/api/food/tables')
  const freeTable = Array.isArray(tables.d.data) ? tables.d.data.find(t => t.status === 'free') : null
  r = await req('POST', `/api/food/tables/${freeTable?.id || 1}/open`, { guest_count: 0 })
  assert('开台人数为0应使用默认值', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // B23: 开台 - 人数为负数
  r = await req('POST', `/api/food/tables/${freeTable?.id || 1}/open`, { guest_count: -1 })
  assert('开台人数为负应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B24: 点菜 - 数量为 0
  const openedTable = freeTable || { id: 1 }
  r = await req('POST', `/api/food/tables/${openedTable.id}/items`, { dish_id: 1, quantity: 0 })
  assert('点菜数量为0应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B25: 点菜 - 数量为负数
  r = await req('POST', `/api/food/tables/${openedTable.id}/items`, { dish_id: 1, quantity: -1 })
  assert('点菜数量为负应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B26: 点菜 - 不存在的菜品
  r = await req('POST', `/api/food/tables/${openedTable.id}/items`, { dish_id: 99999, quantity: 1 })
  assert('点不存在的菜品应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B27: 点菜 - 缺少 dish_id
  r = await req('POST', `/api/food/tables/${openedTable.id}/items`, { quantity: 1 })
  assert('点菜缺少菜品ID应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B28: 结账 - 对空闲餐桌结账
  const allTables = await req('GET', '/api/food/tables')
  const idleTable = Array.isArray(allTables.d.data) ? allTables.d.data.find(t => t.status === 'free') : null
  if (idleTable) {
    r = await req('POST', `/api/food/tables/${idleTable.id}/checkout`, { pay_type: 'cash' })
    assert('对空闲餐桌结账应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))
  }

  // B29: 结账 - 不存在的餐桌
  r = await req('POST', '/api/food/tables/99999/checkout', { pay_type: 'cash' })
  assert('对不存在的餐桌结账应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B30: 结账 - 缺少支付方式
  r = await req('POST', `/api/food/tables/${openedTable.id}/checkout`, {})
  assert('结账缺少支付方式', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // ========== 商品零售边界 ==========
  console.log('\n--- 商品零售边界 ---')

  // B31: 零售订单 - 商品数量为 0
  r = await req('POST', '/api/retail/orders', {
    items: [{ product_id: 1, quantity: 0 }],
    pay_type: 'cash'
  })
  assert('零售数量为0应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B32: 零售订单 - 商品数量为负数
  r = await req('POST', '/api/retail/orders', {
    items: [{ product_id: 1, quantity: -1 }],
    pay_type: 'cash'
  })
  assert('零售数量为负应拦截', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B33: 零售订单 - 不存在的商品
  r = await req('POST', '/api/retail/orders', {
    items: [{ product_id: 99999, quantity: 1 }],
    pay_type: 'cash'
  })
  assert('不存在的商品应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B34: 零售订单 - 空商品列表
  r = await req('POST', '/api/retail/orders', {
    items: [],
    pay_type: 'cash'
  })
  assert('空商品列表应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B35: 零售订单 - 缺少支付方式
  r = await req('POST', '/api/retail/orders', {
    items: [{ product_id: 1, quantity: 1 }]
  })
  assert('零售缺少支付方式', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // ========== 系统级边界 ==========
  console.log('\n--- 系统级边界 ---')

  // B36: 无效 token 访问受保护接口
  r = await req('GET', '/api/checkins', null, { 'Authorization': 'Bearer invalid_token_123' })
  assert('无效token应拒绝访问', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B37: 缺失 token 访问受保护接口
  const reqNoToken = (method, path, body) => req(method, path, body, { 'Authorization': '' })
  r = await reqNoToken('GET', '/api/checkins', null)
  assert('无token应拒绝访问', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B38: 错误的 API 路径
  r = await req('GET', '/api/nonexistent/path')
  assert('错误路径应返回404或错误', r.s === 404 || (r.s === 200 && r.d.code === 1), JSON.stringify(r.d))

  // B39: 错误的 HTTP 方法
  r = await req('DELETE', '/api/checkins')
  assert('错误HTTP方法应有响应', r.s !== undefined, JSON.stringify(r.d))

  // B40: 超长参数值
  const longStr = 'a'.repeat(10000)
  r = await req('POST', '/api/checkins', {
    room_id: vacantRoom?.id || 1,
    guest_name: longStr,
    checkin_date: '2026-04-17',
    nights: 1,
    paid_amount: 0
  })
  assert('超长姓名参数', r.s === 200, JSON.stringify(r.d))

  // B41: SQL 注入测试
  r = await req('POST', '/api/checkins', {
    room_id: vacantRoom?.id || 1,
    guest_name: "'; DROP TABLE checkins; --",
    checkin_date: '2026-04-17',
    nights: 1,
    paid_amount: 0
  })
  assert('SQL注入应安全处理', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // 验证表没被删除
  const verifyTable = await req('GET', '/api/checkins')
  assert('SQL注入后表仍存在', verifyTable.s === 200 && verifyTable.d.code === 0, JSON.stringify(verifyTable.d))

  // B42: XSS 测试（存储型）
  r = await req('POST', '/api/checkins', {
    room_id: vacantRoom?.id || 1,
    guest_name: '<script>alert(1)</script>',
    checkin_date: '2026-04-17',
    nights: 1,
    paid_amount: 0,
    remark: '<img src=x onerror=alert(1)>'
  })
  assert('XSS注入应安全处理', r.s === 200 && r.d.code === 0, JSON.stringify(r.d))

  // ========== 取消/删除边界 ==========
  console.log('\n--- 取消/删除边界 ---')

  // B43: 取消不存在的入住
  r = await req('POST', '/api/checkins/99999/cancel')
  assert('取消不存在的入住应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))

  // B44: 取消已退房的入住
  const checkedOutList = await req('GET', '/api/checkins?status=checked_out')
  const checkedOut = Array.isArray(checkedOutList.d.data) ? checkedOutList.d.data[0] : (checkedOutList.d.data?.list?.[0])
  if (checkedOut?.id) {
    r = await req('POST', `/api/checkins/${checkedOut.id}/cancel`)
    assert('取消已退房入住应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))
  } else {
    warn('取消已退房测试', '无已退房记录，跳过')
  }

  // B45: 取消已取消的入住
  if (activeCheckin?.id) {
    // 先取消
    await req('POST', `/api/checkins/${activeCheckin.id}/cancel`)
    // 再取消一次
    r = await req('POST', `/api/checkins/${activeCheckin.id}/cancel`)
    assert('重复取消应报错', r.s === 200 && r.d.code === 1, JSON.stringify(r.d))
  }

  // ========== 查询边界 ==========
  console.log('\n--- 查询边界 ---')

  // B46: 负数分页
  r = await req('GET', '/api/checkins?page=-1')
  assert('负数分页应处理', r.s === 200, JSON.stringify(r.d))

  // B47: 非法分页值
  r = await req('GET', '/api/checkins?page=abc')
  assert('非法分页值应处理', r.s === 200, JSON.stringify(r.d))

  // B48: 大数值分页
  r = await req('GET', '/api/checkins?page=999999')
  assert('大数值分页应处理', r.s === 200, JSON.stringify(r.d))

  // B49: 非法日期格式
  r = await req('GET', '/api/stats/range?start=invalid&end=2026-04-30')
  assert('非法开始日期应处理', r.s === 200, JSON.stringify(r.d))

  // B50: 结束日期早于开始日期
  r = await req('GET', '/api/stats/range?start=2026-04-30&end=2026-04-01')
  assert('结束日期早于开始日期应处理', r.s === 200, JSON.stringify(r.d))

  // ========== 总结 ==========
  console.log('\n========== 边界测试结果 ==========')
  console.log(`总计: ${testCount} | 通过: ${passed} | 失败: ${failed}`)
  if (failed === 0) {
    console.log('\n🎉 所有边界测试通过！系统健壮性良好！\n')
  } else {
    console.log(`\n⚠️  有 ${failed} 项测试失败，请检查修复后再上线。\n`)
  }
}

run().catch(e => {
  console.error('测试执行失败:', e)
  process.exit(1)
})
