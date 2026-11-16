// Engine & Cấu hình cho Mini Game "Xếp khối" (Block Blast style) - src/utils/blockBlastEngine.ts

export const BOARD_SIZE = 8;
export const MAX_LEVEL = 10;
export const LINES_PER_LEVEL = 5;

export type CellOffset = readonly [number, number]; // [dRow, dCol]
export type PieceTier = 'small' | 'medium' | 'hard';

export interface BlockPieceDef {
  id: string;
  label: string;
  tier: PieceTier;
  cells: readonly CellOffset[];
  rows: number;
  cols: number;
  color: string;
}

export interface TrayPiece {
  uid: string;
  defId: string;
  color: string;
}

export type BlockBoard = (string | null)[][];

export interface BlockBlastSavedState {
  board: BlockBoard;
  tray: (TrayPiece | null)[];
  score: number;
  bestScore: number;
  totalLinesCleared: number;
  level: number;
  isGameOver: boolean;
  updatedAt: number;
}

export const PASTEL_BLOCK_COLORS = [
  '#38bdf8', // Sky
  '#fb7185', // Coral
  '#34d399', // Mint
  '#fbbf24', // Amber
  '#a78bfa', // Lavender
  '#fb923c', // Peach
  '#2dd4bf', // Teal
] as const;

function makeDef(
  id: string,
  label: string,
  tier: PieceTier,
  cells: CellOffset[],
  color: string
): BlockPieceDef {
  let maxR = 0;
  let maxC = 0;
  for (const [r, c] of cells) {
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  return {
    id,
    label,
    tier,
    cells,
    rows: maxR + 1,
    cols: maxC + 1,
    color,
  };
}

export const BLOCK_PIECE_CATALOG: BlockPieceDef[] = [
  // Nhóm nhỏ (1-3 ô)
  makeDef('single', 'Ô đơn 1×1', 'small', [[0, 0]], PASTEL_BLOCK_COLORS[0]),
  makeDef('line_2_h', 'Thanh 2 ngang', 'small', [[0, 0], [0, 1]], PASTEL_BLOCK_COLORS[2]),
  makeDef('line_2_v', 'Thanh 2 dọc', 'small', [[0, 0], [1, 0]], PASTEL_BLOCK_COLORS[2]),
  makeDef('line_3_h', 'Thanh 3 ngang', 'small', [[0, 0], [0, 1], [0, 2]], PASTEL_BLOCK_COLORS[3]),
  makeDef('line_3_v', 'Thanh 3 dọc', 'small', [[0, 0], [1, 0], [2, 0]], PASTEL_BLOCK_COLORS[3]),

  // Nhóm trung bình (3-4 ô quen thuộc: góc 3 ô, vuông 2×2, thanh 4, chữ L, chữ T)
  makeDef('corner_3_a', 'Góc 3 ô', 'medium', [[0, 0], [1, 0], [1, 1]], PASTEL_BLOCK_COLORS[5]),
  makeDef('corner_3_b', 'Góc 3 ô xoay', 'medium', [[0, 0], [0, 1], [1, 0]], PASTEL_BLOCK_COLORS[5]),
  makeDef('square_2x2', 'Vuông 2×2', 'medium', [[0, 0], [0, 1], [1, 0], [1, 1]], PASTEL_BLOCK_COLORS[3]),
  makeDef('line_4_h', 'Thanh 4 ngang', 'medium', [[0, 0], [0, 1], [0, 2], [0, 3]], PASTEL_BLOCK_COLORS[0]),
  makeDef('line_4_v', 'Thanh 4 dọc', 'medium', [[0, 0], [1, 0], [2, 0], [3, 0]], PASTEL_BLOCK_COLORS[0]),
  makeDef('l_4_a', 'Chữ L 4 ô', 'medium', [[0, 0], [1, 0], [2, 0], [2, 1]], PASTEL_BLOCK_COLORS[4]),
  makeDef('l_4_b', 'Chữ L 4 ô xoay 90', 'medium', [[0, 0], [0, 1], [0, 2], [1, 0]], PASTEL_BLOCK_COLORS[4]),
  makeDef('l_4_c', 'Chữ L 4 ô xoay 180', 'medium', [[0, 0], [0, 1], [1, 1], [2, 1]], PASTEL_BLOCK_COLORS[4]),
  makeDef('l_4_d', 'Chữ L 4 ô xoay 270', 'medium', [[0, 2], [1, 0], [1, 1], [1, 2]], PASTEL_BLOCK_COLORS[4]),
  makeDef('j_4_a', 'Chữ J 4 ô', 'medium', [[0, 1], [1, 1], [2, 0], [2, 1]], PASTEL_BLOCK_COLORS[6]),
  makeDef('j_4_b', 'Chữ J 4 ô xoay', 'medium', [[0, 0], [1, 0], [1, 1], [1, 2]], PASTEL_BLOCK_COLORS[6]),
  makeDef('t_4_up', 'Chữ T 4 ô', 'medium', [[0, 1], [1, 0], [1, 1], [1, 2]], PASTEL_BLOCK_COLORS[1]),
  makeDef('t_4_down', 'Chữ T ngược', 'medium', [[0, 0], [0, 1], [0, 2], [1, 1]], PASTEL_BLOCK_COLORS[1]),
  makeDef('t_4_left', 'Chữ T trái', 'medium', [[0, 1], [1, 0], [1, 1], [2, 1]], PASTEL_BLOCK_COLORS[1]),
  makeDef('t_4_right', 'Chữ T phải', 'medium', [[0, 0], [1, 0], [1, 1], [2, 0]], PASTEL_BLOCK_COLORS[1]),

  // Nhóm mảnh khó (định nghĩa rõ trong cấu hình)
  makeDef('line_5_h', 'Thanh 5 ngang', 'hard', [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], PASTEL_BLOCK_COLORS[0]),
  makeDef('line_5_v', 'Thanh 5 dọc', 'hard', [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], PASTEL_BLOCK_COLORS[0]),
  makeDef('l_big_a', 'Chữ L lớn 5 ô', 'hard', [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], PASTEL_BLOCK_COLORS[5]),
  makeDef('l_big_b', 'Chữ L lớn xoay 90', 'hard', [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], PASTEL_BLOCK_COLORS[5]),
  makeDef('l_big_c', 'Chữ L lớn xoay 180', 'hard', [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], PASTEL_BLOCK_COLORS[5]),
  makeDef('l_big_d', 'Chữ L lớn xoay 270', 'hard', [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]], PASTEL_BLOCK_COLORS[5]),
  makeDef('z_h', 'Chữ Z ngang', 'hard', [[0, 0], [0, 1], [1, 1], [1, 2]], PASTEL_BLOCK_COLORS[1]),
  makeDef('z_v', 'Chữ Z dọc', 'hard', [[0, 1], [1, 0], [1, 1], [2, 0]], PASTEL_BLOCK_COLORS[1]),
  makeDef('s_h', 'Chữ S ngang', 'hard', [[0, 1], [0, 2], [1, 0], [1, 1]], PASTEL_BLOCK_COLORS[2]),
  makeDef('s_v', 'Chữ S dọc', 'hard', [[0, 0], [1, 0], [1, 1], [2, 1]], PASTEL_BLOCK_COLORS[2]),
  makeDef('rect_2x3', 'Chữ nhật 2×3', 'hard', [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], PASTEL_BLOCK_COLORS[4]),
  makeDef('rect_3x2', 'Chữ nhật 3×2', 'hard', [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]], PASTEL_BLOCK_COLORS[4]),
  makeDef('square_3x3', 'Khối vuông 3×3', 'hard', [
    [0, 0], [0, 1], [0, 2],
    [1, 0], [1, 1], [1, 2],
    [2, 0], [2, 1], [2, 2],
  ], PASTEL_BLOCK_COLORS[6]),
];

export const HARD_PIECE_IDS = new Set<string>(
  BLOCK_PIECE_CATALOG.filter((p) => p.tier === 'hard').map((p) => p.id)
);

export const LARGE_RECT_AND_3X3_IDS = new Set<string>(['rect_2x3', 'rect_3x2', 'square_3x3']);
export const SQUARE_3X3_ID = 'square_3x3';

const PIECE_MAP = new Map<string, BlockPieceDef>(
  BLOCK_PIECE_CATALOG.map((p) => [p.id, p])
);

export function getPieceDef(defId: string): BlockPieceDef {
  return PIECE_MAP.get(defId) || BLOCK_PIECE_CATALOG[0];
}

export function createEmptyBoard(): BlockBoard {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

export function cloneBoard(board: BlockBoard): BlockBoard {
  return board.map((row) => [...row]);
}

export function computeLevel(totalLinesCleared: number): number {
  const safe = Math.max(0, Math.floor(totalLinesCleared));
  return Math.min(MAX_LEVEL, 1 + Math.floor(safe / LINES_PER_LEVEL));
}

export function formatLevelProgressLabel(totalLinesCleared: number): string {
  const level = computeLevel(totalLinesCleared);
  if (level >= MAX_LEVEL) {
    return `Level ${MAX_LEVEL} · Tối đa`;
  }
  const progress = Math.max(0, Math.floor(totalLinesCleared)) % LINES_PER_LEVEL;
  return `Level ${level} · ${progress}/${LINES_PER_LEVEL} đường`;
}

export function canPlacePiece(
  board: BlockBoard,
  def: BlockPieceDef,
  anchorRow: number,
  anchorCol: number
): boolean {
  for (const [dr, dc] of def.cells) {
    const r = anchorRow + dr;
    const c = anchorCol + dc;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
      return false;
    }
    if (board[r][c] !== null) {
      return false;
    }
  }
  return true;
}

export function hasAnyValidPlacement(board: BlockBoard, def: BlockPieceDef): boolean {
  for (let r = 0; r <= BOARD_SIZE - def.rows; r++) {
    for (let c = 0; c <= BOARD_SIZE - def.cols; c++) {
      if (canPlacePiece(board, def, r, c)) {
        return true;
      }
    }
  }
  return false;
}

export function boardHasEmptyCell(board: BlockBoard): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === null) return true;
    }
  }
  return false;
}

interface LevelRuleConfig {
  smallWeight: number;
  mediumWeight: number;
  hardWeight: number;
  maxHard: number;
  requireSmall: boolean;
  allowLargeRectAnd3x3: boolean;
  max3x3: number;
}

export function getLevelRuleConfig(level: number): LevelRuleConfig {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.round(level)));
  if (lv <= 2) {
    return {
      smallWeight: 68,
      mediumWeight: 32,
      hardWeight: 0,
      maxHard: 0,
      requireSmall: true,
      allowLargeRectAnd3x3: false,
      max3x3: 0,
    };
  }
  if (lv <= 4) {
    return {
      smallWeight: 26,
      mediumWeight: 56,
      hardWeight: 18,
      maxHard: 1,
      requireSmall: false,
      allowLargeRectAnd3x3: false,
      max3x3: 0,
    };
  }
  if (lv <= 7) {
    return {
      smallWeight: 18,
      mediumWeight: 44,
      hardWeight: 38,
      maxHard: 2,
      requireSmall: false,
      allowLargeRectAnd3x3: false,
      max3x3: 0,
    };
  }
  // Level 8..10: tăng dần tỷ lệ mảnh khó, cho phép 2x3 và 3x3 (tối đa 1 khối 3x3)
  const hardWeight = lv === 8 ? 46 : lv === 9 ? 54 : 62;
  const smallWeight = lv === 8 ? 16 : lv === 9 ? 13 : 10;
  const mediumWeight = 100 - hardWeight - smallWeight;
  return {
    smallWeight,
    mediumWeight,
    hardWeight,
    maxHard: 3,
    requireSmall: false,
    allowLargeRectAnd3x3: true,
    max3x3: 1,
  };
}

function getEligibleDefsForLevel(
  level: number,
  hardCountSoFar: number,
  count3x3SoFar: number
): { defs: BlockPieceDef[]; weights: number[] } {
  const cfg = getLevelRuleConfig(level);
  const defs: BlockPieceDef[] = [];
  const weights: number[] = [];

  for (const def of BLOCK_PIECE_CATALOG) {
    if (def.tier === 'hard') {
      if (hardCountSoFar >= cfg.maxHard) continue;
      if (!cfg.allowLargeRectAnd3x3 && LARGE_RECT_AND_3X3_IDS.has(def.id)) continue;
      if (def.id === SQUARE_3X3_ID && count3x3SoFar >= cfg.max3x3) continue;
      defs.push(def);
      weights.push(cfg.hardWeight);
    } else if (def.tier === 'medium') {
      defs.push(def);
      weights.push(cfg.mediumWeight);
    } else {
      defs.push(def);
      weights.push(cfg.smallWeight);
    }
  }
  return { defs, weights };
}

function pickWeightedDef(
  defs: BlockPieceDef[],
  weights: number[],
  rng: () => number
): BlockPieceDef {
  let total = 0;
  for (const w of weights) total += w;
  let roll = rng() * total;
  for (let i = 0; i < defs.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return defs[i];
  }
  return defs[defs.length - 1];
}

function createTrayPiece(def: BlockPieceDef, idx: number, rng: () => number): TrayPiece {
  const color =
    def.color ||
    PASTEL_BLOCK_COLORS[Math.floor(rng() * PASTEL_BLOCK_COLORS.length)];
  return {
    uid: `blk-${Date.now()}-${idx}-${Math.floor(rng() * 100000)}`,
    defId: def.id,
    color,
  };
}

/**
 * Cấp bộ 3 mảnh theo level hiện tại, tuân thủ giới hạn mảnh khó/3x3
 * và đảm bảo ít nhất 1 trong 3 mảnh có vị trí đặt hợp lệ trên bàn.
 */
export function dealThreePieces(
  board: BlockBoard,
  level: number,
  rng: () => number = Math.random
): TrayPiece[] {
  const cfg = getLevelRuleConfig(level);
  const pickedDefs: BlockPieceDef[] = [];
  let hardCount = 0;
  let count3x3 = 0;

  for (let i = 0; i < 3; i++) {
    const { defs, weights } = getEligibleDefsForLevel(level, hardCount, count3x3);
    const chosen = pickWeightedDef(defs, weights, rng);
    pickedDefs.push(chosen);
    if (chosen.tier === 'hard') hardCount += 1;
    if (chosen.id === SQUARE_3X3_ID) count3x3 += 1;
  }

  // Level 1-2: bắt buộc có ít nhất 1 mảnh nhỏ (1-3 ô)
  if (cfg.requireSmall && !pickedDefs.some((d) => d.tier === 'small')) {
    const smallDefs = BLOCK_PIECE_CATALOG.filter((d) => d.tier === 'small');
    const chosenSmall = smallDefs[Math.floor(rng() * smallDefs.length)];
    pickedDefs[0] = chosenSmall;
  }

  // Đảm bảo lúc cấp bộ mới có ít nhất 1 trong 3 mảnh đặt được lên bàn
  const hasPlayable = pickedDefs.some((d) => hasAnyValidPlacement(board, d));
  if (!hasPlayable && boardHasEmptyCell(board)) {
    const { defs: levelDefs } = getEligibleDefsForLevel(level, 0, 0);
    const fittingFromLevel = levelDefs.filter((d) => hasAnyValidPlacement(board, d));
    if (fittingFromLevel.length > 0) {
      const replacement =
        fittingFromLevel[Math.floor(rng() * fittingFromLevel.length)];
      pickedDefs[pickedDefs.length - 1] = replacement;
    } else {
      // Phương án cuối nếu bàn còn ô trống: dùng ô đơn 1×1
      pickedDefs[pickedDefs.length - 1] = getPieceDef('single');
    }
  }

  return pickedDefs.map((def, idx) => createTrayPiece(def, idx, rng));
}

export interface PlaceMoveResult {
  valid: boolean;
  nextState: BlockBlastSavedState;
  pointsEarned: number;
  linesCleared: number;
  clearedCells: Array<readonly [number, number]>;
  leveledUpTo: number | null;
  dealtNewSet: boolean;
}

export function placePieceAndEvaluate(
  state: BlockBlastSavedState,
  trayIndex: number,
  anchorRow: number,
  anchorCol: number,
  rng: () => number = Math.random
): PlaceMoveResult {
  const piece = state.tray[trayIndex];
  if (!piece || state.isGameOver) {
    return {
      valid: false,
      nextState: state,
      pointsEarned: 0,
      linesCleared: 0,
      clearedCells: [],
      leveledUpTo: null,
      dealtNewSet: false,
    };
  }

  const def = getPieceDef(piece.defId);
  if (!canPlacePiece(state.board, def, anchorRow, anchorCol)) {
    return {
      valid: false,
      nextState: state,
      pointsEarned: 0,
      linesCleared: 0,
      clearedCells: [],
      leveledUpTo: null,
      dealtNewSet: false,
    };
  }

  const nextBoard = cloneBoard(state.board);
  for (const [dr, dc] of def.cells) {
    nextBoard[anchorRow + dr][anchorCol + dc] = piece.color;
  }

  // Xác định đồng thời tất cả hàng và cột đã đầy
  const fullRows: number[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (nextBoard[r].every((cell) => cell !== null)) {
      fullRows.push(r);
    }
  }

  const fullCols: number[] = [];
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (nextBoard[r][c] === null) {
        full = false;
        break;
      }
    }
    if (full) fullCols.push(c);
  }

  const clearedSet = new Set<string>();
  const clearedCells: Array<readonly [number, number]> = [];
  for (const r of fullRows) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const key = `${r},${c}`;
      if (!clearedSet.has(key)) {
        clearedSet.add(key);
        clearedCells.push([r, c]);
      }
      nextBoard[r][c] = null;
    }
  }
  for (const c of fullCols) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      const key = `${r},${c}`;
      if (!clearedSet.has(key)) {
        clearedSet.add(key);
        clearedCells.push([r, c]);
      }
      nextBoard[r][c] = null;
    }
  }

  const linesCleared = fullRows.length + fullCols.length;
  const blockPoints = def.cells.length;
  const linePoints = linesCleared * 10;
  const comboBonus = linesCleared >= 2 ? (linesCleared - 1) * 5 : 0;
  const pointsEarned = blockPoints + linePoints + comboBonus;

  const nextScore = state.score + pointsEarned;
  const nextBestScore = Math.max(state.bestScore, nextScore);
  const nextTotalLines = state.totalLinesCleared + linesCleared;
  const nextLevel = computeLevel(nextTotalLines);
  const leveledUpTo = nextLevel > state.level ? nextLevel : null;

  let nextTray: (TrayPiece | null)[] = state.tray.map((item, idx) =>
    idx === trayIndex ? null : item
  );

  let dealtNewSet = false;
  if (nextTray.every((item) => item === null)) {
    const freshSet = dealThreePieces(nextBoard, nextLevel, rng);
    nextTray = [freshSet[0] ?? null, freshSet[1] ?? null, freshSet[2] ?? null];
    dealtNewSet = true;
  }

  // Kiểm tra còn nước đi hợp lệ cho ít nhất 1 mảnh còn lại không
  const canContinue = nextTray.some(
    (item) => item !== null && hasAnyValidPlacement(nextBoard, getPieceDef(item.defId))
  );

  const nextState: BlockBlastSavedState = {
    board: nextBoard,
    tray: nextTray,
    score: nextScore,
    bestScore: nextBestScore,
    totalLinesCleared: nextTotalLines,
    level: nextLevel,
    isGameOver: !canContinue,
    updatedAt: Date.now(),
  };

  return {
    valid: true,
    nextState,
    pointsEarned,
    linesCleared,
    clearedCells,
    leveledUpTo,
    dealtNewSet,
  };
}

export function createNewBlockBlastState(bestScore = 0): BlockBlastSavedState {
  const board = createEmptyBoard();
  return {
    board,
    tray: dealThreePieces(board, 1),
    score: 0,
    bestScore,
    totalLinesCleared: 0,
    level: 1,
    isGameOver: false,
    updatedAt: Date.now(),
  };
}

const STORAGE_BLOCK_BLAST_PREFIX = 'van_phong_ao_block_blast_v1:';

export function loadBlockBlastState(userId: string): BlockBlastSavedState {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_BLOCK_BLAST_PREFIX}${userId}`);
    if (!raw) return createNewBlockBlastState(0);
    const parsed = JSON.parse(raw) as BlockBlastSavedState;
    if (
      parsed &&
      Array.isArray(parsed.board) &&
      parsed.board.length === BOARD_SIZE &&
      Array.isArray(parsed.tray)
    ) {
      const totalLines = Number(parsed.totalLinesCleared) || 0;
      return {
        ...parsed,
        totalLinesCleared: totalLines,
        level: computeLevel(totalLines),
        bestScore: Number(parsed.bestScore) || 0,
        score: Number(parsed.score) || 0,
      };
    }
    return createNewBlockBlastState(0);
  } catch {
    return createNewBlockBlastState(0);
  }
}

export function saveBlockBlastState(
  userId: string,
  state: BlockBlastSavedState
): void {
  try {
    window.localStorage.setItem(
      `${STORAGE_BLOCK_BLAST_PREFIX}${userId}`,
      JSON.stringify(state)
    );
  } catch {
    // ignore storage quota errors
  }
}
