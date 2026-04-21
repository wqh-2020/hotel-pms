<template>
  <div class="users-page">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button type="primary" size="small" @click="openDialog()"><el-icon><Plus /></el-icon> 新增用户</el-button>
        <el-button type="success" size="small" @click="showPermPanel = true"><el-icon><Setting /></el-icon> 权限配置</el-button>
        <el-input v-model="search" placeholder="搜索" size="small" clearable style="width:160px" @input="loadData" />
        <el-select v-model="filterRole" size="small" placeholder="角色" clearable style="width:100px" @change="loadData">
          <el-option v-for="r in allRoles" :key="r.code" :label="r.name" :value="r.code" />
        </el-select>
      </div>
      <el-button size="small" @click="loadData"><el-icon><Refresh /></el-icon></el-button>
    </div>

    <el-table :data="list" stripe size="small" v-loading="loading">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="username" label="账号" width="120" />
      <el-table-column prop="realname" label="姓名" width="100" />
      <el-table-column prop="role" label="角色" width="100">
        <template #default="{row}">
          <el-tag :type="roleType(row.role)" size="small">{{ roleLabel(row.role) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{row}">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">{{ row.status === 'active' ? '正常' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="160" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{row}">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="warning" @click="openResetPwd(row)">重置密码</el-button>
          <el-popconfirm title="确定删除？" @confirm="deleteUser(row)" :disabled="row.username === 'admin'">
            <template #reference>
              <el-button size="small" type="danger" plain :disabled="row.username === 'admin'">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑用户 -->
    <el-dialog v-model="dialogVisible" :title="editId ? '编辑用户' : '新增用户'" width="440px" :fullscreen="isMobile" destroy-on-close>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px" size="default">
        <el-form-item label="账号" prop="username">
          <el-input v-model="form.username" :disabled="!!editId" placeholder="登录用户名" />
        </el-form-item>
        <el-form-item v-if="!editId" label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="初始密码（至少4位）" />
        </el-form-item>
        <el-form-item label="姓名" prop="realname">
          <el-input v-model="form.realname" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width:100%">
            <el-option v-for="r in allRoles" :key="r.code" :label="r.name" :value="r.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="active">正常</el-radio>
            <el-radio value="disabled">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitUser" :loading="submitting">{{ editId ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="resetPwdVisible" title="重置密码" width="360px" destroy-on-close>
      <el-form :model="pwdForm" label-width="80px" size="default">
        <div style="margin-bottom:12px;color:#666">重置用户 <b>{{ resetTarget?.realname }}</b> 的密码：</div>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPwd" type="password" show-password placeholder="至少4位" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="pwdForm.confirmPwd" type="password" show-password placeholder="再次输入" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPwdVisible = false">取消</el-button>
        <el-button type="primary" @click="submitResetPwd" :loading="submitting">确认重置</el-button>
      </template>
    </el-dialog>

    <!-- ========== 权限配置抽屉 ========== -->
    <el-drawer
      v-model="showPermPanel"
      title="权限配置"
      direction="rtl"
      size="700px"
      destroy-on-close
    >
      <div class="perm-panel" v-loading="permLoading">
        <!-- 角色标签页 -->
        <el-tabs v-model="activeRoleTab" type="border-card" @tab-change="onRoleTabChange">
          <el-tab-pane
            v-for="role in allRoles"
            :key="role.code"
            :label="`${role.name} (${role.perm_count || 0})`"
            :name="role.code"
          >
            <div class="perm-content">
              <div class="perm-summary">
                <span>当前角色：<strong>{{ role.name }}</strong> ({{ role.code }})</span>
                <el-button
                  type="primary"
                  size="small"
                  :loading="permSaving && savingRoleCode === role.code"
                  :disabled="role.code === 'admin'"
                  @click="saveRolePermissions(role.code)"
                >保存权限</el-button>
              </div>
              <p class="perm-tip" v-if="role.code === 'admin'">管理员拥有所有权限，不可修改</p>
              <p class="perm-tip" v-else>勾选/取消勾选该角色拥有的功能权限，保存后立即生效</p>

              <!-- 按分类显示权限 -->
              <div
                v-for="(perms, category) in groupedPermissions"
                :key="category"
                class="perm-category"
              >
                <h4 class="cat-title">{{ categoryLabels[category] || category }}</h4>
                <div class="perm-grid">
                  <el-checkbox
                    v-for="perm in perms"
                    :key="perm.id"
                    :model-value="selectedPerms.includes(perm.code)"
                    :disabled="role.code === 'admin'"
                    @change="(val) => togglePermission(perm.code, val)"
                    class="perm-item"
                  >
                    {{ perm.name }}
                    <span class="perm-desc" v-if="perm.description">{{ perm.description }}</span>
                  </el-checkbox>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Setting } from '@element-plus/icons-vue'
import { authApi } from '@/api/auth'

const isMobile = ref(window.innerWidth <= 768)
const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const search = ref('')
const filterRole = ref('')
const dialogVisible = ref(false)
const editId = ref(null)
const resetPwdVisible = ref(false)
const resetTarget = ref(null)
const formRef = ref()
const form = ref({ username: '', password: '', realname: '', role: 'cashier', status: 'active' })
const pwdForm = ref({ newPwd: '', confirmPwd: '' })

const rules = {
  username: [{ required: true, message: '请输入账号' }],
  password: [{ required: true, message: '请输入密码' }],
  realname: [{ required: true, message: '请输入姓名' }],
  role: [{ required: true, message: '请选择角色' }],
}

// ── 角色映射 ──────────────────────────────────────────────
const roleMap = { admin: '管理员', regular_admin: '普通管理员', front_desk: '前台', cashier: '收银员', waiter: '服务员' }
const roleTypeMap = { admin: 'danger', regular_admin: 'warning', front_desk: 'primary', cashier: 'warning', waiter: '' }
function roleLabel(r) { return roleMap[r] || r }
function roleType(r) { return roleTypeMap[r] || 'info' }

// ── 用户列表 ──────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    const res = await authApi.getUsers()
    let data = Array.isArray(res) ? res : (res.data || [])
    if (search.value) data = data.filter(u => u.username.includes(search.value) || (u.realname || '').includes(search.value))
    if (filterRole.value) data = data.filter(u => u.role === filterRole.value)
    list.value = data
  } catch {} finally { loading.value = false }
}

function openDialog(row) {
  editId.value = row ? row.id : null
  form.value = row
    ? { ...row, password: '' }
    : { username: '', password: '', realname: '', role: 'cashier', status: 'active' }
  dialogVisible.value = true
}

async function submitUser() {
  await formRef.value.validate()
  submitting.value = true
  try {
    if (editId.value) {
      await authApi.updateUser(editId.value, form.value)
      ElMessage.success('更新成功')
    } else {
      await authApi.createUser(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch {} finally { submitting.value = false }
}

async function deleteUser(row) {
  try {
    await authApi.deleteUser(row.id)
    ElMessage.success('已删除')
    loadData()
  } catch {}
}

function openResetPwd(row) {
  resetTarget.value = row
  pwdForm.value = { newPwd: '', confirmPwd: '' }
  resetPwdVisible.value = true
}

async function submitResetPwd() {
  if (!pwdForm.value.newPwd) return ElMessage.warning('请输入密码')
  if (pwdForm.value.newPwd.length < 4) return ElMessage.warning('密码至少4位')
  if (pwdForm.value.newPwd !== pwdForm.value.confirmPwd) return ElMessage.error('两次密码不一致')
  submitting.value = true
  try {
    await authApi.resetPassword(resetTarget.value.id, pwdForm.value.newPwd)
    ElMessage.success('密码已重置')
    resetPwdVisible.value = false
  } catch {} finally { submitting.value = false }
}

// ── 权限配置 ──────────────────────────────────────────────
const allRoles = ref([])
const allPermissions = ref([])
const selectedPerms = ref([])
const showPermPanel = ref(false)
const activeRoleTab = ref('')
const permLoading = ref(false)
const permSaving = ref(false)
const savingRoleCode = ref('')

const categoryLabels = {
  accommodation: '住宿管理',
  dining: '餐饮管理',
  retail: '商品零售',
  stats: '报表统计',
  system: '系统管理',
}

const groupedPermissions = computed(() => {
  const groups = {}
  for (const perm of allPermissions.value) {
    const cat = perm.category || 'other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(perm)
  }
  return groups
})

async function fetchRoles() {
  try {
    const res = await authApi.getRoles()
    allRoles.value = res.data || res || []
    if (allRoles.value.length && !activeRoleTab.value) {
      activeRoleTab.value = allRoles.value[0].code
    }
  } catch {}
}

async function fetchPermissions() {
  try {
    const res = await authApi.getPermissions()
    allPermissions.value = res.data || res || []
  } catch {}
}

async function fetchRolePermissions(roleCode) {
  permLoading.value = true
  try {
    const res = await authApi.getRolePermissions(roleCode)
    selectedPerms.value = res.data?.permissions || res?.data?.permissions || []
  } catch {} finally { permLoading.value = false }
}

function onRoleTabChange(tabName) {
  fetchRolePermissions(tabName)
}

function togglePermission(code, val) {
  if (val) {
    if (!selectedPerms.value.includes(code)) selectedPerms.value.push(code)
  } else {
    selectedPerms.value = selectedPerms.value.filter(c => c !== code)
  }
}

async function saveRolePermissions(roleCode) {
  permSaving.value = true
  savingRoleCode.value = roleCode
  try {
    await authApi.updateRolePermissions(roleCode, [...selectedPerms.value])
    ElMessage.success(`${roleLabel(roleCode)} 的权限已更新`)
    fetchRoles()
  } catch {} finally {
    permSaving.value = false
    savingRoleCode.value = ''
  }
}

onMounted(async () => {
  loadData()
  await Promise.all([fetchRoles(), fetchPermissions()])
  if (activeRoleTab.value) fetchRolePermissions(activeRoleTab.value)
})
</script>

<style scoped>
.users-page { display: flex; flex-direction: column; gap: 12px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.toolbar-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* ── 权限配置面板 ── */
.perm-panel { height: 100%; }
.perm-content { padding-top: 8px; }
.perm-summary { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.perm-tip { color: #909399; font-size: 13px; margin: 0 0 14px 0; }

.perm-category { margin-bottom: 18px; border: 1px solid #f0f0f0; border-radius: 6px; padding: 12px; background: #fafafa; }
.cat-title { font-size: 13px; color: #303133; margin: 0 0 10px 0; padding-bottom: 8px; border-bottom: 1px solid #eee; font-weight: 600; }
.perm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.perm-item { white-space: nowrap; margin-right: 0 !important; }
.perm-desc { display: block; font-size: 11px; color: #b0b0b0; margin-left: 2px; }

@media (max-width: 640px) {
  .perm-grid { grid-template-columns: 1fr; }
}
</style>
