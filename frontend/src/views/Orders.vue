<template>
  <div class="orders-page">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-radio-group v-model="orderType" size="small" @change="loadData">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="hotel">住宿</el-radio-button>
          <el-radio-button value="food">餐饮</el-radio-button>
          <el-radio-button value="retail">零售</el-radio-button>
        </el-radio-group>
        <el-date-picker
          v-model="dateRange" type="daterange"
          start-placeholder="开始日期" end-placeholder="结束日期"
          format="YYYY-MM-DD" value-format="YYYY-MM-DD"
          size="small" clearable style="width:230px"
          @change="loadData"
        />
        <el-input v-model="search" placeholder="搜索单号/姓名" size="small" clearable style="width:180px" @input="loadData" />
        <el-select v-model="filterStatus" size="small" placeholder="状态" clearable style="width:100px" @change="loadData">
          <el-option label="已完成" value="paid" />
          <el-option label="已退款" value="refunded" />
          <el-option label="已退房" value="checked_out" />
        </el-select>
      </div>
      <el-button size="small" @click="loadData"><el-icon><Refresh /></el-icon></el-button>
    </div>

    <!-- 汇总行 -->
    <div class="summary-bar">
      <span>共 <b>{{ total }}</b> 条记录</span>
      <span>合计金额：<b style="color:#1890ff">¥{{ summaryAmount }}</b></span>
    </div>

    <el-table :data="list" stripe size="small" v-loading="loading">
      <el-table-column prop="order_no" label="单号" width="180" />
      <el-table-column label="类型" width="70">
        <template #default="{row}">
          <el-tag size="small" :type="typeTagType(row._type)">{{ typeLabel(row._type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="room_no" label="房间/桌号" width="90" />
      <el-table-column prop="guest_name" label="姓名" width="90" />
      <el-table-column label="金额" width="90"><template #default="{row}">¥{{ row.pay_amount }}</template></el-table-column>
      <el-table-column prop="pay_type" label="支付方式" width="90">
        <template #default="{row}">{{ payTypeLabel(row.pay_type) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{row}">
          <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="时间" width="160" />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{row}">
          <el-button size="small" @click="showDetail(row)">详情</el-button>
          <el-button v-if="row.status === 'paid' && row._type !== 'hotel'" size="small" type="warning" @click="refundOrder(row)">退款</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total, sizes, prev, pager, next" :page-sizes="[15,30,50]" style="margin-top:12px" @change="loadData" />

    <!-- 详情 -->
    <el-dialog v-model="detailVisible" title="订单详情" width="560px" :fullscreen="isMobile">
      <div v-if="detailData">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="单号" :span="2">{{ detailData.order_no }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ typeLabel(detailData._type) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(detailData.status)" size="small">{{ statusLabel(detailData.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="合计">¥{{ detailData.total_amount }}</el-descriptions-item>
          <el-descriptions-item label="优惠">¥{{ detailData.discount_amount || 0 }}</el-descriptions-item>
          <el-descriptions-item label="实收">¥{{ detailData.pay_amount }}</el-descriptions-item>
          <el-descriptions-item label="支付方式">{{ payTypeLabel(detailData.pay_type) }}</el-descriptions-item>
          <el-descriptions-item label="时间" :span="2">{{ detailData.created_at }}</el-descriptions-item>
          <el-descriptions-item v-if="detailData.remark" label="备注" :span="2">{{ detailData.remark }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="detailData.items?.length" style="margin-top:12px">
          <div style="font-weight:600;margin-bottom:8px">明细</div>
          <el-table :data="detailData.items" size="small" :show-header="false">
            <el-table-column prop="dish_name" label="名称" />
            <el-table-column label="单价" width="80"><template #default="{row}">¥{{ row.dish_price || row.product_price || row.price_per_night }}</template></el-table-column>
            <el-table-column prop="quantity" label="数量" width="60" />
            <el-table-column label="小计" width="80"><template #default="{row}">¥{{ row.subtotal }}</template></el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { checkinApi, foodOrderApi, retailOrderApi } from '@/api/index'
import { ElMessage, ElMessageBox } from 'element-plus'

const isMobile = ref(window.innerWidth <= 768)
const loading = ref(false)
const list = ref([]), total = ref(0), page = ref(1), pageSize = ref(15)
const orderType = ref(''), search = ref(''), filterStatus = ref(''), dateRange = ref([])
const detailVisible = ref(false), detailData = ref(null)

const summaryAmount = computed(() => list.value.reduce((s, r) => s + (r.pay_amount || 0), 0).toFixed(2))

function typeLabel(t) { return { hotel: '住宿', food: '餐饮', retail: '零售' }[t] || t }
function typeTagType(t) { return { hotel: 'primary', food: 'warning', retail: '' }[t] || 'info' }
function statusLabel(s) { return { paid: '已完成', refunded: '已退款', checked_out: '已退房', checked_in: '在住', cancelled: '已取消' }[s] || s }
function statusTagType(s) { return { paid: 'success', refunded: 'warning', checked_out: 'info', cancelled: 'danger' }[s] || '' }
function payTypeLabel(p) { return { cash: '现金', wechat: '微信', alipay: '支付宝', card: '银行卡' }[p] || p }

async function loadData() {
  loading.value = true
  const params = {
    page: page.value, pageSize: pageSize.value,
    search: search.value, status: filterStatus.value,
    dateStart: dateRange.value?.[0], dateEnd: dateRange.value?.[1],
  }
  try {
    const results = []
    if (!orderType.value || orderType.value === 'hotel') {
      const r = await checkinApi.getList({ ...params, status: filterStatus.value || '' })
      results.push(...(r.list || []).map(i => ({ ...i, _type: 'hotel', order_no: i.checkin_no, pay_amount: i.paid_amount })))
    }
    if (!orderType.value || orderType.value === 'food') {
      const r = await foodOrderApi.getList(params)
      results.push(...(r.list || []).map(i => ({ ...i, _type: 'food' })))
    }
    if (!orderType.value || orderType.value === 'retail') {
      const r = await retailOrderApi.getList(params)
      results.push(...(r.list || []).map(i => ({ ...i, _type: 'retail' })))
    }
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    list.value = results
    total.value = results.length
  } catch {} finally { loading.value = false }
}

async function showDetail(row) {
  try {
    let data
    if (row._type === 'hotel') data = await checkinApi.getById(row.id)
    else if (row._type === 'food') data = await foodOrderApi.getById(row.id)
    else data = await retailOrderApi.getById(row.id)
    detailData.value = { ...data, _type: row._type }
    detailVisible.value = true
  } catch {}
}

async function refundOrder(row) {
  await ElMessageBox.confirm('确认退款？', '警告', { type: 'warning' })
  try {
    if (row._type === 'retail') await retailOrderApi.refund(row.id)
    ElMessage.success('退款成功')
    loadData()
  } catch {}
}

onMounted(loadData)
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.toolbar-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.summary-bar { background: #fafafa; border: 1px solid #e8e8e8; border-radius: 6px; padding: 8px 16px; font-size: 14px; color: #555; display: flex; gap: 24px; margin-bottom: 12px; }
</style>
