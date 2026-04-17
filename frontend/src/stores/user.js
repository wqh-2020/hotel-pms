import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('hotel_token') || '')
  const user = ref(JSON.parse(localStorage.getItem('hotel_user') || 'null'))

  const isLoggedIn = computed(() => !!token.value)
  const role = computed(() => user.value?.role || '')
  const isAdmin = computed(() => role.value === 'admin')
  const isFrontDesk = computed(() => ['admin', 'front_desk'].includes(role.value))
  const isCashier = computed(() => ['admin', 'cashier'].includes(role.value))
  const realname = computed(() => user.value?.realname || '')

  async function login(username, password) {
    const res = await authApi.login({ username, password })
    token.value = res.token
    user.value = res.user
    localStorage.setItem('hotel_token', res.token)
    localStorage.setItem('hotel_user', JSON.stringify(res.user))
  }

  async function logout() {
    try { await authApi.logout() } catch {}
    clearAuth()
    router.push('/login')
  }

  function clearAuth() {
    token.value = ''
    user.value = null
    localStorage.removeItem('hotel_token')
    localStorage.removeItem('hotel_user')
  }

  return { token, user, isLoggedIn, role, isAdmin, isFrontDesk, isCashier, realname, login, logout, clearAuth }
})
