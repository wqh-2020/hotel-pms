<template>
  <div class="settings-page">
    <el-tabs v-model="activeTab" tab-position="left" style="min-height:500px">
      <!-- 基本设置 -->
      <el-tab-pane label="基本设置" name="basic">
        <div class="setting-section">
          <h3 class="section-title">酒店信息</h3>
          <el-form :model="basicForm" label-width="110px" size="default" style="max-width:520px">
            <el-form-item label="酒店名称">
              <el-input v-model="basicForm.hotel_name" placeholder="请输入酒店名称" />
            </el-form-item>
            <el-form-item label="联系电话">
              <el-input v-model="basicForm.phone" placeholder="前台联系电话" />
            </el-form-item>
            <el-form-item label="酒店地址">
              <el-input v-model="basicForm.address" type="textarea" :rows="2" placeholder="酒店详细地址" />
            </el-form-item>
            <el-form-item label="酒店Logo">
              <div class="logo-upload">
                <el-image v-if="logoPreview" :src="logoPreview" style="width:80px;height:80px;border-radius:8px;object-fit:contain;border:1px solid #eee" fit="contain" />
                <div v-else class="logo-placeholder">🏨</div>
                <div class="logo-actions">
                  <el-upload :show-file-list="false" accept="image/*" :before-upload="uploadLogo">
                    <el-button size="small" type="primary" plain>上传Logo</el-button>
                  </el-upload>
                  <el-button v-if="logoPreview" size="small" type="danger" plain @click="deleteLogo">删除</el-button>
                </div>
              </div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveBasic" :loading="saving">保存设置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 外观主题 -->
      <el-tab-pane label="外观主题" name="theme">
        <div class="setting-section">
          <h3 class="section-title">主题设置</h3>
          <el-form :model="themeForm" label-width="110px" size="default" style="max-width:520px">
            <el-form-item label="主题模式">
              <el-radio-group v-model="themeForm.theme" @change="applyTheme">
                <el-radio-button value="light">浅色</el-radio-button>
                <el-radio-button value="dark">深色</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="主题色">
              <div class="color-presets">
                <div
                  v-for="c in colorPresets"
                  :key="c"
                  class="color-swatch"
                  :style="{ background: c, outline: themeForm.theme_color === c ? `3px solid ${c}` : 'none' }"
                  @click="themeForm.theme_color = c; applyColor(c)"
                ></div>
                <el-color-picker v-model="themeForm.theme_color" @change="applyColor" />
              </div>
            </el-form-item>
            <el-form-item label="侧边栏宽度">
              <el-slider v-model="themeForm.sidebar_width" :min="180" :max="280" :step="10" style="width:200px" @change="saveSidebarWidth" />
              <span style="margin-left:10px;color:#888">{{ themeForm.sidebar_width }}px</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveTheme" :loading="saving">保存主题</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 收款设置 -->
      <el-tab-pane label="收款设置" name="payment">
        <div class="setting-section">
          <h3 class="section-title">支付方式</h3>
          <el-form :model="payForm" label-width="110px" size="default" style="max-width:520px">
            <el-form-item label="启用现金">
              <el-switch v-model="payForm.pay_cash" active-value="1" inactive-value="0" />
            </el-form-item>
            <el-form-item label="启用微信">
              <el-switch v-model="payForm.pay_wechat" active-value="1" inactive-value="0" />
            </el-form-item>
            <el-form-item label="启用支付宝">
              <el-switch v-model="payForm.pay_alipay" active-value="1" inactive-value="0" />
            </el-form-item>
            <el-form-item label="启用银行卡">
              <el-switch v-model="payForm.pay_card" active-value="1" inactive-value="0" />
            </el-form-item>
            <el-form-item label="默认优惠率">
              <el-input-number v-model="payForm.default_discount_rate" :min="0" :max="100" style="width:120px" />
              <span style="margin-left:8px;color:#888">%（0 = 不优惠）</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="savePayment" :loading="saving">保存</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 数据备份 -->
      <el-tab-pane label="数据备份" name="backup">
        <div class="setting-section">
          <h3 class="section-title">数据管理</h3>
          <el-alert type="warning" show-icon :closable="false" style="margin-bottom:20px">
            <template #title>建议定期备份数据，以防数据丢失。备份文件可用于日后恢复。</template>
          </el-alert>
          <el-button type="primary" @click="downloadBackup" :loading="backingUp">
            <el-icon><Download /></el-icon> 下载数据备份 (JSON)
          </el-button>
          <div class="divider-line"></div>
          <h3 class="section-title">关于系统</h3>
          <el-descriptions :column="1" border size="small" style="max-width:400px">
            <el-descriptions-item label="系统名称">聚云酒店管理系统</el-descriptions-item>
            <el-descriptions-item label="版本">v1.0.0</el-descriptions-item>
            <el-descriptions-item label="技术栈">Vue 3 + Vite + Electron + Express + SQLite</el-descriptions-item>
            <el-descriptions-item label="数据库">node:sqlite（本地嵌入式）</el-descriptions-item>
          </el-descriptions>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { settingsApi } from '@/api/index'
import { ElMessage } from 'element-plus'

const activeTab = ref('basic')
const saving = ref(false), backingUp = ref(false)
const logoPreview = ref('')

const colorPresets = ['#1890ff', '#52c41a', '#722ed1', '#eb2f96', '#fa8c16', '#fa541c', '#13c2c2', '#2f54eb']

const basicForm = ref({ hotel_name: '', phone: '', address: '' })
const themeForm = ref({ theme: 'light', theme_color: '#1890ff', sidebar_width: 220 })
const payForm = ref({ pay_cash: '1', pay_wechat: '1', pay_alipay: '1', pay_card: '1', default_discount_rate: 0 })

async function loadSettings() {
  try {
    const data = await settingsApi.getAll()
    basicForm.value.hotel_name = data.hotel_name || ''
    basicForm.value.phone = data.phone || ''
    basicForm.value.address = data.address || ''
    logoPreview.value = data.logo_url || ''
    themeForm.value.theme = data.theme || 'light'
    themeForm.value.theme_color = data.theme_color || '#1890ff'
    themeForm.value.sidebar_width = Number(data.sidebar_width || 220)
    payForm.value.pay_cash = data.pay_cash ?? '1'
    payForm.value.pay_wechat = data.pay_wechat ?? '1'
    payForm.value.pay_alipay = data.pay_alipay ?? '1'
    payForm.value.pay_card = data.pay_card ?? '1'
    payForm.value.default_discount_rate = Number(data.default_discount_rate || 0)
  } catch {}
}

async function saveBasic() {
  saving.value = true
  try {
    for (const [k, v] of Object.entries(basicForm.value)) {
      await settingsApi.update(k, v)
    }
    ElMessage.success('基本设置已保存')
    document.title = basicForm.value.hotel_name || '聚云酒店管理系统'
  } catch {} finally { saving.value = false }
}

async function saveTheme() {
  saving.value = true
  try {
    for (const [k, v] of Object.entries(themeForm.value)) {
      await settingsApi.update(k, String(v))
    }
    applyTheme(themeForm.value.theme)
    applyColor(themeForm.value.theme_color)
    ElMessage.success('主题已保存')
  } catch {} finally { saving.value = false }
}

async function savePayment() {
  saving.value = true
  try {
    for (const [k, v] of Object.entries(payForm.value)) {
      await settingsApi.update(k, String(v))
    }
    ElMessage.success('收款设置已保存')
  } catch {} finally { saving.value = false }
}

function applyTheme(t) {
  if (t === 'dark') document.body.classList.add('dark')
  else document.body.classList.remove('dark')
}

function applyColor(c) {
  document.documentElement.style.setProperty('--primary', c)
  document.documentElement.style.setProperty('--sidebar-active-bg', c)
}

function saveSidebarWidth() {}

async function uploadLogo(file) {
  try {
    const res = await settingsApi.uploadLogo(file)
    logoPreview.value = res.url
    ElMessage.success('Logo上传成功')
  } catch {}
  return false
}

async function deleteLogo() {
  await settingsApi.deleteLogo()
  logoPreview.value = ''
  ElMessage.success('Logo已删除')
}

async function downloadBackup() {
  backingUp.value = true
  try {
    const blob = await settingsApi.backup()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hotel-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch {} finally { backingUp.value = false }
}

onMounted(loadSettings)
</script>

<style scoped>
.settings-page { background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); min-height: calc(100vh - 120px); }
.setting-section { padding: 0 20px; }
.section-title { font-size: 15px; font-weight: 600; color: #1a1a1a; margin-bottom: 18px; padding-bottom: 8px; border-bottom: 2px solid var(--primary); display: inline-block; }
.logo-upload { display: flex; align-items: center; gap: 16px; }
.logo-placeholder { width: 80px; height: 80px; border-radius: 8px; background: #f5f5f5; display: flex; align-items: center; justify-content: center; font-size: 36px; border: 1px dashed #d9d9d9; }
.logo-actions { display: flex; flex-direction: column; gap: 8px; }
.color-presets { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.color-swatch { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; outline-offset: 3px; transition: transform 0.2s; }
.color-swatch:hover { transform: scale(1.15); }
.divider-line { border-top: 1px solid #f0f0f0; margin: 24px 0; }
</style>
