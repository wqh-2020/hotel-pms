<template>
  <div class="dining-page">
    <!-- 餐桌状态概览 -->
    <div class="table-grid">
      <div
        v-for="t in tables"
        :key="t.id"
        class="table-card"
        :class="t.session?.status || 'free'"
        @click="openTable(t)"
      >
        <div class="table-name">{{ t.name }}</div>
        <div class="table-type">{{ t.table_type === 'hall' ? '大厅' : '包厢' }} · {{ t.capacity }}人</div>
        <div class="table-status">{{ sessionStatusLabel(t.session?.status) }}</div>
        <div v-if="t.session?.status === 'occupied'" class="table-amount">
          ¥{{ t.session?.total_amount || 0 }}
        </div>
        <div v-if="t.session?.status === 'reserved'" class="table-guest">
          {{ t.session?.reservation_name }}
        </div>
      </div>
    </div>

    <!-- 操作弹窗 -->
    <el-dialog v-model="tableDialogVisible" :title="dialogTitle" width="680px" :fullscreen="isMobile" destroy-on-close>
      <div v-if="currentTable">
        <!-- 空闲状态：开台 or 预订 -->
        <div v-if="sessionStatus === 'free'" class="action-zone">
          <el-row :gutter="12">
            <el-col :span="12">
              <el-button type="primary" size="large" style="width:100%;height:50px" @click="openScene = 'open'">
                <el-icon><Plus /></el-icon> 开台入座
              </el-button>
            </el-col>
            <el-col :span="12">
              <el-button type="warning" size="large" style="width:100%;height:50px" @click="openScene = 'reserve'">
                <el-icon><Calendar /></el-icon> 预订留台
              </el-button>
            </el-col>
          </el-row>
          <!-- 开台表单 -->
          <div v-if="openScene === 'open'" style="margin-top:16px">
            <el-form :model="openForm" label-width="80px" size="small">
              <el-form-item label="用餐人数"><el-input-number v-model="openForm.guest_count" :min="1" :max="currentTable.capacity" /></el-form-item>
              <el-form-item label="备注"><el-input v-model="openForm.remark" /></el-form-item>
            </el-form>
            <el-button type="primary" @click="doOpen" :loading="opLoading">确认开台</el-button>
          </div>
          <!-- 预订表单 -->
          <div v-if="openScene === 'reserve'" style="margin-top:16px">
            <el-form :model="reserveForm" label-width="80px" size="small">
              <el-form-item label="预订人"><el-input v-model="reserveForm.reservation_name" /></el-form-item>
              <el-form-item label="联系电话"><el-input v-model="reserveForm.reservation_phone" /></el-form-item>
              <el-form-item label="到店时间"><el-input v-model="reserveForm.reservation_time" placeholder="如 18:30" /></el-form-item>
              <el-form-item label="备注"><el-input v-model="reserveForm.remark" /></el-form-item>
            </el-form>
            <el-button type="warning" @click="doReserve" :loading="opLoading">确认预订</el-button>
          </div>
        </div>

        <!-- 预订状态：到店入座 or 取消 -->
        <div v-if="sessionStatus === 'reserved'" class="action-zone">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="预订人">{{ currentTable.session?.reservation_name }}</el-descriptions-item>
            <el-descriptions-item label="电话">{{ currentTable.session?.reservation_phone }}</el-descriptions-item>
            <el-descriptions-item label="到店时间">{{ currentTable.session?.reservation_time }}</el-descriptions-item>
          </el-descriptions>
          <div style="margin-top:12px;display:flex;gap:8px">
            <el-button type="primary" @click="doCheckin" :loading="opLoading">到店入座</el-button>
            <el-button type="danger" plain @click="doCancelReserve" :loading="opLoading">取消预订</el-button>
          </div>
        </div>

        <!-- 使用中：点菜 + 结账 -->
        <div v-if="sessionStatus === 'occupied'">
          <el-row :gutter="12">
            <!-- 已点菜单 -->
            <el-col :xs="24" :sm="14">
              <div class="order-header">
                <span style="font-weight:600;font-size:14px">已点菜品</span>
                <el-button size="small" type="primary" text @click="dishDialogVisible = true">
                  <el-icon><Plus /></el-icon> 点菜
                </el-button>
              </div>
              <el-table :data="sessionItems" size="small" :show-header="false" empty-text="暂未点菜">
                <el-table-column prop="dish_name" label="菜品" />
                <el-table-column label="单价" width="70"><template #default="{row}">¥{{ row.dish_price }}</template></el-table-column>
                <el-table-column label="数量" width="100">
                  <template #default="{row}">
                    <div class="qty-ctrl">
                      <el-button size="small" circle @click="changeQty(row, -1)"><el-icon><Minus /></el-icon></el-button>
                      <span>{{ row.quantity }}</span>
                      <el-button size="small" circle @click="changeQty(row, 1)"><el-icon><Plus /></el-icon></el-button>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="小计" width="75"><template #default="{row}">¥{{ row.subtotal }}</template></el-table-column>
              </el-table>
              <div class="total-row">
                合计：<strong style="color:#1890ff;font-size:18px">¥{{ totalAmount }}</strong>
              </div>
            </el-col>
            <!-- 结账区 -->
            <el-col :xs="24" :sm="10">
              <div class="checkout-panel">
                <div class="checkout-title">结账</div>
                <el-form :model="checkoutForm" label-width="80px" size="small">
                  <el-form-item label="优惠金额"><el-input-number v-model="checkoutForm.discount" :min="0" :precision="2" :max="totalAmount" @change="calcPay" style="width:100%" /></el-form-item>
                  <el-form-item label="实收金额"><el-input-number v-model="checkoutForm.pay_amount" :min="0" :precision="2" style="width:100%" /></el-form-item>
                  <el-form-item label="支付方式">
                    <el-radio-group v-model="checkoutForm.pay_type">
                      <el-radio value="cash">现金</el-radio>
                      <el-radio value="wechat">微信</el-radio>
                      <el-radio value="alipay">支付宝</el-radio>
                    </el-radio-group>
                  </el-form-item>
                </el-form>
                <el-button type="primary" style="width:100%" @click="doCheckout" :loading="opLoading">确认结账</el-button>
                <el-button style="width:100%;margin-top:8px" type="danger" plain @click="doRelease" :loading="opLoading">释放桌台</el-button>
              </div>
            </el-col>
          </el-row>
        </div>
      </div>
    </el-dialog>

    <!-- 点菜弹窗 -->
    <el-dialog v-model="dishDialogVisible" title="点菜" width="700px" :fullscreen="isMobile" append-to-body>
      <div class="dish-picker">
        <div class="category-nav">
          <div
            v-for="cat in foodCategories"
            :key="cat.id"
            class="cat-item"
            :class="{ active: activeCat === cat.id }"
            @click="activeCat = cat.id"
          >{{ cat.name }}</div>
        </div>
        <div class="dish-list">
          <div
            v-for="d in filteredDishes"
            :key="d.id"
            class="dish-item"
            :class="{ unavailable: !d.is_available }"
            @click="addDish(d)"
          >
            <img v-if="d.image" :src="d.image" class="dish-img" />
            <div v-else class="dish-img-placeholder"><el-icon><Bowl /></el-icon></div>
            <div class="dish-info">
              <div class="dish-name">{{ d.name }}</div>
              <div class="dish-price">¥{{ d.price }}/{{ d.unit }}</div>
            </div>
            <el-icon class="add-icon"><CirclePlus /></el-icon>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { diningTableApi, dishApi, foodCategoryApi } from '@/api/index'
import { ElMessage, ElMessageBox } from 'element-plus'

const isMobile = ref(window.innerWidth <= 768)
const tables = ref([])
const tableDialogVisible = ref(false)
const dishDialogVisible = ref(false)
const currentTable = ref(null)
const sessionItems = ref([])
const foodCategories = ref([])
const dishes = ref([])
const activeCat = ref(null)
const opLoading = ref(false)
const openScene = ref('')
const openForm = ref({ guest_count: 2, remark: '' })
const reserveForm = ref({ reservation_name: '', reservation_phone: '', reservation_time: '', remark: '' })
const checkoutForm = ref({ discount: 0, pay_amount: 0, pay_type: 'cash' })

const sessionStatus = computed(() => currentTable.value?.session?.status || 'free')
const dialogTitle = computed(() => currentTable.value ? `${currentTable.value.name}（${sessionStatusLabel(sessionStatus.value)}）` : '')
const totalAmount = computed(() => sessionItems.value.reduce((s, i) => s + i.subtotal, 0))
const filteredDishes = computed(() => {
  if (!activeCat.value) return dishes.value.filter(d => d.is_available)
  return dishes.value.filter(d => d.category_id === activeCat.value && d.is_available)
})

function sessionStatusLabel(s) {
  return { free: '空闲', reserved: '预订', occupied: '使用中' }[s] || '空闲'
}

async function loadTables() {
  try {
    const data = await diningTableApi.getAll()
    tables.value = data || []
  } catch {}
}

async function openTable(t) {
  currentTable.value = t
  openScene.value = ''
  openForm.value = { guest_count: 2, remark: '' }
  reserveForm.value = { reservation_name: '', reservation_phone: '', reservation_time: '', remark: '' }
  tableDialogVisible.value = true
  if (t.session?.status === 'occupied') {
    loadSessionItems(t.session.id)
    calcPay()
  }
  if (!foodCategories.value.length) {
    foodCategories.value = (await foodCategoryApi.getAll()) || []
    if (foodCategories.value.length) activeCat.value = foodCategories.value[0].id
  }
  if (!dishes.value.length) {
    dishes.value = (await dishApi.getAll({ available: 1 })) || []
  }
}

async function loadSessionItems(sid) {
  try {
    sessionItems.value = (await diningTableApi.getItems(sid)) || []
    calcPay()
  } catch {}
}

function calcPay() {
  checkoutForm.value.pay_amount = Math.max(0, totalAmount.value - checkoutForm.value.discount)
}

async function doOpen() {
  opLoading.value = true
  try {
    await diningTableApi.openSession(currentTable.value.session.id, openForm.value)
    ElMessage.success('开台成功')
    tableDialogVisible.value = false
    loadTables()
  } catch {} finally { opLoading.value = false }
}

async function doReserve() {
  opLoading.value = true
  try {
    await diningTableApi.reserveSession(currentTable.value.session.id, reserveForm.value)
    ElMessage.success('预订成功')
    tableDialogVisible.value = false
    loadTables()
  } catch {} finally { opLoading.value = false }
}

async function doCheckin() {
  opLoading.value = true
  try {
    await diningTableApi.checkinSession(currentTable.value.session.id, { guest_count: 2 })
    ElMessage.success('入座成功')
    tableDialogVisible.value = false
    loadTables()
  } catch {} finally { opLoading.value = false }
}

async function doCancelReserve() {
  opLoading.value = true
  try {
    await diningTableApi.cancelReserve(currentTable.value.session.id)
    ElMessage.success('已取消预订')
    tableDialogVisible.value = false
    loadTables()
  } catch {} finally { opLoading.value = false }
}

async function addDish(dish) {
  try {
    await diningTableApi.addItem(currentTable.value.session.id, { dish_id: dish.id, quantity: 1 })
    await loadSessionItems(currentTable.value.session.id)
    ElMessage.success(`已点 ${dish.name}`)
  } catch {}
}

async function changeQty(item, delta) {
  const newQty = item.quantity + delta
  if (newQty <= 0) {
    await ElMessageBox.confirm('确认移除该菜品？', '提示', { type: 'warning' })
    await diningTableApi.removeItem(currentTable.value.session.id, item.id)
  } else {
    await diningTableApi.updateItem(currentTable.value.session.id, item.id, { quantity: newQty })
  }
  await loadSessionItems(currentTable.value.session.id)
}

async function doCheckout() {
  if (!sessionItems.value.length) return ElMessage.warning('请先点菜')
  opLoading.value = true
  try {
    await diningTableApi.checkout(currentTable.value.session.id, {
      ...checkoutForm.value,
      total_amount: totalAmount.value,
      discount_amount: checkoutForm.value.discount,
    })
    ElMessage.success('结账成功')
    tableDialogVisible.value = false
    loadTables()
  } catch {} finally { opLoading.value = false }
}

async function doRelease() {
  await ElMessageBox.confirm('确认释放桌台（不结账）？', '警告', { type: 'warning' })
  opLoading.value = true
  try {
    await diningTableApi.release(currentTable.value.session.id)
    ElMessage.success('已释放')
    tableDialogVisible.value = false
    loadTables()
  } catch {} finally { opLoading.value = false }
}

onMounted(loadTables)
</script>

<style scoped>
.table-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
}
.table-card {
  border-radius: 10px; padding: 14px 12px; cursor: pointer;
  transition: all 0.2s; border: 2px solid transparent;
  text-align: center;
}
.table-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
.table-card.free { background: #f6ffed; border-color: #b7eb8f; }
.table-card.reserved { background: #fff7e6; border-color: #ffd591; }
.table-card.occupied { background: #e6f7ff; border-color: #91d5ff; }
.table-name { font-size: 16px; font-weight: 700; color: #222; }
.table-type { font-size: 12px; color: #888; margin-top: 4px; }
.table-status { font-size: 12px; font-weight: 600; margin-top: 4px; }
.table-card.free .table-status { color: #52c41a; }
.table-card.reserved .table-status { color: #fa8c16; }
.table-card.occupied .table-status { color: #1890ff; }
.table-amount { font-size: 14px; color: #1890ff; font-weight: 700; margin-top: 4px; }
.table-guest { font-size: 12px; color: #fa8c16; margin-top: 4px; }

.action-zone { padding: 8px 0; }
.order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.qty-ctrl { display: flex; align-items: center; gap: 6px; }
.total-row { text-align: right; padding: 10px 0; border-top: 1px dashed #eee; font-size: 14px; }

.checkout-panel { padding: 12px; background: #fafafa; border-radius: 8px; }
.checkout-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }

.dish-picker { display: flex; height: 400px; }
.category-nav { width: 90px; overflow-y: auto; background: #f5f5f5; border-radius: 4px; flex-shrink: 0; }
.cat-item { padding: 10px 8px; font-size: 13px; cursor: pointer; text-align: center; }
.cat-item.active { background: #1890ff; color: #fff; }
.dish-list { flex: 1; overflow-y: auto; padding-left: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; align-content: start; }
.dish-item { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid #eee; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
.dish-item:hover { border-color: #1890ff; background: #e6f7ff; }
.dish-item.unavailable { opacity: 0.4; cursor: not-allowed; }
.dish-img { width: 44px; height: 44px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
.dish-img-placeholder { width: 44px; height: 44px; border-radius: 6px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 20px; flex-shrink: 0; }
.dish-info { flex: 1; min-width: 0; }
.dish-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dish-price { font-size: 12px; color: #fa8c16; }
.add-icon { font-size: 20px; color: #1890ff; flex-shrink: 0; }
</style>
