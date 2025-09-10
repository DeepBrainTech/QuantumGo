import { Board, BoardModel, Chessman, ChessmanRecord, ChessmanRecords, ChessmanType } from "@/utils/types";
import { canPutChess, getCapturedChess, canPutChessSuperko, hashBoard } from "@/utils/chess";
import { calculateGoResult } from "@/utils/chess2";
import api from "@/utils/api";

const state = () => ({
  roomId: "" as string,
  status: "waiting" as "waiting" | "playing" | "finished",
  subStatus: "black" as "black" | "white" | "common",
  countdown: 30 as number,
  moves: 0 as number,
  blackQuantum: "" as string,
  whiteQuantum: "" as string,
  blackLost: 0 as number,
  whiteLost: 0 as number,
  blackPoints: 0 as number,
  whitePoints: 0 as number,
  round: true as boolean,
  camp: "black" as ChessmanType,
  model: 9 as BoardModel,
  board1: new Map() as Board,
  board2: new Map() as Board,
  // 记录各棋盘最后一步的位置，用于每盘面的劫检测
  lastMove1: null as string | null,
  lastMove2: null as string | null,
  // 位置超劫：各盘面局面历史哈希
  history1: new Set<string>() as Set<string>,
  history2: new Set<string>() as Set<string>,
  records: [] as ChessmanRecords,
  phase: null as string | null,
  gameMode: "pvp" as "pvp" | "ai"
});

const mutations = {
  setRoomId(state: any, id: string) {
    state.id = id;
  },

  setStatus(state: any, status: "waiting" | "playing" | "finished") {
    state.status = status;
  },

  setRound(state: any, round: boolean) {
    state.round = round;
  },

  setGameMode(state: any, mode: "pvp" | "ai") {
    state.gameMode = mode;
  },

  setCamp(state: any, camp: ChessmanType) {
    state.camp = camp;
  },

  setModel(state: any, model: BoardModel) {
    state.model = model;
  },

  setCountdown(state: any, countdown: number) {
    state.countdown = countdown;
  },

  setChess(state: any, chessman1: Chessman) {
    state.board1.set(chessman1.position, chessman1);
    const chessman2: Chessman = {
      position: chessman1.brother,
      // 盘面2显示与逻辑均采用相反颜色
      type: chessman1.type === "black" ? "white" : "black",
      brother: chessman1.position
    };
    state.board2.set(chessman2.position, chessman2);
  },

  deleteChess(state: any, position: string) {
    const chessInfo = state.board1.get(position);
    if (chessInfo.type === "black") {
      state.blackLost++;
    } else {
      state.whiteLost++;
    }
    state.board1.delete(position);
    state.board2.delete(chessInfo.brother);
  },

  initBoard(state: any) {
    state.board1.clear();
    state.board2.clear();
    state.status = "waiting";
    state.subStatus = "black";
    state.blackQuantum = "";
    state.whiteQuantum = "";
    state.round = true;
    state.lastMove1 = null;
    state.lastMove2 = null;
    state.history1.clear();
    state.history2.clear();
    // 记录初始空局面
    state.history1.add("");
    state.history2.add("");
  }
};

const actions = {
  async setGameInfo({ commit, rootState, state }: any, data: Record<string, any>) {
    const { room_id, status, owner_id, round, board, moves, white_lost, black_lost, countdown, model, chessman_records, phase } = data;
    const boardMap = new Map(JSON.stringify(board) === "{}" ? [] : board);
    state.board1.clear();
    state.board2.clear();
    state.roomId = room_id;
    state.status = status;
    state.moves = moves;
    state.whiteLost = white_lost;
    state.blackLost = black_lost;
    state.countdown = countdown;
    state.model = model;
    state.records = chessman_records ?? [];
    state.phase = phase || null;
    if (status === "waiting" && data.visitor_id) {
      state.status = "playing";
    }
    const isOwner = owner_id === rootState.user.id;
    state.camp = isOwner ? "black" : "white";
    state.round = isOwner ? round === "black" : round === "white";
    const count = boardMap.size;
    if (count === 0) {
      state.blackQuantum = "";
      state.whiteQuantum = "";
      state.subStatus = "black";
    } else {
      boardMap.forEach((chessman: any) => {
        if (chessman.position !== chessman.brother) {
          if (chessman.type === "black") {
            state.blackQuantum = chessman.position ?? "0,0";
          } else {
            state.whiteQuantum = chessman.position ?? "0,0";
          }
        }
        commit("setChess", chessman);
      });
      state.subStatus = count === 1 ? "white" : "common";
      // 重建局面历史哈希（用于位置超劫）
      state.history1.clear();
      state.history2.clear();
      state.history1.add(hashBoard(state.board1));
      state.history2.add(hashBoard(state.board2));
      state.lastMove1 = null;
      state.lastMove2 = null;
    }
  },

  async setGameStatus({ commit }: any, status: string) {
    commit("setStatus", status);
  },

  async getGameInfo({ commit, rootState }: any) {
    const res = await api.getGameInfo(rootState.user.id);
    if (!res.success) {
      return false;
    }
    const data = res.data;
    commit("setRoomId", data.roow_id);
  },

  async initBoard({ commit }: any) {
    commit("initBoard");
  },

  async createRoom({ commit, rootState }: any, data: { countdown: number, model: number, gameMode?: string }): Promise<false | string> {
    const mode = data.gameMode || "pvp";
    commit("setGameMode", mode);
    
    if (mode === "ai") {
      // AI模式保存棋盘尺寸和倒计时
      commit("setModel", data.model);
      commit("setCountdown", data.countdown);
      // AI模式不需要调用后端API，直接返回一个虚拟房间ID
      return "ai_" + Date.now();
    }
    
    const res = await api.createRoom(rootState.user.id, data.model, data.countdown, mode);
    if (!res.success) {
      return false;
    }
    return res.data.room_id;
  },

  async backChess({ state }: any) {
    if (state.records.length < 2) {
      return false;
    }
    const records = state.records.splice(-2).reverse();
    records.forEach((record: ChessmanRecord) => {
      state.board1.delete(record.add[0].position);
      state.board2.delete(record.add[0].brother);
      record.reduce.forEach((chessman: Chessman) => {
        state.board1.set(chessman.position, chessman);
        state.board2.set(chessman.brother, chessman);
      });
    });
  },

  async putChess({ commit, state }: any, payload: { position: string, type: ChessmanType }): Promise<boolean> {
    if (state.status !== "playing") {
      return false;
    }
    
    const chessman: Chessman = { position: payload.position, type: payload.type, brother: payload.position };
    
    // 每个棋盘分别进行合法性检测：
    // 棋盘1落子颜色与玩家相同；棋盘2为相反颜色
    const opposite = (t: ChessmanType): ChessmanType => (t === "black" ? "white" : "black");
    const type1: ChessmanType = chessman.type;
    const type2: ChessmanType = opposite(chessman.type);
    const canPut1 = canPutChessSuperko(
      state.board1,
      payload.position,
      type1,
      state.model,
      state.lastMove1 ?? undefined,
      state.history1
    );
    const canPut2 = canPutChessSuperko(
      state.board2,
      payload.position,
      type2,
      state.model,
      state.lastMove2 ?? undefined,
      state.history2
    );
    
    if (!canPut1 || !canPut2) {
      return false;
    }
    
    // 量子围棋逻辑（PVP和AI模式都使用）
    const record = { add: [], reduce: [] } as ChessmanRecord;
    record.add.push(chessman);
    commit("setChess", chessman);
    if (state.subStatus === "black") {
      state.blackQuantum = chessman.position;
      state.subStatus = "white";
      // 立即在棋盘b中显示白色棋子（量子纠缠）
      const blackChess1 = state.board1.get(state.blackQuantum);
      const blackChess2 = state.board2.get(state.blackQuantum);
      if (blackChess1 && blackChess2) {
        blackChess2.type = "white";
      }
      // 更新各棋盘的最后一步位置
      state.lastMove1 = chessman.position;
      state.lastMove2 = chessman.position;
    } else if (state.subStatus === "white") {
      state.whiteQuantum = chessman.position;
      state.subStatus = "common";
      const blackChess1 = state.board1.get(state.blackQuantum);
      const whiteChess1 = state.board1.get(state.whiteQuantum);
      const blackChess2 = state.board2.get(state.blackQuantum);
      const whiteChess2 = state.board2.get(state.whiteQuantum);
      blackChess1.brother = whiteChess1.position;
      whiteChess1.brother = blackChess1.position;
      blackChess2.brother = whiteChess2.position;
      whiteChess2.brother = blackChess2.position;
      // 现在棋盘b中的黑棋已经是白色了，需要将白棋改为黑色
      blackChess2.type = "white"; // 保持白色（黑棋在棋盘b中显示为白色）
      whiteChess2.type = "black"; // 白棋在棋盘b中显示为黑色
      
      // 更新records中最后一步白棋的brother信息，确保红点显示正确
      if (state.records.length > 0) {
        const lastRecord = state.records[state.records.length - 1];
        if (lastRecord.add.length > 0 && lastRecord.add[0].type === "white") {
          lastRecord.add[0].brother = whiteChess2.position;
        }
      }
      // 更新各棋盘的最后一步位置
      state.lastMove1 = chessman.position;
      state.lastMove2 = chessman.position;
    }
    commit("setRound", !state.round);
    // 计算各棋盘吃子：棋盘1按当前棋子颜色，棋盘2用相反颜色
    const capturedChess1 = getCapturedChess(state.board1, type1, state.model);
    const capturedChess2_row = getCapturedChess(state.board2, type2, state.model);
    const capturedChess2 = new Set([...capturedChess2_row].map(position => state.board2.get(position).brother));
    const capturedChess = new Set([...capturedChess1, ...capturedChess2]);
    capturedChess.forEach(chessPosition => {
      record.reduce.push(state.board1.get(chessPosition));
      commit("deleteChess", chessPosition);
    });
    state.records.push(record);
    // 更新局面历史（位置超劫）
    state.history1.add(hashBoard(state.board1));
    state.history2.add(hashBoard(state.board2));
    const result1 = calculateGoResult(state.board1, state.model, state.blackLost, state.whiteLost);
    const result2 = calculateGoResult(state.board2, state.model, state.blackLost, state.whiteLost);
    state.blackPoints = Math.floor((result1.blackScore + result2.blackScore) / 2);
    state.whitePoints = Math.floor((result1.whiteScore + result2.whiteScore) / 2);
    
    return true;
  },

};

export default {
  namespaced: true,
  state,
  mutations,
  actions
};
