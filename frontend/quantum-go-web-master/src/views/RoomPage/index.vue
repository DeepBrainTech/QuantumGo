<template>
  <div class="main">
    <div v-if="game.status === 'playing' || game.status === 'waiting'" class="operation">
      <div class="item btn" @click="passChess">{{ lang.text.room.pass }}</div>
      <div class="item btn" @click="backChess">{{ lang.text.room.takeback }}</div>
      <!--      <div class="btn">{{ lang.text.room.draw }}</div>-->
      <div class="item btn" @click="resign">{{ lang.text.room.resign }}</div>
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
          <span class="value black animate-count">{{ game.blackPoints }}</span>
          <span class="value white animate-count">{{ game.whitePoints }}</span>
        </div>
      </div>
      <div class="item btn score-estimator-btn" @click="estimateScore" :disabled="estimatingScore">
        {{ estimatingScore ? lang.text.room.estimating : (showScoreEstimate ? 'Hide Estimate' : lang.text.room.score_estimator) }}
      </div>
    </div>
    <div class="body">
      <div class="battle">
        <div class="board-box">
          <board-component class="board" info="board1" :can="wsStatus" :callback="putChess" 
                          :show-score-estimate="showScoreEstimate" :score-estimate-data="scoreEstimateData1" />
        </div>
        <div class="board-box">
          <board-component class="board" info="board2" :can="wsStatus" :callback="putChess" 
                          :show-score-estimate="showScoreEstimate" :score-estimate-data="scoreEstimateData2" />
        </div>
      </div>
      <div class="input-box">
        <input class="input" v-model="input" type="text" :placeholder="lang.text.room.chat_placeholder" @keyup.enter="sendMessage" />
      </div>
    </div>
    <el-progress class="progress" v-show="progress > 0" type="circle" striped striped-flow :percentage="progress" :color="progressColors" :format="progressLabel" />
    <barrage-component ref="barrage" />
    <el-dialog v-model="backApply" :title="lang.text.room.back_apply_title" width="500">
      <span>{{ lang.text.room.back_apply_content }}</span>
      <template #footer>
        <div>
          <el-button @click="backApplyOperation(false)">{{ lang.text.room.back_apply_btn_reject }}</el-button>
          <el-button type="primary" @click="backApplyOperation(true)">{{ lang.text.room.back_apply_btn_agree }}</el-button>
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
import Config from "@/config";

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
          // 双方连续 PASS，终局并判胜（量子规则：白方仅贴一次目，已计入 whitePoints）
          const winner = game.value.blackPoints > game.value.whitePoints ? "black" : "white";
          ws.send(JSON.stringify({ type: "setWinner", data: { winner } }));
          return;
        }
        lastActionWasPass.value = true;
        lastPassPlayer.value = currentPlayer;
        // 切换到我方回合与倒计时
      }
      // 同步board2状态（如果存在）
      if (data.data.board2) {
        game.value.board2.clear();
        data.data.board2.forEach(([position, chess]: [string, any]) => {
          game.value.board2.set(position, chess);
        });
      }
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
    } else if (data.type === "setWinner") {
      store.commit("game/setStatus", "finished");
      store.commit("game/setRound", false);
      lastActionWasPass.value = false;
      const winner = data.data.winner;
      if (winner === game.value.camp) {
        ElMessageBox.alert(lang.value.text.room.winner, lang.value.text.room.finish_title, { confirmButtonText: "OK" });
      } else {
        ElMessageBox.alert(lang.value.text.room.loser, lang.value.text.room.finish_title, { confirmButtonText: "OK" });
      }
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
    const winner = game.value.blackPoints > game.value.whitePoints ? "black" : "white";
    ws.send(JSON.stringify({ type: "setWinner", data: { winner } }));
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
      
      ElMessage.success({
        message: `Board1: Score Lead ${result1.score_lead.toFixed(1)}, Winrate ${(result1.winrate * 100).toFixed(1)}% | Board2: Score Lead ${result2.score_lead.toFixed(1)}, Winrate ${(result2.winrate * 100).toFixed(1)}%`,
        grouping: true
      });
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
</script>

<style scoped lang="scss">
@use "./index.scss" as *;
</style>
