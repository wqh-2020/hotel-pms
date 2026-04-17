import http from './http'

// ─── 住宿管理 ─────────────────────────────────────────────
export const hotelRoomApi = {
  getAll: (params) => http.get('/hotel-rooms', { params }),
  create: (data) => http.post('/hotel-rooms', data),
  update: (id, data) => http.put(`/hotel-rooms/${id}`, data),
  remove: (id) => http.delete(`/hotel-rooms/${id}`),
  getTypes: () => http.get('/hotel-rooms/types'),
  createType: (data) => http.post('/hotel-rooms/types', data),
  updateType: (id, data) => http.put(`/hotel-rooms/types/${id}`, data),
  removeType: (id) => http.delete(`/hotel-rooms/types/${id}`),
}

export const checkinApi = {
  getList: (params) => http.get('/checkins', { params }),
  getById: (id) => http.get(`/checkins/${id}`),
  create: (data) => http.post('/checkins', data),
  checkout: (id, data) => http.post(`/checkins/${id}/checkout`, data),
  cancel: (id) => http.post(`/checkins/${id}/cancel`),
  addCharge: (id, data) => http.post(`/checkins/${id}/charges`, data),
  removeCharge: (id, cid) => http.delete(`/checkins/${id}/charges/${cid}`),
}

export const reservationApi = {
  getList: (params) => http.get('/reservations', { params }),
  create: (data) => http.post('/reservations', data),
  confirm: (id) => http.post(`/reservations/${id}/confirm`),
  cancel: (id) => http.post(`/reservations/${id}/cancel`),
  update: (id, data) => http.put(`/reservations/${id}`, data),
}

// ─── 餐饮管理 ─────────────────────────────────────────────
export const foodCategoryApi = {
  getAll: () => http.get('/food/categories'),
  create: (data) => http.post('/food/categories', data),
  update: (id, data) => http.put(`/food/categories/${id}`, data),
  remove: (id) => http.delete(`/food/categories/${id}`),
}

export const dishApi = {
  getAll: (params) => http.get('/food/dishes', { params }),
  getById: (id) => http.get(`/food/dishes/${id}`),
  create: (data) => http.post('/food/dishes', data),
  update: (id, data) => http.put(`/food/dishes/${id}`, data),
  toggle: (id) => http.patch(`/food/dishes/${id}/toggle`),
  remove: (id) => http.delete(`/food/dishes/${id}`),
}

export const diningTableApi = {
  getAll: () => http.get('/food/tables'),
  create: (data) => http.post('/food/tables', data),
  update: (id, data) => http.put(`/food/tables/${id}`, data),
  remove: (id) => http.delete(`/food/tables/${id}`),
  openSession: (id, data) => http.post(`/food/sessions/${id}/open`, data),
  reserveSession: (id, data) => http.post(`/food/sessions/${id}/reserve`, data),
  cancelReserve: (id) => http.post(`/food/sessions/${id}/cancel-reserve`),
  checkinSession: (id, data) => http.post(`/food/sessions/${id}/checkin`, data),
  getItems: (id) => http.get(`/food/sessions/${id}/items`),
  addItem: (id, data) => http.post(`/food/sessions/${id}/items`, data),
  updateItem: (id, itemId, data) => http.patch(`/food/sessions/${id}/items/${itemId}`, data),
  removeItem: (id, itemId) => http.delete(`/food/sessions/${id}/items/${itemId}`),
  checkout: (id, data) => http.post(`/food/sessions/${id}/checkout`, data),
  release: (id) => http.post(`/food/sessions/${id}/release`),
}

export const foodOrderApi = {
  getList: (params) => http.get('/food/orders', { params }),
  getById: (id) => http.get(`/food/orders/${id}`),
}

// ─── 商品零售 ─────────────────────────────────────────────
export const productCategoryApi = {
  getAll: () => http.get('/retail/categories'),
  create: (data) => http.post('/retail/categories', data),
  update: (id, data) => http.put(`/retail/categories/${id}`, data),
  remove: (id) => http.delete(`/retail/categories/${id}`),
}

export const productApi = {
  getAll: (params) => http.get('/retail/products', { params }),
  getById: (id) => http.get(`/retail/products/${id}`),
  create: (data) => http.post('/retail/products', data),
  update: (id, data) => http.put(`/retail/products/${id}`, data),
  toggle: (id) => http.patch(`/retail/products/${id}/toggle`),
  remove: (id) => http.delete(`/retail/products/${id}`),
}

export const retailOrderApi = {
  create: (data) => http.post('/retail/orders', data),
  getList: (params) => http.get('/retail/orders', { params }),
  getById: (id) => http.get(`/retail/orders/${id}`),
  refund: (id) => http.patch(`/retail/orders/${id}/refund`),
}

// ─── 报表 ─────────────────────────────────────────────────
export const statsApi = {
  getToday: () => http.get('/stats/today'),
  getRange: (params) => http.get('/stats/range', { params }),
}

// ─── 系统设置 ─────────────────────────────────────────────
export const settingsApi = {
  getAll: () => http.get('/settings'),
  update: (key, value) => http.put('/settings', { key, value }),
  uploadLogo: (file) => {
    const fd = new FormData(); fd.append('logo', file)
    return http.post('/settings/logo', fd)
  },
  deleteLogo: () => http.delete('/settings/logo'),
  backup: () => http.get('/settings/backup', { responseType: 'blob' }),
}
