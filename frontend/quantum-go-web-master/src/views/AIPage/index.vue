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
        <div class="summary">{{ lang.text.room.board1 }}: {{ board1LeadText }} | {{ lang.text.room.board2 }}: {{ board2LeadText }}</div>
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
          <button class="rv-btn" @click="step(-5)" :disabled="currentMove === 0">&laquo;&laquo;</button>
          <button class="rv-btn" @click="step(-1)" :disabled="currentMove === 0">&laquo;</button>
        </div>
        <div class="center">{{ displayMove }} / {{ totalMoves }}</div>
        <div class="right">
          <button class="rv-btn" @click="step(1)" :disabled="currentMove === totalMoves">&raquo;</button>
          <button class="rv-btn" @click="step(5)" :disabled="currentMove === totalMoves">&raquo;&raquo;</button>
          <button class="rv-btn" @click="gotoEnd" :disabled="currentMove === totalMoves">&raquo;&raquo;&raquo;</button>
        </div>
      </div>
      <div class="countdown-slot">
        <div class="countdown-inner" :class="{ visible: true }" style="display:flex; gap: 24px; align-items:center;">
          <div style="display:flex; flex-direction:column; align-items:center;">
            <el-progress type="circle" striped striped-flow :percentage="progressBlack" :color="progressColors" :format="() => blackClock" />
            <div style="margin-top:6px; font-weight:600; color:#333;">{{ lang.text.room.side_black }}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:center;">
            <el-progress type="circle" striped striped-flow :percentage="progressWhite" :color="progressColors" :format="() => whiteClock" />
            <div style="margin-top:6px; font-weight:600; color:#333;">{{ lang.text.room.side_white }}</div>
          </div>
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
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox, ElProgress, ElLoading, ElDialog, ElButton } from "element-plus";
import { Chessman, ChessmanType } from "@/utils/types";
import api from "@/utils/api";
import { canPutChess, canPutChessSituationalSuperko, hashBoardWithTurn } from "@/utils/chess";
import { calculateGoResult } from "@/utils/chess2";
import { exportQuantumSGF } from "@/utils/sgf";
import { initRuntime, startTurn, finishMove, currentMsUntilTimeout, displayString } from "@/utils/timeControl";

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

// è¿›åº¦æ¡ç›¸å…³
const progressColors = ref([
  { color: "#f56c6c", percentage: 30 },
  { color: "#e6a23c", percentage: 60 },
  { color: "#5cb87a", percentage: 100 }
]);
const progressLabel = (_percentage: number) => '--';

const progress = ref(0);
let timer: NodeJS.Timeout | undefined;

// AIæ€è€ƒçŠ¶æ€ä¸Žå¼ƒæƒè·Ÿè¸ª
const isAIThinking = ref(false);
const playerPassed = ref(false);
const aiPassed = ref(false);

// Score Estimator & ç‚¹ç›®
const showScoreEstimate = ref(false);
const estimatingScore = ref(false);
const scoreEstimateData1 = ref<any>(null);
const scoreEstimateData2 = ref<any>(null);
const stoneRemovalPhase = ref(false);
const removalSet1 = ref<Set<string>>(new Set());
const removalSet2 = ref<Set<string>>(new Set());
const myRemovalAccepted = ref(false); // AI é»˜è®¤æŽ¥å—ï¼Œåªéœ€çŽ©å®¶æŽ¥å—
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

// Time control runtime (AI mode: player=black, AI=white)
let timeRt = initRuntime((store.state.game.timeControl ?? null) as any);
const blackClock = ref('');
const whiteClock = ref('');
const progressBlack = ref(0);
const progressWhite = ref(0);
let clockTimer: any = null;

function startClockLoop() {
  clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    const now = Date.now();
    try {
      blackClock.value = displayString(timeRt, 'black', now);
      whiteClock.value = displayString(timeRt, 'white', now);
      const msB = currentMsUntilTimeout(timeRt, 'black', now);
      const msW = currentMsUntilTimeout(timeRt, 'white', now);
      const cfg: any = timeRt.config;
      if (cfg) {
        if (timeRt.forPlayer.black.onThePlaySince != null && msB != null) {
          let denom = cfg.mainTimeMS || 1;
          if (cfg.type === 'byoyomi' || cfg.type === 'canadian') {
            const s: any = timeRt.forPlayer.black.clockState;
            denom = s.mainTimeRemainingMS > 0 ? cfg.mainTimeMS : cfg.periodTimeMS;
          }
          progressBlack.value = Math.max(0, Math.min(100, Math.floor((msB / Math.max(1, denom)) * 100)));
        }
        if (timeRt.forPlayer.white.onThePlaySince != null && msW != null) {
          let denom = cfg.mainTimeMS || 1;
          if (cfg.type === 'byoyomi' || cfg.type === 'canadian') {
            const s: any = timeRt.forPlayer.white.clockState;
            denom = s.mainTimeRemainingMS > 0 ? cfg.mainTimeMS : cfg.periodTimeMS;
          }
          progressWhite.value = Math.max(0, Math.min(100, Math.floor((msW / Math.max(1, denom)) * 100)));
        }
      }
    } catch {}
  }, 100);
}

// Legacy countdown disabled
const startPlayerTimer = () => { /* no-op */ };
const stopTimer = () => { /* no-op */ };

// åˆå§‹åŒ–AIæ¸¸æˆ
onMounted(() => {
  // å»¶è¿Ÿåˆå§‹åŒ–ï¼Œç¡®ä¿DOMå…ƒç´ å·²ç»æ¸²æŸ“
  setTimeout(() => {
    initAIGame(); startClockLoop();
  }, 100);
});

function initAIGame() {
  // Set AI game mode and initial state
  store.commit('game/setGameMode', 'ai');
  store.commit('game/setStatus', 'playing');
  store.commit('game/setRound', true); // Black to move
  store.commit('game/setCamp', 'black');

  // Reset boards and counters
  game.value.board1.clear();
  game.value.board2.clear();
  game.value.moves = 0;
  game.value.records = [];
  game.value.subStatus = 'black';
  game.value.blackQuantum = '';
  game.value.whiteQuantum = '';

  // Reset superko histories
  if (game.value.history1?.clear) game.value.history1.clear();
  if (game.value.history2?.clear) game.value.history2.clear();
  if (game.value.history1?.add) game.value.history1.add(hashBoardWithTurn(game.value.board1, 'black'));
  if (game.value.history2?.add) game.value.history2.add(hashBoardWithTurn(game.value.board2, 'black'));

  // Reset pass flags
  playerPassed.value = false;
  aiPassed.value = false;

  // Initialize time control and start Black's clock
  timeRt = initRuntime((store.state.game.timeControl ?? null) as any);
  startTurn(timeRt, 'black', Date.now());
  startPlayerTimer();
}

// MCTSï¼ˆæœ¬åœ°ç®€æ˜“AIï¼‰ä½œä¸ºåŽå¤‡æ–¹æ¡ˆ
// MCTSèŠ‚ç‚¹ç±»
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
  
  // UCB1å…¬å¼
  ucb1(c: number = 1.414): number {
    if (this.visits === 0) return Infinity;
    return (this.wins / this.visits) + c * Math.sqrt(Math.log(this.parent?.visits || 1) / this.visits);
  }
  
  // é€‰æ‹©æœ€ä½³å­èŠ‚ç‚¹
  selectChild(): MCTSNode {
    return this.children.reduce((best, child) => 
      child.ucb1() > best.ucb1() ? child : best
    );
  }
  
  // æ·»åŠ å­èŠ‚ç‚¹
  addChild(position: string, untriedMoves: string[], player: 'black' | 'white'): MCTSNode {
    const child = new MCTSNode(position, this, untriedMoves, player);
    this.children.push(child);
    this.untriedMoves = this.untriedMoves.filter(move => move !== position);
    return child;
  }
  
  // æ›´æ–°èŠ‚ç‚¹ç»Ÿè®¡
  update(result: number) {
    this.visits++;
    this.wins += result;
  }
}

// æœ¬åœ°MCTSç®—æ³•ï¼ˆåŽå¤‡ï¼‰
const getAIMoveLocal = (): string | null => {
  const board1 = game.value.board1;
  const board2 = game.value.board2;
  const boardSize = game.value.model;
  const aiType = 'white'; // AIæ˜¯ç™½æ£‹
  
  console.log('Fallback MCTS - æ£‹ç›˜å°ºå¯¸:', boardSize);
  
  // èŽ·å–æ‰€æœ‰å¯èƒ½çš„ä½ç½®
  const possibleMoves: string[] = [];
  for (let x = 1; x <= boardSize; x++) {
    for (let y = 1; y <= boardSize; y++) {
      const position = `${x},${y}`;
      if (!board1.has(position) && !board2.has(position)) {
        // ä½¿ç”¨æƒ…æ™¯è¶…åŠ«ï¼ˆSSKï¼‰ä¸€è‡´æ€§æ£€æŸ¥ï¼Œé¿å…åŽç»­è¢« store æ‹’ç»
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
    return null; // æ²¡æœ‰å¯ä¸‹çš„ä½ç½®
  }
  
  // å¦‚æžœåªæœ‰ä¸€æ­¥å¯é€‰ï¼Œç›´æŽ¥è¿”å›ž
  if (possibleMoves.length === 1) {
    return possibleMoves[0];
  }
  
  // åˆ›å»ºæ ¹èŠ‚ç‚¹
  const root = new MCTSNode('', null, possibleMoves, aiType);
  
  // MCTSä¸»å¾ªçŽ¯ - ä¼˜åŒ–æ€§èƒ½
  const iterations = Math.min(100, possibleMoves.length * 20);
  
  for (let i = 0; i < iterations; i++) {
    // 1. é€‰æ‹© (Selection)
    let node = root;
    while (node.children.length > 0 && node.untriedMoves.length === 0) {
      node = node.selectChild();
    }
    
    // 2. æ‰©å±• (Expansion)
    if (node.untriedMoves.length > 0) {
      const randomMove = node.untriedMoves[Math.floor(Math.random() * node.untriedMoves.length)];
      const nextPlayer = node.player === 'black' ? 'white' : 'black';
      node = node.addChild(randomMove, [], nextPlayer);
    }
    
    // 3. æ¨¡æ‹Ÿ (Simulation)
    const result = simulateGame(node.position, node.player, board1, board2, boardSize);
    
    // 4. å›žä¼  (Backpropagation)
    while (node !== null) {
      node.update(result);
      node = node.parent!;
    }
  }
  
  // é€‰æ‹©è®¿é—®æ¬¡æ•°æœ€å¤šçš„å­èŠ‚ç‚¹
  const bestChild = root.children.reduce((best, child) => 
    child.visits > best.visits ? child : best
  );
  
  console.log('MCTSç»“æžœ:', bestChild.position, `(${bestChild.visits}æ¬¡è®¿é—®)`);

  return bestChild.position;
};

// æ¨¡æ‹Ÿæ¸¸æˆç»“æžœ
const simulateGame = (move: string, player: 'black' | 'white', board1: Map<string, any>, board2: Map<string, any>, boardSize: number): number => {
  // åˆ›å»ºæ¨¡æ‹Ÿæ£‹ç›˜
  const simBoard1 = new Map(board1);
  const simBoard2 = new Map(board2);
  
  // æ¨¡æ‹Ÿä¸‹æ£‹
  const chessman = { position: move, type: player, brother: move };
  simBoard1.set(move, chessman);
  simBoard2.set(move, chessman);
  
  // ç®€å•çš„éšæœºæ¨¡æ‹Ÿ
  let currentPlayer = player === 'black' ? 'white' : 'black';
  let moves = 0;
  const maxMoves = 10; // é™åˆ¶æ¨¡æ‹Ÿæ­¥æ•°
  
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
    
    // éšæœºé€‰æ‹©ä¸€æ­¥
    const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    const chessman = { position: randomMove, type: currentPlayer, brother: randomMove };
    simBoard1.set(randomMove, chessman);
    simBoard2.set(randomMove, chessman);
    
    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    moves++;
  }
  
  // ç®€å•çš„èƒœè´Ÿåˆ¤æ–­ï¼ˆåŸºäºŽæ£‹å­æ•°é‡ï¼‰
  const blackCount = Array.from(simBoard1.values()).filter(chess => chess.type === 'black').length;
  const whiteCount = Array.from(simBoard1.values()).filter(chess => chess.type === 'white').length;
  
  // è¿”å›žç»“æžœï¼š1è¡¨ç¤ºAIï¼ˆç™½æ£‹ï¼‰èŽ·èƒœï¼Œ0è¡¨ç¤ºå¹³å±€ï¼Œ-1è¡¨ç¤ºAIå¤±è´¥
  if (whiteCount > blackCount) return 1;
  if (whiteCount < blackCount) return -1;
  return 0;
};

// å°† GTP åæ ‡ï¼ˆå¦‚ "D16"/"Q3"ï¼‰è½¬æ¢ä¸º "x,y" å­—ç¬¦ä¸²ï¼ˆx ä»Žä¸Šåˆ°ä¸‹ 1..Nï¼Œy ä»Žå·¦åˆ°å³ 1..Nï¼‰
const gtpToXY = (coord: string, size: number): string | null => {
  const c = coord.trim().toUpperCase();
  if (c === 'PASS' || c === 'RESIGN') return null;
  // æå–å­—æ¯åˆ— + æ•°å­—è¡Œ
  const match = c.match(/^([A-Z])(\d{1,2})$/);
  if (!match) return null;
  const colChar = match[1];
  const row = parseInt(match[2], 10);
  // GTP è¡Œå·è‡ªåº•å‘ä¸Š -> x = size - row + 1
  const x = size - row + 1;
  // åˆ—å­—æ¯è·³è¿‡ Iï¼šA..H=1..8, J=9, K=10,...
  const code = colChar.charCodeAt(0);
  const y = code < 'I'.charCodeAt(0)
    ? (code - 'A'.charCodeAt(0) + 1)
    : (code - 'A'.charCodeAt(0));
  if (x < 1 || y < 1 || x > size || y > size) return null;
  return `${x},${y}`;
};

// ä»Žæœ¬å±€è®°å½•æž„é€ ç»å…¸å›´æ£‹åŽ†å²ï¼ˆä½¿ç”¨ board1 çš„ç€æ³•ï¼‰
const buildClassicHistory = (): { color: 'black' | 'white', position: string }[] => {
  const history: { color: 'black' | 'white', position: string }[] = [];
  for (const rec of game.value.records) {
    if (rec.add && rec.add.length > 0) {
      const m = rec.add[0];
      // åœ¨ board1 çš„ä½ç½®ä¸Žé¢œè‰²ï¼šposition=add[0].position, color=add[0].type
      if (m && m.position && m.type) {
        history.push({ color: m.type as 'black' | 'white', position: m.position });
      }
    }
  }
  return history;
};

// è®¡ç®—åœ¨å½“å‰åŒæ£‹ç›˜+SSKè§„åˆ™ä¸‹ä¸å…è®¸çš„ç‚¹ï¼ˆä¾›åŽç«¯è¿‡æ»¤ï¼‰
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
      // ä¸Ž store.putChess ä¸€è‡´çš„è½ç‚¹æ˜ å°„ï¼šè‹¥ç‚¹å‡»é‡å­ä½ç½®ï¼Œåˆ™ä¸¤ç›˜é¢åˆ†åˆ«è½åœ¨é»‘/ç™½é‡å­ä½ç½®
      let pos1 = clicked;
      let pos2 = clicked;
      if (game.value.subStatus === 'common' && isQuantumPos(clicked)) {
        pos1 = game.value.whiteQuantum; // AI=whiteï¼Œboard1 è½åœ¨ whiteQuantum
        pos2 = game.value.blackQuantum; // board2 è½åœ¨ blackQuantum
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

// è°ƒç”¨åŽç«¯ KataGo èŽ·å– AI ä¸€æ‰‹ï¼›å¤±è´¥æ—¶å›žé€€åˆ°æœ¬åœ° MCTS
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
  const next_to_move: 'black' | 'white' = 'white'; // æœ¬é¡µçŽ©å®¶=é»‘ï¼ŒAI=ç™½
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

// AIä¸‹æ£‹
const makeAIMove = async () => {
  if (stoneRemovalPhase.value) { return; }
  if (game.value.status !== 'playing' || game.value.round) {
    return; // ä¸æ˜¯AIçš„å›žåˆ
  }
  
  // AIå¼€å§‹æ€è€ƒï¼Œåœæ­¢å€’è®¡æ—¶
  stopTimer();
  
  const aiMove = await getAIMove();
  if (!aiMove || aiMove.kind === 'pass') {
    // AI æ— è·¯å¯èµ° -> pass
    aiPassed.value = true;
    // è®¡å…¥ä¸€ä¸ªå›žåˆï¼ˆAIæ–¹è¡ŒåŠ¨ï¼‰
    game.value.moves++;
    // æç¤º AI passï¼Œä¾¿äºŽçŽ©å®¶é€‰æ‹©è·Ÿç€ pass ç»ˆå±€
    ElMessage.warning({ message: lang.value.text.room.ai_pass, grouping: true });
    // åŒæ–¹è¿žç»­å¼ƒæƒ -> è¿›å…¥ç‚¹ç›®ï¼ˆAIé»˜è®¤æŽ¥å—ï¼‰
    if (playerPassed.value) {
      enterStoneRemoval();
      isAIThinking.value = false;
      return;
    }
    // åˆ‡å›žçŽ©å®¶å›žåˆ
    store.commit('game/setRound', true);
    isAIThinking.value = false;
    // AI passåŽï¼Œå¯åŠ¨çŽ©å®¶å›žåˆå€’è®¡æ—¶
    startPlayerTimer();
    return;
  }
  if (aiMove.kind === 'resign') {
    // AI è®¤è¾“ -> çŽ©å®¶èƒœ
    store.commit('game/setStatus', 'finished');
    store.commit('game/setRound', false);
    ElMessageBox.alert(lang.value.text.room.ai_resign_you_win, lang.value.text.room.finish_title, { confirmButtonText: 'OK' });
    isAIThinking.value = false;
    return;
  }
  
  // ä¸ºé¿å…â€œAIä¸èµ°â€çŽ°è±¡ï¼š
  // 1) å…ˆæœ¬åœ°æ ¡éªŒå€™é€‰ç‚¹ï¼ˆSSKï¼‰ï¼Œä¸åˆæ³•åˆ™é‡è¯•è‹¥å¹²æ¬¡ï¼›
  // 2) è‹¥å¤šæ¬¡ä»ä¸åˆæ³•åˆ™å›žé€€åˆ°æœ¬åœ°æœç´¢ï¼›
  let pos = aiMove.position as string | undefined;
  const maxTries = 3;
  let tries = 0;
  const isLegalForBoth = (clicked: string) => {
    // ä¸Ž store.putChess ç›¸åŒçš„åæ ‡æ˜ å°„è§„åˆ™
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
    console.warn('AIå»ºè®®ç‚¹ä¸åˆæ³•ï¼Œé‡è¯•', { pos, tries });
    const retry = await getAIMove();
    tries++;
    if (!retry || retry.kind !== 'move') { pos = undefined; break; }
    pos = retry.position;
  }
  if (!pos || !isLegalForBoth(pos)) {
    // ä»ä¸åˆæ³•ï¼šå°è¯•æœ¬åœ°æ‰¾ä¸€ä¸ªå¯è¡Œç‚¹
    const fallback = getAIMoveLocal();
    if (!fallback) {
      // è½å­å¤±è´¥ï¼Œè§†ä¸º pass
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
  // ä½¿ç”¨storeçš„putChess actionï¼Œä¸ŽPVPæ¨¡å¼ä¿æŒä¸€è‡´
  const result = await (() => { const now = Date.now(); finishMove(timeRt,'white', now); startTurn(timeRt,'black', now); return store.dispatch('game/putChess', { position: pos, type: 'white' }); })();
  if (!result) {
    // è‹¥ä»å¤±è´¥ï¼Œæœ€ç»ˆè§†ä¸º pass
    aiPassed.value = true;
    ElMessage.warning({ message: lang.value.text.room.ai_pass, grouping: true });
    if (playerPassed.value) { enterStoneRemoval(); isAIThinking.value = false; return; }
    store.commit('game/setRound', true);
    isAIThinking.value = false;
    return;
  }
  
  // AIæˆåŠŸè½å­ï¼Œæ¸…é™¤å¼ƒæƒæ ‡è®°
  aiPassed.value = false;
  playerPassed.value = false;
  // è®¡å…¥ä¸€ä¸ªå›žåˆï¼ˆAIæ–¹è¡ŒåŠ¨ï¼‰
  game.value.moves++;
  // æ¸…é™¤AIæ€è€ƒçŠ¶æ€
  isAIThinking.value = false;
  
  // AIä¸‹æ£‹å®Œæˆï¼Œå¯åŠ¨çŽ©å®¶å›žåˆå€’è®¡æ—¶
  startPlayerTimer();
};

// æ£‹ç›˜ç‚¹å‡»å¤„ç†
const onBoardClick = (position: string, board: string) => {
  if (stoneRemovalPhase.value) { return; }
  // åªæœ‰åœ¨çŽ©å®¶å›žåˆä¸”AIä¸åœ¨æ€è€ƒæ—¶æ‰å…è®¸ä¸‹æ£‹
  if (!game.value.round || isAIThinking.value) {
    return;
  }
  
  // è°ƒç”¨çŽ©å®¶ä¸‹æ£‹å‡½æ•°
  putChess(position);
};

// çŽ©å®¶ä¸‹æ£‹
const putChess = async (position: string) => {
  if (stoneRemovalPhase.value) { return; }
  // çŽ©å®¶ä¸‹æ£‹ï¼Œåœæ­¢å€’è®¡æ—¶
  stopTimer();
  
  // æ£€æŸ¥æ˜¯å¦æ˜¯çŽ©å®¶çš„å›žåˆ
  if (!game.value.round) {
    return;
  }
  
  // æ£€æŸ¥ä½ç½®æ˜¯å¦å·²è¢«å ç”¨
  if (game.value.board1.has(position) || game.value.board2.has(position)) {
    ElMessage.warning(lang.value.text.room.position_occupied);
    return;
  }
  
  // æ£€æŸ¥æ˜¯å¦å¯ä»¥ä¸‹æ£‹ï¼ˆå›´æ£‹è§„åˆ™ï¼ŒåŒ…æ‹¬åŠ«æ£€æµ‹ï¼‰
  // çŽ©å®¶æ°¸è¿œä¸‹é»‘æ£‹
  if (!canPutChess(game.value.board1, position, 'black', game.value.model) || 
      !canPutChess(game.value.board2, position, 'black', game.value.model)) {
    ElMessage.warning(lang.value.text.room.invalid_move);
    return;
  }
  
  // ä½¿ç”¨storeçš„putChess actionï¼Œä¸ŽPVPæ¨¡å¼ä¿æŒä¸€è‡´
  const result = await (() => { const now = Date.now(); finishMove(timeRt,'black', now); startTurn(timeRt,'white', now); return store.dispatch('game/putChess', { position, type: 'black' }); })();
  if (!result) {
    ElMessage.warning(lang.value.text.room.invalid_move);
    return;
  }
  
  // çŽ©å®¶æˆåŠŸè½å­ï¼Œæ¸…é™¤å¼ƒæƒæ ‡è®°
  playerPassed.value = false;
  aiPassed.value = false;
  // è®¡å…¥ä¸€ä¸ªå›žåˆï¼ˆçŽ©å®¶è¡ŒåŠ¨ï¼‰
  game.value.moves++;
  // å»¶è¿Ÿè®©AIä¸‹æ£‹ï¼Œè®©çŽ©å®¶çœ‹åˆ°é»‘æ£‹å®Œå…¨è½å®š
  isAIThinking.value = true; // è®¾ç½®AIæ€è€ƒçŠ¶æ€
  // çŽ©å®¶ä¸‹æ£‹åŽä¸å¯åŠ¨å€’è®¡æ—¶ï¼Œå› ä¸ºAIå³å°†æ€è€ƒ
  setTimeout(() => {
    makeAIMove();
  }, 500); // å»¶è¿Ÿ500æ¯«ç§’
};

// æ‚”æ£‹
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

// è®¤è¾“
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

// å¼ƒæƒ
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
  
  // çŽ©å®¶å¼ƒæƒï¼Œåœæ­¢å€’è®¡æ—¶
  stopTimer();
  
  // çŽ©å®¶å¼ƒæƒï¼Œè½®åˆ°AI
  store.commit('game/setRound', false);
  game.value.moves++;
  // åŒæ–¹è¿žç»­å¼ƒæƒ -> è¿›å…¥ç‚¹ç›®ï¼ˆAIé»˜è®¤æŽ¥å—ï¼‰
  if (aiPassed.value) { enterStoneRemoval(); return; }
  playerPassed.value = true;
  { const now = Date.now(); finishMove(timeRt,'black', now); startTurn(timeRt,'white', now); }

  // AIç»§ç»­ä¸‹æ£‹
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
  // ç¡®ä¿åœ¨çŸ³å­ç§»é™¤é˜¶æ®µæ˜¾ç¤ºå½¢åŠ¿åˆ¤æ–­
  if (!showScoreEstimate.value) {
    await estimateScore();
  }
};

// ç»§ç»­æ¸¸æˆï¼ˆé€€å‡ºçŸ³å­ç§»é™¤é˜¶æ®µï¼‰
const continueGame = () => {
  // é‡ç½®çŸ³å­ç§»é™¤ç›¸å…³çŠ¶æ€
  stoneRemovalPhase.value = false;
  removalSet1.value = new Set();
  removalSet2.value = new Set();
  myRemovalAccepted.value = false;
  showScoreEstimate.value = false;
  
  // æ¸…ç©ºåˆ†æ•°ä¼°ç®—æ•°æ®ï¼Œé¿å…æ­»å­æ ‡è®°æ®‹ç•™
  scoreEstimateData1.value = null;
  scoreEstimateData2.value = null;
  
  // é‡ç½®passçŠ¶æ€ï¼Œå…è®¸ç»§ç»­æ¸¸æˆ
  playerPassed.value = false;
  aiPassed.value = false;
  
  // é‡æ–°å¯åŠ¨æ¸¸æˆå›žåˆ
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
  myRemovalAccepted.value = true; // AIé»˜è®¤æŽ¥å—
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

// ä¸€é”®ç»ˆå±€ï¼šè¿›å…¥ç‚¹ç›®å¹¶è‡ªåŠ¨æ ‡æ³¨æ­»å­ï¼Œä½†ä¸è‡ªåŠ¨æŽ¥å—
//ï¼ˆAI é»˜è®¤å·²æŽ¥å—ï¼ŒçŽ©å®¶éœ€æ‰‹åŠ¨ç‚¹å‡» Accept å®Œæˆç»“ç®—ï¼‰
const endGameNow = async () => {
  stopTimer();
  await enterStoneRemoval();
  // ä¿ç•™åœ¨ç‚¹ç›®é˜¶æ®µï¼Œç­‰å¾…çŽ©å®¶æ‰‹åŠ¨ç‚¹å‡» Accept
};

// å‘é€æ¶ˆæ¯
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

// -------- Keyboard controls --------
const handleKeydown = (event: KeyboardEvent) => {
  // åªåœ¨æ¸¸æˆè¿›è¡Œä¸­ä¸”æœ‰è®°å½•æ—¶å“åº”é”®ç›˜äº‹ä»¶
  if (game.value.status !== 'playing' || !game.value.records) return;
  
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
});
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
 











