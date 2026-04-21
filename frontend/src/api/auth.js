import http from './http'

export const authApi = {
  login: (data) => http.post('/auth/login', data),
  logout: () => http.post('/auth/logout'),
  getMe: () => http.get('/auth/me'),

  // 权限管理
  getPermissions: () => http.get('/auth/permissions'),
  getRoles: () => http.get('/auth/roles'),
  getRolePermissions: (code) => http.get(`/auth/roles/${code}/permissions`),
  updateRolePermissions: (code, permissions) =>
    http.put(`/auth/roles/${code}/permissions`, { permissions }),

  // 用户管理
  getUsers: () => http.get('/auth/users'),
  createUser: (data) => http.post('/auth/users', data),
  updateUser: (id, data) => http.put(`/auth/users/${id}`, data),
  resetPassword: (id, newPassword) => http.put(`/auth/users/${id}/password`, { newPassword }),
  deleteUser: (id) => http.delete(`/auth/users/${id}`),

  // 修改自己密码
  changePassword: (oldPassword, newPassword) => http.put('/auth/my-password', { oldPassword, newPassword }),
}
