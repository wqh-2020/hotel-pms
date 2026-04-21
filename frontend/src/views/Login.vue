<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">
          <img v-if="logoUrl" :src="logoUrl" alt="logo" class="logo-img" />
          <span v-else>🏨</span>
        </div>
        <h1>{{ hotelName }}</h1>
        <p>酒店管理系统</p>
      </div>
      <el-form :model="form" @submit.prevent="handleLogin" label-width="0">
        <el-form-item>
          <el-input v-model="form.username" placeholder="请输入账号" size="large" prefix-icon="User" clearable />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" placeholder="请输入密码" size="large" type="password"
            prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-button type="primary" size="large" style="width:100%" :loading="loading" @click="handleLogin">
          登 录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { settingsApi } from '@/api/index'
import { ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const hotelName = ref('聚云酒店管理系统')
const logoUrl = ref('')
const form = ref({ username: '', password: '' })

onMounted(async () => {
  if (userStore.isLoggedIn) { router.push('/dashboard'); return }
  try {
    const data = await settingsApi.getAll()
    if (data.hotel_name) hotelName.value = data.hotel_name
    if (data.logo_url) logoUrl.value = data.logo_url
  } catch {}
})

async function handleLogin() {
  if (!form.value.username || !form.value.password) return ElMessage.warning('请输入账号密码')
  loading.value = true
  try {
    await userStore.login(form.value.username, form.value.password)
    router.push('/dashboard')
  } catch {} finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1a3c5e 0%, #1890ff 100%);
}
.login-card {
  background: #fff; border-radius: 12px; padding: 40px 40px 32px;
  width: 100%; max-width: 380px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}
.login-header { text-align: center; margin-bottom: 32px; }
.logo { font-size: 48px; margin-bottom: 12px; }
.logo-img { width: 72px; height: 72px; object-fit: contain; border-radius: 8px; }
h1 { font-size: 22px; color: #1a1a1a; margin-bottom: 4px; }
p { color: #999; font-size: 14px; }

</style>
