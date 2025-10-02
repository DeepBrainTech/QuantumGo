<template>
  <div class="recent">
    <h2 class="title">{{ lang.text.recent.title }}</h2>
    <div class="filters">
      <label>Status:</label>
      <select v-model="status" class="select">
        <option value="">{{ lang.text.recent.all }}</option>
        <option value="waiting">{{ lang.text.recent.waiting }}</option>
        <option value="playing">{{ lang.text.recent.playing }}</option>
        <option value="finished">{{ lang.text.recent.finished }}</option>
      </select>
      <button class="btn" @click="refresh">{{ lang.text.recent.refresh }}</button>
    </div>
    <div v-if="loading" class="hint">{{ lang.text.recent.loading }}</div>
    <div v-else-if="rooms.length === 0" class="hint">{{ lang.text.recent.empty }}</div>
    <div v-else class="list">
      <div v-for="r in rooms" :key="r.room_id" class="card">
        <div class="meta">
          <div><strong>{{ lang.text.recent.opponent }}:</strong> {{ opponentName(r) }}</div>
          <div><strong>{{ lang.text.recent.status }}:</strong> {{ r.status }}</div>
          <div><strong>{{ lang.text.recent.model }}:</strong> {{ r.model }}</div>
          <div><strong>{{ lang.text.recent.updated }}:</strong> {{ formatTime(r.last_activity_at || r.created_at) }}</div>
        </div>
        <div class="actions">
          <button v-if="isActive(r.status)" class="btn primary" @click="continueGame(r.room_id)">{{ lang.text.recent.continue }}</button>
          <button v-else class="btn" @click="reviewGame(r.room_id)">{{ lang.text.recent.review }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import api from '@/utils/api';

type RecentRoom = {
  room_id: string;
  owner_id: string;
  owner_username: string;
  visitor_id?: string | null;
  visitor_username?: string | null;
  status: string;
  model: number;
  moves: number;
  winner?: string | null;
  created_at: string;
  last_activity_at?: string;
}

const store = useStore();
const router = useRouter();
const lang = computed(() => store.state.lang);
const user = computed(() => store.state.user);

const loading = ref(false);
const status = ref<string>('');
// Raw list from server, unfiltered
const allRooms = ref<RecentRoom[]>([]);
// Filtered + sorted view for UI
const rooms = computed<RecentRoom[]>(() => {
  const list = (allRooms.value || []).slice();
  const pri = (s: string) => {
    const v = (s || '').toLowerCase();
    return v === 'playing' ? 0 : v === 'waiting' ? 1 : 2;
  };
  const filtered = !status.value
    ? list
    : list.filter(r => {
        const v = (r.status || '').toString().trim().toLowerCase();
        const tgt = status.value.toString().trim().toLowerCase();
        return v === tgt;
      });
  filtered.sort((a: any, b: any) => {
    const pa = pri(a.status), pb = pri(b.status);
    if (pa !== pb) return pa - pb;
    const ta = new Date(a.last_activity_at || a.created_at).getTime();
    const tb = new Date(b.last_activity_at || b.created_at).getTime();
    return tb - ta;
  });
  return filtered as RecentRoom[];
});
let timer: any = null;

const fetchRecent = async () => {
  if (!user.value?.id) return;
  loading.value = true;
  // Fetch full list; local filter handles UI immediacy
  const res = await api.recentRooms({ user_id: user.value.id, page: 1, size: 50 });
  if (res.success && Array.isArray(res.data)) {
    allRooms.value = (res.data as any[]).slice() as RecentRoom[];
  } else {
    allRooms.value = [];
  }
  loading.value = false;
};

const refresh = async () => { await fetchRecent(); };

const continueGame = (roomId: string) => { router.push(`/room/${roomId}`); };
const reviewGame = (roomId: string) => { router.push({ path: `/room/${roomId}`, query: { review: '1' } }); };

// Normalize and decide button based on status only
const isActive = (s?: string) => {
  const v = (s || '').toString().trim().toLowerCase();
  return v === 'playing' || v === 'waiting';
};

const opponentName = (r: RecentRoom) => {
  const myId = user.value.id;
  if (r.owner_id === myId) return r.visitor_username || lang.value.text.common.waiting;
  return r.owner_username || lang.value.text.common.opponent;
};

const formatTime = (s?: string) => {
  if (!s) return '-';
  try { return new Date(s).toLocaleString(); } catch { return s; }
};

onMounted(async () => {
  await fetchRecent();
  // Faster sync: 5s polling
  timer = setInterval(fetchRecent, 5000);
});
onBeforeUnmount(() => { if (timer) clearInterval(timer); });

// Immediate refresh on filter change (while UI already updates locally)
watch(status, () => { fetchRecent(); });
</script>

<style scoped>
.recent { max-width: 900px; margin: 0 auto; padding: 16px; }
.title { margin: 12px 0; }
.filters { display:flex; align-items:center; gap:8px; margin-bottom: 12px; }
.select { padding:4px 8px; }
.list { display:flex; flex-direction:column; gap: 10px; }
.card { display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid #eee; border-radius:8px; background:#fff; }
.card .meta { display:grid; grid-template-columns: repeat(2, minmax(200px,1fr)); gap:6px 20px; font-size: 13px; }
.btn { padding: 6px 12px; border-radius: 6px; border: 1px solid #ccc; background: #fafafa; cursor: pointer; }
.btn.primary { background:#409eff; color:#fff; border-color:#409eff; }
.hint { color:#666; padding: 12px 0; }
</style>
