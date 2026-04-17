<template>
  <div class="hotel-rooms-page">
    <el-tabs v-model="activeTab">
      <!-- 客房列表 -->
      <el-tab-pane label="客房管理" name="rooms">
        <div class="toolbar">
          <div class="toolbar-left">
            <el-button type="primary" size="small" @click="openRoomDialog()"><el-icon><Plus /></el-icon> 新增客房</el-button>
            <el-input v-model="roomSearch" placeholder="搜索房间号" size="small" clearable style="width:160px" />
            <el-select v-model="roomFilterType" size="small" placeholder="房型" clearable style="width:120px" @change="loadRooms">
              <el-option v-for="t in roomTypes" :key="t.id" :label="t.name" :value="t.id" />
            </el-select>
          </div>
          <el-button size="small" @click="loadRooms"><el-icon><Refresh /></el-icon></el-button>
        </div>
        <el-table :data="filteredRooms" stripe size="small" v-loading="loadingRooms">
          <el-table-column prop="room_no" label="房间号" width="90" />
          <el-table-column prop="type_name" label="房型" width="120" />
          <el-table-column prop="floor" label="楼层" width="70" />
          <el-table-column prop="price" label="价格" width="90"><template #default="{row}">¥{{ row.price }}/晚</template></el-table-column>
          <el-table-column prop="status" label="状态" width="90">
            <template #default="{row}">
              <el-tag :type="roomStatusType(row.status)" size="small">{{ roomStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{row}">
              <el-button size="small" @click="openRoomDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="deleteRoom(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 房型管理 -->
      <el-tab-pane label="房型管理" name="types">
        <div class="toolbar">
          <el-button type="primary" size="small" @click="openTypeDialog()"><el-icon><Plus /></el-icon> 新增房型</el-button>
        </div>
        <el-table :data="roomTypes" stripe size="small" v-loading="loadingTypes">
          <el-table-column prop="name" label="房型名称" width="140" />
          <el-table-column prop="description" label="描述" />
          <el-table-column prop="base_price" label="基础价格" width="110"><template #default="{row}">¥{{ row.base_price }}/晚</template></el-table-column>
          <el-table-column prop="capacity" label="容纳人数" width="90" />
          <el-table-column prop="area" label="面积(㎡)" width="90" />
          <el-table-column prop="facilities" label="设施" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{row}">
              <el-button size="small" @click="openTypeDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="deleteType(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 客房弹窗 -->
    <el-dialog v-model="roomDialogVisible" :title="roomEditId ? '编辑客房' : '新增客房'" width="480px" :fullscreen="isMobile">
      <el-form :model="roomForm" :rules="roomRules" ref="roomFormRef" label-width="90px" size="small">
        <el-form-item label="房间号" prop="room_no"><el-input v-model="roomForm.room_no" /></el-form-item>
        <el-form-item label="房型" prop="room_type_id">
          <el-select v-model="roomForm.room_type_id" style="width:100%">
            <el-option v-for="t in roomTypes" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="楼层" prop="floor"><el-input-number v-model="roomForm.floor" :min="1" :max="99" style="width:100%" /></el-form-item>
        <el-form-item label="价格/晚" prop="price"><el-input-number v-model="roomForm.price" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="roomForm.remark" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roomDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRoom" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>

    <!-- 房型弹窗 -->
    <el-dialog v-model="typeDialogVisible" :title="typeEditId ? '编辑房型' : '新增房型'" width="480px" :fullscreen="isMobile">
      <el-form :model="typeForm" :rules="typeRules" ref="typeFormRef" label-width="90px" size="small">
        <el-form-item label="房型名称" prop="name"><el-input v-model="typeForm.name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="typeForm.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="基础价格"><el-input-number v-model="typeForm.base_price" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="容纳人数"><el-input-number v-model="typeForm.capacity" :min="1" style="width:100%" /></el-form-item>
        <el-form-item label="面积(㎡)"><el-input-number v-model="typeForm.area" :min="0" style="width:100%" /></el-form-item>
        <el-form-item label="设施配备"><el-input v-model="typeForm.facilities" placeholder="如：WiFi、空调、独立卫浴" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="typeForm.sort_order" :min="0" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="typeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitType" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { hotelRoomApi } from '@/api/index'
import { ElMessage, ElMessageBox } from 'element-plus'

const isMobile = ref(window.innerWidth <= 768)
const activeTab = ref('rooms')
const rooms = ref([]), roomTypes = ref([])
const loadingRooms = ref(false), loadingTypes = ref(false), submitting = ref(false)
const roomSearch = ref(''), roomFilterType = ref('')

const roomDialogVisible = ref(false), roomEditId = ref(null)
const typeDialogVisible = ref(false), typeEditId = ref(null)
const roomFormRef = ref(), typeFormRef = ref()

const roomForm = ref({ room_no: '', room_type_id: null, floor: 1, price: 0, remark: '' })
const roomRules = { room_no: [{ required: true, message: '请输入房间号' }], room_type_id: [{ required: true, message: '请选择房型' }] }
const typeForm = ref({ name: '', description: '', base_price: 0, capacity: 2, area: 0, facilities: '', sort_order: 0 })
const typeRules = { name: [{ required: true, message: '请输入房型名称' }] }

const filteredRooms = computed(() => {
  let list = rooms.value
  if (roomSearch.value) list = list.filter(r => r.room_no.includes(roomSearch.value))
  if (roomFilterType.value) list = list.filter(r => r.room_type_id == roomFilterType.value)
  return list
})

function roomStatusLabel(s) { return { vacant: '空闲', occupied: '在住', cleaning: '待清洁', maintenance: '维修', reserved: '预定' }[s] || s }
function roomStatusType(s) { return { vacant: 'success', occupied: 'primary', cleaning: 'warning', maintenance: 'danger', reserved: '' }[s] || '' }

async function loadRooms() {
  loadingRooms.value = true
  try { rooms.value = await hotelRoomApi.getAll() || [] } catch {} finally { loadingRooms.value = false }
}
async function loadTypes() {
  loadingTypes.value = true
  try { roomTypes.value = await hotelRoomApi.getTypes() || [] } catch {} finally { loadingTypes.value = false }
}

function openRoomDialog(row) {
  roomEditId.value = row ? row.id : null
  roomForm.value = row ? { ...row } : { room_no: '', room_type_id: null, floor: 1, price: 0, remark: '' }
  roomDialogVisible.value = true
}
async function submitRoom() {
  await roomFormRef.value.validate()
  submitting.value = true
  try {
    if (roomEditId.value) await hotelRoomApi.update(roomEditId.value, roomForm.value)
    else await hotelRoomApi.create(roomForm.value)
    ElMessage.success('保存成功')
    roomDialogVisible.value = false
    loadRooms()
  } catch {} finally { submitting.value = false }
}
async function deleteRoom(row) {
  await ElMessageBox.confirm(`确认删除房间 ${row.room_no}？`, '警告', { type: 'warning' })
  await hotelRoomApi.remove(row.id)
  ElMessage.success('已删除')
  loadRooms()
}

function openTypeDialog(row) {
  typeEditId.value = row ? row.id : null
  typeForm.value = row ? { ...row } : { name: '', description: '', base_price: 0, capacity: 2, area: 0, facilities: '', sort_order: 0 }
  typeDialogVisible.value = true
}
async function submitType() {
  await typeFormRef.value.validate()
  submitting.value = true
  try {
    if (typeEditId.value) await hotelRoomApi.updateType(typeEditId.value, typeForm.value)
    else await hotelRoomApi.createType(typeForm.value)
    ElMessage.success('保存成功')
    typeDialogVisible.value = false
    loadTypes()
  } catch {} finally { submitting.value = false }
}
async function deleteType(row) {
  await ElMessageBox.confirm(`确认删除房型「${row.name}」？`, '警告', { type: 'warning' })
  await hotelRoomApi.removeType(row.id)
  ElMessage.success('已删除')
  loadTypes()
}

onMounted(() => { loadRooms(); loadTypes() })
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.toolbar-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
</style>
