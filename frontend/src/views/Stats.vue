<template>
  <div class="stats-page">
    <!-- 日期范围选择 -->
    <div class="toolbar">
      <el-date-picker
        v-model="dateRange" type="daterange"
        start-placeholder="开始日期" end-placeholder="结束日期"
        format="YYYY-MM-DD" value-format="YYYY-MM-DD"
        size="small" style="width:240px"
        :shortcuts="shortcuts"
      />
      <el-button type="primary" size="small" @click="loadStats" :loading="loading">查询</el-button>
      <el-button size="small" @click="exportStats"><el-icon><Download /></el-icon> 导出</el-button>
    </div>

    <!-- 汇总卡片 -->
    <el-row :gutter="12" style="margin-bottom:16px">
      <el-col :xs="12" :sm="6" v-for="card in summaryCards" :key="card.label">
        <div class="stat-card" :style="{ borderLeft: `4px solid ${card.color}` }">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value" :style="{ color: card.color }">{{ card.value }}</div>
          <div class="stat-sub">{{ card.sub }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <!-- 每日收入趋势 -->
      <el-col :xs="24" :sm="16">
        <div class="chart-card">
          <div class="card-title">每日收入趋势</div>
          <div ref="lineRef" style="width:100%;height:260px"></div>
        </div>
      </el-col>
      <!-- 支付方式分布 -->
      <el-col :xs="24" :sm="8">
        <div class="chart-card">
          <div class="card-title">支付方式分布</div>
          <div ref="payPieRef" style="width:100%;height:260px"></div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px">
      <!-- TOP菜品 -->
      <el-col :xs="24" :sm="12">
        <div class="chart-card">
          <div class="card-title">热销菜品 TOP10</div>
          <div ref="dishBarRef" style="width:100%;height:280px"></div>
        </div>
      </el-col>
      <!-- TOP商品 -->
      <el-col :xs="24" :sm="12">
        <div class="chart-card">
          <div class="card-title">热销商品 TOP10</div>
          <div ref="productBarRef" style="width:100%;height:280px"></div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { statsApi } from '@/api/index'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const loading = ref(false)
const lineRef = ref(null), payPieRef = ref(null), dishBarRef = ref(null), productBarRef = ref(null)
const statsData = ref({})

const shortcuts = [
  { text: '今天', value: () => { const d = dayjs().format('YYYY-MM-DD'); return [d, d] } },
  { text: '本周', value: () => [dayjs().startOf('week').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')] },
  { text: '本月', value: () => [dayjs().startOf('month').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')] },
  { text: '上月', value: () => [dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')] },
]
const dateRange = ref([dayjs().subtract(29, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')])

const summaryCards = computed(() => {
  const s = statsData.value
  return [
    { label: '住宿收入', value: '¥' + (s.hotel_revenue || 0).toFixed(0), sub: `${s.hotel_count || 0} 笔`, color: '#1890ff' },
    { label: '餐饮收入', value: '¥' + (s.food_revenue || 0).toFixed(0), sub: `${s.food_count || 0} 笔`, color: '#fa8c16' },
    { label: '零售收入', value: '¥' + (s.retail_revenue || 0).toFixed(0), sub: `${s.retail_count || 0} 笔`, color: '#722ed1' },
    { label: '总收入', value: '¥' + ((s.hotel_revenue || 0) + (s.food_revenue || 0) + (s.retail_revenue || 0)).toFixed(0), sub: `${(s.hotel_count || 0) + (s.food_count || 0) + (s.retail_count || 0)} 笔`, color: '#52c41a' },
  ]
})

async function loadStats() {
  loading.value = true
  try {
    const data = await statsApi.getRange({ start: dateRange.value[0], end: dateRange.value[1] })
    statsData.value = data
    await nextTick()
    renderCharts(data)
  } catch {} finally { loading.value = false }
}

function renderCharts(data) {
  // 每日趋势
  if (lineRef.value) {
    const chart = echarts.getInstanceByDom(lineRef.value) || echarts.init(lineRef.value)
    const days = (data.daily || []).map(d => d.date)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['住宿', '餐饮', '零售'], bottom: 0 },
      grid: { bottom: 36, top: 10, left: 50, right: 10 },
      xAxis: { type: 'category', data: days, axisLabel: { fontSize: 11, rotate: days.length > 10 ? 30 : 0 } },
      yAxis: { type: 'value', axisLabel: { formatter: v => '¥' + v } },
      series: [
        { name: '住宿', type: 'bar', stack: 'total', data: (data.daily || []).map(d => d.hotel || 0), itemStyle: { color: '#1890ff' } },
        { name: '餐饮', type: 'bar', stack: 'total', data: (data.daily || []).map(d => d.food || 0), itemStyle: { color: '#fa8c16' } },
        { name: '零售', type: 'bar', stack: 'total', data: (data.daily || []).map(d => d.retail || 0), itemStyle: { color: '#722ed1' } },
      ]
    })
  }
  // 支付方式
  if (payPieRef.value) {
    const chart = echarts.getInstanceByDom(payPieRef.value) || echarts.init(payPieRef.value)
    const pays = data.pay_types || []
    const colorMap = { cash: '#52c41a', wechat: '#09bb07', alipay: '#1677ff', card: '#722ed1' }
    const labelMap = { cash: '现金', wechat: '微信', alipay: '支付宝', card: '银行卡' }
    chart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      legend: { bottom: 0, itemWidth: 10 },
      series: [{
        type: 'pie', radius: ['40%', '68%'],
        data: pays.map(p => ({ value: p.amount, name: labelMap[p.pay_type] || p.pay_type, itemStyle: { color: colorMap[p.pay_type] } })),
        label: { show: false }
      }]
    })
  }
  // TOP菜品
  if (dishBarRef.value) {
    const chart = echarts.getInstanceByDom(dishBarRef.value) || echarts.init(dishBarRef.value)
    const dishes = (data.top_dishes || []).slice(0, 10).reverse()
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 90, right: 20, top: 10, bottom: 30 },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: dishes.map(d => d.name), axisLabel: { fontSize: 11 } },
      series: [{ type: 'bar', data: dishes.map(d => d.qty), itemStyle: { color: '#fa8c16' }, label: { show: true, position: 'right' } }]
    })
  }
  // TOP商品
  if (productBarRef.value) {
    const chart = echarts.getInstanceByDom(productBarRef.value) || echarts.init(productBarRef.value)
    const prods = (data.top_products || []).slice(0, 10).reverse()
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 90, right: 20, top: 10, bottom: 30 },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: prods.map(d => d.name), axisLabel: { fontSize: 11 } },
      series: [{ type: 'bar', data: prods.map(d => d.qty), itemStyle: { color: '#722ed1' }, label: { show: true, position: 'right' } }]
    })
  }
}

function exportStats() {
  const wb = XLSX.utils.book_new()
  const daily = (statsData.value.daily || []).map(d => ({ 日期: d.date, 住宿: d.hotel || 0, 餐饮: d.food || 0, 零售: d.retail || 0, 合计: (d.hotel || 0) + (d.food || 0) + (d.retail || 0) }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(daily), '每日数据')
  XLSX.writeFile(wb, `营业报表_${dateRange.value[0]}_${dateRange.value[1]}.xlsx`)
}

onMounted(loadStats)
</script>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.stat-card {
  background: #fff; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.stat-label { font-size: 13px; color: #666; margin-bottom: 6px; }
.stat-value { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
.stat-sub { font-size: 12px; color: #999; }
.chart-card {
  background: #fff; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.card-title { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 8px; }
</style>
