<template>
  <div class="room-status-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-radio-group v-model="filterStatus" size="small" @change="loadData">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="vacant">空闲</el-radio-button>
          <el-radio-button value="occupied">在住</el-radio-button>
          <el-radio-button value="cleaning">待清洁</el-radio-button>
          <el-radio-button value="maintenance">维修</el-radio-button>
        </el-radio-group>
      </div>
      <div class="toolbar-right">
        <el-select v-model="filterFloor" placeholder="楼层" clearable size="small" style="width:90px" @change="loadData">
          <el-option v-for="f in floors" :key="f" :label="`${f}楼`" :value="f" />
        </el-select>
        <el-button size="small" @click="loadData"><el-icon><Refresh /></el-icon></el-button>
      </div>
    </div>

    <!-- 图例 -->
    <div class="legend">
      <span v-for="s in statusConfig" :key="s.value" class="legend-item">
        <span class="dot" :style="{ background: s.color }"></span>{{ s.label }}
      </span>
    </div>

    <!-- 楼层分组 -->
    <div v-for="floor in displayFloors" :key="floor" class="floor-section">
      <div class="floor-label">{{ floor }} 楼</div>
      <div class="room-grid">
        <div
          v-for="room in roomsByFloor[floor]"
          :key="room.id"
          class="room-card"
          :class="room.status"
          @click="clickRoom(room)"
        >
          <div class="room-no">{{ room.room_no }}</div>
          <div class="room-type">{{ room.type_name }}</div>
          <div class="room-status-tag">{{ getStatusLabel(room.status) }}</div>
          <div class="room-price">¥{{ room.price }}</div>
          <div v-if="room.status === 'occupied' && room.checkin_info" class="room-guest">
            {{ room.checkin_info.guest_name }}
          </div>
        </div>
      </div>
    </div>

    <!-- 操作弹窗 -->
    <el-dialog v-model="actionVisible" :title="actionTitle" width="420px" :fullscreen="isMobile">
      <div v-if="selectedRoom" class="room-detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="房间号">{{ selectedRoom.room_no }}</el-descriptions-item>
          <el-descriptions-item label="房型">{{ selectedRoom.type_name }}</el-descriptions-item>
          <el-descriptions-item label="楼层">{{ selectedRoom.floor }} 楼</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(selectedRoom.status)" size="small">{{ getStatusLabel(selectedRoom.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="价格">¥{{ selectedRoom.price }}/晚</el-descriptions-item>
        </el-descriptions>

        <div v-if="selectedRoom.status === 'occupied' && selectedRoom.checkin_info" style="margin-top:12px">
          <el-descriptions :column="2" border size="small" title="当前住客">
            <el-descriptions-item label="姓名">{{ selectedRoom.checkin_info.guest_name }}</el-descriptions-item>
            <el-descriptions-item label="电话">{{ selectedRoom.checkin_info.guest_phone }}</el-descriptions-item>
            <el-descriptions-item label="入住">{{ selectedRoom.checkin_info.checkin_date }}</el-descriptions-item>
            <el-descriptions-item label="预计退房">{{ selectedRoom.checkin_info.expected_checkout }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="action-buttons" style="margin-top:16px">
          <el-button v-if="selectedRoom.status === 'vacant'" type="primary" @click="goCheckin">
            <el-icon><User /></el-icon> 办理入住
          </el-button>
          <el-button
            v-if="['vacant','occupied'].includes(selectedRoom.status)"
            :type="selectedRoom.status === 'cleaning' ? 'success' : 'warning'"
            @click="changeStatus('cleaning')"
          >
            {{ selectedRoom.status === 'cleaning' ? '标记已清洁' : '标记待清洁' }}
          </el-button>
          <el-button
            v-if="selectedRoom.status !== 'maintenance'"
            type="danger" plain
            @click="changeStatus('maintenance')"
          >维修中</el-button>
          <el-button v-if="selectedRoom.status === 'maintenance'" type="success" @click="changeStatus('vacant')">
            维修完成
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { hotelRoomApi } from '@/api/index'
import { ElMessage } from 'element-plus'
import http from '@/api/http'

const router = useRouter()
const isMobile = ref(window.innerWidth <= 768)

const rooms = ref([])
const filterStatus = ref('')
const filterFloor = ref('')
const floors = ref([])
const actionVisible = ref(false)
const selectedRoom = ref(null)

const statusConfig = [
  { value: 'vacant', label: '空闲', color: '#52c41a' },
  { value: 'occupied', label: '在住', color: '#1890ff' },
  { value: 'reserved', label: '预定', color: '#fa8c16' },
  { value: 'cleaning', label: '待清洁', color: '#faad14' },
  { value: 'maintenance', label: '维修', color: '#ff4d4f' },
]

function getStatusLabel(s) { return statusConfig.find(c => c.value === s)?.label || s }
function getStatusType(s) {
  const m = { vacant: 'success', occupied: 'primary', reserved: 'warning', cleaning: 'warning', maintenance: 'danger' }
  return m[s] || 'info'
}

const filteredRooms = computed(() => {
  let list = rooms.value
  if (filterStatus.value) list = list.filter(r => r.status === filterStatus.value)
  if (filterFloor.value) list = list.filter(r => r.floor == filterFloor.value)
  return list
})

const displayFloors = computed(() => [...new Set(filteredRooms.value.map(r => r.floor))].sort((a, b) => a - b))
const roomsByFloor = computed(() => {
  const m = {}
  for (const r of filteredRooms.value) {
    if (!m[r.floor]) m[r.floor] = []
    m[r.floor].push(r)
  }
  return m
})

const actionTitle = computed(() => selectedRoom.value ? `${selectedRoom.value.room_no} - ${selectedRoom.value.type_name}` : '')

async function loadData() {
  try {
    const data = await hotelRoomApi.getAll({ withCheckin: 1 })
    rooms.value = data
    const fs = [...new Set(data.map(r => r.floor))].sort((a, b) => a - b)
    floors.value = fs
  } catch {}
}

function clickRoom(room) {
  selectedRoom.value = room
  actionVisible.value = true
}

function goCheckin() {
  actionVisible.value = false
  router.push(`/checkins?room_id=${selectedRoom.value.id}&room_no=${selectedRoom.value.room_no}`)
}

async function changeStatus(status) {
  try {
    await http.patch(`/hotel-rooms/${selectedRoom.value.id}/status`, { status })
    ElMessage.success('状态已更新')
    selectedRoom.value.status = status
    actionVisible.value = false
    loadData()
  } catch {}
}

onMounted(loadData)
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.toolbar-right { display: flex; align-items: center; gap: 8px; }
.legend { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; font-size: 13px; }
.legend-item { display: flex; align-items: center; gap: 4px; color: #666; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

.floor-section { margin-bottom: 20px; }
.floor-label { font-size: 13px; font-weight: 600; color: #555; margin-bottom: 8px; padding-left: 4px; border-left: 3px solid var(--primary, #1890ff); }

.room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }

.room-card {
  border-radius: 8px; padding: 10px; cursor: pointer; transition: all 0.2s;
  border: 2px solid transparent; position: relative;
}
.room-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
.room-card.vacant { background: #f6ffed; border-color: #b7eb8f; }
.room-card.occupied { background: #e6f7ff; border-color: #91d5ff; }
.room-card.reserved { background: #fff7e6; border-color: #ffd591; }
.room-card.cleaning { background: #fffbe6; border-color: #ffe58f; }
.room-card.maintenance { background: #fff1f0; border-color: #ffa39e; }
.room-no { font-size: 16px; font-weight: 700; color: #222; }
.room-type { font-size: 11px; color: #888; margin-top: 2px; }
.room-status-tag { font-size: 11px; font-weight: 600; margin-top: 4px; }
.room-card.vacant .room-status-tag { color: #52c41a; }
.room-card.occupied .room-status-tag { color: #1890ff; }
.room-card.reserved .room-status-tag { color: #fa8c16; }
.room-card.cleaning .room-status-tag { color: #faad14; }
.room-card.maintenance .room-status-tag { color: #ff4d4f; }
.room-price { font-size: 12px; color: #999; margin-top: 4px; }
.room-guest { font-size: 11px; color: #1890ff; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.action-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
