<template>
  <div class="checkins-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button type="primary" size="small" @click="openDialog()">
          <el-icon><Plus /></el-icon> 办理入住
        </el-button>
        <el-input v-model="search" placeholder="搜索姓名/房号/单号" size="small" clearable style="width:200px" @input="loadData" />
        <el-select v-model="filterStatus" size="small" placeholder="状态" clearable style="width:100px" @change="loadData">
          <el-option label="在住" value="checked_in" />
          <el-option label="已退房" value="checked_out" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button size="small" @click="loadData"><el-icon><Refresh /></el-icon></el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table :data="list" stripe size="small" v-loading="loading" @row-click="showDetail">
      <el-table-column prop="checkin_no" label="单号" width="160" />
      <el-table-column prop="room_no" label="房间" width="80" />
      <el-table-column prop="type_name" label="房型" width="100" />
      <el-table-column prop="guest_name" label="姓名" width="90" />
      <el-table-column prop="guest_phone" label="电话" width="120" />
      <el-table-column prop="checkin_date" label="入住日期" width="110" />
      <el-table-column prop="expected_checkout" label="预计退房" width="110" />
      <el-table-column prop="nights" label="间夜" width="60" />
      <el-table-column label="实收" width="90">
        <template #default="{ row }">¥{{ row.pay_amount }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'checked_in'" size="small" type="warning" @click.stop="openCheckout(row)">退房</el-button>
          <el-button size="small" @click.stop="showDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="page" v-model:page-size="pageSize"
      :total="total" :page-sizes="[15, 30, 50]"
      layout="total, sizes, prev, pager, next"
      style="margin-top:12px" @change="loadData"
    />

    <!-- 入住登记弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" :fullscreen="isMobile">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="90px" size="small">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="客房号" prop="room_id">
              <el-select v-model="form.room_id" placeholder="选择空闲客房" filterable style="width:100%">
                <el-option v-for="r in vacantRooms" :key="r.id" :label="`${r.room_no} (${r.type_name}) ¥${r.price}/晚`" :value="r.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入住人数"><el-input-number v-model="form.guest_count" :min="1" :max="10" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名" prop="guest_name"><el-input v-model="form.guest_name" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="电话" prop="guest_phone"><el-input v-model="form.guest_phone" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="证件号码"><el-input v-model="form.guest_id_no" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入住日期" prop="checkin_date">
              <el-date-picker v-model="form.checkin_date" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入住晚数" prop="nights">
              <el-input-number v-model="form.nights" :min="1" :max="365" @change="calcTotal" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="房价/晚" prop="price_per_night">
              <el-input-number v-model="form.price_per_night" :min="0" :precision="2" @change="calcTotal" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="押金">
              <el-input-number v-model="form.deposit" :min="0" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="实收金额">
              <el-input-number v-model="form.paid_amount" :min="0" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="支付方式">
              <el-select v-model="form.pay_type" style="width:100%">
                <el-option label="现金" value="cash" /><el-option label="微信" value="wechat" />
                <el-option label="支付宝" value="alipay" /><el-option label="银行卡" value="card" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
          </el-col>
        </el-row>
        <div style="text-align:right;font-size:14px;color:#1890ff">
          应收合计：¥{{ (form.price_per_night * form.nights).toFixed(2) }}
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCheckin" :loading="submitting">确认入住</el-button>
      </template>
    </el-dialog>

    <!-- 退房弹窗 -->
    <el-dialog v-model="checkoutVisible" title="办理退房" width="460px" :fullscreen="isMobile">
      <div v-if="checkoutTarget">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="房间">{{ checkoutTarget.room_no }}</el-descriptions-item>
          <el-descriptions-item label="姓名">{{ checkoutTarget.guest_name }}</el-descriptions-item>
          <el-descriptions-item label="入住">{{ checkoutTarget.checkin_date }}</el-descriptions-item>
          <el-descriptions-item label="间夜">{{ checkoutTarget.nights }} 晚</el-descriptions-item>
          <el-descriptions-item label="房费">¥{{ checkoutTarget.total_amount }}</el-descriptions-item>
        </el-descriptions>
        <el-form style="margin-top:16px" label-width="90px" size="small">
          <el-form-item label="退房日期">
            <el-date-picker v-model="checkoutForm.actual_checkout" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width:100%" />
          </el-form-item>
          <el-form-item label="额外消费">
            <el-input-number v-model="checkoutForm.extra_charge" :min="0" :precision="2" style="width:100%" />
          </el-form-item>
          <el-form-item label="备注"><el-input v-model="checkoutForm.remark" type="textarea" :rows="2" /></el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="checkoutVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCheckout" :loading="submitting">确认退房</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="入住详情" width="560px" :fullscreen="isMobile">
      <div v-if="detailData">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="单号" :span="2">{{ detailData.checkin_no }}</el-descriptions-item>
          <el-descriptions-item label="房间">{{ detailData.room_no }}</el-descriptions-item>
          <el-descriptions-item label="房型">{{ detailData.type_name }}</el-descriptions-item>
          <el-descriptions-item label="姓名">{{ detailData.guest_name }}</el-descriptions-item>
          <el-descriptions-item label="电话">{{ detailData.guest_phone }}</el-descriptions-item>
          <el-descriptions-item label="证件">{{ detailData.guest_id_no }}</el-descriptions-item>
          <el-descriptions-item label="人数">{{ detailData.guest_count }}</el-descriptions-item>
          <el-descriptions-item label="入住">{{ detailData.checkin_date }}</el-descriptions-item>
          <el-descriptions-item label="预退房">{{ detailData.expected_checkout }}</el-descriptions-item>
          <el-descriptions-item label="间夜">{{ detailData.nights }}</el-descriptions-item>
          <el-descriptions-item label="房价/晚">¥{{ detailData.price_per_night }}</el-descriptions-item>
          <el-descriptions-item label="房费合计">¥{{ detailData.total_amount }}</el-descriptions-item>
          <el-descriptions-item label="已付金额">¥{{ detailData.paid_amount }}</el-descriptions-item>
          <el-descriptions-item label="押金">¥{{ detailData.deposit }}</el-descriptions-item>
          <el-descriptions-item label="支付方式">{{ detailData.pay_type }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusType(detailData.status)" size="small">{{ statusLabel(detailData.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="detailData.remark" label="备注" :span="2">{{ detailData.remark }}</el-descriptions-item>
        </el-descriptions>
        <!-- 附加消费 -->
        <div style="margin-top:12px" v-if="detailData.charges?.length">
          <div style="font-weight:600;margin-bottom:8px">附加消费</div>
          <el-table :data="detailData.charges" size="small">
            <el-table-column prop="charge_type" label="类型" />
            <el-table-column prop="description" label="描述" />
            <el-table-column prop="amount" label="金额"><template #default="s">¥{{ s.row.amount }}</template></el-table-column>
            <el-table-column prop="created_at" label="时间" width="140" />
          </el-table>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { checkinApi, hotelRoomApi } from '@/api/index'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const route = useRoute()
const isMobile = ref(window.innerWidth <= 768)
const loading = ref(false), submitting = ref(false)
const list = ref([]), total = ref(0), page = ref(1), pageSize = ref(15)
const search = ref(''), filterStatus = ref('')
const vacantRooms = ref([])

const dialogVisible = ref(false), dialogTitle = ref('办理入住')
const checkoutVisible = ref(false), detailVisible = ref(false)
const checkoutTarget = ref(null), detailData = ref(null)
const formRef = ref()

const form = ref({
  room_id: null, guest_name: '', guest_phone: '', guest_id_no: '',
  guest_count: 1, checkin_date: dayjs().format('YYYY-MM-DD'),
  nights: 1, price_per_night: 0, deposit: 0, paid_amount: 0,
  pay_type: 'cash', remark: ''
})
const checkoutForm = ref({ actual_checkout: dayjs().format('YYYY-MM-DD'), extra_charge: 0, remark: '' })
const rules = {
  room_id: [{ required: true, message: '请选择客房' }],
  guest_name: [{ required: true, message: '请输入姓名' }],
  checkin_date: [{ required: true, message: '请选择日期' }],
}

function statusLabel(s) { return { checked_in: '在住', checked_out: '已退房', cancelled: '已取消' }[s] || s }
function statusType(s) { return { checked_in: 'primary', checked_out: 'info', cancelled: 'danger' }[s] || '' }

function calcTotal() {
  form.value.paid_amount = parseFloat((form.value.price_per_night * form.value.nights).toFixed(2))
}

async function loadData() {
  loading.value = true
  try {
    const res = await checkinApi.getList({ page: page.value, pageSize: pageSize.value, search: search.value, status: filterStatus.value })
    list.value = res.list || []
    total.value = res.total || 0
  } catch {} finally { loading.value = false }
}

async function openDialog() {
  form.value = { room_id: route.query.room_id ? Number(route.query.room_id) : null, guest_name: '', guest_phone: '', guest_id_no: '', guest_count: 1, checkin_date: dayjs().format('YYYY-MM-DD'), nights: 1, price_per_night: 0, deposit: 0, paid_amount: 0, pay_type: 'cash', remark: '' }
  const rooms = await hotelRoomApi.getAll({ status: 'vacant' })
  // 到期退房模式：只列出在住房间供选择
  const listRooms = route.query.action === 'checkout'
    ? await hotelRoomApi.getAll({ status: 'occupied' })
    : rooms
  vacantRooms.value = listRooms
  if (form.value.room_id) {
    const r = listRooms.find(r => r.id == form.value.room_id)
    if (r) {
      form.value.price_per_night = r.price
      calcTotal()
      // 到期退房模式：直接弹出退房弹窗
      if (route.query.action === 'checkout' && r.checkin_id) {
        dialogVisible.value = false
        const row = list.value.find(x => x.id === r.checkin_id)
        if (row) openCheckout(row)
        return
      }
    }
  }
  dialogTitle.value = '办理入住'
  dialogVisible.value = true
}

async function submitCheckin() {
  await formRef.value.validate()
  submitting.value = true
  try {
    await checkinApi.create(form.value)
    ElMessage.success('入住登记成功')
    dialogVisible.value = false
    loadData()
  } catch {} finally { submitting.value = false }
}

function openCheckout(row) {
  checkoutTarget.value = row
  checkoutForm.value = { actual_checkout: dayjs().format('YYYY-MM-DD'), extra_charge: 0, remark: '' }
  checkoutVisible.value = true
}

async function submitCheckout() {
  submitting.value = true
  try {
    await checkinApi.checkout(checkoutTarget.value.id, checkoutForm.value)
    ElMessage.success('退房成功')
    checkoutVisible.value = false
    loadData()
  } catch {} finally { submitting.value = false }
}

async function showDetail(row) {
  try {
    detailData.value = await checkinApi.getById(row.id)
    detailVisible.value = true
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.toolbar-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar-right { display: flex; align-items: center; gap: 8px; }
</style>
