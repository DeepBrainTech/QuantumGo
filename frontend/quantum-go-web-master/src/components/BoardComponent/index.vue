<template>
  <div :class="['container', {'board-hover': board.boardHover}]" v-bind="$attrs" @mouseover="onBoardHover" @mouseleave="onBoardUnhover">
    <slot />
    <canvas class="board" ref="canvas" />
    <div class="chessman-box" :style="{gridTemplateColumns: `repeat(${game.model}, 1fr)`,gridTemplateRows: `repeat(${game.model}, 1fr)`}">
      <div class="chessman" v-for="index in game.model * game.model" :key="index">
        <template v-if="info.has(getPositionStr(index))">
          <!-- 量子棋子：显示棋子，并在其上叠加红色 X 作为死子标记 -->
          <div v-if="isQuantumStone(getPositionStr(index))"
               :class="['quantum', info.get(getPositionStr(index)).type]" @click.stop="onToggleRemoval(index)">
            <div :class="['background', `q-${info.get(getPositionStr(index)).type}`,{reserve: info.get(getPositionStr(index)).type === 'white'}]" />
            <div class="dot top"></div>
            <div class="dot bottom"></div>
            <div v-if="showDead(index)" class="dead-x"></div>
          </div>

          <!-- 普通棋子：显示棋子，并在其上叠加红色 X 作为死子标记 -->
          <div v-else-if="info.get(getPositionStr(index)).type === 'black'"
               :class="['black', {last: lastChess.black === getPositionStr(index)}]" @click.stop="onToggleRemoval(index)">
            <div v-if="showDead(index)" class="dead-x"></div>
          </div>
          <div v-else
               :class="['white', {last: lastChess.white === getPositionStr(index)}]" @click.stop="onToggleRemoval(index)">
            <div v-if="showDead(index)" class="dead-x"></div>
          </div>
        </template>
        <div :class="['empty', game.camp, ((game.round || !game.roomId) && game.status !== 'finished') ? 'allowed' : '', board.hoverIndex === index ? 'hover' :'']"
             v-else @click="putChess(index)" @mouseover="onHover(index)" @mouseleave="onUnhover">
        </div>

        <div v-if="showScoreEstimate && scoreEstimateData && getOwnershipValue(index) > 0.6" class="score-estimate-marker" :key="`black-marker-${index}`">
          <div class="territory-marker black-territory" :title="`Black territory: ${getOwnershipValue(index).toFixed(2)}`"></div>
        </div>
        <div v-if="showScoreEstimate && scoreEstimateData && getOwnershipValue(index) < -0.6" class="score-estimate-marker" :key="`white-marker-${index}`">
          <div class="territory-marker white-territory" :title="`White territory: ${getOwnershipValue(index).toFixed(2)}`"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import { BoardModel, ChessmanRecord } from "@/utils/types";
import textureImgPath from "@/assets/img/board_bg2.png";

const props = defineProps({
  info: {
    type: String,
    required: true
  },
  stoneRemovalMode: {
    type: Boolean,
    default: false
  },
  removalSet: {
    type: Object,
    default: null
  },
  can: {
    type: Boolean,
    default: true
  },
  callback: {
    type: Function,
    default: () => false
  },
  showScoreEstimate: {
    type: Boolean,
    default: false
  },
  scoreEstimateData: {
    type: Object,
    default: null
  }
});
const store = useStore();
const lang = computed(() => store.state.lang);
const board = computed(() => store.state.board);
const game = computed(() => store.state.game);
const emit = defineEmits(["toggleRemoval"]);

const lastChess = computed(() => {
  // Show only the most recent move overall, not separate by color
  const result = { black: "", white: "" };
  const upto = game.value.reviewIndex && game.value.reviewIndex > 0 ? game.value.reviewIndex : game.value.records.length;
  if (upto === 0) return result;
  const last = game.value.records[upto - 1] as ChessmanRecord | undefined;
  if (!last) return result;
  const isBoard1 = props.info === "board1";
  const lastPos = isBoard1 ? last.add[0].position : last.add[0].brother;
  result.black = lastPos;
  result.white = lastPos;
  return result;
});


const onBoardHover = () => {
  store.commit("board/setBoardHover", true);
};
const onBoardUnhover = () => {
  store.commit("board/setBoardHover", false);
};


const onHover = (index: number) => {
  store.commit("board/setHoverIndex", index);
};
const onUnhover = () => {
  store.commit("board/setHoverIndex", -1);
};

const info = game.value[props.info];
const getPositionStr = (n: number) => {
  const x = ((n - 1) % game.value.model) + 1;
  const y = Math.floor((n - 1) / game.value.model) + 1;
  return `${x},${y}`;
};

// Build a 1-based set of dead-stone coordinates ("x,y") for O(1) lookup
const deadSet = computed<Set<string>>(() => {
  const set = new Set<string>();
  const ds = (props.scoreEstimateData as any)?.deadStones as number[] | undefined;
  if (!ds || ds.length === 0) return set;
  for (let i = 0; i < ds.length; i += 2) {
    const x = ds[i] + 1; // convert to 1-based
    const y = ds[i + 1] + 1;
    set.add(`${x},${y}`);
  }
  return set;
});

const canvas = ref();

const generateBoard = () => {
  if (!canvas.value) return;
  
  canvas.value.width = game.value.model * 100;
  canvas.value.height = game.value.model * 100;
  const ctx = canvas.value.getContext("2d");
  const textureImg = new Image();
  textureImg.src = textureImgPath;
  textureImg.onload = function() {
    ctx.globalAlpha = 0;
    ctx.drawImage(textureImg, 0, 0, canvas.value.width, canvas.value.height);
    ctx.background = "#FDEACF";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#EB894F99";
    ctx.fillStyle = "#EB894F";
    for (let i = 1; i <= game.value.model; i++) {
      ctx.moveTo(50, 100 * i - 50);
      ctx.lineTo(canvas.value.width - 50, 100 * i - 50);
      ctx.stroke();
      ctx.moveTo(100 * i - 50, 50);
      ctx.lineTo(100 * i - 50, canvas.value.width - 50);
      ctx.stroke();
    }
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(50, 50);
    ctx.lineTo(50, canvas.value.width - 50);
    ctx.lineTo(canvas.value.width - 50, canvas.value.width - 50);
    ctx.lineTo(canvas.value.width - 50, 50);
    ctx.closePath();
    ctx.stroke();
    const p = {
      7: [350],
      9: [250, 450, 650],
      13: [350, 650, 950],
      19: [350, 950, 1550]
    };
    const points = p[game.value.model as BoardModel];
    points.forEach((x) => {
      points.forEach((y) => {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
  };
};
onMounted(() => {

  setTimeout(() => {
    generateBoard();
  }, 50);
});
watch(() => game.value.model, () => {
  
  setTimeout(() => {
    generateBoard();
  }, 50);
});

const putChess = async (index: number) => {
  if (!props.can) {
    // Provide clearer reasons when interaction is disabled
    if (game.value.reviewMode) {
      ElMessage.warning({ message: lang.value.text.board.review_cannot_play ?? "Can't play moves while viewing previous round.", grouping: true });
    } else if (props.stoneRemovalMode) {
      ElMessage.warning({ message: lang.value.text.board.removal_cannot_play ?? "Can't play during stone removal.", grouping: true });
    } else {
      ElMessage.warning({ message: lang.value.text.board.ws_connection_error, grouping: true });
    }
    return;
  }
  if (!((game.value.round || !game.value.roomId) && game.value.status !== "finished")) {
    return;
  }
  let position = getPositionStr(index);
  if (game.value.board1.has(position) || game.value.board2.has(position)) {
    return;
  }
  
  // 
  if (game.value.gameMode === 'ai') {
    props.callback(position, props.info);
    return;
  }
  
  // 
  const type = game.value.camp;
  const result = await store.dispatch("game/putChess", { position, type });
  if (!result) {
    ElMessage({ message: lang.value.text.board.put_chess_error, grouping: true, type: "warning" });
    return;
  }
  props.callback(position, props.info);
};

const ownershipScale = computed(() => {
  const ownership = props.scoreEstimateData?.ownership;
  if (!ownership || ownership.length === 0) {
    return 1;
  }

  let maxMagnitude = 0;
  for (let i = 0; i < ownership.length; i++) {
    const magnitude = Math.abs(ownership[i]);
    if (magnitude > maxMagnitude) {
      maxMagnitude = magnitude;
    }
  }

  if (maxMagnitude === 0) {
    return 1;
  }
  return maxMagnitude;
});

// 优先使用后端死子列表；若缺失，则基于ownership保守判定
const isDeadStone = (index: number): boolean => {
  const pos = getPositionStr(index);
  // 1) 明确死子（score-estimator标注）
  if (deadSet.value.size && deadSet.value.has(pos)) return true;
  // 2) 基于ownership的保守推断
  const stone = info.get(pos);
  if (!stone || !props.scoreEstimateData || !props.scoreEstimateData.ownership) return false;
  const v = getOwnershipValue(index);
  if (stone.type === 'white' && v > 0.6) return true;
  if (stone.type === 'black' && v < -0.6) return true;
  return false;
};

// 在石子移除模式下优先根据选择集显示死子
const showDead = (index: number): boolean => {
  if (props.stoneRemovalMode && props.removalSet) {
    return (props.removalSet as Set<string>).has(getPositionStr(index));
  }
  return isDeadStone(index);
};

const onToggleRemoval = (index: number) => {
  if (!props.stoneRemovalMode) return;
  const pos = getPositionStr(index);
  if (!info.has(pos)) return;
  // 通知父组件切换该点的死活
  // @ts-ignore
  emit && emit("toggleRemoval", pos, props.info);
};

// 判断是否为量子棋子
const isQuantumStone = (position: string): boolean => {
  const stone = info.get(position);
  if (!stone) return false;
  
  // 原有的量子判断条件：position !== brother
  if (stone.position !== stone.brother) {
    return true;
  }
  
  // 新增：前两步棋（量子阶段）也显示为量子棋
  if (game.value.subStatus !== "common") {
    // 检查是否是量子位置的棋子
    return position === game.value.blackQuantum || position === game.value.whiteQuantum;
  }
  
  return false;
};

const getOwnershipValue = (index: number): number => {
  if (!props.scoreEstimateData || !props.scoreEstimateData.ownership) {
    return 0;
  }
  
  const ownership = props.scoreEstimateData.ownership;
  const boardSize = game.value.model;
  
  if (ownership.length !== boardSize * boardSize) {
    console.warn(`Ownership array length (${ownership.length}) doesn't match board size (${boardSize * boardSize})`);
    return 0;
  }
  

  const x = ((index - 1) % boardSize) + 1;
  const y = Math.floor((index - 1) / boardSize) + 1; 
  

  const x0 = x - 1; // è¡Œ (0-based)
  const y0 = y - 1; // åˆ— (0-based)
  

  const ownershipIndex = y0 * boardSize + x0;
  
  if (ownershipIndex >= 0 && ownershipIndex < ownership.length) {
    const value = ownership[ownershipIndex];

    return value;
  }
  
  return 0;
};
</script>

<style scoped lang="scss">
@use "./index.scss" as *;
</style>



