<template>
  <div class="users-page">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button type="primary" size="small" @click="openDialog()"><el-icon><Plus /></el-icon> 新增用户</el-button>
        <el-input v-model="search" placeholder="搜索用户名/姓名" size="small" clearable style="width:180px" @input="loadData" />
        <el-select v-model="filterRole" size="small" placeholder="角色" clearable style="width:100px" @change="loadData">
          <el-option label="管理员" value="admin" />
          <el-option label="前台" value="front_desk" />
          <el-option label="收银员" value="cashier" />
          <el-option label="服务员" value="waiter" />
        </el-select>
      </div>
      <el-button size="small" @click="loadData"><el-icon><Refresh /></el-icon></el-button>
    </div>

    <el-table :data="list" stripe size="small" v-loading="loading">
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
          <el-button size="small" type="danger" plain @click="deleteUser(row)" :disabled="row.username === 'admin'">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑用户 -->
    <el-dialog v-model="dialogVisible" :title="editId ? '编辑用户' : '新增用户'" width="420px" :fullscreen="isMobile">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px" size="small">
        <el-form-item label="账号" prop="username"><el-input v-model="form.username" :disabled="!!editId" /></el-form-item>
        <el-form-item v-if="!editId" label="密码" prop="password"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item label="姓名" prop="realname"><el-input v-model="form.realname" /></el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width:100%">
            <el-option label="系统管理员" value="admin" />
            <el-option label="前台接待" value="front_desk" />
            <el-option label="收银员" value="cashier" />
            <el-option label="服务员" value="waiter" />
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
        <el-button type="primary" @click="submitUser" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="resetPwdVisible" title="重置密码" width="360px">
      <el-form :model="pwdForm" label-width="80px" size="small">
        <div style="margin-bottom:12px;color:#666">重置用户 <b>{{ resetTarget?.realname }}</b> 的密码：</div>
        <el-form-item label="新密码"><el-input v-model="pwdForm.newPwd" type="password" show-password /></el-form-item>
        <el-form-item label="确认密码"><el-input v-model="pwdForm.confirmPwd" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPwdVisible = false">取消</el-button>
        <el-button type="primary" @click="submitResetPwd" :loading="submitting">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import http from '@/api/http'

const isMobile = ref(window.innerWidth <= 768)
const loading = ref(false), submitting = ref(false)
const list = ref([]), search = ref(''), filterRole = ref('')
const dialogVisible = ref(false), editId = ref(null)
const resetPwdVisible = ref(false), resetTarget = ref(null)
const formRef = ref()
const form = ref({ username: '', password: '', realname: '', role: 'cashier', status: 'active' })
const pwdForm = ref({ newPwd: '', confirmPwd: '' })
const rules = {
  username: [{ required: true, message: '请输入账号' }],
  password: [{ required: true, message: '请输入密码' }],
  realname: [{ required: true, message: '请输入姓名' }],
  role: [{ required: true, message: '请选择角色' }],
}

function roleLabel(r) { return { admin: '管理员', front_desk: '前台', cashier: '收银员', waiter: '服务员' }[r] || r }
function roleType(r) { return { admin: 'danger', front_desk: 'primary', cashier: 'warning', waiter: '' }[r] || 'info' }

async function loadData() {
  loading.value = true
  try {
    const res = await http.get('/auth/users', { params: { search: search.value, role: filterRole.value } })
    list.value = res.list || res || []
  } catch {} finally { loading.value = false }
}

function openDialog(row) {
  editId.value = row ? row.id : null
  form.value = row ? { ...row, password: '' } : { username: '', password: '', realname: '', role: 'cashier', status: 'active' }
  dialogVisible.value = true
}
async function submitUser() {
  await formRef.value.validate()
  submitting.value = true
  try {
    if (editId.value) await http.put(`/auth/users/${editId.value}`, form.value)
    else await http.post('/auth/users', form.value)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadData()
  } catch {} finally { submitting.value = false }
}
async function deleteUser(row) {
  await ElMessageBox.confirm(`确认删除用户「${row.realname}」？`, '警告', { type: 'warning' })
  await http.delete(`/auth/users/${row.id}`)
  ElMessage.success('已删除')
  loadData()
}

function openResetPwd(row) {
  resetTarget.value = row
  pwdForm.value = { newPwd: '', confirmPwd: '' }
  resetPwdVisible.value = true
}
async function submitResetPwd() {
  if (!pwdForm.value.newPwd) return ElMessage.warning('请输入密码')
  if (pwdForm.value.newPwd !== pwdForm.value.confirmPwd) return ElMessage.error('两次密码不一致')
  submitting.value = true
  try {
    await http.put(`/auth/users/${resetTarget.value.id}/password`, { newPassword: pwdForm.value.newPwd })
    ElMessage.success('密码已重置')
    resetPwdVisible.value = false
  } catch {} finally { submitting.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.toolbar-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
</style>
