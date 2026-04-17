<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :xs="12" :sm="6" v-for="card in statCards" :key="card.label">
        <div class="stat-card" :style="{ borderLeft: `4px solid ${card.color}` }">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value" :style="{ color: card.color }">{{ card.value }}</div>
          <div class="stat-sub">{{ card.sub }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px">
      <!-- 客房入住率 -->
      <el-col :xs="24" :sm="8">
        <div class="card">
          <div class="card-title">客房入住率</div>
          <div class="occupancy-ring">
            <div ref="gaugeRef" style="width:180px;height:180px"></div>
          </div>
          <div class="room-legend">
            <span class="dot occupied"></span>在住 {{ todayData.hotel?.occupied || 0 }} 间
            <span class="dot vacant" style="margin-left:12px"></span>空闲 {{ (todayData.hotel?.total || 0) - (todayData.hotel?.occupied || 0) }} 间
          </div>
        </div>
      </el-col>
      <!-- 营收构成 -->
      <el-col :xs="24" :sm="8">
        <div class="card">
          <div class="card-title">今日营收构成</div>
          <div ref="pieRef" style="width:100%;height:200px"></div>
        </div>
      </el-col>
      <!-- TOP菜品/商品 -->
      <el-col :xs="24" :sm="8">
        <div class="card">
          <el-tabs v-model="topTab" size="small">
            <el-tab-pane label="热销菜品" name="dishes">
              <div class="top-list">
                <div v-for="(d, i) in todayData.topDishes" :key="d.dish_name" class="top-item">
                  <span class="rank" :class="'rank-' + (i+1)">{{ i + 1 }}</span>
                  <span class="name">{{ d.dish_name }}</span>
                  <span class="qty">{{ d.qty }}份</span>
                </div>
                <div v-if="!todayData.topDishes?.length" class="empty">暂无数据</div>
              </div>
            </el-tab-pane>
            <el-tab-pane label="热销商品" name="products">
              <div class="top-list">
                <div v-for="(p, i) in todayData.topProducts" :key="p.product_name" class="top-item">
                  <span class="rank" :class="'rank-' + (i+1)">{{ i + 1 }}</span>
                  <span class="name">{{ p.product_name }}</span>
                  <span class="qty">{{ p.qty }}个</span>
                </div>
                <div v-if="!todayData.topProducts?.length" class="empty">暂无数据</div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-col>
    </el-row>

    <!-- 快捷入口 -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="24">
        <div class="card">
          <div class="card-title">快捷入口</div>
          <div class="quick-actions">
            <div class="action-btn" v-for="a in quickActions" :key="a.path" @click="$router.push(a.path)">
              <el-icon :style="{ color: a.color }"><component :is="a.icon" /></el-icon>
              <span>{{ a.label }}</span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { statsApi } from '@/api/index'
import * as echarts from 'echarts'

const todayData = ref({ hotel: {}, food: {}, retail: {}, topDishes: [], topProducts: [] })
const topTab = ref('dishes')
const gaugeRef = ref(null)
const pieRef = ref(null)

const statCards = computed(() => [
  { label: '客房入住率', value: (todayData.value.hotel?.occupancy || 0) + '%', sub: `${todayData.value.hotel?.occupied || 0}/${todayData.value.hotel?.total || 0} 间`, color: '#1890ff' },
  { label: '今日住宿收入', value: '¥' + (todayData.value.hotel?.revenue || 0).toFixed(0), sub: `${todayData.value.hotel?.count || 0} 笔入住`, color: '#52c41a' },
  { label: '今日餐饮收入', value: '¥' + (todayData.value.food?.revenue || 0).toFixed(0), sub: `${todayData.value.food?.count || 0} 笔订单`, color: '#fa8c16' },
  { label: '今日零售收入', value: '¥' + (todayData.value.retail?.revenue || 0).toFixed(0), sub: `${todayData.value.retail?.count || 0} 笔订单`, color: '#722ed1' },
])

const quickActions = [
  { path: '/room-status', label: '客房状态', icon: 'OfficeBuilding', color: '#1890ff' },
  { path: '/checkins', label: '办理入住', icon: 'User', color: '#52c41a' },
  { path: '/reservations', label: '预订管理', icon: 'Calendar', color: '#fa8c16' },
  { path: '/dining', label: '餐厅管理', icon: 'Fork', color: '#eb2f96' },
  { path: '/retail', label: '零售收银', icon: 'ShoppingCart', color: '#722ed1' },
  { path: '/stats', label: '营业报表', icon: 'DataAnalysis', color: '#13c2c2' },
]

async function loadData() {
  try {
    todayData.value = await statsApi.getToday()
    await nextTick()
    initGauge()
    initPie()
  } catch {}
}

function initGauge() {
  if (!gaugeRef.value) return
  const chart = echarts.init(gaugeRef.value)
  const rate = todayData.value.hotel?.occupancy || 0
  chart.setOption({
    series: [{
      type: 'gauge', radius: '85%',
      progress: { show: true, width: 12 },
      axisLine: { lineStyle: { width: 12 } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      pointer: { show: false },
      detail: { valueAnimation: true, formatter: '{value}%', color: '#1890ff', fontSize: 22, offsetCenter: [0, 0] },
      data: [{ value: rate }],
      min: 0, max: 100,
      itemStyle: { color: '#1890ff' }
    }]
  })
}

function initPie() {
  if (!pieRef.value) return
  const chart = echarts.init(pieRef.value)
  const hotel = todayData.value.hotel?.revenue || 0
  const food = todayData.value.food?.revenue || 0
  const retail = todayData.value.retail?.revenue || 0
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: 0, itemWidth: 10 },
    series: [{
      type: 'pie', radius: ['40%', '70%'], top: '-10%',
      data: [
        { value: hotel, name: '住宿', itemStyle: { color: '#1890ff' } },
        { value: food, name: '餐饮', itemStyle: { color: '#fa8c16' } },
        { value: retail, name: '零售', itemStyle: { color: '#722ed1' } },
      ],
      label: { show: false }
    }]
  })
}

onMounted(loadData)
</script>

<style scoped>
.dashboard {}
.stat-row { margin-bottom: 0; }
.stat-card {
  background: #fff; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.stat-label { font-size: 13px; color: #666; margin-bottom: 6px; }
.stat-value { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
.stat-sub { font-size: 12px; color: #999; }

.card {
  background: #fff; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.card-title { font-size: 15px; font-weight: 600; color: #333; margin-bottom: 12px; }

.occupancy-ring { display: flex; justify-content: center; }
.room-legend { text-align: center; font-size: 13px; color: #666; margin-top: 8px; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.dot.occupied { background: #1890ff; }
.dot.vacant { background: #e0e0e0; }

.top-list { min-height: 160px; }
.top-item { display: flex; align-items: center; padding: 6px 0; border-bottom: 1px solid #f5f5f5; font-size: 13px; }
.rank { width: 22px; height: 22px; border-radius: 50%; background: #e8e8e8; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; margin-right: 8px; flex-shrink: 0; }
.rank-1 { background: #ffd700; color: #fff; }
.rank-2 { background: #c0c0c0; color: #fff; }
.rank-3 { background: #cd7f32; color: #fff; }
.name { flex: 1; }
.qty { color: #1890ff; font-weight: 600; }
.empty { text-align: center; color: #bbb; padding: 40px 0; font-size: 13px; }

.quick-actions { display: flex; flex-wrap: wrap; gap: 12px; }
.action-btn {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 16px 20px; border-radius: 8px; background: #f5f8ff;
  cursor: pointer; transition: all 0.2s; min-width: 80px;
}
.action-btn:hover { background: #e6f0ff; transform: translateY(-2px); }
.action-btn .el-icon { font-size: 24px; }
.action-btn span { font-size: 13px; color: #444; }
</style>
