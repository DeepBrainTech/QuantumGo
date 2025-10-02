<template>
  <div class="main">
    <!-- Operation panel: left-side controls -->
    <div v-if="!game.reviewMode && (game.status === 'playing' || game.status === 'waiting')" class="operation">
      <div class="item btn" :class="{ disabled: stoneRemovalPhase }" @click="!stoneRemovalPhase && passChess()">{{ lang.text.room.pass }}</div>
      <div class="item btn" :class="{ disabled: stoneRemovalPhase }" @click="!stoneRemovalPhase && backChess()">{{ lang.text.room.takeback }}</div>
      <!--      <div class="btn">{{ lang.text.room.draw }}</div>-->
      <div class="item btn" :class="{ disabled: stoneRemovalPhase }" @click="!stoneRemovalPhase && resign()">{{ lang.text.room.resign }}</div>
      <div class="item score">
        <div>
          <span class="label">{{ lang.text.room.moves }}</span>
          <span class="value animate-count no-chess">{{ game.moves }}</span>
        </div>
        <div>
          <span class="label">{{ lang.text.room.points }}</span>
          <span class="value black animate-count">{{ game.blackLost }}</span>
          <span class="value white animate-count">{{ game.whiteLost }}</span>
        </div>
        <div>
          <span class="label">{{ lang.text.room.score }}</span>
          <span class="value black animate-count">{{ stoneRemovalPhase ? adjustedBlackScore : game.blackPoints }}</span>
          <span class="value white animate-count">{{ stoneRemovalPhase ? adjustedWhiteScore : game.whitePoints }}</span>
        </div>
      </div>
      <div class="item btn" @click="estimateScore" :class="{ disabled: estimatingScore }">
        {{ estimatingScore ? lang.text.room.estimating : (showScoreEstimate ? lang.text.room.hide_estimate : lang.text.room.score_estimator) }}
      </div>
    </div> <!-- end .operation -->

    <!-- Player info panel between buttons and boards -->
    <div class="player-panel" v-if="!game.reviewMode && (game.status === 'playing' || game.status === 'waiting')">
      <div class="player-card black" :class="{ active: sideToMove === 'black' }">
        <div class="stone black"></div>
        <div class="meta">
          <div class="name" :title="blackDisplayName">{{ blackDisplayName }}</div>
          <div class="rating">{{ blackRatingText }}</div>
          <div class="rank">{{ blackRankText }}</div>
        </div>
      </div>
      <div class="player-card white" :class="{ active: sideToMove === 'white' }">
        <div class="stone white"></div>
        <div class="meta">
          <div class="name" :title="whiteDisplayName">{{ whiteDisplayName }}</div>
          <div class="rating">{{ whiteRatingText }}</div>
          <div class="rank">{{ whiteRankText }}</div>
        </div>
      </div>
    </div>

    <!-- Main body: boards, review, chat -->
    <div class="body" ref="bodyRef">
      <div v-if="stoneRemovalPhase" class="stone-removal-bar">
        <div class="title">{{ lang.text.room.stone_removal_title }}</div>
        <div class="summary">{{ lang.text.room.board1 }}: {{ board1LeadText }} | {{ lang.text.room.board2 }}: {{ board2LeadText }}</div>
        <div class="actions">
          <button class="sr-btn continue" @click="continueGame">{{ lang.text.room.continue_game }}</button>
          <button class="sr-btn" @click="autoScoreRemoval" :disabled="estimatingScore">{{ lang.text.room.auto_score }}</button>
          <button class="sr-btn" @click="clearRemoval">{{ lang.text.room.clear }}</button>
          <button class="sr-btn primary" @click="acceptRemoval" :disabled="myRemovalAccepted">
            {{ myRemovalAccepted ? lang.text.room.accept_confirmed : lang.text.room.accept }}
          </button>
          <span class="status" :class="{ ok: oppRemovalAccepted }">{{ oppRemovalAccepted ? lang.text.room.opponent_accepted : lang.text.room.opponent_pending }}</span>
        </div>
      </div>
    <div v-if="showScoreEstimate && scoreEstimateData1 && scoreEstimateData2 && !stoneRemovalPhase"
         class="score-estimate-summary"
         ref="summaryRef"
         :style="{ left: summaryLeft + 'px', top: summaryTop + 'px' }"
         @mousedown="onSummaryMouseDown">
      <table class="estimate-table">
        <thead>
          <tr>
            <th></th>
            <th>{{ lang.text.room.winrate }}</th>
            <th>{{ lang.text.room.score_lead }}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>{{ lang.text.room.board1 }}</th>
            <td>{{ (scoreEstimateData1.winrate * 100).toFixed(1) }}%</td>
            <td>{{ board1ScoreLead }}</td>
          </tr>
          <tr>
            <th>{{ lang.text.room.board2 }}</th>
            <td>{{ (scoreEstimateData2.winrate * 100).toFixed(1) }}%</td>
            <td>{{ board2ScoreLead }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="battle">
      <div class="board-box">
        <board-component class="board" info="board1" :can="wsStatus && !stoneRemovalPhase && !game.reviewMode" :callback="putChess"
                        :show-score-estimate="showScoreEstimate"
                        :score-estimate-data="scoreEstimateData1"
                        :stone-removal-mode="stoneRemovalPhase"
                        :removal-set="removalSet1"
                        @toggleRemoval="onToggleRemoval" />
      </div>
      <div class="board-box">
          <board-component class="board" info="board2" :can="wsStatus && !stoneRemovalPhase && !game.reviewMode" :callback="putChess"
                          :show-score-estimate="showScoreEstimate"
                          :score-estimate-data="scoreEstimateData2"
                          :stone-removal-mode="stoneRemovalPhase"
                          :removal-set="removalSet2"
                          @toggleRemoval="onToggleRemoval" />
      </div>
      </div>

      <div class="review-bar" v-if="(game.reviewMode || game.status === 'finished') && game.records">
        <div class="left">
          <button class="rv-btn" @click="gotoStart" :disabled="currentMove === 0">&laquo;&laquo;&laquo;</button>
          <button class="rv-btn" @click="step(-5)" :disabled="currentMove === 0">&laquo;&laquo;</button>
          <button class="rv-btn" @click="step(-1)" :disabled="currentMove === 0">&laquo;</button>
        </div>
        <div class="center" style="flex:1; padding: 0 12px;">
          <el-slider :min="0" :max="totalMoves" :step="1" v-model="reviewSlider" @change="onSliderChange" />
          <div style="text-align:center; margin-top:4px;">{{ displayMove }} / {{ totalMoves }}</div>
        </div>
        <div class="right">
          <button class="rv-btn" @click="step(1)" :disabled="currentMove === totalMoves">&raquo;</button>
          <button class="rv-btn" @click="step(5)" :disabled="currentMove === totalMoves">&raquo;&raquo;</button>
          <button class="rv-btn" @click="gotoEnd" :disabled="currentMove === totalMoves">&raquo;&raquo;&raquo;</button>
        </div>
      </div>

      <!-- Govariants-style dual clocks (styled with existing UI circle) -->
      <div class="countdown-slot" v-if="!game.reviewMode && (game.status === 'playing' || game.status === 'waiting')">
        <div class="countdown-inner" :class="{ visible: true }" style="display:flex; gap: 24px; align-items:center;">
          <div style="display:flex; flex-direction:column; align-items:center;">
            <el-progress type="circle" :width="100" striped striped-flow :percentage="progressBlack" :color="progressColors" :format="() => blackClock" />
            <div style="margin-top:6px; font-weight:600; color:#333;">{{ lang.text.room.side_black }}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:center;">
            <el-progress type="circle" :width="100" striped striped-flow :percentage="progressWhite" :color="progressColors" :format="() => whiteClock" />
            <div style="margin-top:6px; font-weight:600; color:#333;">{{ lang.text.room.side_white }}</div>
          </div>
        </div>
      </div>
      <div class="input-box" v-if="!game.reviewMode && (game.status === 'playing' || game.status === 'waiting')">
        <input class="input" v-model="input" type="text" :placeholder="lang.text.room.chat_placeholder" @keyup.enter="sendMessage" />
      </div>
    </div>
    <barrage-component ref="barrage" />
    <el-dialog v-model="backApply" :title="lang.text.room.back_apply_title" width="500"
               :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false">
      <span>{{ lang.text.room.back_apply_content }}</span>
      <template #footer>
        <div>
          <el-button @click="backApplyOperation(false)">{{ lang.text.room.back_apply_btn_reject }}</el-button>
          <el-button type="primary" @click="backApplyOperation(true)">{{ lang.text.room.back_apply_btn_agree }}</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Finish dialog with SGF download -->
    <el-dialog v-model="finishVisible" :title="lang.text.room.finish_title" width="520"
               :close-on-click-modal="false" :close-on-press-escape="false">
      <div style="margin-bottom: 12px;">{{ finishMessage }}</div>
      <template #footer>
        <div>
          <el-button @click="downloadSGF">Download SGF</el-button>
          <el-button @click="showScoreDetail">{{ lang.text.room.score_detail }}</el-button>
          <el-button type="primary" @click="finishVisible = false">OK</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Score Detail dialog -->
    <el-dialog v-model="scoreDetailVisible" :title="lang.text.room.score_detail" width="600">
      <div class="score-detail-content">
        <table class="score-detail-table">
          <thead>
            <tr>
              <th></th>
              <th>{{ lang.text.room.area }}</th>
              <th>{{ lang.text.room.komi }}</th>
              <th>{{ lang.text.room.board1 }}</th>
              <th>{{ lang.text.room.board2 }}</th>
              <th>{{ lang.text.room.total }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="player-row">
                <div class="player-indicator black"></div>
                <span>{{ lang.text.room.side_black }}</span>
              </td>
              <td>{{ scoreDetail.blackArea }}</td>
              <td>&mdash;</td>
              <td>{{ scoreDetail.blackBoard1 }}</td>
              <td>{{ scoreDetail.blackBoard2 }}</td>
              <td>{{ scoreDetail.blackTotal }}</td>
            </tr>
            <tr>
              <td class="player-row">
                <div class="player-indicator white"></div>
                <span>{{ lang.text.room.side_white }}</span>
              </td>
              <td>{{ scoreDetail.whiteArea }}</td>
              <td>{{ scoreDetail.komi }}</td>
              <td>{{ scoreDetail.whiteBoard1 }}</td>
              <td>{{ scoreDetail.whiteBoard2 }}</td>
              <td>{{ scoreDetail.whiteTotal }}</td>
            </tr>
          </tbody>
        </table>
        <div class="result-summary">
          {{ lang.text.room.result }}: {{ scoreDetail.result }}
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="scoreDetailVisible = false">{{ lang.text.room.close }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import BoardComponent from "@/components/BoardComponent/index.vue";
import BarrageComponent from "@/components/BarrageComponent/index.vue";
import { useStore } from "vuex";
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "@/utils/api";
import * as sound from "@/utils/sound";
import { ElMessage, ElMessageBox, ElProgress, ElLoading, ElDialog, ElButton, ElSlider } from "element-plus";
import { Chessman } from "@/utils/types";
import { canPutChess } from "@/utils/chess";
import { calculateGoResult } from "@/utils/chess2";
import Config from "@/config";
import { exportQuantumSGF } from "@/utils/sgf";
import { initRuntime, startTurn, finishMove, currentMsUntilTimeout, displayString } from "@/utils/timeControl";
import { formatRatingAndRank } from "@/utils/rating";

const route = useRoute();
const router = useRouter();

const store = useStore();
const user = computed(() => store.state.user);
const game = computed(() => store.state.game);
const lang = computed(() => store.state.lang);

// Player panel computed side and profile texts
// Note: game.round 表示“是否轮到我方”，而不是“当前轮到黑/白”。
// 因此需要结合 camp 推导全局颜色，以便两端都能正确高亮。
const sideToMove = computed<'black' | 'white'>(() => {
  const myColor = game.value.camp as 'black' | 'white';
  if (game.value.round) return myColor;
  return myColor === 'black' ? 'white' : 'black';
});
const blackDisplayName = ref('');
const whiteDisplayName = ref('');
const blackRatingText = ref('');
const whiteRatingText = ref('');
const blackRankText = ref('');
const whiteRankText = ref('');

async function updatePlayerPanelFromData(info: any) {
  try {
    const ownerId = info?.owner_id as string;
    const visitorId = (info?.visitor_id ?? null) as string | null;
    // Black = owner
    blackDisplayName.value = lang.value.text.common.owner;
    blackRatingText.value = '-';
    blackRankText.value = '-';
    if (ownerId) {
      const resp: any = await api.getUserProfile(ownerId, game.value.model);
      const profile = resp?.data ?? resp;
      if (profile && profile.username) {
        blackDisplayName.value = profile.username;
        const { ratingText, rankText } = formatRatingAndRank(profile.rating ?? 0, profile.rd ?? 0);
        blackRatingText.value = ratingText;
        blackRankText.value = rankText;
      }
      // fallback: if no username returned, use local user's name when viewing as owner
      if (!blackDisplayName.value && user.value?.id === ownerId && user.value?.name) {
        blackDisplayName.value = user.value.name;
      }
    }

    // White = visitor (or waiting / AI)
    if (isAIMode.value || info?.game_mode === 'ai') {
      whiteDisplayName.value = 'AI';
      whiteRatingText.value = '-';
      whiteRankText.value = '-';
    } else if (visitorId) {
      // Fill with username from profile
      whiteDisplayName.value = lang.value.text.common.waiting;
      whiteRatingText.value = '-';
      whiteRankText.value = '-';
      try {
        const respW: any = await api.getUserProfile(visitorId, game.value.model);
        const profileW = respW?.data ?? respW;
        if (profileW && profileW.username) {
          whiteDisplayName.value = profileW.username;
          const { ratingText, rankText } = formatRatingAndRank(profileW.rating ?? 0, profileW.rd ?? 0);
          whiteRatingText.value = ratingText;
          whiteRankText.value = rankText;
        }
      } catch {}
    } else {
      // Show waiting using i18n common.waiting
      whiteDisplayName.value = lang.value.text.common.waiting;
      whiteRatingText.value = '-';
      whiteRankText.value = '-';
    }
  } catch {
    // fallback
    if (!blackDisplayName.value) blackDisplayName.value = lang.value.text.common.owner;
    if (!whiteDisplayName.value) whiteDisplayName.value = lang.value.text.common.waiting;
  }
}

// Time control runtime and UI bindings
let timeRt = initRuntime((game.value?.timeControl ?? null) as any);
const blackClock = ref('');
const whiteClock = ref('');
const progressBlack = ref(0);
const progressWhite = ref(0);
let clockTimer: any = null;

// Score summary drag and position
const summaryRef = ref<HTMLElement | null>(null);
const bodyRef = ref<HTMLElement | null>(null);
const summaryLeft = ref(0);
const summaryTop = ref(0);
let draggingSummary = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

const onSummaryMouseDown = (e: MouseEvent) => {
  const rect = bodyRef.value?.getBoundingClientRect();
  draggingSummary = true;
  // Offset within body container
  dragOffsetX = e.clientX - (rect ? rect.left : 0) - summaryLeft.value;
  dragOffsetY = e.clientY - (rect ? rect.top : 0) - summaryTop.value;
  document.addEventListener('mousemove', onSummaryMouseMove);
  document.addEventListener('mouseup', onSummaryMouseUp);
};

const onSummaryMouseMove = (e: MouseEvent) => {
  if (!draggingSummary) return;
  const rect = bodyRef.value?.getBoundingClientRect();
  if (!rect) return;
  let nx = e.clientX - rect.left - dragOffsetX;
  let ny = e.clientY - rect.top - dragOffsetY;
  // clamp to body area
  nx = Math.max(8, Math.min(nx, rect.width - 8));
  ny = Math.max(8, Math.min(ny, rect.height - 8));
  summaryLeft.value = nx;
  summaryTop.value = ny;
};

const onSummaryMouseUp = () => {
  draggingSummary = false;
  document.removeEventListener('mousemove', onSummaryMouseMove);
  document.removeEventListener('mouseup', onSummaryMouseUp);
};

function startClockLoop() {
  clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    try {
      const now = Date.now();
      blackClock.value = displayString(timeRt, 'black', now);
      whiteClock.value = displayString(timeRt, 'white', now);
      const msB = currentMsUntilTimeout(timeRt, 'black', now);
      const msW = currentMsUntilTimeout(timeRt, 'white', now);
      const cfg: any = timeRt.config;
      if (cfg) {
        if (timeRt.forPlayer.black.onThePlaySince != null && msB != null) {
          let denom = 1;
          if (cfg.type === 'byoyomi') denom = (timeRt.forPlayer.black.clockState as any).mainTimeRemainingMS > 0 ? cfg.mainTimeMS : cfg.periodTimeMS;
          else if (cfg.type === 'canadian') denom = (timeRt.forPlayer.black.clockState as any).mainTimeRemainingMS > 0 ? cfg.mainTimeMS : cfg.periodTimeMS;
          else denom = cfg.mainTimeMS || 1;
          progressBlack.value = Math.max(0, Math.min(100, Math.floor((msB / Math.max(1, denom)) * 100)));
        }
        if (timeRt.forPlayer.white.onThePlaySince != null && msW != null) {
          let denom = 1;
          if (cfg.type === 'byoyomi') denom = (timeRt.forPlayer.white.clockState as any).mainTimeRemainingMS > 0 ? cfg.mainTimeMS : cfg.periodTimeMS;
          else if (cfg.type === 'canadian') denom = (timeRt.forPlayer.white.clockState as any).mainTimeRemainingMS > 0 ? cfg.mainTimeMS : cfg.periodTimeMS;
          else denom = cfg.mainTimeMS || 1;
          progressWhite.value = Math.max(0, Math.min(100, Math.floor((msW / Math.max(1, denom)) * 100)));
        }
        if (msB !== null && msB <= 0) {
          ws?.send(JSON.stringify({ type: 'setWinner', data: { winner: 'white' } }));
          clearInterval(clockTimer);
        } else if (msW !== null && msW <= 0) {
          ws?.send(JSON.stringify({ type: 'setWinner', data: { winner: 'black' } }));
          clearInterval(clockTimer);
        }
      }
    } catch (e) {
      // ignore clock UI errors
    }
  }, 100);
}

// AIæ¨¡å¼æ£€æµ‹ - æ£€æŸ¥æˆ¿é—´çš„phaseå­—æ®µ
const isAIMode = computed(() => {
  // æ£€æŸ¥è·¯ç”±è·¯å¾„
  if (route.path.startsWith('/ai/')) {
    return true;
  }
  // æ£€æŸ¥æˆ¿é—´æ•°æ®ä¸­çš„phaseå­—æ®µ
  if (game.value && game.value.phase === 'ai') {
    return true;
  }
  return false;
});

const barrage = ref();

let ws: any;
const wsStatus = ref(false);
// è¿žç»­å¼ƒæƒæ£€æµ‹ï¼ˆPVPï¼‰
const lastActionWasPass = ref(false);
const lastPassPlayer = ref<string | null>(null);
const estimatingScore = ref(false);
const showScoreEstimate = ref(false);
const scoreEstimateData1 = ref<any>(null);
const scoreEstimateData2 = ref<any>(null);
// çŸ³å­ç§»é™¤ï¼ˆç»ˆå±€ç‚¹ç›®ï¼‰
const stoneRemovalPhase = ref(false);
const removalSet1 = ref<Set<string>>(new Set());
const removalSet2 = ref<Set<string>>(new Set());
const myRemovalAccepted = ref(false);
const oppRemovalAccepted = ref(false);

// Finish dialog with SGF download
const finishVisible = ref(false);
const finishMessage = ref('');

// Score Detail dialog
const scoreDetailVisible = ref(false);
const scoreDetail = ref({
  blackArea: 0,
  whiteArea: 0,
  komi: 0,
  blackBoard1: 0,
  blackBoard2: 0,
  whiteBoard1: 0,
  whiteBoard2: 0,
  blackTotal: 0,
  whiteTotal: 0,
  result: ''
});

let roomId: string;
onMounted(async () => {
  roomId = route.params.id as string;
  const res = await api.getGameInfo(roomId);
  const redirectToHomeWithMessage = (message: string) => {
    ElMessage.error(message);
    router.push("/");
  };
  if (!res.success) {
    if (res.status === 0) {
      redirectToHomeWithMessage(lang.value.text.join.net_error);
    } else {
      redirectToHomeWithMessage(lang.value.text.join.room_not_found);
    }
    return;
  }
  const data = res.data;
  const reviewModeRequested = route.query.review === '1' || route.query.review === 'true';
  if (data.status === "finished" && !reviewModeRequested) {
    redirectToHomeWithMessage(lang.value.text.join.room_finished);
  } else if (data.status === "playing") {
    if (user.value.id !== data.owner_id && user.value.id !== data.visitor_id) {
      redirectToHomeWithMessage(lang.value.text.join.room_playing);
    }
  }
  await initGame(res.data, reviewModeRequested);
});
onMounted(() => {
  ws?.close();
  // set initial position for score summary overlay
  nextTick(() => {
    const rect = bodyRef.value?.getBoundingClientRect();
    if (rect) {
      summaryLeft.value = Math.floor(rect.width * 0.62);
      summaryTop.value = 12;
    }
  });
});

const initGame = async (data: Record<string, any>, reviewModeRequested: boolean = false) => {
  await store.dispatch("game/setGameInfo", data);
  // re-init time runtime from backend-provided config, if any
  timeRt = initRuntime((store.state.game.timeControl ?? null) as any);
  startClockLoop();
  console.log("Game initialized with data:", data);
  console.log("Game status:", game.value.status);
  console.log("Game round:", game.value.round);
  console.log("Game camp:", game.value.camp);
  
  // Populate player panel from backend user ids
  await updatePlayerPanelFromData(data);
  
  // Only create WebSocket for live play
  if (!reviewModeRequested && data.status !== 'finished') {
    ws = new WebSocket(`${Config.wsUrl}/${user.value.id}/${roomId}`);
  // ws = io(`ws://${window.location.hostname}/ws/${user.value.id}/${roomId}`);
  ws.onopen = () => {
    console.log("WebSocket connected successfully");
    wsStatus.value = true;
  };
  ws.onclose = () => {
    wsStatus.value = false;
    ElMessage.warning(lang.value.text.room.ws_disconnected);
  };
  ws.onerror = (error: any) => {
    ElMessage.warning(lang.value.text.room.ws_disconnected);
    console.error("WebSocket error:", error);
  };
  ws.onmessage = (event: any) => {
    const message = event.data;
    console.log("Received WebSocket message:", message);
    const data = JSON.parse(message);
    if (data.type === "updateChess") {
      game.value.moves++;
      const chessman = data.data.putChess as Chessman;
      // update time runtime (finish mover, start opponent)
      const now = Date.now();
      finishMove(timeRt, chessman.type === 'black' ? 'black' : 'white', now);
      if (chessman.position !== "0,0") {
        // æ­£å¸¸è½å­
        lastActionWasPass.value = false;
        lastPassPlayer.value = null;
        store.dispatch("game/putChess", chessman);
      } else {
        // å¯¹æ–¹ PASS é€»è¾‘
        const currentPlayer = chessman.type;
        if (lastActionWasPass.value && lastPassPlayer.value !== currentPlayer) {
          // åŒæ–¹è¿žç»­ PASS -> è¿›å…¥çŸ³å­ç§»é™¤é˜¶æ®µ
          enterStoneRemoval();
          // é€šçŸ¥å¯¹æ–¹è¿›å…¥çŸ³å­ç§»é™¤
          ws.send(JSON.stringify({ type: "stoneRemovalStart", data: {} }));
          return;
        }
        lastActionWasPass.value = true;
        lastPassPlayer.value = currentPlayer;
        if (currentPlayer !== game.value.camp) {
          ElMessage.info({ message: lang.value.text.room.opponent_pass, grouping: true });
        }
        // åˆ‡æ¢åˆ°æˆ‘æ–¹å›žåˆä¸Žå€’è®¡æ—¶
      }
      // åŒæ­¥board2çŠ¶æ€ï¼ˆå¦‚æžœå­˜åœ¨ï¼‰
      if (data.data.board2) {
        game.value.board2.clear();
        data.data.board2.forEach(([position, chess]: [string, any]) => {
          game.value.board2.set(position, chess);
        });
      }
      // Keep review cursor at end when new moves arrive
      store.dispatch('game/reviewGoto', game.value.records.length);
      store.commit("game/setRound", true);
      // start next side
      const nextSide = chessman.type === 'black' ? 'white' : 'black';
      startTurn(timeRt, nextSide, now);

    } else if (data.type === "startGame") {
      // Use store mutation so audio/BGM and other side-effects run
      store.commit("game/setStatus", "playing");
      // New game boundary: restart BGM from the beginning
      sound.startBgmFromBeginning();
      ElMessage.success(lang.value.text.room.start_game);
      // set initial side on clock
      const now = Date.now();
      const toMove = game.value.round ? 'black' : 'white';
      startTurn(timeRt, toMove, now);
      // Fetch fresh room info to populate visitor id and player panel
      api.getGameInfo(roomId)
        .then((latest: any) => {
          if (latest && latest.success) {
            updatePlayerPanelFromData(latest.data).catch(() => {});
          }
        })
        .catch(() => {});
    } else if (data.type === "stoneRemovalStart") {
      enterStoneRemoval();
    } else if (data.type === "stoneRemovalExit") {
      // å¯¹æ–¹é€€å‡ºçŸ³å­ç§»é™¤é˜¶æ®µ
      stoneRemovalPhase.value = false;
      removalSet1.value = new Set();
      removalSet2.value = new Set();
      myRemovalAccepted.value = false;
      oppRemovalAccepted.value = false;
      showScoreEstimate.value = false;
      lastActionWasPass.value = false;
      lastPassPlayer.value = null;
      store.commit("game/setRound", true);
      ElMessage.info(lang.value.text.room.opponent_continue_game);
    } else if (data.type === "stoneRemovalUpdate") {
      applyRemoteRemoval(data.data);
    } else if (data.type === "stoneRemovalAccept") {
      oppRemovalAccepted.value = true;
      // è‹¥åŒæ–¹éƒ½å·²æŽ¥å—å¹¶é›†åˆä¸€è‡´ï¼Œåˆ™ç»ˆå±€
      tryFinishAfterAcceptance();
    } else if (data.type === "setWinner") {
      store.commit("game/setStatus", "finished");
      store.commit("game/setRound", false);
      lastActionWasPass.value = false;
      const winner = data.data.winner;
      finishMessage.value = winner === 'black' ? (lang.value.text.room.game_over_side_win as string).replace('{side}', lang.value.text.room.side_black) : (lang.value.text.room.game_over_side_win as string).replace('{side}', lang.value.text.room.side_white);
      finishVisible.value = true;
    } else if (data.type === "updateRoomInfo") {
      // Update simple reactive info and refresh player panel
      updatePlayerPanelFromData(data.data).catch(() => {});
    } else if (data.type === "sendMessage") {
      barrage.value.sendBullet(data.data.message, 1);
    } else if (data.type === "backChessApply") {
      backApply.value = true;
    } else if (data.type === "backChessResult") {
      const operation = data.data.operation;
      isWaitingBack.value = false;
      loadingModel.close();
      if (operation) {
        ElMessage.success(lang.value.text.room.back_apply_success);
        store.dispatch("game/backChess", data.data.chessman);
      } else {
        ElMessage.warning(lang.value.text.room.back_apply_fail);
      }
    }
  };
  }

  // Enable review mode for finished/review requests
  if (reviewModeRequested || data.status === 'finished') {
    store.commit('game/setReviewMode', true);
    store.commit('game/setReviewIndex', store.state.game.records.length);
  }
};

const putChess = async (position: string) => {
  game.value.moves++;
  
  if (!wsStatus.value) {
    ElMessage.warning({ message: lang.value.text.room.ws_connection_error, grouping: true });
    return;
  }
  const chessman: Chessman = game.value.board1.get(position);
  ws.send(JSON.stringify({
    type: "updateChess",
    data: {
      putChess: chessman,
      board: [...game.value.board1],
      board2: [...game.value.board2], // æ·»åŠ board2çŠ¶æ€
      black_lost: game.value.blackLost,
      white_lost: game.value.whiteLost,
      chessman_records: game.value.records
    }
  }));
};

const isWaitingBack = ref(false);
let loadingModel: any;
const backChess = async () => {
  if (!wsStatus.value) {
    ElMessage.warning({ message: lang.value.text.room.ws_connection_error, grouping: true });
    return;
  }
  if (!game.value.round) {
    ElMessage.warning({ message: lang.value.text.room.not_round, grouping: true });
    return;
  }
  if (game.value.records.length < 4) {
    ElMessage.warning({ message: lang.value.text.room.back_apply_early, grouping: true });
    return;
  }
  isWaitingBack.value = true;
  loadingModel = ElLoading.service({ target: "body", text: lang.value.text.room.back_apply_waiting, background: "rgba(0, 0, 0, 0.2)" });
  ws.send(JSON.stringify({ type: "backChessApply", data: {} }));
};
const backApply = ref(false);
const backApplyOperation = async (operation: boolean) => {
  backApply.value = false;
  ws.send(JSON.stringify({ type: "backChessResult", data: { operation } }));
  if (operation) {
    await store.dispatch("game/backChess");
  }
};

const passChess = () => {
  if (!wsStatus.value) {
    ElMessage.warning({ message: lang.value.text.room.ws_connection_error, grouping: true });
    return;
  }
  if (!game.value.round) {
    ElMessage.warning({ message: lang.value.text.room.not_round, grouping: true });
    return;
  }
  if (game.value.board1.size <= 2) {
    ElMessage.warning({ message: lang.value.text.room.pass_early, grouping: true });
    return;
  }  const chessman: Chessman = { position: "0,0", type: game.value.camp, brother: "0,0" };
  // è¿žç»­ä¸¤æ¬¡ PASSï¼šå¦‚æžœä¸Šä¸€æ‰‹æ˜¯å¯¹æ–¹ PASSï¼Œæˆ‘æ–¹å† PASS ç›´æŽ¥ç»ˆå±€
  const currentPlayer = game.value.camp;
  if (lastActionWasPass.value && lastPassPlayer.value !== currentPlayer) {
    // è¿žç»­ PASS -> è¿›å…¥çŸ³å­ç§»é™¤
    enterStoneRemoval();
    ws.send(JSON.stringify({ type: "stoneRemovalStart", data: {} }));
    return;
  }
  ws.send(JSON.stringify({
    type: "updateChess", data: {
      putChess: chessman,
      board: [...game.value.board1],
      black_lost: 0, white_lost: 0,
      chessman_records:
      game.value.records
    }
  }));
  store.commit("game/setRound", false);
  game.value.moves++;
  lastActionWasPass.value = true;
  lastPassPlayer.value = currentPlayer;
};

const resign = () => {
  if (!wsStatus.value) {
    ElMessage.warning({ message: lang.value.text.room.ws_connection_error, grouping: true });
    return;
  }
  ws.send(JSON.stringify({ type: "setWinner", data: { winner: game.value.camp === "black" ? "white" : "black" } }));
  store.commit("game/setRound", false);
  store.commit("game/setStatus", "finished");
  ElMessageBox.alert(lang.value.text.room.loser, lang.value.text.room.finish_title, { confirmButtonText: "OK" });
};

const input = ref("");
const sendMessage = async () => {
  if (!input.value) {
    return;
  }
  const message = input.value;
  input.value = "";
  ws?.send(JSON.stringify({ type: "sendMessage", data: { message } }));
  barrage.value.sendBullet(message, 0);
};


const progressColors = ref([
  { color: "#f56c6c", percentage: 30 },
  { color: "#e6a23c", percentage: 60 },
  { color: "#5cb87a", percentage: 100 }
]);


// Score EstimatoråŠŸèƒ½
const estimateScore = async () => {
  console.log('estimateScore called!');
  console.log('showScoreEstimate.value:', showScoreEstimate.value);
  console.log('estimatingScore.value:', estimatingScore.value);
  
  // å¦‚æžœå·²ç»åœ¨æ˜¾ç¤ºï¼Œåˆ™å…³é—­æ˜¾ç¤º
  if (showScoreEstimate.value) {
    console.log('Hiding estimate display');
    showScoreEstimate.value = false;
    scoreEstimateData1.value = null;
    scoreEstimateData2.value = null;
    return;
  }

  if (estimatingScore.value) return;
  
  try {
    console.log('Starting score estimation...');
    estimatingScore.value = true;
    
    // å‡†å¤‡æ£‹ç›˜æ•°æ®
    const board1 = game.value.board1 || new Map();
    const board2 = game.value.board2 || new Map();
    
    console.log('Board1 size:', board1.size);
    console.log('Board2 size:', board2.size);
    console.log('Game model:', game.value.model);
    
    // æ”¶é›†board1çš„æ£‹å­ä½ç½®
    const board1BlackStones: string[] = [];
    const board1WhiteStones: string[] = [];
    
    for (let i = 1; i <= game.value.model * game.value.model; i++) {
      const pos = getPositionStr(i);
      if (board1.has(pos)) {
        const chess = board1.get(pos);
        if (chess.type === 'black') {
          board1BlackStones.push(pos);
        } else if (chess.type === 'white') {
          board1WhiteStones.push(pos);
        }
      }
    }
    
    // æ”¶é›†board2çš„æ£‹å­ä½ç½®
    const board2BlackStones: string[] = [];
    const board2WhiteStones: string[] = [];
    
    for (let i = 1; i <= game.value.model * game.value.model; i++) {
      const pos = getPositionStr(i);
      if (board2.has(pos)) {
        const chess = board2.get(pos);
        if (chess.type === 'black') {
          board2BlackStones.push(pos);
        } else if (chess.type === 'white') {
          board2WhiteStones.push(pos);
        }
      }
    }
    
    console.log('Board1 - Black stones:', board1BlackStones);
    console.log('Board1 - White stones:', board1WhiteStones);
    console.log('Board2 - Black stones:', board2BlackStones);
    console.log('Board2 - White stones:', board2WhiteStones);
    
    // è°ƒç”¨APIï¼Œåˆ†æžä¸¤ä¸ªæ£‹ç›˜
    console.log('Calling API...');
    const response = await api.scoreEstimate({
      boards: [
        {
          board_size: game.value.model,
          black_stones: board1BlackStones,
          white_stones: board1WhiteStones,
          next_to_move: game.value.round ? 'black' : 'white'
        },
        {
          board_size: game.value.model,
          black_stones: board2BlackStones,
          white_stones: board2WhiteStones,
          next_to_move: game.value.round ? 'black' : 'white'
        }
      ]
    });
    
    console.log('API response received:', response);
    
    // æ£€æŸ¥å“åº”ç»“æž„
    const responseData = (response as any).data || response;
    console.log('Response data:', responseData);
    
    if (responseData.boards && responseData.boards.length >= 2) {
      // å¤„ç†board1çš„ç»“æžœ
      const result1 = responseData.boards[0];
      console.log('Board1 score estimate result:', result1);
      console.log('Board1 ownership array length:', result1.ownership ? result1.ownership.length : 'undefined');
      
      scoreEstimateData1.value = result1;
      
      // å¤„ç†board2çš„ç»“æžœ
      const result2 = responseData.boards[1];
      console.log('Board2 score estimate result:', result2);
      console.log('Board2 ownership array length:', result2.ownership ? result2.ownership.length : 'undefined');
      
      scoreEstimateData2.value = result2;
      
      showScoreEstimate.value = true;
      
      console.log('Setting showScoreEstimate to true');
      console.log('scoreEstimateData1 set to:', scoreEstimateData1.value);
      console.log('scoreEstimateData2 set to:', scoreEstimateData2.value);
      
      // Inline summary table replaces toast message
    } else {
      console.log('No boards in response or insufficient boards array');
      ElMessage.error({
        message: 'Score estimation failed: insufficient data',
        grouping: true
      });
    }
    
  } catch (error) {
    console.error('Score estimate failed:', error);
    ElMessage.error({
      message: lang.value.text.room.estimate_failed,
      grouping: true
    });
  } finally {
    estimatingScore.value = false;
  }
};

// è¾…åŠ©å‡½æ•°ï¼šå°†ç´¢å¼•è½¬æ¢ä¸ºä½ç½®å­—ç¬¦ä¸²
const getPositionStr = (index: number): string => {
  const x = ((index - 1) % game.value.model) + 1;
  const y = Math.floor((index - 1) / game.value.model) + 1;
  return `${x},${y}`;
};

// è¿›å…¥çŸ³å­ç§»é™¤é˜¶æ®µ
const enterStoneRemoval = async () => {
  stoneRemovalPhase.value = true;
  myRemovalAccepted.value = false;
  oppRemovalAccepted.value = false;
  // åˆå§‹ä½¿ç”¨ä¸€æ¬¡è‡ªåŠ¨ç‚¹ç›®ä½œä¸ºå‚è€ƒ
  await autoScoreRemoval();
  // ç¡®ä¿åœ¨çŸ³å­ç§»é™¤é˜¶æ®µæ˜¾ç¤ºå½¢åŠ¿åˆ¤æ–­
  if (!showScoreEstimate.value) {
    await estimateScore();
  }
};

// ç»§ç»­æ¸¸æˆï¼ˆé€€å‡ºçŸ³å­ç§»é™¤é˜¶æ®µï¼‰
const continueGame = () => {
  if (!wsStatus.value) {
    ElMessage.warning({ message: lang.value.text.room.ws_connection_error, grouping: true });
    return;
  }
  
  // é‡ç½®çŸ³å­ç§»é™¤ç›¸å…³çŠ¶æ€
  stoneRemovalPhase.value = false;
  removalSet1.value = new Set();
  removalSet2.value = new Set();
  myRemovalAccepted.value = false;
  oppRemovalAccepted.value = false;
  showScoreEstimate.value = false;
  
  // é‡ç½®passçŠ¶æ€ï¼Œå…è®¸ç»§ç»­æ¸¸æˆ
  lastActionWasPass.value = false;
  lastPassPlayer.value = null;
  
  // é€šçŸ¥å¯¹æ–¹é€€å‡ºçŸ³å­ç§»é™¤é˜¶æ®µ
  ws.send(JSON.stringify({ type: "stoneRemovalExit", data: {} }));
  
  // é‡æ–°å¯åŠ¨æ¸¸æˆå›žåˆ
  store.commit("game/setRound", true);
  
  ElMessage.success(lang.value.text.room.continue_game_success);
};

// æ ¹æ®ä¼°ç®—å™¨è‡ªåŠ¨æ ‡è®°æ­»å­
const autoScoreRemoval = async () => {
  try {
    estimatingScore.value = true;
    // å¤ç”¨çŽ°æœ‰API
    const assemble = (board: Map<string, any>) => {
      const b: string[] = [], w: string[] = [];
      for (let i = 1; i <= game.value.model * game.value.model; i++) {
        const pos = getPositionStr(i);
        const c = board.get(pos);
        if (!c) continue;
        if (c.type === 'black') b.push(pos); else w.push(pos);
      }
      return { b, w };
    };
    const a1 = assemble(game.value.board1);
    const a2 = assemble(game.value.board2);
    const response = await api.scoreEstimate({
      boards: [
        { board_size: game.value.model, black_stones: a1.b, white_stones: a1.w, next_to_move: game.value.round ? 'black' : 'white' },
        { board_size: game.value.model, black_stones: a2.b, white_stones: a2.w, next_to_move: game.value.round ? 'black' : 'white' }
      ]
    });
    const resp = (response as any).data || response;
    const r1 = resp.boards?.[0];
    const r2 = resp.boards?.[1];
    if (r1 && r1.dead_stones) {
      const s = new Set<string>();
      for (let i = 0; i < r1.dead_stones.length; i += 2) {
        s.add(`${r1.dead_stones[i] + 1},${r1.dead_stones[i + 1] + 1}`);
      }
      removalSet1.value = s;
    }
    if (r2 && r2.dead_stones) {
      const s = new Set<string>();
      for (let i = 0; i < r2.dead_stones.length; i += 2) {
        s.add(`${r2.dead_stones[i] + 1},${r2.dead_stones[i + 1] + 1}`);
      }
      removalSet2.value = s;
    }
    myRemovalAccepted.value = false;
    oppRemovalAccepted.value = false;
    ws.send(JSON.stringify({ type: 'stoneRemovalUpdate', data: { board1: [...removalSet1.value], board2: [...removalSet2.value] } }));
  } finally {
    estimatingScore.value = false;
  }
};

const clearRemoval = () => {
  removalSet1.value = new Set();
  removalSet2.value = new Set();
  myRemovalAccepted.value = false;
  oppRemovalAccepted.value = false;
  ws.send(JSON.stringify({ type: 'stoneRemovalUpdate', data: { board1: [], board2: [] } }));
};

const onToggleRemoval = (pos: string, which: string) => {
  const set = which === 'board1' ? removalSet1.value : removalSet2.value;
  if (set.has(pos)) set.delete(pos); else set.add(pos);
  myRemovalAccepted.value = false;
  oppRemovalAccepted.value = false;
  ws.send(JSON.stringify({ type: 'stoneRemovalUpdate', data: { board1: [...removalSet1.value], board2: [...removalSet2.value] } }));
};

const applyRemoteRemoval = (payload: any) => {
  removalSet1.value = new Set<string>(payload.board1 || []);
  removalSet2.value = new Set<string>(payload.board2 || []);
  myRemovalAccepted.value = false; // è¿œç«¯æ›´æ–°æ’¤é”€åŒæ–¹çš„æŽ¥å—
  oppRemovalAccepted.value = false;
};

const acceptRemoval = () => {
  myRemovalAccepted.value = true;
  ws.send(JSON.stringify({ type: 'stoneRemovalAccept', data: { board1: [...removalSet1.value], board2: [...removalSet2.value] } }));
  tryFinishAfterAcceptance();
};

const setsEqual = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
};

const tryFinishAfterAcceptance = () => {
  if (!myRemovalAccepted.value || !oppRemovalAccepted.value) return;
  // åŒæ–¹éƒ½å·²æŽ¥å—ï¼Œç›´æŽ¥æ ¹æ®é€‰æ‹©çš„æ­»å­è®¡ç®—ç»“æžœ
  const cloneBoard = (src: Map<string, any>, removed: Set<string>) => {
    const m = new Map<string, any>();
    src.forEach((v, k) => { if (!removed.has(k)) m.set(k, v); });
    return m;
  };
  const b1 = cloneBoard(game.value.board1, removalSet1.value);
  const b2 = cloneBoard(game.value.board2, removalSet2.value);
  const r1 = calculateGoResult(b1 as any, game.value.model, 0, 0, 0);
  const r2 = calculateGoResult(b2 as any, game.value.model, 0, 0, 0);
  const KOMI_ONCE = game.value.komi ?? 7.5;
  const blackTotal = r1.blackScore + r2.blackScore;
  const whiteTotal = r1.whiteScore + r2.whiteScore + KOMI_ONCE;
  const winner = blackTotal > whiteTotal ? 'black' : 'white';
  ws.send(JSON.stringify({ type: 'setWinner', data: { winner } }));
};

// ç‚¹ç›®é˜¶æ®µä¸­éƒ¨å±•ç¤ºï¼šå½“å‰ä¸¤ç›˜çš„ b+/w+ é¢†å…ˆä¿¡æ¯ï¼ˆä¸å«è´´ç›®ï¼‰
const computeBoardLeadText = (src: Map<string, any>, removed: Set<string>) => {
  // æž„å»ºâ€œåŽ»é™¤æ­»å­â€çš„æ£‹ç›˜
  const m = new Map<string, { type: 'black' | 'white' }>();
  src.forEach((c: any, pos: string) => {
    if (!removed.has(pos)) m.set(pos, { type: c.type });
  });
  const r = calculateGoResult(m as any, game.value.model, 0, 0, 0);
  const lead = r.blackScore - r.whiteScore;
  console.log(`Board score: Black=${r.blackScore}, White=${r.whiteScore}, Lead=${lead}`);
  return formatScoreLead(lead);
};

const board1LeadText = computed(() => computeBoardLeadText(game.value.board1, removalSet1.value));
const board2LeadText = computed(() => computeBoardLeadText(game.value.board2, removalSet2.value));

// 形势判断阶段的净分差计算（使用calculateGoResult）
const computeScoreLead = (board: Map<string, any>): string => {
  const r = calculateGoResult(board as any, game.value.model, 0, 0, 0);
  const lead = r.blackScore - r.whiteScore;
  return formatScoreLead(lead);
};

const board1ScoreLead = computed(() => computeScoreLead(game.value.board1));
const board2ScoreLead = computed(() => computeScoreLead(game.value.board2));

// è®¡ç®—è€ƒè™‘æ­»å­ç§»é™¤çš„è°ƒæ•´åŽåˆ†æ•°
const adjustedBlackScore = computed(() => {
  if (!stoneRemovalPhase.value) return game.value.blackPoints;
  
  const cloneBoard = (src: Map<string, any>, removed: Set<string>) => {
    const m = new Map<string, any>();
    src.forEach((v, k) => { if (!removed.has(k)) m.set(k, v); });
    return m;
  };
  
  const b1 = cloneBoard(game.value.board1, removalSet1.value);
  const b2 = cloneBoard(game.value.board2, removalSet2.value);
  const r1 = calculateGoResult(b1 as any, game.value.model, 0, 0, 0);
  const r2 = calculateGoResult(b2 as any, game.value.model, 0, 0, 0);
  
  return Math.round((r1.blackScore + r2.blackScore) * 10) / 10;
});

const adjustedWhiteScore = computed(() => {
  if (!stoneRemovalPhase.value) return game.value.whitePoints;
  
  const cloneBoard = (src: Map<string, any>, removed: Set<string>) => {
    const m = new Map<string, any>();
    src.forEach((v, k) => { if (!removed.has(k)) m.set(k, v); });
    return m;
  };
  
  const b1 = cloneBoard(game.value.board1, removalSet1.value);
  const b2 = cloneBoard(game.value.board2, removalSet2.value);
  const r1 = calculateGoResult(b1 as any, game.value.model, 0, 0, 0);
  const r2 = calculateGoResult(b2 as any, game.value.model, 0, 0, 0);
  const KOMI_ONCE = game.value.komi ?? 7.5;
  
  return Math.round((r1.whiteScore + r2.whiteScore + KOMI_ONCE) * 10) / 10;
});

// å°† score_lead æ˜¾ç¤ºä¸º b+X / w+X çš„é€šç”¨æ ¼å¼ï¼ˆæ˜¾ç¤ºå‡€é¢†å…ˆåˆ†æ•°ï¼‰
const formatScoreLead = (lead: number): string => {
  if (lead > 0.0001) return `B+${lead.toFixed(1)}`; // é»‘é¢†å…ˆ
  if (lead < -0.0001) return `W+${Math.abs(lead).toFixed(1)}`; // ç™½é¢†å…ˆ
  return '0.0'; // å¹³è¡¡
};

// -------- Review helpers --------
const totalMoves = computed(() => game.value.records?.length || 0);
const currentMove = computed(() => game.value.reviewIndex || 0);
const displayMove = computed(() => Math.min(currentMove.value, totalMoves.value));

// Slider for review mode
const reviewSlider = ref(0);
watch(currentMove, (nv) => { reviewSlider.value = nv; });
const onSliderChange = (val: number | number[]) => {
  const v = Array.isArray(val) ? (val[0] ?? 0) : (val ?? 0);
  const target = Math.max(0, Math.min(v, totalMoves.value));
  store.dispatch('game/reviewGoto', target);
};

const gotoStart = () => store.dispatch('game/reviewGoto', 0);
const gotoEnd = () => store.dispatch('game/reviewGoto', totalMoves.value);
const step = (delta: number) => {
  const target = Math.max(0, Math.min(currentMove.value + delta, totalMoves.value));
  store.dispatch('game/reviewGoto', target);
};

// -------- Keyboard controls --------
const handleKeydown = (event: KeyboardEvent) => {
  // åªåœ¨æ¸¸æˆè¿›è¡Œä¸­ä¸”æœ‰è®°å½•æ—¶å“åº”é”®ç›˜äº‹ä»¶
  const isLive = (game.value.status === 'playing' || game.value.status === 'waiting');
  const inReview = (game.value.reviewMode || game.value.status === 'finished');
  if ((!isLive && !inReview) || !game.value.records) return;
  
  // é˜²æ­¢åœ¨è¾“å…¥æ¡†ä¸­è§¦å‘
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      if (event.shiftKey) {
        step(-5); // Shift + å·¦ç®­å¤´ï¼šåŽé€€5æ­¥
      } else {
        step(-1); // å·¦ç®­å¤´ï¼šåŽé€€1æ­¥
      }
      break;
    case 'ArrowRight':
      event.preventDefault();
      if (event.shiftKey) {
        step(5); // Shift + å³ç®­å¤´ï¼šå‰è¿›5æ­¥
      } else {
        step(1); // å³ç®­å¤´ï¼šå‰è¿›1æ­¥
      }
      break;
    case 'Home':
      event.preventDefault();
      gotoStart(); // Homeé”®ï¼šè·³åˆ°å¼€å§‹
      break;
    case 'End':
      event.preventDefault();
      gotoEnd(); // Endé”®ï¼šè·³åˆ°ç»“æŸ
      break;
  }
};

// æ·»åŠ å’Œç§»é™¤é”®ç›˜äº‹ä»¶ç›‘å¬å™¨
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('mousemove', onSummaryMouseMove);
  document.removeEventListener('mouseup', onSummaryMouseUp);
});

const downloadSGF = () => {
  try {
    const sgf = exportQuantumSGF(game.value.records, game.value.model, game.value.komi ?? 7.5);
    const blob = new Blob([sgf], { type: 'application/x-go-sgf;charset=utf-8' });
    const a = document.createElement('a');
    const id = game.value.roomId || 'local';
    a.download = `quantumgo_${id}_${Date.now()}.sgf`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    console.error('SGF export failed', e);
    ElMessage.error({ message: 'SGF export failed', grouping: true });
  }
};

const showScoreDetail = () => {
  // 计算最终分数详情
  const cloneBoard = (src: Map<string, any>, removed: Set<string>) => {
    const m = new Map<string, any>();
    src.forEach((v, k) => { if (!removed.has(k)) m.set(k, v); });
    return m;
  };
  
  const b1 = cloneBoard(game.value.board1, removalSet1.value);
  const b2 = cloneBoard(game.value.board2, removalSet2.value);
  const r1 = calculateGoResult(b1 as any, game.value.model, 0, 0, 0);
  const r2 = calculateGoResult(b2 as any, game.value.model, 0, 0, 0);
  
  const komi = game.value.komi ?? 7.5;
  const blackTotal = r1.blackScore + r2.blackScore;
  const whiteTotal = r1.whiteScore + r2.whiteScore + komi;
  
  scoreDetail.value = {
    blackArea: r1.blackScore + r2.blackScore,
    whiteArea: r1.whiteScore + r2.whiteScore,
    komi: komi,
    blackBoard1: r1.blackScore,
    blackBoard2: r2.blackScore,
    whiteBoard1: r1.whiteScore,
    whiteBoard2: r2.whiteScore,
    blackTotal: blackTotal,
    whiteTotal: whiteTotal,
    result: blackTotal > whiteTotal ? 
      `${lang.value.text.room.side_black}+${(blackTotal - whiteTotal).toFixed(1)}` : 
      `${lang.value.text.room.side_white}+${(whiteTotal - blackTotal).toFixed(1)}`
  };
  
  scoreDetailVisible.value = true;
};
</script>

<style scoped lang="scss">
@use "./index.scss" as *;
@use "@/assets/styles/score-removal.scss" as *;

.score-estimate-summary {
  position: absolute;
  z-index: 50;
  cursor: move;
  user-select: none;
}

.estimate-table {
  border-collapse: collapse;
  min-width: 320px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.estimate-table th,
.estimate-table td {
  padding: 10px 14px;
  text-align: center;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  color: #6E4C41;
}

.estimate-table thead th {
  background: #EB894F;
  color: #fff;
}

.estimate-table tbody tr:last-child td { border-bottom: none; }
.estimate-table tbody th { text-align: left; padding-left: 16px; }

.stone-removal-bar {
  margin: 0 6vw 1rem 6vw;
  padding: 12px 16px;
  background: rgba(235, 137, 79, 0.12);
  border: 1px solid rgba(235, 137, 79, 0.25);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  color: #6E4C41;
  font-size: 16px;
}

.stone-removal-bar .title {
  font-weight: 700;
}

.stone-removal-bar .summary {
  flex: 1;
  text-align: center;
  font-weight: 600;
}

.stone-removal-bar .actions { display: flex; gap: 10px; align-items: center; }
.sr-btn {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.08);
  background: #fff;
  cursor: pointer;
  font-size: 15px;
}
.sr-btn.primary { background: #EB894F; color: #fff; border-color: #EB894F; }
.status { margin-left: 8px; opacity: 0.85; }
.status.ok { color: #2e7d32; font-weight: 600; font-size: 15px; }

/* Review bar */
.review-bar {
  margin: 2px 6vw 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #6E4C41;
}
.review-bar .center { font-weight: 700; min-width: 80px; text-align: center; }
.review-bar .left, .review-bar .right { display: flex; gap: 8px; }
.rv-btn {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(0,0,0,0.1);
  background: #fff;
  cursor: pointer;
}
.rv-btn:disabled { opacity: 0.5; cursor: default; }
</style>








