<template>
  <div class="retail-page">
    <el-row :gutter="16">
      <!-- 左侧：商品选择区 -->
      <el-col :xs="24" :sm="15">
        <div class="product-panel">
          <!-- 搜索 + 分类 -->
          <div class="panel-toolbar">
            <el-input v-model="productSearch" placeholder="搜索商品/条码" size="small" clearable prefix-icon="Search" style="width:200px" @input="filterProducts" />
            <div class="cat-tabs">
              <div
                class="cat-tab"
                :class="{ active: activeCat === null }"
                @click="activeCat = null"
              >全部</div>
              <div
                v-for="c in categories"
                :key="c.id"
                class="cat-tab"
                :class="{ active: activeCat === c.id }"
                @click="activeCat = c.id"
              >{{ c.name }}</div>
            </div>
          </div>
          <!-- 商品网格 -->
          <div class="product-grid">
            <div
              v-for="p in displayProducts"
              :key="p.id"
              class="product-card"
              :class="{ oos: !p.is_available || p.stock <= 0 }"
              @click="addToCart(p)"
            >
              <div class="product-name">{{ p.name }}</div>
              <div class="product-price">¥{{ p.price }}</div>
              <div class="product-stock" :class="p.stock <= 5 ? 'low' : ''">库存 {{ p.stock }}</div>
            </div>
          </div>
        </div>
      </el-col>

      <!-- 右侧：购物车 + 结算 -->
      <el-col :xs="24" :sm="9">
        <div class="cart-panel">
          <div class="cart-title">
            <span>购物车</span>
            <el-button text size="small" type="danger" @click="clearCart" v-if="cart.length">清空</el-button>
          </div>
          <div class="cart-items" ref="cartRef">
            <div v-if="!cart.length" class="cart-empty">点击商品加入购物车</div>
            <div v-for="item in cart" :key="item.id" class="cart-item">
              <div class="ci-name">{{ item.name }}</div>
              <div class="ci-controls">
                <el-button size="small" circle @click="decItem(item)"><el-icon><Minus /></el-icon></el-button>
                <span class="ci-qty">{{ item.qty }}</span>
                <el-button size="small" circle @click="item.qty++"><el-icon><Plus /></el-icon></el-button>
                <span class="ci-sub">¥{{ (item.price * item.qty).toFixed(2) }}</span>
              </div>
            </div>
          </div>

          <!-- 关联入住（可选） -->
          <div class="cart-extra">
            <el-select v-model="checkinId" placeholder="关联住客（可选）" clearable size="small" filterable style="width:100%">
              <el-option v-for="c in activeCheckins" :key="c.id" :label="`${c.room_no} - ${c.guest_name}`" :value="c.id" />
            </el-select>
          </div>

          <!-- 合计 + 收款 -->
          <div class="cart-footer">
            <div class="total-line">
              <span>商品合计</span><span>¥{{ cartTotal }}</span>
            </div>
            <div class="discount-line">
              <span>优惠</span>
              <el-input-number v-model="discount" :min="0" :max="cartTotal" :precision="2" size="small" style="width:120px" @change="calcPayAmount" />
            </div>
            <div class="pay-line">
              <span>实收</span>
              <el-input-number v-model="payAmount" :min="0" :precision="2" size="small" style="width:120px" />
            </div>
            <div class="pay-type-row">
              <el-radio-group v-model="payType" size="small">
                <el-radio-button value="cash">现金</el-radio-button>
                <el-radio-button value="wechat">微信</el-radio-button>
                <el-radio-button value="alipay">支付宝</el-radio-button>
                <el-radio-button value="card">银行卡</el-radio-button>
              </el-radio-group>
            </div>
            <el-button type="primary" size="large" style="width:100%;margin-top:10px" @click="submitOrder" :loading="submitting" :disabled="!cart.length">
              收款 ¥{{ payAmount }}
            </el-button>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 结账成功提示 -->
    <el-dialog v-model="successVisible" title="收款成功" width="360px" center>
      <div style="text-align:center">
        <el-icon style="font-size:60px;color:#52c41a"><CircleCheckFilled /></el-icon>
        <div style="font-size:24px;font-weight:700;margin:12px 0;color:#1a1a1a">¥{{ lastOrder?.pay_amount }}</div>
        <div style="color:#888;font-size:14px">订单号：{{ lastOrder?.order_no }}</div>
      </div>
      <template #footer>
        <el-button type="primary" @click="successVisible = false">继续收银</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { productApi, productCategoryApi, retailOrderApi, checkinApi } from '@/api/index'
import { ElMessage } from 'element-plus'

const products = ref([]), categories = ref([])
const activeCat = ref(null), productSearch = ref('')
const cart = ref([])
const discount = ref(0), payType = ref('cash'), payAmount = ref(0)
const checkinId = ref(null), activeCheckins = ref([])
const submitting = ref(false), successVisible = ref(false), lastOrder = ref(null)

const cartTotal = computed(() => cart.value.reduce((s, i) => s + i.price * i.qty, 0))
const displayProducts = computed(() => {
  let list = products.value
  if (activeCat.value) list = list.filter(p => p.category_id === activeCat.value)
  if (productSearch.value) list = list.filter(p => p.name.includes(productSearch.value) || (p.barcode || '').includes(productSearch.value))
  return list
})

function calcPayAmount() {
  payAmount.value = parseFloat(Math.max(0, cartTotal.value - discount.value).toFixed(2))
}

function addToCart(p) {
  if (!p.is_available || p.stock <= 0) return ElMessage.warning('该商品暂时无法购买')
  const exists = cart.value.find(i => i.id === p.id)
  if (exists) { exists.qty++ }
  else cart.value.push({ id: p.id, name: p.name, price: p.price, qty: 1 })
  calcPayAmount()
}

function decItem(item) {
  if (item.qty <= 1) cart.value = cart.value.filter(i => i.id !== item.id)
  else item.qty--
  calcPayAmount()
}

function clearCart() { cart.value = []; discount.value = 0; payAmount.value = 0 }

function filterProducts() {}

async function loadProducts() {
  try {
    products.value = await productApi.getAll({ available: 1 }) || []
    categories.value = await productCategoryApi.getAll() || []
    const checkins = await checkinApi.getList({ status: 'checked_in', pageSize: 200 })
    activeCheckins.value = checkins.list || []
  } catch {}
}

async function submitOrder() {
  if (!cart.value.length) return
  submitting.value = true
  try {
    const items = cart.value.map(i => ({ product_id: i.id, quantity: i.qty }))
    const res = await retailOrderApi.create({
      items, checkin_id: checkinId.value || null,
      total_amount: cartTotal.value,
      discount_amount: discount.value,
      pay_amount: payAmount.value,
      pay_type: payType.value,
    })
    lastOrder.value = res
    successVisible.value = true
    clearCart()
    checkinId.value = null
    loadProducts()
  } catch {} finally { submitting.value = false }
}

onMounted(loadProducts)
</script>

<style scoped>
.product-panel { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); min-height: calc(100vh - 120px); }
.panel-toolbar { margin-bottom: 12px; }
.cat-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.cat-tab { padding: 4px 12px; border-radius: 20px; font-size: 13px; cursor: pointer; background: #f5f5f5; border: 1px solid #e0e0e0; transition: all 0.2s; }
.cat-tab.active { background: #1890ff; color: #fff; border-color: #1890ff; }

.product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
.product-card {
  padding: 12px 8px; border-radius: 8px; border: 2px solid #eee; cursor: pointer;
  transition: all 0.2s; text-align: center;
}
.product-card:hover { border-color: #1890ff; box-shadow: 0 2px 8px rgba(24,144,255,0.2); }
.product-card.oos { opacity: 0.4; cursor: not-allowed; }
.product-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.product-price { font-size: 15px; color: #fa8c16; font-weight: 700; margin-bottom: 2px; }
.product-stock { font-size: 11px; color: #999; }
.product-stock.low { color: #ff4d4f; }

.cart-panel { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); min-height: calc(100vh - 120px); display: flex; flex-direction: column; }
.cart-title { font-size: 15px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.cart-items { flex: 1; overflow-y: auto; min-height: 200px; max-height: 400px; }
.cart-empty { text-align: center; color: #bbb; padding: 40px 0; font-size: 13px; }
.cart-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
.ci-name { font-size: 13px; flex: 1; margin-right: 8px; }
.ci-controls { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.ci-qty { min-width: 20px; text-align: center; font-weight: 600; }
.ci-sub { font-size: 13px; color: #fa8c16; min-width: 60px; text-align: right; }

.cart-extra { padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.cart-footer { padding-top: 10px; }
.total-line, .discount-line, .pay-line { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 14px; }
.total-line { font-size: 16px; font-weight: 700; }
.pay-type-row { margin-top: 8px; }
</style>
