<template>
  <div class="main">
    <div v-if="game.status === 'playing'" class="operation">
      <div class="item btn" :class="{ disabled: stoneRemovalPhase }" @click="!stoneRemovalPhase && passChess()">{{ lang.text.room.pass }}</div>
      <div class="item btn" :class="{ disabled: stoneRemovalPhase }" @click="!stoneRemovalPhase && backChess()">{{ lang.text.room.takeback }}</div>
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
      <div class="item btn end-game-btn" @click="endGameNow">{{ lang.text.room.end_game }}</div>
    </div>
    <div class="body">
      <div v-if="stoneRemovalPhase" class="stone-removal-bar">
        <div class="title">{{ lang.text.room.stone_removal_title }}</div>
        <div class="summary">{{ lang.text.room.board1 }}: {{ board1LeadText }} · {{ lang.text.room.board2 }}: {{ board2LeadText }}</div>
        <div class="actions">
          <button class="sr-btn continue" @click="continueGame">{{ lang.text.room.continue_game }}</button>
          <button class="sr-btn" @click="autoScoreRemoval" :disabled="estimatingScore">{{ lang.text.room.auto_score }}</button>
          <button class="sr-btn" @click="clearRemoval">{{ lang.text.room.clear }}</button>
          <button class="sr-btn primary" @click="acceptRemoval" :disabled="myRemovalAccepted">{{ myRemovalAccepted ? lang.text.room.accept_confirmed : lang.text.room.accept }}</button>
          <span class="status ok">{{ lang.text.room.opponent_accepted }}</span>
        </div>
      </div>
      <div v-if="showScoreEstimate && scoreEstimateData1 && scoreEstimateData2 && !stoneRemovalPhase" class="score-estimate-summary">
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
          <board-component class="board" info="board1" :can="!stoneRemovalPhase && !game.reviewMode" :callback="onBoardClick"
            :show-score-estimate="showScoreEstimate"
            :score-estimate-data="scoreEstimateData1"
            :stone-removal-mode="stoneRemovalPhase"
            :removal-set="removalSet1"
            @toggleRemoval="onToggleRemoval" />
        </div>
        <div class="board-box">
          <board-component class="board" info="board2" :can="!stoneRemovalPhase && !game.reviewMode" :callback="onBoardClick"
            :show-score-estimate="showScoreEstimate"
            :score-estimate-data="scoreEstimateData2"
            :stone-removal-mode="stoneRemovalPhase"
            :removal-set="removalSet2"
            @toggleRemoval="onToggleRemoval" />
        </div>
      </div>
      <!-- Review controls -->
      <div class="review-bar" v-if="game.status === 'playing' && game.records">
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
              <td>—</td>
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
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox, ElProgress, ElLoading, ElDialog, ElButton } from "element-plus";
import { Chessman, ChessmanType } from "@/utils/types";
import api from "@/utils/api";
import { canPutChess, canPutChessSituationalSuperko, hashBoardWithTurn } from "@/utils/chess";
import { calculateGoResult } from "@/utils/chess2";
import { exportQuantumSGF } from "@/utils/sgf";

const route = useRoute();
const router = useRouter();

const store = useStore();
const user = computed(() => store.state.user);
const game = computed(() => store.state.game);
const lang = computed(() => store.state.lang);

const barrage = ref();
const input = ref("");

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

// 进度条相关
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
let timer: NodeJS.Timeout | undefined;

// AI思考状态与弃权跟踪
const isAIThinking = ref(false);
const playerPassed = ref(false);
const aiPassed = ref(false);

// Score Estimator & 点目
const showScoreEstimate = ref(false);
const estimatingScore = ref(false);
const scoreEstimateData1 = ref<any>(null);
const scoreEstimateData2 = ref<any>(null);
const stoneRemovalPhase = ref(false);
const removalSet1 = ref<Set<string>>(new Set());
const removalSet2 = ref<Set<string>>(new Set());
const myRemovalAccepted = ref(false); // AI 默认接受，只需玩家接受
const formatScoreLead = (lead: number): string => {
  if (lead > 0.0001) return `B+${lead.toFixed(1)}`;
  if (lead < -0.0001) return `W+${Math.abs(lead).toFixed(1)}`;
  return '0.0';
};
const computeBoardLeadText = (src: Map<string, any>, removed: Set<string>) => {
  const m = new Map<string, { type: 'black' | 'white' }>();
  src.forEach((c: any, pos: string) => { if (!removed.has(pos)) m.set(pos, { type: c.type }); });
  const r = calculateGoResult(m as any, game.value.model, 0, 0, 0);
  const lead = r.blackScore - r.whiteScore;
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

// 启动玩家回合倒计时
const startPlayerTimer = () => {
  // 清除之前的定时器
  if (timer) clearInterval(timer);
  
  // 只有当countdown大于0且是玩家回合时才启动倒计时
  if (game.value.countdown > 0 && game.value.round && !isAIThinking.value) {
    progress.value = 100;
    timer = setInterval(() => {
      if (!game.value.round || isAIThinking.value) {
        // 不是玩家回合或AI在思考，停止倒计时
        clearInterval(timer);
        return;
      }
      const reduce = 0.1 / game.value.countdown * 100;
      if (progress.value > reduce) {
        progress.value -= 0.1 / game.value.countdown * 100;
      } else {
        progress.value = 0;
        // 倒计时结束，玩家自动弃权
        passChess();
        ElMessage.warning(lang.value.text.room.time_up);
        clearInterval(timer);
      }
    }, 100);
  } else {
    // 不限时模式或不是玩家回合，不显示进度条
    progress.value = 0;
  }
};

// 停止倒计时
const stopTimer = () => {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
  progress.value = 0;
};

// 初始化AI游戏
onMounted(() => {
  // 延迟初始化，确保DOM元素已经渲染
  setTimeout(() => {
    initAIGame();
  }, 100);
});

const initAIGame = () => {
  // 初始化AI游戏状态 - 不清空棋盘，只设置必要的状态
  store.commit('game/setStatus', 'playing');
  store.commit('game/setRound', true); // 玩家先手
  store.commit('game/setCamp', 'black'); // 玩家是黑棋
  // 棋盘尺寸已经在createRoom时设置，这里不需要重新设置
  store.commit('game/setGameMode', 'ai'); // 设置为AI模式
  
  // 确保棋盘是空的
  game.value.board1.clear();
  game.value.board2.clear();
  game.value.moves = 0;
  game.value.records = [];
  
  // 初始化量子围棋状态
  game.value.subStatus = 'black'; // 从黑棋开始
  game.value.blackQuantum = '';
  game.value.whiteQuantum = '';
  // 重置劫与超劫检测所需的历史与最后一步
  game.value.lastMove1 = null;
  game.value.lastMove2 = null;
  if (game.value.history1 && game.value.history1.clear) game.value.history1.clear();
  if (game.value.history2 && game.value.history2.clear) game.value.history2.clear();
  // 记录初始空局面（行棋方：黑）
  if (game.value.history1 && game.value.history1.add) {
    game.value.history1.add(hashBoardWithTurn(game.value.board1, 'black'));
  }
  if (game.value.history2 && game.value.history2.add) {
    game.value.history2.add(hashBoardWithTurn(game.value.board2, 'black'));
  }
  playerPassed.value = false;
  aiPassed.value = false;
  
  // 启动玩家回合倒计时
  startPlayerTimer();
  
  console.log('AI游戏已初始化');
};

// MCTS（本地简易AI）作为后备方案
// MCTS节点类
class MCTSNode {
  position: string;
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  untriedMoves: string[];
  player: 'black' | 'white';
  
  constructor(position: string, parent: MCTSNode | null, untriedMoves: string[], player: 'black' | 'white') {
    this.position = position;
    this.parent = parent;
    this.children = [];
    this.visits = 0;
    this.wins = 0;
    this.untriedMoves = untriedMoves;
    this.player = player;
  }
  
  // UCB1公式
  ucb1(c: number = 1.414): number {
    if (this.visits === 0) return Infinity;
    return (this.wins / this.visits) + c * Math.sqrt(Math.log(this.parent?.visits || 1) / this.visits);
  }
  
  // 选择最佳子节点
  selectChild(): MCTSNode {
    return this.children.reduce((best, child) => 
      child.ucb1() > best.ucb1() ? child : best
    );
  }
  
  // 添加子节点
  addChild(position: string, untriedMoves: string[], player: 'black' | 'white'): MCTSNode {
    const child = new MCTSNode(position, this, untriedMoves, player);
    this.children.push(child);
    this.untriedMoves = this.untriedMoves.filter(move => move !== position);
    return child;
  }
  
  // 更新节点统计
  update(result: number) {
    this.visits++;
    this.wins += result;
  }
}

// 本地MCTS算法（后备）
const getAIMoveLocal = (): string | null => {
  const board1 = game.value.board1;
  const board2 = game.value.board2;
  const boardSize = game.value.model;
  const aiType = 'white'; // AI是白棋
  
  console.log('Fallback MCTS - 棋盘尺寸:', boardSize);
  
  // 获取所有可能的位置
  const possibleMoves: string[] = [];
  for (let x = 1; x <= boardSize; x++) {
    for (let y = 1; y <= boardSize; y++) {
      const position = `${x},${y}`;
      if (!board1.has(position) && !board2.has(position)) {
        // 使用情景超劫（SSK）一致性检查，避免后续被 store 拒绝
        const legal1 = canPutChessSituationalSuperko(
          board1,
          position,
          aiType as 'black' | 'white',
          boardSize as 7 | 9 | 13 | 19,
          game.value.lastMove1 ?? undefined,
          game.value.history1
        );
        const legal2 = canPutChessSituationalSuperko(
          board2,
          position,
          aiType as 'black' | 'white',
          boardSize as 7 | 9 | 13 | 19,
          game.value.lastMove2 ?? undefined,
          game.value.history2
        );
        if (legal1 && legal2) {
          possibleMoves.push(position);
        }
      }
    }
  }
  
  
  if (possibleMoves.length === 0) {
    return null; // 没有可下的位置
  }
  
  // 如果只有一步可选，直接返回
  if (possibleMoves.length === 1) {
    return possibleMoves[0];
  }
  
  // 创建根节点
  const root = new MCTSNode('', null, possibleMoves, aiType);
  
  // MCTS主循环 - 优化性能
  const iterations = Math.min(100, possibleMoves.length * 20);
  
  for (let i = 0; i < iterations; i++) {
    // 1. 选择 (Selection)
    let node = root;
    while (node.children.length > 0 && node.untriedMoves.length === 0) {
      node = node.selectChild();
    }
    
    // 2. 扩展 (Expansion)
    if (node.untriedMoves.length > 0) {
      const randomMove = node.untriedMoves[Math.floor(Math.random() * node.untriedMoves.length)];
      const nextPlayer = node.player === 'black' ? 'white' : 'black';
      node = node.addChild(randomMove, [], nextPlayer);
    }
    
    // 3. 模拟 (Simulation)
    const result = simulateGame(node.position, node.player, board1, board2, boardSize);
    
    // 4. 回传 (Backpropagation)
    while (node !== null) {
      node.update(result);
      node = node.parent!;
    }
  }
  
  // 选择访问次数最多的子节点
  const bestChild = root.children.reduce((best, child) => 
    child.visits > best.visits ? child : best
  );
  
  console.log('MCTS结果:', bestChild.position, `(${bestChild.visits}次访问)`);

  return bestChild.position;
};

// 模拟游戏结果
const simulateGame = (move: string, player: 'black' | 'white', board1: Map<string, any>, board2: Map<string, any>, boardSize: number): number => {
  // 创建模拟棋盘
  const simBoard1 = new Map(board1);
  const simBoard2 = new Map(board2);
  
  // 模拟下棋
  const chessman = { position: move, type: player, brother: move };
  simBoard1.set(move, chessman);
  simBoard2.set(move, chessman);
  
  // 简单的随机模拟
  let currentPlayer = player === 'black' ? 'white' : 'black';
  let moves = 0;
  const maxMoves = 10; // 限制模拟步数
  
  while (moves < maxMoves) {
    const possibleMoves: string[] = [];
    for (let x = 1; x <= boardSize; x++) {
      for (let y = 1; y <= boardSize; y++) {
        const position = `${x},${y}`;
        if (!simBoard1.has(position) && !simBoard2.has(position)) {
          if (canPutChess(simBoard1, position, currentPlayer as 'black' | 'white', boardSize as 7 | 9 | 13 | 19) && 
              canPutChess(simBoard2, position, currentPlayer as 'black' | 'white', boardSize as 7 | 9 | 13 | 19)) {
            possibleMoves.push(position);
          }
        }
      }
    }
    
    if (possibleMoves.length === 0) break;
    
    // 随机选择一步
    const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    const chessman = { position: randomMove, type: currentPlayer, brother: randomMove };
    simBoard1.set(randomMove, chessman);
    simBoard2.set(randomMove, chessman);
    
    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    moves++;
  }
  
  // 简单的胜负判断（基于棋子数量）
  const blackCount = Array.from(simBoard1.values()).filter(chess => chess.type === 'black').length;
  const whiteCount = Array.from(simBoard1.values()).filter(chess => chess.type === 'white').length;
  
  // 返回结果：1表示AI（白棋）获胜，0表示平局，-1表示AI失败
  if (whiteCount > blackCount) return 1;
  if (whiteCount < blackCount) return -1;
  return 0;
};

// 将 GTP 坐标（如 "D16"/"Q3"）转换为 "x,y" 字符串（x 从上到下 1..N，y 从左到右 1..N）
const gtpToXY = (coord: string, size: number): string | null => {
  const c = coord.trim().toUpperCase();
  if (c === 'PASS' || c === 'RESIGN') return null;
  // 提取字母列 + 数字行
  const match = c.match(/^([A-Z])(\d{1,2})$/);
  if (!match) return null;
  const colChar = match[1];
  const row = parseInt(match[2], 10);
  // GTP 行号自底向上 -> x = size - row + 1
  const x = size - row + 1;
  // 列字母跳过 I：A..H=1..8, J=9, K=10,...
  const code = colChar.charCodeAt(0);
  const y = code < 'I'.charCodeAt(0)
    ? (code - 'A'.charCodeAt(0) + 1)
    : (code - 'A'.charCodeAt(0));
  if (x < 1 || y < 1 || x > size || y > size) return null;
  return `${x},${y}`;
};

// 从本局记录构造经典围棋历史（使用 board1 的着法）
const buildClassicHistory = (): { color: 'black' | 'white', position: string }[] => {
  const history: { color: 'black' | 'white', position: string }[] = [];
  for (const rec of game.value.records) {
    if (rec.add && rec.add.length > 0) {
      const m = rec.add[0];
      // 在 board1 的位置与颜色：position=add[0].position, color=add[0].type
      if (m && m.position && m.type) {
        history.push({ color: m.type as 'black' | 'white', position: m.position });
      }
    }
  }
  return history;
};

// 计算在当前双棋盘+SSK规则下不允许的点（供后端过滤）
const computeForbidden = (): string[] => {
  const boardSize = game.value.model as 7 | 9 | 13 | 19;
  const forbidden: string[] = [];
  const type1: 'black' | 'white' = 'white';
  const type2: 'black' | 'white' = (game.value.subStatus === 'common') ? 'white' : 'black';
  const isQuantumPos = (p: string) => p && (p === game.value.blackQuantum || p === game.value.whiteQuantum);
  for (let x = 1; x <= boardSize; x++) {
    for (let y = 1; y <= boardSize; y++) {
      const clicked = `${x},${y}`;
      if (game.value.board1.has(clicked) || game.value.board2.has(clicked)) { continue; }
      // 与 store.putChess 一致的落点映射：若点击量子位置，则两盘面分别落在黑/白量子位置
      let pos1 = clicked;
      let pos2 = clicked;
      if (game.value.subStatus === 'common' && isQuantumPos(clicked)) {
        pos1 = game.value.whiteQuantum; // AI=white，board1 落在 whiteQuantum
        pos2 = game.value.blackQuantum; // board2 落在 blackQuantum
      }
      const ok1 = canPutChessSituationalSuperko(
        game.value.board1, pos1, type1, boardSize,
        game.value.lastMove1 ?? undefined, game.value.history1
      );
      const ok2 = canPutChessSituationalSuperko(
        game.value.board2, pos2, type2, boardSize,
        game.value.lastMove2 ?? undefined, game.value.history2
      );
      if (!(ok1 && ok2)) forbidden.push(clicked);
    }
  }
  return forbidden;
};

// 调用后端 KataGo 获取 AI 一手；失败时回退到本地 MCTS
// Build both board histories for dual-board analysis
const buildDualHistories = (): {
  a: { color: 'black' | 'white', position: string }[],
  b: { color: 'black' | 'white', position: string }[],
} => {
  const a: { color: 'black' | 'white', position: string }[] = [];
  const b: { color: 'black' | 'white', position: string }[] = [];
  const opposite = (t: 'black' | 'white'): 'black' | 'white' => (t === 'black' ? 'white' : 'black');
  for (let i = 0; i < game.value.records.length; i++) {
    const rec = game.value.records[i];
    if (!rec.add || rec.add.length === 0) continue;
    const m = rec.add[0];
    if (!m || !m.position || !m.type) continue;
    const colorA = m.type as 'black' | 'white';
    const posA = m.position as string;
    const posB = (m.brother as string) || posA;
    // Quantum: first two moves invert colours between realities; afterwards same colours
    const colorB = (i <= 1) ? opposite(colorA) : colorA;
    a.push({ color: colorA, position: posA });
    b.push({ color: colorB, position: posB });
  }
  return { a, b };
};

const getAIMove = async (): Promise<{ kind: 'move' | 'pass' | 'resign', position?: string } | null> => {
  const boardSize = game.value.model;
  const next_to_move: 'black' | 'white' = 'white'; // 本页玩家=黑，AI=白
  const { a: board_a_moves, b: board_b_moves } = buildDualHistories();
  try {
    const res = await api.aiGenmoveDual({
      board_size: boardSize,
      next_to_move,
      board_a_moves,
      board_b_moves,
      komi: game.value.komi,
      rules: 'Chinese',
      forbidden: computeForbidden(),
    });
    if (!res.success) throw new Error(`aiGenmove http ${res.status}`);
    const mc = (res.data.move_coord as string || '').trim();
    if (!mc) throw new Error('empty move');
    if (mc.toLowerCase() === 'pass') return { kind: 'pass' };
    if (mc.toLowerCase() === 'resign') return { kind: 'resign' };
    const pos = gtpToXY(mc, boardSize);
    if (!pos) throw new Error('invalid coord');
    return { kind: 'move', position: pos };
  } catch (e) {
    console.warn('aiGenmove failed, fallback to MCTS', e);
    const p = getAIMoveLocal();
    if (!p) return { kind: 'pass' };
    return { kind: 'move', position: p };
  }
};

// AI下棋
const makeAIMove = async () => {
  if (stoneRemovalPhase.value) { return; }
  if (game.value.status !== 'playing' || game.value.round) {
    return; // 不是AI的回合
  }
  
  // AI开始思考，停止倒计时
  stopTimer();
  
  const aiMove = await getAIMove();
  if (!aiMove || aiMove.kind === 'pass') {
    // AI 无路可走 -> pass
    aiPassed.value = true;
    // 计入一个回合（AI方行动）
    game.value.moves++;
    // 提示 AI pass，便于玩家选择跟着 pass 终局
    ElMessage.warning({ message: lang.value.text.room.ai_pass, grouping: true });
    // 双方连续弃权 -> 进入点目（AI默认接受）
    if (playerPassed.value) {
      enterStoneRemoval();
      isAIThinking.value = false;
      return;
    }
    // 切回玩家回合
    store.commit('game/setRound', true);
    isAIThinking.value = false;
    // AI pass后，启动玩家回合倒计时
    startPlayerTimer();
    return;
  }
  if (aiMove.kind === 'resign') {
    // AI 认输 -> 玩家胜
    store.commit('game/setStatus', 'finished');
    store.commit('game/setRound', false);
    ElMessageBox.alert(lang.value.text.room.ai_resign_you_win, lang.value.text.room.finish_title, { confirmButtonText: 'OK' });
    isAIThinking.value = false;
    return;
  }
  
  // 为避免“AI不走”现象：
  // 1) 先本地校验候选点（SSK），不合法则重试若干次；
  // 2) 若多次仍不合法则回退到本地搜索；
  let pos = aiMove.position as string | undefined;
  const maxTries = 3;
  let tries = 0;
  const isLegalForBoth = (clicked: string) => {
    // 与 store.putChess 相同的坐标映射规则
    const type1: ChessmanType = 'white';
    const type2: ChessmanType = (game.value.subStatus === 'common') ? 'white' : 'black';
    const isQuantumPos = (p: string) => p && (p === game.value.blackQuantum || p === game.value.whiteQuantum);
    let pos1 = clicked;
    let pos2 = clicked;
    if (game.value.subStatus === 'common' && isQuantumPos(clicked)) {
      pos1 = game.value.whiteQuantum;
      pos2 = game.value.blackQuantum;
    }
    const ok1 = canPutChessSituationalSuperko(
      game.value.board1, pos1, type1, game.value.model,
      game.value.lastMove1 ?? undefined, game.value.history1
    );
    const ok2 = canPutChessSituationalSuperko(
      game.value.board2, pos2, type2, game.value.model,
      game.value.lastMove2 ?? undefined, game.value.history2
    );
    return ok1 && ok2;
  };
  while (pos && !isLegalForBoth(pos) && tries < maxTries) {
    console.warn('AI建议点不合法，重试', { pos, tries });
    const retry = await getAIMove();
    tries++;
    if (!retry || retry.kind !== 'move') { pos = undefined; break; }
    pos = retry.position;
  }
  if (!pos || !isLegalForBoth(pos)) {
    // 仍不合法：尝试本地找一个可行点
    const fallback = getAIMoveLocal();
    if (!fallback) {
      // 落子失败，视为 pass
      aiPassed.value = true;
      ElMessage.warning({ message: lang.value.text.room.ai_pass, grouping: true });
      if (playerPassed.value) { enterStoneRemoval(); isAIThinking.value = false; return; }
      store.commit('game/setRound', true);
      isAIThinking.value = false;
      return;
    }
    pos = fallback;
  }

  console.log('AI move:', pos);
  // 使用store的putChess action，与PVP模式保持一致
  const result = await store.dispatch('game/putChess', { position: pos, type: 'white' });
  if (!result) {
    // 若仍失败，最终视为 pass
    aiPassed.value = true;
    ElMessage.warning({ message: lang.value.text.room.ai_pass, grouping: true });
    if (playerPassed.value) { enterStoneRemoval(); isAIThinking.value = false; return; }
    store.commit('game/setRound', true);
    isAIThinking.value = false;
    return;
  }
  
  // AI成功落子，清除弃权标记
  aiPassed.value = false;
  playerPassed.value = false;
  // 计入一个回合（AI方行动）
  game.value.moves++;
  // 清除AI思考状态
  isAIThinking.value = false;
  
  // AI下棋完成，启动玩家回合倒计时
  startPlayerTimer();
};

// 棋盘点击处理
const onBoardClick = (position: string, board: string) => {
  if (stoneRemovalPhase.value) { return; }
  // 只有在玩家回合且AI不在思考时才允许下棋
  if (!game.value.round || isAIThinking.value) {
    return;
  }
  
  // 调用玩家下棋函数
  putChess(position);
};

// 玩家下棋
const putChess = async (position: string) => {
  if (stoneRemovalPhase.value) { return; }
  // 玩家下棋，停止倒计时
  stopTimer();
  
  // 检查是否是玩家的回合
  if (!game.value.round) {
    return;
  }
  
  // 检查位置是否已被占用
  if (game.value.board1.has(position) || game.value.board2.has(position)) {
    ElMessage.warning(lang.value.text.room.position_occupied);
    return;
  }
  
  // 检查是否可以下棋（围棋规则，包括劫检测）
  // 玩家永远下黑棋
  if (!canPutChess(game.value.board1, position, 'black', game.value.model) || 
      !canPutChess(game.value.board2, position, 'black', game.value.model)) {
    ElMessage.warning(lang.value.text.room.invalid_move);
    return;
  }
  
  // 使用store的putChess action，与PVP模式保持一致
  const result = await store.dispatch('game/putChess', { position, type: 'black' });
  if (!result) {
    ElMessage.warning(lang.value.text.room.invalid_move);
    return;
  }
  
  // 玩家成功落子，清除弃权标记
  playerPassed.value = false;
  aiPassed.value = false;
  // 计入一个回合（玩家行动）
  game.value.moves++;
  // 延迟让AI下棋，让玩家看到黑棋完全落定
  isAIThinking.value = true; // 设置AI思考状态
  // 玩家下棋后不启动倒计时，因为AI即将思考
  setTimeout(() => {
    makeAIMove();
  }, 500); // 延迟500毫秒
};

// 悔棋
const backChess = async () => {
  if (stoneRemovalPhase.value) { return; }
  if (!game.value.round) {
    ElMessage.warning({ message: lang.value.text.room.not_round, grouping: true });
    return;
  }
  if (game.value.records.length < 2) {
    ElMessage.warning({ message: lang.value.text.room.takeback_too_few, grouping: true });
    return;
  }
  
  await store.dispatch('game/backChess');
  ElMessage.success(lang.value.text.room.takeback_success);
};

// 认输
const resign = () => {
  if (stoneRemovalPhase.value) { return; }
  ElMessageBox.confirm(lang.value.text.room.resign_confirm, lang.value.text.index.confirm, {
    confirmButtonText: lang.value.text.index.confirm,
    cancelButtonText: lang.value.text.index.cancel,
    type: 'warning'
  }).then(() => {
    store.commit('game/setStatus', 'finished');
    store.commit('game/setRound', false);
    ElMessageBox.alert(lang.value.text.room.ai_win, lang.value.text.room.finish_title, { confirmButtonText: 'OK' });
  });
};

// 弃权
const passChess = () => {
  if (stoneRemovalPhase.value) { return; }
  if (!game.value.round) {
    ElMessage.warning({ message: lang.value.text.room.not_round, grouping: true });
    return;
  }
  if (game.value.board1.size <= 2) {
    ElMessage.warning({ message: lang.value.text.room.pass_too_few, grouping: true });
    return;
  }
  
  // 玩家弃权，停止倒计时
  stopTimer();
  
  // 玩家弃权，轮到AI
  store.commit('game/setRound', false);
  game.value.moves++;
  // 双方连续弃权 -> 进入点目（AI默认接受）
  if (aiPassed.value) { enterStoneRemoval(); return; }
  playerPassed.value = true;
  
  // AI继续下棋
  setTimeout(() => {
    makeAIMove();
  }, 1000);
};

// ======== Score estimator + Stone removal helpers ========
const estimateScore = async () => {
  if (showScoreEstimate.value) {
    showScoreEstimate.value = false; scoreEstimateData1.value = null; scoreEstimateData2.value = null; return;
  }
  if (estimatingScore.value) return;
  try {
    estimatingScore.value = true;
    const collect = (b: Map<string, any>) => { const black: string[] = [], white: string[] = []; for (let i = 1; i <= game.value.model * game.value.model; i++) { const pos = `${((i - 1) % game.value.model) + 1},${Math.floor((i - 1) / game.value.model) + 1}`; const c = b.get(pos); if (!c) continue; (c.type === 'black' ? black : white).push(pos); } return { black, white }; };
    const a1 = collect(game.value.board1); const a2 = collect(game.value.board2);
    const resp = await api.scoreEstimate({ boards: [
      { board_size: game.value.model, black_stones: a1.black, white_stones: a1.white, next_to_move: game.value.round ? 'black' : 'white' },
      { board_size: game.value.model, black_stones: a2.black, white_stones: a2.white, next_to_move: game.value.round ? 'black' : 'white' }
    ]});
    const data = (resp as any).data || resp;
    if (data.boards && data.boards.length >= 2) {
      scoreEstimateData1.value = data.boards[0]; scoreEstimateData2.value = data.boards[1]; showScoreEstimate.value = true;
    } else { ElMessage.error({ message: 'Score estimation failed', grouping: true }); }
  } catch (e) { console.error(e); ElMessage.error({ message: 'Score estimation failed', grouping: true }); }
  finally { estimatingScore.value = false; }
};

const enterStoneRemoval = async () => { 
  stoneRemovalPhase.value = true; 
  myRemovalAccepted.value = false; 
  await autoScoreRemoval(); 
  // 确保在石子移除阶段显示形势判断
  if (!showScoreEstimate.value) {
    await estimateScore();
  }
};

// 继续游戏（退出石子移除阶段）
const continueGame = () => {
  // 重置石子移除相关状态
  stoneRemovalPhase.value = false;
  removalSet1.value = new Set();
  removalSet2.value = new Set();
  myRemovalAccepted.value = false;
  showScoreEstimate.value = false;
  
  // 清空分数估算数据，避免死子标记残留
  scoreEstimateData1.value = null;
  scoreEstimateData2.value = null;
  
  // 重置pass状态，允许继续游戏
  playerPassed.value = false;
  aiPassed.value = false;
  
  // 重新启动游戏回合
  store.commit("game/setRound", true);
  
  ElMessage.success(lang.value.text.room.continue_game_success);
};
const autoScoreRemoval = async () => {
  try {
    estimatingScore.value = true;
    const collect = (b: Map<string, any>) => { const black: string[] = [], white: string[] = []; for (let i = 1; i <= game.value.model * game.value.model; i++) { const pos = `${((i - 1) % game.value.model) + 1},${Math.floor((i - 1) / game.value.model) + 1}`; const c = b.get(pos); if (!c) continue; (c.type === 'black' ? black : white).push(pos); } return { black, white }; };
    const a1 = collect(game.value.board1); const a2 = collect(game.value.board2);
    const resp = await api.scoreEstimate({ boards: [
      { board_size: game.value.model, black_stones: a1.black, white_stones: a1.white, next_to_move: game.value.round ? 'black' : 'white' },
      { board_size: game.value.model, black_stones: a2.black, white_stones: a2.white, next_to_move: game.value.round ? 'black' : 'white' }
    ]});
    const data = (resp as any).data || resp; const r1 = data.boards?.[0]; const r2 = data.boards?.[1];
    if (r1 && r1.dead_stones) { const s = new Set<string>(); for (let i = 0; i < r1.dead_stones.length; i += 2) s.add(`${r1.dead_stones[i] + 1},${r1.dead_stones[i + 1] + 1}`); removalSet1.value = s; }
    if (r2 && r2.dead_stones) { const s = new Set<string>(); for (let i = 0; i < r2.dead_stones.length; i += 2) s.add(`${r2.dead_stones[i] + 1},${r2.dead_stones[i + 1] + 1}`); removalSet2.value = s; }
  } finally { estimatingScore.value = false; }
};
const clearRemoval = () => { removalSet1.value = new Set(); removalSet2.value = new Set(); myRemovalAccepted.value = false; };
const onToggleRemoval = (pos: string, which: string) => { const set = which === 'board1' ? removalSet1.value : removalSet2.value; if (set.has(pos)) set.delete(pos); else set.add(pos); myRemovalAccepted.value = false; };
const acceptRemoval = () => {
  myRemovalAccepted.value = true; // AI默认接受
  const cloneBoard = (src: Map<string, any>, removed: Set<string>) => { const m = new Map<string, any>(); src.forEach((v, k) => { if (!removed.has(k)) m.set(k, v); }); return m; };
  const b1 = cloneBoard(game.value.board1, removalSet1.value); const b2 = cloneBoard(game.value.board2, removalSet2.value);
  const r1 = calculateGoResult(b1 as any, game.value.model, 0, 0, 0); const r2 = calculateGoResult(b2 as any, game.value.model, 0, 0, 0);
  const KOMI_ONCE = game.value.komi ?? 7.5; const blackTotal = r1.blackScore + r2.blackScore; const whiteTotal = r1.whiteScore + r2.whiteScore + KOMI_ONCE;
  store.commit('game/setStatus', 'finished'); store.commit('game/setRound', false);
  const winnerName = blackTotal > whiteTotal ? lang.value.text.room.side_black : lang.value.text.room.side_white;
  finishMessage.value = (lang.value.text.room.game_over_side_win as string).replace('{side}', winnerName);
  finishVisible.value = true;
};

const downloadSGF = () => {
  try {
    const sgf = exportQuantumSGF(game.value.records, game.value.model, game.value.komi ?? 7.5);
    const blob = new Blob([sgf], { type: 'application/x-go-sgf;charset=utf-8' });
    const a = document.createElement('a');
    a.download = `quantumgo_ai_${Date.now()}.sgf`;
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

// 一键终局：进入点目并自动标注死子，但不自动接受
//（AI 默认已接受，玩家需手动点击 Accept 完成结算）
const endGameNow = async () => {
  stopTimer();
  await enterStoneRemoval();
  // 保留在点目阶段，等待玩家手动点击 Accept
};

// 发送消息
const sendMessage = async () => {
  if (!input.value) {
    return;
  }
  const message = input.value;
  input.value = "";
  barrage.value.sendBullet(message, 0);
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
</script>

<style scoped lang="scss">
@use "./index.scss" as *;

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

<!-- Finish dialog with SGF download -->
 
