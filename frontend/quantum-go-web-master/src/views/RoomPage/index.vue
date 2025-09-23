<template>
  <div class="main">
    <div v-if="game.status === 'playing' || game.status === 'waiting'" class="operation">
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
      <div class="item btn score-estimator-btn" @click="estimateScore" :disabled="estimatingScore">
        {{ estimatingScore ? lang.text.room.estimating : (showScoreEstimate ? lang.text.room.hide_estimate : lang.text.room.score_estimator) }}
      </div>
  </div>
    <div class="body">
      <div v-if="stoneRemovalPhase" class="stone-removal-bar">
        <div class="title">{{ lang.text.room.stone_removal_title }}</div>
        <div class="summary">{{ lang.text.room.board1 }}: {{ board1LeadText }} · {{ lang.text.room.board2 }}: {{ board2LeadText }}</div>
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
    <div v-if="showScoreEstimate && scoreEstimateData1 && scoreEstimateData2" class="score-estimate-summary">
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
            <td>{{ formatScoreLead(scoreEstimateData1.score_lead) }}</td>
          </tr>
          <tr>
            <th>{{ lang.text.room.board2 }}</th>
            <td>{{ (scoreEstimateData2.winrate * 100).toFixed(1) }}%</td>
            <td>{{ formatScoreLead(scoreEstimateData2.score_lead) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="battle">
      <div class="board-box">
        <board-component class="board" info="board1" :can="wsStatus && !stoneRemovalPhase && !game.reviewMode" :callback="putChess"
                        :show-score-estimate="showScoreEstimate && !stoneRemovalPhase"
                        :score-estimate-data="scoreEstimateData1"
                        :stone-removal-mode="stoneRemovalPhase"
                        :removal-set="removalSet1"
                        @toggleRemoval="onToggleRemoval" />
      </div>
      <div class="board-box">
          <board-component class="board" info="board2" :can="wsStatus && !stoneRemovalPhase && !game.reviewMode" :callback="putChess"
                          :show-score-estimate="showScoreEstimate && !stoneRemovalPhase"
                          :score-estimate-data="scoreEstimateData2"
                          :stone-removal-mode="stoneRemovalPhase"
                          :removal-set="removalSet2"
                          @toggleRemoval="onToggleRemoval" />
      </div>
      </div>

      <div class="review-bar" v-if="(game.status === 'playing' || game.status === 'waiting') && game.records">
        <div class="left">
          <button class="rv-btn" @click="gotoStart" :disabled="currentMove === 0">&laquo;&laquo;&laquo;</button>
          <button class="rv-btn" @click="step(-10)" :disabled="currentMove === 0">&laquo;&laquo;</button>
          <button class="rv-btn" @click="step(-1)" :disabled="currentMove === 0">&laquo;</button>
        </div>
        <div class="center">{{ displayMove }} / {{ totalMoves }}</div>
        <div class="right">
          <button class="rv-btn" @click="step(1)" :disabled="currentMove === totalMoves">&raquo;</button>
          <button class="rv-btn" @click="step(10)" :disabled="currentMove === totalMoves">&raquo;&raquo;</button>
          <button class="rv-btn" @click="gotoEnd" :disabled="currentMove === totalMoves">&raquo;&raquo;&raquo;</button>
        </div>
      </div>

      <div class="countdown-slot">
        <div class="countdown-inner" :class="{ visible: progress > 0 }">
          <el-progress type="circle" striped striped-flow :percentage="progress" :color="progressColors" :format="progressLabel" />
        </div>
      </div>
      <div class="input-box">
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
          <el-button type="primary" @click="finishVisible = false">OK</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import BoardComponent from "@/components/BoardComponent/index.vue";
import BarrageComponent from "@/components/BarrageComponent/index.vue";
import { useStore } from "vuex";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "@/utils/api";
import { ElMessage, ElMessageBox, ElProgress, ElLoading, ElDialog, ElButton } from "element-plus";
import { Chessman } from "@/utils/types";
import { canPutChess } from "@/utils/chess";
import { calculateGoResult } from "@/utils/chess2";
import Config from "@/config";
import { exportQuantumSGF } from "@/utils/sgf";

const route = useRoute();
const router = useRouter();

const store = useStore();
const user = computed(() => store.state.user);
const game = computed(() => store.state.game);
const lang = computed(() => store.state.lang);

// AI模式检测 - 检查房间的phase字段
const isAIMode = computed(() => {
  // 检查路由路径
  if (route.path.startsWith('/ai/')) {
    return true;
  }
  // 检查房间数据中的phase字段
  if (game.value && game.value.phase === 'ai') {
    return true;
  }
  return false;
});

const barrage = ref();

let ws: any;
const wsStatus = ref(false);
// 连续弃权检测（PVP）
const lastActionWasPass = ref(false);
const lastPassPlayer = ref<string | null>(null);
const estimatingScore = ref(false);
const showScoreEstimate = ref(false);
const scoreEstimateData1 = ref<any>(null);
const scoreEstimateData2 = ref<any>(null);
// 石子移除（终局点目）
const stoneRemovalPhase = ref(false);
const removalSet1 = ref<Set<string>>(new Set());
const removalSet2 = ref<Set<string>>(new Set());
const myRemovalAccepted = ref(false);
const oppRemovalAccepted = ref(false);

// Finish dialog with SGF download
const finishVisible = ref(false);
const finishMessage = ref('');

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
  if (data.status === "finish") {
    redirectToHomeWithMessage(lang.value.text.join.room_finished);
  } else if (data.status === "playing") {
    if (user.value.id !== data.owner_id && user.value.id !== data.visitor_id) {
      redirectToHomeWithMessage(lang.value.text.join.room_playing);
    }
  }
  await initGame(res.data);
});
onMounted(() => {
  ws?.close();
});

const initGame = async (data: Record<string, any>) => {
  await store.dispatch("game/setGameInfo", data);
  console.log("Game initialized with data:", data);
  console.log("Game status:", game.value.status);
  console.log("Game round:", game.value.round);
  console.log("Game camp:", game.value.camp);
  
  // 建立WebSocket连接用于PVP模式
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
      if (chessman.position !== "0,0") {
        // 正常落子
        lastActionWasPass.value = false;
        lastPassPlayer.value = null;
        store.dispatch("game/putChess", chessman);
      } else {
        // 对方 PASS 逻辑
        const currentPlayer = chessman.type;
        if (lastActionWasPass.value && lastPassPlayer.value !== currentPlayer) {
          // 双方连续 PASS -> 进入石子移除阶段
          enterStoneRemoval();
          // 通知对方进入石子移除
          ws.send(JSON.stringify({ type: "stoneRemovalStart", data: {} }));
          return;
        }
        lastActionWasPass.value = true;
        lastPassPlayer.value = currentPlayer;
        if (currentPlayer !== game.value.camp) {
          ElMessage.info({ message: lang.value.text.room.opponent_pass, grouping: true });
        }
        // 切换到我方回合与倒计时
      }
      // 同步board2状态（如果存在）
      if (data.data.board2) {
        game.value.board2.clear();
        data.data.board2.forEach(([position, chess]: [string, any]) => {
          game.value.board2.set(position, chess);
        });
      }
      // Keep review cursor at end when new moves arrive
      store.dispatch('game/reviewGoto', game.value.records.length);
      store.commit("game/setRound", true);
      progress.value = 100;
      // 只有当countdown大于0时才启动倒计时
      if (game.value.countdown > 0) {
        timer = setInterval(() => {
          if (isWaitingBack.value === true) {
            return;
          }
          const reduce = 0.1 / game.value.countdown * 100;
          if (progress.value > reduce) {
            progress.value -= 0.1 / game.value.countdown * 100;
          } else {
            progress.value = 0;
            passChess();
            ElMessage.warning(lang.value.text.room.time_up);
            clearInterval(timer);
          }
        }, 100);
      } else {
        // 不限时模式，不显示进度条
        progress.value = 0;
      }
      // 取消不可靠的“无合法着点”判赢逻辑，改用双 PASS 触发终局
    } else if (data.type === "startGame") {
      game.value.status = "playing";
      ElMessage.success(lang.value.text.room.start_game);
    } else if (data.type === "stoneRemovalStart") {
      enterStoneRemoval();
    } else if (data.type === "stoneRemovalExit") {
      // 对方退出石子移除阶段
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
      // 若双方都已接受并集合一致，则终局
      tryFinishAfterAcceptance();
    } else if (data.type === "setWinner") {
      store.commit("game/setStatus", "finished");
      store.commit("game/setRound", false);
      lastActionWasPass.value = false;
      const winner = data.data.winner;
      finishMessage.value = winner === 'black' ? (lang.value.text.room.game_over_side_win as string).replace('{side}', lang.value.text.room.side_black) : (lang.value.text.room.game_over_side_win as string).replace('{side}', lang.value.text.room.side_white);
      finishVisible.value = true;
    } else if (data.type === "updateRoomInfo") {
      store.dispatch("game/updateRoomInfo", data.data);
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
};

const putChess = async (position: string) => {
  clearInterval(timer);
  progress.value = 0;
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
      board2: [...game.value.board2], // 添加board2状态
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
  }
  clearInterval(timer);
  progress.value = 0;
  const chessman: Chessman = { position: "0,0", type: game.value.camp, brother: "0,0" };
  // 连续两次 PASS：如果上一手是对方 PASS，我方再 PASS 直接终局
  const currentPlayer = game.value.camp;
  if (lastActionWasPass.value && lastPassPlayer.value !== currentPlayer) {
    // 连续 PASS -> 进入石子移除
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
const progressLabel = (percentage: number) => {
  if (game.value.countdown === 0) {
    return "∞";
  }
  return `${Math.floor(percentage / 100 * game.value.countdown)}S`;
};

const progress = ref(0);
let timer: NodeJS.Timeout;

// Score Estimator功能
const estimateScore = async () => {
  console.log('estimateScore called!');
  console.log('showScoreEstimate.value:', showScoreEstimate.value);
  console.log('estimatingScore.value:', estimatingScore.value);
  
  // 如果已经在显示，则关闭显示
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
    
    // 准备棋盘数据
    const board1 = game.value.board1 || new Map();
    const board2 = game.value.board2 || new Map();
    
    console.log('Board1 size:', board1.size);
    console.log('Board2 size:', board2.size);
    console.log('Game model:', game.value.model);
    
    // 收集board1的棋子位置
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
    
    // 收集board2的棋子位置
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
    
    // 调用API，分析两个棋盘
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
    
    // 检查响应结构
    const responseData = (response as any).data || response;
    console.log('Response data:', responseData);
    
    if (responseData.boards && responseData.boards.length >= 2) {
      // 处理board1的结果
      const result1 = responseData.boards[0];
      console.log('Board1 score estimate result:', result1);
      console.log('Board1 ownership array length:', result1.ownership ? result1.ownership.length : 'undefined');
      
      scoreEstimateData1.value = result1;
      
      // 处理board2的结果
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

// 辅助函数：将索引转换为位置字符串
const getPositionStr = (index: number): string => {
  const x = ((index - 1) % game.value.model) + 1;
  const y = Math.floor((index - 1) / game.value.model) + 1;
  return `${x},${y}`;
};

// 进入石子移除阶段
const enterStoneRemoval = async () => {
  stoneRemovalPhase.value = true;
  showScoreEstimate.value = false;
  myRemovalAccepted.value = false;
  oppRemovalAccepted.value = false;
  // 初始使用一次自动点目作为参考
  await autoScoreRemoval();
};

// 继续游戏（退出石子移除阶段）
const continueGame = () => {
  if (!wsStatus.value) {
    ElMessage.warning({ message: lang.value.text.room.ws_connection_error, grouping: true });
    return;
  }
  
  // 重置石子移除相关状态
  stoneRemovalPhase.value = false;
  removalSet1.value = new Set();
  removalSet2.value = new Set();
  myRemovalAccepted.value = false;
  oppRemovalAccepted.value = false;
  showScoreEstimate.value = false;
  
  // 重置pass状态，允许继续游戏
  lastActionWasPass.value = false;
  lastPassPlayer.value = null;
  
  // 通知对方退出石子移除阶段
  ws.send(JSON.stringify({ type: "stoneRemovalExit", data: {} }));
  
  // 重新启动游戏回合
  store.commit("game/setRound", true);
  
  ElMessage.success(lang.value.text.room.continue_game_success);
};

// 根据估算器自动标记死子
const autoScoreRemoval = async () => {
  try {
    estimatingScore.value = true;
    // 复用现有API
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
  myRemovalAccepted.value = false; // 远端更新撤销双方的接受
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
  // 双方都已接受，直接根据选择的死子计算结果
  const cloneBoard = (src: Map<string, any>, removed: Set<string>) => {
    const m = new Map<string, any>();
    src.forEach((v, k) => { if (!removed.has(k)) m.set(k, v); });
    return m;
  };
  const b1 = cloneBoard(game.value.board1, removalSet1.value);
  const b2 = cloneBoard(game.value.board2, removalSet2.value);
  const r1 = calculateGoResult(b1 as any, game.value.model, 0, 0);
  const r2 = calculateGoResult(b2 as any, game.value.model, 0, 0);
  const KOMI_ONCE = game.value.komi ?? 7.5;
  const blackTotal = r1.blackScore + r2.blackScore;
  const whiteTotal = r1.whiteScore + r2.whiteScore + KOMI_ONCE;
  const winner = blackTotal > whiteTotal ? 'black' : 'white';
  ws.send(JSON.stringify({ type: 'setWinner', data: { winner } }));
};

// 点目阶段中部展示：当前两盘的 b+/w+ 领先信息（不含贴目）
const computeBoardLeadText = (src: Map<string, any>, removed: Set<string>) => {
  // 构建“去除死子”的棋盘
  const m = new Map<string, { type: 'black' | 'white' }>();
  src.forEach((c: any, pos: string) => {
    if (!removed.has(pos)) m.set(pos, { type: c.type });
  });
  const r = calculateGoResult(m as any, game.value.model, 0, 0);
  const lead = r.blackScore - r.whiteScore;
  return formatScoreLead(lead);
};

const board1LeadText = computed(() => computeBoardLeadText(game.value.board1, removalSet1.value));
const board2LeadText = computed(() => computeBoardLeadText(game.value.board2, removalSet2.value));

// 计算考虑死子移除的调整后分数
const adjustedBlackScore = computed(() => {
  if (!stoneRemovalPhase.value) return game.value.blackPoints;
  
  const cloneBoard = (src: Map<string, any>, removed: Set<string>) => {
    const m = new Map<string, any>();
    src.forEach((v, k) => { if (!removed.has(k)) m.set(k, v); });
    return m;
  };
  
  const b1 = cloneBoard(game.value.board1, removalSet1.value);
  const b2 = cloneBoard(game.value.board2, removalSet2.value);
  const r1 = calculateGoResult(b1 as any, game.value.model, 0, 0);
  const r2 = calculateGoResult(b2 as any, game.value.model, 0, 0);
  
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
  const r1 = calculateGoResult(b1 as any, game.value.model, 0, 0);
  const r2 = calculateGoResult(b2 as any, game.value.model, 0, 0);
  const KOMI_ONCE = game.value.komi ?? 7.5;
  
  return Math.round((r1.whiteScore + r2.whiteScore + KOMI_ONCE) * 10) / 10;
});

// 将 score_lead 显示为 b+X / w+X 的通用格式
const formatScoreLead = (lead: number): string => {
  if (lead > 0.0001) return `B+${lead.toFixed(1)}`; // 黑领先
  if (lead < -0.0001) return `W+${Math.abs(lead).toFixed(1)}`; // 白领先
  return '0.0'; // 平衡
};

// -------- Review helpers --------
const totalMoves = computed(() => game.value.records?.length || 0);
const currentMove = computed(() => game.value.reviewIndex || 0);
const displayMove = computed(() => Math.min(currentMove.value, totalMoves.value));

const gotoStart = () => store.dispatch('game/reviewGoto', 0);
const gotoEnd = () => store.dispatch('game/reviewGoto', totalMoves.value);
const step = (delta: number) => {
  const target = Math.max(0, Math.min(currentMove.value + delta, totalMoves.value));
  store.dispatch('game/reviewGoto', target);
};

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
</script>

<style scoped lang="scss">
@use "./index.scss" as *;
@use "@/assets/styles/score-removal.scss" as *;

.score-estimate-summary {
  margin: 0 6vw 1rem 6vw;
  display: flex;
  justify-content: center;
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
  padding: 10px 14px;
  background: rgba(235, 137, 79, 0.12);
  border: 1px solid rgba(235, 137, 79, 0.25);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  color: #6E4C41;
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
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.08);
  background: #fff;
  cursor: pointer;
}
.sr-btn.primary { background: #EB894F; color: #fff; border-color: #EB894F; }
.status { margin-left: 8px; opacity: 0.85; }
.status.ok { color: #2e7d32; font-weight: 600; }

/* Review bar */
.review-bar {
  margin: 10px 6vw;
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
