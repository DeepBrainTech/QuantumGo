import { Board, BoardModel, Chessman, ChessmanRecord, ChessmanRecords, ChessmanType } from "@/utils/types";
import { canPutChess, getCapturedChess, canPutChessSuperko, canPutChessSituationalSuperko, hashBoard, hashBoardWithTurn, explainSituationalReason } from "@/utils/chess";
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
      type: chessman1.type,
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

  // Delete a stone only on board1; sever brother link on the counterpart.
  deleteChessBoard1(state: any, position: string) {
    const chessInfo = state.board1.get(position);
    if (!chessInfo) return;
    if (chessInfo.type === "black") {
      state.blackLost++;
    } else {
      state.whiteLost++;
    }
    state.board1.delete(position);
    // Govariants Quantum: do not mutate the mate here; mate removal handled by capture logic.
  },

  // Delete a stone only on board2; sever brother link on the counterpart.
  deleteChessBoard2(state: any, position: string) {
    const chessInfo = state.board2.get(position);
    if (!chessInfo) return;
    if (chessInfo.type === "black") {
      state.blackLost++;
    } else {
      state.whiteLost++;
    }
    state.board2.delete(position);
    // Govariants Quantum: do not mutate the mate here; mate removal handled by capture logic.
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
    state.history1.add(hashBoardWithTurn(state.board1, "black"));
    state.history2.add(hashBoardWithTurn(state.board2, "black"));
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
      // After restoring a remote game, seed SSK history using current side-to-move.
      const toMove1 = state.round ? "black" : "white";
      const toMove2 = state.round ? "black" : "white";
      state.history1.add(hashBoardWithTurn(state.board1, toMove1));
      state.history2.add(hashBoardWithTurn(state.board2, toMove2));
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
        // If a board hint exists, restore only on that board; otherwise restore both (legacy)
        if (chessman.board === 1) {
          state.board1.set(chessman.position, chessman);
          // Re-link counterpart if exists
          const mate = state.board2.get(chessman.brother);
          if (mate) mate.brother = chessman.position;
        } else if (chessman.board === 2) {
          state.board2.set(chessman.position, chessman);
          const mate = state.board1.get(chessman.brother);
          if (mate) mate.brother = chessman.position;
        } else {
          state.board1.set(chessman.position, chessman);
          state.board2.set(chessman.brother, chessman);
        }
      });
    });
  },

  async putChess({ commit, state }: any, payload: { position: string, type: ChessmanType }): Promise<boolean> {
    if (state.status !== "playing") {
      return false;
    }
    
    // Determine mapped positions per Quantum rules.
    // Default: both realities play at the same coordinate.
    let pos1 = payload.position;
    let pos2 = payload.position;

    // If initial quantum stones are already placed (subStatus === 'common') and
    // the clicked position is one of the two quantum positions, then the two
    // realities place at the paired quantum positions. For Black: [q0, q1]; for White: [q1, q0].
    const isQuantumPhaseDone = state.subStatus === "common";
    const isQuantumPos = (p: string) => p && (p === state.blackQuantum || p === state.whiteQuantum);
    if (isQuantumPhaseDone && isQuantumPos(payload.position)) {
      if (payload.type === "black") {
        pos1 = state.blackQuantum;
        pos2 = state.whiteQuantum;
      } else {
        pos1 = state.whiteQuantum;
        pos2 = state.blackQuantum;
      }
    }

    const chessman: Chessman = { position: pos1, type: payload.type, brother: pos2 };
    
    // 每个棋盘分别进行合法性检测：
    // 棋盘1落子颜色与玩家相同；棋盘2为相反颜色（仅限前两手）
    const opposite = (t: ChessmanType): ChessmanType => (t === "black" ? "white" : "black");
    const type1: ChessmanType = chessman.type;
    // Quantum rule: only first two moves invert colour between realities.
    const type2: ChessmanType = state.subStatus === "common" ? type1 : opposite(chessman.type);
    const canPut1 = canPutChessSituationalSuperko(
      state.board1,
      pos1,
      type1,
      state.model,
      state.lastMove1 ?? undefined,
      state.history1
    );
    const canPut2 = canPutChessSituationalSuperko(
      state.board2,
      pos2,
      type2,
      state.model,
      state.lastMove2 ?? undefined,
      state.history2
    );
    
    // Quantum rule: a move must be legal on both boards individually.
    if (!canPut1 || !canPut2) {
      try {
        const r1 = explainSituationalReason(state.board1, payload.position, type1, state.model, state.lastMove1 ?? undefined, state.history1);
        const r2 = explainSituationalReason(state.board2, payload.position, type2, state.model, state.lastMove2 ?? undefined, state.history2);
        console.warn('[putChess rejection]', { board1: r1, board2: r2, pos: payload.position, type1, type2 });
      } catch {}
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
      state.lastMove1 = pos1;
      state.lastMove2 = pos2;
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
      state.lastMove1 = pos1;
      state.lastMove2 = pos2;
    }
    commit("setRound", !state.round);
    // 计算各棋盘吃子：棋盘1按当前棋子颜色，棋盘2用相反颜色
    const capturedChess1 = getCapturedChess(state.board1, type1, state.model);
    const capturedChess2 = getCapturedChess(state.board2, type2, state.model);

    // Govariants Quantum entanglement: if a stone is captured on one board,
    // its entangled counterpart on the other board is also removed.
    // Build closure sets per board.
    const toDelete1 = new Set<string>();
    const toDelete2 = new Set<string>();

    // Start with directly captured sets
    capturedChess1.forEach((p) => toDelete1.add(p));
    capturedChess2.forEach((p) => toDelete2.add(p));

    // Add mates of captured stones across realities (if present)
    capturedChess1.forEach((p1) => {
      const c1 = state.board1.get(p1);
      if (c1) {
        const matePos2 = c1.brother;
        if (state.board2.has(matePos2)) {
          toDelete2.add(matePos2);
        }
      }
    });
    capturedChess2.forEach((p2) => {
      const c2 = state.board2.get(p2);
      if (c2) {
        const matePos1 = c2.brother;
        if (state.board1.has(matePos1)) {
          toDelete1.add(matePos1);
        }
      }
    });

    // Apply deletions, recording which board each removal occurred on.
    toDelete1.forEach((pos) => {
      const c = state.board1.get(pos);
      if (c) record.reduce.push({ ...c, board: 1 });
      commit("deleteChessBoard1", pos);
    });
    toDelete2.forEach((pos) => {
      const c = state.board2.get(pos);
      if (c) record.reduce.push({ ...c, board: 2 });
      commit("deleteChessBoard2", pos);
    });
    state.records.push(record);
    // 更新局面历史（位置超劫）
    // Record SSK state keyed by current player (pre-toggle), matching govariants
    state.history1.add(hashBoardWithTurn(state.board1, type1));
    state.history2.add(hashBoardWithTurn(state.board2, type2));
    // Scoring aligned with Govariants Quantum:
    // - Each board uses area scoring (no prisoner bonus); we pass 0 captures here
    // - Sum both boards' scores
    // - Apply komi once to White
    const result1 = calculateGoResult(state.board1, state.model, 0, 0);
    const result2 = calculateGoResult(state.board2, state.model, 0, 0);
    const KOMI_ONCE = 7.5;
    state.blackPoints = (result1.blackScore + result2.blackScore);
    state.whitePoints = (result1.whiteScore + result2.whiteScore + KOMI_ONCE);
    
    return true;
  },

};

export default {
  namespaced: true,
  state,
  mutations,
  actions
};
