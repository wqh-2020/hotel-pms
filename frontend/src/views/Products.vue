<template>
  <div class="products-page">
    <el-tabs v-model="activeTab">
      <!-- 商品管理 -->
      <el-tab-pane label="商品管理" name="products">
        <div class="toolbar">
          <div class="toolbar-left">
            <el-button type="primary" size="small" @click="openDialog()"><el-icon><Plus /></el-icon> 新增商品</el-button>
            <el-input v-model="search" placeholder="搜索商品名/条码" size="small" clearable style="width:180px" @input="loadProducts" />
            <el-select v-model="filterCat" size="small" placeholder="分类" clearable style="width:110px" @change="loadProducts">
              <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </div>
          <el-button size="small" @click="loadProducts"><el-icon><Refresh /></el-icon></el-button>
        </div>
        <el-table :data="products" stripe size="small" v-loading="loading">
          <el-table-column label="图片" width="60">
            <template #default="{row}">
              <el-image v-if="row.image" :src="row.image" style="width:40px;height:40px;border-radius:4px" fit="cover" />
              <div v-else style="width:40px;height:40px;background:#f5f5f5;border-radius:4px"></div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="商品名称" />
          <el-table-column prop="barcode" label="条码" width="130" />
          <el-table-column prop="category_name" label="分类" width="90" />
          <el-table-column label="售价" width="90"><template #default="{row}">¥{{ row.price }}</template></el-table-column>
          <el-table-column label="成本" width="80"><template #default="{row}">¥{{ row.cost_price }}</template></el-table-column>
          <el-table-column prop="stock" label="库存" width="80"><template #default="{row}"><span :style="{ color: row.stock <= 5 ? '#ff4d4f' : 'inherit' }">{{ row.stock }}</span></template></el-table-column>
          <el-table-column prop="unit" label="单位" width="60" />
          <el-table-column label="状态" width="80">
            <template #default="{row}">
              <el-switch v-model="row.is_available" :active-value="1" :inactive-value="0" @change="toggleProduct(row)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{row}">
              <el-button size="small" @click="openDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="deleteProduct(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 商品分类 -->
      <el-tab-pane label="分类管理" name="categories">
        <div class="toolbar">
          <el-button type="primary" size="small" @click="openCatDialog()"><el-icon><Plus /></el-icon> 新增分类</el-button>
        </div>
        <el-table :data="categories" stripe size="small">
          <el-table-column prop="name" label="分类名称" />
          <el-table-column prop="sort_order" label="排序" width="80" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{row}">
              <el-button size="small" @click="openCatDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="deleteCat(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 商品弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editId ? '编辑商品' : '新增商品'" width="520px" :fullscreen="isMobile">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px" size="small">
        <el-form-item label="商品名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="所属分类">
          <el-select v-model="form.category_id" style="width:100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="商品条码"><el-input v-model="form.barcode" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="售价" prop="price"><el-input-number v-model="form.price" :min="0" :precision="2" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="成本价"><el-input-number v-model="form.cost_price" :min="0" :precision="2" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="库存"><el-input-number v-model="form.stock" :min="0" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位"><el-input v-model="form.unit" /></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" :min="0" style="width:100%" /></el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.is_available" :active-value="1" :inactive-value="0" active-text="上架" inactive-text="下架" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitProduct" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分类弹窗 -->
    <el-dialog v-model="catDialogVisible" :title="catEditId ? '编辑分类' : '新增分类'" width="380px">
      <el-form :model="catForm" ref="catFormRef" label-width="80px" size="small">
        <el-form-item label="分类名称" :rules="[{ required: true }]"><el-input v-model="catForm.name" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="catForm.sort_order" :min="0" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="catDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCat" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { productApi, productCategoryApi } from '@/api/index'
import { ElMessage, ElMessageBox } from 'element-plus'

const isMobile = ref(window.innerWidth <= 768)
const activeTab = ref('products')
const loading = ref(false), submitting = ref(false)
const products = ref([]), categories = ref([])
const search = ref(''), filterCat = ref('')
const dialogVisible = ref(false), editId = ref(null)
const catDialogVisible = ref(false), catEditId = ref(null)
const formRef = ref(), catFormRef = ref()
const form = ref({ name: '', category_id: null, barcode: '', price: 0, cost_price: 0, stock: 0, unit: '个', description: '', sort_order: 0, is_available: 1 })
const rules = { name: [{ required: true, message: '请输入商品名称' }], price: [{ required: true }] }
const catForm = ref({ name: '', sort_order: 0 })

async function loadProducts() {
  loading.value = true
  try { products.value = await productApi.getAll({ search: search.value, category_id: filterCat.value }) || [] } catch {} finally { loading.value = false }
}
async function loadCategories() {
  try { categories.value = await productCategoryApi.getAll() || [] } catch {}
}

function openDialog(row) {
  editId.value = row ? row.id : null
  form.value = row ? { ...row } : { name: '', category_id: null, barcode: '', price: 0, cost_price: 0, stock: 0, unit: '个', description: '', sort_order: 0, is_available: 1 }
  dialogVisible.value = true
}
async function submitProduct() {
  await formRef.value.validate()
  submitting.value = true
  try {
    if (editId.value) await productApi.update(editId.value, form.value)
    else await productApi.create(form.value)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadProducts()
  } catch {} finally { submitting.value = false }
}
async function toggleProduct(row) { await productApi.toggle(row.id) }
async function deleteProduct(row) {
  await ElMessageBox.confirm(`确认删除「${row.name}」？`, '警告', { type: 'warning' })
  await productApi.remove(row.id)
  ElMessage.success('已删除')
  loadProducts()
}

function openCatDialog(row) {
  catEditId.value = row ? row.id : null
  catForm.value = row ? { ...row } : { name: '', sort_order: 0 }
  catDialogVisible.value = true
}
async function submitCat() {
  submitting.value = true
  try {
    if (catEditId.value) await productCategoryApi.update(catEditId.value, catForm.value)
    else await productCategoryApi.create(catForm.value)
    ElMessage.success('保存成功')
    catDialogVisible.value = false
    loadCategories()
  } catch {} finally { submitting.value = false }
}
async function deleteCat(row) {
  await ElMessageBox.confirm(`确认删除分类「${row.name}」？`, '警告', { type: 'warning' })
  await productCategoryApi.remove(row.id)
  ElMessage.success('已删除')
  loadCategories()
}

onMounted(() => { loadProducts(); loadCategories() })
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.toolbar-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
</style>
