import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Lock,
  Sparkles,
  Hammer,
  Bomb,
} from 'lucide-react';
import type { RoomMember } from '../types/office';
import {
  playDartHitSound,
  playKnifeClangSound,
  playWoodShatterSound,
} from '../utils/zenSound';

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

type PlayableGameId = 'knife_hit' | 'whack_bug' | 'pass_bomb' | 'wheel';

interface GameCatalogItem {
  id: string;
  playableId?: PlayableGameId;
  title: string;
  playersText: string;
  badge?: string;
  locked?: boolean;
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
 * Danh sách các thẻ Game dễ thương phong cách Bloop Party trong Phòng Giải Trí
 */
const GAME_CATALOG: GameCatalogItem[] = [
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
    id: 'whack_bug',
    playableId: 'whack_bug',
    title: 'Đập Chuột Deadline',
    playersText: '1-2 người',
    badge: 'Chơi ngay',
    bgGradient: 'from-lime-200 via-emerald-100 to-teal-200',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="mt-4 h-6 w-14 rounded-full bg-amber-900/75 flex items-center justify-center">
          <CuteBlob
            color="#a855f7"
            size="h-9 w-9"
            className="-mt-6"
            expression="surprised"
          />
        </div>
        <span className="absolute top-2 right-6 text-xl -rotate-12 drop-shadow">
          🔨
        </span>
        <CuteBlob
          color="#4ade80"
          size="h-6 w-6"
          className="absolute bottom-2 left-4"
        />
      </div>
    ),
  },
  {
    id: 'pass_bomb',
    playableId: 'pass_bomb',
    title: 'Truyền Bom Hẹn Giờ',
    playersText: '1-4 người',
    badge: 'Party',
    bgGradient: 'from-amber-100 via-orange-200 to-rose-200',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center gap-2">
        <CuteBlob color="#f472b6" size="h-8 w-8" expression="surprised" />
        <span className="text-xl animate-bounce">💣</span>
        <CuteBlob color="#4ade80" size="h-7 w-7" />
      </div>
    ),
  },
  {
    id: 'wheel',
    playableId: 'wheel',
    title: 'Vòng Quay Trà Sữa',
    playersText: '1-8 người',
    badge: 'Party',
    bgGradient: 'from-fuchsia-200 via-pink-100 to-indigo-200',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center gap-1">
        <div className="h-12 w-12 rounded-full border-4 border-white bg-gradient-to-tr from-rose-400 via-amber-300 to-sky-400 shadow flex items-center justify-center">
          <span className="text-sm">🧋</span>
        </div>
        <CuteBlob color="#fbbf24" size="h-7 w-7" className="-ml-2 mt-4" />
      </div>
    ),
  },
  {
    id: 'big_fish',
    title: 'Cá Lớn Nuốt Cá Bé',
    playersText: '1-4 người',
    locked: true,
    bgGradient: 'from-sky-200 via-cyan-100 to-blue-200',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center gap-2">
        <CuteBlob color="#38bdf8" size="h-10 w-10" expression="surprised" />
        <CuteBlob color="#fb7185" size="h-6 w-6" />
        <CuteBlob color="#4ade80" size="h-7 w-7" />
      </div>
    ),
  },
  {
    id: 'boom_boss',
    title: 'Vua Đặt Boom',
    playersText: '2-4 người',
    locked: true,
    bgGradient: 'from-orange-200 via-amber-100 to-yellow-200',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center gap-1.5">
        <CuteBlob color="#ef4444" size="h-10 w-10" expression="angry" />
        <span className="text-lg">💥</span>
        <CuteBlob color="#a855f7" size="h-7 w-7" />
      </div>
    ),
  },
  {
    id: 'snow_roll',
    title: 'Lăn Cầu Tuyết',
    playersText: '2-4 người',
    locked: true,
    bgGradient: 'from-slate-100 via-sky-100 to-indigo-100',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center gap-2">
        <div className="h-11 w-11 rounded-full bg-white border-2 border-sky-200 shadow-inner flex items-center justify-center">
          <CuteBlob color="#60a5fa" size="h-6 w-6" />
        </div>
        <CuteBlob color="#f472b6" size="h-7 w-7" />
      </div>
    ),
  },
  {
    id: 'catch_chicken',
    title: 'Bắt Gà Văn Phòng',
    playersText: '1-4 người',
    locked: true,
    bgGradient: 'from-lime-200 via-green-100 to-emerald-200',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center gap-2">
        <span className="text-xl">🐔</span>
        <CuteBlob color="#38bdf8" size="h-8 w-8" />
        <span className="text-lg">🐥</span>
      </div>
    ),
  },
  {
    id: 'laser_dodge',
    title: 'Né Tia Laser',
    playersText: '1-4 người',
    locked: true,
    bgGradient: 'from-rose-200 via-amber-100 to-orange-200',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="h-0.5 w-full bg-rose-500 rotate-12 shadow" />
        <CuteBlob
          color="#f43f5e"
          size="h-8 w-8"
          className="absolute"
          expression="surprised"
        />
      </div>
    ),
  },
  {
    id: 'hide_light',
    title: 'Trốn Đèn Sếp Soi',
    playersText: '1-4 người',
    locked: true,
    bgGradient: 'from-slate-700 via-slate-800 to-amber-900',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-amber-200/90 flex items-center justify-center">
          <CuteBlob color="#fb7185" size="h-7 w-7" expression="surprised" />
        </div>
      </div>
    ),
  },
  {
    id: 'math_quiz',
    title: 'Đố Toán Tốc Độ',
    playersText: '1-4 người',
    locked: true,
    bgGradient: 'from-amber-200 via-yellow-100 to-orange-100',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center gap-2">
        <span className="rounded-lg bg-amber-700/20 px-2 py-0.5 text-xs font-black text-amber-900">
          1 + 1 = ?
        </span>
        <CuteBlob color="#a855f7" size="h-8 w-8" />
      </div>
    ),
  },
  {
    id: 'king_crown',
    title: 'Giành Vương Miện',
    playersText: '2-4 người',
    locked: true,
    bgGradient: 'from-yellow-200 via-amber-100 to-rose-100',
    sceneRender: () => (
      <div className="relative flex h-full w-full items-center justify-center gap-2">
        <CuteBlob color="#4ade80" size="h-9 w-9" expression="king" />
        <CuteBlob color="#38bdf8" size="h-7 w-7" />
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
}) => {
  // Mặc định khi bấm vào Phòng Giải Trí -> hiện Sảnh Danh Sách Game dễ thương (lobby)
  const [activeView, setActiveView] = useState<'lobby' | PlayableGameId>('lobby');
  const [lobbyNotice, setLobbyNotice] = useState<string | null>(null);

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

  // Mini-game 2: Đập Chuột Deadline (Whack-a-Bug)
  const [whackScore, setWhackScore] = useState<number>(0);
  const [whackTimeLeft, setWhackTimeLeft] = useState<number>(20);
  const [whackRunning, setWhackRunning] = useState<boolean>(false);
  const [activeMoleHole, setActiveMoleHole] = useState<number>(2);

  // Mini-game 3: Truyền Bom Hẹn Giờ (Pass the Bomb)
  const [bombHolderName, setBombHolderName] = useState<string>(currentNickname);
  const [bombTicking, setBombTicking] = useState<boolean>(false);
  const [bombExploded, setBombExploded] = useState<boolean>(false);

  // Mini-game 4: Vòng quay nhân phẩm
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
      setLobbyNotice(null);
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

  // Bộ đếm cho mini-game Đập Chuột Deadline
  useEffect(() => {
    if (!whackRunning || activeView !== 'whack_bug') return;
    const moleTimer = window.setInterval(() => {
      setActiveMoleHole(Math.floor(Math.random() * 9));
    }, 620);
    const clockTimer = window.setInterval(() => {
      setWhackTimeLeft((t) => {
        if (t <= 1) {
          setWhackRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      window.clearInterval(moleTimer);
      window.clearInterval(clockTimer);
    };
  }, [whackRunning, activeView]);

  // Bộ đếm cho mini-game Truyền Bom Hẹn Giờ
  useEffect(() => {
    if (!bombTicking || activeView !== 'pass_bomb') return;
    const timer = window.setTimeout(() => {
      setBombTicking(false);
      setBombExploded(true);
      if (soundEnabled) playWoodShatterSound();
    }, 4500 + Math.random() * 4000);
    return () => window.clearTimeout(timer);
  }, [bombTicking, activeView, soundEnabled]);

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

  if (!isOpen) return null;

  const otherMembers = members.filter((m) => m.userId !== currentUserId);

  // ============================================================================
  // LUỒNG 1: SẢNH CHỌN GAME DỄ THƯƠNG PHONG CÁCH BLOOP PARTY (Khi mới vào Phòng Giải Trí)
  // ============================================================================
  if (activeView === 'lobby') {
    return (
      <div
        data-testid="entertainment-room-overlay"
        className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-sm"
      >
        <div className="relative flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border-4 border-[#e8dfd1] bg-[#fdf8f0] text-[#3d2b1f] shadow-2xl">
          {/* HEADER PHONG CÁCH BLOOP PARTY */}
          <div className="flex items-center justify-between gap-2 border-b border-[#ece2d0] bg-[#fbf4e8] px-3.5 py-2.5 sm:px-6 sm:py-3.5">
            <div className="flex items-baseline gap-2">
              <h2 className="text-base sm:text-xl font-black tracking-tight text-[#3d2b1f]">
                Chọn game
              </h2>
              <span className="hidden sm:inline text-xs font-semibold text-[#8c7865]">
                {GAME_CATALOG.length} game giải trí văn phòng
              </span>
            </div>

            {/* Logo chữ nổi dễ thương ở giữa giống "bloop" */}
            <div className="flex items-center gap-0.5 select-none">
              <span className="text-lg sm:text-2xl font-black tracking-tight text-[#4a3326]">
                p
              </span>
              <CuteBlob color="#60a5fa" size="h-5 w-5 sm:h-6 sm:w-6" />
              <CuteBlob color="#f472b6" size="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-lg sm:text-2xl font-black tracking-tight text-[#4a3326]">
                p party
              </span>
            </div>

            {/* Cụm nút bên phải: Số người trong phòng • Âm thanh • Đóng */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e2d6c3] bg-white px-2.5 py-1 text-xs font-extrabold text-[#4a3326] shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                <span className="h-2.5 w-2.5 -ml-1 rounded-full bg-pink-400" />
                <span>{members.length} người</span>
              </div>

              <button
                type="button"
                onClick={onToggleSound}
                className="rounded-full border border-[#e2d6c3] bg-white hover:bg-[#f5ede0] p-1.5 text-[#4a3326] shadow-sm cursor-pointer"
                title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
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
                className="inline-flex items-center gap-1 rounded-full border border-[#e2d6c3] bg-white hover:bg-rose-50 px-3 py-1 text-xs font-extrabold text-[#4a3326] shadow-sm cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Đóng</span>
              </button>
            </div>
          </div>

          {/* Thông báo nhỏ khi bấm vào game sắp ra mắt */}
          {lobbyNotice && (
            <div className="bg-amber-100 border-b border-amber-200 px-4 py-1.5 text-center text-xs font-bold text-amber-900">
              {lobbyNotice}
            </div>
          )}

          {/* LƯỚI DANH SÁCH CÁC GAME DỄ THƯƠNG (2 cột trên điện thoại, 3-4 cột trên màn hình lớn) */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
              {/* Ô ĐẦU TIÊN: PARTY NGẪU NHIÊN (Giống ô P-A-R-T-Y viền xanh trong ảnh mẫu) */}
              <button
                type="button"
                onClick={() => {
                  const playableList: PlayableGameId[] = [
                    'knife_hit',
                    'whack_bug',
                    'pass_bomb',
                    'wheel',
                  ];
                  const pick =
                    playableList[Math.floor(Math.random() * playableList.length)];
                  setActiveView(pick);
                }}
                className="group relative flex flex-col justify-between rounded-2xl border-[3px] border-sky-400 bg-white p-2.5 text-left shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer min-h-[126px] sm:min-h-[142px]"
              >
                <div className="flex items-center gap-1">
                  {[
                    { ch: 'P', bg: 'bg-sky-400' },
                    { ch: 'A', bg: 'bg-pink-400' },
                    { ch: 'R', bg: 'bg-amber-400' },
                    { ch: 'T', bg: 'bg-emerald-400' },
                    { ch: 'Y', bg: 'bg-purple-400' },
                  ].map((item, i) => (
                    <span
                      key={i}
                      className={`${item.bg} inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-md text-[11px] sm:text-xs font-black text-white shadow-sm -rotate-3 group-hover:rotate-3 transition-transform`}
                    >
                      {item.ch}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-center py-1">
                  <CuteBlob color="#60a5fa" size="h-8 w-8" />
                  <CuteBlob color="#f472b6" size="h-9 w-9" className="-ml-2" />
                  <CuteBlob color="#4ade80" size="h-7 w-7" className="-ml-2" />
                </div>

                <div>
                  <div className="text-xs sm:text-sm font-black text-[#3d2b1f]">
                    Chơi Ngẫu Nhiên
                  </div>
                  <span className="mt-0.5 inline-block rounded-md bg-[#f3ece0] px-2 py-0.5 text-[10px] font-bold text-[#7c6855]">
                    1-4 người
                  </span>
                </div>
              </button>

              {/* CÁC THẺ GAME TRONG DANH SÁCH */}
              {GAME_CATALOG.map((game) => {
                const isPlayable = Boolean(game.playableId);
                return (
                  <button
                    key={game.id}
                    type="button"
                    data-testid={`lobby-game-${game.id}`}
                    onClick={() => {
                      if (game.playableId) {
                        setActiveView(game.playableId);
                        setLobbyNotice(null);
                      } else {
                        setLobbyNotice(
                          `✨ Game "${game.title}" đang được hoàn thiện và sẽ sớm mở khóa! Hãy thử Phóng Phi Tiêu, Đập Chuột, Truyền Bom hoặc Vòng Quay nhé!`
                        );
                      }
                    }}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 bg-white p-2 text-left transition-all active:scale-95 cursor-pointer min-h-[126px] sm:min-h-[142px] ${
                      isPlayable
                        ? 'border-[#e5dccb] hover:border-sky-400 hover:ring-2 hover:ring-sky-300 shadow-sm hover:shadow-md'
                        : 'border-[#ebe3d5] opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* Hình minh họa dễ thương ở nửa trên thẻ */}
                    <div
                      className={`relative h-16 sm:h-20 w-full overflow-hidden rounded-xl bg-gradient-to-br ${game.bgGradient} border border-black/5`}
                    >
                      {game.sceneRender()}

                      {/* Huy hiệu góc phải trên */}
                      {game.badge && (
                        <span className="absolute top-1.5 right-1.5 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-black text-white shadow">
                          {game.badge}
                        </span>
                      )}

                      {/* Ổ khóa cho các game Sắp ra mắt giống ảnh Bloop Party */}
                      {game.locked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/35 backdrop-blur-[1px]">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#7c6855] shadow">
                            <Lock className="h-4 w-4" />
                          </div>
                          <span className="absolute top-1.5 right-1.5 rounded-full bg-[#8c7865]/90 px-2 py-0.5 text-[9px] font-bold text-white">
                            Sắp ra mắt
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Tên game & Số người chơi ở nửa dưới thẻ */}
                    <div className="pt-1.5 px-0.5">
                      <div className="truncate text-xs sm:text-sm font-black text-[#3d2b1f]">
                        {game.title}
                      </div>
                      <span className="mt-0.5 inline-block rounded-md bg-[#f3ece0] px-2 py-0.5 text-[10px] font-bold text-[#7c6855]">
                        {game.playersText}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CHÂN TRANG GỌN */}
          <div className="border-t border-[#ece2d0] bg-[#fbf4e8] px-4 py-2 text-center text-[11px] font-bold text-[#7c6855]">
            <span className="text-emerald-600">{currentNickname}</span> đang chọn game • Chạm vào game bất kỳ để bắt đầu chơi hoặc mời bạn bè!
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LUỒNG 2: MÀN HÌNH CHƠI GAME CỤ THỂ (Gọn gàng 1 khung dọc chuẩn điện thoại, có nút "⬅ Chọn game")
  // ============================================================================
  return (
    <div
      data-testid="entertainment-room-overlay"
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-sm"
    >
      <div className="relative flex w-full max-w-[380px] sm:max-w-[400px] flex-col overflow-hidden rounded-3xl border border-teal-400/35 bg-[#041d24] text-slate-100 shadow-2xl">
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

        {/* ==================== GAME 1: KNIFE HIT (PHÓNG PHI TIÊU CẮM GỖ XOAY) ==================== */}
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

        {/* ==================== GAME 2: ĐẬP CHUỘT DEADLINE (WHACK-A-BUG) ==================== */}
        {activeView === 'whack_bug' && (
          <div className="flex flex-col items-center p-4 space-y-3 bg-[#fdf8f0] text-[#3d2b1f]">
            <div className="flex w-full items-center justify-between rounded-2xl bg-[#f3ece0] px-3.5 py-2">
              <span className="text-xs font-black text-emerald-700">
                🔨 Điểm: {whackScore}
              </span>
              <span className="text-xs font-black text-rose-600">
                ⏱️ Thời gian: {whackTimeLeft}s
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[300px] aspect-square p-2 rounded-2xl bg-lime-200/80 border-2 border-lime-400/50">
              {Array.from({ length: 9 }).map((_, idx) => {
                const isUp = whackRunning && activeMoleHole === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (!isUp) return;
                      if (soundEnabled) playDartHitSound(true);
                      setWhackScore((s) => s + 10);
                      setActiveMoleHole(-1);
                    }}
                    className="relative flex items-center justify-center rounded-2xl bg-amber-900/80 shadow-inner overflow-hidden cursor-pointer active:scale-90 transition-transform"
                  >
                    {isUp && (
                      <div className="flex flex-col items-center animate-bounce">
                        <CuteBlob
                          color="#a855f7"
                          size="h-11 w-11"
                          expression="surprised"
                        />
                        <span className="text-[9px] font-black text-white bg-rose-500 px-1.5 rounded-full -mt-1">
                          BUG!
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setWhackScore(0);
                  setWhackTimeLeft(20);
                  setWhackRunning(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-extrabold text-white shadow cursor-pointer"
              >
                <Hammer className="h-3.5 w-3.5" />
                <span>{whackRunning ? 'Chơi lại từ đầu' : 'Bắt đầu đập Bug (20s)'}</span>
              </button>

              {whackScore > 0 && !whackRunning && (
                <button
                  type="button"
                  onClick={() =>
                    onBroadcastChallengeMessage(
                      `🔨 [ĐẬP CHUỘT DEADLINE] ${currentNickname} vừa đập trúng ${whackScore} điểm Bug trong 20 giây!`
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-2 text-xs font-extrabold text-slate-950 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Khoe điểm</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ==================== GAME 3: TRUYỀN BOM HẸN GIỜ (PASS THE BOMB) ==================== */}
        {activeView === 'pass_bomb' && (
          <div className="flex flex-col items-center p-5 space-y-4 bg-[#fdf8f0] text-[#3d2b1f] text-center">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-amber-100 border-4 border-amber-300 shadow-inner">
              {bombExploded ? (
                <span className="text-5xl animate-bounce">💥</span>
              ) : (
                <span className={`text-5xl ${bombTicking ? 'animate-ping' : ''}`}>
                  💣
                </span>
              )}
            </div>

            <div>
              <h3 className="text-base font-black text-[#3d2b1f]">
                {bombExploded
                  ? `💥 BÙM! Bom nổ trên tay ${bombHolderName}!`
                  : bombTicking
                    ? `🔥 ${bombHolderName} đang cầm bom! Chuyền mau!`
                    : '💣 Truyền Bom Hẹn Giờ'}
              </h3>
              <p className="text-xs text-[#7c6855] mt-1">
                Bấm vào tên người khác để chuyền bom trước khi phát nổ!
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {(members.length > 0
                ? members.map((m) => m.nickname)
                : [currentNickname, 'Đồng nghiệp A', 'Đồng nghiệp B']
              ).map((name, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={!bombTicking}
                  onClick={() => {
                    if (soundEnabled) playDartHitSound(false);
                    setBombHolderName(name);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold border-2 transition-all cursor-pointer ${
                    bombHolderName === name
                      ? 'border-rose-500 bg-rose-500 text-white shadow'
                      : 'border-[#e2d6c3] bg-white text-[#3d2b1f] hover:border-sky-400'
                  }`}
                >
                  💣 Chuyền cho {name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setBombExploded(false);
                  setBombHolderName(currentNickname);
                  setBombTicking(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 px-4 py-2 text-xs font-extrabold text-white shadow cursor-pointer"
              >
                <Bomb className="h-3.5 w-3.5" />
                <span>{bombTicking ? 'Đang đếm ngược...' : 'Châm ngòi Bom mới!'}</span>
              </button>

              {bombExploded && (
                <button
                  type="button"
                  onClick={() =>
                    onBroadcastChallengeMessage(
                      `💣 [TRUYỀN BOM] Quả bom hẹn giờ vừa phát nổ BÙM trên tay "${bombHolderName}"!`
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-2 text-xs font-extrabold text-slate-950 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Báo phòng</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ==================== GAME 4: VÒNG QUAY TRÀ SỮA / NHÂN PHẨM ==================== */}
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
      </div>
    </div>
  );
};
