import { Board, BoardModel, ChessmanType, GameResult, LibertyCount, TerritoryCount, CapturedCount, Position } from "@/utils/types";

/**
 * 获取指定位置的所有相邻位置
 * @param pos 位置字符串，格式为 "x,y"
 * @param boardSize 棋盘大小
 * @returns 相邻位置数组
 */
const getAdjacentPositions = (pos: Position, boardSize: BoardModel): Position[] => {
  const [x, y] = pos.split(",").map(Number);
  const adjacent: Position[] = [];
  
  // 检查四个方向的相邻位置
  if (x > 1) adjacent.push(`${x - 1},${y}`);
  if (x < boardSize) adjacent.push(`${x + 1},${y}`);
  if (y > 1) adjacent.push(`${x},${y - 1}`);
  if (y < boardSize) adjacent.push(`${x},${y + 1}`);
  
  return adjacent;
};

/**
 * 查找棋盘上所有指定类型的棋子组
 * @param board 棋盘状态
 * @param type 棋子类型
 * @param boardSize 棋盘大小
 * @returns 棋子组数组
 */
const findAllGroups = (board: Board, type: ChessmanType, boardSize: BoardModel): Set<Position>[] => {
  const visited = new Set<Position>();
  const groups: Set<Position>[] = [];

  for (const [pos, chessman] of board) {
    if (chessman.type === type && !visited.has(pos)) {
      const group = new Set<Position>();
      const queue: Position[] = [pos];
      
      // 使用广度优先搜索找到所有连通的棋子
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        
        visited.add(current);
        group.add(current);
        
        // 检查相邻位置是否有相同类型的棋子
        getAdjacentPositions(current, boardSize).forEach(neighbor => {
          const chess = board.get(neighbor);
          if (chess?.type === type && !visited.has(neighbor)) {
            queue.push(neighbor);
          }
        });
      }
      groups.push(group);
    }
  }
  return groups;
};

/**
 * 计算棋子组的气数（空位数量）
 * @param board 棋盘状态
 * @param group 棋子组
 * @param boardSize 棋盘大小
 * @returns 气数
 */
const calculateGroupLiberties = (board: Board, group: Set<Position>, boardSize: BoardModel): number => {
  const liberties = new Set<Position>();
  
  group.forEach(pos => {
    getAdjacentPositions(pos, boardSize).forEach(neighbor => {
      if (!board.has(neighbor)) {
        liberties.add(neighbor);
      }
    });
  });
  
  return liberties.size;
};

/**
 * 检查是否可以在指定位置放置棋子
 * @param board 棋盘状态
 * @param position 位置
 * @param type 棋子类型
 * @param boardSize 棋盘大小
 * @param lastMove 上一步的位置（用于劫检测）
 * @returns 是否可以放置
 */
export function canPutChess(board: Board, position: Position, type: ChessmanType, boardSize: BoardModel, lastMove?: Position): boolean {
  if (board.has(position)) return false;
  
  const tempBoard = new Map(board);
  tempBoard.set(position, { position, type, brother: "" });
  const captured = getCapturedChess(tempBoard, type, boardSize);
  const finalBoard = new Map(tempBoard);
  captured.forEach(pos => finalBoard.delete(pos));
  
  const currentGroup = [...findAllGroups(finalBoard, type, boardSize)].find(g => g.has(position));
  if (!currentGroup || calculateGroupLiberties(finalBoard, currentGroup, boardSize) === 0) {
    return false;
  }
  
  // 劫检测：如果只吃了一个子，且这个子就是上一步下的位置，则禁止
  if (lastMove && captured.size === 1 && captured.has(lastMove)) {
    return false;
  }
  
  return true;
}

/**
 * 获取被吃掉的棋子位置
 * @param board 棋盘状态
 * @param lastMoveType 最后一步的棋子类型
 * @param boardSize 棋盘大小
 * @returns 被吃掉的棋子位置集合
 */
export function getCapturedChess(board: Board, lastMoveType: ChessmanType, boardSize: BoardModel): Set<Position> {
  const captured = new Set<Position>();
  const tempBoard = new Map(board);
  const enemyType = lastMoveType === "black" ? "white" : "black";
  
  // 检查敌方棋子组是否无气
  findAllGroups(tempBoard, enemyType, boardSize).forEach(group => {
    if (calculateGroupLiberties(tempBoard, group, boardSize) === 0) {
      group.forEach(pos => {
        captured.add(pos);
        tempBoard.delete(pos);
      });
    }
  });
  
  // 检查己方棋子组是否无气（自杀规则）
  findAllGroups(tempBoard, lastMoveType, boardSize).forEach(group => {
    if (calculateGroupLiberties(tempBoard, group, boardSize) === 0) {
      group.forEach(pos => captured.add(pos));
    }
  });
  
  return captured;
}

/**
 * 计算双方的总气数
 * @param board 棋盘状态
 * @param boardSize 棋盘大小
 * @returns 黑白双方的气数统计
 */
export function countLiberties(board: Board, boardSize: BoardModel): LibertyCount {
  const liberties = { black: 0, white: 0 };
  
  for (let x = 1; x <= boardSize; x++) {
    for (let y = 1; y <= boardSize; y++) {
      const pos = `${x},${y}`;
      if (!board.has(pos)) {
        let hasBlack = false, hasWhite = false;
        
        getAdjacentPositions(pos, boardSize).forEach(neighbor => {
          const chess = board.get(neighbor);
          if (chess?.type === "black") hasBlack = true;
          if (chess?.type === "white") hasWhite = true;
        });
        
        if (hasBlack) liberties.black++;
        if (hasWhite) liberties.white++;
      }
    }
  }
  
  return liberties;
}


/**
 * 计算游戏胜负结果（使用中国规则数子法）
 * @param board 棋盘状态
 * @param boardSize 棋盘大小
 * @returns 游戏结果
 */
export function calculateWinner(board: Board, boardSize: BoardModel): GameResult {
  const currentBoard = new Map(board);
  const { cleanedBoard, captured } = removeDeadStones(currentBoard, boardSize);
  
  // 统计存活棋子数量
  const blackStones = countLiveStones(cleanedBoard, "black");
  const whiteStones = countLiveStones(cleanedBoard, "white");
  
  // 计算领地
  const { blackArea, whiteArea } = calculateTerritory(cleanedBoard, boardSize);
  
  // 计算总分（棋子数 + 领地数 + 吃子数）
  const blackTotal = blackStones + blackArea + captured.white;
  const whiteTotal = whiteStones + whiteArea + captured.black;
  
  // 贴目规则（黑贴7目）
  const KOMI = 7;
  const threshold = boardSize * boardSize / 2 + KOMI;
  
  return {
    winner: blackTotal > threshold ? "black" : "white",
    blackScore: blackTotal,
    whiteScore: whiteTotal
  };
}

/**
 * 移除死子
 * @param board 棋盘状态
 * @param boardSize 棋盘大小
 * @returns 清理后的棋盘和被吃棋子数
 */
function removeDeadStones(board: Board, boardSize: BoardModel): { cleanedBoard: Board; captured: CapturedCount } {
  const captured: CapturedCount = { black: 0, white: 0 };
  const checked = new Set<Position>();
  const toRemove = new Set<Position>();
  
  board.forEach((_, pos) => {
    if (!checked.has(pos)) {
      const group = findConnectedStones(pos, board, boardSize);
      const liberties = calculateGroupLiberties(board, group, boardSize);
      
      if (liberties === 0) {
        group.forEach(p => {
          toRemove.add(p);
          const type = board.get(p)!.type;
          captured[type === "black" ? "white" : "black"]++;
        });
      }
      group.forEach(p => checked.add(p));
    }
  });
  
  const cleanedBoard = new Map(board);
  toRemove.forEach(pos => cleanedBoard.delete(pos));
  return { cleanedBoard, captured };
}

/**
 * 查找与指定位置相连的所有同色棋子
 * @param startPos 起始位置
 * @param board 棋盘状态
 * @param boardSize 棋盘大小
 * @returns 相连棋子的位置集合
 */
function findConnectedStones(startPos: Position, board: Board, boardSize: BoardModel): Set<Position> {
  const visited = new Set<Position>();
  const queue = [startPos];
  const color = board.get(startPos)!.type;
  
  while (queue.length > 0) {
    const pos = queue.pop()!;
    if (visited.has(pos)) continue;
    
    visited.add(pos);
    getNeighbors(pos, boardSize).forEach(neighbor => {
      if (board.get(neighbor)?.type === color && !visited.has(neighbor)) {
        queue.push(neighbor);
      }
    });
  }

  return visited;
}


/**
 * 计算双方领地
 * @param board 棋盘状态
 * @param boardSize 棋盘大小
 * @returns 黑白双方领地数量
 */
function calculateTerritory(board: Board, boardSize: BoardModel): TerritoryCount {
  const visited = new Set<Position>();
  let blackArea = 0, whiteArea = 0;

  for (let x = 1; x <= boardSize; x++) {
    for (let y = 1; y <= boardSize; y++) {
      const pos = `${x},${y}`;
      if (!board.has(pos) && !visited.has(pos)) {
        const { territory, owner } = checkAreaOwner(pos, board, visited, boardSize);
        if (owner === "black") blackArea += territory.size;
        if (owner === "white") whiteArea += territory.size;
      }
    }
  }

  return { blackArea, whiteArea };
}

/**
 * 检查区域的归属
 * @param startPos 起始位置
 * @param board 棋盘状态
 * @param visited 已访问位置集合
 * @param boardSize 棋盘大小
 * @returns 区域和归属者
 */
function checkAreaOwner(startPos: Position, board: Board, visited: Set<Position>, boardSize: BoardModel): { territory: Set<Position>; owner: ChessmanType | null } {
  const territory = new Set<Position>();
  const queue = [startPos];
  let owner: ChessmanType | null = null;
  let isNeutral = false;

  while (queue.length > 0) {
    const pos = queue.shift()!;
    if (visited.has(pos)) continue;

    visited.add(pos);
    territory.add(pos);

    getNeighbors(pos, boardSize).forEach(neighbor => {
      if (board.has(neighbor)) {
        const stone = board.get(neighbor)!;
        if (!owner) {
          owner = stone.type;
        } else if (owner !== stone.type) {
          isNeutral = true;
        }
      } else if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    });
  }

  return { territory, owner: isNeutral ? null : owner };
}

/**
 * 获取指定位置的相邻位置（包含边界检查）
 * @param pos 位置字符串
 * @param boardSize 棋盘大小
 * @returns 有效的相邻位置数组
 */
function getNeighbors(pos: Position, boardSize: BoardModel): Position[] {
  const [x, y] = pos.split(",").map(Number);
  return [
    `${x + 1},${y}`, `${x - 1},${y}`,
    `${x},${y + 1}`, `${x},${y - 1}`
  ].filter(p => isValidPosition(p, boardSize));
}

/**
 * 检查位置是否在棋盘范围内
 * @param pos 位置字符串
 * @param boardSize 棋盘大小
 * @returns 是否有效
 */
function isValidPosition(pos: Position, boardSize: BoardModel): boolean {
  const [x, y] = pos.split(",").map(Number);
  return x >= 1 && x <= boardSize && y >= 1 && y <= boardSize;
}

/**
 * 统计指定类型的存活棋子数量
 * @param board 棋盘状态
 * @param type 棋子类型
 * @returns 棋子数量
 */
function countLiveStones(board: Board, type: ChessmanType): number {
  return Array.from(board.values()).filter(s => s.type === type).length;
}

/**
 * 兼容 chess2.ts 接口的游戏结果计算函数
 * @param board 棋盘状态（使用简化的类型）
 * @param model 棋盘大小
 * @param blackLost 黑子被吃数量
 * @param whiteLost 白子被吃数量
 * @returns 游戏结果
 */
export function calculateGoResult(
  board: Map<string, { type: "black" | "white" }>, 
  model: number, 
  blackLost: number, 
  whiteLost: number
): GameResult {
  // 转换为标准 Board 类型
  const standardBoard: Board = new Map();
  board.forEach((cell, pos) => {
    standardBoard.set(pos, { position: pos, type: cell.type, brother: "" });
  });
  
  // 使用标准的计算函数
  const result = calculateWinner(standardBoard, model as BoardModel);
  
  // 调整分数以包含被吃棋子数
  return {
    winner: result.winner,
    blackScore: result.blackScore + whiteLost,
    whiteScore: result.whiteScore + blackLost
  };
}