<template>
  <div class="orders-page">
    <!-- ── 工具栏 ── -->
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
      <div class="toolbar-right">
        <!-- 管理员专属操作 -->
        <template v-if="isAdmin">
          <el-button size="small" type="danger" :disabled="selectedRows.length === 0" @click="handleBatchDelete">
            <el-icon><Delete /></el-icon> 删除({{ selectedRows.length }})
          </el-button>
          <el-button size="small" type="primary" plain @click="handleExport">
            <el-icon><Download /></el-icon> 导出
          </el-button>
          <el-button size="small" type="success" plain @click="importDialogVisible = true">
            <el-icon><Upload /></el-icon> 导入
          </el-button>
        </template>
        <el-button size="small" @click="loadData"><el-icon><Refresh /></el-icon></el-button>
      </div>
    </div>

    <!-- ── 汇总行 ── -->
    <div class="summary-bar">
      <span>共 <b>{{ total }}</b> 条记录</span>
      <span>合计金额：<b style="color:#1890ff">¥{{ summaryAmount }}</b></span>
      <span v-if="isAdmin && selectedRows.length > 0" style="color:#f56c6c">
        已选 <b>{{ selectedRows.length }}</b> 条
      </span>
    </div>

    <!-- ── 表格 ── -->
    <el-table
      :data="list" stripe size="small" v-loading="loading"
      @selection-change="handleSelectionChange"
      ref="tableRef"
    >
      <el-table-column v-if="isAdmin" type="selection" width="42" />
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
    <el-pagination
      v-model:current-page="page" v-model:page-size="pageSize"
      :total="total" layout="total, sizes, prev, pager, next"
      :page-sizes="[15,30,50]" style="margin-top:12px"
      @change="loadData"
    />

    <!-- ── 订单详情 ── -->
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
            <el-table-column label="名称">
              <template #default="{row}">{{ row.product_name || row.dish_name || row.room_no || '-' }}</template>
            </el-table-column>
            <el-table-column label="单价" width="80"><template #default="{row}">¥{{ row.product_price ?? row.dish_price ?? row.price_per_night ?? 0 }}</template></el-table-column>
            <el-table-column prop="quantity" label="数量" width="60" />
            <el-table-column label="小计" width="80"><template #default="{row}">¥{{ row.subtotal }}</template></el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>

    <!-- ── 导入对话框（仅管理员）── -->
    <el-dialog v-model="importDialogVisible" title="导入订单" width="500px" :fullscreen="isMobile" v-if="isAdmin">
      <div class="import-tips">
        <el-alert type="info" :closable="false" style="margin-bottom:12px">
          <template #title>
            <span>请先下载导入模板，按格式填写后上传。</span>
            <el-link type="primary" style="margin-left:8px" @click="downloadTemplate">下载导入模板</el-link>
          </template>
        </el-alert>
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :limit="1"
          accept=".xlsx,.xls,.csv"
          :on-change="handleFileChange"
          :on-remove="() => { importFile = null }"
          drag
        >
          <el-icon style="font-size:40px;color:#c0c4cc"><Upload /></el-icon>
          <div>拖拽 Excel 文件到此处，或 <em>点击选择</em></div>
          <template #tip><div style="color:#999;font-size:12px">支持 .xlsx / .xls / .csv 格式</div></template>
        </el-upload>
      </div>
      <div v-if="importResult" style="margin-top:12px">
        <el-alert :type="importResult.fail > 0 ? 'warning' : 'success'" :title="importResult.msg" :closable="false" />
        <div v-if="importResult.errors?.length" style="max-height:120px;overflow:auto;margin-top:8px">
          <div v-for="e in importResult.errors" :key="e" style="color:#f56c6c;font-size:12px">{{ e }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" :disabled="!importFile" @click="doImport">确认导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { checkinApi, foodOrderApi, retailOrderApi } from '@/api/index'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import http from '@/api/http'
import { Delete, Download, Upload, Refresh } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'

const userStore = useUserStore()
const isAdmin = computed(() => userStore.isAdmin)

const isMobile = ref(window.innerWidth <= 768)
const loading = ref(false)
const list = ref([]), total = ref(0), page = ref(1), pageSize = ref(15)
const orderType = ref(''), search = ref(''), filterStatus = ref(''), dateRange = ref([])
const detailVisible = ref(false), detailData = ref(null)
const selectedRows = ref([])
const tableRef = ref(null)

// 导入相关
const importDialogVisible = ref(false)
const importFile = ref(null)
const importing = ref(false)
const importResult = ref(null)
const uploadRef = ref(null)

const summaryAmount = computed(() => list.value.reduce((s, r) => s + (r.pay_amount || 0), 0).toFixed(2))

function typeLabel(t) { return { hotel: '住宿', food: '餐饮', retail: '零售' }[t] || t }
function typeTagType(t) { return { hotel: 'primary', food: 'warning', retail: '' }[t] || 'info' }
function statusLabel(s) { return { paid: '已完成', refunded: '已退款', checked_out: '已完成', checked_in: '在住', cancelled: '已取消' }[s] || s }
function statusTagType(s) { return { paid: 'success', refunded: 'warning', checked_out: 'info', cancelled: 'danger' }[s] || '' }
function payTypeLabel(p) { return { cash: '现金', wechat: '微信', alipay: '支付宝', card: '银行卡' }[p] || p }

function handleSelectionChange(rows) {
  selectedRows.value = rows
}

async function loadData() {
  loading.value = true
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      type: orderType.value || '',
      search: search.value || '',
      status: filterStatus.value || '',
      dateStart: dateRange.value?.[0] || '',
      dateEnd: dateRange.value?.[1] || '',
    }
    const res = await http.get('/orders/list', { params })
    // res 经拦截器已是 { list, total, page, pageSize }
    const data = res || {}
    list.value = (data.list || []).map(item => ({
      ...item,
      _type: item.type, // 后端返回的 type 字段映射到前端 _type
    }))
    total.value = data.total || 0
  } catch (e) {
    console.error('loadData error', e)
  } finally {
    loading.value = false
  }
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

// ── 管理员功能 ──────────────────────────────────

// 下载 blob 工具函数
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 导出 Excel
async function handleExport() {
  try {
    const params = {
      type: orderType.value || '',
      dateStart: dateRange.value?.[0] || '',
      dateEnd: dateRange.value?.[1] || '',
      search: search.value || '',
      status: filterStatus.value || '',
    }
    const resp = await http.get('/orders/export', {
      params,
      responseType: 'blob',
    })
    const date = new Date().toISOString().slice(0, 10)
    downloadBlob(resp, `orders_${date}.xlsx`)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败：' + (e.message || ''))
  }
}

// 下载导入模板（XLSX 格式，前端直接生成）
function downloadTemplate() {
  const headers = ['单号(留空自动生成)', '类型(hotel/food/retail)', '房间号/桌号', '姓名', '金额', '支付方式(cash/wechat/alipay/card)', '状态(paid/cancelled)', '日期(YYYY-MM-DD)', '备注']
  const rows = [
    ['', 'retail', '', '示例客户', '100', 'wechat', 'paid', new Date().toISOString().slice(0, 10), '示例备注'],
    ['', 'food',   'A01', '',       '288', 'alipay',  'paid', new Date().toISOString().slice(0, 10), ''],
    ['', 'hotel',  '101', '张三',   '300', 'cash',     'paid', new Date().toISOString().slice(0, 10), ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  // 改善列宽
  ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 22 : 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '订单导入模板')
  XLSX.writeFile(wb, '订单导入模板.xlsx')
}

// 文件选择
function handleFileChange(file) {
  importFile.value = file.raw
  importResult.value = null
}

// XLSX 解析上传文件（支持 .xlsx .xls .csv）
function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(sheet))
      } catch (err) {
        reject(new Error('文件解析失败'))
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

// 执行导入（支持 xlsx/xls/csv）
async function doImport() {
  if (!importFile.value) return
  importing.value = true
  importResult.value = null
  try {
    const raw = await readExcelFile(importFile.value)
    if (!raw || raw.length === 0) {
      ElMessage.error('文件内容为空或格式错误')
      importing.value = false
      return
    }
    // 列名映射（中文表头 → 后端字段名）
    const colMap = {
      '单号(留空自动生成)': 'order_no', '类型(hotel/food/retail)': 'type',
      '房间号/桌号': 'room_no', '姓名': 'guest_name', '金额': 'pay_amount',
      '支付方式(cash/wechat/alipay/card)': 'pay_type',
      '状态(paid/cancelled)': 'status', '日期(YYYY-MM-DD)': 'order_date', '备注': 'remark'
    }
    const rows = raw
      .map(row => {
        const mapped = {}
        for (const [k, v] of Object.entries(row)) {
          const key = colMap[k.trim()] || k.trim()
          mapped[key] = v
        }
        return mapped
      })
      .filter(r => r && r.type)

    const res = await http.post('/orders/import', { rows })
    const result = typeof res === 'object' && res !== null ? res : {}
    importResult.value = { ...result, msg: result.msg || '导入完成' }
    ElMessage.success(result.msg || '导入成功')
    loadData()
  } catch (e) {
    ElMessage.error('导入失败：' + (e.message || ''))
  } finally {
    importing.value = false
  }
}

// 批量删除
async function handleBatchDelete() {
  const rows = selectedRows.value
  if (rows.length === 0) return
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${rows.length} 条订单？此操作不可恢复！`,
      '危险操作',
      { type: 'error', confirmButtonText: '确认删除', confirmButtonClass: 'el-button--danger' }
    )
  } catch { return } // 取消

  try {
    const items = rows.map(r => ({ id: r.id, type: r._type }))
    const res = await http.post('/orders/batch-delete', { items })
    // res 经过拦截器，实际是 { success, fail } 对象
    const successCount = res?.success ?? 0
    const failCount = res?.fail ?? 0
    if (failCount > 0) {
      ElMessage.warning(`删除完成：成功 ${successCount} 条，失败 ${failCount} 条`)
    } else {
      ElMessage.success(`已成功删除 ${successCount} 条订单`)
    }
    selectedRows.value = []
    tableRef.value?.clearSelection()
    await loadData()
  } catch (e) {
    // http 拦截器已弹 error，这里静默
  }
}

onMounted(loadData)
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.toolbar-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar-right { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.summary-bar { background: #fafafa; border: 1px solid #e8e8e8; border-radius: 6px; padding: 8px 16px; font-size: 14px; color: #555; display: flex; gap: 24px; margin-bottom: 12px; }
</style>
