import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  { path: '/login', component: () => import('@/views/Login.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('@/components/Layout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '首页总览' } },
      // 住宿管理
      { path: 'room-status', component: () => import('@/views/RoomStatus.vue'), meta: { title: '客房状态' } },
      { path: 'checkins', component: () => import('@/views/Checkins.vue'), meta: { title: '入住管理' } },
      { path: 'reservations', component: () => import('@/views/Reservations.vue'), meta: { title: '预订管理' } },
      { path: 'hotel-rooms', component: () => import('@/views/HotelRooms.vue'), meta: { title: '客房管理', roles: ['admin'] } },
      // 餐饮管理
      { path: 'dining', component: () => import('@/views/Dining.vue'), meta: { title: '餐饮管理' } },
      { path: 'dishes', component: () => import('@/views/Dishes.vue'), meta: { title: '菜品管理', roles: ['admin', 'cashier'] } },
      // 商品零售
      { path: 'retail', component: () => import('@/views/Retail.vue'), meta: { title: '商品零售' } },
      { path: 'products', component: () => import('@/views/Products.vue'), meta: { title: '商品管理', roles: ['admin'] } },
      // 订单报表
      { path: 'orders', component: () => import('@/views/Orders.vue'), meta: { title: '订单管理' } },
      { path: 'stats', component: () => import('@/views/Stats.vue'), meta: { title: '营业报表' } },
      // 系统
      { path: 'users', component: () => import('@/views/Users.vue'), meta: { title: '用户管理', roles: ['admin'] } },
      { path: 'settings', component: () => import('@/views/Settings.vue'), meta: { title: '系统设置', roles: ['admin'] } },
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach((to, from, next) => {
  if (to.meta.public) return next()
  const store = useUserStore()
  if (!store.isLoggedIn) return next('/login')
  if (to.meta.roles && !to.meta.roles.includes(store.role)) return next('/dashboard')
  next()
})

export default router
