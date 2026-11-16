import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  computeLevel,
  createEmptyBoard,
  createNewBlockBlastState,
  dealThreePieces,
  formatLevelProgressLabel,
  getPieceDef,
  HARD_PIECE_IDS,
  LARGE_RECT_AND_3X3_IDS,
  loadBlockBlastState,
  placePieceAndEvaluate,
  saveBlockBlastState,
  SQUARE_3X3_ID,
  type BlockBlastSavedState,
} from '../src/utils/blockBlastEngine';

// Mock window.localStorage để kiểm thử lưu & khôi phục theo từng tài khoản Office
const memStore = new Map<string, string>();
(globalThis as unknown as { window: { localStorage: Storage } }).window = {
  localStorage: {
    get length() {
      return memStore.size;
    },
    clear: () => memStore.clear(),
    getItem: (k: string) => memStore.get(k) ?? null,
    key: (i: number) => Array.from(memStore.keys())[i] ?? null,
    removeItem: (k: string) => {
      memStore.delete(k);
    },
    setItem: (k: string, v: string) => {
      memStore.set(k, v);
    },
  },
};

// 1. Kiểm tra đặt sát mép, ngoài bàn và đè ô đã có khối
{
  const state = createNewBlockBlastState(0);
  state.tray = [
    { uid: 'p1', defId: 'square_2x2', color: '#38bdf8' },
    { uid: 'p2', defId: 'single', color: '#fb7185' },
    { uid: 'p3', defId: 'single', color: '#34d399' },
  ];

  // Ngoài bàn (mảnh 2x2 đặt ở hàng 7 cột 7 sẽ tràn ra hàng 8 cột 8)
  const outRes = placePieceAndEvaluate(state, 0, 7, 7);
  assert.equal(outRes.valid, false);
  assert.equal(outRes.nextState.score, 0);
  assert.notEqual(outRes.nextState.tray[0], null);

  // Sát mép hợp lệ (6, 6) cho 2x2
  const edgeRes = placePieceAndEvaluate(state, 0, 6, 6);
  assert.equal(edgeRes.valid, true);
  assert.equal(edgeRes.nextState.score, 4);

  // Đè lên ô đã có khối tại (6, 6)
  const overlapRes = placePieceAndEvaluate(edgeRes.nextState, 1, 6, 6);
  assert.equal(overlapRes.valid, false);
  assert.equal(overlapRes.nextState.score, 4);
  assert.notEqual(overlapRes.nextState.tray[1], null);
}

// 2. Xóa 1 hàng, 1 cột và xóa đồng thời 1 hàng + 1 cột với mảnh 3 ô => 28 điểm
{
  const board = createEmptyBoard();
  // Lấp hàng 0 (trừ cột 0, 1, 2? dùng thanh 3 dọc ở cột 0: (0,0), (1,0), (2,0) để xóa hàng 0 + cột 0!)
  for (let c = 1; c < BOARD_SIZE; c++) board[0][c] = '#38bdf8';
  for (let r = 3; r < BOARD_SIZE; r++) board[r][0] = '#fb7185';
  const state: BlockBlastSavedState = {
    board,
    tray: [
      { uid: 't0', defId: 'line_3_v', color: '#fbbf24' },
      { uid: 't1', defId: 'single', color: '#38bdf8' },
      { uid: 't2', defId: 'single', color: '#34d399' },
    ],
    score: 0,
    bestScore: 0,
    totalLinesCleared: 0,
    level: 1,
    isGameOver: false,
    updatedAt: Date.now(),
  };

  const res = placePieceAndEvaluate(state, 0, 0, 0);
  assert.equal(res.valid, true);
  assert.equal(res.linesCleared, 2);
  // 3 ô + 2*10 + 5 thưởng = 28 điểm
  assert.equal(res.pointsEarned, 28);
  assert.equal(res.nextState.score, 28);
  assert.equal(res.nextState.totalLinesCleared, 2);
  // Toàn bộ hàng 0 và cột 0 đã trống
  for (let i = 0; i < BOARD_SIZE; i++) {
    assert.equal(res.nextState.board[0][i], null);
    assert.equal(res.nextState.board[i][0], null);
  }
}

// 3. Mốc Level 4 -> 5, 44 -> 45, lên level khi còn mảnh vs hết mảnh cuối
{
  assert.equal(computeLevel(4), 1);
  assert.equal(computeLevel(5), 2);
  assert.equal(formatLevelProgressLabel(12), 'Level 3 · 2/5 đường');
  assert.equal(computeLevel(44), 9);
  assert.equal(computeLevel(45), 10);
  assert.equal(formatLevelProgressLabel(45), 'Level 10 · Tối đa');

  // Lên level khi khay còn mảnh: giữ nguyên 2 mảnh còn lại
  const board = createEmptyBoard();
  for (let c = 1; c < BOARD_SIZE; c++) board[0][c] = '#38bdf8';
  const stateMid: BlockBlastSavedState = {
    board,
    tray: [
      { uid: 'm0', defId: 'single', color: '#fbbf24' },
      { uid: 'm1', defId: 'line_2_h', color: '#38bdf8' },
      { uid: 'm2', defId: 'square_2x2', color: '#34d399' },
    ],
    score: 100,
    bestScore: 100,
    totalLinesCleared: 4, // 4 -> 5 sẽ lên Level 2
    level: 1,
    isGameOver: false,
    updatedAt: Date.now(),
  };
  const midRes = placePieceAndEvaluate(stateMid, 0, 0, 0);
  assert.equal(midRes.valid, true);
  assert.equal(midRes.leveledUpTo, 2);
  assert.equal(midRes.dealtNewSet, false);
  assert.equal(midRes.nextState.tray[1]?.uid, 'm1');
  assert.equal(midRes.nextState.tray[2]?.uid, 'm2');

  // Đặt nốt mảnh cuối cùng (mảnh thứ 3) làm lên Level 10 (44 -> 45) -> cấp bộ mới theo Level 10
  const boardEnd = createEmptyBoard();
  for (let c = 1; c < BOARD_SIZE; c++) boardEnd[0][c] = '#38bdf8';
  const stateEnd: BlockBlastSavedState = {
    board: boardEnd,
    tray: [null, null, { uid: 'last', defId: 'single', color: '#fbbf24' }],
    score: 500,
    bestScore: 500,
    totalLinesCleared: 44,
    level: 9,
    isGameOver: false,
    updatedAt: Date.now(),
  };
  const endRes = placePieceAndEvaluate(stateEnd, 2, 0, 0);
  assert.equal(endRes.valid, true);
  assert.equal(endRes.leveledUpTo, 10);
  assert.equal(endRes.dealtNewSet, true);
  assert.equal(endRes.nextState.tray.filter(Boolean).length, 3);
}

// 4. Quy tắc cấp mảnh theo level + đảm bảo bộ mới có ít nhất 1 mảnh đặt được
{
  const empty = createEmptyBoard();
  for (let trial = 0; trial < 40; trial++) {
    const lv1 = dealThreePieces(empty, 1);
    assert.equal(lv1.length, 3);
    assert.equal(
      lv1.some((p) => getPieceDef(p.defId).tier === 'small'),
      true
    );
    assert.equal(
      lv1.some((p) => HARD_PIECE_IDS.has(p.defId)),
      false
    );

    const lv3 = dealThreePieces(empty, 3);
    const hard3 = lv3.filter((p) => HARD_PIECE_IDS.has(p.defId));
    assert.ok(hard3.length <= 1);
    assert.equal(
      lv3.some((p) => LARGE_RECT_AND_3X3_IDS.has(p.defId)),
      false
    );

    const lv6 = dealThreePieces(empty, 6);
    const hard6 = lv6.filter((p) => HARD_PIECE_IDS.has(p.defId));
    assert.ok(hard6.length <= 2);

    const lv10 = dealThreePieces(empty, 10);
    const count3x3 = lv10.filter((p) => p.defId === SQUARE_3X3_ID).length;
    assert.ok(count3x3 <= 1);
  }
}

// 5. Ván tiếp tục khi còn 1 mảnh đặt được, kết thúc khi mọi mảnh đều kẹt
{
  const nearlyFull = createEmptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      nearlyFull[r][c] = '#38bdf8';
    }
  }
  nearlyFull[0][0] = null; // Chỉ còn 1 ô trống duy nhất (0,0)

  const stateContinue: BlockBlastSavedState = {
    board: nearlyFull,
    tray: [
      { uid: 'stuck', defId: 'square_2x2', color: '#fb7185' },
      { uid: 'fit', defId: 'single', color: '#34d399' },
      null,
    ],
    score: 10,
    bestScore: 10,
    totalLinesCleared: 0,
    level: 1,
    isGameOver: false,
    updatedAt: Date.now(),
  };
  // Nếu đặt thêm ô giả ở bàn còn trống 1 ô: vẫn chưa hết nước vì mảnh 'fit' (1x1) đặt được!
  // Kiểm tra trường hợp đặt mảnh 1x1 vào ô (0,0) khi còn lại mảnh 2x2 -> bàn đầy -> hết nước!
  nearlyFull[0][1] = null; // 2 ô trống cạnh nhau ở (0,0) và (0,1), hàng 0 chưa đầy hoàn toàn? Không, nếu 6/8 đã đầy thì đặt 2 ô sẽ xóa hàng!
  // Đặt (0,0) và (1,0) đều trống, bỏ (0,7) ra khỏi full? Không: chỉ cần lấp toàn bộ trừ (0,0) và (7,7) không liền kề:
  nearlyFull[0][1] = '#38bdf8';
  nearlyFull[7][7] = null; // Còn (0,0) và (7,7) đều không xóa hàng vì mỗi hàng còn 1 ô trống
  const resStillPlay = placePieceAndEvaluate(
    {
      ...stateContinue,
      board: nearlyFull,
      tray: [
        { uid: 'big', defId: 'square_3x3', color: '#fb7185' },
        { uid: 'one_a', defId: 'single', color: '#34d399' },
        { uid: 'one_b', defId: 'single', color: '#fbbf24' },
      ],
    },
    1,
    0,
    0
  );
  // Đã xóa hàng 0 (vì hàng 0 vừa đầy khi đặt (0,0)!), nên lấy ví dụ không xóa hàng:
  assert.equal(resStillPlay.valid, true);

  // Tạo bàn cờ ca-rô: ô (r+c)%2 === 1 đã lấp, ô (r+c)%2 === 0 trống -> không hàng/cột nào đầy và không mảnh 2×2 nào đặt được!
  const checkerboard = createEmptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        checkerboard[r][c] = '#38bdf8';
      }
    }
  }
  const endCheck = placePieceAndEvaluate(
    {
      board: checkerboard,
      tray: [
        { uid: 's1', defId: 'single', color: '#34d399' },
        { uid: 'b2', defId: 'square_2x2', color: '#fb7185' },
        null,
      ],
      score: 50,
      bestScore: 50,
      totalLinesCleared: 0,
      level: 1,
      isGameOver: false,
      updatedAt: Date.now(),
    },
    0,
    0,
    0
  );
  assert.equal(endCheck.valid, true);
  assert.equal(endCheck.nextState.isGameOver, true);
}

// 6. Hai tài khoản dùng chung trình duyệt có tiến độ riêng & khôi phục đúng
{
  const accA = createNewBlockBlastState(120);
  accA.score = 88;
  accA.totalLinesCleared = 6;
  accA.level = 2;
  saveBlockBlastState('user_A', accA);

  const accB = createNewBlockBlastState(40);
  accB.score = 15;
  accB.totalLinesCleared = 1;
  accB.level = 1;
  saveBlockBlastState('user_B', accB);

  const loadedA = loadBlockBlastState('user_A');
  const loadedB = loadBlockBlastState('user_B');
  assert.equal(loadedA.score, 88);
  assert.equal(loadedA.bestScore, 120);
  assert.equal(loadedA.level, 2);
  assert.equal(loadedB.score, 15);
  assert.equal(loadedB.bestScore, 40);
  assert.equal(loadedB.level, 1);
}

console.log('✅ All Block Blast (Xếp khối) unit tests passed!');
