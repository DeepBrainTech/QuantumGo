/**
 * 棋盘状态类型 - 使用位置字符串作为键，棋子对象作为值
 */
export type Board = Map<string, Chessman>;

/**
 * 棋盘大小类型 - 支持标准围棋棋盘尺寸
 */
export type BoardModel = 9 | 13 | 19;

/**
 * 棋子类型 - 黑白两色
 */
export type ChessmanType = "black" | "white";

/**
 * 棋子对象类型
 * @param position 位置字符串，格式为 "x,y"
 * @param type 棋子类型
 * @param brother 兄弟棋子位置（用于量子围棋）
 */
export type Chessman = { 
  position: string; 
  type: ChessmanType; 
  brother: string; 
};

/**
 * 棋子记录类型 - 记录一步棋的变化
 */
export type ChessmanRecord = { 
  add: Chessman[]; 
  reduce: Chessman[]; 
};

/**
 * 棋子记录数组类型
 */
export type ChessmanRecords = ChessmanRecord[];

/**
 * API 响应类型
 */
export type Response = { 
  success: boolean; 
  status: number; 
  data: Record<string, any>; 
};

/**
 * 位置字符串类型 - 格式为 "x,y"
 */
export type Position = string;

/**
 * 游戏状态类型
 */
export type GameStatus = "waiting" | "playing" | "finished" | "paused";

/**
 * 玩家类型
 */
export type PlayerType = "human" | "ai";

/**
 * 游戏结果类型
 */
export type GameResult = {
  winner: ChessmanType | null;
  blackScore: number;
  whiteScore: number;
};

/**
 * 气数统计类型
 */
export type LibertyCount = {
  black: number;
  white: number;
};

/**
 * 领地统计类型
 */
export type TerritoryCount = {
  blackArea: number;
  whiteArea: number;
};

/**
 * 被吃棋子统计类型
 */
export type CapturedCount = {
  black: number;
  white: number;
};