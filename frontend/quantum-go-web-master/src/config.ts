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
  // 生产环境：直接访问Railway后端
  // Vercel前端直接访问Railway后端，不需要nginx代理
  apiUrl = import.meta.env.VITE_API_URL || "https://quantumgodeploy-production.up.railway.app";
  wsUrl = import.meta.env.VITE_WS_URL || "wss://quantumgodeploy-production.up.railway.app/ws";
}

const Config = {
  apiUrl,
  wsUrl
};

export default Config;
