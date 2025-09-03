// 根据环境自动选择API地址
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

let apiUrl: string;
let wsUrl: string;

if (isDevelopment) {
  // 开发环境：使用localhost
  apiUrl = "http://localhost:3000";
  wsUrl = "ws://localhost:3000/ws";
} else {
  // 生产环境：使用相对路径通过nginx代理
  // 这样前端会通过nginx代理访问后端，而不是直接访问Railway URL
  apiUrl = import.meta.env.VITE_API_URL || "";
  wsUrl = import.meta.env.VITE_WS_URL || "/ws";
}

const Config = {
  apiUrl,
  wsUrl
};

export default Config;
