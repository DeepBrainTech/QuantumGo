import axios from "axios";
import Config from "@/config";
import CryptoJS from "crypto-js";
import { Response } from "@/utils/types";

class Api {

  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request(path: string, data: Record<string, any>) {
    try {
      const response = await axios.post(`${this.baseUrl}${path}`, data);
      if (response.status < 200 || response.status >= 300) {
        return { success: false, status: response.status, data: response.data };
      }
      return { success: true, status: response.status, data: response.data };
    } catch (error: any) {
      console.error("API request failed:", error);
      const status = error.response?.status || error.status || 0;
      const data = error.response?.data || {};
      return { success: false, status, data };
    }
  }

  public async createRoom(
    user_id: string,
    model: number = 9,
    gameMode: string = "pvp",
    komi: number = 7.5,
    time_control?: any,
  ): Promise<Response> {
    // countdown deprecated client-side; send 0 for compatibility
    const data: any = { user_id, countdown: 0, model, game_mode: gameMode, komi };
    if (time_control) data.time_control = time_control;
    return this.request("/createRoom", data);
  }

  public async getGameInfo(roomId: string): Promise<Response> {
    const data = { room_id: roomId };
    return this.request("/getGameInfo", data);
  }

  public async getUserInfo(user_name: string, row_password: string): Promise<Response> {
    const user_password = CryptoJS.MD5(row_password).toString(CryptoJS.enc.Hex);
    const data = { username: user_name, password: user_password };
    return this.request("/getUserInfo", data);
  }

  public async userRegister(user_name: string, row_password: string): Promise<Response> {
    const user_password = CryptoJS.MD5(row_password).toString(CryptoJS.enc.Hex);
    const data = { username: user_name, password: user_password };
    return this.request("/userRegister", data);
  }

  // JWT SSO登录 - WordPress单点登录
  public async jwtLogin(token: string): Promise<Response> {
    const data = { token };
    return this.request("/jwtLogin", data);
  }

  public async getLeaderboard(model: number, limit: number = 50): Promise<Response> {
    const data = { model, limit };
    return this.request("/getLeaderboard", data);
  }

  // Lobby: list public waiting rooms (Phase 1)
  public async listRooms(params?: { model?: number; page?: number; size?: number }): Promise<Response> {
    const data: any = {
      model: params?.model,
      page: params?.page ?? 1,
      size: params?.size ?? 20,
    };
    return this.request("/lobby/listRooms", data);
  }

  // Recent rooms for a user (owner or visitor)
  public async recentRooms(params: { user_id: string; status?: string; page?: number; size?: number }): Promise<Response> {
    const data: any = {
      user_id: params.user_id,
      status: params.status,
      page: params.page ?? 1,
      size: params.size ?? 20,
    };
    return this.request("/user/recentRooms", data);
  }

  // Fetch single user's profile (username + rating/RD for a model)
  public async getUserProfile(user_id: string, model: number): Promise<Response> {
    const data = { user_id, model } as any;
    return this.request("/getUserProfile", data);
  }

  // Ask backend KataGo to generate a move for current game state
  public async aiGenmove(payload: {
    board_size: number,
    next_to_move: 'black' | 'white',
    moves: { color: 'black' | 'white', position: string }[],
    komi?: number,
    rules?: string,
    forbidden?: string[],
  }): Promise<Response> {
    return this.request("/ai/genmove", payload as any);
  }

  // Dual-board genmove: analyze board A for candidates, evaluate on board B, choose best
  public async aiGenmoveDual(payload: {
    board_size: number,
    next_to_move: 'black' | 'white',
    board_a_moves: { color: 'black' | 'white', position: string }[],
    board_b_moves: { color: 'black' | 'white', position: string }[],
    komi?: number,
    rules?: string,
    forbidden?: string[],
    k?: number,
  }): Promise<Response> {
    return this.request("/ai/genmove_dual", payload as any);
  }

  // Score estimation API
  public async scoreEstimate(payload: {
    boards: {
      board_size: number,
      black_stones: string[],
      white_stones: string[],
      next_to_move?: string
    }[]
  }): Promise<Response> {
    return this.request("/ai/score_estimate", payload as any);
  }

}

const api = new Api(Config.apiUrl);
export default api;
