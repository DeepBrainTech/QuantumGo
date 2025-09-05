/**
 * 游戏状态管理组合式函数
 */
import { ref, computed, reactive } from 'vue';
import { useStore } from 'vuex';
import { BoardModel, ChessmanType, GameStatus } from '@/utils/types';
import { canPutChess, getCapturedChess, calculateWinner } from '@/utils/chess';
import { BOARD_SIZES, CHESS_TYPES, GAME_STATUS } from '@/constants/game';

export function useGame() {
  const store = useStore();
  
  // 游戏状态
  const gameState = reactive({
    boardSize: 19 as BoardModel,
    currentPlayer: CHESS_TYPES.BLACK as ChessmanType,
    gameStatus: GAME_STATUS.WAITING as GameStatus,
    moveCount: 0,
    lastMove: null as string | null
  });
  
  // 棋盘状态
  const board1 = ref(new Map());
  const board2 = ref(new Map());
  
  // 计算属性
  const isGameActive = computed(() => gameState.gameStatus === GAME_STATUS.PLAYING);
  const isPlayerTurn = computed(() => gameState.currentPlayer === CHESS_TYPES.BLACK);
  const canMakeMove = computed(() => isGameActive.value && isPlayerTurn.value);
  
  /**
   * 初始化游戏
   * @param size 棋盘大小
   */
  const initGame = (size: BoardModel = 19) => {
    gameState.boardSize = size;
    gameState.currentPlayer = CHESS_TYPES.BLACK;
    gameState.gameStatus = GAME_STATUS.WAITING;
    gameState.moveCount = 0;
    gameState.lastMove = null;
    
    board1.value.clear();
    board2.value.clear();
    
    console.log('游戏已初始化', { size });
  };
  
  /**
   * 开始游戏
   */
  const startGame = () => {
    gameState.gameStatus = GAME_STATUS.PLAYING;
    console.log('游戏开始');
  };
  
  /**
   * 尝试下棋
   * @param position 位置
   * @param board 棋盘（board1 或 board2）
   * @returns 是否成功下棋
   */
  const tryPlaceChess = (position: string, board: 'board1' | 'board2' = 'board1'): boolean => {
    if (!canMakeMove.value) {
      console.log('当前不能下棋');
      return false;
    }
    
    const currentBoard = board === 'board1' ? board1.value : board2.value;
    
    // 检查位置是否已被占用
    if (currentBoard.has(position)) {
      console.log('位置已被占用:', position);
      return false;
    }
    
    // 检查是否可以下棋（围棋规则）
    if (!canPutChess(currentBoard, position, gameState.currentPlayer, gameState.boardSize)) {
      console.log('违反围棋规则，不能在此位置下棋:', position);
      return false;
    }
    
    // 下棋
    const chess = {
      position,
      type: gameState.currentPlayer,
      brother: ''
    };
    
    currentBoard.set(position, chess);
    gameState.lastMove = position;
    gameState.moveCount++;
    
    // 检查吃子
    const captured = getCapturedChess(currentBoard, gameState.currentPlayer, gameState.boardSize);
    captured.forEach(pos => currentBoard.delete(pos));
    
    // 切换玩家
    gameState.currentPlayer = gameState.currentPlayer === CHESS_TYPES.BLACK 
      ? CHESS_TYPES.WHITE 
      : CHESS_TYPES.BLACK;
    
    console.log('下棋成功:', { position, player: chess.type, captured: captured.size });
    return true;
  };
  
  /**
   * 计算游戏结果
   * @returns 游戏结果
   */
  const calculateGameResult = () => {
    const result = calculateWinner(board1.value, gameState.boardSize);
    console.log('游戏结果:', result);
    return result;
  };
  
  /**
   * 结束游戏
   */
  const endGame = () => {
    gameState.gameStatus = GAME_STATUS.FINISHED;
    const result = calculateGameResult();
    console.log('游戏结束:', result);
    return result;
  };
  
  /**
   * 重置游戏
   */
  const resetGame = () => {
    initGame(gameState.boardSize);
    console.log('游戏已重置');
  };
  
  return {
    // 状态
    gameState,
    board1,
    board2,
    
    // 计算属性
    isGameActive,
    isPlayerTurn,
    canMakeMove,
    
    // 方法
    initGame,
    startGame,
    tryPlaceChess,
    calculateGameResult,
    endGame,
    resetGame
  };
}
