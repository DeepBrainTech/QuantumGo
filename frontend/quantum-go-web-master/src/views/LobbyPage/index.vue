<template>
  <div class="lobby">
    <h2 style="margin: 12px 0;">{{ lang.text.lobby.title }}</h2>
    <div class="filters">
      <label style="margin-right:8px;">{{ lang.text.lobby.filter_board }}:</label>
      <select v-model.number="model" style="padding:4px 8px;">
        <option :value="0">{{ lang.text.lobby.filter_all }}</option>
        <option :value="7">7x7</option>
        <option :value="9">9x9</option>
        <option :value="13">13x13</option>
        <option :value="19">19x19</option>
      </select>
      <button class="btn" @click="refresh" style="margin-left:12px;">{{ lang.text.lobby.btn_refresh }}</button>
    </div>

    <div v-if="loading" class="hint">{{ lang.text.lobby.loading }}</div>
    <div v-else-if="rooms.length === 0" class="hint">{{ lang.text.lobby.empty }}</div>
    <div v-else class="room-list">
      <div v-for="room in rooms" :key="room.room_id" class="room-card">
        <div class="meta">
          <div><strong>{{ lang.text.lobby.host }}:</strong> {{ room.owner_username }}</div>
          <div><strong>{{ lang.text.lobby.status }}:</strong> {{ statusText(room.status) }}</div>
          <div><strong>{{ lang.text.lobby.model }}:</strong> {{ room.model }}</div>
          <div><strong>{{ lang.text.lobby.created }}:</strong> {{ formatTime(room.created_at) }}</div>
        </div>
        <div class="actions">
          <button class="btn primary" @click="join(room.room_id)">{{ lang.text.lobby.btn_join }}</button>
        </div>
      </div>
    </div>
  </div>
  
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, reactive, ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import api from '@/utils/api';

type Room = {
  room_id: string;
  owner_id: string;
  owner_username: string;
  status: string;
  model: number;
  created_at?: string;
};

const router = useRouter();
const store = useStore();
const lang = computed(() => store.state.lang);
const loading = ref(false);
const model = ref<number>(0);
const rooms = reactive<Room[]>([]);
let timer: any = null;

const fetchRooms = async () => {
  loading.value = true;
  const res = await api.listRooms({ model: model.value || undefined, page: 1, size: 30 });
  rooms.splice(0, rooms.length);
  if (res.success && Array.isArray(res.data)) {
    (res.data as any[]).forEach(r => rooms.push(r));
  }
  loading.value = false;
};

const refresh = async () => {
  await fetchRooms();
};

const join = (roomId: string) => {
  router.push(`/room/${roomId}`);
};

const formatTime = (s?: string) => {
  if (!s) return '-';
  try { return new Date(s).toLocaleString(); } catch { return s; }
};

const statusText = (s?: string) => {
  const v = (s || '').toString().trim().toLowerCase();
  if (v === 'waiting') return lang.value.text.lobby.status_waiting;
  if (v === 'playing') return lang.value.text.lobby.status_playing;
  if (v === 'finished') return lang.value.text.lobby.status_finished;
  return s || '';
};

onMounted(async () => {
  await fetchRooms();
  timer = setInterval(fetchRooms, 8000);
});
onBeforeUnmount(() => { if (timer) clearInterval(timer); });
</script>

<style scoped>
.lobby { max-width: 900px; margin: 0 auto; padding: 16px; }
.filters { display:flex; align-items:center; margin-bottom: 12px; }
.room-list { display:flex; flex-direction:column; gap: 10px; }
.room-card { display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid #eee; border-radius:8px; background:#fff; }
.room-card .meta { display:grid; grid-template-columns: repeat(2, minmax(200px,1fr)); gap:6px 20px; font-size: 13px; }
.btn { padding: 6px 12px; border-radius: 6px; border: 1px solid #ccc; background: #fafafa; cursor: pointer; }
.btn.primary { background:#409eff; color:#fff; border-color:#409eff; }
.hint { color:#666; padding: 12px 0; }
</style>
