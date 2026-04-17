import axios from 'axios'
import { ElMessage } from 'element-plus'

const isElectron = typeof window !== 'undefined' && window.process?.env?.ELECTRON === 'true'
const baseURL = isElectron ? 'http://localhost:3001/api' : '/api'

const http = axios.create({ baseURL, timeout: 15000 })

// 请求拦截器
http.interceptors.request.use(config => {
  const token = localStorage.getItem('hotel_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截器
http.interceptors.response.use(
  response => {
    const data = response.data
    if (data.code !== 0) {
      ElMessage.error(data.msg || '操作失败')
      return Promise.reject(new Error(data.msg || '操作失败'))
    }
    return data.data !== undefined ? data.data : data
  },
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('hotel_token')
      localStorage.removeItem('hotel_user')
      window.location.hash = '#/login'
      ElMessage.error('登录已过期，请重新登录')
    } else if (error.response?.status === 403) {
      ElMessage.error('无权限执行此操作')
    } else {
      ElMessage.error(error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default http
