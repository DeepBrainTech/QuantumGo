/**
 * API 相关常量定义
 */

// API 基础URL
export const API_BASE_URL = process.env.VUE_APP_API_URL || 'http://localhost:3000';

// WebSocket URL
export const WS_BASE_URL = process.env.VUE_APP_WS_URL || 'ws://localhost:3000';

// API 端点
export const API_ENDPOINTS = {
  // 用户相关
  USER_REGISTER: '/userRegister',
  USER_LOGIN: '/getUserInfo',
  USER_LOGOUT: '/userLogout',
  
  // 游戏相关
  CREATE_ROOM: '/createRoom',
  GET_GAME_INFO: '/getGameInfo',
  UPDATE_PLAYER_MOVE: '/updatePlayerMove',
  
  // 排行榜
  GET_LEADERBOARD: '/getLeaderboard',
  
  // WebSocket
  WS_GAME: '/ws'
} as const;

// HTTP 状态码
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
} as const;

// 请求超时时间
export const REQUEST_TIMEOUT = 10000; // 10秒

// WebSocket 重连配置
export const WS_RECONNECT_CONFIG = {
  maxAttempts: 5,
  delay: 1000,
  backoff: 2
} as const;

// 错误消息
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接错误',
  TIMEOUT_ERROR: '请求超时',
  SERVER_ERROR: '服务器错误',
  UNAUTHORIZED: '未授权访问',
  NOT_FOUND: '资源未找到',
  VALIDATION_ERROR: '数据验证失败'
} as const;
