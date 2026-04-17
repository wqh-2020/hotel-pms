<template>
  <div class="layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- 遮罩层（移动端） -->
    <div v-if="sidebarVisible && isMobile" class="mask" @click="sidebarVisible = false"></div>

    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ visible: sidebarVisible }" :style="{ width: sidebarWidth + 'px' }">
      <div class="sidebar-header">
        <img v-if="logoUrl" :src="logoUrl" class="logo" />
        <span v-else class="logo-text">🏨</span>
        <span class="hotel-name" v-if="!sidebarCollapsed">{{ hotelName }}</span>
      </div>
      <nav class="sidebar-nav">
        <template v-for="group in menuGroups" :key="group.label">
          <div class="nav-group-label" v-if="!sidebarCollapsed">{{ group.label }}</div>
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: $route.path === item.path }"
            @click="isMobile && (sidebarVisible = false)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span v-if="!sidebarCollapsed">{{ item.label }}</span>
          </router-link>
        </template>
      </nav>
      <div class="sidebar-footer" v-if="!sidebarCollapsed">
        <div class="time">{{ currentTime }}</div>
        <div class="server-status" :class="serverOk ? 'ok' : 'err'">
          <el-icon><CircleCheckFilled v-if="serverOk" /><CircleCloseFilled v-else /></el-icon>
          {{ serverOk ? '服务正常' : '服务异常' }}
        </div>
      </div>
    </aside>

    <!-- 主区域 -->
    <div class="main">
      <!-- 顶部栏 -->
      <header class="topbar">
        <div class="topbar-left">
          <el-icon class="menu-btn" @click="toggleSidebar"><Fold v-if="!sidebarCollapsed" /><Expand v-else /></el-icon>
          <span class="page-title">{{ $route.meta.title }}</span>
        </div>
        <div class="topbar-right">
          <span class="hidden-mobile">{{ hotelName }}</span>
          <el-dropdown @command="handleCmd">
            <span class="user-info">
              <el-avatar :size="28" :style="{ background: 'var(--primary)' }">{{ userStore.realname?.slice(0, 1) }}</el-avatar>
              <span class="hidden-mobile">{{ userStore.realname }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="pwd">修改密码</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <!-- 内容区 -->
      <main class="content">
        <router-view />
      </main>
    </div>

    <!-- 修改密码对话框 -->
    <el-dialog v-model="pwdVisible" title="修改密码" width="400px">
      <el-form :model="pwdForm" label-width="90px">
        <el-form-item label="原密码"><el-input v-model="pwdForm.old" type="password" show-password /></el-form-item>
        <el-form-item label="新密码"><el-input v-model="pwdForm.new1" type="password" show-password /></el-form-item>
        <el-form-item label="确认密码"><el-input v-model="pwdForm.new2" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" @click="changePwd">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { authApi } from '@/api/auth'
import { settingsApi } from '@/api/index'
import { ElMessage } from 'element-plus'
import http from '@/api/http'
import dayjs from 'dayjs'

const userStore = useUserStore()

// ── 响应式 ──────────────────────────────────────
const isMobile = ref(window.innerWidth <= 768)
const sidebarCollapsed = ref(false)
const sidebarVisible = ref(!isMobile.value)
const sidebarWidth = ref(220)

function toggleSidebar() {
  if (isMobile.value) sidebarVisible.value = !sidebarVisible.value
  else sidebarCollapsed.value = !sidebarCollapsed.value
}

function onResize() {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) sidebarVisible.value = true
}

// ── 系统设置 ─────────────────────────────────────
const hotelName = ref('聚云酒店管理系统')
const logoUrl = ref('')

async function loadSettings() {
  try {
    const data = await settingsApi.getAll()
    if (data.hotel_name) hotelName.value = data.hotel_name
    if (data.logo_url) logoUrl.value = data.logo_url
    if (data.theme_color) document.documentElement.style.setProperty('--primary', data.theme_color)
    if (data.theme === 'dark') document.body.classList.add('dark')
    else document.body.classList.remove('dark')
    if (data.sidebar_width) sidebarWidth.value = Number(data.sidebar_width)
  } catch {}
}

// ── 菜单配置 ─────────────────────────────────────
const menuGroups = computed(() => {
  const role = userStore.role
  const groups = [
    {
      label: '总览',
      items: [{ path: '/dashboard', icon: 'House', label: '首页总览' }]
    },
    {
      label: '住宿管理',
      items: [
        { path: '/room-status', icon: 'OfficeBuilding', label: '客房状态' },
        { path: '/checkins', icon: 'User', label: '入住管理' },
        { path: '/reservations', icon: 'Calendar', label: '预订管理' },
        ...(role === 'admin' ? [{ path: '/hotel-rooms', icon: 'Setting', label: '客房配置' }] : []),
      ]
    },
    {
      label: '餐饮管理',
      items: [
        { path: '/dining', icon: 'Fork', label: '餐厅管理' },
        ...(['admin', 'cashier'].includes(role) ? [{ path: '/dishes', icon: 'Bowl', label: '菜品管理' }] : []),
      ]
    },
    {
      label: '商品零售',
      items: [
        { path: '/retail', icon: 'ShoppingCart', label: '零售收银' },
        ...(role === 'admin' ? [{ path: '/products', icon: 'Goods', label: '商品管理' }] : []),
      ]
    },
    {
      label: '报表管理',
      items: [
        { path: '/orders', icon: 'List', label: '订单查询' },
        { path: '/stats', icon: 'DataAnalysis', label: '营业报表' },
      ]
    },
    {
      label: '系统',
      items: [
        ...(role === 'admin' ? [
          { path: '/users', icon: 'Avatar', label: '用户管理' },
          { path: '/settings', icon: 'Tools', label: '系统设置' },
        ] : [])
      ]
    }
  ]
  return groups.filter(g => g.items.length > 0)
})

// ── 时钟 & 健康检查 ──────────────────────────────
const currentTime = ref('')
const serverOk = ref(true)
let clockTimer, healthTimer

function updateTime() { currentTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss') }
async function checkHealth() {
  try { await http.get('/health'); serverOk.value = true } catch { serverOk.value = false }
}

// ── 密码修改 ─────────────────────────────────────
const pwdVisible = ref(false)
const pwdForm = ref({ old: '', new1: '', new2: '' })

async function changePwd() {
  if (!pwdForm.value.old || !pwdForm.value.new1) return ElMessage.warning('请填写完整')
  if (pwdForm.value.new1 !== pwdForm.value.new2) return ElMessage.error('两次密码不一致')
  await authApi.changePassword(pwdForm.value.old, pwdForm.value.new1)
  ElMessage.success('密码修改成功，请重新登录')
  pwdVisible.value = false
  userStore.logout()
}

function handleCmd(cmd) {
  if (cmd === 'pwd') { pwdForm.value = { old: '', new1: '', new2: '' }; pwdVisible.value = true }
  if (cmd === 'logout') userStore.logout()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  updateTime(); clockTimer = setInterval(updateTime, 1000)
  checkHealth(); healthTimer = setInterval(checkHealth, 30000)
  loadSettings()
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  clearInterval(clockTimer); clearInterval(healthTimer)
})
</script>

<style scoped>
.layout { display: flex; height: 100vh; overflow: hidden; background: var(--content-bg); }
.mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 99; }

.sidebar {
  width: 220px; min-width: 220px; background: var(--sidebar-bg); color: var(--sidebar-text);
  display: flex; flex-direction: column; transition: width 0.25s; z-index: 100; overflow: hidden;
  flex-shrink: 0;
}
.sidebar-header {
  padding: 16px; display: flex; align-items: center; gap: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.07); min-height: 64px;
}
.logo { width: 32px; height: 32px; object-fit: contain; flex-shrink: 0; }
.logo-text { font-size: 24px; flex-shrink: 0; }
.hotel-name { font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; }

.sidebar-nav { flex: 1; overflow-y: auto; padding: 8px 0; }
.nav-group-label { font-size: 11px; color: rgba(255,255,255,0.35); padding: 12px 16px 4px; letter-spacing: 1px; text-transform: uppercase; }
.nav-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 16px;
  color: var(--sidebar-text); text-decoration: none; font-size: 14px;
  transition: all 0.2s; cursor: pointer; white-space: nowrap;
}
.nav-item:hover { background: rgba(255,255,255,0.08); color: #fff; }
.nav-item.active { background: var(--sidebar-active-bg); color: var(--sidebar-active-text); }
.nav-item .el-icon { font-size: 16px; flex-shrink: 0; }

.sidebar-footer { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.07); font-size: 12px; }
.time { color: rgba(255,255,255,0.5); margin-bottom: 4px; }
.server-status { display: flex; align-items: center; gap: 4px; }
.server-status.ok { color: #52c41a; }
.server-status.err { color: #ff4d4f; }

/* 折叠状态 */
.sidebar-collapsed .sidebar { width: 56px !important; min-width: 56px; }
.sidebar-collapsed .sidebar-header { justify-content: center; }
.sidebar-collapsed .nav-group-label { display: none; }
.sidebar-collapsed .nav-item { justify-content: center; padding: 10px 0; }

.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.topbar {
  height: 56px; background: #fff; display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); flex-shrink: 0; z-index: 10;
}
.topbar-left { display: flex; align-items: center; gap: 12px; }
.menu-btn { font-size: 20px; cursor: pointer; color: #666; }
.menu-btn:hover { color: var(--primary); }
.page-title { font-size: 16px; font-weight: 600; color: #333; }
.topbar-right { display: flex; align-items: center; gap: 16px; }
.user-info { display: flex; align-items: center; gap: 6px; cursor: pointer; color: #333; font-size: 14px; }

.content { flex: 1; overflow-y: auto; padding: 20px; }

@media (max-width: 768px) {
  .sidebar {
    position: fixed; left: -260px; top: 0; bottom: 0;
    transition: left 0.3s;
  }
  .sidebar.visible { left: 0 !important; }
  .sidebar-collapsed .sidebar { left: -260px; }
  .content { padding: 12px; }
}
</style>
