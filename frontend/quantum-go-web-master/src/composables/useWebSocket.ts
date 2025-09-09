/**
 * WebSocket 连接管理组合式函数
 */
import { ref, reactive, onUnmounted } from 'vue';
import { WS_BASE_URL, WS_RECONNECT_CONFIG } from '@/constants/api';

export function useWebSocket(url?: string) {
  const wsUrl = url || WS_BASE_URL;
  
  // WebSocket 状态
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const connectionError = ref<string | null>(null);
  
  // 重连状态
  const reconnectState = reactive({
    attempts: 0,
    maxAttempts: WS_RECONNECT_CONFIG.maxAttempts,
    delay: WS_RECONNECT_CONFIG.delay,
    backoff: WS_RECONNECT_CONFIG.backoff
  });
  
  // WebSocket 实例
  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  
  // 事件处理器
  const eventHandlers = new Map<string, Function[]>();
  
  /**
   * 连接 WebSocket
   */
  const connect = () => {
    if (isConnecting.value || (ws && ws.readyState === WebSocket.OPEN)) {
      return;
    }
    
    isConnecting.value = true;
    connectionError.value = null;
    
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        isConnected.value = true;
        isConnecting.value = false;
        reconnectState.attempts = 0;
        emit('connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          emit('message', data);
        } catch (error) {
          console.error('解析 WebSocket 消息失败:', error);
          emit('error', error);
        }
      };
      
      ws.onclose = (event) => {
        isConnected.value = false;
        isConnecting.value = false;
        emit('disconnected', { code: event.code, reason: event.reason });
        
        // 尝试重连
        if (event.code !== 1000) { // 非正常关闭
          scheduleReconnect();
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        connectionError.value = '连接错误';
        isConnecting.value = false;
        emit('error', error);
      };
      
    } catch (error) {
      console.error('创建 WebSocket 连接失败:', error);
      connectionError.value = '创建连接失败';
      isConnecting.value = false;
      emit('error', error);
    }
  };
  
  /**
   * 断开 WebSocket 连接
   */
  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    if (ws) {
      ws.close(1000, '主动断开连接');
      ws = null;
    }
    
    isConnected.value = false;
    isConnecting.value = false;
    connectionError.value = null;
  };
  
  /**
   * 发送消息
   * @param data 要发送的数据
   */
  const send = (data: any) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket 未连接，无法发送消息');
      return false;
    }
    
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      ws.send(message);
      return true;
    } catch (error) {
      console.error('发送 WebSocket 消息失败:', error);
      emit('error', error);
      return false;
    }
  };
  
  /**
   * 安排重连
   */
  const scheduleReconnect = () => {
    if (reconnectState.attempts >= reconnectState.maxAttempts) {
      connectionError.value = '连接失败，请手动重试';
      return;
    }
    
    const delay = reconnectState.delay * Math.pow(reconnectState.backoff, reconnectState.attempts);
    
    reconnectTimer = window.setTimeout(() => {
      reconnectState.attempts++;
      connect();
    }, delay);
  };
  
  /**
   * 监听事件
   * @param event 事件名称
   * @param handler 事件处理器
   */
  const on = (event: string, handler: Function) => {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, []);
    }
    eventHandlers.get(event)!.push(handler);
  };
  
  /**
   * 移除事件监听
   * @param event 事件名称
   * @param handler 事件处理器
   */
  const off = (event: string, handler?: Function) => {
    if (!eventHandlers.has(event)) return;
    
    if (handler) {
      const handlers = eventHandlers.get(event)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    } else {
      eventHandlers.delete(event);
    }
  };
  
  /**
   * 触发事件
   * @param event 事件名称
   * @param data 事件数据
   */
  const emit = (event: string, data?: any) => {
    if (!eventHandlers.has(event)) return;
    
    eventHandlers.get(event)!.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`事件处理器执行失败 (${event}):`, error);
      }
    });
  };
  
  // 组件卸载时清理
  onUnmounted(() => {
    disconnect();
  });
  
  return {
    // 状态
    isConnected,
    isConnecting,
    connectionError,
    reconnectState,
    
    // 方法
    connect,
    disconnect,
    send,
    on,
    off
  };
}
