<template>
  <div class="reservations-page">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button type="primary" size="small" @click="openDialog()"><el-icon><Plus /></el-icon> 新增预订</el-button>
        <el-input v-model="search" placeholder="搜索姓名/单号" size="small" clearable style="width:180px" @input="loadData" />
        <el-select v-model="filterStatus" size="small" placeholder="状态" clearable style="width:110px" @change="loadData">
          <el-option label="待确认" value="pending" />
          <el-option label="已确认" value="confirmed" />
          <el-option label="已入住" value="checked_in" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        <el-date-picker v-model="filterDate" type="date" placeholder="入住日期" size="small" format="YYYY-MM-DD" value-format="YYYY-MM-DD" clearable style="width:140px" @change="loadData" />
      </div>
      <el-button size="small" @click="loadData"><el-icon><Refresh /></el-icon></el-button>
    </div>

    <el-table :data="list" stripe size="small" v-loading="loading">
      <el-table-column prop="reservation_no" label="预订单号" width="160" />
      <el-table-column prop="guest_name" label="姓名" width="90" />
      <el-table-column prop="guest_phone" label="电话" width="120" />
      <el-table-column prop="type_name" label="房型" width="110" />
      <el-table-column prop="room_no" label="房间" width="80" />
      <el-table-column prop="checkin_date" label="入住日期" width="110" />
      <el-table-column prop="checkout_date" label="退房日期" width="110" />
      <el-table-column prop="nights" label="间夜" width="60" />
      <el-table-column prop="guest_count" label="人数" width="60" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="resStatusType(row.status)" size="small">{{ resStatusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'pending'" size="small" type="success" @click="confirmRes(row)">确认</el-button>
          <el-button v-if="row.status === 'confirmed'" size="small" type="primary" @click="doCheckin(row)">入住</el-button>
          <el-button v-if="['pending','confirmed'].includes(row.status)" size="small" type="danger" plain @click="cancelRes(row)">取消</el-button>
          <el-button size="small" @click="editRes(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total, sizes, prev, pager, next" :page-sizes="[15,30,50]" style="margin-top:12px" @change="loadData" />

    <!-- 新增/编辑预订弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editId ? '编辑预订' : '新增预订'" width="560px" :fullscreen="isMobile">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="90px" size="small">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="姓名" prop="guest_name"><el-input v-model="form.guest_name" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="电话" prop="guest_phone"><el-input v-model="form.guest_phone" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="证件号"><el-input v-model="form.guest_id_no" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="人数"><el-input-number v-model="form.guest_count" :min="1" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="房型">
              <el-select v-model="form.room_type_id" placeholder="选择房型" style="width:100%">
                <el-option v-for="t in roomTypes" :key="t.id" :label="t.name" :value="t.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="指定房间">
              <el-select v-model="form.room_id" placeholder="可选" clearable style="width:100%">
                <el-option v-for="r in vacantRooms" :key="r.id" :label="`${r.room_no}`" :value="r.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入住日期" prop="checkin_date">
              <el-date-picker v-model="form.checkin_date" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="退房日期" prop="checkout_date">
              <el-date-picker v-model="form.checkout_date" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="押金">
              <el-input-number v-model="form.deposit" :min="0" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRes" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { reservationApi, hotelRoomApi } from '@/api/index'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

const router = useRouter()
const isMobile = ref(window.innerWidth <= 768)
const loading = ref(false), submitting = ref(false)
const list = ref([]), total = ref(0), page = ref(1), pageSize = ref(15)
const search = ref(''), filterStatus = ref(''), filterDate = ref('')
const dialogVisible = ref(false), editId = ref(null)
const roomTypes = ref([]), vacantRooms = ref([])
const formRef = ref()
const form = ref({ guest_name: '', guest_phone: '', guest_id_no: '', guest_count: 1, room_type_id: null, room_id: null, checkin_date: '', checkout_date: '', nights: 1, deposit: 0, remark: '' })
const rules = {
  guest_name: [{ required: true, message: '请输入姓名' }],
  checkin_date: [{ required: true, message: '请选择入住日期' }],
  checkout_date: [{ required: true, message: '请选择退房日期' }],
}

function resStatusLabel(s) { return { pending: '待确认', confirmed: '已确认', checked_in: '已入住', cancelled: '已取消' }[s] || s }
function resStatusType(s) { return { pending: 'warning', confirmed: 'success', checked_in: 'primary', cancelled: 'info' }[s] || '' }

async function loadData() {
  loading.value = true
  try {
    const res = await reservationApi.getList({ page: page.value, pageSize: pageSize.value, search: search.value, status: filterStatus.value, checkin_date: filterDate.value })
    list.value = res.list || []
    total.value = res.total || 0
  } catch {} finally { loading.value = false }
}

async function openDialog() {
  editId.value = null
  form.value = { guest_name: '', guest_phone: '', guest_id_no: '', guest_count: 1, room_type_id: null, room_id: null, checkin_date: dayjs().add(1, 'day').format('YYYY-MM-DD'), checkout_date: dayjs().add(2, 'day').format('YYYY-MM-DD'), nights: 1, deposit: 0, remark: '' }
  roomTypes.value = (await hotelRoomApi.getTypes()) || []
  vacantRooms.value = (await hotelRoomApi.getAll({ status: 'vacant' })) || []
  dialogVisible.value = true
}

function editRes(row) {
  editId.value = row.id
  form.value = { ...row }
  dialogVisible.value = true
  hotelRoomApi.getTypes().then(d => { roomTypes.value = d || [] })
  hotelRoomApi.getAll({ status: 'vacant' }).then(d => { vacantRooms.value = d || [] })
}

async function submitRes() {
  await formRef.value.validate()
  submitting.value = true
  try {
    if (editId.value) await reservationApi.update(editId.value, form.value)
    else await reservationApi.create(form.value)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadData()
  } catch {} finally { submitting.value = false }
}

async function confirmRes(row) {
  await reservationApi.confirm(row.id)
  ElMessage.success('已确认预订')
  loadData()
}

async function cancelRes(row) {
  await ElMessageBox.confirm('确认取消该预订？', '提示', { type: 'warning' })
  await reservationApi.cancel(row.id)
  ElMessage.success('已取消')
  loadData()
}

function doCheckin(row) {
  router.push(`/checkins?room_id=${row.room_id || ''}&res_id=${row.id}&guest_name=${row.guest_name}&guest_phone=${row.guest_phone || ''}`)
}

onMounted(loadData)
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.toolbar-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
</style>
