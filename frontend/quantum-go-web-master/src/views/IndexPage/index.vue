<template>
  <div class="main">
    <div class="left">
      <div class="title">{{ lang.text.index.title }}</div>
      <div class="desc">
        <div class="text">{{ lang.text.index.desc }}</div>
        <div class="btn" @click="createRoom">{{ lang.text.index.btn_start }}</div>
      </div>
    </div>
    <div class="right">
      <board-component class="board" info="board1">
        <div class="round1" />
        <div class="round2" />
        <img class="hand" :src="handWithChess" alt="hand" />
      </board-component>
      <img class="chess-box" :src="chessBox" alt="chess-box" />
    </div>
    <el-dialog v-model="createRoomVisible" :title="lang.text.index.create_room_title" width="500">
      <el-form :model="form">
        <el-form-item :label="lang.text.index.game_mode_title" :label-width="'140px'">
          <el-select v-model="form.gameMode" :placeholder="lang.text.index.game_mode_placeholder">
            <el-option :label="lang.text.index.game_mode_pvp" :value="'pvp'" />
            <el-option :label="lang.text.index.game_mode_ai" :value="'ai'" />
          </el-select>
        </el-form-item>
        <el-form-item :label="lang.text.index.model_title" :label-width="'140px'">
          <el-select v-model="form.model" :placeholder="lang.text.index.model_placeholder">
            <el-option :label="lang.text.index.model_7" :value="7" />
            <el-option :label="lang.text.index.model_9" :value="9" />
            <el-option :label="lang.text.index.model_13" :value="13" />
            <el-option :label="lang.text.index.model_19" :value="19" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Komi" :label-width="'140px'">
          <el-input-number v-model="form.komi" :step="0.5" :min="0" :max="20" />
        </el-form-item>
        <!-- Time control selection (UI only, no logic) -->
        <el-form-item :label="lang.text.index.tc_title" :label-width="'140px'">
          <el-select v-model="timeForm.timeType" :placeholder="lang.text.index.tc_placeholder">
            <el-option :label="lang.text.index.tc_unlimited" value="none" />
            <el-option :label="lang.text.index.tc_absolute" value="absolute" />
            <el-option :label="lang.text.index.tc_simple" value="simple" />
            <el-option :label="lang.text.index.tc_fischer" value="fischer" />
            <el-option :label="lang.text.index.tc_byoyomi" value="byoyomi" />
            <el-option :label="lang.text.index.tc_canadian" value="canadian" />
          </el-select>
        </el-form-item>
        <template v-if="timeForm.timeType !== 'none'">
          <el-form-item :label="lang.text.index.tc_main_time" :label-width="'140px'">
            <el-input-number v-model="timeForm.mainTimeMin" :min="0" :max="300" />
          </el-form-item>
        </template>
        <template v-if="timeForm.timeType === 'fischer'">
          <el-form-item :label="lang.text.index.tc_increment" :label-width="'140px'">
            <el-input-number v-model="timeForm.fischerIncrementSec" :min="0" :max="300" />
          </el-form-item>
          <el-form-item :label="lang.text.index.tc_max_cap" :label-width="'140px'">
            <el-input-number v-model="timeForm.fischerMaxMin" :min="0" :max="600" />
          </el-form-item>
        </template>
        <template v-if="timeForm.timeType === 'byoyomi'">
          <el-form-item :label="lang.text.index.tc_period_time" :label-width="'140px'">
            <el-input-number v-model="timeForm.periodTimeSec" :min="5" :max="300" />
          </el-form-item>
          <el-form-item :label="lang.text.index.tc_periods" :label-width="'140px'">
            <el-input-number v-model="timeForm.numPeriods" :min="1" :max="10" />
          </el-form-item>
        </template>
        <template v-if="timeForm.timeType === 'canadian'">
          <el-form-item :label="lang.text.index.tc_period_time" :label-width="'140px'">
            <el-input-number v-model="timeForm.periodTimeSec" :min="5" :max="600" />
          </el-form-item>
          <el-form-item :label="lang.text.index.tc_stones_per_period" :label-width="'140px'">
            <el-input-number v-model="timeForm.numPeriods" :min="1" :max="50" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createRoomVisible = false">{{ lang.text.index.cancel }}</el-button>
          <el-button type="primary" @click="createRoomSubmit">{{ lang.text.index.confirm }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import BoardComponent from "@/components/BoardComponent/index.vue";
import { useStore } from "vuex";
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElForm, ElFormItem, ElDialog, ElSelect, ElOption, ElButton, ElInputNumber } from "element-plus";
import handWithChess from '@/assets/img/hand_with_chess.png'
import chessBox from '@/assets/img/chess_box.png'

const router = useRouter();
const store = useStore();
const user = computed(() => store.state.user);
const lang = computed(() => store.state.lang);

onMounted(async () => {
  await store.dispatch("game/initBoard");
});

const createRoomVisible = ref(false);
const form = reactive({
  gameMode: "pvp",
  model: 9, // é»˜è®¤19è·¯æ£‹ç›˜
  komi: 7.5
});

const createRoom = async () => {
  createRoomVisible.value = true;
};

// Time control form state
const timeForm = reactive({
  timeType: 'none' as 'none'|'absolute'|'simple'|'fischer'|'byoyomi'|'canadian',
  mainTimeMin: 5,
  fischerIncrementSec: 5,
  fischerMaxMin: 0,
  periodTimeSec: 30,
  numPeriods: 3,
});

const createRoomSubmit = async () => {
  const {gameMode, model, komi} = form;
  if (!gameMode || !model) {
    ElMessage({ message: lang.value.text.index.create_room_error_empty_options, grouping: true, type: "error" });
    return;
  }
  // Require login for PvP rooms
  // Require login for all modes (PVP and AI)
  if (!user.value.isLogin) {
    const fallback = (lang.value.active === 'cn') ? 'è¯·å…ˆç™»å½•' : 'Log in to continue.';
    ElMessage({ message: (lang.value.text.login?.login_required ?? fallback), grouping: true, type: "warning" });
    return;
  }
  // Build time_control from timeForm and pass to backend
  let timeControl: any | undefined = undefined;
  if (timeForm.timeType !== 'none') {
    const mainTimeMS = Math.max(0, Math.floor(timeForm.mainTimeMin * 60 * 1000));
    if (timeForm.timeType === 'absolute') {
      timeControl = { type: 'absolute', mainTimeMS };
    } else if (timeForm.timeType === 'simple') {
      timeControl = { type: 'simple', mainTimeMS };
    } else if (timeForm.timeType === 'fischer') {
      timeControl = {
        type: 'fischer',
        mainTimeMS,
        incrementMS: Math.floor(Math.max(0, timeForm.fischerIncrementSec) * 1000),
        maxTimeMS: timeForm.fischerMaxMin > 0 ? Math.floor(timeForm.fischerMaxMin * 60 * 1000) : null,
      };
    } else if (timeForm.timeType === 'byoyomi') {
      timeControl = {
        type: 'byoyomi',
        mainTimeMS,
        numPeriods: Math.max(1, Math.floor(timeForm.numPeriods)),
        periodTimeMS: Math.floor(Math.max(1, timeForm.periodTimeSec) * 1000),
      };
    } else if (timeForm.timeType === 'canadian') {
      timeControl = {
        type: 'canadian',
        mainTimeMS,
        numPeriods: Math.max(1, Math.floor(timeForm.numPeriods)),
        periodTimeMS: Math.floor(Math.max(1, timeForm.periodTimeSec) * 1000),
      };
    }
  }
  const roomId = await store.dispatch("game/createRoom", {gameMode, model, komi, timeControl});
  if (roomId === false) {
    ElMessage({ message: lang.value.text.index.create_room_error, grouping: true, type: "error" });
    return;
  }
  
  // æ ¹æ®æ¸¸æˆæ¨¡å¼è·³è½¬åˆ°ä¸åŒçš„è·¯ç”±
  if (gameMode === 'ai') {
    await router.push(`/ai/${roomId}`);
  } else {
    await router.push(`/room/${roomId}`);
  }
};
</script>

<style scoped lang="scss">
@use "./index.scss" as *;
</style>





