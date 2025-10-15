import { v4 as uuidv4 } from "uuid";
import api from "@/utils/api";
import { Response } from "@/utils/types";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";

const state = () => ({
  id: "" as string,
  isLogin: false as boolean,
  name: "" as string
});

const mutations = {
  setUserId(state: any, id: string) {
    state.id = id;
  },

  setLoginState(state: any, isLogin: boolean) {
    state.isLogin = isLogin;
  },

  setName(state: any, name: string) {
    state.name = name;
  },

  clearUserInfo(state: any) {
    state.id = "";
    state.isLogin = false;
    state.name = "";
  }
};

const actions = {
  async initializeUserInfo({ commit, dispatch, rootState }: any) {
    // 检查URL参数中是否有SSO token
    const urlParams = new URLSearchParams(window.location.search);
    const ssoToken = urlParams.get('sso_token');
    
    if (ssoToken) {
      // 使用SSO token登录
      const res = await api.jwtLogin(ssoToken);
      if (res.success) {
        commit("setUserId", res.data.user_id);
        commit("setLoginState", true);
        commit("setName", res.data.username);
        localStorage.setItem("userId", res.data.user_id);
        localStorage.setItem("user_name", res.data.username);
        localStorage.setItem("sso_token", ssoToken);
        
        // 清除URL中的token参数
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    
    // 检查是否有保存的SSO token
    const savedSsoToken = localStorage.getItem("sso_token");
    if (savedSsoToken) {
      const res = await api.jwtLogin(savedSsoToken);
      if (res.success) {
        commit("setUserId", res.data.user_id);
        commit("setLoginState", true);
        commit("setName", res.data.username);
        localStorage.setItem("userId", res.data.user_id);
        return;
      } else {
        // Token已过期，清除
        localStorage.removeItem("sso_token");
      }
    }
    
    // 从localStorage获取用户信息（传统登录方式）
    const user_name = localStorage.getItem("user_name") ?? "";
    const password = localStorage.getItem("user_password") ?? "";
    
    if (user_name && password) {
      // 尝试自动登录
      const res = await api.getUserInfo(user_name, password);
      if (res.success) {
        // 使用后端返回的真实用户ID
        commit("setUserId", res.data.user_id);
        commit("setLoginState", true);
        commit("setName", user_name);
        localStorage.setItem("userId", res.data.user_id);
      }
    }
  },

  async login({ commit, state }: any, { user_name, password }: { user_name: string, password: string }): Promise<Response> {
    const res = await api.getUserInfo(user_name, password);
    if (res.success) {
      // 使用后端返回的真实用户ID
      commit("setUserId", res.data.user_id);
      commit("setLoginState", true);
      commit("setName", user_name);
      localStorage.setItem("userId", res.data.user_id);
      localStorage.setItem("user_name", user_name);
      localStorage.setItem("user_password", password);
    }
    return res;
  },

  async register({ commit }: any, { user_name, password }: { user_name: string, password: string }): Promise<Response> {
    const res = await api.userRegister(user_name, password);
    if (res.success) {
      // 使用后端返回的真实用户ID
      commit("setUserId", res.data.user_id);
      commit("setLoginState", true);
      commit("setName", user_name);
      localStorage.setItem("userId", res.data.user_id);
      localStorage.setItem("user_name", user_name);
      localStorage.setItem("user_password", password);
    }
    return res;
  },

  async logout({ commit }: any) {
    try {
      localStorage.removeItem("userId");
      localStorage.removeItem("user_name");
      localStorage.removeItem("user_password");
      localStorage.removeItem("sso_token");
    } catch {}
    commit("clearUserInfo");
    ElMessage.success({ message: "Logged out", grouping: true });
  }
};

export default {
  namespaced: true,
  state,
  mutations,
  actions
};
