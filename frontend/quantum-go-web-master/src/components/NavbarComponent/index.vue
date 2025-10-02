<template>
  <nav class="navbar">
    <div class="logo" @click="logoClick">{{ lang.text.navbar.logo }}</div>
    <div class="nav-right">
      <button class="nav-button" @click="toggleBgm" style="display:none">
        <span>{{ bgmEnabled ? '🔊' : '🔇' }}</span>
      </button>
      <el-popover placement="bottom" trigger="hover" width="280">
        <template #reference>
          <button class="nav-button" @click="toggleMaster" :title="masterMuted ? 'Unmute all' : 'Mute all'">
            <span>{{ masterMuted ? '🔇' : '🔊' }}</span>
          </button>
        </template>
        <div class="audio-panel">
          <div class="row">
            <button class="mini-icon" @click="toggleSfx">{{ sfxEnabled ? '🔊' : '🔇' }}</button>
            <span style="width:80px;">{{ lang.text.navbar.sfx }}</span>
            <el-slider v-model="sfxVolumeProxy" :min="0" :max="100" :step="1" style="flex:1; margin-left:8px;" />
          </div>
          <div class="row" style="margin-top:8px;">
            <button class="mini-icon" @click="toggleBgm">{{ bgmEnabled ? '🔊' : '🔇' }}</button>
            <span style="width:80px;">{{ lang.text.navbar.bgm }}</span>
            <el-slider v-model="bgmVolumeProxy" :min="0" :max="100" :step="1" style="flex:1; margin-left:8px;" />
          </div>
        </div>
      </el-popover>
      <button class="nav-button" @click="changeLanguage">
        <!--        <t-icon name="translate-1" />-->
        <span>{{ lang.text.navbar.lang }}</span>
      </button>
      <button class="nav-button" @click="goToLeaderboard">
        <!--        <t-icon name="trophy" />-->
        <span>{{ lang.text.navbar.leaderboard }}</span>
      </button>
      <button class="nav-button" @click="goToRecent" style="position:relative;">
        <span>{{ lang.text.navbar.recent }}</span>
        <span v-if="activeCount > 0" class="badge">{{ activeCount }}</span>
      </button>
      <button class="nav-button" @click="goToLobby">
        <span>{{ lang.text.navbar.lobby }}</span>
      </button>
      <button class="nav-button" @click="handleShare">
        <!--        <t-icon name="share" />-->
        <span>{{ lang.text.navbar.share }}</span>
      </button>
      <el-dropdown v-if="user.isLogin" trigger="click" @command="onUserCommand">
        <button class="nav-button">
          <span>{{ user.name }}</span>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="logout">Logout</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <button v-else class="nav-button" @click="handleLogin">
        <span>{{ lang.text.navbar.login }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useStore } from "vuex";
import { ElMessage, ElDropdown, ElDropdownMenu, ElDropdownItem, ElPopover, ElSlider } from "element-plus";
import { copyText } from "@/utils/tools";
import { useRouter } from 'vue-router';
import * as sound from "@/utils/sound";
import api from "@/utils/api";

const store = useStore();
const lang = computed(() => store.state.lang);
const user = computed(() => store.state.user);
const game = computed(() => store.state.game);
const bgmEnabled = computed<boolean>(() => store.state.game.bgmEnabled);
const masterMuted = computed<boolean>(() => store.state.game.masterMuted);
const sfxEnabled = computed<boolean>(() => store.state.game.sfxEnabled);
const sfxVolume = computed<number>(() => Math.round((store.state.game.sfxVolume ?? 0.6) * 100));
const bgmVolume = computed<number>(() => Math.round((store.state.game.bgmVolume ?? 0.25) * 100));
const router = useRouter();

const logoClick = () => {
  router.push('/');
};

const changeLanguage = () => {
  store.commit("lang/changeLanguage");
};

const goToLeaderboard = () => {
  router.push('/leaderboard');
};
const goToRecent = () => {
  router.push('/recent');
};
const goToLobby = () => {
  router.push('/lobby');
};

const handleShare = async () => {
  const roomId = store.state.game.roomId;
  if (roomId) {
    await copyText(store.state.lang.text.navbar.share_battle + window.location.origin + `/room/${roomId}`);
  } else {
    await copyText(store.state.lang.text.navbar.share_website + window.location.origin);
  }
  ElMessage({ message: lang.value.text.navbar.copy_success, grouping: true, type: "success" });
};

const handleLogin = () => {
  if (user.value.isLogin) {
    return;
  }
  router.push('/login');
};

const onUserCommand = async (cmd: string) => {
  if (cmd === 'logout') {
    await store.dispatch('user/logout');
    router.push('/');
  }
};

const toggleMaster = () => {
  store.commit('game/setMasterMuted', !masterMuted.value);
};
const toggleBgm = () => {
  store.commit('game/setBgmEnabled', !bgmEnabled.value);
};
const toggleSfx = () => {
  store.commit('game/setSfxEnabled', !sfxEnabled.value);
};

const bgmVolumeProxy = computed({
  get: () => bgmVolume.value,
  set: (v: number) => store.commit('game/setBgmVolume', (v || 0) / 100),
});
const sfxVolumeProxy = computed({
  get: () => sfxVolume.value,
  set: (v: number) => store.commit('game/setSfxVolume', (v || 0) / 100),
});

// Attempt to unlock autoplay restrictions on first user gesture
let unlocked = false;
const tryUnlockAudio = () => {
  if (unlocked) return;
  const status = store.state.game.status;
  const enabled = store.state.game.bgmEnabled;
  const mutedAll = store.state.game.masterMuted;
  if (status === 'playing' && enabled && !mutedAll) {
    try {
      sound.startBgm();
    } catch (_) {
      // ignore
    }
  }
  unlocked = true;
  window.removeEventListener('pointerdown', tryUnlockAudio);
  window.removeEventListener('keydown', tryUnlockAudio);
};

onMounted(() => {
  window.addEventListener('pointerdown', tryUnlockAudio, { once: false });
  window.addEventListener('keydown', tryUnlockAudio, { once: false });
  startRecentPolling();
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', tryUnlockAudio);
  window.removeEventListener('keydown', tryUnlockAudio);
  stopRecentPolling();
});

// Recent active rooms badge
import { ref as vueRef } from 'vue';
const activeCount = vueRef(0);
let recentTimer: any = null;
async function pollRecentOnce() {
  try {
    const uid = user.value?.id;
    if (!uid) { activeCount.value = 0; return; }
    const res = await api.recentRooms({ user_id: uid, page: 1, size: 50 });
    if (res.success && Array.isArray(res.data)) {
      const list = res.data as any[];
      const norm = (s: any) => (typeof s === 'string' ? s.toLowerCase() : '');
      // Count strictly playing + waiting; unknown statuses don't count
      activeCount.value = list.filter(r => {
        const s = norm(r.status);
        return s === 'playing' || s === 'waiting';
      }).length;
    } else {
      activeCount.value = 0;
    }
  } catch {}
}
function startRecentPolling() {
  stopRecentPolling();
  pollRecentOnce();
  recentTimer = setInterval(pollRecentOnce, 5000);
}
function stopRecentPolling() {
  if (recentTimer) clearInterval(recentTimer);
  recentTimer = null;
}

// Immediate refresh when game status changes (e.g., starts or finishes)
watch(() => game.value?.status, () => {
  pollRecentOnce();
});
</script>

<style scoped lang="scss">  
@use "./index.scss" as *;
</style>

<style lang="scss">
/* Ensure popover buttons have no default borders even when teleported */
.audio-panel .mini-icon,
.audio-panel .mini-icon:hover,
.audio-panel .mini-icon:focus,
.audio-panel .mini-icon:active,
.audio-panel .mini-icon:focus-visible {
  background: transparent !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 0 !important;
  appearance: none !important;
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
}
</style>

<style scoped>
.badge {
  position: absolute;
  top: -4px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #f56c6c;
  color: #fff;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
