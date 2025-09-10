<template>
  <div class="main">
    <div v-if="game.status === 'playing'" class="operation">
      <div class="item btn" @click="passChess">{{ lang.text.room.pass }}</div>
      <div class="item btn" @click="backChess">{{ lang.text.room.takeback }}</div>
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
    </div>
    <div class="body">
      <div class="battle">
        <div class="board-box">
          <board-component class="board" info="board1" :can="true" :callback="onBoardClick" />
        </div>
        <div class="board-box">
          <board-component class="board" info="board2" :can="true" :callback="onBoardClick" />
        </div>
      </div>
      <div class="input-box">
        <input class="input" v-model="input" type="text" :placeholder="lang.text.room.chat_placeholder" @keyup.enter="sendMessage" />
      </div>
    </div>
    <el-progress class="progress" v-show="progress > 0" type="circle" striped striped-flow :percentage="progress" :color="progressColors" :format="progressLabel" />
    <barrage-component ref="barrage" />
  </div>
</template>

<script setup lang="ts">
import BoardComponent from "@/components/BoardComponent/index.vue";
import BarrageComponent from "@/components/BarrageComponent/index.vue";
import { useStore } from "vuex";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox, ElProgress, ElLoading } from "element-plus";
import { Chessman, ChessmanType } from "@/utils/types";
import { canPutChess, getCapturedChess } from "@/utils/chess";

const route = useRoute();
const router = useRouter();

const store = useStore();
const user = computed(() => store.state.user);
const game = computed(() => store.state.game);
const lang = computed(() => store.state.lang);

const barrage = ref();
const input = ref("");

// 进度条相关
const progressColors = ref([
  { color: "#f56c6c", percentage: 30 },
  { color: "#e6a23c", percentage: 60 },
  { color: "#5cb87a", percentage: 100 }
]);
const progressLabel = (percentage: number) => {
  return `${Math.floor(percentage / 100 * game.value.countdown)}S`;
};

const progress = ref(0);
let timer: NodeJS.Timeout | undefined;

// AI思考状态与弃权跟踪
const isAIThinking = ref(false);
const playerPassed = ref(false);
const aiPassed = ref(false);

// 初始化AI游戏
onMounted(() => {
  initAIGame();
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
  playerPassed.value = false;
  aiPassed.value = false;
  
  console.log('AI游戏已初始化');
};

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

// MCTS算法实现
const getAIMove = (): string | null => {
  const board1 = game.value.board1;
  const board2 = game.value.board2;
  const boardSize = game.value.model;
  const aiType = 'white'; // AI是白棋
  
  console.log('MCTS AI算法 - 棋盘尺寸:', boardSize);
  
  // 获取所有可能的位置
  const possibleMoves: string[] = [];
  for (let x = 1; x <= boardSize; x++) {
    for (let y = 1; y <= boardSize; y++) {
      const position = `${x},${y}`;
      if (!board1.has(position) && !board2.has(position)) {
        // 检查是否违反规则（包括劫检测）
        if (canPutChess(board1, position, aiType, boardSize) && 
            canPutChess(board2, position, aiType, boardSize)) {
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
          if (canPutChess(simBoard1, position, currentPlayer as 'black' | 'white', boardSize as 9 | 13 | 19) && 
              canPutChess(simBoard2, position, currentPlayer as 'black' | 'white', boardSize as 9 | 13 | 19)) {
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

// AI下棋
const makeAIMove = async () => {
  if (game.value.status !== 'playing' || game.value.round) {
    return; // 不是AI的回合
  }
  
  const aiMove = getAIMove();
  if (!aiMove) {
    // AI 无路可走 -> pass
    aiPassed.value = true;
    // 双方连续弃权 -> 终局
    if (playerPassed.value) {
      store.commit('game/setStatus', 'finished');
      store.commit('game/setRound', false);
      const winner = game.value.blackPoints > game.value.whitePoints ? '黑方' : '白方';
      ElMessageBox.alert(`游戏结束，${winner}胜`, 'Finish', { confirmButtonText: 'OK' });
      isAIThinking.value = false;
      return;
    }
    // 切回玩家回合
    store.commit('game/setRound', true);
    isAIThinking.value = false;
    return;
  }
  
  console.log('AI下棋:', aiMove);
  
  // 使用store的putChess action，与PVP模式保持一致
  const result = await store.dispatch('game/putChess', { position: aiMove, type: 'white' });
  if (!result) {
    // 落子失败，视为 pass
    aiPassed.value = true;
    if (playerPassed.value) {
      store.commit('game/setStatus', 'finished');
      store.commit('game/setRound', false);
      const winner = game.value.blackPoints > game.value.whitePoints ? '黑方' : '白方';
      ElMessageBox.alert(`游戏结束，${winner}胜`, 'Finish', { confirmButtonText: 'OK' });
      isAIThinking.value = false;
      return;
    }
    store.commit('game/setRound', true);
    isAIThinking.value = false;
    return;
  }
  
  // AI成功落子，清除弃权标记
  aiPassed.value = false;
  playerPassed.value = false;
  // 清除AI思考状态
  isAIThinking.value = false;
};

// 棋盘点击处理
const onBoardClick = (position: string, board: string) => {
  // 只有在玩家回合且AI不在思考时才允许下棋
  if (!game.value.round || isAIThinking.value) {
    return;
  }
  
  // 调用玩家下棋函数
  putChess(position);
};

// 玩家下棋
const putChess = async (position: string) => {
  if (timer) clearInterval(timer);
  progress.value = 0;
  
  // 检查是否是玩家的回合
  if (!game.value.round) {
    return;
  }
  
  // 检查位置是否已被占用
  if (game.value.board1.has(position) || game.value.board2.has(position)) {
    ElMessage.warning('该位置已有棋子');
    return;
  }
  
  // 检查是否可以下棋（围棋规则，包括劫检测）
  // 玩家永远下黑棋
  if (!canPutChess(game.value.board1, position, 'black', game.value.model) || 
      !canPutChess(game.value.board2, position, 'black', game.value.model)) {
    ElMessage.warning('无法在此位置下棋');
    return;
  }
  
  // 使用store的putChess action，与PVP模式保持一致
  const result = await store.dispatch('game/putChess', { position, type: 'black' });
  if (!result) {
    ElMessage.warning('无法在此位置下棋');
    return;
  }
  
  // 玩家成功落子，清除弃权标记
  playerPassed.value = false;
  aiPassed.value = false;
  // 延迟让AI下棋，让玩家看到黑棋完全落定
  isAIThinking.value = true; // 设置AI思考状态
  setTimeout(() => {
    makeAIMove();
  }, 500); // 延迟500毫秒
};

// 悔棋
const backChess = async () => {
  if (!game.value.round) {
    ElMessage.warning({ message: lang.value.text.room.not_round, grouping: true });
    return;
  }
  if (game.value.records.length < 2) {
    ElMessage.warning({ message: "步数太少，无法悔棋", grouping: true });
    return;
  }
  
  await store.dispatch('game/backChess');
  ElMessage.success('悔棋成功');
};

// 认输
const resign = () => {
  ElMessageBox.confirm('确定要认输吗？', '确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    store.commit('game/setStatus', 'finished');
    store.commit('game/setRound', false);
    ElMessageBox.alert('游戏结束，AI获胜', 'Finish', { confirmButtonText: 'OK' });
  });
};

// 弃权
const passChess = () => {
  if (!game.value.round) {
    ElMessage.warning({ message: lang.value.text.room.not_round, grouping: true });
    return;
  }
  if (game.value.board1.size <= 2) {
    ElMessage.warning({ message: "步数太少，无法弃权", grouping: true });
    return;
  }
  
  if (timer) clearInterval(timer);
  progress.value = 0;
  
  // 玩家弃权，轮到AI
  store.commit('game/setRound', false);
  game.value.moves++;
  // 双方连续弃权 -> 终局
  if (aiPassed.value) {
    store.commit('game/setStatus', 'finished');
    store.commit('game/setRound', false);
    const winner = game.value.blackPoints > game.value.whitePoints ? '黑方' : '白方';
    ElMessageBox.alert(`游戏结束，${winner}胜`, 'Finish', { confirmButtonText: 'OK' });
    return;
  }
  playerPassed.value = true;
  
  // AI继续下棋
  setTimeout(() => {
    makeAIMove();
  }, 1000);
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
</script>

<style scoped lang="scss">
@use "./index.scss" as *;
</style>
