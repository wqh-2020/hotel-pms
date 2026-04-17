import http from './http'

export const authApi = {
  login: (data) => http.post('/auth/login', data),
  logout: () => http.post('/auth/logout'),
  getMe: () => http.get('/auth/me'),
  getUsers: () => http.get('/auth/users'),
  createUser: (data) => http.post('/auth/users', data),
  updateUser: (id, data) => http.put(`/auth/users/${id}`, data),
  resetPassword: (id, newPassword) => http.put(`/auth/users/${id}/password`, { newPassword }),
  deleteUser: (id) => http.delete(`/auth/users/${id}`),
  changePassword: (oldPassword, newPassword) => http.put('/auth/my-password', { oldPassword, newPassword }),
}
