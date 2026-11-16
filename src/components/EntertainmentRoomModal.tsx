import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  Upload,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
  Camera,
  Trash2,
  Swords,
  Crown,
  Disc,
  Flame,
  X,
  ArrowLeft,
  Sparkles,
  Check,
} from 'lucide-react';
import type { RoomMember } from '../types/office';
import {
  playCatMeowSound,
  playDartHitSound,
  playKnifeClangSound,
  playWoodShatterSound,
  startCatGameMusic,
  stopCatGameMusic,
} from '../utils/zenSound';
import {
  ALL_PET_BREEDS,
  CAT_BREEDS,
  CAT_SHOP_ITEMS,
  DOG_BREEDS,
  DOG_UNLOCK_FEE_VND,
  getActivityLabel,
  isDogBreed,
  type CatActivity,
  type CatBreedId,
  type CatGiftRequest,
  type CatShopItem,
  type OfficeCatProfile,
} from '../utils/officeCatsData';
import { formatVnd } from '../utils/officeEconomyData';
import {
  clampPuzzleGrid,
  MAX_PUZZLE_PIECES,
  PUZZLE_ARTWORKS,
  resolveActivePuzzleArtwork,
  type PuzzleArtwork,
  type RoomPuzzleState,
} from '../utils/officePuzzleData';

export interface KnifeStageConfig {
  stage: number;
  title: string;
  knivesToThrow: number;
  presetKnives: number;
  applesCount: number;
  baseSpeed: number;
  pattern: 'steady' | 'sine_wave' | 'reverse_pause' | 'erratic' | 'boss_chaos';
  isBoss?: boolean;
}

export const KNIFE_STAGES: KnifeStageConfig[] = [
  {
    stage: 1,
    title: 'STAGE 1',
    knivesToThrow: 7,
    presetKnives: 0,
    applesCount: 1,
    baseSpeed: 1.8,
    pattern: 'steady',
  },
  {
    stage: 2,
    title: 'STAGE 2',
    knivesToThrow: 8,
    presetKnives: 1,
    applesCount: 2,
    baseSpeed: 2.2,
    pattern: 'sine_wave',
  },
  {
    stage: 3,
    title: 'STAGE 3',
    knivesToThrow: 9,
    presetKnives: 2,
    applesCount: 2,
    baseSpeed: 2.5,
    pattern: 'reverse_pause',
  },
  {
    stage: 4,
    title: 'STAGE 4',
    knivesToThrow: 10,
    presetKnives: 2,
    applesCount: 3,
    baseSpeed: 2.8,
    pattern: 'erratic',
  },
  {
    stage: 5,
    title: '⚔️ BOSS',
    knivesToThrow: 11,
    presetKnives: 3,
    applesCount: 4,
    baseSpeed: 3.1,
    pattern: 'boss_chaos',
    isBoss: true,
  },
];

type PlayableGameId = 'office_cat' | 'puzzle' | 'knife_hit' | 'wheel';

interface GameCatalogItem {
  id: string;
  playableId: PlayableGameId;
  title: string;
  playersText: string;
  badge?: string;
  bgGradient: string;
  sceneRender: () => React.ReactNode;
}

/**
 * Nhân vật Blob tròn dễ thương phong cách Bloop Party
 */
const CuteBlob: React.FC<{
  color: string;
  size?: string;
  className?: string;
  expression?: 'happy' | 'angry' | 'surprised' | 'king';
}> = ({ color, size = 'h-9 w-9', className = '', expression = 'happy' }) => (
  <div
    className={`relative inline-flex items-center justify-center rounded-full shadow-md border-2 border-white/80 ${size} ${className}`}
    style={{ backgroundColor: color }}
  >
    {expression === 'king' && (
      <span className="absolute -top-3.5 text-xs drop-shadow">👑</span>
    )}
    <div className="flex flex-col items-center justify-center gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
      </div>
      {expression === 'surprised' ? (
        <span className="h-2 w-2 rounded-full bg-rose-900" />
      ) : expression === 'angry' ? (
        <span className="h-0.5 w-2.5 bg-slate-900 rounded-full" />
      ) : (
        <span className="h-1.5 w-2.5 rounded-b-full bg-rose-900/80" />
      )}
    </div>
    {/* Má hồng */}
    <span className="absolute left-1.5 top-1/2 h-1 w-1.5 rounded-full bg-pink-300/80" />
    <span className="absolute right-1.5 top-1/2 h-1 w-1.5 rounded-full bg-pink-300/80" />
  </div>
);

/**
 * Minh họa Bé Mèo dễ thương cho thẻ game và trang Mèo của tôi
 */
const CuteCatAvatar: React.FC<{
  breedId: CatBreedId;
  activity?: CatActivity;
  sizeClass?: string;
}> = ({ breedId, activity = 'walking', sizeClass = 'h-20 w-20' }) => {
  const breed = ALL_PET_BREEDS.find((b) => b.id === breedId) || CAT_BREEDS[0];
  return (
    <div className={`relative inline-flex items-center justify-center ${sizeClass}`}>
      {/* Hai tai mèo */}
      <div
        className="absolute -top-1.5 left-2 h-6 w-6 rotate-[-18deg] rounded-tl-xl rounded-tr-sm border-2 border-[#3d2b1f]/25"
        style={{ backgroundColor: breed.earColor }}
      />
      <div
        className="absolute -top-1.5 right-2 h-6 w-6 rotate-[18deg] rounded-tr-xl rounded-tl-sm border-2 border-[#3d2b1f]/25"
        style={{ backgroundColor: breed.earColor }}
      />
      {/* Thân/mặt mèo tròn */}
      <div
        className="relative z-10 flex h-full w-full flex-col items-center justify-center rounded-full border-[3px] border-white shadow-md"
        style={{ backgroundColor: breed.bodyColor }}
      >
        {/* Bụng/má trắng */}
        <div
          className="absolute bottom-1 h-1/2 w-3/4 rounded-full opacity-85"
          style={{ backgroundColor: breed.bellyColor }}
        />
        {/* Mắt mèo */}
        <div className="relative z-10 flex items-center gap-3 -mt-1">
          {activity === 'sleeping' ? (
            <>
              <span className="h-1 w-3 rounded-full bg-slate-800" />
              <span className="h-1 w-3 rounded-full bg-slate-800" />
            </>
          ) : (
            <>
              <span className="h-2.5 w-2.5 rounded-full bg-slate-900 ring-2 ring-white/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-900 ring-2 ring-white/60" />
            </>
          )}
        </div>
        {/* Mũi hồng & miệng mèo ω */}
        <div className="relative z-10 mt-1 flex flex-col items-center">
          <span className="h-1.5 w-2 rounded-full bg-pink-500" />
          <span className="text-[11px] font-black leading-none text-slate-800">ω</span>
        </div>
        {/* Má hồng */}
        <span className="absolute left-2.5 top-1/2 h-1.5 w-2.5 rounded-full bg-rose-400/75" />
        <span className="absolute right-2.5 top-1/2 h-1.5 w-2.5 rounded-full bg-rose-400/75" />
      </div>
      {/* Biểu tượng trạng thái nhỏ */}
      <span className="absolute -top-2 -right-2 z-20 rounded-full bg-white px-1.5 py-0.5 text-xs shadow">
        {activity === 'sleeping' ? '💤' : activity === 'playing' ? '🧶' : '🐾'}
      </span>
    </div>
  );
};

/**
 * Danh sách chỉ giữ lại đúng 3 Game theo yêu cầu:
 * 1. Nuôi Mèo Văn Phòng (Mèo của tôi)
 * 2. Phóng Phi Tiêu (Knife Hit)
 * 3. Vòng Quay (Vòng Quay Trà Sữa / Nhân Phẩm)
 */
const GAME_CATALOG: GameCatalogItem[] = [
  {
    id: 'office_cat',
    playableId: 'office_cat',
    title: 'Nuôi Mèo Văn Phòng',
    playersText: 'Mỗi người 1 bé mèo',
    badge: 'MỚI • Sân 3D',
    bgGradient: 'from-amber-100 via-rose-100 to-emerald-100',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center gap-2 overflow-hidden">
        <CuteCatAvatar breedId="orange" activity="playing" sizeClass="h-14 w-14" />
        <span className="text-lg animate-bounce">🐟</span>
        <span className="absolute bottom-1.5 right-3 text-base">🧶</span>
        <span className="absolute top-1.5 left-3 text-sm">🐾</span>
      </div>
    ),
  },
  {
    id: 'puzzle',
    playableId: 'puzzle',
    title: 'Ghép Tranh',
    playersText: 'Từ 1 người · 10-20s',
    badge: 'MỚI • Cả Phòng',
    bgGradient: 'from-sky-100 via-indigo-50 to-emerald-100',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="grid grid-cols-3 gap-1 rounded-xl border-2 border-indigo-200 bg-white/90 p-1.5 shadow-sm">
          <div className="h-5 w-5 rounded bg-gradient-to-br from-rose-300 to-amber-200" />
          <div className="h-5 w-5 rounded bg-gradient-to-br from-sky-300 to-indigo-300" />
          <div className="h-5 w-5 rounded border border-dashed border-indigo-300 bg-indigo-50/70 flex items-center justify-center text-[9px] text-indigo-400">
            ?
          </div>
          <div className="h-5 w-5 rounded bg-gradient-to-br from-emerald-300 to-teal-200" />
          <div className="h-5 w-5 rounded bg-gradient-to-br from-amber-300 to-orange-200" />
          <div className="h-5 w-5 rounded bg-gradient-to-br from-violet-300 to-pink-200" />
        </div>
        <span className="absolute right-2.5 bottom-1.5 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow">
          3×3
        </span>
      </div>
    ),
  },
  {
    id: 'knife_hit',
    playableId: 'knife_hit',
    title: 'Phóng Phi Tiêu',
    playersText: '1-2 người',
    badge: 'HOT • Ghép Ảnh',
    bgGradient: 'from-amber-200 via-orange-100 to-emerald-200',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
        <div className="h-14 w-14 rounded-full border-4 border-[#9a4d22] bg-[#f4a261] shadow-inner flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-[#e07a3c] flex items-center justify-center">
            <CuteBlob color="#ff6b8b" size="h-6 w-6" expression="surprised" />
          </div>
        </div>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-lg drop-shadow">
          🗡️
        </span>
        <span className="absolute top-2 right-4 text-sm">🍎</span>
        <CuteBlob
          color="#38bdf8"
          size="h-7 w-7"
          className="absolute bottom-2 left-3"
        />
      </div>
    ),
  },
  {
    id: 'wheel',
    playableId: 'wheel',
    title: 'Vòng Quay',
    playersText: '1-8 người',
    badge: 'Party',
    bgGradient: 'from-fuchsia-200 via-pink-100 to-indigo-200',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center gap-1">
        <div className="h-14 w-14 rounded-full border-4 border-white bg-gradient-to-tr from-rose-400 via-amber-300 to-sky-400 shadow flex items-center justify-center">
          <span className="text-base">🎡</span>
        </div>
        <CuteBlob color="#fbbf24" size="h-8 w-8" className="-ml-2 mt-4" />
      </div>
    ),
  },
];

interface StuckKnife {
  angle: number;
  playerIndex: 0 | 1 | -1;
}

interface StuckApple {
  id: string;
  angle: number;
  sliced: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
}

interface ShatterWedge {
  startAngle: number;
  endAngle: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
}

interface FlyingKnifeOut {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  playerIndex: 0 | 1 | -1;
}

interface EntertainmentRoomModalProps {
  isOpen: boolean;
  onExitGameRoom: () => void;
  currentUserId: string;
  currentNickname: string;
  members: RoomMember[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  onBroadcastChallengeMessage: (text: string) => void;
  activeChallengeBanner?: string | null;
  // Props kết nối Tiền Công Đức của Phòng Tịnh Tâm & Hệ thống Nuôi Mèo Văn Phòng
  meritCount: number;
  onSpendMerit: (amount: number) => boolean;
  walletBalanceVnd: number;
  onSpendMoney: (amountVnd: number) => boolean;
  unlockedDogs: boolean;
  ownedPets: OfficeCatProfile[];
  onUnlockDogs: () => { ok: boolean; error?: string };
  onBuyDogPet: (breedId: CatBreedId, petName: string) => { ok: boolean; error?: string };
  onSwitchActivePet: (petId: string) => void;
  roomCats: Record<string, OfficeCatProfile>;
  myCatInventory: Record<string, number>;
  giftRequests: CatGiftRequest[];
  onAdoptOrUpdateMyCat: (cat: OfficeCatProfile, notice?: string) => void;
  onUpdateMyCatInventory: (nextInv: Record<string, number>) => void;
  onCreateGiftRequest: (req: CatGiftRequest) => void;
  onFulfillGiftRequest: (reqId: string) => void;
  roomPuzzleState: RoomPuzzleState;
  onPlacePuzzlePiece: (pieceIdx: number) => {
    ok: boolean;
    alreadyTaken?: boolean;
    completedNow?: boolean;
  };
  onSelectNextPuzzle: (
    artworkId: string,
    options?: {
      gridCols?: number;
      gridRows?: number;
      customArtwork?: PuzzleArtwork | null;
    }
  ) => void;
}

const STORAGE_CUSTOM_PHOTO_KEY = 'van_phong_ao_dart_target_photo';
const STORAGE_CUSTOM_NAME_KEY = 'van_phong_ao_dart_target_name';
const STORAGE_UNLOCKED_STAGE_KEY = 'van_phong_ao_knife_unlocked_stage';
const STORAGE_BEST_SCORE_KEY = 'van_phong_ao_knife_best_score';
const STORAGE_APPLES_KEY = 'van_phong_ao_knife_apples';

function normalizeAngle(a: number): number {
  let res = a % (Math.PI * 2);
  if (res < 0) res += Math.PI * 2;
  return res;
}

function shortestAngleDiff(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, Math.PI * 2 - diff);
}

export const EntertainmentRoomModal: React.FC<EntertainmentRoomModalProps> = ({
  isOpen,
  onExitGameRoom,
  currentUserId,
  currentNickname,
  members,
  soundEnabled,
  onToggleSound,
  onBroadcastChallengeMessage,
  meritCount,
  onSpendMerit,
  walletBalanceVnd,
  onSpendMoney,
  unlockedDogs,
  ownedPets,
  onUnlockDogs,
  onBuyDogPet,
  onSwitchActivePet,
  roomCats,
  myCatInventory,
  giftRequests,
  onAdoptOrUpdateMyCat,
  onUpdateMyCatInventory,
  onCreateGiftRequest,
  onFulfillGiftRequest,
  roomPuzzleState,
  onPlacePuzzlePiece,
  onSelectNextPuzzle,
}) => {
  // Mặc định khi bấm vào Phòng Giải Trí -> hiện Sảnh Danh Sách Game dễ thương (lobby)
  const [activeView, setActiveView] = useState<'lobby' | PlayableGameId>('lobby');

  // ==================== STATE CHO GAME 1: NUÔI MÈO VĂN PHÒNG ====================
  const myCat: OfficeCatProfile | undefined = roomCats[currentUserId];
  const [catSubTab, setCatSubTab] = useState<'my_cat' | 'shop' | 'gifts' | 'bag'>('my_cat');
  const [adoptBreed, setAdoptBreed] = useState<CatBreedId>('orange');
  const [adoptNameDraft, setAdoptNameDraft] = useState<string>('Miu Cam');
  const [catNotice, setCatNotice] = useState<string | null>(null);
  const [showFeedPicker, setShowFeedPicker] = useState<boolean>(false);
  const [showRequestGiftForm, setShowRequestGiftForm] = useState<boolean>(false);
  const [requestItemId, setRequestItemId] = useState<string>('tuna_pate');
  const [requestTargetUserId, setRequestTargetUserId] = useState<string>(''); // '' = đăng vào mục Quà tặng của phòng
  const [pendingShopBuyItem, setPendingShopBuyItem] = useState<CatShopItem | null>(null);
  const [pendingFulfillRequest, setPendingFulfillRequest] = useState<CatGiftRequest | null>(null);
  const [catReactionBubble, setCatReactionBubble] = useState<string | null>(null);
  const [catBounceKey, setCatBounceKey] = useState<number>(0);
  const [dogNameDraft, setDogNameDraft] = useState<string>('');

  // Phát nhạc nền nhẹ nhàng vui tươi trong game Nuôi Mèo khi bật âm thanh
  useEffect(() => {
    if (isOpen && activeView === 'office_cat' && soundEnabled) {
      startCatGameMusic();
    } else {
      stopCatGameMusic();
    }
    return () => {
      stopCatGameMusic();
    };
  }, [isOpen, activeView, soundEnabled]);

  // ==================== STATE CHO GAME GHÉP TRANH CÙNG PHÒNG ====================
  const [puzzleSubTab, setPuzzleSubTab] = useState<'board' | 'gallery' | 'custom'>('board');
  const [selectedPuzzlePiece, setSelectedPuzzlePiece] = useState<number | null>(null);
  const [draggedPuzzlePiece, setDraggedPuzzlePiece] = useState<number | null>(null);
  const [puzzleFeedback, setPuzzleFeedback] = useState<{
    type: 'ok' | 'warn' | 'err';
    text: string;
  } | null>(null);
  const [wrongCellIdx, setWrongCellIdx] = useState<number | null>(null);
  const [showLargeReference, setShowLargeReference] = useState<boolean>(false);
  const [customImageDataUrl, setCustomImageDataUrl] = useState<string | null>(null);
  const [customTitleDraft, setCustomTitleDraft] = useState<string>('');
  const [customCols, setCustomCols] = useState<number>(4);
  const [customRows, setCustomRows] = useState<number>(4);
  const [customUploadError, setCustomUploadError] = useState<string | null>(null);

  const handleUploadCustomPuzzleImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCustomUploadError(null);
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const size = 560;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setCustomUploadError('Không thể xử lý ảnh trên trình duyệt này.');
            return;
          }
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          setCustomImageDataUrl(compressed);
          if (!customTitleDraft.trim()) {
            const cleanName = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
            setCustomTitleDraft(cleanName || `Tranh của ${currentNickname}`);
          }
        };
        img.onerror = () => {
          setCustomUploadError('File không phải ảnh hợp lệ.');
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    },
    [currentNickname, customTitleDraft]
  );

  const currentPuzzleArtwork = useMemo(
    () => resolveActivePuzzleArtwork(roomPuzzleState),
    [roomPuzzleState]
  );

  const totalPuzzlePieces =
    currentPuzzleArtwork.gridCols * currentPuzzleArtwork.gridRows;

  // Xáo trộn cố định thứ tự mảnh trong khay theo artworkId để không bị nhảy thứ tự khi đồng bộ
  const shuffledTrayPieceOrder = useMemo(() => {
    const indices = Array.from({ length: totalPuzzlePieces }, (_, i) => i);
    let seed = 0;
    for (let i = 0; i < currentPuzzleArtwork.id.length; i++) {
      seed = (seed * 31 + currentPuzzleArtwork.id.charCodeAt(i)) % 9973;
    }
    for (let i = indices.length - 1; i > 0; i--) {
      seed = (seed * 73 + 17) % 9973;
      const j = seed % (i + 1);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [currentPuzzleArtwork.id, totalPuzzlePieces]);

  const unplacedPuzzlePieces = useMemo(
    () => shuffledTrayPieceOrder.filter((idx) => !roomPuzzleState.placedPieces[idx]),
    [shuffledTrayPieceOrder, roomPuzzleState.placedPieces],
  );

  const placedCount = totalPuzzlePieces - unplacedPuzzlePieces.length;
  const isCurrentPuzzleComplete = placedCount >= totalPuzzlePieces;

  // Nếu mảnh đang chọn vừa được đồng nghiệp ghép trước -> tự bỏ chọn & thông báo nhẹ
  useEffect(() => {
    if (selectedPuzzlePiece !== null && roomPuzzleState.placedPieces[selectedPuzzlePiece]) {
      const who = roomPuzzleState.placedPieces[selectedPuzzlePiece]?.placedByNickname || 'Đồng nghiệp';
      setSelectedPuzzlePiece(null);
      setPuzzleFeedback({
        type: 'warn',
        text: `${who} vừa ghép đúng mảnh #${selectedPuzzlePiece + 1} trước bạn! Hãy chọn mảnh khác nhé.`,
      });
    }
  }, [roomPuzzleState.placedPieces, selectedPuzzlePiece]);

  const handleAttemptPlacePiece = useCallback(
    (pieceIdx: number | null, targetCellIdx: number) => {
      if (pieceIdx === null || isCurrentPuzzleComplete) return;

      // Ô đã có người đặt đúng trước đó
      if (roomPuzzleState.placedPieces[targetCellIdx]) {
        const who = roomPuzzleState.placedPieces[targetCellIdx]?.placedByNickname || 'Đồng nghiệp';
        setPuzzleFeedback({
          type: 'warn',
          text: `Ô này đã được ${who} ghép rồi!`,
        });
        setSelectedPuzzlePiece(null);
        return;
      }

      if (pieceIdx === targetCellIdx) {
        const res = onPlacePuzzlePiece(pieceIdx);
        setSelectedPuzzlePiece(null);
        setDraggedPuzzlePiece(null);

        if (res.alreadyTaken) {
          if (soundEnabled) playKnifeClangSound();
          setPuzzleFeedback({
            type: 'warn',
            text: 'Đồng nghiệp vừa nhanh tay ghép đúng mảnh này trước một nhịp! Chọn mảnh khác nhé.',
          });
          return;
        }

        if (res.ok) {
          if (soundEnabled) {
            if (res.completedNow) {
              playCatMeowSound();
            } else {
              playDartHitSound();
            }
          }
          setPuzzleFeedback({
            type: 'ok',
            text: res.completedNow
              ? `Hoàn thành bức "${currentPuzzleArtwork.title}"! Đã lưu vào Bộ sưu tập của phòng.`
              : 'Khớp chuẩn! Mảnh đã được giữ tại chỗ và đồng bộ cho cả phòng.',
          });
        }
      } else {
        // Đặt nhầm -> rung nhẹ ô báo sai, mảnh quay về khay
        if (soundEnabled) playKnifeClangSound();
        setWrongCellIdx(targetCellIdx);
        setSelectedPuzzlePiece(null);
        setDraggedPuzzlePiece(null);
        setPuzzleFeedback({
          type: 'err',
          text: 'Chưa đúng vị trí rồi, mảnh đã quay về khay để bạn thử lại!',
        });
        window.setTimeout(() => {
          setWrongCellIdx((prev) => (prev === targetCellIdx ? null : prev));
        }, 550);
      }
    },
    [
      currentPuzzleArtwork.title,
      isCurrentPuzzleComplete,
      onPlacePuzzlePiece,
      roomPuzzleState.placedPieces,
      soundEnabled,
    ],
  );

  // ==================== STATE CHO GAME 2: PHÓNG PHI TIÊU (KNIFE HIT) ====================
  const [gameMode, setGameMode] = useState<'campaign' | 'pvp'>('campaign');
  const [currentStageNum, setCurrentStageNum] = useState<number>(1);
  const [unlockedStage, setUnlockedStage] = useState<number>(() => {
    try {
      return Math.max(1, Number(window.localStorage.getItem(STORAGE_UNLOCKED_STAGE_KEY)) || 1);
    } catch {
      return 1;
    }
  });
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      return Number(window.localStorage.getItem(STORAGE_BEST_SCORE_KEY)) || 0;
    } catch {
      return 0;
    }
  });
  const [appleCount, setAppleCount] = useState<number>(() => {
    try {
      return Number(window.localStorage.getItem(STORAGE_APPLES_KEY)) || 0;
    } catch {
      return 0;
    }
  });

  // Tùy chỉnh ghép ảnh người vào Khúc Gỗ Xoay
  const [targetPhotoUrl, setTargetPhotoUrl] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(STORAGE_CUSTOM_PHOTO_KEY) || null;
    } catch {
      return null;
    }
  });
  const [targetPersonName, setTargetPersonName] = useState<string>(() => {
    try {
      return window.localStorage.getItem(STORAGE_CUSTOM_NAME_KEY) || '';
    } catch {
      return '';
    }
  });
  const [photoCoverageMode, setPhotoCoverageMode] = useState<'center' | 'full'>('full');
  const [showPhotoPopover, setShowPhotoPopover] = useState<boolean>(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // Chế độ Solo cùng bạn bè (PvP)
  const [opponentName, setOpponentName] = useState<string>('Đối thủ');
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>('');
  const [activeTurnPlayer, setActiveTurnPlayer] = useState<0 | 1>(0);
  const [pvpScores, setPvpScores] = useState<[number, number]>([0, 0]);
  const [pvpKnivesLeft, setPvpKnivesLeft] = useState<[number, number]>([6, 6]);

  const stageConfig =
    KNIFE_STAGES.find((s) => s.stage === currentStageNum) || KNIFE_STAGES[0];
  const [score, setScore] = useState<number>(0);
  const [knivesRemaining, setKnivesRemaining] = useState<number>(stageConfig.knivesToThrow);
  const [lastHitBanner, setLastHitBanner] = useState<string | null>(null);
  const [stageState, setStageState] = useState<'playing' | 'shattering' | 'failed' | 'pvp_over'>(
    'playing'
  );

  // ==================== STATE CHO GAME 3: VÒNG QUAY ====================
  const [wheelItemsText, setWheelItemsText] = useState<string>(
    'Bao trà sữa cả phòng 🧋\nĐược về sớm 15 phút 🏃\nHát 1 bài tặng phòng 🎤\nTrực nhật dọn bàn 🧹\nNhận pháo tay 👏\nMiễn phạt 1 lần ✨'
  );
  const [spinningWheel, setSpinningWheel] = useState<boolean>(false);
  const [wheelResult, setWheelResult] = useState<string | null>(null);

  // Refs cho hệ thống vật lý 60FPS của Knife Hit
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logAngleRef = useRef<number>(0);
  const logBumpYRef = useRef<number>(0);
  const logFlashRef = useRef<number>(0);
  const stuckKnivesRef = useRef<StuckKnife[]>([]);
  const stuckApplesRef = useRef<StuckApple[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shatterWedgesRef = useRef<ShatterWedge[]>([]);
  const flyingKnivesOutRef = useRef<FlyingKnifeOut[]>([]);
  const activeThrowRef = useRef<{
    x?: number;
    y: number;
    playerIndex: 0 | 1;
    bouncing: boolean;
    vx: number;
    vy: number;
    rot: number;
    vRot: number;
  } | null>(null);

  // Khi mới mở Phòng Giải Trí -> luôn bắt đầu từ Sảnh Chọn Game dễ thương
  useEffect(() => {
    if (isOpen) {
      setActiveView('lobby');
      setCatNotice(null);
      setPendingShopBuyItem(null);
      setPendingFulfillRequest(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!targetPhotoUrl) {
      loadedImageRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
    };
    img.onerror = () => {
      loadedImageRef.current = null;
    };
    img.src = targetPhotoUrl;
  }, [targetPhotoUrl]);

  useEffect(() => {
    const others = members.filter((m) => m.userId !== currentUserId);
    if (others.length > 0 && !selectedOpponentId) {
      setSelectedOpponentId(others[0].userId);
      setOpponentName(others[0].nickname);
    }
  }, [members, currentUserId, selectedOpponentId]);

  const initStageEntities = useCallback((cfg: KnifeStageConfig) => {
    logAngleRef.current = 0;
    logBumpYRef.current = 0;
    logFlashRef.current = 0;
    activeThrowRef.current = null;
    particlesRef.current = [];
    shatterWedgesRef.current = [];
    flyingKnivesOutRef.current = [];

    const presets: StuckKnife[] = [];
    for (let i = 0; i < cfg.presetKnives; i++) {
      const ang = ((Math.PI * 2) / cfg.presetKnives) * i + 0.4;
      presets.push({ angle: normalizeAngle(ang), playerIndex: -1 });
    }
    stuckKnivesRef.current = presets;

    const apples: StuckApple[] = [];
    for (let i = 0; i < cfg.applesCount; i++) {
      const ang = ((Math.PI * 2) / cfg.applesCount) * i + 1.15;
      apples.push({ id: `apple-${i}`, angle: normalizeAngle(ang), sliced: false });
    }
    stuckApplesRef.current = apples;
  }, []);

  const setupStage = useCallback(
    (targetStageNum: number, targetMode: 'campaign' | 'pvp', resetTotalScore = false) => {
      const cfg =
        KNIFE_STAGES.find((s) => s.stage === targetStageNum) || KNIFE_STAGES[0];
      initStageEntities(cfg);
      setStageState('playing');
      setLastHitBanner(null);
      if (resetTotalScore) {
        setScore(0);
      }
      if (targetMode === 'campaign') {
        setKnivesRemaining(cfg.knivesToThrow);
      } else {
        setActiveTurnPlayer(0);
        setPvpScores([0, 0]);
        setPvpKnivesLeft([6, 6]);
        setKnivesRemaining(12);
      }
    },
    [initStageEntities]
  );

  useEffect(() => {
    if (isOpen && activeView === 'knife_hit') {
      setupStage(currentStageNum, gameMode, true);
    }
  }, [isOpen, activeView, gameMode, setupStage]);

  const spawnSplinters = useCallback(
    (x: number, y: number, count: number, color = '#f4a261') => {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 6.5;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          radius: 3 + Math.random() * 4.5,
          color,
          alpha: 1,
        });
      }
    },
    []
  );

  const triggerLogShatter = useCallback(
    (logCenterX: number, logCenterY: number) => {
      setStageState('shattering');
      if (soundEnabled) {
        playWoodShatterSound();
      }
      spawnSplinters(logCenterX, logCenterY, 26, '#f4a261');
      spawnSplinters(logCenterX, logCenterY, 12, '#e76f51');

      const cuts = [
        { start: -Math.PI * 0.85, end: -Math.PI * 0.15, vx: -4.2, vy: -2.4, vRot: -0.05 },
        { start: -Math.PI * 0.15, end: Math.PI * 0.55, vx: 4.5, vy: -1.8, vRot: 0.06 },
        { start: Math.PI * 0.55, end: Math.PI * 1.15, vx: -1.2, vy: 4.8, vRot: -0.04 },
      ];
      shatterWedgesRef.current = cuts.map((c) => ({
        startAngle: c.start,
        endAngle: c.end,
        x: logCenterX,
        y: logCenterY,
        vx: c.vx,
        vy: c.vy,
        rot: logAngleRef.current,
        vRot: c.vRot,
      }));

      flyingKnivesOutRef.current = stuckKnivesRef.current.map((sk) => {
        const worldAngle = sk.angle + logAngleRef.current;
        const kx = logCenterX + Math.cos(worldAngle) * 90;
        const ky = logCenterY + Math.sin(worldAngle) * 90;
        return {
          x: kx,
          y: ky,
          vx: Math.cos(worldAngle) * (5 + Math.random() * 3),
          vy: Math.sin(worldAngle) * (5 + Math.random() * 3),
          rot: worldAngle - Math.PI / 2,
          vRot: (Math.random() - 0.5) * 0.25,
          playerIndex: sk.playerIndex,
        };
      });

      window.setTimeout(() => {
        if (gameMode === 'campaign') {
          const nextStg = currentStageNum < KNIFE_STAGES.length ? currentStageNum + 1 : 1;
          setCurrentStageNum(nextStg);
          setUnlockedStage((prevUnlock) => {
            const updated = Math.max(prevUnlock, nextStg);
            try {
              window.localStorage.setItem(STORAGE_UNLOCKED_STAGE_KEY, String(updated));
            } catch {
              // ignore
            }
            return updated;
          });
          const nextCfg =
            KNIFE_STAGES.find((s) => s.stage === nextStg) || KNIFE_STAGES[0];
          initStageEntities(nextCfg);
          setKnivesRemaining(nextCfg.knivesToThrow);
          setStageState('playing');
        } else {
          setStageState('pvp_over');
        }
      }, 1100);
    },
    [soundEnabled, spawnSplinters, gameMode, currentStageNum, initStageEntities]
  );

  const handleThrowKnife = useCallback(() => {
    if (stageState !== 'playing') return;
    if (activeThrowRef.current) return;

    activeThrowRef.current = {
      y: 355,
      playerIndex: gameMode === 'pvp' ? activeTurnPlayer : 0,
      bouncing: false,
      vx: 0,
      vy: -26,
      rot: 0,
      vRot: 0,
    };
  }, [stageState, gameMode, activeTurnPlayer]);

  useEffect(() => {
    if (!isOpen || activeView !== 'knife_hit') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleThrowKnife();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, activeView, handleThrowKnife]);

  // Vòng lặp vẽ Canvas Knife Hit 60FPS
  useEffect(() => {
    if (!isOpen || activeView !== 'knife_hit') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();
    const startTime = lastTime;

    const drawKnifeSprite = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      rotationRad: number,
      playerIdx: 0 | 1 | -1
    ) => {
      c.save();
      c.translate(x, y);
      c.rotate(rotationRad);

      c.beginPath();
      c.moveTo(0, -34);
      c.lineTo(7.5, -4);
      c.lineTo(-7.5, -4);
      c.closePath();
      c.fillStyle = '#e0f2fe';
      c.fill();

      c.beginPath();
      c.moveTo(0, -34);
      c.lineTo(7.5, -4);
      c.lineTo(0, -4);
      c.closePath();
      c.fillStyle = '#38bdf8';
      c.fill();

      c.fillStyle = '#f59e0b';
      c.beginPath();
      c.roundRect(-10, -4, 20, 6, 3);
      c.fill();

      const handleColor =
        playerIdx === -1 ? '#a855f7' : playerIdx === 0 ? '#dc2626' : '#06b6d4';
      c.fillStyle = handleColor;
      c.beginPath();
      c.roundRect(-5, 2, 10, 22, 2);
      c.fill();

      c.fillStyle = '#fbbf24';
      c.fillRect(-5.5, 20, 11, 5);

      c.restore();
    };

    const drawWoodLogSlice = (
      c: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      radius: number,
      rot: number,
      startAng = 0,
      endAng = Math.PI * 2,
      isWedge = false
    ) => {
      c.save();
      c.translate(cx, cy);
      c.rotate(rot);

      if (isWedge) {
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, radius + 12, startAng, endAng);
        c.closePath();
        c.clip();
      }

      c.beginPath();
      c.arc(0, 0, radius, 0, Math.PI * 2);
      c.fillStyle = '#9a4d22';
      c.fill();

      c.beginPath();
      c.arc(0, 0, radius - 8, 0, Math.PI * 2);
      c.fillStyle = '#f4a261';
      c.fill();

      const grainRadii = [radius * 0.76, radius * 0.54, radius * 0.32];
      grainRadii.forEach((gr, idx) => {
        c.beginPath();
        c.arc(0, 0, gr, 0, Math.PI * 2);
        c.strokeStyle = idx % 2 === 0 ? '#e07a3c' : '#eab676';
        c.lineWidth = 6;
        c.stroke();
      });

      if (loadedImageRef.current) {
        const photoR =
          photoCoverageMode === 'full' ? radius - 9 : radius * 0.56;
        c.save();
        c.beginPath();
        c.arc(0, 0, photoR, 0, Math.PI * 2);
        c.closePath();
        c.clip();

        c.drawImage(
          loadedImageRef.current,
          -photoR,
          -photoR,
          photoR * 2,
          photoR * 2
        );

        c.strokeStyle = 'rgba(245, 158, 11, 0.85)';
        c.lineWidth = 3;
        c.stroke();
        c.restore();
      }

      if (targetPersonName.trim() && !isWedge) {
        c.save();
        c.font = 'bold 12px Inter, sans-serif';
        c.textAlign = 'center';
        c.fillStyle = 'rgba(15, 23, 42, 0.85)';
        const textW = Math.min(130, c.measureText(targetPersonName).width + 16);
        c.beginPath();
        c.roundRect(-textW / 2, -10, textW, 20, 8);
        c.fill();
        c.fillStyle = '#fde68a';
        c.fillText(targetPersonName.slice(0, 14), 0, 4);
        c.restore();
      }

      c.restore();
    };

    const renderLoop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const elapsed = (now - startTime) / 1000;

      const w = canvas.width;
      const h = canvas.height;
      const logX = w / 2;
      const baseLogY = 148;
      const logRadius = 76;

      logBumpYRef.current *= 0.78;
      logFlashRef.current = Math.max(0, logFlashRef.current - dt * 5);
      const logY = baseLogY + logBumpYRef.current;

      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#072e38');
      bgGrad.addColorStop(1, '#03161c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 2;
      for (let x = 28; x < w; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      if (stageState === 'playing') {
        let angularVel = stageConfig.baseSpeed;
        if (stageConfig.pattern === 'sine_wave') {
          angularVel = stageConfig.baseSpeed * (0.4 + Math.abs(Math.sin(elapsed * 1.6)) * 1.1);
        } else if (stageConfig.pattern === 'reverse_pause') {
          angularVel = stageConfig.baseSpeed * Math.sin(elapsed * 1.35) * 1.35;
        } else if (stageConfig.pattern === 'erratic') {
          angularVel =
            stageConfig.baseSpeed *
            (Math.sin(elapsed * 2.4) + 0.6 * Math.cos(elapsed * 1.1));
        } else if (stageConfig.pattern === 'boss_chaos') {
          angularVel =
            stageConfig.baseSpeed *
            (1.25 * Math.sin(elapsed * 2.1) + 0.85 * Math.cos(elapsed * 3.4));
        }
        logAngleRef.current = normalizeAngle(logAngleRef.current + angularVel * dt);
      }

      if (activeThrowRef.current) {
        const tk = activeThrowRef.current;
        if (!tk.bouncing) {
          ctx.save();
          const trailGrad = ctx.createLinearGradient(logX, tk.y, logX, 410);
          trailGrad.addColorStop(0, 'rgba(226, 232, 240, 0.45)');
          trailGrad.addColorStop(1, 'rgba(226, 232, 240, 0.0)');
          ctx.fillStyle = trailGrad;
          ctx.beginPath();
          ctx.moveTo(logX - 8, tk.y + 10);
          ctx.lineTo(logX + 8, tk.y + 10);
          ctx.lineTo(logX + 3, 410);
          ctx.lineTo(logX - 3, 410);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          tk.y += tk.vy;

          const hitThresholdY = logY + logRadius + 16;
          if (tk.y <= hitThresholdY) {
            const impactWorldAngle = Math.PI / 2;
            const relativeImpactAngle = normalizeAngle(
              impactWorldAngle - logAngleRef.current
            );

            const hitExistingKnife = stuckKnivesRef.current.some(
              (sk) => shortestAngleDiff(sk.angle, relativeImpactAngle) < 0.175
            );

            if (hitExistingKnife) {
              tk.bouncing = true;
              tk.vx = (Math.random() > 0.5 ? 1 : -1) * 4.5;
              tk.vy = 6.5;
              tk.vRot = 0.32;
              if (soundEnabled) {
                playKnifeClangSound();
              }
              spawnSplinters(logX, hitThresholdY, 12, '#fde047');

              if (gameMode === 'campaign') {
                window.setTimeout(() => {
                  setStageState('failed');
                }, 420);
              } else {
                setPvpKnivesLeft((prev) => {
                  const next: [number, number] = [...prev] as [number, number];
                  next[tk.playerIndex] = Math.max(0, next[tk.playerIndex] - 1);
                  if (next[0] === 0 && next[1] === 0) {
                    window.setTimeout(() => setStageState('pvp_over'), 450);
                  } else {
                    const other: 0 | 1 = tk.playerIndex === 0 ? 1 : 0;
                    if (next[other] > 0) setActiveTurnPlayer(other);
                  }
                  return next;
                });
              }
            } else {
              activeThrowRef.current = null;
              stuckKnivesRef.current.push({
                angle: relativeImpactAngle,
                playerIndex: tk.playerIndex,
              });
              logBumpYRef.current = -11;
              logFlashRef.current = 1;
              spawnSplinters(logX, logY + logRadius, 9, '#f4a261');

              let hitApple = false;
              stuckApplesRef.current.forEach((ap) => {
                if (!ap.sliced && shortestAngleDiff(ap.angle, relativeImpactAngle) < 0.26) {
                  ap.sliced = true;
                  hitApple = true;
                  spawnSplinters(logX, logY + logRadius + 10, 10, '#ef4444');
                }
              });

              if (hitApple) {
                setAppleCount((prev) => {
                  const next = prev + 2;
                  try {
                    window.localStorage.setItem(STORAGE_APPLES_KEY, String(next));
                  } catch {
                    // ignore
                  }
                  return next;
                });
              }

              if (soundEnabled) {
                playDartHitSound(hitApple);
              }

              const gainedPts = hitApple ? 25 : 10;

              if (gameMode === 'campaign') {
                setScore((prev) => {
                  const next = prev + 1;
                  if (next > bestScore) {
                    setBestScore(next);
                    try {
                      window.localStorage.setItem(STORAGE_BEST_SCORE_KEY, String(next));
                    } catch {
                      // ignore
                    }
                  }
                  return next;
                });

                setKnivesRemaining((prevLeft) => {
                  const nextLeft = prevLeft - 1;
                  if (nextLeft <= 0) {
                    triggerLogShatter(logX, logY);
                  }
                  return nextLeft;
                });
              } else {
                setPvpScores((prev) => {
                  const next: [number, number] = [...prev] as [number, number];
                  next[tk.playerIndex] += gainedPts;
                  return next;
                });

                setPvpKnivesLeft((prev) => {
                  const next: [number, number] = [...prev] as [number, number];
                  next[tk.playerIndex] = Math.max(0, next[tk.playerIndex] - 1);
                  const totalLeft = next[0] + next[1];
                  if (totalLeft <= 0) {
                    triggerLogShatter(logX, logY);
                  } else {
                    const other: 0 | 1 = tk.playerIndex === 0 ? 1 : 0;
                    if (next[other] > 0) setActiveTurnPlayer(other);
                  }
                  return next;
                });
              }
            }
          }
        } else {
          tk.x = (tk.x ?? logX) + tk.vx;
          tk.y += tk.vy;
          tk.vy += 0.55;
          tk.rot += tk.vRot;
          if (tk.y > h + 60) {
            activeThrowRef.current = null;
          }
        }
      }

      if (stageState === 'shattering') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(logX, baseLogY, logRadius + 38, 0, Math.PI * 2);
        ctx.setLineDash([4, 10]);
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(132, 204, 22, 0.45)';
        ctx.stroke();
        ctx.restore();

        for (const fk of flyingKnivesOutRef.current) {
          fk.x += fk.vx;
          fk.y += fk.vy;
          fk.rot += fk.vRot;
          drawKnifeSprite(ctx, fk.x, fk.y, fk.rot, fk.playerIndex);
        }

        for (const wedge of shatterWedgesRef.current) {
          wedge.x += wedge.vx;
          wedge.y += wedge.vy;
          wedge.rot += wedge.vRot;
          drawWoodLogSlice(
            ctx,
            wedge.x,
            wedge.y,
            logRadius,
            wedge.rot,
            wedge.startAngle,
            wedge.endAngle,
            true
          );
        }
      } else {
        for (const sk of stuckKnivesRef.current) {
          const worldAngle = sk.angle + logAngleRef.current;
          const kx = logX + Math.cos(worldAngle) * (logRadius + 14);
          const ky = logY + Math.sin(worldAngle) * (logRadius + 14);
          drawKnifeSprite(ctx, kx, ky, worldAngle - Math.PI / 2, sk.playerIndex);
        }

        for (const ap of stuckApplesRef.current) {
          if (ap.sliced) continue;
          const worldAngle = ap.angle + logAngleRef.current;
          const ax = logX + Math.cos(worldAngle) * (logRadius + 14);
          const ay = logY + Math.sin(worldAngle) * (logRadius + 14);
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(worldAngle + Math.PI / 2);
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.ellipse(3, -10, 4, 2, -0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        drawWoodLogSlice(ctx, logX, logY, logRadius, logAngleRef.current);

        if (logFlashRef.current > 0.05) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(logX, logY, logRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${logFlashRef.current * 0.32})`;
          ctx.fill();
          ctx.restore();
        }
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.032;
        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (activeThrowRef.current) {
        const tk = activeThrowRef.current;
        drawKnifeSprite(ctx, tk.x ?? logX, tk.y, tk.rot, tk.playerIndex);
      } else if (stageState === 'playing') {
        drawKnifeSprite(
          ctx,
          logX,
          362,
          0,
          gameMode === 'pvp' ? activeTurnPlayer : 0
        );
      }

      const totalIcons =
        gameMode === 'campaign'
          ? stageConfig.knivesToThrow
          : pvpKnivesLeft[activeTurnPlayer];
      const remainingIcons =
        gameMode === 'campaign' ? knivesRemaining : pvpKnivesLeft[activeTurnPlayer];

      for (let i = 0; i < totalIcons; i++) {
        const iy = 385 - i * 18;
        const isUsed = i >= remainingIcons;
        ctx.save();
        ctx.translate(24, iy);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = isUsed ? 'rgba(15, 23, 42, 0.7)' : '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(3.5, 2);
        ctx.lineTo(-3.5, 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = isUsed ? 'rgba(15, 23, 42, 0.7)' : '#f59e0b';
        ctx.fillRect(-3, 2, 6, 5);
        ctx.restore();
      }

      // HUD trên đỉnh Canvas giống hệt ảnh Knife Hit
      ctx.save();
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'left';
      ctx.fillText(
        gameMode === 'campaign' ? String(score) : `${pvpScores[0]} - ${pvpScores[1]}`,
        16,
        30
      );

      const dotStartX = w / 2 - 36;
      for (let s = 1; s <= 4; s++) {
        ctx.beginPath();
        ctx.arc(dotStartX + (s - 1) * 16, 20, 4.5, 0, Math.PI * 2);
        ctx.fillStyle =
          s < currentStageNum
            ? '#f59e0b'
            : s === currentStageNum
              ? '#fbbf24'
              : 'rgba(255,255,255,0.35)';
        ctx.fill();
      }
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = currentStageNum === 5 ? '#f43f5e' : '#e2e8f0';
      ctx.fillText('⚔️', dotStartX + 4 * 16 + 4, 25);

      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
      ctx.fillText(
        gameMode === 'campaign'
          ? `STAGE ${currentStageNum}`
          : `${activeTurnPlayer === 0 ? currentNickname : opponentName}`,
        w / 2,
        44
      );

      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'right';
      ctx.fillText(`${appleCount} 🍎`, w - 16, 30);
      ctx.restore();

      animId = window.requestAnimationFrame(renderLoop);
    };

    animId = window.requestAnimationFrame(renderLoop);
    return () => window.cancelAnimationFrame(animId);
  }, [
    isOpen,
    activeView,
    stageState,
    stageConfig,
    gameMode,
    currentStageNum,
    score,
    bestScore,
    appleCount,
    knivesRemaining,
    pvpScores,
    pvpKnivesLeft,
    activeTurnPlayer,
    currentNickname,
    opponentName,
    photoCoverageMode,
    targetPersonName,
    soundEnabled,
    spawnSplinters,
    triggerLogShatter,
  ]);

  const handleUploadTargetPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (dataUrl) {
        setTargetPhotoUrl(dataUrl);
        try {
          window.localStorage.setItem(STORAGE_CUSTOM_PHOTO_KEY, dataUrl);
        } catch {
          // ignore
        }
        if (!targetPersonName) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          setTargetPersonName(cleanName);
          try {
            window.localStorage.setItem(STORAGE_CUSTOM_NAME_KEY, cleanName);
          } catch {
            // ignore
          }
        }
        setShowPhotoPopover(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectMemberAsTarget = (member: RoomMember) => {
    const svgCanvas = document.createElement('canvas');
    svgCanvas.width = 256;
    svgCanvas.height = 256;
    const c = svgCanvas.getContext('2d');
    if (c) {
      const grad = c.createRadialGradient(128, 128, 20, 128, 128, 128);
      grad.addColorStop(0, member.avatarGender === 'female' ? '#f43f5e' : '#3b82f6');
      grad.addColorStop(1, '#0f172a');
      c.fillStyle = grad;
      c.fillRect(0, 0, 256, 256);

      c.fillStyle = '#fcd34d';
      c.beginPath();
      c.arc(128, 112, 56, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = '#0f172a';
      c.beginPath();
      c.arc(106, 102, 7, 0, Math.PI * 2);
      c.arc(150, 102, 7, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = '#0f172a';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(128, 124, 22, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();

      c.fillStyle = '#ffffff';
      c.font = 'bold 24px Inter, sans-serif';
      c.textAlign = 'center';
      c.fillText(member.nickname.slice(0, 14), 128, 212);

      const dataUrl = svgCanvas.toDataURL('image/png');
      setTargetPhotoUrl(dataUrl);
      setTargetPersonName(member.nickname);
      try {
        window.localStorage.setItem(STORAGE_CUSTOM_PHOTO_KEY, dataUrl);
        window.localStorage.setItem(STORAGE_CUSTOM_NAME_KEY, member.nickname);
      } catch {
        // ignore
      }
      setShowPhotoPopover(false);
    }
  };

  const handleClearTargetPhoto = () => {
    setTargetPhotoUrl(null);
    setTargetPersonName('');
    try {
      window.localStorage.removeItem(STORAGE_CUSTOM_PHOTO_KEY);
      window.localStorage.removeItem(STORAGE_CUSTOM_NAME_KEY);
    } catch {
      // ignore
    }
  };

  const handleSendRoomChallenge = () => {
    const targetMember = members.find((m) => m.userId === selectedOpponentId);
    const opponentLabel = targetMember ? targetMember.nickname : opponentName;
    const targetInfo = targetPersonName ? ` (Bia gỗ: "${targetPersonName}")` : '';
    const msg = `🎯 [THÁCH ĐẤU PHI TIÊU] ${currentNickname} thách đấu @${opponentLabel} chơi 🗡️ Knife Hit${targetInfo} trong 🎮 Phòng Giải Trí!`;
    onBroadcastChallengeMessage(msg);
    setLastHitBanner(`📣 Đã mời ${opponentLabel}!`);
  };

  const handleShareMatchResult = () => {
    if (gameMode === 'campaign') {
      const msg = `🗡️ [KNIFE HIT] ${currentNickname} đạt ${score} dao liên tiếp (Stage ${currentStageNum}, ${appleCount} 🍎)${
        targetPersonName ? ` — Chẻ vỡ bia "${targetPersonName}"` : ''
      }!`;
      onBroadcastChallengeMessage(msg);
    } else {
      const winner =
        pvpScores[0] > pvpScores[1]
          ? `${currentNickname} thắng!`
          : pvpScores[1] > pvpScores[0]
            ? `${opponentName} thắng!`
            : 'Hòa!';
      const msg = `⚔️ [SOLO KNIFE HIT] ${currentNickname} (${pvpScores[0]}đ) vs ${opponentName} (${pvpScores[1]}đ) — 🏆 ${winner}`;
      onBroadcastChallengeMessage(msg);
    }
    setLastHitBanner('📣 Đã gửi điểm ra phòng!');
  };

  const handleSpinWheel = () => {
    const items = wheelItemsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0 || spinningWheel) return;
    setSpinningWheel(true);
    setWheelResult(null);
    window.setTimeout(() => {
      const chosen = items[Math.floor(Math.random() * items.length)];
      setWheelResult(chosen);
      setSpinningWheel(false);
    }, 1000);
  };

  // ==================== CÁC THAO TÁC TRONG GAME NUÔI MÈO VĂN PHÒNG ====================
  const triggerCatReaction = (bubbleText: string, mood: 'happy' | 'eat' | 'play' | 'adopt') => {
    playCatMeowSound(mood);
    setCatBounceKey((k) => k + 1);
    setCatReactionBubble(bubbleText);
    window.setTimeout(() => {
      setCatReactionBubble((prev) => (prev === bubbleText ? null : prev));
    }, 2200);
  };

  const handleAdoptCat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = adoptNameDraft.trim() || 'Miu Xinh';
    const newCat: OfficeCatProfile = {
      ownerUserId: currentUserId,
      ownerNickname: currentNickname,
      catName: trimmed,
      breedId: adoptBreed,
      activity: 'walking',
      fullness: 75,
      happiness: 85,
      petCount: 1,
      placedYardItems: [],
      updatedAt: Date.now(),
    };
    onAdoptOrUpdateMyCat(
      newCat,
      `🐾 ${currentNickname} vừa nhận nuôi bé mèo "${trimmed}" ngay trong văn phòng!`
    );
    setCatSubTab('my_cat');
    triggerCatReaction('🎉 Meow~ Chào chủ mới!', 'adopt');
    setCatNotice(`🎉 Nhận nuôi thành công bé "${trimmed}"!`);
  };

  const handleFeedMyCat = (item: CatShopItem) => {
    if (!myCat) return;
    const count = myCatInventory[item.id] || 0;
    if (count <= 0) {
      setCatNotice(`⚠️ Đã hết "${item.name}". Hãy vào Cửa hàng hoặc Xin quà nhé!`);
      return;
    }
    const nextInv = { ...myCatInventory, [item.id]: Math.max(0, count - 1) };
    if (nextInv[item.id] === 0) delete nextInv[item.id];
    onUpdateMyCatInventory(nextInv);

    const updatedCat: OfficeCatProfile = {
      ...myCat,
      fullness: Math.min(100, myCat.fullness + item.fullnessBoost),
      happiness: Math.min(100, myCat.happiness + item.happinessBoost),
      activity: 'playing',
      updatedAt: Date.now(),
    };
    onAdoptOrUpdateMyCat(updatedCat);
    setShowFeedPicker(false);
    triggerCatReaction(`😋 Mlem mlem~ +${item.fullnessBoost}% No!`, 'eat');
    setCatNotice(`🐟 Đã cho ${myCat.catName} ăn 1x ${item.name}!`);
  };

  const handlePetMyCat = () => {
    if (!myCat) return;
    const nextActs: CatActivity[] = ['walking', 'playing', 'sleeping'];
    const pickedAct = nextActs[(myCat.petCount + 1) % nextActs.length];
    const updatedCat: OfficeCatProfile = {
      ...myCat,
      happiness: Math.min(100, myCat.happiness + 12),
      petCount: myCat.petCount + 1,
      activity: pickedAct,
      updatedAt: Date.now(),
    };
    onAdoptOrUpdateMyCat(updatedCat);
    triggerCatReaction('💕 Meow~ Gừ gừ~', 'happy');
    setCatNotice(`🤚 Đã vuốt ve ${myCat.catName} (+12% Vui)!`);
  };

  const handlePlayWithMyCat = () => {
    if (!myCat) return;
    const updatedCat: OfficeCatProfile = {
      ...myCat,
      happiness: Math.min(100, myCat.happiness + 18),
      fullness: Math.max(10, myCat.fullness - 4),
      activity: 'playing',
      updatedAt: Date.now(),
    };
    onAdoptOrUpdateMyCat(updatedCat);
    triggerCatReaction('🧶 Miu-miu! Vui quá~', 'play');
    setCatNotice(`🧶 Chơi đùa cùng ${myCat.catName} (+18% Vui)!`);
  };

  const handleConfirmBuyShopItem = () => {
    if (!pendingShopBuyItem) return;
    const item = pendingShopBuyItem;
    if (item.isPremium && item.priceVnd && item.priceVnd > 0) {
      if (walletBalanceVnd < item.priceVnd) {
        setCatNotice(`⚠️ Cần ${formatVnd(item.priceVnd)} (Ví: ${formatVnd(walletBalanceVnd)}).`);
        setPendingShopBuyItem(null);
        return;
      }
      const ok = onSpendMoney(item.priceVnd);
      if (!ok) return;
    } else {
      if (meritCount < item.priceMerit) {
        setCatNotice(`⚠️ Cần ${item.priceMerit} Công đức (hiện có ${meritCount}).`);
        setPendingShopBuyItem(null);
        return;
      }
      const ok = onSpendMerit(item.priceMerit);
      if (!ok) return;
    }

    const currentQty = myCatInventory[item.id] || 0;
    const nextInv = { ...myCatInventory, [item.id]: currentQty + 1 };
    onUpdateMyCatInventory(nextInv);
    setPendingShopBuyItem(null);
    playCatMeowSound('adopt');
    setCatNotice(`✅ Đã mua 1x ${item.icon} ${item.name} vào Túi đồ!`);
  };

  const handleSubmitGiftRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myCat) return;
    const item = CAT_SHOP_ITEMS.find((i) => i.id === requestItemId) || CAT_SHOP_ITEMS[0];
    const targetMember = members.find((m) => m.userId === requestTargetUserId);
    const newReq: CatGiftRequest = {
      id: `gift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      requesterUserId: currentUserId,
      requesterNickname: currentNickname,
      catName: myCat.catName,
      itemId: item.id,
      targetUserId: targetMember ? targetMember.userId : null,
      targetNickname: targetMember ? targetMember.nickname : null,
      status: 'open',
      createdAt: Date.now(),
    };
    onCreateGiftRequest(newReq);
    setShowRequestGiftForm(false);
    setCatSubTab('gifts');
    playCatMeowSound('happy');
    setCatNotice(
      targetMember
        ? `🎁 Đã gửi yêu cầu xin "${item.name}" tới ${targetMember.nickname}!`
        : `🎁 Đã đăng xin "${item.name}" vào mục Quà tặng!`
    );
  };

  const handleTogglePlaceYardItem = (item: CatShopItem) => {
    if (!myCat) return;
    const alreadyPlaced = myCat.placedYardItems.includes(item.id);
    if (alreadyPlaced) {
      const nextPlaced = myCat.placedYardItems.filter((id) => id !== item.id);
      const nextInv = {
        ...myCatInventory,
        [item.id]: (myCatInventory[item.id] || 0) + 1,
      };
      onUpdateMyCatInventory(nextInv);
      onAdoptOrUpdateMyCat({
        ...myCat,
        placedYardItems: nextPlaced,
        updatedAt: Date.now(),
      });
      setCatNotice(`🎒 Đã cất ${item.icon} ${item.name} vào Túi đồ.`);
    } else {
      const count = myCatInventory[item.id] || 0;
      if (count <= 0) return;
      const nextInv = { ...myCatInventory, [item.id]: Math.max(0, count - 1) };
      if (nextInv[item.id] === 0) delete nextInv[item.id];
      onUpdateMyCatInventory(nextInv);
      onAdoptOrUpdateMyCat({
        ...myCat,
        placedYardItems: [...myCat.placedYardItems, item.id],
        activity: item.category === 'bed' ? 'sleeping' : 'playing',
        updatedAt: Date.now(),
      });
      playCatMeowSound('play');
      setCatNotice(`🏡 Đã đặt ${item.icon} ${item.name} ra sàn văn phòng cho mèo dùng!`);
    }
  };

  if (!isOpen) return null;

  const otherMembers = members.filter((m) => m.userId !== currentUserId);
  const openGiftRequestsCount = giftRequests.filter((r) => r.status === 'open').length;

  // ============================================================================
  // LUỒNG 1: SẢNH CHỌN GAME DỄ THƯƠNG (CHỈ GIỮ LẠI 3 GAME: NUÔI MÈO • PHI TIÊU • VÒNG QUAY)
  // ============================================================================
  if (activeView === 'lobby') {
    return (
      <div
        data-testid="entertainment-room-overlay"
        className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-sm"
      >
        <div className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border-4 border-[#e8dfd1] bg-[#fdf8f0] text-[#3d2b1f] shadow-2xl">
          {/* HEADER GỌN */}
          <div className="flex items-center justify-between gap-2 border-b border-[#ece2d0] bg-[#fbf4e8] px-3.5 py-2.5 sm:px-5">
            <h2 className="text-base sm:text-lg font-black tracking-tight text-[#3d2b1f]">
              🎮 Chọn game
            </h2>

            <div className="flex items-center gap-0.5 select-none">
              <span className="text-base sm:text-xl font-black text-[#4a3326]">p</span>
              <CuteBlob color="#60a5fa" size="h-5 w-5" />
              <CuteBlob color="#f472b6" size="h-5 w-5" />
              <span className="text-base sm:text-xl font-black text-[#4a3326]">p party</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="lobby-sound-toggle-btn"
                onClick={onToggleSound}
                className="rounded-full border border-[#e2d6c3] bg-white hover:bg-[#f5ede0] p-1.5 text-[#4a3326] shadow-sm cursor-pointer"
                title={soundEnabled ? 'Tắt nhạc' : 'Bật nhạc'}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-amber-600" />
                ) : (
                  <VolumeX className="h-4 w-4 text-slate-400" />
                )}
              </button>

              <button
                type="button"
                data-testid="exit-game-room-btn"
                onClick={onExitGameRoom}
                className="inline-flex items-center gap-1 rounded-full border border-[#e2d6c3] bg-white hover:bg-rose-50 px-2.5 py-1 text-xs font-extrabold text-[#4a3326] shadow-sm cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Đóng</span>
              </button>
            </div>
          </div>

          {/* LƯỚI GAME GỌN GÀNG, ÍT CHỮ, HÌNH ẢNH NỔI BẬT */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GAME_CATALOG.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  data-testid={`lobby-game-${game.id}`}
                  onClick={() => {
                    setActiveView(game.playableId);
                    setCatNotice(null);
                  }}
                  className="group relative flex sm:flex-col items-center sm:items-stretch justify-between gap-3 sm:gap-0 overflow-hidden rounded-2xl border-2 border-[#e5dccb] bg-white p-2.5 text-left transition-all hover:border-amber-400 hover:ring-2 hover:ring-amber-300 shadow-sm active:scale-95 cursor-pointer"
                >
                  <div
                    className={`relative h-20 w-28 sm:h-28 sm:w-full shrink-0 overflow-hidden rounded-xl bg-gradient-to-br ${game.bgGradient} border border-black/5`}
                  >
                    {game.sceneRender()}
                    {game.badge && (
                      <span className="absolute top-1.5 right-1.5 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-black text-white shadow">
                        {game.badge}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 sm:pt-2 px-1">
                    <div className="text-sm font-black text-[#3d2b1f]">{game.title}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="rounded-md bg-[#f3ece0] px-2 py-0.5 text-[10px] font-bold text-[#7c6855]">
                        {game.playersText}
                      </span>
                      <span className="text-xs font-black text-amber-600">Chơi →</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LUỒNG 2A: GAME MỚI — NUÔI MÈO VĂN PHÒNG (SỐNG ĐỘNG • GỌN GÀNG • CLICK ĐỂ XỔ/ĐÓNG MENU)
  // ============================================================================
  if (activeView === 'office_cat') {
    const myFoodItems = CAT_SHOP_ITEMS.filter(
      (item) => item.category === 'food' && (myCatInventory[item.id] || 0) > 0
    );
    const myBagItems = CAT_SHOP_ITEMS.filter(
      (item) =>
        (myCatInventory[item.id] || 0) > 0 ||
        (myCat && myCat.placedYardItems.includes(item.id))
    );

    return (
      <div
        data-testid="entertainment-room-overlay"
        className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm"
      >
        <div className="relative flex max-h-[90dvh] w-full max-w-[400px] flex-col overflow-hidden rounded-[28px] border-4 border-amber-200 bg-[#fffaf2] text-[#3d2b1f] shadow-2xl">
          {/* THANH ĐẦU GỌN 1 DÒNG */}
          <div className="flex items-center justify-between gap-1 border-b border-amber-200/70 bg-gradient-to-r from-amber-100 via-orange-50 to-rose-100 px-2.5 py-2">
            <button
              type="button"
              data-testid="back-to-game-lobby-btn"
              onClick={() => setActiveView('lobby')}
              className="inline-flex items-center gap-1 rounded-xl bg-white hover:bg-amber-50 border border-amber-300 px-2.5 py-1 text-xs font-black text-[#3d2b1f] shadow-sm cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Game</span>
            </button>

            <div className="flex items-center gap-1">
              <div
                data-testid="cat-merit-balance-pill"
                className="inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2.5 py-1 text-[11px] font-black text-slate-950 shadow-sm"
                title="Tiền công đức tích từ Phòng Tịnh Tâm"
              >
                <Sparkles className="h-3 w-3" />
                <span>{meritCount} Công đức</span>
              </div>

              <button
                type="button"
                onClick={onToggleSound}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold cursor-pointer ${
                  soundEnabled
                    ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                    : 'border-[#e2d6c3] bg-white text-[#7c6855]'
                }`}
                title="Bật/tắt nhạc nền nhẹ nhàng"
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Nhạc</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                    <span>Tắt</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="exit-game-room-btn"
                onClick={onExitGameRoom}
                className="rounded-full border border-[#e2d6c3] bg-white hover:bg-rose-50 p-1 text-[#4a3326] cursor-pointer"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* THANH 4 TAB GỌN GÀNG */}
          {myCat && (
            <div className="grid grid-cols-4 gap-1 border-b border-amber-200/60 bg-[#f9f1e4] px-2 py-1.5">
              <button
                type="button"
                data-testid="cat-tab-my-cat"
                onClick={() => setCatSubTab('my_cat')}
                className={`rounded-xl py-1.5 text-[11px] font-black transition-all cursor-pointer ${
                  catSubTab === 'my_cat'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-[#6e5a47] hover:bg-white/60'
                }`}
              >
                🐾 Mèo
              </button>

              <button
                type="button"
                data-testid="cat-tab-shop"
                onClick={() => setCatSubTab('shop')}
                className={`rounded-xl py-1.5 text-[11px] font-black transition-all cursor-pointer ${
                  catSubTab === 'shop'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-[#6e5a47] hover:bg-white/60'
                }`}
              >
                🛒 Cửa hàng
              </button>

              <button
                type="button"
                data-testid="cat-tab-gifts"
                onClick={() => setCatSubTab('gifts')}
                className={`relative rounded-xl py-1.5 text-[11px] font-black transition-all cursor-pointer ${
                  catSubTab === 'gifts'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-[#6e5a47] hover:bg-white/60'
                }`}
              >
                🎁 Quà tặng
                {openGiftRequestsCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-rose-500 px-1.5 text-[9px] font-black text-white">
                    {openGiftRequestsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                data-testid="cat-tab-bag"
                onClick={() => setCatSubTab('bag')}
                className={`rounded-xl py-1.5 text-[11px] font-black transition-all cursor-pointer ${
                  catSubTab === 'bag'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-[#6e5a47] hover:bg-white/60'
                }`}
              >
                🎒 Túi đồ
              </button>
            </div>
          )}

          {/* Thông báo ngắn 1 dòng */}
          {catNotice && (
            <div
              data-testid="cat-action-notice"
              className="border-b border-emerald-200 bg-emerald-100 px-3 py-1.5 text-center text-[11px] font-bold text-emerald-950"
            >
              {catNotice}
            </div>
          )}

          {/* NỘI DUNG CHÍNH */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* LẦN ĐẦU VÀO GAME -> CHỌN MÈO & ĐẶT TÊN */}
            {!myCat ? (
              <form
                onSubmit={handleAdoptCat}
                data-testid="cat-adopt-form"
                className="space-y-3"
              >
                <div className="text-center">
                  <h3 className="text-base font-black text-[#3d2b1f]">
                    🐾 Nhận Nuôi Bé Mèo Của Bạn
                  </h3>
                  <p className="text-[11px] text-[#7c6855]">
                    Chọn màu lông và đặt tên. Bé mèo sẽ đi dạo ngay trong văn phòng!
                  </p>
                </div>

                {/* Sân khấu xem trước mèo sống động */}
                <div
                  onClick={() => playCatMeowSound('happy')}
                  className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-amber-200 bg-gradient-to-b from-sky-100 via-amber-50 to-emerald-100 py-5 cursor-pointer"
                >
                  <span className="absolute top-2 left-3 text-base animate-pulse">☀️</span>
                  <span className="absolute top-2 right-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black text-rose-500 shadow-sm">
                    🔊 Chạm nghe thử Meow~
                  </span>
                  <div className="animate-bounce">
                    <CuteCatAvatar
                      breedId={adoptBreed}
                      activity="playing"
                      sizeClass="h-24 w-24"
                    />
                  </div>
                  <span className="mt-2 text-sm font-black text-[#3d2b1f]">
                    {CAT_BREEDS.find((b) => b.id === adoptBreed)?.name}
                  </span>
                  <span className="text-[10px] font-bold text-[#7c6855]">
                    {CAT_BREEDS.find((b) => b.id === adoptBreed)?.badge}
                  </span>
                </div>

                {/* Chọn 5 giống mèo */}
                <div className="grid grid-cols-5 gap-1.5">
                  {CAT_BREEDS.map((b) => {
                    const selected = adoptBreed === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        data-testid={`select-breed-${b.id}`}
                        onClick={() => {
                          setAdoptBreed(b.id);
                          playCatMeowSound('happy');
                        }}
                        className={`flex flex-col items-center rounded-xl border-2 p-1.5 transition-all cursor-pointer ${
                          selected
                            ? 'border-amber-500 bg-amber-100 shadow-sm scale-105'
                            : 'border-[#e5dccb] bg-white hover:bg-amber-50/50'
                        }`}
                      >
                        <CuteCatAvatar
                          breedId={b.id}
                          activity="walking"
                          sizeClass="h-9 w-9"
                        />
                        <span className="mt-1 text-[9px] font-extrabold text-center leading-tight text-[#3d2b1f]">
                          {b.name.replace('Mèo ', '')}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <input
                  id="cat-name-input"
                  data-testid="adopt-cat-name-input"
                  type="text"
                  maxLength={20}
                  value={adoptNameDraft}
                  onChange={(e) => setAdoptNameDraft(e.target.value)}
                  placeholder="Đặt tên cho bé mèo..."
                  className="w-full rounded-xl border-2 border-[#decab4] bg-white px-3 py-2 text-xs font-bold text-[#3d2b1f] outline-none focus:border-amber-500"
                />

                <button
                  type="submit"
                  data-testid="confirm-adopt-cat-btn"
                  className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 py-2.5 text-xs font-black text-white shadow-lg cursor-pointer"
                >
                  🐾 Nhận nuôi bé mèo ngay
                </button>
              </form>
            ) : (
              <>
                {/* ==================== MỤC 1: THÚ CƯNG CỦA TÔI (SỞ HỮU NHIỀU BÉ, CHỈ 1 BÉ RA NGOÀI CHĂM SÓC) ==================== */}
                {catSubTab === 'my_cat' && (
                  <div data-testid="my-cat-panel" className="space-y-2.5">
                    {ownedPets.length > 1 && (
                      <div className="rounded-2xl border border-amber-200 bg-white/90 p-2 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-black text-[#5c4938]">
                          <span>🐾 Bộ sưu tập thú cưng ({ownedPets.length} bé)</span>
                          <span className="text-emerald-700">Chỉ cho 1 bé ra ngoài & chăm sóc</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {ownedPets.map((pet) => {
                            const pid = pet.petId || `pet-${pet.breedId}`;
                            const activePid = myCat.petId || `pet-${myCat.breedId}`;
                            const isOut = pid === activePid;
                            const isDog = pet.species === 'dog' || isDogBreed(pet.breedId);
                            return (
                              <button
                                key={pid}
                                type="button"
                                onClick={() => onSwitchActivePet(pid)}
                                className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-[10px] font-black transition cursor-pointer ${
                                  isOut
                                    ? 'border-emerald-500 bg-emerald-100 text-emerald-900 shadow-sm'
                                    : 'border-[#e2d6c3] bg-[#fdf8f0] text-[#5c4938] hover:border-amber-400'
                                }`}
                              >
                                <span>{isDog ? '🐶' : '🐱'}</span>
                                <span>{pet.catName}</span>
                                <span className="opacity-75">
                                  {isOut ? '• Đang ra ngoài' : '• Cho ra ngoài'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* SÂN KHẤU BÉ MÈO SỐNG ĐỘNG (Chạm trực tiếp vào mèo để vuốt ve & nghe tiếng mèo kêu!) */}
                    <div
                      onClick={handlePetMyCat}
                      className="relative flex flex-col items-center justify-between overflow-hidden rounded-3xl border-2 border-amber-200 bg-gradient-to-b from-sky-100 via-amber-50 to-emerald-100 p-4 text-center shadow-inner min-h-[210px] cursor-pointer select-none"
                    >
                      {/* Trang trí góc phòng dễ thương */}
                      <div className="flex w-full items-center justify-between z-10">
                        <span
                          data-testid="my-cat-activity-badge"
                          className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-black text-emerald-700 shadow-sm"
                        >
                          {getActivityLabel(myCat.activity)}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black text-amber-700 shadow-sm">
                            🐟 {myCat.fullness}%
                          </span>
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black text-rose-600 shadow-sm">
                            💕 {myCat.happiness}%
                          </span>
                        </div>
                      </div>

                      {/* Bong bóng tiếng mèo kêu sinh động khi tương tác */}
                      {catReactionBubble && (
                        <div className="z-20 mt-1 rounded-2xl border-2 border-rose-300 bg-white px-3 py-1 text-xs font-black text-rose-600 shadow-md animate-bounce">
                          {catReactionBubble}
                        </div>
                      )}

                      {/* Nhân vật bé mèo lớn ở trung tâm */}
                      <div
                        key={catBounceKey}
                        className="my-2 transition-transform duration-300 hover:scale-105 active:scale-95"
                      >
                        <CuteCatAvatar
                          breedId={myCat.breedId}
                          activity={myCat.activity}
                          sizeClass="h-28 w-28"
                        />
                      </div>

                      {/* Tên bé mèo & Gợi ý chạm */}
                      <div className="z-10">
                        <h3
                          data-testid="my-cat-name-heading"
                          className="text-base font-black text-[#3d2b1f]"
                        >
                          {myCat.catName}
                        </h3>
                        <p className="text-[10px] font-bold text-[#7c6855]">
                          Chạm vào mèo để nghe tiếng kêu • Đã vuốt ve {myCat.petCount} lần
                        </p>
                      </div>
                    </div>

                    {/* 4 NÚT HÀNH ĐỘNG GỌN GÀNG (Click để xổ menu / Click lại để đóng) */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        data-testid="cat-feed-open-btn"
                        onClick={() => {
                          setShowFeedPicker((v) => !v);
                          setShowRequestGiftForm(false);
                        }}
                        className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 py-2 px-1 text-[11px] font-black transition-all cursor-pointer active:scale-95 ${
                          showFeedPicker
                            ? 'border-amber-500 bg-amber-400 text-slate-950 shadow'
                            : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-950'
                        }`}
                      >
                        <span className="text-base">🐟</span>
                        <span>Cho ăn</span>
                      </button>

                      <button
                        type="button"
                        data-testid="cat-pet-btn"
                        onClick={handlePetMyCat}
                        className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 py-2 px-1 text-[11px] font-black text-rose-950 transition-all cursor-pointer active:scale-95"
                      >
                        <span className="text-base">🤚</span>
                        <span>Vuốt ve</span>
                      </button>

                      <button
                        type="button"
                        data-testid="cat-play-btn"
                        onClick={handlePlayWithMyCat}
                        className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-sky-200 bg-sky-50 hover:bg-sky-100 py-2 px-1 text-[11px] font-black text-sky-950 transition-all cursor-pointer active:scale-95"
                      >
                        <span className="text-base">🧶</span>
                        <span>Chơi đùa</span>
                      </button>

                      <button
                        type="button"
                        data-testid="cat-request-gift-open-btn"
                        onClick={() => {
                          setShowRequestGiftForm((v) => !v);
                          setShowFeedPicker(false);
                        }}
                        className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 py-2 px-1 text-[11px] font-black transition-all cursor-pointer active:scale-95 ${
                          showRequestGiftForm
                            ? 'border-rose-500 bg-rose-500 text-white shadow'
                            : 'border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-950'
                        }`}
                      >
                        <span className="text-base">🎁</span>
                        <span>Xin quà</span>
                      </button>
                    </div>

                    {/* KHAY XỔ RA KHI BẤM "CHO ĂN" (Click nút Cho ăn hoặc ✕ để đóng) */}
                    {showFeedPicker && (
                      <div
                        data-testid="cat-feed-picker-box"
                        className="rounded-2xl border-2 border-amber-400 bg-white p-2.5 space-y-2 shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-[#3d2b1f]">
                            🎒 Chọn thức ăn trong Túi đồ:
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowFeedPicker(false)}
                            className="text-[11px] font-bold text-[#8c7865] cursor-pointer"
                          >
                            ✕ Đóng
                          </button>
                        </div>

                        {myFoodItems.length === 0 ? (
                          <div className="flex items-center justify-between rounded-xl bg-amber-50 p-2.5 text-xs">
                            <span className="font-bold text-amber-900">Túi đang hết thức ăn</span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowFeedPicker(false);
                                setCatSubTab('shop');
                              }}
                              className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-extrabold text-white cursor-pointer"
                            >
                              🛒 Mua ngay
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5">
                            {myFoodItems.map((food) => {
                              const qty = myCatInventory[food.id] || 0;
                              return (
                                <button
                                  key={food.id}
                                  type="button"
                                  data-testid={`feed-use-item-${food.id}`}
                                  onClick={() => handleFeedMyCat(food)}
                                  className="flex items-center justify-between rounded-xl border border-[#e5dccb] bg-amber-50/70 hover:bg-amber-100 p-2 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-lg">{food.icon}</span>
                                    <div>
                                      <div className="text-[11px] font-black text-[#3d2b1f]">
                                        {food.name}
                                      </div>
                                      <div className="text-[9px] font-bold text-emerald-700">
                                        +{food.fullnessBoost}% No
                                      </div>
                                    </div>
                                  </div>
                                  <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[9px] font-black text-white">
                                    x{qty}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* KHAY XỔ RA KHI BẤM "XIN QUÀ" (Click nút Xin quà hoặc ✕ để đóng) */}
                    {showRequestGiftForm && (
                      <form
                        onSubmit={handleSubmitGiftRequest}
                        data-testid="cat-request-gift-form"
                        className="rounded-2xl border-2 border-rose-300 bg-white p-3 space-y-2 shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-rose-900">
                            🎁 Nhờ đồng nghiệp tặng đồ:
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowRequestGiftForm(false)}
                            className="text-[11px] font-bold text-[#8c7865] cursor-pointer"
                          >
                            ✕ Đóng
                          </button>
                        </div>

                        <select
                          data-testid="gift-request-item-select"
                          value={requestItemId}
                          onChange={(e) => setRequestItemId(e.target.value)}
                          className="w-full rounded-xl border border-[#d8cbb8] bg-[#fdf8f0] px-2.5 py-1.5 text-xs font-bold text-[#3d2b1f] outline-none"
                        >
                          {CAT_SHOP_ITEMS.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.icon} {item.name}
                            </option>
                          ))}
                        </select>

                        <select
                          data-testid="gift-request-target-select"
                          value={requestTargetUserId}
                          onChange={(e) => setRequestTargetUserId(e.target.value)}
                          className="w-full rounded-xl border border-[#d8cbb8] bg-[#fdf8f0] px-2.5 py-1.5 text-xs font-bold text-[#3d2b1f] outline-none"
                        >
                          <option value="">📢 Đăng vào mục Quà tặng của phòng</option>
                          {otherMembers.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              👤 Gửi cho: {m.nickname}
                            </option>
                          ))}
                        </select>

                        <button
                          type="submit"
                          data-testid="submit-gift-request-btn"
                          className="w-full rounded-xl bg-rose-500 hover:bg-rose-400 py-1.5 text-xs font-black text-white shadow cursor-pointer"
                        >
                          📨 Gửi yêu cầu
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* ==================== MỤC 2: CỬA HÀNG THÚ CƯNG & ĐỒ DÙNG ==================== */}
                {catSubTab === 'shop' && (
                  <div data-testid="cat-shop-panel" className="space-y-3">
                    {/* Thanh số dư Ví Tiền & Công Đức */}
                    <div className="flex items-center justify-between rounded-2xl border border-[#e5dccb] bg-white px-3 py-1.5 text-[11px] font-black">
                      <span className="text-emerald-700">💰 Ví: {formatVnd(walletBalanceVnd)}</span>
                      <span className="text-amber-700">✨ Công đức: {meritCount}</span>
                    </div>

                    {/* MỤC MỞ KHÓA THÚ CƯNG MỚI (MỞ BÁN CHÓ - 500.000đ) */}
                    <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-sky-50 p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-indigo-950">
                            🐶 Thú cưng mới (Chó)
                          </div>
                          <div className="text-[10px] font-semibold text-indigo-700/80">
                            Sở hữu nhiều thú cưng • Chọn 1 bé ra ngoài chăm sóc
                          </div>
                        </div>
                        {!unlockedDogs ? (
                          <button
                            type="button"
                            onClick={() => {
                              const res = onUnlockDogs();
                              if (res.ok) {
                                setCatNotice('🎉 Đã mở khóa mục Chó! Bạn có thể mua các giống chó bên dưới.');
                              } else {
                                setCatNotice(`⚠️ ${res.error}`);
                              }
                            }}
                            className="shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-[11px] font-black text-white shadow cursor-pointer"
                          >
                            🔓 Mở khóa ({formatVnd(DOG_UNLOCK_FEE_VND)})
                          </button>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                            ✓ Đã mở khóa
                          </span>
                        )}
                      </div>

                      {unlockedDogs && (
                        <div className="space-y-2 pt-1 border-t border-indigo-200/70">
                          <input
                            type="text"
                            maxLength={20}
                            value={dogNameDraft}
                            onChange={(e) => setDogNameDraft(e.target.value)}
                            placeholder="Đặt tên bé chó (tùy chọn)..."
                            className="w-full rounded-xl border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-bold text-[#3d2b1f] outline-none focus:border-indigo-400"
                          />
                          <div className="grid grid-cols-2 gap-1.5">
                            {DOG_BREEDS.map((dog) => (
                              <div
                                key={dog.id}
                                className="flex items-center justify-between gap-1.5 rounded-xl border border-indigo-200 bg-white p-2"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-[11px] font-black text-[#3d2b1f]">
                                    🐶 {dog.name.replace('Chó ', '')}
                                  </div>
                                  <div className="text-[10px] font-black text-emerald-700">
                                    {formatVnd(dog.priceVnd || 0)}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = onBuyDogPet(dog.id, dogNameDraft);
                                    if (res.ok) {
                                      setDogNameDraft('');
                                      setCatNotice(
                                        `🐶 Đã mua ${dog.name}! Vào mục Thú cưng để cho bé ra ngoài.`
                                      );
                                    } else {
                                      setCatNotice(`⚠️ ${res.error}`);
                                    }
                                  }}
                                  className="shrink-0 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-2 py-1 text-[10px] font-black text-white cursor-pointer"
                                >
                                  Mua
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* HỘP XÁC NHẬN TRƯỚC KHI MUA ĐỒ DÙNG: Đồ thường (Công đức) / Đồ cao cấp (Tiền) */}
                    {pendingShopBuyItem && (() => {
                      const isPrem = Boolean(
                        pendingShopBuyItem.isPremium &&
                          pendingShopBuyItem.priceVnd &&
                          pendingShopBuyItem.priceVnd > 0
                      );
                      const canAfford = isPrem
                        ? walletBalanceVnd >= (pendingShopBuyItem.priceVnd || 0)
                        : meritCount >= pendingShopBuyItem.priceMerit;
                      const remainingText = isPrem
                        ? formatVnd(walletBalanceVnd - (pendingShopBuyItem.priceVnd || 0))
                        : `${meritCount - pendingShopBuyItem.priceMerit} Công đức`;
                      return (
                        <div
                          data-testid="shop-confirm-modal"
                          className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-3 space-y-2 shadow-lg"
                        >
                          <div className="text-xs font-black text-amber-950">
                            📋 Xác nhận mua {pendingShopBuyItem.icon} {pendingShopBuyItem.name}
                          </div>
                          <div className="rounded-xl bg-white p-2 border border-amber-200 space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-[#7c6855]">Giá:</span>
                              <strong data-testid="shop-confirm-price" className="text-amber-700">
                                {isPrem
                                  ? formatVnd(pendingShopBuyItem.priceVnd || 0)
                                  : `${pendingShopBuyItem.priceMerit} Công đức`}
                              </strong>
                            </div>
                            <div className="flex justify-between border-t border-amber-100 pt-1">
                              <span className="font-bold text-[#3d2b1f]">Số dư còn lại:</span>
                              <strong
                                data-testid="shop-confirm-remaining-balance"
                                className={
                                  canAfford
                                    ? 'text-emerald-700 font-black'
                                    : 'text-rose-600 font-black'
                                }
                              >
                                {remainingText}
                              </strong>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setPendingShopBuyItem(null)}
                              className="rounded-xl border border-[#d8cbb8] bg-white px-3 py-1 text-xs font-bold text-[#5c4938] cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              data-testid="shop-confirm-buy-btn"
                              disabled={!canAfford}
                              onClick={handleConfirmBuyShopItem}
                              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-black text-white shadow cursor-pointer ${
                                canAfford
                                  ? 'bg-emerald-600 hover:bg-emerald-500'
                                  : 'bg-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Xác nhận</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Lưới 2 cột đồ dùng: Bình thường (Công đức) & Cao cấp (Tiền) */}
                    <div className="grid grid-cols-2 gap-2">
                      {CAT_SHOP_ITEMS.map((item) => {
                        const owned = myCatInventory[item.id] || 0;
                        const isPrem = Boolean(item.isPremium && item.priceVnd && item.priceVnd > 0);
                        return (
                          <div
                            key={item.id}
                            className={`flex flex-col justify-between rounded-2xl border-2 p-2.5 shadow-sm ${
                              isPrem
                                ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/70 to-amber-50/70'
                                : 'border-[#e5dccb] bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl">
                                {item.icon}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="truncate text-xs font-black text-[#3d2b1f]">
                                    {item.name}
                                  </span>
                                </div>
                                <div className="text-[10px] font-bold text-[#7c6855]">
                                  {isPrem && (
                                    <span className="mr-1 rounded bg-emerald-600 px-1 text-[8px] font-black text-white">
                                      CAO CẤP
                                    </span>
                                  )}
                                  {item.category === 'food'
                                    ? `+${item.fullnessBoost}% No`
                                    : item.category === 'bed'
                                      ? 'Đệm ngủ'
                                      : 'Đồ chơi'}
                                  {owned > 0 ? ` • Có ${owned}` : ''}
                                </div>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between border-t border-[#f3ece0] pt-1.5">
                              <span
                                className={`text-[11px] font-black ${
                                  isPrem ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {isPrem ? `💰 ${formatVnd(item.priceVnd || 0)}` : `✨ ${item.priceMerit}`}
                              </span>
                              <button
                                type="button"
                                data-testid={`shop-buy-${item.id}`}
                                onClick={() => setPendingShopBuyItem(item)}
                                className={`rounded-lg px-2.5 py-0.5 text-[11px] font-black cursor-pointer ${
                                  isPrem
                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                                }`}
                              >
                                Mua
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ==================== MỤC 3: QUÀ TẶNG ==================== */}
                {catSubTab === 'gifts' && (
                  <div data-testid="cat-gifts-panel" className="space-y-2.5">
                    {pendingFulfillRequest && (
                      <div
                        data-testid="gift-confirm-modal"
                        className="rounded-2xl border-2 border-rose-500 bg-rose-50 p-3 space-y-2 shadow-lg"
                      >
                        <div className="text-xs font-black text-rose-950">
                          💝 Tặng 1x{' '}
                          {
                            CAT_SHOP_ITEMS.find(
                              (i) => i.id === pendingFulfillRequest.itemId
                            )?.name
                          }{' '}
                          cho mèo "{pendingFulfillRequest.catName}" ({pendingFulfillRequest.requesterNickname})?
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPendingFulfillRequest(null)}
                            className="rounded-xl border border-[#d8cbb8] bg-white px-3 py-1 text-xs font-bold text-[#5c4938] cursor-pointer"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            data-testid="gift-confirm-send-btn"
                            onClick={() => {
                              onFulfillGiftRequest(pendingFulfillRequest.id);
                              setPendingFulfillRequest(null);
                              playCatMeowSound('adopt');
                              setCatNotice(`💝 Đã tặng quà thành công! Yêu cầu đã tự đóng.`);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-rose-500 hover:bg-rose-400 px-3 py-1 text-xs font-black text-white shadow cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Xác nhận tặng</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {giftRequests.length === 0 ? (
                      <div className="rounded-2xl border-2 border-dashed border-[#e2d6c3] bg-white/70 p-5 text-center text-xs text-[#8c7865]">
                        Chưa có yêu cầu nào. Bấm <strong>🎁 Xin quà</strong> ở tab Mèo để nhờ đồng nghiệp tặng đồ nhé!
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {giftRequests.map((req) => {
                          const item =
                            CAT_SHOP_ITEMS.find((i) => i.id === req.itemId) ||
                            CAT_SHOP_ITEMS[0];
                          const myQty = myCatInventory[req.itemId] || 0;
                          const isOpenReq = req.status === 'open';
                          return (
                            <div
                              key={req.id}
                              data-testid={`gift-request-card-${req.id}`}
                              className={`flex items-center justify-between gap-2 rounded-2xl border-2 p-2.5 ${
                                isOpenReq
                                  ? 'border-[#e5dccb] bg-white'
                                  : 'border-emerald-200 bg-emerald-50/60 opacity-85'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xl shrink-0">{item.icon}</span>
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-black text-[#3d2b1f]">
                                    {req.requesterNickname} ({req.catName}) xin {item.name}
                                  </div>
                                  <div className="text-[10px] text-[#7c6855]">
                                    {req.targetNickname
                                      ? `Gửi @${req.targetNickname}`
                                      : 'Cả phòng'}{' '}
                                    • Túi bạn có: <strong>{myQty}</strong>
                                  </div>
                                </div>
                              </div>

                              {isOpenReq ? (
                                <button
                                  type="button"
                                  data-testid={`gift-give-btn-${req.id}`}
                                  disabled={myQty <= 0}
                                  onClick={() => setPendingFulfillRequest(req)}
                                  className={`rounded-xl px-2.5 py-1 text-xs font-black shrink-0 cursor-pointer ${
                                    myQty > 0
                                      ? 'bg-rose-500 hover:bg-rose-400 text-white shadow'
                                      : 'bg-[#ebe2d3] text-[#9c8976] cursor-not-allowed'
                                  }`}
                                >
                                  {myQty > 0 ? '💝 Tặng' : 'Hết'}
                                </button>
                              ) : (
                                <span
                                  data-testid={`gift-closed-badge-${req.id}`}
                                  className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white shrink-0"
                                >
                                  ✓ Đã tặng
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ==================== MỤC 4: TÚI ĐỒ & ĐẶT ĐỒ TRONG VĂN PHÒNG ==================== */}
                {catSubTab === 'bag' && (
                  <div data-testid="cat-bag-panel" className="space-y-2.5">
                    {myBagItems.length === 0 ? (
                      <div className="rounded-2xl border-2 border-dashed border-[#e2d6c3] bg-white/70 p-5 text-center text-xs text-[#8c7865]">
                        Túi đồ trống. Hãy ghé <strong>🛒 Cửa hàng</strong> hoặc <strong>🎁 Quà tặng</strong> nhé!
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {myBagItems.map((item) => {
                          const qty = myCatInventory[item.id] || 0;
                          const isPlaced = myCat.placedYardItems.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              className="flex flex-col justify-between gap-2 rounded-2xl border-2 border-[#e5dccb] bg-white p-2.5 shadow-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{item.icon}</span>
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-black text-[#3d2b1f]">
                                    {item.name}
                                  </div>
                                  <div className="text-[10px] font-bold text-[#7c6855]">
                                    Số lượng: x{qty}
                                  </div>
                                </div>
                              </div>

                              {item.category === 'food' ? (
                                <button
                                  type="button"
                                  onClick={() => handleFeedMyCat(item)}
                                  className="w-full rounded-xl bg-amber-400 hover:bg-amber-300 py-1 text-[11px] font-black text-slate-950 cursor-pointer"
                                >
                                  🐟 Cho ăn
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  data-testid={`bag-place-yard-${item.id}`}
                                  onClick={() => handleTogglePlaceYardItem(item)}
                                  className={`w-full rounded-xl py-1 text-[11px] font-black cursor-pointer ${
                                    isPlaced
                                      ? 'bg-slate-200 text-slate-800'
                                      : 'bg-emerald-500 text-white shadow'
                                  }`}
                                >
                                  {isPlaced ? 'Thu về túi' : '🏡 Đặt trong phòng'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LUỒNG 2B: MÀN HÌNH CHƠI PHÓNG PHI TIÊU (KNIFE HIT) HOẶC VÒNG QUAY
  // ============================================================================
  return (
    <div
      data-testid="entertainment-room-overlay"
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-sm"
    >
      <div
        className={`relative flex w-full flex-col overflow-hidden rounded-3xl border border-teal-400/35 bg-[#041d24] text-slate-100 shadow-2xl transition-all ${
          activeView === 'puzzle'
            ? 'max-w-[96vw] md:max-w-4xl max-h-[92dvh]'
            : 'max-w-[380px] sm:max-w-[400px] max-h-[92dvh]'
        }`}
      >
        {/* Input file ảnh ẩn */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          data-testid="dart-photo-file-input"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleUploadTargetPhoto(file);
            }
          }}
        />

        {/* THANH ĐẦU GỌN 1 DÒNG: Nút "⬅ Chọn game" quay về Sảnh • Công cụ game • Đóng */}
        <div className="flex items-center justify-between gap-1 border-b border-white/10 bg-slate-950/85 px-2.5 py-2">
          <button
            type="button"
            data-testid="back-to-game-lobby-btn"
            onClick={() => setActiveView('lobby')}
            className="inline-flex items-center gap-1 rounded-xl bg-amber-400 hover:bg-amber-300 px-2.5 py-1 text-xs font-extrabold text-slate-950 shadow cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Chọn game</span>
          </button>

          <div className="flex items-center gap-1">
            {activeView === 'knife_hit' && (
              <>
                <button
                  type="button"
                  data-testid="toggle-photo-customizer-btn"
                  onClick={() => setShowPhotoPopover((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer ${
                    targetPhotoUrl || showPhotoPopover
                      ? 'border-amber-300 bg-amber-400/20 text-amber-200'
                      : 'border-white/15 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <Camera className="h-3.5 w-3.5 text-amber-300" />
                  <span>Ghép ảnh</span>
                </button>

                <button
                  type="button"
                  data-testid={gameMode === 'campaign' ? 'mode-pvp-btn' : 'mode-campaign-btn'}
                  onClick={() => setGameMode((m) => (m === 'campaign' ? 'pvp' : 'campaign'))}
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer ${
                    gameMode === 'pvp'
                      ? 'border-rose-400 bg-rose-500 text-white'
                      : 'border-white/15 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <Swords className="h-3.5 w-3.5" />
                  <span>{gameMode === 'pvp' ? 'Solo' : '1 Mình'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onToggleSound}
              className="rounded-xl bg-slate-800 hover:bg-slate-700 p-1.5 text-slate-300 cursor-pointer"
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-slate-500" />
              )}
            </button>

            <button
              type="button"
              data-testid="exit-game-room-btn"
              onClick={onExitGameRoom}
              className="rounded-xl bg-slate-800 hover:bg-rose-500/30 border border-white/15 p-1.5 text-slate-200 cursor-pointer"
              title="Đóng Phòng Giải Trí"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ==================== GAME 2: KNIFE HIT (PHÓNG PHI TIÊU CẮM GỖ XOAY) ==================== */}
        {activeView === 'knife_hit' && (
          <>
            <div className="flex items-center justify-between gap-1 bg-[#05252e] px-2.5 py-1.5 border-b border-teal-500/20">
              {gameMode === 'campaign' ? (
                <div className="flex items-center justify-between w-full gap-1">
                  <div className="flex items-center gap-1">
                    {KNIFE_STAGES.map((stg) => {
                      const active = currentStageNum === stg.stage;
                      return (
                        <button
                          key={stg.stage}
                          type="button"
                          data-testid={`dart-level-${stg.stage}`}
                          onClick={() => {
                            setCurrentStageNum(stg.stage);
                            setupStage(stg.stage, 'campaign', false);
                          }}
                          className={`rounded-lg px-2 py-0.5 text-[11px] font-extrabold transition-all cursor-pointer ${
                            active
                              ? 'bg-amber-400 text-slate-950 shadow'
                              : stg.stage <= unlockedStage
                                ? 'bg-teal-900/70 text-teal-200 hover:bg-teal-800'
                                : 'bg-slate-900/70 text-slate-400'
                          }`}
                        >
                          {stg.isBoss ? '⚔️5' : `S${stg.stage}`}
                        </button>
                      );
                    })}
                  </div>

                  <span className="text-[11px] font-bold text-amber-300 whitespace-nowrap">
                    🏆 Kỷ lục: {bestScore}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full gap-1.5">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {otherMembers.length > 0 ? (
                      otherMembers.map((m) => (
                        <button
                          key={m.userId}
                          type="button"
                          onClick={() => {
                            setSelectedOpponentId(m.userId);
                            setOpponentName(m.nickname);
                            setupStage(currentStageNum, 'pvp', true);
                          }}
                          className={`rounded-lg px-2 py-0.5 text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                            opponentName === m.nickname
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          vs {m.nickname}
                        </button>
                      ))
                    ) : (
                      <input
                        type="text"
                        value={opponentName}
                        onChange={(e) => setOpponentName(e.target.value)}
                        className="w-28 rounded-lg bg-slate-900 border border-white/15 px-2 py-0.5 text-[11px] text-white outline-none"
                        placeholder="Tên đối thủ..."
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    data-testid="invite-friend-dart-btn"
                    onClick={handleSendRoomChallenge}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-500 hover:bg-rose-400 px-2.5 py-0.5 text-[11px] font-bold text-white shrink-0 cursor-pointer"
                  >
                    <Users className="h-3 w-3" />
                    <span>Mời đấu</span>
                  </button>
                </div>
              )}
            </div>

            <div className="relative w-full aspect-[320/410] max-h-[68dvh] bg-[#041d24] flex items-center justify-center overflow-hidden">
              <canvas
                ref={canvasRef}
                data-testid="dartboard-canvas"
                width={320}
                height={420}
                onPointerDown={handleThrowKnife}
                className="w-full h-full object-contain cursor-pointer touch-none select-none"
              />

              {showPhotoPopover && (
                <div className="absolute inset-x-3 top-3 z-20 rounded-2xl border border-amber-400/50 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-300">
                      📸 Ghép ảnh người vào Khúc Gỗ
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPhotoPopover(false)}
                      className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                    >
                      Đóng ✕
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="dart-upload-photo-btn"
                      onClick={() => photoInputRef.current?.click()}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 py-2 px-3 text-xs font-extrabold text-slate-950 cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Chọn ảnh từ máy</span>
                    </button>

                    {targetPhotoUrl && (
                      <button
                        type="button"
                        data-testid="dart-clear-photo-btn"
                        onClick={handleClearTargetPhoto}
                        className="rounded-xl bg-rose-500/20 border border-rose-400/40 p-2 text-rose-300 cursor-pointer"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    data-testid="dart-target-name-input"
                    value={targetPersonName}
                    onChange={(e) => {
                      setTargetPersonName(e.target.value);
                      try {
                        window.localStorage.setItem(STORAGE_CUSTOM_NAME_KEY, e.target.value);
                      } catch {
                        // ignore
                      }
                    }}
                    placeholder="Tên trên khúc gỗ (VD: Deadline, Sếp...)"
                    className="w-full rounded-xl border border-white/15 bg-slate-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                  />

                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Cỡ ảnh:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPhotoCoverageMode('full')}
                        className={`rounded-lg px-2 py-0.5 font-bold cursor-pointer ${
                          photoCoverageMode === 'full'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        Tràn gỗ
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoCoverageMode('center')}
                        className={`rounded-lg px-2 py-0.5 font-bold cursor-pointer ${
                          photoCoverageMode === 'center'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        Tâm gỗ
                      </button>
                    </div>
                  </div>

                  {members.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-white/10">
                      {members.map((m) => (
                        <button
                          key={m.userId}
                          type="button"
                          data-testid={`target-member-${m.nickname}`}
                          onClick={() => handleSelectMemberAsTarget(m)}
                          className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 px-2 py-1 text-[11px] text-slate-200 cursor-pointer"
                        >
                          🎯 {m.nickname}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(stageState === 'failed' || stageState === 'pvp_over') && (
                <div
                  data-testid="dart-round-summary"
                  className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center backdrop-blur-md"
                >
                  {stageState === 'failed' ? (
                    <>
                      <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300 ring-2 ring-rose-400/50">
                        <Flame className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-extrabold text-white">
                        💥 Đụng Trúng Dao!
                      </h3>
                      <p className="mt-1 text-xs text-slate-300">
                        Điểm: <strong className="text-amber-400 text-sm">{score}</strong> dao • Stage{' '}
                        {currentStageNum}
                      </p>
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          data-testid="dart-retry-btn"
                          onClick={() => setupStage(currentStageNum, 'campaign', true)}
                          className="inline-flex items-center gap-1 rounded-xl bg-amber-400 hover:bg-amber-300 px-3.5 py-2 text-xs font-extrabold text-slate-950 shadow cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Chơi lại</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleShareMatchResult}
                          className="inline-flex items-center gap-1 rounded-xl bg-teal-500/25 border border-teal-400/40 px-3 py-2 text-xs font-bold text-teal-200 cursor-pointer"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Khoe điểm</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300 ring-2 ring-amber-400/50">
                        <Crown className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-extrabold text-white">
                        {pvpScores[0] > pvpScores[1]
                          ? `🏆 ${currentNickname} Thắng!`
                          : pvpScores[1] > pvpScores[0]
                            ? `🏆 ${opponentName} Thắng!`
                            : '🤝 Hòa Kịch Tính!'}
                      </h3>
                      <p className="mt-1 text-xs text-slate-300">
                        🔴 {currentNickname}: <strong className="text-rose-300">{pvpScores[0]}đ</strong> — 🔵{' '}
                        {opponentName}: <strong className="text-cyan-300">{pvpScores[1]}đ</strong>
                      </p>
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setupStage(currentStageNum, 'pvp', true)}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Đấu lại</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleShareMatchResult}
                          className="inline-flex items-center gap-1 rounded-xl bg-teal-500/25 border border-teal-400/40 px-3 py-2 text-xs font-bold text-teal-200 cursor-pointer"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Báo phòng</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 bg-slate-950/90 px-3 py-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setupStage(currentStageNum, gameMode, true)}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Chơi lại</span>
              </button>

              <span className="text-[11px] font-medium text-teal-200/80 truncate">
                {lastHitBanner || 'Chạm vào gỗ để phóng dao'}
              </span>

              <button
                type="button"
                onClick={handleShareMatchResult}
                className="inline-flex items-center gap-1 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 px-3 py-1.5 text-xs font-bold text-teal-200 shrink-0 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Khoe điểm</span>
              </button>
            </div>
          </>
        )}

        {/* ==================== GAME 3: VÒNG QUAY ==================== */}
        {activeView === 'wheel' && (
          <div className="flex flex-col items-center p-4 space-y-3 bg-[#fdf8f0] text-[#3d2b1f]">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full border-4 border-fuchsia-400 bg-gradient-to-br from-fuchsia-400 to-amber-300 shadow-xl ${
                spinningWheel ? 'animate-spin' : ''
              }`}
            >
              <Disc className="h-10 w-10 text-white" />
            </div>

            {wheelResult && (
              <div className="rounded-xl border-2 border-amber-400 bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-900">
                🎉 {wheelResult}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSpinWheel}
                disabled={spinningWheel}
                className="rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 px-4 py-2 text-xs font-extrabold text-white shadow cursor-pointer"
              >
                {spinningWheel ? 'Đang quay...' : '🎲 Quay ngay!'}
              </button>
              {wheelResult && (
                <button
                  type="button"
                  onClick={() =>
                    onBroadcastChallengeMessage(
                      `🎡 [VÒNG QUAY] ${currentNickname} quay trúng: "${wheelResult}"!`
                    )
                  }
                  className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-extrabold text-slate-950 cursor-pointer"
                >
                  📣 Báo phòng
                </button>
              )}
            </div>

            <textarea
              rows={4}
              value={wheelItemsText}
              onChange={(e) => setWheelItemsText(e.target.value)}
              className="w-full rounded-xl border-2 border-[#e2d6c3] bg-white p-2.5 text-xs font-medium text-[#3d2b1f] outline-none focus:border-fuchsia-400"
              placeholder="Mỗi dòng 1 mục..."
            />
          </div>
        )}

        {/* ==================== GAME 4: GHÉP TRANH CÙNG PHÒNG ==================== */}
        {activeView === 'puzzle' && (
          <div className="flex flex-col flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-[#fdf8f0] text-[#3d2b1f]">
            {/* Sub-tab điều hướng + tiến độ */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#efe6d5] p-1">
                <button
                  type="button"
                  onClick={() => setPuzzleSubTab('board')}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition cursor-pointer ${
                    puzzleSubTab === 'board'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-[#6e5a49] hover:text-[#3d2b1f]'
                  }`}
                >
                  🖼️ Ghép tranh ({placedCount}/{totalPuzzlePieces})
                </button>
                <button
                  type="button"
                  onClick={() => setPuzzleSubTab('custom')}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition cursor-pointer ${
                    puzzleSubTab === 'custom'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-[#6e5a49] hover:text-[#3d2b1f]'
                  }`}
                >
                  📤 Tự set tranh
                </button>
                <button
                  type="button"
                  onClick={() => setPuzzleSubTab('gallery')}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition cursor-pointer ${
                    puzzleSubTab === 'gallery'
                      ? 'bg-white text-amber-700 shadow-sm'
                      : 'text-[#6e5a49] hover:text-[#3d2b1f]'
                  }`}
                >
                  🏆 Bộ sưu tập ({roomPuzzleState.completedGallery.length})
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#6e5a49]">
                <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-700 max-w-[160px] truncate">
                  {currentPuzzleArtwork.title}
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                  {currentPuzzleArtwork.gridCols}×{currentPuzzleArtwork.gridRows}
                </span>
              </div>
            </div>

            {puzzleSubTab === 'board' && (
              <div className="space-y-3">
                {/* Thanh thông báo trạng thái đặt mảnh */}
                {puzzleFeedback && (
                  <div
                    className={`rounded-xl border px-3 py-2 text-xs font-bold flex items-center justify-between gap-2 ${
                      puzzleFeedback.type === 'ok'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : puzzleFeedback.type === 'warn'
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : 'border-rose-300 bg-rose-50 text-rose-800'
                    }`}
                  >
                    <span>{puzzleFeedback.text}</span>
                    <button
                      type="button"
                      onClick={() => setPuzzleFeedback(null)}
                      className="text-[10px] opacity-70 hover:opacity-100 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.25fr)_minmax(260px,1fr)] gap-3 items-start">
                  {/* Bảng ghép tranh sạch sẽ (KHÔNG để hình mờ bên dưới) */}
                  <div className="flex flex-col items-center">
                    <div
                      className="relative w-full max-w-[430px] aspect-square rounded-2xl border-4 border-[#d8cbb5] bg-[#faf5ea] shadow-md overflow-hidden select-none grid"
                      style={{
                        gridTemplateColumns: `repeat(${currentPuzzleArtwork.gridCols}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${currentPuzzleArtwork.gridRows}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from({ length: totalPuzzlePieces }, (_, cellIdx) => {
                        const cols = currentPuzzleArtwork.gridCols;
                        const rows = currentPuzzleArtwork.gridRows;
                        const placed = roomPuzzleState.placedPieces[cellIdx];
                        const col = cellIdx % cols;
                        const row = Math.floor(cellIdx / cols);
                        const isWrong = wrongCellIdx === cellIdx;
                        const canDropOrTap = !placed && selectedPuzzlePiece !== null;
                        const posX = cols > 1 ? (col / (cols - 1)) * 100 : 0;
                        const posY = rows > 1 ? (row / (rows - 1)) * 100 : 0;

                        return (
                          <button
                            key={cellIdx}
                            type="button"
                            onClick={() => {
                              if (!placed && selectedPuzzlePiece !== null) {
                                handleAttemptPlacePiece(selectedPuzzlePiece, cellIdx);
                              }
                            }}
                            onDragOver={(e) => {
                              if (!placed) e.preventDefault();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const raw = e.dataTransfer.getData('text/plain');
                              const pieceFromDrop =
                                draggedPuzzlePiece !== null
                                  ? draggedPuzzlePiece
                                  : raw !== ''
                                    ? Number(raw)
                                    : null;
                              if (pieceFromDrop !== null && !Number.isNaN(pieceFromDrop)) {
                                handleAttemptPlacePiece(pieceFromDrop, cellIdx);
                              }
                            }}
                            className={`group relative border border-[#dfd3be] transition-all overflow-hidden ${
                              placed
                                ? 'cursor-default'
                                : canDropOrTap
                                  ? 'cursor-pointer bg-white/80 hover:bg-indigo-100/70 ring-inset hover:ring-2 hover:ring-indigo-400'
                                  : 'cursor-default bg-white/60 hover:bg-white'
                            } ${isWrong ? 'bg-rose-500/35 ring-2 ring-inset ring-rose-500 animate-pulse' : ''}`}
                          >
                            {placed ? (
                              <>
                                <div
                                  className="h-full w-full"
                                  style={{
                                    backgroundImage: `url("${currentPuzzleArtwork.imageUrl}")`,
                                    backgroundSize: `${cols * 100}% ${rows * 100}%`,
                                    backgroundPosition: `${posX}% ${posY}%`,
                                  }}
                                />
                                <span
                                  title={`Ghép bởi ${placed.placedByNickname}`}
                                  className="pointer-events-none absolute bottom-0.5 left-0.5 max-w-[90%] truncate rounded-full bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  {placed.placedByNickname}
                                </span>
                              </>
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-[9px] font-black text-[#b8a88e]">
                                {totalPuzzlePieces <= 25 ? cellIdx + 1 : ''}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-2 text-center text-[11px] font-semibold text-[#7a6452]">
                      {isCurrentPuzzleComplete
                        ? '🎉 Cả phòng đã hoàn thành bức tranh này!'
                        : selectedPuzzlePiece !== null
                          ? `Đang chọn mảnh #${selectedPuzzlePiece + 1} — chạm vào ô trống trên tranh để đặt`
                          : 'Nhìn hình mẫu bên cạnh, chạm mảnh ở khay rồi chạm vào ô (hoặc kéo thả)'}
                    </p>
                  </div>

                  {/* Cột phải: Hình mẫu rõ nét + Khay mảnh ghép */}
                  <div className="space-y-2.5">
                    {/* Hình mẫu rõ nét (không để hình mờ trên bảng) */}
                    <div className="rounded-2xl border-2 border-[#e5dccb] bg-white p-2.5 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black text-[#3d2b1f]">
                          🖼️ Hình mẫu
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowLargeReference((v) => !v)}
                          className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                          {showLargeReference ? 'Thu nhỏ' : 'Phóng to'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLargeReference((v) => !v)}
                        className="block w-full overflow-hidden rounded-xl border border-black/10 cursor-pointer"
                        title="Bấm để phóng to / thu nhỏ hình mẫu"
                      >
                        <img
                          src={currentPuzzleArtwork.imageUrl}
                          alt={currentPuzzleArtwork.title}
                          className={`w-full object-cover transition-all ${
                            showLargeReference ? 'aspect-square' : 'h-24'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Khay mảnh ghép hoặc Thẻ hoàn thành */}
                    <div className="rounded-2xl border-2 border-[#e5dccb] bg-white p-3 shadow-sm">
                      {isCurrentPuzzleComplete ? (
                        <div className="space-y-2.5 text-center">
                          <div className="text-2xl">🏆</div>
                          <div className="text-sm font-black text-emerald-700">
                            Hoàn thành bức tranh!
                          </div>
                          <p className="text-[11px] text-[#6e5a49]">
                            Tranh đã được lưu vào <strong>Bộ sưu tập của phòng</strong>.
                          </p>
                          <div className="flex flex-wrap justify-center gap-1 pt-1">
                            {Array.from(
                              new Set(
                                Object.values(roomPuzzleState.placedPieces).map(
                                  (p) => p.placedByNickname,
                                ),
                              ),
                            ).map((name) => (
                              <span
                                key={name}
                                className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const currIdx = PUZZLE_ARTWORKS.findIndex(
                                (a) => a.id === currentPuzzleArtwork.id,
                              );
                              const nextArt =
                                PUZZLE_ARTWORKS[(currIdx + 1) % PUZZLE_ARTWORKS.length];
                              onSelectNextPuzzle(nextArt.id, {
                                gridCols: nextArt.gridCols,
                                gridRows: nextArt.gridRows,
                                customArtwork: null,
                              });
                              setSelectedPuzzlePiece(null);
                              setPuzzleFeedback({
                                type: 'ok',
                                text: `Đã mở bức mới: "${nextArt.title}"!`,
                              });
                            }}
                            className="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 py-2 text-xs font-black text-white shadow hover:brightness-105 active:scale-95 cursor-pointer"
                          >
                            🖼️ Chọn bức tiếp theo
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-[#3d2b1f]">
                              Khay mảnh ({unplacedPuzzlePieces.length})
                            </span>
                            {selectedPuzzlePiece !== null && (
                              <button
                                type="button"
                                onClick={() => setSelectedPuzzlePiece(null)}
                                className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                              >
                                Bỏ chọn
                              </button>
                            )}
                          </div>

                          <div
                            className={`grid gap-1.5 max-h-[250px] overflow-y-auto pr-0.5 ${
                              totalPuzzlePieces > 36
                                ? 'grid-cols-5'
                                : totalPuzzlePieces > 16
                                  ? 'grid-cols-4'
                                  : 'grid-cols-3'
                            }`}
                          >
                            {unplacedPuzzlePieces.map((pieceIdx) => {
                              const cols = currentPuzzleArtwork.gridCols;
                              const rows = currentPuzzleArtwork.gridRows;
                              const col = pieceIdx % cols;
                              const row = Math.floor(pieceIdx / cols);
                              const isSelected = selectedPuzzlePiece === pieceIdx;
                              const posX = cols > 1 ? (col / (cols - 1)) * 100 : 0;
                              const posY = rows > 1 ? (row / (rows - 1)) * 100 : 0;

                              return (
                                <button
                                  key={pieceIdx}
                                  type="button"
                                  draggable
                                  onDragStart={(e) => {
                                    setDraggedPuzzlePiece(pieceIdx);
                                    setSelectedPuzzlePiece(pieceIdx);
                                    e.dataTransfer.setData('text/plain', String(pieceIdx));
                                  }}
                                  onDragEnd={() => setDraggedPuzzlePiece(null)}
                                  onClick={() =>
                                    setSelectedPuzzlePiece((prev) =>
                                      prev === pieceIdx ? null : pieceIdx,
                                    )
                                  }
                                  className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all cursor-grab active:cursor-grabbing ${
                                    isSelected
                                      ? 'border-indigo-500 ring-2 ring-indigo-300 scale-105 shadow-md'
                                      : 'border-[#e5dccb] hover:border-indigo-300 hover:scale-[1.03]'
                                  }`}
                                  style={{
                                    backgroundImage: `url("${currentPuzzleArtwork.imageUrl}")`,
                                    backgroundSize: `${cols * 100}% ${rows * 100}%`,
                                    backgroundPosition: `${posX}% ${posY}%`,
                                  }}
                                  title={`Mảnh #${pieceIdx + 1} — chạm hoặc kéo vào tranh`}
                                >
                                  <span className="absolute top-0.5 left-0.5 rounded bg-black/50 px-1 text-[8px] font-bold text-white">
                                    #{pieceIdx + 1}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {puzzleSubTab === 'custom' && (
              /* TAB TỰ SET TRANH & CHIA KHUNG (AI TRONG NHÓM CŨNG SET ĐƯỢC, MAX 100 Ô) */
              <div className="rounded-2xl border-2 border-[#e5dccb] bg-white p-3.5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-[#3d2b1f]">
                      📤 Tự set tranh cho cả phòng
                    </h4>
                    <p className="text-[11px] text-[#7a6452]">
                      Mọi thành viên đều có thể tải hình lên và chia tối đa{' '}
                      <strong>{MAX_PUZZLE_PIECES} ô</strong> (ví dụ 10×10).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3 items-start">
                  {/* Xem trước ảnh tải lên */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative h-36 w-36 rounded-2xl border-2 border-dashed border-[#d6c7ae] bg-[#faf5ea] overflow-hidden flex items-center justify-center">
                      {customImageDataUrl ? (
                        <img
                          src={customImageDataUrl}
                          alt="Ảnh tự chọn"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="px-2 text-center text-[11px] font-semibold text-[#8c7763]">
                          Chưa chọn ảnh
                        </span>
                      )}
                      {/* Đường kẻ chia khung xem trước */}
                      {customImageDataUrl && (
                        <div
                          className="pointer-events-none absolute inset-0 grid"
                          style={{
                            gridTemplateColumns: `repeat(${customCols}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${customRows}, minmax(0, 1fr))`,
                          }}
                        >
                          {Array.from({ length: customCols * customRows }, (_, i) => (
                            <div key={i} className="border border-white/55" />
                          ))}
                        </div>
                      )}
                    </div>

                    <label className="w-full cursor-pointer rounded-xl bg-indigo-500 hover:bg-indigo-400 px-3 py-1.5 text-center text-xs font-black text-white shadow-sm active:scale-95">
                      📁 Chọn ảnh từ máy
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadCustomPuzzleImage}
                        className="hidden"
                      />
                    </label>
                    {customUploadError && (
                      <span className="text-[10px] font-bold text-rose-600 text-center">
                        {customUploadError}
                      </span>
                    )}
                  </div>

                  {/* Thiết lập tên & số khung */}
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-black text-[#5c4838] mb-1">
                        Tên bức tranh
                      </label>
                      <input
                        type="text"
                        value={customTitleDraft}
                        onChange={(e) => setCustomTitleDraft(e.target.value)}
                        placeholder={`Tranh của ${currentNickname}`}
                        maxLength={45}
                        className="w-full rounded-xl border-2 border-[#e5dccb] bg-[#fdfaf3] px-3 py-1.5 text-xs font-bold text-[#3d2b1f] outline-none focus:border-indigo-400"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-black text-[#5c4838]">
                          Chia số khung (tối đa {MAX_PUZZLE_PIECES} ô)
                        </label>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                          {customCols} × {customRows} = {customCols * customRows} ô
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {[
                          [3, 3],
                          [4, 4],
                          [5, 5],
                          [6, 6],
                          [8, 8],
                          [10, 10],
                        ].map(([c, r]) => {
                          const active = customCols === c && customRows === r;
                          return (
                            <button
                              key={`${c}x${r}`}
                              type="button"
                              onClick={() => {
                                setCustomCols(c);
                                setCustomRows(r);
                              }}
                              className={`rounded-lg px-2 py-1 text-[11px] font-black border transition cursor-pointer ${
                                active
                                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                  : 'border-[#e5dccb] bg-white text-[#5c4838] hover:border-indigo-300'
                              }`}
                            >
                              {c}×{r} ({c * r})
                            </button>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-[#7a6452]">
                            Số cột (2–10)
                          </span>
                          <input
                            type="number"
                            min={2}
                            max={10}
                            value={customCols}
                            onChange={(e) => {
                              const next = clampPuzzleGrid(Number(e.target.value), customRows);
                              setCustomCols(next.gridCols);
                              setCustomRows(next.gridRows);
                            }}
                            className="mt-0.5 w-full rounded-lg border border-[#e5dccb] px-2.5 py-1 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-[#7a6452]">
                            Số hàng (2–10)
                          </span>
                          <input
                            type="number"
                            min={2}
                            max={10}
                            value={customRows}
                            onChange={(e) => {
                              const next = clampPuzzleGrid(customCols, Number(e.target.value));
                              setCustomCols(next.gridCols);
                              setCustomRows(next.gridRows);
                            }}
                            className="mt-0.5 w-full rounded-lg border border-[#e5dccb] px-2.5 py-1 text-xs font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!customImageDataUrl}
                      onClick={() => {
                        if (!customImageDataUrl) return;
                        const { gridCols, gridRows } = clampPuzzleGrid(customCols, customRows);
                        const customId = `custom-${Date.now()}`;
                        const title =
                          customTitleDraft.trim() || `Tranh của ${currentNickname}`;
                        const newArtwork: PuzzleArtwork = {
                          id: customId,
                          title,
                          subtitle: `${gridCols}×${gridRows} (${gridCols * gridRows} ô)`,
                          gridCols,
                          gridRows,
                          imageUrl: customImageDataUrl,
                        };
                        onSelectNextPuzzle(customId, {
                          gridCols,
                          gridRows,
                          customArtwork: newArtwork,
                        });
                        setSelectedPuzzlePiece(null);
                        setPuzzleSubTab('board');
                        setPuzzleFeedback({
                          type: 'ok',
                          text: `${currentNickname} vừa đặt tranh mới "${title}" (${gridCols}×${gridRows} = ${gridCols * gridRows} ô) cho cả phòng!`,
                        });
                      }}
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 disabled:opacity-45 py-2 text-xs font-black text-white shadow hover:brightness-105 active:scale-95 cursor-pointer"
                    >
                      ✨ Áp dụng tranh này cho cả phòng
                    </button>
                  </div>
                </div>
              </div>
            )}

            {puzzleSubTab === 'gallery' && (
              /* TAB BỘ SƯU TẬP CỦA PHÒNG */
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#6e5a49] mb-2">
                    Tranh phòng đã hoàn thành ({roomPuzzleState.completedGallery.length})
                  </h4>
                  {roomPuzzleState.completedGallery.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-[#e5dccb] bg-white/70 p-6 text-center text-xs font-semibold text-[#7a6452]">
                      Chưa có bức tranh nào hoàn thành. Cả phòng hãy cùng ghép xong bức đầu tiên nhé!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {roomPuzzleState.completedGallery.map((item) => {
                        const art = PUZZLE_ARTWORKS.find((a) => a.id === item.artworkId);
                        const thumbUrl = item.imageUrl || art?.imageUrl;
                        return (
                          <div
                            key={`${item.artworkId}-${item.completedAt}`}
                            className="flex items-center gap-3 rounded-2xl border border-[#e5dccb] bg-white p-2.5 shadow-sm"
                          >
                            {thumbUrl && (
                              <img
                                src={thumbUrl}
                                alt={item.title}
                                className="h-16 w-16 shrink-0 rounded-xl object-cover border border-black/10"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-black text-[#3d2b1f]">
                                {item.title}
                              </div>
                              <div className="text-[10px] text-[#7a6452] mt-0.5">
                                {new Date(item.completedAt).toLocaleString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                })}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.contributors.map((name) => (
                                  <span
                                    key={name}
                                    className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#6e5a49] mb-2">
                    Chọn nhanh tranh mẫu cho phòng ({customCols}×{customRows} ={' '}
                    {customCols * customRows} ô)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PUZZLE_ARTWORKS.map((art) => {
                      const isCurrent = art.id === currentPuzzleArtwork.id;
                      return (
                        <button
                          key={art.id}
                          type="button"
                          onClick={() => {
                            onSelectNextPuzzle(art.id, {
                              gridCols: customCols,
                              gridRows: customRows,
                              customArtwork: null,
                            });
                            setSelectedPuzzlePiece(null);
                            setPuzzleSubTab('board');
                            setPuzzleFeedback({
                              type: 'ok',
                              text: `Cả phòng chuyển sang ghép bức "${art.title}" (${customCols}×${customRows})!`,
                            });
                          }}
                          className={`group flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left transition cursor-pointer ${
                            isCurrent
                              ? 'border-indigo-500 ring-2 ring-indigo-200'
                              : 'border-[#e5dccb] hover:border-indigo-300'
                          }`}
                        >
                          <img
                            src={art.imageUrl}
                            alt={art.title}
                            className="aspect-square w-full object-cover"
                          />
                          <div className="p-1.5">
                            <div className="truncate text-[11px] font-black text-[#3d2b1f]">
                              {art.title}
                            </div>
                            <div className="text-[9px] font-bold text-indigo-600">
                              {isCurrent ? 'Đang ghép' : 'Chọn bức này'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
