<template>
  <div class="dishes-page">
    <el-tabs v-model="activeTab">
      <!-- 菜品管理 -->
      <el-tab-pane label="菜品管理" name="dishes">
        <div class="toolbar">
          <div class="toolbar-left">
            <el-button type="primary" size="small" @click="openDishDialog()"><el-icon><Plus /></el-icon> 新增菜品</el-button>
            <el-input v-model="dishSearch" placeholder="搜索菜品" size="small" clearable style="width:160px" @input="loadDishes" />
            <el-select v-model="dishCat" size="small" placeholder="分类" clearable style="width:110px" @change="loadDishes">
              <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
            <el-radio-group v-model="dishAvail" size="small" @change="loadDishes">
              <el-radio-button :value="''">全部</el-radio-button>
              <el-radio-button :value="1">已上架</el-radio-button>
              <el-radio-button :value="0">已下架</el-radio-button>
            </el-radio-group>
          </div>
          <el-button size="small" @click="loadDishes"><el-icon><Refresh /></el-icon></el-button>
        </div>
        <el-table :data="dishes" stripe size="small" v-loading="loading">
          <el-table-column label="图片" width="70">
            <template #default="{row}">
              <el-image v-if="row.image" :src="row.image" style="width:44px;height:44px;border-radius:4px" fit="cover" />
              <div v-else style="width:44px;height:44px;background:#f5f5f5;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#ccc"><el-icon><Bowl /></el-icon></div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="category_name" label="分类" width="90" />
          <el-table-column label="价格" width="90"><template #default="{row}">¥{{ row.price }}/{{ row.unit }}</template></el-table-column>
          <el-table-column prop="description" label="描述" show-overflow-tooltip />
          <el-table-column label="状态" width="80">
            <template #default="{row}">
              <el-switch v-model="row.is_available" :active-value="1" :inactive-value="0" @change="toggleDish(row)" />
            </template>
          </el-table-column>
          <el-table-column prop="sort_order" label="排序" width="70" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{row}">
              <el-button size="small" @click="openDishDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="deleteDish(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 分类管理 -->
      <el-tab-pane label="分类管理" name="categories">
        <div class="toolbar">
          <el-button type="primary" size="small" @click="openCatDialog()"><el-icon><Plus /></el-icon> 新增分类</el-button>
        </div>
        <el-table :data="categories" stripe size="small" v-loading="loadingCat">
          <el-table-column prop="name" label="分类名称" />
          <el-table-column prop="sort_order" label="排序" width="80" />
          <el-table-column prop="created_at" label="创建时间" width="160" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{row}">
              <el-button size="small" @click="openCatDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="deleteCat(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 菜品弹窗 -->
    <el-dialog v-model="dishDialogVisible" :title="dishEditId ? '编辑菜品' : '新增菜品'" width="520px" :fullscreen="isMobile">
      <el-form :model="dishForm" :rules="dishRules" ref="dishFormRef" label-width="80px" size="small">
        <el-form-item label="菜品图片">
          <el-upload
            :action="uploadUrl" :headers="uploadHeaders" name="image"
            :show-file-list="false" accept="image/*" :on-success="onImageSuccess"
          >
            <img v-if="dishForm.image" :src="dishForm.image" class="preview-img" />
            <div v-else class="upload-placeholder"><el-icon><Plus /></el-icon> 上传图片</div>
          </el-upload>
        </el-form-item>
        <el-form-item label="菜品名称" prop="name"><el-input v-model="dishForm.name" /></el-form-item>
        <el-form-item label="所属分类" prop="category_id">
          <el-select v-model="dishForm.category_id" style="width:100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="价格" prop="price"><el-input-number v-model="dishForm.price" :min="0" :precision="2" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位"><el-input v-model="dishForm.unit" placeholder="份/碗/例" /></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="描述"><el-input v-model="dishForm.description" type="textarea" :rows="2" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="排序"><el-input-number v-model="dishForm.sort_order" :min="0" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-switch v-model="dishForm.is_available" :active-value="1" :inactive-value="0" active-text="上架" inactive-text="下架" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dishDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitDish" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分类弹窗 -->
    <el-dialog v-model="catDialogVisible" :title="catEditId ? '编辑分类' : '新增分类'" width="380px">
      <el-form :model="catForm" :rules="catRules" ref="catFormRef" label-width="80px" size="small">
        <el-form-item label="分类名称" prop="name"><el-input v-model="catForm.name" /></el-form-item>
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
import { ref, computed, onMounted } from 'vue'
import { dishApi, foodCategoryApi } from '@/api/index'
import { useUserStore } from '@/stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import http from '@/api/http'

const isMobile = ref(window.innerWidth <= 768)
const userStore = useUserStore()
const activeTab = ref('dishes')
const loading = ref(false), loadingCat = ref(false), submitting = ref(false)
const dishes = ref([]), categories = ref([])
const dishSearch = ref(''), dishCat = ref(''), dishAvail = ref('')

const dishDialogVisible = ref(false), dishEditId = ref(null)
const catDialogVisible = ref(false), catEditId = ref(null)
const dishFormRef = ref(), catFormRef = ref()

const dishForm = ref({ name: '', category_id: null, price: 0, unit: '份', description: '', image: '', sort_order: 0, is_available: 1 })
const dishRules = { name: [{ required: true, message: '请输入菜品名称' }], category_id: [{ required: true, message: '请选择分类' }], price: [{ required: true, message: '请输入价格' }] }
const catForm = ref({ name: '', sort_order: 0 })
const catRules = { name: [{ required: true, message: '请输入分类名称' }] }

const uploadUrl = computed(() => {
  const base = window.__ELECTRON__ ? 'http://localhost:3001' : ''
  return base + '/api/upload/dish-image'
})
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${userStore.token}` }))

async function loadDishes() {
  loading.value = true
  try {
    dishes.value = await dishApi.getAll({ search: dishSearch.value, category_id: dishCat.value, available: dishAvail.value }) || []
  } catch {} finally { loading.value = false }
}
async function loadCategories() {
  loadingCat.value = true
  try { categories.value = await foodCategoryApi.getAll() || [] } catch {} finally { loadingCat.value = false }
}

function openDishDialog(row) {
  dishEditId.value = row ? row.id : null
  dishForm.value = row ? { ...row } : { name: '', category_id: null, price: 0, unit: '份', description: '', image: '', sort_order: 0, is_available: 1 }
  dishDialogVisible.value = true
}
function onImageSuccess(res) { if (res.code === 0) dishForm.value.image = res.data.url }

async function submitDish() {
  await dishFormRef.value.validate()
  submitting.value = true
  try {
    if (dishEditId.value) await dishApi.update(dishEditId.value, dishForm.value)
    else await dishApi.create(dishForm.value)
    ElMessage.success('保存成功')
    dishDialogVisible.value = false
    loadDishes()
  } catch {} finally { submitting.value = false }
}
async function toggleDish(row) {
  await dishApi.toggle(row.id)
}
async function deleteDish(row) {
  await ElMessageBox.confirm(`确认删除「${row.name}」？`, '警告', { type: 'warning' })
  await dishApi.remove(row.id)
  ElMessage.success('已删除')
  loadDishes()
}

function openCatDialog(row) {
  catEditId.value = row ? row.id : null
  catForm.value = row ? { ...row } : { name: '', sort_order: 0 }
  catDialogVisible.value = true
}
async function submitCat() {
  await catFormRef.value.validate()
  submitting.value = true
  try {
    if (catEditId.value) await foodCategoryApi.update(catEditId.value, catForm.value)
    else await foodCategoryApi.create(catForm.value)
    ElMessage.success('保存成功')
    catDialogVisible.value = false
    loadCategories()
  } catch {} finally { submitting.value = false }
}
async function deleteCat(row) {
  await ElMessageBox.confirm(`确认删除分类「${row.name}」？`, '警告', { type: 'warning' })
  await foodCategoryApi.remove(row.id)
  ElMessage.success('已删除')
  loadCategories()
}

onMounted(() => { loadDishes(); loadCategories() })
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.toolbar-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.preview-img { width: 80px; height: 80px; object-fit: cover; border-radius: 6px; display: block; }
.upload-placeholder { width: 80px; height: 80px; border: 1px dashed #d9d9d9; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #bbb; font-size: 12px; cursor: pointer; }
</style>
