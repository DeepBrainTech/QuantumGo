/**
 * 游戏相关常量定义
 */

// 棋盘尺寸选项
export const BOARD_SIZES = [9, 13, 19] as const;

// 棋子类型
export const CHESS_TYPES = {
  BLACK: 'black',
  WHITE: 'white'
} as const;

// 游戏状态
export const GAME_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished',
  PAUSED: 'paused'
} as const;

// 玩家类型
export const PLAYER_TYPES = {
  HUMAN: 'human'
} as const;

// 贴目规则
export const KOMI_RULES = {
  9: 5.5,
  13: 3.25,
  19: 3.75
} as const;

// 默认贴目
export const DEFAULT_KOMI = 7;

// 量子相位
export const QUANTUM_PHASES = {
  CLASSICAL: 'classical',
  QUANTUM: 'quantum',
  SUPERPOSITION: 'superposition'
} as const;

// 游戏模式
export const GAME_MODES = {
  LOCAL: 'local',
  ONLINE: 'online'
} as const;

// 难度等级
export const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  EXPERT: 'expert'
} as const;

// 时间控制
export const TIME_CONTROLS = {
  NONE: 'none',
  BYOYOMI: 'byoyomi',
  FISHER: 'fisher'
} as const;

// 默认时间设置
export const DEFAULT_TIME_SETTINGS = {
  mainTime: 30 * 60, // 30分钟
  byoyomiTime: 30,   // 30秒读秒
  byoyomiPeriods: 3  // 3次读秒
} as const;
