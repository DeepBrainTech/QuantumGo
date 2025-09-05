<template>
  <!-- 棋盘容器，支持悬停效果 -->
  <div :class="['container', {'board-hover': board.boardHover}]" v-bind="$attrs" @mouseover="onBoardHover" @mouseleave="onBoardUnhover">
    <!-- 插槽，用于放置其他组件 -->
    <slot />
    
    <!-- 棋盘背景画布 -->
    <canvas class="board" ref="canvas" />
    
    <!-- 棋子网格容器，动态设置网格大小 -->
    <div class="chessman-box" :style="{gridTemplateColumns: `repeat(${game.model}, 1fr)`,gridTemplateRows: `repeat(${game.model}, 1fr)`}">
      <!-- 遍历所有棋盘位置 -->
      <div class="chessman" v-for="index in game.model * game.model" :key="index">
        <!-- 如果位置有棋子 -->
        <template v-if="info.has(getPositionStr(index))">
          <!-- 量子棋子（位置与兄弟位置不同） -->
          <div :class="['quantum', info.get(getPositionStr(index)).type]" v-if="info.get(getPositionStr(index)).position !== info.get(getPositionStr(index)).brother">
            <div :class="['background', `q-${info.get(getPositionStr(index)).type}`,{reserve: info.get(getPositionStr(index)).type === 'white'}]" />
          </div>
          <!-- 普通黑棋 -->
          <div :class="['black', {last: lastChess.black === getPositionStr(index)}]" v-else-if="info.get(getPositionStr(index)).type === 'black'" />
          <!-- 普通白棋 -->
          <div :class="['white', {last: lastChess.white === getPositionStr(index)}]" v-else />
        </template>
        <!-- 空位，支持点击下棋和悬停效果 -->
        <div :class="['empty', game.camp, ((game.round || !game.roomId) && game.status !== 'finished') ? 'allowed' : '', board.hoverIndex === index ? 'hover' :'']"
             v-else @click="putChess(index)" @mouseover="onHover(index)" @mouseleave="onUnhover" />
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

/**
 * 棋盘组件属性定义
 */
const props = defineProps({
  /** 棋盘信息标识（board1 或 board2） */
  info: {
    type: String,
    required: true
  },
  /** 是否允许下棋 */
  can: {
    type: Boolean,
    default: true
  },
  /** 下棋回调函数 */
  callback: {
    type: Function,
    default: () => false
  }
});

// Vuex 状态管理
const store = useStore();
const lang = computed(() => store.state.lang);
const board = computed(() => store.state.board);
const game = computed(() => store.state.game);

/**
 * 计算最后一步棋的位置（用于高亮显示）
 */
const lastChess = computed(() => {
  const result = { black: "", white: "" };
  
  // 查找最后一步白棋
  const lastWhite = game.value.records.filter((item: ChessmanRecord) => item.add[0].type === "white").pop();
  if (lastWhite) {
    if (props.info === "board1") {
      result.white = lastWhite.add[0].position;
    } else {
      result.white = lastWhite.add[0].brother;
    }
  }
  
  // 查找最后一步黑棋
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

/**
 * 棋盘悬停事件处理
 */
const onBoardHover = () => {
  store.commit("board/setBoardHover", true);
};

const onBoardUnhover = () => {
  store.commit("board/setBoardHover", false);
};

/**
 * 棋子位置悬停事件处理
 */
const onHover = (index: number) => {
  store.commit("board/setHoverIndex", index);
};

const onUnhover = () => {
  store.commit("board/setHoverIndex", -1);
};

// 获取当前棋盘信息
const info = game.value[props.info];

/**
 * 将索引转换为位置字符串
 * @param n 网格索引（从1开始）
 * @returns 位置字符串 "x,y"
 */
const getPositionStr = (n: number) => {
  const x = Math.floor((n - 1) / game.value.model) + 1;
  const y = (n - 1) % game.value.model + 1;
  return `${x},${y}`;
};

// 画布引用
const canvas = ref();

/**
 * 生成棋盘背景
 * 绘制网格线、边框和星位点
 */
const generateBoard = () => {
  // 设置画布尺寸
  canvas.value.width = game.value.model * 100;
  canvas.value.height = game.value.model * 100;
  const ctx = canvas.value.getContext("2d");
  
  // 加载背景纹理
  const textureImg = new Image();
  textureImg.src = textureImgPath;
  textureImg.onload = function() {
    // 绘制背景纹理
    ctx.globalAlpha = 0;
    ctx.drawImage(textureImg, 0, 0, canvas.value.width, canvas.value.height);
    ctx.background = "#FDEACF";
    ctx.globalAlpha = 1;
    
    // 绘制网格线
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#EB894F99";
    ctx.fillStyle = "#EB894F";
    
    for (let i = 1; i <= game.value.model; i++) {
      // 水平线
      ctx.moveTo(50, 100 * i - 50);
      ctx.lineTo(canvas.value.width - 50, 100 * i - 50);
      ctx.stroke();
      
      // 垂直线
      ctx.moveTo(100 * i - 50, 50);
      ctx.lineTo(100 * i - 50, canvas.value.width - 50);
      ctx.stroke();
    }
    
    // 绘制边框
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(50, 50);
    ctx.lineTo(50, canvas.value.width - 50);
    ctx.lineTo(canvas.value.width - 50, canvas.value.width - 50);
    ctx.lineTo(canvas.value.width - 50, 50);
    ctx.closePath();
    ctx.stroke();
    
    // 绘制星位点
    const starPoints = {
      9: [250, 450, 650],
      13: [350, 650, 950],
      19: [350, 950, 1550]
    };
    const points = starPoints[game.value.model as BoardModel];
    points.forEach((x) => {
      points.forEach((y) => {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
  };
};

// 组件挂载时生成棋盘
onMounted(() => generateBoard());
// 监听棋盘大小变化，重新生成棋盘
watch(() => game.value.model, () => generateBoard());

/**
 * 处理下棋点击事件
 * @param index 网格索引
 */
const putChess = async (index: number) => {
  // 检查是否允许下棋
  if (!props.can) {
    ElMessage.warning({ message: lang.value.text.board.ws_connection_error, grouping: true });
    return;
  }
  
  // 检查游戏状态和回合
  if (!((game.value.round || !game.value.roomId) && game.value.status !== "finished")) {
    console.log("Cannot place chess: round=", game.value.round, "status=", game.value.status, "gameMode=", game.value.gameMode);
    
    // 在AI模式下，提供更具体的错误信息
    if (game.value.gameMode === "ai") {
      if (!game.value.round) {
        ElMessage.warning({ message: "It's not your turn now", grouping: true });
      } else if (game.value.status === "finished") {
        ElMessage.warning({ message: "Game is finished", grouping: true });
      } else {
        ElMessage.warning({ message: "Cannot place chess in current state", grouping: true });
      }
    } else {
      ElMessage.warning({ message: lang.value.text.board.put_chess_error, grouping: true });
    }
    return;
  }
  
  // 获取位置字符串并检查是否已被占用
  let position = getPositionStr(index);
  if (game.value.board1.has(position) || game.value.board2.has(position)) {
    console.log("Position already occupied:", position);
    ElMessage.warning({ message: lang.value.text.board.put_chess_error, grouping: true });
    return;
  }
  
  console.log("Placing chess at position:", position, "game mode:", game.value.gameMode);
  
  // 调用父组件的回调函数，让父组件处理下棋逻辑
  props.callback(position);
};
</script>

<style scoped lang="scss">
@use "./index.scss" as *;
</style>