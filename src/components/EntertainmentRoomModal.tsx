import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Gamepad2,
  Target,
  Trophy,
  Users,
  Upload,
  Sparkles,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
  ArrowLeft,
  Camera,
  Trash2,
  Swords,
  Crown,
  Wind,
  Disc,
} from 'lucide-react';
import type { RoomMember } from '../types/office';
import { playDartHitSound } from '../utils/zenSound';

export interface DartLevelConfig {
  level: number;
  title: string;
  subtitle: string;
  dartsCount: number;
  targetScore: number;
  speedX: number;
  speedY: number;
  maxWind: number;
  boardScale: number;
}

export const DART_LEVELS: DartLevelConfig[] = [
  {
    level: 1,
    title: 'Level 1 • Tập Sự Văn Phòng',
    subtitle: 'Bia đứng yên, không gió. Hãy ngắm chuẩn hồng tâm!',
    dartsCount: 5,
    targetScore: 100,
    speedX: 0,
    speedY: 0,
    maxWind: 0,
    boardScale: 1.0,
  },
  {
    level: 2,
    title: 'Level 2 • Deadline Dí Sát',
    subtitle: 'Bia bắt đầu lắc ngang nhẹ, có gió thoảng qua.',
    dartsCount: 5,
    targetScore: 140,
    speedX: 1.1,
    speedY: 0,
    maxWind: 1.5,
    boardScale: 0.96,
  },
  {
    level: 3,
    title: 'Level 3 • Họp Khẩn Cấp',
    subtitle: 'Bia di chuyển nhanh hơn và gió đổi hướng mỗi lượt phóng.',
    dartsCount: 6,
    targetScore: 180,
    speedX: 1.85,
    speedY: 0.65,
    maxWind: 3.0,
    boardScale: 0.92,
  },
  {
    level: 4,
    title: 'Level 4 • Sếp Đang Nhìn',
    subtitle: 'Bia lượn hình số 8 liên tục, cần căn nhịp cực chuẩn!',
    dartsCount: 6,
    targetScore: 220,
    speedX: 2.4,
    speedY: 1.5,
    maxWind: 4.2,
    boardScale: 0.88,
  },
  {
    level: 5,
    title: 'Level 5 • Thánh Phóng Phi Tiêu',
    subtitle: 'Thử thách tối thượng: Bia biến tốc + Gió xoáy mạnh!',
    dartsCount: 7,
    targetScore: 260,
    speedX: 3.1,
    speedY: 2.1,
    maxWind: 5.5,
    boardScale: 0.84,
  },
];

interface LandedDart {
  id: string;
  // Tọa độ tương đối so với tâm bia (đơn vị bán kính bia = 1)
  relX: number;
  relY: number;
  score: number;
  label: string;
  playerIndex: 0 | 1;
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
const STORAGE_UNLOCKED_LEVEL_KEY = 'van_phong_ao_dart_unlocked_level';
const STORAGE_BEST_SCORE_KEY = 'van_phong_ao_dart_best_score';

export const EntertainmentRoomModal: React.FC<EntertainmentRoomModalProps> = ({
  isOpen,
  onExitGameRoom,
  currentUserId,
  currentNickname,
  members,
  soundEnabled,
  onToggleSound,
  onBroadcastChallengeMessage,
  activeChallengeBanner,
}) => {
  const [selectedGameTab, setSelectedGameTab] = useState<'darts' | 'wheel'>('darts');
  const [gameMode, setGameMode] = useState<'campaign' | 'pvp'>('campaign');
  const [currentLevelNum, setCurrentLevelNum] = useState<number>(1);
  const [unlockedLevel, setUnlockedLevel] = useState<number>(() => {
    try {
      return Math.max(1, Number(window.localStorage.getItem(STORAGE_UNLOCKED_LEVEL_KEY)) || 1);
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

  // Tùy chỉnh ghép ảnh người nào đó vào tâm bia phóng
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
  const [showPhotoCustomizer, setShowPhotoCustomizer] = useState<boolean>(false);
  const [photoUrlInput, setPhotoUrlInput] = useState<string>('');
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // Chế độ Solo cùng bạn bè (PvP)
  const [opponentName, setOpponentName] = useState<string>('Đối thủ');
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>('');
  const [activeTurnPlayer, setActiveTurnPlayer] = useState<0 | 1>(0);
  const [pvpScores, setPvpScores] = useState<[number, number]>([0, 0]);
  const [pvpDartsLeft, setPvpDartsLeft] = useState<[number, number]>([5, 5]);

  // Trạng thái ván đấu Phóng Phi Tiêu
  const levelConfig =
    DART_LEVELS.find((l) => l.level === currentLevelNum) || DART_LEVELS[0];
  const [score, setScore] = useState<number>(0);
  const [dartsRemaining, setDartsRemaining] = useState<number>(levelConfig.dartsCount);
  const [landedDarts, setLandedDarts] = useState<LandedDart[]>([]);
  const [windX, setWindX] = useState<number>(0);
  const [lastHitBanner, setLastHitBanner] = useState<string | null>(null);
  const [roundFinished, setRoundFinished] = useState<boolean>(false);

  // Vòng quay nhân phẩm (Mini-game phụ trong Phòng Giải Trí)
  const [wheelItemsText, setWheelItemsText] = useState<string>(
    'Bao trà sữa cả phòng 🧋\nĐược về sớm 15 phút 🏃\nHát 1 bài tặng cả phòng 🎤\nTrực nhật dọn bàn họp 🧹\nNhận tràng pháo tay 👏\nmiễn phạt 1 lần ✨'
  );
  const [spinningWheel, setSpinningWheel] = useState<boolean>(false);
  const [wheelResult, setWheelResult] = useState<string | null>(null);

  // Canvas & Animation refs cho Bia Phóng Phi Tiêu
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const aimPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const boardShakeRef = useRef<number>(0);
  const flyingDartRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    progress: number;
    playerIndex: 0 | 1;
  } | null>(null);

  // Tải ảnh HTMLImageElement mỗi khi targetPhotoUrl thay đổi
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

  // Khởi tạo đối thủ mặc định từ danh sách thành viên trong phòng
  useEffect(() => {
    const others = members.filter((m) => m.userId !== currentUserId);
    if (others.length > 0 && !selectedOpponentId) {
      setSelectedOpponentId(others[0].userId);
      setOpponentName(others[0].nickname);
    }
  }, [members, currentUserId, selectedOpponentId]);

  const rollWind = useCallback((maxW: number) => {
    if (maxW <= 0) {
      setWindX(0);
      return;
    }
    const w = Number(((Math.random() * 2 - 1) * maxW).toFixed(1));
    setWindX(w);
  }, []);

  const resetDartMatch = useCallback(
    (targetLvl = currentLevelNum, targetMode = gameMode) => {
      const cfg = DART_LEVELS.find((l) => l.level === targetLvl) || DART_LEVELS[0];
      setScore(0);
      setDartsRemaining(cfg.dartsCount);
      setLandedDarts([]);
      setLastHitBanner(null);
      setRoundFinished(false);
      setActiveTurnPlayer(0);
      setPvpScores([0, 0]);
      setPvpDartsLeft([5, 5]);
      rollWind(targetMode === 'pvp' ? 2.2 : cfg.maxWind);
    },
    [currentLevelNum, gameMode, rollWind]
  );

  useEffect(() => {
    if (isOpen) {
      resetDartMatch(currentLevelNum, gameMode);
    }
  }, [isOpen, currentLevelNum, gameMode, resetDartMatch]);

  // Xử lý tải ảnh từ máy tính / điện thoại để gắn vào Bia Phóng
  const handleUploadTargetPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (dataUrl) {
        setTargetPhotoUrl(dataUrl);
        try {
          window.localStorage.setItem(STORAGE_CUSTOM_PHOTO_KEY, dataUrl);
        } catch {
          // ignore quota error if image is very large
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
        setLastHitBanner('📸 Đã gắn ảnh lên tâm Bia Phóng Phi Tiêu!');
      }
    };
    reader.readAsDataURL(file);
  };

  // Tạo ảnh avatar có tên thành viên trong phòng để gắn nhanh lên bia
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

      // Vẽ khuôn mặt vui nhộn
      c.fillStyle = '#fcd34d';
      c.beginPath();
      c.arc(128, 115, 58, 0, Math.PI * 2);
      c.fill();

      // Mắt & Biểu cảm
      c.fillStyle = '#0f172a';
      c.beginPath();
      c.arc(106, 105, 7, 0, Math.PI * 2);
      c.arc(150, 105, 7, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = '#0f172a';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(128, 128, 22, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();

      // Tên thành viên
      c.fillStyle = '#ffffff';
      c.font = 'bold 24px Inter, sans-serif';
      c.textAlign = 'center';
      c.fillText(member.nickname.slice(0, 14), 128, 215);

      const dataUrl = svgCanvas.toDataURL('image/png');
      setTargetPhotoUrl(dataUrl);
      setTargetPersonName(member.nickname);
      try {
        window.localStorage.setItem(STORAGE_CUSTOM_PHOTO_KEY, dataUrl);
        window.localStorage.setItem(STORAGE_CUSTOM_NAME_KEY, member.nickname);
      } catch {
        // ignore
      }
      setLastHitBanner(`🎯 Đã gắn "${member.nickname}" lên Bia Phóng!`);
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
    setLastHitBanner('Đã khôi phục mặt Bia Phóng truyền thống.');
  };

  // Tính điểm khi mũi phi tiêu chạm tới mặt bia
  const resolveDartLanding = useCallback(
    (hitX: number, hitY: number, playerIdx: 0 | 1) => {
      const boardX = boardPosRef.current.x;
      const boardY = boardPosRef.current.y;
      const baseRadius = 128 * (gameMode === 'pvp' ? 0.94 : levelConfig.boardScale);

      const dx = hitX - boardX;
      const dy = hitY - boardY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normDist = dist / baseRadius;

      let pts = 0;
      let hitLabel = 'Trượt bia (0đ)';
      let isBull = false;

      const targetLabel = targetPersonName.trim() || 'mục tiêu';

      if (normDist <= 0.14) {
        pts = 50;
        isBull = true;
        hitLabel = targetPhotoUrl
          ? `💥 HỒNG TÂM! Trúng giữa trán ${targetLabel} (+50đ)`
          : '💥 BULLSEYE! Hồng tâm tuyệt đỉnh (+50đ)';
      } else if (normDist <= 0.32) {
        pts = 35;
        isBull = true;
        hitLabel = targetPhotoUrl
          ? `🎯 Trúng ngay mặt ${targetLabel}! (+35đ)`
          : '🔥 Tâm trong xuất sắc! (+35đ)';
      } else if (normDist <= 0.55) {
        pts = 25;
        hitLabel = targetPhotoUrl
          ? `✨ Trúng má ${targetLabel}! (+25đ)`
          : '✨ Vòng vàng (+25đ)';
      } else if (normDist <= 0.78) {
        pts = 15;
        hitLabel = '👍 Vòng trong (+15đ)';
      } else if (normDist <= 1.0) {
        pts = 10;
        hitLabel = '👌 Vòng ngoài (+10đ)';
      } else {
        pts = 0;
        hitLabel = '💨 Phóng trượt ra ngoài bia! (0đ)';
      }

      if (soundEnabled && pts > 0) {
        playDartHitSound(isBull);
      }
      boardShakeRef.current = isBull ? 12 : pts > 0 ? 6 : 2;

      const newDart: LandedDart = {
        id: `${Date.now()}-${Math.random()}`,
        relX: dx / baseRadius,
        relY: dy / baseRadius,
        score: pts,
        label: hitLabel,
        playerIndex: playerIdx,
      };

      setLandedDarts((prev) => [...prev, newDart]);
      setLastHitBanner(hitLabel);

      if (gameMode === 'campaign') {
        setScore((prevScore) => {
          const updatedScore = prevScore + pts;
          if (updatedScore > bestScore) {
            setBestScore(updatedScore);
            try {
              window.localStorage.setItem(STORAGE_BEST_SCORE_KEY, String(updatedScore));
            } catch {
              // ignore
            }
          }
          return updatedScore;
        });

        setDartsRemaining((prevLeft) => {
          const nextLeft = prevLeft - 1;
          if (nextLeft <= 0) {
            setRoundFinished(true);
          } else {
            rollWind(levelConfig.maxWind);
          }
          return nextLeft;
        });
      } else {
        // Chế độ Solo PvP 2 người
        setPvpScores((prev) => {
          const next: [number, number] = [...prev] as [number, number];
          next[playerIdx] += pts;
          return next;
        });

        setPvpDartsLeft((prev) => {
          const next: [number, number] = [...prev] as [number, number];
          next[playerIdx] = Math.max(0, next[playerIdx] - 1);
          if (next[0] === 0 && next[1] === 0) {
            setRoundFinished(true);
          } else {
            // Đổi lượt sang người chơi tiếp theo nếu họ còn phi tiêu
            const otherIdx: 0 | 1 = playerIdx === 0 ? 1 : 0;
            if (next[otherIdx] > 0) {
              setActiveTurnPlayer(otherIdx);
            }
            rollWind(2.2);
          }
          return next;
        });
      }
    },
    [
      gameMode,
      levelConfig,
      targetPersonName,
      targetPhotoUrl,
      soundEnabled,
      bestScore,
      rollWind,
    ]
  );

  // Mở khóa level tiếp theo khi hoàn thành đủ điểm ở chế độ 1 mình
  useEffect(() => {
    if (
      roundFinished &&
      gameMode === 'campaign' &&
      score >= levelConfig.targetScore &&
      currentLevelNum < DART_LEVELS.length
    ) {
      const nextUnlock = Math.max(unlockedLevel, currentLevelNum + 1);
      if (nextUnlock !== unlockedLevel) {
        setUnlockedLevel(nextUnlock);
        try {
          window.localStorage.setItem(STORAGE_UNLOCKED_LEVEL_KEY, String(nextUnlock));
        } catch {
          // ignore
        }
      }
    }
  }, [roundFinished, gameMode, score, levelConfig.targetScore, currentLevelNum, unlockedLevel]);

  // Vòng lặp vẽ Canvas Bia Phóng Phi Tiêu 60FPS
  useEffect(() => {
    if (!isOpen || selectedGameTab !== 'darts') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const startTime = performance.now();

    const renderLoop = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const w = canvas.width;
      const h = canvas.height;
      const centerX = w / 2;
      const centerY = h / 2;

      // Tính vị trí tâm bia di chuyển theo độ khó của Level
      const spdX = gameMode === 'pvp' ? 1.4 : levelConfig.speedX;
      const spdY = gameMode === 'pvp' ? 0.65 : levelConfig.speedY;
      const scale = gameMode === 'pvp' ? 0.94 : levelConfig.boardScale;

      let shakeOffsetX = 0;
      let shakeOffsetY = 0;
      if (boardShakeRef.current > 0.2) {
        shakeOffsetX = (Math.random() - 0.5) * boardShakeRef.current;
        shakeOffsetY = (Math.random() - 0.5) * boardShakeRef.current;
        boardShakeRef.current *= 0.85;
      } else {
        boardShakeRef.current = 0;
      }

      const bx =
        centerX +
        Math.sin(elapsed * spdX) * (spdX > 0 ? 58 : 0) +
        shakeOffsetX;
      const by =
        centerY +
        Math.sin(elapsed * spdY * 1.6) * (spdY > 0 ? 32 : 0) +
        shakeOffsetY;

      boardPosRef.current = { x: bx, y: by };
      const radius = 128 * scale;

      // 1. Nền gỗ/neon phòng giải trí
      const bgGrad = ctx.createRadialGradient(centerX, centerY, 30, centerX, centerY, w * 0.7);
      bgGrad.addColorStop(0, '#1e1b4b');
      bgGrad.addColorStop(1, '#090d16');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Lưới neon trang trí nền
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 36) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 36) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // 2. Vẽ Bóng đổ của Bia Phóng
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx + 6, by + 10, radius + 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fill();
      ctx.restore();

      // 3. Vẽ Viền ngoài Bia Phóng
      ctx.beginPath();
      ctx.arc(bx, by, radius + 10, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();

      // 4. Vẽ các vòng tính điểm đồng tâm (10đ -> 15đ -> 25đ -> 35đ -> 50đ)
      const rings = [
        { r: 1.0, fill: '#0f172a', stroke: '#475569' },
        { r: 0.78, fill: '#dc2626', stroke: '#fca5a5' },
        { r: 0.55, fill: '#f8fafc', stroke: '#cbd5e1' },
        { r: 0.32, fill: '#16a34a', stroke: '#86efac' },
        { r: 0.14, fill: '#eab308', stroke: '#fef08a' },
      ];

      for (const ring of rings) {
        ctx.beginPath();
        ctx.arc(bx, by, radius * ring.r, 0, Math.PI * 2);
        ctx.fillStyle = ring.fill;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = ring.stroke;
        ctx.stroke();
      }

      // Vẽ các đường chia múi bia phi tiêu
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const ang = (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(bx + Math.cos(ang) * (radius * 0.14), by + Math.sin(ang) * (radius * 0.14));
        ctx.lineTo(bx + Math.cos(ang) * radius, by + Math.sin(ang) * radius);
        ctx.stroke();
      }
      ctx.restore();

      // 5. NẾU CÓ ẢNH GHÉP LÊN BIA -> Vẽ ảnh cắt tròn ngay trên mặt bia!
      if (loadedImageRef.current) {
        const photoRadius =
          photoCoverageMode === 'full' ? radius * 0.76 : radius * 0.38;
        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, photoRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(
          loadedImageRef.current,
          bx - photoRadius,
          by - photoRadius,
          photoRadius * 2,
          photoRadius * 2
        );

        // Vẽ lại các vòng ngắm mờ đè nhẹ lên trên ảnh để người chơi vẫn căn được hồng tâm
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, radius * 0.32, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(bx, by, radius * 0.14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Viền phát sáng quanh ảnh mục tiêu
        ctx.beginPath();
        ctx.arc(bx, by, photoRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Nhãn tên mục tiêu dưới/trên tâm bia
      if (targetPersonName.trim()) {
        ctx.save();
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        const badgeW = Math.min(200, ctx.measureText(targetPersonName).width + 24);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bx - badgeW / 2, by + radius - 14, badgeW, 24, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fde68a';
        ctx.fillText(`🎯 ${targetPersonName}`, bx, by + radius + 2);
        ctx.restore();
      }

      // 6. Vẽ các mũi phi tiêu đã cắm trên bia (di chuyển cùng bia)
      for (const dart of landedDarts) {
        const dx = bx + dart.relX * radius;
        const dy = by + dart.relY * radius;

        ctx.save();
        // Bóng mũi tiêu
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.arc(dx + 3, dy + 4, 6, 0, Math.PI * 2);
        ctx.fill();

        // Thân & Cánh phi tiêu (Đỏ cho P1, Xanh ngọc cho P2)
        const finColor = dart.playerIndex === 0 ? '#f43f5e' : '#06b6d4';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx + 14, dy - 18);
        ctx.stroke();

        // Cánh đuôi phi tiêu
        ctx.fillStyle = finColor;
        ctx.beginPath();
        ctx.moveTo(dx + 14, dy - 18);
        ctx.lineTo(dx + 24, dy - 16);
        ctx.lineTo(dx + 18, dy - 28);
        ctx.closePath();
        ctx.fill();

        // Đầu kim cắm vào bia
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(dx, dy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 7. Vẽ mũi phi tiêu đang bay (nếu có)
      if (flyingDartRef.current && flyingDartRef.current.active) {
        const fd = flyingDartRef.current;
        fd.progress += 0.14;
        if (fd.progress >= 1) {
          fd.active = false;
          resolveDartLanding(fd.targetX, fd.targetY, fd.playerIndex);
        } else {
          const curX = fd.startX + (fd.targetX - fd.startX) * fd.progress;
          const curY =
            fd.startY +
            (fd.targetY - fd.startY) * fd.progress -
            Math.sin(fd.progress * Math.PI) * 45;
          const dartScale = 1.6 - fd.progress * 0.6;

          ctx.save();
          ctx.translate(curX, curY);
          ctx.scale(dartScale, dartScale);
          ctx.fillStyle = fd.playerIndex === 0 ? '#f43f5e' : '#06b6d4';
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      }

      // 8. Vẽ Tâm Ngắm (Crosshair) lắc nhẹ tự nhiên để tăng cảm giác ngắm bắn
      const aimX =
        (aimPosRef.current.x || centerX) + Math.sin(elapsed * 4.2) * 3.5;
      const aimY =
        (aimPosRef.current.y || centerY) + Math.cos(elapsed * 3.5) * 3.5;

      ctx.save();
      ctx.strokeStyle = activeTurnPlayer === 0 ? '#34d399' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(aimX, aimY, 16, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(aimX - 22, aimY);
      ctx.lineTo(aimX - 8, aimY);
      ctx.moveTo(aimX + 8, aimY);
      ctx.lineTo(aimX + 22, aimY);
      ctx.moveTo(aimX, aimY - 22);
      ctx.lineTo(aimX, aimY - 8);
      ctx.moveTo(aimX, aimY + 8);
      ctx.lineTo(aimX, aimY + 22);
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(aimX, aimY, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      animId = window.requestAnimationFrame(renderLoop);
    };

    animId = window.requestAnimationFrame(renderLoop);
    return () => window.cancelAnimationFrame(animId);
  }, [
    isOpen,
    selectedGameTab,
    gameMode,
    levelConfig,
    landedDarts,
    photoCoverageMode,
    targetPersonName,
    activeTurnPlayer,
    resolveDartLanding,
  ]);

  // Xử lý khi người chơi bấm hoặc chạm vào mặt Canvas để Phóng Phi Tiêu
  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    aimPosRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleThrowDartAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (roundFinished) return;
    if (flyingDartRef.current?.active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    aimPosRef.current = { x: clickX, y: clickY };

    // Cộng độ lệch của gió (windX)
    const windOffsetPx = windX * 12;

    flyingDartRef.current = {
      active: true,
      startX: canvas.width / 2,
      startY: canvas.height + 20,
      targetX: clickX + windOffsetPx,
      targetY: clickY,
      progress: 0,
      playerIndex: gameMode === 'pvp' ? activeTurnPlayer : 0,
    };
  };

  // Gửi lời mời thách đấu phi tiêu cho bạn bè trong phòng
  const handleSendRoomChallenge = () => {
    const targetMember = members.find((m) => m.userId === selectedOpponentId);
    const opponentLabel = targetMember ? targetMember.nickname : opponentName;
    const targetInfo = targetPersonName
      ? ` (Bia mục tiêu: "${targetPersonName}")`
      : '';
    const msg = `🎯 [THÁCH ĐẤU PHI TIÊU] ${currentNickname} vừa gửi lời mời @${opponentLabel} vào 🎮 Phòng Giải Trí đấu Solo Phóng Phi Tiêu${targetInfo}! Ai cao điểm hơn thắng nhé!`;
    onBroadcastChallengeMessage(msg);
    setLastHitBanner(`📣 Đã gửi lời mời thách đấu tới ${opponentLabel} trên kênh phòng!`);
  };

  const handleShareMatchResult = () => {
    if (gameMode === 'campaign') {
      const passed = score >= levelConfig.targetScore;
      const msg = `🎯 [KẾT QUẢ PHI TIÊU] ${currentNickname} vừa đạt ${score} điểm tại ${levelConfig.title}${
        targetPersonName ? ` (Bia mục tiêu: ${targetPersonName})` : ''
      } — ${passed ? '🏆 VƯỢT ẢI THÀNH CÔNG!' : '💪 Đang phục thù!'}`;
      onBroadcastChallengeMessage(msg);
    } else {
      const winner =
        pvpScores[0] > pvpScores[1]
          ? `${currentNickname} thắng!`
          : pvpScores[1] > pvpScores[0]
            ? `${opponentName} thắng!`
            : 'Hòa kịch tính!';
      const msg = `⚔️ [SOLO PHI TIÊU] ${currentNickname} (${pvpScores[0]}đ) vs ${opponentName} (${pvpScores[1]}đ) — Kết quả: 🏆 ${winner}`;
      onBroadcastChallengeMessage(msg);
    }
    setLastHitBanner('📣 Đã khoe bảng điểm lên kênh Chat của văn phòng!');
  };

  // Quay Vòng Quay Nhân Phẩm
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
    }, 1100);
  };

  if (!isOpen) return null;

  const otherMembers = members.filter((m) => m.userId !== currentUserId);
  const levelPassed = score >= levelConfig.targetScore;

  return (
    <div
      data-testid="entertainment-room-overlay"
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-2 sm:p-4 backdrop-blur-md"
    >
      <div className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-indigo-400/35 bg-slate-900/95 text-slate-100 shadow-2xl">
        {/* HEADER PHÒNG GIẢI TRÍ */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-indigo-950/90 via-slate-900 to-fuchsia-950/80 px-3.5 py-2.5 sm:px-5 sm:py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-400/40">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>🎮 Phòng Giải Trí — Tịnh Tâm Arcade</span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                  <Trophy className="h-3 w-3" /> Kỷ lục: {bestScore}đ
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Chơi 1 mình vượt Level hoặc mời bạn bè trong phòng đấu Solo • Hỗ trợ ghép ảnh vào bia phóng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Chuyển đổi giữa các Game trong Phòng Giải Trí */}
            <div className="flex items-center rounded-xl bg-slate-950/80 p-1 border border-white/10">
              <button
                type="button"
                data-testid="game-tab-darts"
                onClick={() => setSelectedGameTab('darts')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  selectedGameTab === 'darts'
                    ? 'bg-indigo-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Target className="h-3.5 w-3.5" />
                <span>Phóng Phi Tiêu</span>
              </button>
              <button
                type="button"
                data-testid="game-tab-wheel"
                onClick={() => setSelectedGameTab('wheel')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  selectedGameTab === 'wheel'
                    ? 'bg-fuchsia-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Disc className="h-3.5 w-3.5" />
                <span>Vòng Quay</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleSound}
              className="rounded-xl bg-slate-800 hover:bg-slate-700 p-2 text-slate-300 cursor-pointer"
              title={soundEnabled ? 'Tắt âm thanh game' : 'Bật âm thanh game'}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <VolumeX className="h-4 w-4 text-slate-500" />
              )}
            </button>

            <button
              type="button"
              data-testid="exit-game-room-btn"
              onClick={onExitGameRoom}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Về văn phòng</span>
            </button>
          </div>
        </div>

        {/* Banner thông báo khi có người thách đấu trong phòng */}
        {activeChallengeBanner && (
          <div className="bg-amber-500/20 border-b border-amber-400/40 px-4 py-1.5 text-center text-xs font-semibold text-amber-200">
            {activeChallengeBanner}
          </div>
        )}

        {/* NỘI DUNG CHÍNH */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {selectedGameTab === 'darts' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* CỘT TRÁI (7/12): BẢNG BIA PHÓNG PHI TIÊU TƯƠNG TÁC */}
              <div className="lg:col-span-7 flex flex-col items-center bg-slate-950/80 rounded-2xl border border-indigo-500/25 p-3 shadow-inner">
                {/* Thanh thông số trực tiếp phía trên Bia */}
                <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
                  {gameMode === 'campaign' ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-xl bg-indigo-500/20 border border-indigo-400/40 px-2.5 py-1 text-xs font-bold text-indigo-200">
                        {levelConfig.title}
                      </span>
                      <span
                        data-testid="dart-score-display"
                        className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-xs font-extrabold text-emerald-300"
                      >
                        Điểm: {score} / {levelConfig.targetScore}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-xl px-2.5 py-1 text-xs font-bold border ${
                          activeTurnPlayer === 0
                            ? 'bg-rose-500/25 border-rose-400 text-rose-200 ring-1 ring-rose-400'
                            : 'bg-slate-800/80 border-white/10 text-slate-400'
                        }`}
                      >
                        🔴 {currentNickname}: {pvpScores[0]}đ ({pvpDartsLeft[0]} tiêu)
                      </span>
                      <span className="text-xs font-bold text-slate-500">VS</span>
                      <span
                        className={`rounded-xl px-2.5 py-1 text-xs font-bold border ${
                          activeTurnPlayer === 1
                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400'
                            : 'bg-slate-800/80 border-white/10 text-slate-400'
                        }`}
                      >
                        🔵 {opponentName}: {pvpScores[1]}đ ({pvpDartsLeft[1]} tiêu)
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-xl bg-slate-800 px-2.5 py-1 text-sky-300 font-semibold">
                      <Wind className="h-3.5 w-3.5" />
                      Gió:{' '}
                      {windX === 0
                        ? 'Lặng gió'
                        : windX > 0
                          ? `Sang phải +${windX}`
                          : `Sang trái ${windX}`}
                    </span>
                    {gameMode === 'campaign' && (
                      <span
                        data-testid="darts-remaining-badge"
                        className="rounded-xl bg-amber-500/20 border border-amber-400/30 px-2.5 py-1 font-bold text-amber-300"
                      >
                        🎯 Phi tiêu: {dartsRemaining}
                      </span>
                    )}
                  </div>
                </div>

                {/* KHUNG CANVAS BIA PHÓNG PHI TIÊU */}
                <div className="relative w-full max-w-[380px] aspect-square rounded-2xl overflow-hidden border border-indigo-400/30 shadow-2xl">
                  <canvas
                    ref={canvasRef}
                    data-testid="dartboard-canvas"
                    width={360}
                    height={360}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerDown={handleThrowDartAt}
                    className="w-full h-full cursor-crosshair touch-none select-none"
                  />

                  {/* Lớp phủ Tổng kết khi hết lượt phi tiêu */}
                  {roundFinished && (
                    <div
                      data-testid="dart-round-summary"
                      className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/88 p-4 text-center backdrop-blur-md animate-fade-in"
                    >
                      {gameMode === 'campaign' ? (
                        <>
                          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300 ring-2 ring-amber-400/50">
                            <Trophy className="h-6 w-6" />
                          </div>
                          <h3 className="text-base sm:text-lg font-extrabold text-white">
                            {levelPassed
                              ? '🎉 Chúc mừng! Bạn đã vượt ải!'
                              : '💪 Chưa đủ điểm qua ải!'}
                          </h3>
                          <p className="mt-1 text-xs text-slate-300">
                            Tổng điểm:{' '}
                            <strong className="text-emerald-400 text-sm">{score}</strong> / Mục tiêu{' '}
                            <strong>{levelConfig.targetScore}</strong> điểm
                          </p>
                          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            <button
                              type="button"
                              data-testid="dart-retry-btn"
                              onClick={() => resetDartMatch(currentLevelNum, 'campaign')}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Chơi lại ải này</span>
                            </button>

                            {levelPassed && currentLevelNum < DART_LEVELS.length && (
                              <button
                                type="button"
                                data-testid="dart-next-level-btn"
                                onClick={() => setCurrentLevelNum((l) => l + 1)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-lg cursor-pointer"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Qua Level {currentLevelNum + 1} →</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={handleShareMatchResult}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/40 px-3 py-2 text-xs font-bold text-indigo-200 cursor-pointer"
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span>Khoe điểm lên phòng</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300 ring-2 ring-amber-400/50">
                            <Crown className="h-6 w-6" />
                          </div>
                          <h3 className="text-base sm:text-lg font-extrabold text-white">
                            {pvpScores[0] > pvpScores[1]
                              ? `🏆 ${currentNickname} Chiến Thắng!`
                              : pvpScores[1] > pvpScores[0]
                                ? `🏆 ${opponentName} Chiến Thắng!`
                                : '🤝 Trận Đấu Hòa Kịch Tính!'}
                          </h3>
                          <p className="mt-1 text-xs text-slate-300">
                            🔴 {currentNickname}:{' '}
                            <strong className="text-rose-300">{pvpScores[0]}đ</strong> — 🔵{' '}
                            {opponentName}:{' '}
                            <strong className="text-cyan-300">{pvpScores[1]}đ</strong>
                          </p>
                          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => resetDartMatch(currentLevelNum, 'pvp')}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-extrabold text-slate-950 cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Tái đấu ván mới</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleShareMatchResult}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/40 px-3.5 py-2 text-xs font-bold text-indigo-200 cursor-pointer"
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span>Báo kết quả lên phòng</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Thông báo kết quả mũi phóng vừa rồi */}
                <div className="mt-2 min-h-[28px] flex items-center justify-center text-center">
                  {lastHitBanner ? (
                    <span
                      data-testid="dart-hit-banner"
                      className="rounded-full bg-indigo-500/20 border border-indigo-400/40 px-3.5 py-1 text-xs font-bold text-amber-200"
                    >
                      {lastHitBanner}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      💡 Chạm hoặc bấm chuột trực tiếp vào Bia để phóng phi tiêu!
                    </span>
                  )}
                </div>
              </div>

              {/* CỘT PHẢI (5/12): CHỌN CHẾ ĐỘ CHƠI • LEVEL • GHÉP ẢNH VÀO BIA • MỜI BẠN BÈ */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                {/* 1. CHỌN CHẾ ĐỘ: CHƠI 1 MÌNH QUA LEVEL vs SOLO CÙNG BẠN BÈ */}
                <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-testid="mode-campaign-btn"
                      onClick={() => setGameMode('campaign')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold transition-all cursor-pointer ${
                        gameMode === 'campaign'
                          ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      <span>Chơi 1 mình (5 Level)</span>
                    </button>

                    <button
                      type="button"
                      data-testid="mode-pvp-btn"
                      onClick={() => setGameMode('pvp')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold transition-all cursor-pointer ${
                        gameMode === 'pvp'
                          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Swords className="h-3.5 w-3.5" />
                      <span>Solo cùng bạn bè</span>
                    </button>
                  </div>

                  {gameMode === 'campaign' ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-400">
                        Chọn Level thử thách (Đã mở khóa {unlockedLevel}/{DART_LEVELS.length}):
                      </p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {DART_LEVELS.map((lvl) => {
                          const active = currentLevelNum === lvl.level;
                          return (
                            <button
                              key={lvl.level}
                              type="button"
                              data-testid={`dart-level-${lvl.level}`}
                              onClick={() => setCurrentLevelNum(lvl.level)}
                              className={`flex flex-col items-center justify-center rounded-xl border py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                active
                                  ? 'border-amber-300 bg-amber-400 text-slate-950 shadow'
                                  : lvl.level <= unlockedLevel
                                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                                    : 'border-white/10 bg-slate-900 text-slate-400 hover:bg-slate-800'
                              }`}
                            >
                              <span>Lv.{lvl.level}</span>
                              <span className="text-[9px] opacity-80">{lvl.targetScore}đ</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-400 pt-0.5">{levelConfig.subtitle}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-300 font-medium">
                        Chọn bạn bè trong phòng để thách đấu hoặc đấu luân phiên 5 mũi tiêu:
                      </p>

                      {otherMembers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {otherMembers.map((m) => (
                            <button
                              key={m.userId}
                              type="button"
                              onClick={() => {
                                setSelectedOpponentId(m.userId);
                                setOpponentName(m.nickname);
                                resetDartMatch(currentLevelNum, 'pvp');
                              }}
                              className={`rounded-xl px-2.5 py-1 text-xs font-semibold border transition-all cursor-pointer ${
                                opponentName === m.nickname
                                  ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200'
                                  : 'border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              👤 {m.nickname}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opponentName}
                          onChange={(e) => setOpponentName(e.target.value)}
                          placeholder="Tên đối thủ..."
                          className="flex-1 rounded-xl border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-rose-400"
                        />
                        <button
                          type="button"
                          data-testid="invite-friend-dart-btn"
                          onClick={handleSendRoomChallenge}
                          className="inline-flex items-center gap-1 rounded-xl bg-rose-500 hover:bg-rose-400 px-3 py-1.5 text-xs font-bold text-white shadow cursor-pointer"
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span>Mời đấu</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. CHỨC NĂNG ĐẶC BIỆT: THAY ẢNH NGƯỜI NÀO ĐÓ VÀO BIA PHÓNG */}
                <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/10 via-slate-950/80 to-rose-500/10 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-amber-300" />
                      <h3 className="text-xs font-extrabold text-amber-200 uppercase tracking-wider">
                        Ghép ảnh người vào Bia Phóng
                      </h3>
                    </div>
                    <button
                      type="button"
                      data-testid="toggle-photo-customizer-btn"
                      onClick={() => setShowPhotoCustomizer((v) => !v)}
                      className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
                    >
                      {showPhotoCustomizer ? 'Thu gọn ▴' : 'Mở tùy chỉnh ▾'}
                    </button>
                  </div>

                  {/* Nút tải ảnh nhanh luôn hiển thị */}
                  <div className="flex flex-wrap items-center gap-2">
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
                    <button
                      type="button"
                      data-testid="dart-upload-photo-btn"
                      onClick={() => photoInputRef.current?.click()}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 px-3 py-2 text-xs font-extrabold text-slate-950 shadow cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Chọn ảnh từ máy / điện thoại</span>
                    </button>

                    {targetPhotoUrl && (
                      <button
                        type="button"
                        data-testid="dart-clear-photo-btn"
                        onClick={handleClearTargetPhoto}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 px-2.5 py-2 text-xs font-semibold text-rose-200 cursor-pointer"
                        title="Xóa ảnh trên bia"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa ảnh</span>
                      </button>
                    )}
                  </div>

                  {/* Đặt tên mục tiêu hiển thị trên bia */}
                  <div className="flex items-center gap-2">
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
                      placeholder="Nhập tên mục tiêu trên bia (VD: Deadline, Sếp, Bạn thân...)"
                      className="w-full rounded-xl border border-white/15 bg-slate-900/90 px-3 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Mở rộng: Chọn kích thước ảnh trên bia, dán URL ảnh, hoặc chọn thành viên trong phòng */}
                  {showPhotoCustomizer && (
                    <div className="space-y-2 pt-1 border-t border-white/10">
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span>Kích cỡ ảnh trên bia:</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPhotoCoverageMode('full')}
                            className={`rounded-lg px-2 py-0.5 font-semibold cursor-pointer ${
                              photoCoverageMode === 'full'
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            Toàn mặt bia
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhotoCoverageMode('center')}
                            className={`rounded-lg px-2 py-0.5 font-semibold cursor-pointer ${
                              photoCoverageMode === 'center'
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            Chỉ vùng tâm
                          </button>
                        </div>
                      </div>

                      {/* Dán link ảnh URL */}
                      <div className="flex items-center gap-1.5">
                        <input
                          type="url"
                          value={photoUrlInput}
                          onChange={(e) => setPhotoUrlInput(e.target.value)}
                          placeholder="Hoặc dán link ảnh https://..."
                          className="flex-1 rounded-xl border border-white/15 bg-slate-900 px-2.5 py-1 text-xs text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (photoUrlInput.trim()) {
                              setTargetPhotoUrl(photoUrlInput.trim());
                              setPhotoUrlInput('');
                            }
                          }}
                          className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 px-2.5 py-1 text-xs font-semibold text-amber-300 cursor-pointer"
                        >
                          Gắn link
                        </button>
                      </div>

                      {/* Chọn nhanh thành viên trong phòng làm bia */}
                      {members.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] text-slate-400">
                            Hoặc gắn nhanh thành viên trong phòng lên bia:
                          </span>
                          <div className="flex flex-wrap gap-1">
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
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. NÚT LÀM MỚI VÁN & KHOE ĐIỂM */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => resetDartMatch(currentLevelNum, gameMode)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 py-2 text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Phóng lại từ đầu</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareMatchResult}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 py-2 text-xs font-bold text-indigo-200 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Gửi điểm ra phòng</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: VÒNG QUAY NHÂN PHẨM VĂN PHÒNG */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-950/70 rounded-2xl border border-fuchsia-500/25 p-4">
              <div className="flex flex-col items-center justify-center text-center p-4 space-y-3">
                <div
                  className={`flex h-28 w-28 items-center justify-center rounded-full border-4 border-fuchsia-400 bg-gradient-to-br from-fuchsia-600/40 to-indigo-600/40 shadow-2xl ${
                    spinningWheel ? 'animate-spin' : ''
                  }`}
                >
                  <Disc className="h-14 w-14 text-fuchsia-300" />
                </div>
                <h3 className="text-base font-extrabold text-white">
                  🎡 Vòng Quay Nhân Phẩm Văn Phòng
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Dùng để bốc thăm vui cùng đồng nghiệp: Ai khao trà sữa, ai thuyết trình trước, hoặc nhận quẻ vui trong ngày!
                </p>

                {wheelResult && (
                  <div className="rounded-2xl border border-amber-300/60 bg-amber-500/20 px-4 py-2.5 text-sm font-extrabold text-amber-200 shadow-lg">
                    🎉 Kết quả: {wheelResult}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSpinWheel}
                    disabled={spinningWheel}
                    className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 hover:from-fuchsia-400 hover:to-indigo-400 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg cursor-pointer"
                  >
                    {spinningWheel ? 'Đang quay...' : '🎲 Quay ngay!'}
                  </button>
                  {wheelResult && (
                    <button
                      type="button"
                      onClick={() =>
                        onBroadcastChallengeMessage(
                          `🎡 [VÒNG QUAY NHÂN PHẨM] ${currentNickname} vừa quay trúng: "${wheelResult}"!`
                        )
                      }
                      className="rounded-2xl bg-slate-800 hover:bg-slate-700 border border-white/15 px-3.5 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
                    >
                      📣 Báo lên phòng
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Danh sách các ô trên Vòng Quay (mỗi dòng 1 mục):
                </label>
                <textarea
                  rows={6}
                  value={wheelItemsText}
                  onChange={(e) => setWheelItemsText(e.target.value)}
                  className="w-full rounded-2xl border border-white/15 bg-slate-900 p-3 text-xs text-slate-100 outline-none focus:border-fuchsia-400"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
