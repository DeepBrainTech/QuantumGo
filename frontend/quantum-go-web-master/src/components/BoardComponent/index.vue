<template>
  <div :class="['container', {'board-hover': board.boardHover}]" v-bind="$attrs" @mouseover="onBoardHover" @mouseleave="onBoardUnhover">
    <slot />
    <canvas class="board" ref="canvas" />
    <div class="chessman-box" :style="{gridTemplateColumns: `repeat(${game.model}, 1fr)`,gridTemplateRows: `repeat(${game.model}, 1fr)`}">
      <div class="chessman" v-for="index in game.model * game.model" :key="index">
        <template v-if="info.has(getPositionStr(index))">
          <div :class="['quantum', info.get(getPositionStr(index)).type]" v-if="info.get(getPositionStr(index)).position !== info.get(getPositionStr(index)).brother">
            <div :class="['background', `q-${info.get(getPositionStr(index)).type}`,{reserve: info.get(getPositionStr(index)).type === 'white'}]" />
          </div>
          <div :class="['black', {last: lastChess.black === getPositionStr(index), dead: isDeadStone(index)}]" v-else-if="info.get(getPositionStr(index)).type === 'black'">
            <div v-if="isDeadStone(index)" class="dead-marker"></div>
          </div>
          <div :class="['white', {last: lastChess.white === getPositionStr(index), dead: isDeadStone(index)}]" v-else>
            <div v-if="isDeadStone(index)" class="dead-marker"></div>
          </div>
        </template>
        <div :class="['empty', game.camp, ((game.round || !game.roomId) && game.status !== 'finished') ? 'allowed' : '', board.hoverIndex === index ? 'hover' :'']"
             v-else @click="putChess(index)" @mouseover="onHover(index)" @mouseleave="onUnhover">
        </div>

        <div v-if="showScoreEstimate && scoreEstimateData && !info.has(getPositionStr(index)) && getOwnershipValue(index) > 0.6" class="score-estimate-marker" :key="`black-marker-${index}`">
          <div class="territory-marker black-territory" :title="`Black territory: ${getOwnershipValue(index).toFixed(2)}`"></div>
        </div>
        <div v-if="showScoreEstimate && scoreEstimateData && !info.has(getPositionStr(index)) && getOwnershipValue(index) < -0.6" class="score-estimate-marker" :key="`white-marker-${index}`">
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

const lastChess = computed(() => {
  const result = { black: "", white: "" };
  const lastWhite = game.value.records.filter((item: ChessmanRecord) => item.add[0].type === "white").pop();
  if (lastWhite) {
    if (props.info === "board1") {
      result.white = lastWhite.add[0].position;
    } else {
      result.white = lastWhite.add[0].brother;
    }
  }
  const lastBlack = game.value.records.filter((item: ChessmanRecord) => item.add[0].type === "black").pop();
  if (lastBlack) {
    if (props.info === "board1") {
      result.black = lastBlack.add[0].position;
    } else {
      result.black = lastBlack.add[0].brother;
    }
  }
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
  const x = Math.floor((n - 1) / game.value.model) + 1;
  const y = (n - 1) % game.value.model + 1;
  return `${x},${y}`;
};

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
  // 延迟生成棋盘，确保canvas元素已经渲染
  setTimeout(() => {
    generateBoard();
  }, 50);
});
watch(() => game.value.model, () => {
  // 延迟生成棋盘，确保canvas元素已经渲染
  setTimeout(() => {
    generateBoard();
  }, 50);
});

const putChess = async (index: number) => {
  if (!props.can) {
    ElMessage.warning({ message: lang.value.text.board.ws_connection_error, grouping: true });
    return;
  }
  if (!((game.value.round || !game.value.roomId) && game.value.status !== "finished")) {
    return;
  }
  let position = getPositionStr(index);
  if (game.value.board1.has(position) || game.value.board2.has(position)) {
    return;
  }
  
  // 检查是否是AI模式
  if (game.value.gameMode === 'ai') {
    // AI模式直接调用回调，不调用store的putChess
    props.callback(position, props.info);
    return;
  }
  
  // PVP模式使用store的putChess
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

// 检查是否为死子
const isDeadStone = (index: number): boolean => {
  if (!props.scoreEstimateData || !props.scoreEstimateData.deadStones) {
    return false;
  }
  
  const deadStones = props.scoreEstimateData.deadStones;
  const boardSize = game.value.model;
  
  // 调试信息
  if (deadStones.length > 0) {
    console.log('Dead stones data:', deadStones);
  }
  
  // 将棋盘索引转换为坐标
  const x = Math.floor((index - 1) / boardSize) + 1; // 行 (1-based)
  const y = (index - 1) % boardSize + 1; // 列 (1-based)
  
  // 检查是否在死子列表中
  for (let i = 0; i < deadStones.length; i += 2) {
    const deadX = deadStones[i] + 1; // 转换为1-based
    const deadY = deadStones[i + 1] + 1; // 转换为1-based
    if (deadX === x && deadY === y) {
      console.log(`Found dead stone at (${x}, ${y})`);
      return true;
    }
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
  
  // 将棋盘索引转换为坐标
  // 棋盘索引从1开始，转换为1-based坐标
  const x = Math.floor((index - 1) / boardSize) + 1; // 行 (1-based)
  const y = (index - 1) % boardSize + 1; // 列 (1-based)
  
  // 转换为0-based坐标，匹配后端set_stone(x-1, y-1, color)的格式
  const x0 = x - 1; // 行 (0-based)
  const y0 = y - 1; // 列 (0-based)
  
  // 计算所有权数组索引，使用C++ score-estimator的y * width + x格式
  const ownershipIndex = y0 * boardSize + x0;
  
  if (ownershipIndex >= 0 && ownershipIndex < ownership.length) {
    const value = ownership[ownershipIndex];
    // score-estimator的值范围是-1到1，不需要额外归一化
    return value;
  }
  
  return 0;
};
</script>

<style scoped lang="scss">
@use "./index.scss" as *;
</style>
