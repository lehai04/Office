import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
import {
  BOARD_SIZE,
  canPlacePiece,
  createNewBlockBlastState,
  formatLevelProgressLabel,
  getPieceDef,
  loadBlockBlastState,
  placePieceAndEvaluate,
  saveBlockBlastState,
  type BlockBlastSavedState,
  type BlockPieceDef,
  type TrayPiece,
} from '../utils/blockBlastEngine';
import {
  playCatMeowSound,
  playDartHitSound,
  playKnifeClangSound,
} from '../utils/zenSound';

interface BlockBlastGameProps {
  currentUserId: string;
  soundEnabled: boolean;
}

interface DragState {
  trayIndex: number;
  piece: TrayPiece;
  def: BlockPieceDef;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  isTouch: boolean;
  hasMoved: boolean;
}

function PieceMiniGrid({
  def,
  color,
  cellPx,
}: {
  def: BlockPieceDef;
  color: string;
  cellPx: number;
}) {
  const occupied = new Set(def.cells.map(([r, c]) => `${r},${c}`));
  return (
    <div
      className="grid gap-[2px]"
      style={{
        gridTemplateColumns: `repeat(${def.cols}, ${cellPx}px)`,
        gridTemplateRows: `repeat(${def.rows}, ${cellPx}px)`,
      }}
    >
      {Array.from({ length: def.rows * def.cols }, (_, idx) => {
        const r = Math.floor(idx / def.cols);
        const c = idx % def.cols;
        const active = occupied.has(`${r},${c}`);
        return (
          <div
            key={idx}
            className={active ? 'rounded-[4px] shadow-inner border border-white/45' : ''}
            style={{
              width: cellPx,
              height: cellPx,
              backgroundColor: active ? color : 'transparent',
            }}
          />
        );
      })}
    </div>
  );
}

export const BlockBlastGame: React.FC<BlockBlastGameProps> = ({
  currentUserId,
  soundEnabled,
}) => {
  const [gameState, setGameState] = useState<BlockBlastSavedState>(() =>
    loadBlockBlastState(currentUserId)
  );
  const [selectedTrayIdx, setSelectedTrayIdx] = useState<number | null>(null);
  const [hoverAnchor, setHoverAnchor] = useState<{ row: number; col: number } | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pointsPopup, setPointsPopup] = useState<{ id: number; text: string } | null>(null);
  const [levelUpToast, setLevelUpToast] = useState<string | null>(null);
  const [clearingCellKeys, setClearingCellKeys] = useState<Set<string>>(new Set());
  const [confirmRestartOpen, setConfirmRestartOpen] = useState<boolean>(false);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Tải lại ván riêng khi đổi tài khoản Office
  useEffect(() => {
    setGameState(loadBlockBlastState(currentUserId));
    setSelectedTrayIdx(null);
    setHoverAnchor(null);
    setDragState(null);
    setConfirmRestartOpen(false);
  }, [currentUserId]);

  const computeDragAnchor = useCallback(
    (clientX: number, clientY: number, isTouch: boolean, def: BlockPieceDef) => {
      const el = boardRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const cellSize = rect.width / BOARD_SIZE;
      // Trên điện thoại, nâng hình xem trước lên cao hơn đầu ngón tay để nhìn rõ ô đích
      const previewCenterY = isTouch ? clientY - 64 : clientY;
      const topLeftX = clientX - (def.cols * cellSize) / 2;
      const topLeftY = previewCenterY - (def.rows * cellSize) / 2;

      const col = Math.round((topLeftX - rect.left) / cellSize);
      const row = Math.round((topLeftY - rect.top) / cellSize);

      // Nếu kéo ra quá xa ngoài bàn -> trả mảnh về khay
      const outsideMargin = cellSize * 0.75;
      if (
        clientX < rect.left - outsideMargin ||
        clientX > rect.right + outsideMargin ||
        previewCenterY < rect.top - outsideMargin ||
        previewCenterY > rect.bottom + outsideMargin
      ) {
        return null;
      }

      return { row, col };
    },
    []
  );

  const executePlaceMove = useCallback(
    (trayIndex: number, anchorRow: number, anchorCol: number) => {
      const current = gameStateRef.current;
      const res = placePieceAndEvaluate(current, trayIndex, anchorRow, anchorCol);
      if (!res.valid) {
        if (soundEnabled) playKnifeClangSound();
        return false;
      }

      setGameState(res.nextState);
      saveBlockBlastState(currentUserId, res.nextState);
      setSelectedTrayIdx(null);
      setHoverAnchor(null);

      if (res.clearedCells.length > 0) {
        const keys = new Set(res.clearedCells.map(([r, c]) => `${r},${c}`));
        setClearingCellKeys(keys);
        window.setTimeout(() => {
          setClearingCellKeys(new Set());
        }, 240);
      }

      if (soundEnabled) {
        if (res.leveledUpTo || res.linesCleared > 0) {
          playCatMeowSound('adopt');
        } else {
          playDartHitSound();
        }
      }

      setPointsPopup({
        id: Date.now(),
        text:
          res.linesCleared > 0
            ? `+${res.pointsEarned} (${res.linesCleared} đường)`
            : `+${res.pointsEarned}`,
      });
      window.setTimeout(() => {
        setPointsPopup((prev) => (prev && Date.now() - prev.id >= 1000 ? null : prev));
      }, 1100);

      if (res.leveledUpTo) {
        const msg = `Lên Level ${res.leveledUpTo}!`;
        setLevelUpToast(msg);
        window.setTimeout(() => {
          setLevelUpToast((prev) => (prev === msg ? null : prev));
        }, 2200);
      }

      return true;
    },
    [currentUserId, soundEnabled]
  );

  // Lắng nghe kéo thả toàn cục cho chuột và cảm ứng
  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const hasMoved = dragState.hasMoved || Math.hypot(dx, dy) > 8;
      setDragState((prev) =>
        prev
          ? {
              ...prev,
              clientX: e.clientX,
              clientY: e.clientY,
              hasMoved,
            }
          : null
      );
      if (hasMoved) {
        const anchor = computeDragAnchor(
          e.clientX,
          e.clientY,
          dragState.isTouch,
          dragState.def
        );
        setHoverAnchor(anchor);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (dragState.hasMoved) {
        const anchor = computeDragAnchor(
          e.clientX,
          e.clientY,
          dragState.isTouch,
          dragState.def
        );
        if (anchor) {
          executePlaceMove(dragState.trayIndex, anchor.row, anchor.col);
        } else {
          setHoverAnchor(null);
        }
      } else {
        // Chạm/click nhẹ -> bật chế độ chọn mảnh để chạm ô đặt
        setSelectedTrayIdx((prev) =>
          prev === dragState.trayIndex ? null : dragState.trayIndex
        );
        setHoverAnchor(null);
      }
      setDragState(null);
    };

    const handlePointerCancel = () => {
      setDragState(null);
      setHoverAnchor(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [dragState, computeDragAnchor, executePlaceMove]);

  const handleRestartConfirmed = () => {
    const fresh = createNewBlockBlastState(gameState.bestScore);
    setGameState(fresh);
    saveBlockBlastState(currentUserId, fresh);
    setSelectedTrayIdx(null);
    setHoverAnchor(null);
    setDragState(null);
    setConfirmRestartOpen(false);
    setPointsPopup(null);
    setLevelUpToast(null);
  };

  const activePreviewPiece: { piece: TrayPiece; def: BlockPieceDef } | null = dragState?.hasMoved
    ? { piece: dragState.piece, def: dragState.def }
    : selectedTrayIdx !== null && gameState.tray[selectedTrayIdx]
      ? {
          piece: gameState.tray[selectedTrayIdx]!,
          def: getPieceDef(gameState.tray[selectedTrayIdx]!.defId),
        }
      : null;

  const previewValid =
    activePreviewPiece && hoverAnchor
      ? canPlacePiece(
          gameState.board,
          activePreviewPiece.def,
          hoverAnchor.row,
          hoverAnchor.col
        )
      : false;

  const previewCellSet = new Set<string>();
  if (activePreviewPiece && hoverAnchor) {
    for (const [dr, dc] of activePreviewPiece.def.cells) {
      const r = hoverAnchor.row + dr;
      const c = hoverAnchor.col + dc;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        previewCellSet.add(`${r},${c}`);
      }
    }
  }

  const boardCellWidth = boardRef.current
    ? boardRef.current.getBoundingClientRect().width / BOARD_SIZE
    : 38;

  return (
    <div className="relative flex flex-col items-center p-2.5 sm:p-3.5 space-y-2.5 bg-[#fdf8f0] text-[#3d2b1f] select-none">
      {/* 1. ĐIỂM, ĐIỂM CAO & LEVEL */}
      <div className="w-full flex items-center justify-between gap-2 rounded-2xl border-2 border-[#e5dccb] bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase text-[#8c7865]">Điểm</div>
            <div className="text-lg font-black leading-none text-[#3d2b1f]">
              {gameState.score}
            </div>
          </div>
          <div className="h-7 w-px bg-[#ece2d0]" />
          <div>
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700">
              <Trophy className="h-3 w-3" />
              <span>Điểm cao</span>
            </div>
            <div className="text-lg font-black leading-none text-amber-600">
              {gameState.bestScore}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            data-testid="block-blast-level-badge"
            className="rounded-xl bg-slate-800 px-2.5 py-1 text-[11px] font-black text-amber-300 shadow-sm"
          >
            {formatLevelProgressLabel(gameState.totalLinesCleared)}
          </span>
          <button
            type="button"
            onClick={() => {
              if (gameState.isGameOver || gameState.score === 0) {
                handleRestartConfirmed();
              } else {
                setConfirmRestartOpen(true);
              }
            }}
            title="Chơi lại ván mới"
            className="inline-flex items-center gap-1 rounded-xl border border-[#d8cbb8] bg-[#f8f1e4] hover:bg-amber-100 px-2 py-1 text-[11px] font-black text-[#4a3326] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Chơi lại</span>
          </button>
        </div>
      </div>

      {/* Thông báo lên Level / Điểm vừa cộng */}
      <div className="relative w-full flex items-center justify-center min-h-[20px]">
        {levelUpToast && (
          <div className="rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-black text-white shadow animate-bounce">
            🎉 {levelUpToast}
          </div>
        )}
        {!levelUpToast && pointsPopup && (
          <div className="rounded-full bg-amber-400 px-3 py-0.5 text-xs font-black text-slate-950 shadow">
            {pointsPopup.text} điểm
          </div>
        )}
        {!levelUpToast && !pointsPopup && (
          <div className="text-[11px] font-semibold text-[#7a6452]">
            {selectedTrayIdx !== null
              ? 'Chạm vào ô trên bàn để đặt mảnh (hoặc chạm mảnh khác để đổi)'
              : 'Kéo thả hoặc chạm chọn mảnh ở khay bên dưới'}
          </div>
        )}
      </div>

      {/* 2. BÀN CHƠI 8×8 */}
      <div className="relative w-full max-w-[336px] sm:max-w-[368px] aspect-square">
        <div
          ref={boardRef}
          data-testid="block-blast-board"
          onMouseLeave={() => {
            if (!dragState) setHoverAnchor(null);
          }}
          className="grid h-full w-full grid-cols-8 grid-rows-8 gap-1 rounded-2xl border-4 border-[#cbd5e1] bg-[#1e293b] p-1.5 shadow-xl touch-none"
        >
          {gameState.board.map((rowArr, r) =>
            rowArr.map((cellColor, c) => {
              const key = `${r},${c}`;
              const isPreview = previewCellSet.has(key);
              const isFlashing = clearingCellKeys.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onMouseEnter={() => {
                    if (selectedTrayIdx !== null && !dragState) {
                      setHoverAnchor({ row: r, col: c });
                    }
                  }}
                  onClick={() => {
                    if (selectedTrayIdx !== null) {
                      executePlaceMove(selectedTrayIdx, r, c);
                    }
                  }}
                  className={`relative rounded-[5px] transition-all cursor-pointer ${
                    cellColor
                      ? 'border border-white/40 shadow-inner'
                      : 'bg-[#334155]/75 hover:bg-[#475569]/80'
                  } ${
                    isPreview
                      ? previewValid
                        ? 'ring-2 ring-emerald-300 brightness-110'
                        : 'ring-2 ring-rose-400 bg-rose-500/45'
                      : ''
                  } ${isFlashing ? 'bg-white scale-95 ring-2 ring-amber-300' : ''}`}
                  style={{
                    backgroundColor: isFlashing
                      ? '#fef08a'
                      : cellColor
                        ? cellColor
                        : isPreview && previewValid && activePreviewPiece
                          ? `${activePreviewPiece.piece.color}88`
                          : undefined,
                  }}
                />
              );
            })
          )}
        </div>

        {/* HẾT NƯỚC ĐI OVERLAY */}
        {gameState.isGameOver && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-slate-950/85 p-4 text-center text-white backdrop-blur-sm space-y-3">
            <div className="text-2xl font-black text-amber-300">Hết nước đi</div>
            <div className="space-y-1 text-xs">
              <div>
                Điểm ván này: <strong className="text-base text-white">{gameState.score}</strong>
              </div>
              <div className="text-amber-300">
                Điểm cao: <strong className="text-base">{gameState.bestScore}</strong>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRestartConfirmed}
              className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-2.5 text-xs font-black text-slate-950 shadow-lg hover:brightness-105 active:scale-95 cursor-pointer"
            >
              Chơi lại
            </button>
          </div>
        )}
      </div>

      {/* 3. KHAY 3 MẢNH */}
      <div className="w-full max-w-[368px] grid grid-cols-3 gap-2">
        {gameState.tray.map((piece, idx) => {
          const isBeingDragged = dragState?.trayIndex === idx && dragState.hasMoved;
          const isSelected = selectedTrayIdx === idx;
          if (!piece) {
            return (
              <div
                key={`empty-${idx}`}
                className="flex h-[88px] items-center justify-center rounded-2xl border-2 border-dashed border-[#e2d6c3] bg-white/40"
              />
            );
          }
          const def = getPieceDef(piece.defId);
          return (
            <div
              key={piece.uid}
              data-testid={`block-tray-${idx}`}
              onPointerDown={(e) => {
                if (gameState.isGameOver) return;
                e.preventDefault();
                setDragState({
                  trayIndex: idx,
                  piece,
                  def,
                  startX: e.clientX,
                  startY: e.clientY,
                  clientX: e.clientX,
                  clientY: e.clientY,
                  isTouch: e.pointerType === 'touch',
                  hasMoved: false,
                });
              }}
              className={`flex h-[88px] items-center justify-center rounded-2xl border-2 bg-white p-2 shadow-sm transition-all touch-none cursor-grab active:cursor-grabbing ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-300 bg-indigo-50/40 scale-[1.03]'
                  : 'border-[#e5dccb] hover:border-amber-400'
              } ${isBeingDragged ? 'opacity-25' : ''}`}
            >
              <PieceMiniGrid def={def} color={piece.color} cellPx={12} />
            </div>
          );
        })}
      </div>

      {/* BÓNG KÉO THẢ THEO NGÓN TAY / CON TRỎ */}
      {dragState && dragState.hasMoved && (
        <div
          className="pointer-events-none fixed z-[80]"
          style={{
            left: dragState.clientX,
            top: dragState.isTouch ? dragState.clientY - 64 : dragState.clientY,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <PieceMiniGrid
            def={dragState.def}
            color={dragState.piece.color}
            cellPx={Math.max(24, Math.floor(boardCellWidth - 4))}
          />
        </div>
      )}

      {/* XÁC NHẬN CHƠI LẠI KHI VÁN ĐANG DIỄN RA */}
      {confirmRestartOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border-2 border-[#e5dccb] bg-white p-4 text-center shadow-2xl space-y-3">
            <div className="text-sm font-black text-[#3d2b1f]">Bắt đầu ván mới?</div>
            <p className="text-xs text-[#7a6452]">
              Ván hiện tại ({gameState.score} điểm) sẽ bị hủy để chơi lại từ đầu.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmRestartOpen(false)}
                className="rounded-xl border border-[#d8cbb8] bg-white px-4 py-1.5 text-xs font-bold text-[#5c4938] cursor-pointer"
              >
                Tiếp tục chơi
              </button>
              <button
                type="button"
                onClick={handleRestartConfirmed}
                className="rounded-xl bg-rose-500 hover:bg-rose-400 px-4 py-1.5 text-xs font-black text-white shadow cursor-pointer"
              >
                Chơi lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
