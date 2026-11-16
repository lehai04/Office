import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Armchair,
  MessageSquare,
  CalendarCheck,
  BookHeart,
  Share2,
  LogOut,
  Users,
  Check,
  Sparkles,
  Eye,
  Compass,
  PenSquare,
  Crown,
  Gamepad2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { OfficeScene3D, type ActiveSpeechBubble } from './components/OfficeScene3D';
import { EntryModal } from './components/EntryModal';
import { SeatSelectorModal } from './components/SeatSelectorModal';
import { ChatDrawer, formatChatPreviewText } from './components/ChatDrawer';
import {
  AttendanceDrawer,
  getNextAttendanceStatus,
} from './components/AttendanceDrawer';
import { DiaryDrawer } from './components/DiaryDrawer';
import {
  ZenSanctuaryOverlay,
  DEITY_OPTIONS,
  type DeityType,
} from './components/ZenSanctuaryOverlay';
import { EntertainmentRoomModal } from './components/EntertainmentRoomModal';
import {
  CAT_SHOP_ITEMS,
  loadMyCatInventory,
  loadRoomCats,
  loadRoomGiftRequests,
  saveMyCatInventory,
  saveRoomCats,
  saveRoomGiftRequests,
  type CatActivity,
  type CatGiftRequest,
  type OfficeCatProfile,
} from './utils/officeCatsData';
import {
  clampPuzzleGrid,
  createDefaultPuzzleState,
  loadRoomPuzzleState,
  resolveActivePuzzleArtwork,
  saveRoomPuzzleState,
  type PuzzleArtwork,
  type RoomPuzzleState,
} from './utils/officePuzzleData';
import {
  calculateDonationMerit,
  createDefaultDonationBoxState,
  createDefaultWalletState,
  formatVnd,
  loadRoomDonationBoxState,
  loadUserWalletState,
  saveRoomDonationBoxState,
  saveUserWalletState,
  settlePastMonthsSalary,
  type RoomDonationBoxState,
  type UserWalletState,
} from './utils/officeEconomyData';
import { getNowInHoChiMinh } from './utils/dateVn';
import {
  playCatMeowSound,
  playChatNotificationSound,
  playWoodenFishSound,
  playTempleBellSound,
  startZenBackgroundMusic,
  stopZenBackgroundMusic,
  type ZenTrackId,
} from './utils/zenSound';
import {
  broadcastCatSyncEvent,
  broadcastDonationBoxSyncEvent,
  broadcastAttendanceReminderEvent,
  broadcastPuzzleSyncEvent,
  changeRoomCodeApi,
  clearSavedSession,
  claimWorkSeat,
  createDiaryEntry,
  fetchDiaryLists,
  fetchFullRoomState,
  fetchSingleDiaryEntry,
  getInviteRoomFromUrl,
  getSessionNamespace,
  isUsingStaticFallback,
  joinOrRestoreRoom,
  kickRoomMember,
  leaveRoomApi,
  leaveWorkSeatToStand,
  loadSavedSession,
  officeApiUrl,
  sendChatMessage,
  setAccountPasswordApi,
  setZenRoomPresenceApi,
  sitAtMeetingChair,
  subscribeStaticRealtime,
  transferRoomManager,
  updateAttendanceDay,
  updateDiaryEntry,
} from './services/officeApi';
import { DEFAULT_ROOM_CODE, WORK_SEAT_LAYOUTS, MEETING_CHAIRS } from './constants/officeLayout';
import type {
  AuthSession,
  AvatarGender,
  AttendanceStatus,
  ChatMessage,
  MyDiaryEntry,
  PublicDiaryEntry,
  RoomInfo,
  RoomMember,
  WorkSeat,
} from './types/office';

type ActivePanel = 'none' | 'seats' | 'chat' | 'attendance' | 'diary' | 'zen' | 'games';

export function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [seats, setSeats] = useState<WorkSeat[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [diaryFeed, setDiaryFeed] = useState<PublicDiaryEntry[]>([]);
  const [myDiary, setMyDiary] = useState<MyDiaryEntry[]>([]);

  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [claimingSeatId, setClaimingSeatId] = useState<string | null>(null);
  const [seatError, setSeatError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [editingRoomCode, setEditingRoomCode] = useState(false);
  const [newRoomCodeDraft, setNewRoomCodeDraft] = useState('');

  // Chế độ góc nhìn: 'overview' (Toàn cảnh 3D) | 'first_person' (Góc nhìn thứ nhất của nhân vật)
  const [cameraMode, setCameraMode] = useState<'overview' | 'first_person'>('overview');

  // State cho Phòng Tịnh Tâm (Phật • Ông Địa • Thần Tài • Gõ Mõ • Lạy Khấn)
  const [selectedDeity, setSelectedDeity] = useState<DeityType>('buddha');
  const [meritCount, setMeritCount] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem(`van_phong_ao_merit:${getSessionNamespace()}`);
      if (saved !== null) return Number(saved) || 0;
      // Khởi tạo sẵn 30 điểm công đức cho người mới để có thể trải nghiệm Cửa hàng mèo ngay
      window.localStorage.setItem(`van_phong_ao_merit:${getSessionNamespace()}`, '30');
      return 30;
    } catch {
      return 30;
    }
  });
  const [incenseLit, setIncenseLit] = useState<boolean>(true);
  const [isBowing, setIsBowing] = useState<boolean>(false);
  const [autoMo, setAutoMo] = useState<boolean>(false);
  // Game mặc định tắt âm thanh theo yêu cầu
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [zenTrackId, setZenTrackId] = useState<ZenTrackId>('zen_flute_528');
  const [customZenAudioUrl, setCustomZenAudioUrl] = useState<string | null>(null);
  const [customZenTrackName, setCustomZenTrackName] = useState<string | null>(null);
  const [moPulseKey, setMoPulseKey] = useState<number>(0);
  const [floatingMeritText, setFloatingMeritText] = useState<string | null>(null);
  const [activeBlessing, setActiveBlessing] = useState<string | null>(null);
  const [activeChallengeBanner, setActiveChallengeBanner] = useState<string | null>(null);
  const meritTimerRef = useRef<number | null>(null);

  // State cho Game "Nuôi Mèo Văn Phòng"
  const [roomCats, setRoomCats] = useState<Record<string, OfficeCatProfile>>({});
  const [myCatInventory, setMyCatInventory] = useState<Record<string, number>>({});
  const [giftRequests, setGiftRequests] = useState<CatGiftRequest[]>([]);

  // State cho Game "Ghép Tranh Cùng Phòng"
  const [roomPuzzleState, setRoomPuzzleState] = useState<RoomPuzzleState>(() =>
    createDefaultPuzzleState()
  );

  // State Ví tiền (5 triệu mặc định), Hòm Công Đức & Thông báo ngoài màn hình
  const [userWallet, setUserWallet] = useState<UserWalletState>(() =>
    createDefaultWalletState()
  );
  const [roomDonationBox, setRoomDonationBox] = useState<RoomDonationBoxState>(() =>
    createDefaultDonationBoxState()
  );
  const [isDonationModalOpen, setIsDonationModalOpen] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return window.Notification.permission;
  });
  const [updateAvailableBanner, setUpdateAvailableBanner] = useState<boolean>(false);
  const [attendanceReminderBanner, setAttendanceReminderBanner] = useState<string | null>(null);
  const [diaryAlertBanner, setDiaryAlertBanner] = useState<string | null>(null);
  const initialScriptSrcRef = useRef<string | null>(null);

  // State đóng/mở menu gọn trên màn hình (Click để xổ chức năng, click để đóng menu)
  const [topMenuOpen, setTopMenuOpen] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  // State tạo mật khẩu cho tài khoản cũ chưa có mật khẩu
  const [newPasswordDraft, setNewPasswordDraft] = useState<string>('');
  const [savingPassword, setSavingPassword] = useState<boolean>(false);
  const [passwordPromptError, setPasswordPromptError] = useState<string | null>(null);

  // Thông báo tin nhắn nổi toàn cục (hiện dù đang ở bất kỳ phòng/game/tab nào)
  const [chatAlertBanner, setChatAlertBanner] = useState<{
    id: string;
    senderNickname: string;
    content: string;
  } | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const chatAlertTimerRef = useRef<number | null>(null);
  const activePanelRef = useRef<ActivePanel>(activePanel);
  useEffect(() => {
    activePanelRef.current = activePanel;
    if (activePanel === 'chat') {
      setUnreadChatCount(0);
    }
  }, [activePanel]);

  // Bong bóng chat 5 giây trên đầu nhân vật
  const [activeBubbles, setActiveBubbles] = useState<Record<string, ActiveSpeechBubble>>({});
  const bubbleTimersRef = useRef<Record<string, number>>({});

  // Bộ đếm thứ tự thao tác chấm công để giữ đúng trạng thái khi bấm nhanh liên tiếp
  const attendanceSeqRef = useRef<number>(1);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [failedAttendanceDate, setFailedAttendanceDate] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const triggerSpeechBubble = useCallback((userId: string, content: string) => {
    const expiresAt = Date.now() + 5000;
    const displayContent = formatChatPreviewText(content);
    setActiveBubbles((prev) => ({
      ...prev,
      [userId]: { userId, content: displayContent, expiresAt },
    }));

    if (bubbleTimersRef.current[userId]) {
      window.clearTimeout(bubbleTimersRef.current[userId]);
    }
    bubbleTimersRef.current[userId] = window.setTimeout(() => {
      setActiveBubbles((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
    }, 5000);
  }, []);

  // Xử lý Gõ Mõ trong Phòng Tịnh Tâm
  const handleStrikeMo = useCallback(() => {
    if (soundEnabled) {
      playWoodenFishSound();
    }
    setMeritCount((prev) => {
      const next = prev + 1;
      try {
        window.localStorage.setItem(`van_phong_ao_merit:${getSessionNamespace()}`, String(next));
      } catch {
        // ignore
      }
      return next;
    });
    setMoPulseKey((k) => k + 1);

    const phrases = DEITY_OPTIONS[selectedDeity].floatingTexts;
    const text = phrases[Math.floor(Math.random() * phrases.length)];
    setFloatingMeritText(text);

    if (meritTimerRef.current) {
      window.clearTimeout(meritTimerRef.current);
    }
    meritTimerRef.current = window.setTimeout(() => {
      setFloatingMeritText(null);
    }, 1500);
  }, [soundEnabled, selectedDeity]);

  const handleRingBell = useCallback(() => {
    if (soundEnabled) {
      playTempleBellSound();
    }
    setFloatingMeritText('🔔 Tiếng chuông tỉnh thức • Tâm an trí sáng');
    if (meritTimerRef.current) {
      window.clearTimeout(meritTimerRef.current);
    }
    meritTimerRef.current = window.setTimeout(() => {
      setFloatingMeritText(null);
    }, 2000);
  }, [soundEnabled]);

  const handleBowToDeity = useCallback(() => {
    if (isBowing) return;
    setIsBowing(true);
    if (soundEnabled) {
      playTempleBellSound();
    }
    const blessings = DEITY_OPTIONS[selectedDeity].blessings;
    const chosen = blessings[Math.floor(Math.random() * blessings.length)];
    setActiveBlessing(chosen);
    setMeritCount((prev) => {
      const next = prev + 3;
      try {
        window.localStorage.setItem(`van_phong_ao_merit:${getSessionNamespace()}`, String(next));
      } catch {
        // ignore
      }
      return next;
    });

    window.setTimeout(() => {
      setIsBowing(false);
    }, 3000);
  }, [isBowing, soundEnabled, selectedDeity]);

  // Tự động gõ mõ đều đặn khi bật autoMo trong Phòng Tịnh Tâm
  useEffect(() => {
    if (!autoMo || activePanel !== 'zen') return;
    const timer = window.setInterval(() => {
      handleStrikeMo();
    }, 1150);
    return () => window.clearInterval(timer);
  }, [autoMo, activePanel, handleStrikeMo]);

  // Phát / dừng nhạc nền thiền khi ở trong Phòng Tịnh Tâm
  useEffect(() => {
    if (activePanel === 'zen' && soundEnabled && zenTrackId !== 'off') {
      startZenBackgroundMusic(zenTrackId, customZenAudioUrl);
    } else {
      stopZenBackgroundMusic();
    }
    return () => {
      stopZenBackgroundMusic();
    };
  }, [activePanel, soundEnabled, zenTrackId, customZenAudioUrl]);

  const handleUploadCustomZenMp3 = useCallback(
    (file: File) => {
      if (customZenAudioUrl) {
        URL.revokeObjectURL(customZenAudioUrl);
      }
      const objectUrl = URL.createObjectURL(file);
      setCustomZenAudioUrl(objectUrl);
      setCustomZenTrackName(file.name);
      setZenTrackId('custom_mp3');
      setSoundEnabled(true);
      showToast(`Đang phát nhạc thiền từ máy: ${file.name}`);
    },
    [customZenAudioUrl, showToast]
  );

  // ==================== KẾT NỐI TIỀN CÔNG ĐỨC & GAME NUÔI MÈO VĂN PHÒNG ====================
  const handleSpendMerit = useCallback(
    (amount: number): boolean => {
      if (meritCount < amount) return false;
      const next = Math.max(0, meritCount - amount);
      setMeritCount(next);
      try {
        window.localStorage.setItem(`van_phong_ao_merit:${getSessionNamespace()}`, String(next));
      } catch {
        // ignore
      }
      return true;
    },
    [meritCount]
  );

  // Tải dữ liệu Mèo trong phòng, Túi đồ cá nhân & Yêu cầu Quà tặng khi vào phòng
  useEffect(() => {
    if (!session || !room) return;
    const loadedCats = loadRoomCats(room.code);
    delete loadedCats.colleague_demo_linh;
    const loadedGifts = loadRoomGiftRequests(room.code);
    setRoomCats(loadedCats);
    setMyCatInventory(loadMyCatInventory(session.userId));
    setGiftRequests(loadedGifts);
    setRoomPuzzleState(loadRoomPuzzleState(room.code));
    setUserWallet(loadUserWalletState(room.code, session.userId));
    setRoomDonationBox(loadRoomDonationBoxState(room.code));

    // Tự động phát đồng bộ mèo, quà & tranh ghép lên phòng sau 1.8s
    const syncTimer = window.setTimeout(() => {
      const latestCats = loadRoomCats(room.code);
      delete latestCats.colleague_demo_linh;
      const latestGifts = loadRoomGiftRequests(room.code);
      if (Object.keys(latestCats).length > 0 || latestGifts.length > 0) {
        broadcastCatSyncEvent({
          roomCode: room.code,
          roomCats: latestCats,
          giftRequests: latestGifts,
        });
      }
      const latestPuzzle = loadRoomPuzzleState(room.code);
      if (
        Object.keys(latestPuzzle.placedPieces).length > 0 ||
        latestPuzzle.completedGallery.length > 0
      ) {
        broadcastPuzzleSyncEvent({
          roomCode: room.code,
          puzzleState: latestPuzzle,
        });
      }
    }, 1800);

    const onStorageChange = () => {
      const updatedCats = loadRoomCats(room.code);
      delete updatedCats.colleague_demo_linh;
      setRoomCats(updatedCats);
      setMyCatInventory(loadMyCatInventory(session.userId));
      setGiftRequests(loadRoomGiftRequests(room.code));
      setRoomPuzzleState(loadRoomPuzzleState(room.code));
    setUserWallet(loadUserWalletState(room.code, session.userId));
    setRoomDonationBox(loadRoomDonationBoxState(room.code));
    };
    window.addEventListener('storage', onStorageChange);
    return () => {
      window.clearTimeout(syncTimer);
      window.removeEventListener('storage', onStorageChange);
    };
  }, [session, room]);

  // Nếu bạn bận, mèo vẫn tự đi dạo hoặc nghỉ ngơi theo nhịp tự nhiên
  useEffect(() => {
    if (!session || !room) return;
    const myCat = roomCats[session.userId];
    if (!myCat) return;
    const timer = window.setInterval(() => {
      const cycle: CatActivity[] = ['walking', 'playing', 'sleeping'];
      setRoomCats((prev) => {
        const current = prev[session.userId];
        if (!current) return prev;
        const nextAct =
          cycle[(cycle.indexOf(current.activity) + 1) % cycle.length];
        const nextMap = {
          ...prev,
          [session.userId]: {
            ...current,
            activity: nextAct,
            updatedAt: Date.now(),
          },
        };
        saveRoomCats(room.code, nextMap);
        return nextMap;
      });
    }, 24000);
    return () => window.clearInterval(timer);
  }, [session, room, Boolean(session && roomCats[session.userId])]);

  const sendDesktopNotification = useCallback(
    (params: { title: string; body: string; tag?: string; onClick?: () => void }) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (window.Notification.permission !== 'granted') return;
      try {
        const notif = new window.Notification(params.title, {
          body: params.body,
          tag: params.tag,
        });
        notif.onclick = () => {
          window.focus();
          params.onClick?.();
          notif.close();
        };
      } catch {
        // ignore notification errors on restricted environments
      }
    },
    []
  );

  const requestDesktopNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    try {
      const perm = await window.Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        showToast('🔔 Đã bật thông báo ngoài màn hình (khi ở tab/app khác vẫn thấy)!');
      }
    } catch {
      // ignore
    }
  }, [showToast]);

  // Tự động kết toán lương các tháng trước đã chấm công vào ví (8h/ngày × 100k/giờ)
  useEffect(() => {
    if (!session || !room) return;
    const nowVn = getNowInHoChiMinh();
    const currentYearMonth = nowVn.dateStr.slice(0, 7);
    setUserWallet((prev) => {
      const { wallet: settledWallet, newlySettledMonths, addedVnd } =
        settlePastMonthsSalary(prev, attendanceMap, currentYearMonth);
      if (newlySettledMonths.length > 0 || settledWallet !== prev) {
        saveUserWalletState(room.code, session.userId, settledWallet);
        if (addedVnd > 0) {
          showToast(
            `💵 Đã trả lương tháng ${newlySettledMonths.join(', ')}: +${formatVnd(addedVnd)} vào ví!`
          );
        }
        return settledWallet;
      }
      return prev;
    });
  }, [session, room, attendanceMap, showToast]);

  // Nhắc nhở chấm công khi vào phòng & định kỳ mỗi 45 phút nếu hôm nay chưa chấm công
  useEffect(() => {
    if (!session || !room) return;
    const checkAttendanceReminder = () => {
      const todayStr = getNowInHoChiMinh().dateStr;
      const st = attendanceMap[todayStr] ?? 'none';
      if (st === 'none') {
        const msg = `⏰ Nhắc nhở: Bạn chưa chấm công hôm nay (${todayStr}) — 8h × 100k = 800.000đ!`;
        setAttendanceReminderBanner(msg);
        sendDesktopNotification({
          title: '⏰ Nhắc nhở chấm công hôm nay',
          body: `Hôm nay (${todayStr}) bạn chưa chấm công. Mỗi ngày chỉ chấm 1 lần!`,
          tag: `attendance-reminder-${todayStr}`,
          onClick: () => setActivePanel('attendance'),
        });
      }
    };
    const initialTimer = window.setTimeout(checkAttendanceReminder, 5000);
    const intervalTimer = window.setInterval(checkAttendanceReminder, 45 * 60 * 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, [session, room, attendanceMap, sendDesktopNotification]);

  // Kiểm tra phiên bản / chỉnh sửa mới mỗi 60s để nhắc Refresh tự động
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentScript = document.querySelector('script[type="module"][src]');
    initialScriptSrcRef.current = currentScript?.getAttribute('src') || null;
    if (!initialScriptSrcRef.current) return;

    const checkForUpdates = async () => {
      try {
        const res = await fetch(`${window.location.pathname}?_v=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const html = await res.text();
        const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
        const latestSrc = match?.[1] || null;
        if (
          latestSrc &&
          initialScriptSrcRef.current &&
          latestSrc !== initialScriptSrcRef.current
        ) {
          setUpdateAvailableBanner(true);
          sendDesktopNotification({
            title: '🔄 Văn phòng vừa có bản chỉnh sửa mới!',
            body: 'Bấm vào đây để làm mới (Refresh) cập nhật tính năng mới nhất.',
            tag: 'office-app-update',
            onClick: () => window.location.reload(),
          });
        }
      } catch {
        // ignore network errors
      }
    };

    const timer = window.setInterval(() => {
      void checkForUpdates();
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [sendDesktopNotification]);

  const handleDonateToBox = useCallback(
    (
      amountVnd: number
    ): { ok: boolean; error?: string; meritAwarded?: number } => {
      if (!session || !room) {
        return { ok: false, error: 'Chưa kết nối phòng.' };
      }
      if (!Number.isFinite(amountVnd) || amountVnd < 1000) {
        return { ok: false, error: 'Vui lòng nhập số tiền tối thiểu 1.000đ.' };
      }
      if (userWallet.balanceVnd < amountVnd) {
        return {
          ok: false,
          error: `Số dư ví không đủ (hiện có ${formatVnd(userWallet.balanceVnd)}).`,
        };
      }

      const meritAwarded = calculateDonationMerit(amountVnd);
      const nextWallet: UserWalletState = {
        ...userWallet,
        balanceVnd: userWallet.balanceVnd - amountVnd,
        totalDonatedVnd: userWallet.totalDonatedVnd + amountVnd,
        updatedAt: Date.now(),
      };
      setUserWallet(nextWallet);
      saveUserWalletState(room.code, session.userId, nextWallet);

      // Cộng tối thiểu 10 công đức trở lên
      setMeritCount((prev) => {
        const next = prev + meritAwarded;
        try {
          window.localStorage.setItem(
            `van_phong_ao_zen_merit:${room.code}:${session.userId}`,
            String(next)
          );
        } catch {
          // ignore
        }
        return next;
      });

      const nextBox: RoomDonationBoxState = {
        totalVnd: roomDonationBox.totalVnd + amountVnd,
        donations: [
          {
            id: `don-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            donorUserId: session.userId,
            donorNickname: session.nickname,
            amountVnd,
            meritAwarded,
            createdAt: Date.now(),
          },
          ...roomDonationBox.donations,
        ].slice(0, 50),
        updatedAt: Date.now(),
      };
      setRoomDonationBox(nextBox);
      saveRoomDonationBoxState(room.code, nextBox);
      broadcastDonationBoxSyncEvent({ roomCode: room.code, donationBox: nextBox });

      playTempleBellSound();
      setFloatingMeritText(`+${meritAwarded} Công đức • Cảm ơn ${session.nickname}!`);
      if (meritTimerRef.current) {
        window.clearTimeout(meritTimerRef.current);
      }
      meritTimerRef.current = window.setTimeout(() => {
        setFloatingMeritText(null);
      }, 2200);
      return { ok: true, meritAwarded };
    },
    [session, room, userWallet, roomDonationBox]
  );

  const triggerGlobalChatAlert = useCallback(
    (incoming: ChatMessage) => {
      playChatNotificationSound();
      const previewText = formatChatPreviewText(incoming.content);
      setChatAlertBanner({
        id: incoming.id,
        senderNickname: incoming.nickname,
        content: previewText,
      });
      if (chatAlertTimerRef.current) {
        window.clearTimeout(chatAlertTimerRef.current);
      }
      chatAlertTimerRef.current = window.setTimeout(() => {
        setChatAlertBanner((prev) => (prev?.id === incoming.id ? null : prev));
      }, 6500);

      if (activePanelRef.current !== 'chat') {
        setUnreadChatCount((c) => c + 1);
      }

      // Thông báo hệ thống trình duyệt (hiện kể cả khi người dùng không ở màn hình game)
      if (document.hidden || !document.hasFocus()) {
        sendDesktopNotification({
          title: `💬 ${incoming.nickname} nhắn tin trong phòng`,
          body: previewText,
          tag: `chat-${incoming.id}`,
          onClick: () => setActivePanel('chat'),
        });
      }
    },
    [sendDesktopNotification]
  );

  const handleAdoptOrUpdateMyCat = useCallback(
    (catProfile: OfficeCatProfile, broadcastMsg?: string) => {
      if (!room) return;
      setRoomCats((prev) => {
        const nextMap = {
          ...prev,
          [catProfile.ownerUserId]: catProfile,
        };
        saveRoomCats(room.code, nextMap);
        broadcastCatSyncEvent({
          roomCode: room.code,
          roomCats: nextMap,
          giftRequests,
        });
        return nextMap;
      });
      if (broadcastMsg && session) {
        sendChatMessage(
          room.code,
          broadcastMsg,
          `cat-${Date.now()}`,
          session.sessionToken
        ).catch(() => {});
      }
    },
    [room, session, giftRequests]
  );

  const handleUpdateMyCatInventory = useCallback(
    (nextInv: Record<string, number>) => {
      if (!session) return;
      setMyCatInventory(nextInv);
      saveMyCatInventory(session.userId, nextInv);
    },
    [session]
  );

  const handleCreateGiftRequest = useCallback(
    (req: CatGiftRequest) => {
      if (!room || !session) return;
      setGiftRequests((prev) => {
        const nextList = [req, ...prev];
        saveRoomGiftRequests(room.code, nextList);
        broadcastCatSyncEvent({
          roomCode: room.code,
          roomCats,
          giftRequests: nextList,
        });
        return nextList;
      });
      const item = CAT_SHOP_ITEMS.find((i) => i.id === req.itemId);
      const targetText = req.targetNickname
        ? `gửi tới @${req.targetNickname}`
        : 'đăng vào mục Quà tặng của phòng';
      sendChatMessage(
        room.code,
        `🎁 [QUÀ TẶNG MÈO] ${session.nickname} (mèo "${req.catName}") xin 1x ${
          item ? `${item.icon} ${item.name}` : req.itemId
        } (${targetText}). Mở Phòng Giải Trí → Nuôi Mèo → Quà tặng để tặng nhé!`,
        `giftreq-${Date.now()}`,
        session.sessionToken
      ).catch(() => {});
    },
    [room, session, roomCats]
  );

  const handleFulfillGiftRequest = useCallback(
    (reqId: string) => {
      if (!room || !session) return;
      const targetReq = giftRequests.find((r) => r.id === reqId && r.status === 'open');
      if (!targetReq) return;
      const myQty = myCatInventory[targetReq.itemId] || 0;
      if (myQty <= 0) return;

      // 1. Trừ 1 món trong túi đồ của người tặng
      const nextMyInv = { ...myCatInventory, [targetReq.itemId]: Math.max(0, myQty - 1) };
      if (nextMyInv[targetReq.itemId] === 0) delete nextMyInv[targetReq.itemId];
      setMyCatInventory(nextMyInv);
      saveMyCatInventory(session.userId, nextMyInv);

      // 2. Chuyển món quà vào túi đồ của người nhận
      if (targetReq.requesterUserId === session.userId) {
        const selfInv = {
          ...nextMyInv,
          [targetReq.itemId]: (nextMyInv[targetReq.itemId] || 0) + 1,
        };
        setMyCatInventory(selfInv);
        saveMyCatInventory(session.userId, selfInv);
      } else {
        const receiverInv = loadMyCatInventory(targetReq.requesterUserId);
        receiverInv[targetReq.itemId] = (receiverInv[targetReq.itemId] || 0) + 1;
        saveMyCatInventory(targetReq.requesterUserId, receiverInv);
      }

      // 3. Tự động đóng yêu cầu (status = 'fulfilled') & đồng bộ đa thiết bị
      setGiftRequests((prev) => {
        const nextList = prev.map((r) =>
          r.id === reqId
            ? {
                ...r,
                status: 'fulfilled' as const,
                fulfilledByNickname: session.nickname,
              }
            : r
        );
        saveRoomGiftRequests(room.code, nextList);
        broadcastCatSyncEvent({
          roomCode: room.code,
          roomCats,
          giftRequests: nextList,
          giftTransfer: {
            reqId,
            receiverUserId: targetReq.requesterUserId,
            itemId: targetReq.itemId,
            giverNickname: session.nickname,
          },
        });
        return nextList;
      });

      const item = CAT_SHOP_ITEMS.find((i) => i.id === targetReq.itemId);
      sendChatMessage(
        room.code,
        `💝 [ĐÃ TẶNG QUÀ] ${session.nickname} vừa tặng 1x ${
          item ? `${item.icon} ${item.name}` : targetReq.itemId
        } cho bé mèo "${targetReq.catName}" của ${targetReq.requesterNickname}!`,
        `giftdone-${Date.now()}`,
        session.sessionToken
      ).catch(() => {});
    },
    [room, session, giftRequests, myCatInventory, roomCats]
  );

  const handlePetCatIn3D = useCallback(
    (cat: OfficeCatProfile) => {
      if (!room) return;
      playCatMeowSound('happy');
      const updated: OfficeCatProfile = {
        ...cat,
        petCount: (cat.petCount || 0) + 1,
        happiness: Math.min(100, (cat.happiness || 80) + 10),
        updatedAt: Date.now(),
      };
      setRoomCats((prev) => {
        const nextMap = { ...prev, [cat.ownerUserId]: updated };
        saveRoomCats(room.code, nextMap);
        broadcastCatSyncEvent({
          roomCode: room.code,
          roomCats: nextMap,
          giftRequests,
        });
        return nextMap;
      });
      showToast(
        `🤚 Meow~ Bạn vừa vuốt ve bé "${cat.catName}" (${cat.ownerNickname})! 💕`
      );
    },
    [room, showToast, giftRequests]
  );

  // ==================== GAME GHÉP TRANH CÙNG PHÒNG ====================
  const handlePlacePuzzlePiece = useCallback(
    (pieceIdx: number): { ok: boolean; alreadyTaken?: boolean; completedNow?: boolean } => {
      if (!room || !session) return { ok: false };
      let resultStatus: { ok: boolean; alreadyTaken?: boolean; completedNow?: boolean } = {
        ok: true,
      };
      setRoomPuzzleState((prev) => {
        if (prev.placedPieces[pieceIdx]) {
          resultStatus = { ok: false, alreadyTaken: true };
          return prev;
        }
        const artwork = resolveActivePuzzleArtwork(prev);
        const totalPieces = artwork.gridCols * artwork.gridRows;
        const nextPlaced = {
          ...prev.placedPieces,
          [pieceIdx]: {
            placedByNickname: session.nickname,
            placedAt: Date.now(),
          },
        };
        const isDone = Object.keys(nextPlaced).length >= totalPieces;
        let nextGallery = prev.completedGallery;
        if (isDone) {
          const contributors = Array.from(
            new Set(Object.values(nextPlaced).map((p) => p.placedByNickname))
          );
          const alreadyLogged = prev.completedGallery.some(
            (g) =>
              g.artworkId === artwork.id &&
              Date.now() - g.completedAt < 5000
          );
          if (!alreadyLogged) {
            nextGallery = [
              {
                id: `gal-${Date.now()}`,
                artworkId: artwork.id,
                title: artwork.title,
                imageUrl: artwork.imageUrl,
                contributors,
                completedAt: Date.now(),
              },
              ...prev.completedGallery,
            ];
            resultStatus.completedNow = true;
          }
        }
        const nextState: RoomPuzzleState = {
          ...prev,
          placedPieces: nextPlaced,
          completedGallery: nextGallery,
          updatedAt: Date.now(),
        };
        saveRoomPuzzleState(room.code, nextState);
        broadcastPuzzleSyncEvent({ roomCode: room.code, puzzleState: nextState });
        return nextState;
      });
      return resultStatus;
    },
    [room, session]
  );

  const handleSelectNextPuzzle = useCallback(
    (
      artworkId: string,
      options?: {
        gridCols?: number;
        gridRows?: number;
        customArtwork?: PuzzleArtwork | null;
      }
    ) => {
      if (!room) return;
      setRoomPuzzleState((prev) => {
        const clamped =
          options?.gridCols || options?.gridRows
            ? clampPuzzleGrid(options.gridCols ?? 3, options.gridRows ?? 3)
            : null;
        const nextState: RoomPuzzleState = {
          artworkId,
          gridCols: clamped?.gridCols ?? options?.customArtwork?.gridCols ?? 3,
          gridRows: clamped?.gridRows ?? options?.customArtwork?.gridRows ?? 3,
          customArtwork: options?.customArtwork ?? null,
          placedPieces: {},
          completedGallery: prev.completedGallery,
          updatedAt: Date.now(),
        };
        saveRoomPuzzleState(room.code, nextState);
        broadcastPuzzleSyncEvent({ roomCode: room.code, puzzleState: nextState });
        return nextState;
      });
    },
    [room]
  );

  const hydrateRoomData = useCallback(
    async (roomCode: string, sessionToken: string, isFirstJoin = false) => {
      const fullState = await fetchFullRoomState(roomCode, sessionToken);
      setRoom(fullState.room);
      setMembers(fullState.members);
      setSeats(fullState.seats);
      setMessages(fullState.messages);

      const attMap: Record<string, AttendanceStatus> = {};
      let maxSeq = 1;
      for (const rec of fullState.attendance) {
        attMap[rec.date] = rec.status;
        if (rec.seq > maxSeq) maxSeq = rec.seq;
      }
      attendanceSeqRef.current = maxSeq + 1;
      setAttendanceMap(attMap);
      setDiaryFeed(fullState.diaryFeed);
      setMyDiary(fullState.myDiary);

      if (isFirstJoin) {
        const myCurrentSeat = fullState.seats.find(
          (s) => s.occupiedByUserId === loadSavedSession()?.userId
        );
        if (!myCurrentSeat) {
          showToast('Chào mừng bạn! Hãy bấm vào một ghế trống trong phòng để chọn chỗ ngồi cố định.');
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    // Kết nối kênh đồng bộ ngay khi mở trang (kể cả ở màn hình đăng nhập) để nhận sẵn danh sách phòng & tài khoản qua MQTT
    const unsubPreload = subscribeStaticRealtime(() => {});
    const saved = loadSavedSession();
    const inviteCode = getInviteRoomFromUrl();

    if (!saved) {
      setInitializing(false);
      return () => {
        unsubPreload();
      };
    }

    const targetRoomCode = inviteCode || saved.roomCode || DEFAULT_ROOM_CODE;
    (async () => {
      try {
        const joined = await joinOrRestoreRoom({
          roomCode: targetRoomCode,
          nickname: saved.nickname,
          avatarGender: saved.avatarGender,
          sessionToken: saved.sessionToken,
          createIfMissing: true,
        });
        setSession(joined.session);
        await hydrateRoomData(joined.room.code, joined.session.sessionToken, false);
      } catch (err) {
        console.warn('Could not restore saved session, clearing:', err);
        clearSavedSession();
      } finally {
        setInitializing(false);
      }
    })();

    return () => {
      unsubPreload();
    };
  }, [hydrateRoomData]);

  useEffect(() => {
    if (!session || !room) return;

    const handleRealtimePayload = (data: Record<string, unknown>) => {
      if (data.type === 'member_kicked') {
        const kickedId = String(data.kickedUserId || '');
        const kickedName = String(data.kickedNickname || 'Thành viên');
        if (kickedId === session.userId) {
          clearSavedSession();
          setSession(null);
          setRoom(null);
          setActivePanel('none');
          setEntryError('Bạn đã bị Trưởng phòng xóa ra khỏi văn phòng.');
          return;
        }
        if (data.room && typeof data.room === 'object') {
          setRoom(data.room as RoomInfo);
        }
        if (Array.isArray(data.members)) setMembers(data.members as RoomMember[]);
        if (Array.isArray(data.seats)) setSeats(data.seats as WorkSeat[]);
        showToast(`Trưởng phòng đã xóa ${kickedName} ra khỏi phòng.`);
        return;
      }

      if (data.type === 'member_left') {
        const leftId = String(data.leftUserId || '');
        const leftName = String(data.leftNickname || 'Thành viên');
        if (data.room && typeof data.room === 'object') {
          setRoom(data.room as RoomInfo);
        }
        if (Array.isArray(data.members)) {
          setMembers(data.members as RoomMember[]);
        } else if (leftId) {
          setMembers((prev) => prev.filter((m) => m.userId !== leftId));
        }
        if (Array.isArray(data.seats)) {
          setSeats(data.seats as WorkSeat[]);
        } else if (leftId) {
          setSeats((prev) =>
            prev.map((s) =>
              s.occupiedByUserId === leftId
                ? { ...s, occupiedByUserId: null, occupiedByNickname: null, occupiedByTag: null }
                : s
            )
          );
        }
        if (leftId && leftId !== session.userId) {
          showToast(`${leftName} đã rời khỏi phòng.`);
        }
        return;
      }

      if (data.roomCats && typeof data.roomCats === 'object') {
        const incomingCats = data.roomCats as Record<string, OfficeCatProfile>;
        setRoomCats((prev) => {
          const merged = { ...prev, ...incomingCats };
          saveRoomCats(room.code, merged);
          return merged;
        });
      }

      if (Array.isArray(data.giftRequests)) {
        const incomingGifts = data.giftRequests as CatGiftRequest[];
        setGiftRequests(incomingGifts);
        saveRoomGiftRequests(room.code, incomingGifts);
      }

      if (data.type === 'puzzle_state_sync' && data.puzzleState) {
        const incomingPuzzle = data.puzzleState as RoomPuzzleState;
        setRoomPuzzleState((prev) => {
          let merged: RoomPuzzleState;
          if (incomingPuzzle.artworkId === prev.artworkId) {
            const mergedPieces = { ...prev.placedPieces };
            for (const [k, v] of Object.entries(incomingPuzzle.placedPieces || {})) {
              const idx = Number(k);
              const cur = mergedPieces[idx];
              if (!cur || v.placedAt < cur.placedAt) {
                mergedPieces[idx] = v;
              }
            }
            const galMap = new Map(prev.completedGallery.map((g) => [g.id, g]));
            for (const g of incomingPuzzle.completedGallery || []) {
              galMap.set(g.id, g);
            }
            merged = {
              artworkId: prev.artworkId,
              gridCols: incomingPuzzle.gridCols ?? prev.gridCols,
              gridRows: incomingPuzzle.gridRows ?? prev.gridRows,
              customArtwork: incomingPuzzle.customArtwork ?? prev.customArtwork,
              placedPieces: mergedPieces,
              completedGallery: Array.from(galMap.values()).sort(
                (a, b) => b.completedAt - a.completedAt
              ),
              updatedAt: Math.max(prev.updatedAt, incomingPuzzle.updatedAt),
            };
          } else {
            merged = incomingPuzzle;
          }
          saveRoomPuzzleState(room.code, merged);
          return merged;
        });
        return;
      }

      if (data.type === 'cat_state_sync') {
        if (data.giftTransfer && typeof data.giftTransfer === 'object') {
          const gt = data.giftTransfer as {
            reqId: string;
            receiverUserId: string;
            itemId: string;
            giverNickname: string;
          };
          if (gt.receiverUserId === session.userId) {
            const curInv = loadMyCatInventory(session.userId);
            const nextInv = { ...curInv, [gt.itemId]: (curInv[gt.itemId] || 0) + 1 };
            setMyCatInventory(nextInv);
            saveMyCatInventory(session.userId, nextInv);
            const giftedItem = CAT_SHOP_ITEMS.find((i) => i.id === gt.itemId);
            playCatMeowSound('adopt');
            showToast(
              `🎁 ${gt.giverNickname} vừa tặng bạn 1x ${
                giftedItem ? `${giftedItem.icon} ${giftedItem.name}` : gt.itemId
              }! Đã thêm vào Túi đồ.`
            );
          }
        }
        return;
      }

      if (data.type === 'connected' || data.type === 'room_state') {
        if (data.room && typeof data.room === 'object') {
          setRoom(data.room as RoomInfo);
        }
        if (Array.isArray(data.members)) setMembers(data.members as RoomMember[]);
        if (Array.isArray(data.seats)) setSeats(data.seats as WorkSeat[]);
        if (Array.isArray(data.messages)) setMessages(data.messages as ChatMessage[]);
      } else if (data.type === 'chat_cleared') {
        setMessages([]);
        setUnreadChatCount(0);
        setChatAlertBanner(null);
      } else if (data.type === 'chat_message' && data.message) {
        const incoming = data.message as ChatMessage;
        let isNewMsg = false;
        setMessages((prev) => {
          const exists = prev.some(
            (m) =>
              m.id === incoming.id ||
              (m.clientMsgId && m.clientMsgId === incoming.clientMsgId)
          );
          if (exists) {
            return prev.map((m) =>
              m.clientMsgId === incoming.clientMsgId ? { ...incoming, status: 'sent' } : m
            );
          }
          isNewMsg = true;
          return [...prev, { ...incoming, status: 'sent' }];
        });
        triggerSpeechBubble(incoming.userId, incoming.content);

        // Hiện thông báo tin nhắn nổi toàn cục cho người chơi dù đang ở bất kỳ màn hình nào
        if (incoming.userId !== session.userId || isNewMsg || activePanelRef.current !== 'chat') {
          triggerGlobalChatAlert(incoming);
        }

        if (
          incoming.content.startsWith('🎯 [THÁCH ĐẤU PHI TIÊU]') &&
          incoming.userId !== session.userId
        ) {
          setActiveChallengeBanner(incoming.content);
        }
      } else if (data.type === 'donation_box_sync' && data.donationBox) {
        const incomingBox = data.donationBox as RoomDonationBoxState;
        setRoomDonationBox((prev) => {
          const donMap = new Map(prev.donations.map((d) => [d.id, d]));
          for (const d of incomingBox.donations || []) {
            donMap.set(d.id, d);
          }
          const mergedDonations = Array.from(donMap.values())
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 50);
          const sumDonations = mergedDonations.reduce((acc, d) => acc + d.amountVnd, 0);
          const merged: RoomDonationBoxState = {
            totalVnd: Math.max(prev.totalVnd, incomingBox.totalVnd, sumDonations),
            donations: mergedDonations,
            updatedAt: Math.max(prev.updatedAt, incomingBox.updatedAt),
          };
          saveRoomDonationBoxState(room.code, merged);
          return merged;
        });
      } else if (data.type === 'attendance_reminder') {
        const sender = String(data.senderNickname || 'Phòng');
        const msg = `📣 ${sender} nhắc cả phòng nhớ chấm công hôm nay (1 lần/ngày • 800.000đ)!`;
        setAttendanceReminderBanner(msg);
        playChatNotificationSound();
        sendDesktopNotification({
          title: '⏰ Nhắc nhở chấm công từ văn phòng',
          body: msg,
          tag: 'office-attendance-reminder',
          onClick: () => setActivePanel('attendance'),
        });
      } else if (data.type === 'diary_sync') {
        fetchDiaryLists(room.code, session.sessionToken)
          .then(({ feed, mine }) => {
            setDiaryFeed(feed);
            setMyDiary(mine);
            const newest = feed[0];
            if (newest && !mine.some((m) => m.id === newest.id)) {
              setDiaryAlertBanner('📔 Có bài nhật ký mới vừa được chia sẻ trong phòng!');
              sendDesktopNotification({
                title: '📔 Nhật ký mới trong văn phòng',
                body: 'Một đồng nghiệp vừa chia sẻ nhật ký mới. Bấm để xem.',
                tag: `diary-${newest.id}`,
                onClick: () => setActivePanel('diary'),
              });
            }
          })
          .catch((err) => console.error('Failed to sync diary:', err));
      }
    };

    const unsubscribeStatic = subscribeStaticRealtime((evt) => {
      if (evt.roomId !== room.id && evt.roomCode !== room.code) return;
      if (evt.hiddenUserIds && evt.hiddenUserIds.includes(session.userId)) return;
      handleRealtimePayload(evt.payload);
    });

    if (isUsingStaticFallback()) {
      return () => {
        unsubscribeStatic();
      };
    }

    const url = `/api/rooms/${encodeURIComponent(room.code)}/events?token=${encodeURIComponent(
      session.sessionToken
    )}`;
    const es = new EventSource(officeApiUrl(url));

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        handleRealtimePayload(data);
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    return () => {
      unsubscribeStatic();
      es.close();
    };
  }, [session, room, triggerSpeechBubble, showToast]);

  const handleJoinRoom = async (params: {
    roomCode: string;
    nickname: string;
    password?: string;
    avatarGender: AvatarGender;
    createIfMissing: boolean;
    rememberDevice?: boolean;
  }) => {
    setEntryLoading(true);
    setEntryError(null);
    try {
      const joined = await joinOrRestoreRoom({
        roomCode: params.roomCode,
        nickname: params.nickname,
        password: params.password,
        avatarGender: params.avatarGender,
        createIfMissing: params.createIfMissing,
        rememberDevice: params.rememberDevice,
      });
      setSession(joined.session);
      await hydrateRoomData(joined.room.code, joined.session.sessionToken, true);
    } catch (err) {
      setEntryError(
        err instanceof Error ? err.message : 'Không thể vào văn phòng. Vui lòng thử lại.'
      );
    } finally {
      setEntryLoading(false);
    }
  };

  const handleSaveAccountPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !room) return;
    const trimmed = newPasswordDraft.trim();
    if (!trimmed) {
      setPasswordPromptError('Vui lòng nhập mật khẩu riêng của bạn.');
      return;
    }
    setSavingPassword(true);
    setPasswordPromptError(null);
    try {
      await setAccountPasswordApi(room.code, trimmed, session.sessionToken);
      setSession({ ...session, hasPassword: true });
      setNewPasswordDraft('');
      showToast('🔐 Đã lưu mật khẩu & ghi nhớ trên thiết bị của bạn!');
    } catch (err) {
      setPasswordPromptError(
        err instanceof Error ? err.message : 'Không thể lưu mật khẩu.'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSelectSeat = async (seatId: string) => {
    if (!session || !room || claimingSeatId) return;
    setClaimingSeatId(seatId);
    setSeatError(null);
    if (activePanel === 'zen') setActivePanel('none');
    try {
      const res = await claimWorkSeat(room.code, seatId, session.sessionToken);
      setSeats(res.seats);
      setMembers(res.members);
      const layout = WORK_SEAT_LAYOUTS.find((l) => l.seatId === seatId);
      showToast(`Đã lưu cố định chỗ ngồi: ${layout ? layout.label : seatId}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể chọn ghế này. Vui lòng thử ghế khác.';
      setSeatError(msg);
      showToast(msg);
      fetchFullRoomState(room.code, session.sessionToken)
        .then((st) => {
          setSeats(st.seats);
          setMembers(st.members);
        })
        .catch(() => {});
    } finally {
      setClaimingSeatId(null);
    }
  };

  const handleStandNearDoor = async () => {
    if (!session || !room) return;
    setSeatError(null);
    try {
      const res = await leaveWorkSeatToStand(room.code, session.sessionToken);
      setSeats(res.seats);
      setMembers(res.members);
      showToast('Nhân vật của bạn đã di chuyển ra khu vực đứng gần cửa.');
    } catch (err) {
      setSeatError(err instanceof Error ? err.message : 'Không thể rời ghế.');
    }
  };

  const handleSelectMeetingChair = async (chairId: string | null) => {
    if (!session || !room) return;
    setSeatError(null);
    if (activePanel === 'zen') setActivePanel('none');
    try {
      const res = await sitAtMeetingChair(room.code, chairId, session.sessionToken);
      setSeats(res.seats);
      setMembers(res.members);
      if (chairId) {
        const chairObj = MEETING_CHAIRS.find((c) => c.id === chairId);
        showToast(`Đã vào ngồi tự do tại ${chairObj ? chairObj.label : 'bàn họp chung'}.`);
      } else {
        showToast('Đã rời bàn họp chung.');
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể ngồi vào ghế bàn họp này.';
      setSeatError(msg);
      showToast(msg);
    }
  };

  const handleTransferManager = async (targetUserId: string) => {
    if (!session || !room) return;
    setSeatError(null);
    try {
      const res = await transferRoomManager(room.code, targetUserId, session.sessionToken);
      setRoom(res.room);
      setMembers(res.members);
      setSeats(res.seats);
      const targetMember = res.members.find((m) => m.userId === targetUserId);
      showToast(
        `👑 Đã chuyển quyền Trưởng phòng cho ${targetMember ? targetMember.nickname : 'thành viên'}.`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể chuyển quyền Trưởng phòng.';
      setSeatError(msg);
      showToast(msg);
    }
  };

  const handleKickMember = async (targetUserId: string) => {
    if (!session || !room) return;
    setSeatError(null);
    try {
      const res = await kickRoomMember(room.code, targetUserId, session.sessionToken);
      setRoom(res.room);
      setMembers(res.members);
      setSeats(res.seats);
      showToast(`Đã xóa ${res.kickedNickname} ra khỏi văn phòng.`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể xóa người chơi khỏi phòng.';
      setSeatError(msg);
      showToast(msg);
    }
  };

  const handleSendMessage = async (content: string, existingClientMsgId?: string) => {
    if (!session || !room) return;
    const clientMsgId =
      existingClientMsgId ||
      `cmsg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const optimisticMsg: ChatMessage = {
      id: clientMsgId,
      roomId: room.id,
      userId: session.userId,
      nickname: session.nickname,
      memberTag: session.memberTag,
      clientMsgId,
      content,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => {
      const exists = prev.some((m) => m.clientMsgId === clientMsgId);
      if (exists) {
        return prev.map((m) =>
          m.clientMsgId === clientMsgId ? { ...m, status: 'sending' } : m
        );
      }
      return [...prev, optimisticMsg];
    });

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      window.Notification.permission === 'default'
    ) {
      window.Notification.requestPermission().catch(() => {});
    }

    try {
      const { message } = await sendChatMessage(
        room.code,
        content,
        clientMsgId,
        session.sessionToken
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMsgId === clientMsgId ? { ...message, status: 'sent' } : m
        )
      );
      triggerSpeechBubble(session.userId, message.content);
      triggerGlobalChatAlert(message);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMsgId === clientMsgId ? { ...m, status: 'failed' } : m
        )
      );
    }
  };

  const handleCycleAttendanceDay = async (dateStr: string) => {
    if (!session || !room) return;
    const currentStatus: AttendanceStatus = attendanceMap[dateStr] ?? 'none';
    if (currentStatus !== 'none') {
      showToast('⚠️ Mỗi ngày chỉ được chấm công 1 lần!');
      return;
    }
    const nextStatus: AttendanceStatus = 'full';
    const nextSeq = attendanceSeqRef.current++;

    setAttendanceError(null);
    setFailedAttendanceDate(null);

    setAttendanceMap((prev) => ({
      ...prev,
      [dateStr]: nextStatus,
    }));

    try {
      await updateAttendanceDay(
        room.code,
        dateStr,
        nextStatus,
        nextSeq,
        session.sessionToken
      );
    } catch (err) {
      setAttendanceError(
        err instanceof Error
          ? err.message
          : `Lưu chấm công ngày ${dateStr} thất bại. Vui lòng thử lại.`
      );
      setFailedAttendanceDate(dateStr);
    }
  };

  const handleRetryFailedAttendance = async (dateStr: string) => {
    if (!session || !room) return;
    const statusToSave = attendanceMap[dateStr] ?? 'none';
    const nextSeq = attendanceSeqRef.current++;
    setAttendanceError(null);
    try {
      await updateAttendanceDay(
        room.code,
        dateStr,
        statusToSave,
        nextSeq,
        session.sessionToken
      );
      setFailedAttendanceDate(null);
    } catch (err) {
      setAttendanceError(
        err instanceof Error ? err.message : 'Vẫn chưa thể lưu chấm công. Hãy thử lại.'
      );
    }
  };

  const handleCreateDiary = async (payload: {
    mood: 'joy' | 'sadness' | 'pressure' | 'unsaid';
    content: string;
    hiddenUserIds: string[];
  }) => {
    if (!session || !room) return;
    await createDiaryEntry(room.code, payload, session.sessionToken);
    const { feed, mine } = await fetchDiaryLists(room.code, session.sessionToken);
    setDiaryFeed(feed);
    setMyDiary(mine);
    showToast('Đã đăng bài lên bảng tâm sự ẩn danh của phòng.');
  };

  const handleUpdateDiary = async (
    entryId: string,
    payload: {
      mood: 'joy' | 'sadness' | 'pressure' | 'unsaid';
      content: string;
      hiddenUserIds: string[];
    }
  ) => {
    if (!session || !room) return;
    await updateDiaryEntry(room.code, entryId, payload, session.sessionToken);
    const { feed, mine } = await fetchDiaryLists(room.code, session.sessionToken);
    setDiaryFeed(feed);
    setMyDiary(mine);
    showToast('Đã cập nhật bài tâm sự và quyền xem.');
  };

  const handleLookupDiaryById = async (entryId: string): Promise<PublicDiaryEntry | null> => {
    if (!session || !room) return null;
    const res = await fetchSingleDiaryEntry(room.code, entryId, session.sessionToken);
    return res.entry;
  };

  const handleCopyInviteLink = () => {
    if (!room) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', room.code);
    url.searchParams.delete('session');
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleSaveNewRoomCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !room) return;
    const cleaned = newRoomCodeDraft.trim().toUpperCase();
    if (!cleaned || cleaned === room.code) {
      setEditingRoomCode(false);
      return;
    }
    try {
      const updated = await changeRoomCodeApi(room.code, cleaned, session.sessionToken);
      setSession(updated.session);
      setRoom(updated.room);
      setMembers(updated.members);
      setSeats(updated.seats);
      setEditingRoomCode(false);
      showToast(`Đã đổi ID phòng thành: ${updated.room.code}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể đổi mã phòng.');
    }
  };

  const handleLogoutOrSwitch = async () => {
    if (session && room) {
      try {
        await leaveRoomApi(room.code, session.sessionToken);
      } catch {
        // ignore network error on leave
      }
    }
    clearSavedSession();
    setSession(null);
    setRoom(null);
    setMembers([]);
    setSeats([]);
    setActivePanel('none');
  };

  if (initializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-5 py-3.5 shadow-xl">
          <Sparkles className="h-5 w-5 animate-spin text-emerald-400" />
          <span className="text-sm font-medium">Đang khôi phục văn phòng 3D...</span>
        </div>
      </div>
    );
  }

  if (!session || !room) {
    return (
      <EntryModal
        initialRoomCode={getInviteRoomFromUrl() || DEFAULT_ROOM_CODE}
        onJoin={handleJoinRoom}
        error={entryError}
        loading={entryLoading}
      />
    );
  }

  const mySeat = seats.find((s) => s.occupiedByUserId === session.userId);
  const mySeatLayout = mySeat
    ? WORK_SEAT_LAYOUTS.find((l) => l.seatId === mySeat.seatId)
    : null;
  const myMember = members.find((m) => m.userId === session.userId);
  const myMeetingChair = myMember?.meetingChairId
    ? MEETING_CHAIRS.find((c) => c.id === myMember.meetingChairId)
    : null;

  const zenMembersCount = members.filter(
    (m) => m.inZenRoom || (m.userId === session.userId && activePanel === 'zen')
  ).length;

  const enterZenRoom = async () => {
    try {
      const res = await setZenRoomPresenceApi(room.code, true, session.sessionToken);
      setMembers(res.members);
      setActivePanel('zen');
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Phòng Tịnh Tâm đã đủ tối đa 10 người!'
      );
    }
  };

  const exitZenRoom = () => {
    setAutoMo(false);
    setActiveBlessing(null);
    setActivePanel('none');
    setZenRoomPresenceApi(room.code, false, session.sessionToken)
      .then((res) => setMembers(res.members))
      .catch(() => {});
  };

  const togglePanel = (panel: ActivePanel) => {
    if (panel === 'zen') {
      if (activePanel === 'zen') {
        exitZenRoom();
      } else {
        void enterZenRoom();
      }
      return;
    }
    if (activePanel === 'zen') {
      setAutoMo(false);
      setActiveBlessing(null);
      setZenRoomPresenceApi(room.code, false, session.sessionToken)
        .then((res) => setMembers(res.members))
        .catch(() => {});
    }
    setActivePanel((prev) => (prev === panel ? 'none' : panel));
  };

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden select-none bg-slate-950">
      {/* CẢNH PHÒNG 3D CHÍNH & GIAN PHÒNG TỊNH TÂM 3D */}
      <OfficeScene3D
        currentUserId={session.userId}
        members={members}
        seats={seats}
        activeBubbles={activeBubbles}
        onSelectSeat={handleSelectSeat}
        onSelectMeetingChair={handleSelectMeetingChair}
        claimingSeatId={claimingSeatId}
        cameraMode={cameraMode}
        inZenRoom={activePanel === 'zen'}
        onEnterZenRoom={() => {
          void enterZenRoom();
        }}
        inGameRoom={activePanel === 'games'}
        onEnterGameRoom={() => setActivePanel('games')}
        selectedDeity={selectedDeity}
        incenseLit={incenseLit}
        isBowing={isBowing}
        moPulseKey={moPulseKey}
        floatingMeritText={floatingMeritText}
        onStrikeMo={handleStrikeMo}
        onRingBell={handleRingBell}
        onOpenDonationBox={() => {
          void enterZenRoom();
          setIsDonationModalOpen(true);
        }}
        roomCats={roomCats}
        onPetCatIn3D={handlePetCatIn3D}
      />

      {/* THANH TRÊN CÙNG SIÊU GỌN (Click vào nút Menu góc phải để xổ thêm chức năng, click lại để đóng) */}
      <header className="pointer-events-none fixed top-2 left-2 right-2 z-20 flex items-start justify-between gap-1.5">
        {/* Cụm trái: Mã phòng & Sao chép link nhanh */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/15 bg-slate-900/80 px-2.5 py-1 backdrop-blur-md shadow-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[11px] font-bold text-white truncate max-w-[95px] sm:max-w-[150px]">
            {room.name}
          </span>
          <button
            type="button"
            onClick={handleCopyInviteLink}
            title="Sao chép link mời vào phòng"
            className="inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 cursor-pointer shrink-0"
          >
            {copiedInvite ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span>Đã chép</span>
              </>
            ) : (
              <>
                <span>{room.code}</span>
                <Share2 className="h-2.5 w-2.5 text-slate-300" />
              </>
            )}
          </button>
          <span
            className="hidden sm:inline-flex items-center rounded-full bg-emerald-500/20 border border-emerald-400/35 px-2 py-0.5 text-[10px] font-black text-emerald-300"
            title="Ví tiền hiện tại (mặc định 5 triệu • nhận lương cuối tháng)"
          >
            💰 {formatVnd(userWallet.balanceVnd)}
          </span>
          {notificationPermission === 'default' && (
            <button
              type="button"
              onClick={() => void requestDesktopNotificationPermission()}
              className="rounded-full bg-amber-400 hover:bg-amber-300 px-2 py-0.5 text-[10px] font-black text-slate-950 cursor-pointer shrink-0"
              title="Bật thông báo ngoài màn hình (hiện ngay cả khi không mở tab game)"
            >
              🔔 Bật thông báo
            </button>
          )}
        </div>

        {/* Cụm phải: Góc nhìn & Nút xổ Menu cá nhân (Click để mở, click để đóng) */}
        <div className="pointer-events-auto relative flex items-center gap-1">
          <button
            type="button"
            data-testid="toggle-camera-mode-btn"
            onClick={() =>
              setCameraMode((prev) => (prev === 'overview' ? 'first_person' : 'overview'))
            }
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border shadow-md backdrop-blur-md transition-all cursor-pointer ${
              cameraMode === 'first_person'
                ? 'border-emerald-300 bg-emerald-500 text-slate-950'
                : 'border-white/15 bg-slate-900/80 text-sky-200 hover:bg-slate-800'
            }`}
            title="Đổi góc nhìn 3D / Góc nhìn thứ nhất"
          >
            {cameraMode === 'first_person' ? (
              <>
                <Compass className="h-3.5 w-3.5 shrink-0" />
                <span>Về 3D</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span>Góc nhìn 1</span>
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="top-menu-toggle-btn"
            onClick={() => setTopMenuOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-slate-900/85 hover:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-md cursor-pointer"
          >
            {myMember?.isManager && (
              <Crown
                data-testid="hud-manager-badge"
                className="h-3 w-3 text-amber-400 shrink-0"
              />
            )}
            <span data-testid="hud-user-nickname" className="truncate max-w-[75px] sm:max-w-[120px]">
              {session.nickname}
            </span>
            {topMenuOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-300" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
            )}
          </button>

          {/* HỘP MENU XỔ XUỐNG KHI CLICK (Click nút trên hoặc chọn mục để đóng gọn) */}
          {topMenuOpen && (
            <div className="absolute right-0 top-9 z-40 w-56 rounded-2xl border border-white/15 bg-slate-900/95 p-2.5 text-xs text-slate-100 shadow-2xl backdrop-blur-xl space-y-2">
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <span className="text-[11px] font-bold text-slate-400">Tiện ích phòng</span>
                <button
                  type="button"
                  onClick={() => setTopMenuOpen(false)}
                  className="text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Đóng ✕
                </button>
              </div>

              <button
                type="button"
                data-testid="hud-seat-status-btn"
                onClick={() => {
                  setTopMenuOpen(false);
                  togglePanel('seats');
                }}
                className="flex w-full items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 px-2.5 py-2 text-left font-semibold text-emerald-300 cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Armchair className="h-3.5 w-3.5" />
                  <span>
                    {myMeetingChair
                      ? `Họp ${myMeetingChair.shortLabel}`
                      : mySeatLayout
                        ? `Ghế ${mySeatLayout.shortLabel}`
                        : 'Chọn ghế ngồi'}
                  </span>
                </span>
                <span className="text-[10px] text-slate-400">Đổi →</span>
              </button>

              {editingRoomCode ? (
                <form onSubmit={handleSaveNewRoomCode} className="flex items-center gap-1">
                  <input
                    type="text"
                    autoFocus
                    maxLength={20}
                    value={newRoomCodeDraft}
                    onChange={(e) => setNewRoomCodeDraft(e.target.value.toUpperCase())}
                    placeholder="ID phòng..."
                    className="w-full rounded-lg border border-emerald-400 bg-slate-950 px-2 py-1 text-xs font-mono font-bold uppercase text-emerald-300 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-500 px-2 py-1 text-[11px] font-bold text-slate-950 cursor-pointer"
                  >
                    Lưu
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNewRoomCodeDraft(room.code);
                    setEditingRoomCode(true);
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-left text-slate-200 cursor-pointer"
                >
                  <span>Mã phòng: <strong className="font-mono text-emerald-300">{room.code}</strong></span>
                  <PenSquare className="h-3.5 w-3.5 text-emerald-400" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setTopMenuOpen(false);
                  handleLogoutOrSwitch();
                }}
                className="flex w-full items-center gap-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 px-2.5 py-1.5 font-semibold text-rose-300 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Rời phòng / Đổi tên</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* THÔNG BÁO YÊU CẦU TẠO MẬT KHẨU RIÊNG CHO TÀI KHOẢN CHƯA CÓ MẬT KHẨU */}
      {!session.hasPassword && (
        <div
          data-testid="create-password-prompt-modal"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
        >
          <form
            onSubmit={handleSaveAccountPassword}
            className="w-full max-w-sm rounded-3xl border-2 border-amber-400/60 bg-slate-900 p-5 text-slate-100 shadow-2xl space-y-3.5"
          >
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                🔐 Cập nhật bảo mật tài khoản
              </div>
              <h3 className="text-base font-black text-white">
                Tạo Mật Khẩu Cho "{session.nickname}"
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Hệ thống vừa nâng cấp chống trùng tên. Hãy tạo mật khẩu riêng để lần sau đăng nhập đúng tài khoản này và hệ thống sẽ{' '}
                <strong className="text-emerald-300">tự động ghi nhớ trên thiết bị của bạn</strong>.
              </p>
            </div>

            <input
              type="password"
              required
              autoFocus
              maxLength={64}
              value={newPasswordDraft}
              onChange={(e) => setNewPasswordDraft(e.target.value)}
              placeholder="Nhập mật khẩu riêng của bạn..."
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none"
            />

            {passwordPromptError && (
              <div className="rounded-xl bg-rose-500/20 border border-rose-500/40 px-3 py-2 text-xs text-rose-200">
                {passwordPromptError}
              </div>
            )}

            <button
              type="submit"
              disabled={savingPassword || !newPasswordDraft.trim()}
              className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 py-2.5 text-sm font-black text-slate-950 shadow-lg cursor-pointer"
            >
              {savingPassword ? 'Đang lưu...' : '💾 Lưu mật khẩu & Ghi nhớ thiết bị'}
            </button>
          </form>
        </div>
      )}

      {/* THÔNG BÁO CÓ BẢN CẬP NHẬT MỚI (Nhắc Refresh ngay khi có chỉnh sửa) */}
      {updateAvailableBanner && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[105] flex items-center justify-between gap-2.5 w-[calc(100vw-24px)] max-w-md rounded-2xl border-2 border-sky-400 bg-slate-950/95 px-3.5 py-2.5 text-xs text-white shadow-2xl backdrop-blur-xl">
          <span className="font-bold text-sky-200">
            🔄 Văn phòng vừa có bản chỉnh sửa mới!
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-sky-400 hover:bg-sky-300 px-2.5 py-1 text-[11px] font-black text-slate-950 cursor-pointer"
            >
              Làm mới ngay
            </button>
            <button
              type="button"
              onClick={() => setUpdateAvailableBanner(false)}
              className="rounded-lg p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* THÔNG BÁO NHẮC CHẤM CÔNG / NHẬT KÝ MỚI */}
      {(attendanceReminderBanner || diaryAlertBanner) && !chatAlertBanner && !updateAvailableBanner && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[95] flex items-center justify-between gap-2.5 w-[calc(100vw-24px)] max-w-md rounded-2xl border-2 border-amber-400 bg-slate-950/95 px-3.5 py-2.5 text-xs text-white shadow-2xl backdrop-blur-xl">
          <span className="font-bold text-amber-200 truncate">
            {attendanceReminderBanner || diaryAlertBanner}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (attendanceReminderBanner) {
                  setAttendanceReminderBanner(null);
                  setActivePanel('attendance');
                } else {
                  setDiaryAlertBanner(null);
                  setActivePanel('diary');
                }
              }}
              className="rounded-xl bg-amber-400 hover:bg-amber-300 px-2.5 py-1 text-[11px] font-black text-slate-950 cursor-pointer"
            >
              {attendanceReminderBanner ? 'Chấm công' : 'Xem nhật ký'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAttendanceReminderBanner(null);
                setDiaryAlertBanner(null);
              }}
              className="rounded-lg p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* THÔNG BÁO TIN NHẮN NỔI TOÀN CỤC (Hiện trên cùng mọi phòng/game/bảng khi có tin nhắn mới) */}
      {chatAlertBanner && (
        <div
          data-testid="global-chat-alert-banner"
          className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] flex items-center justify-between gap-2.5 w-[calc(100vw-24px)] max-w-md rounded-2xl border-2 border-emerald-400 bg-slate-950/95 px-3.5 py-2.5 text-xs text-white shadow-2xl backdrop-blur-xl"
        >
          <div
            onClick={() => {
              setChatAlertBanner(null);
              setActivePanel('chat');
            }}
            className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950 font-black">
              💬
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-black text-emerald-300 truncate">
                {chatAlertBanner.senderNickname} vừa nhắn tin:
              </div>
              <div className="text-slate-100 truncate font-medium">
                {chatAlertBanner.content}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {chatAlertBanner.content.includes('[RỦ THIỀN]') && activePanel !== 'zen' && (
              <button
                type="button"
                onClick={() => {
                  setChatAlertBanner(null);
                  void enterZenRoom();
                }}
                className="rounded-xl bg-amber-400 hover:bg-amber-300 px-2.5 py-1 text-[11px] font-black text-slate-950 cursor-pointer"
              >
                🪷 Vào Tịnh Tâm
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setChatAlertBanner(null);
                setActivePanel('chat');
              }}
              className="rounded-xl bg-emerald-500 hover:bg-emerald-400 px-2.5 py-1 text-[11px] font-black text-slate-950 cursor-pointer"
            >
              Xem
            </button>
            <button
              type="button"
              onClick={() => setChatAlertBanner(null)}
              className="rounded-lg p-1 text-slate-400 hover:text-white cursor-pointer"
              title="Đóng thông báo"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* THÔNG BÁO NHANH (TOAST) */}
      {toastMessage && (
        <div
          data-testid="toast-banner"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[90] rounded-2xl border border-emerald-400/40 bg-slate-900/95 px-4 py-2 text-xs font-medium text-emerald-200 shadow-2xl backdrop-blur-md"
        >
          {toastMessage}
        </div>
      )}

      {/* CÁC BẢNG CHỨC NĂNG */}
      <SeatSelectorModal
        isOpen={activePanel === 'seats'}
        onClose={() => setActivePanel('none')}
        currentUserId={session.userId}
        seats={seats}
        members={members}
        onClaimSeat={handleSelectSeat}
        onSelectMeetingChair={handleSelectMeetingChair}
        onStandNearDoor={handleStandNearDoor}
        onTransferManager={handleTransferManager}
        onKickMember={handleKickMember}
        claimingSeatId={claimingSeatId}
        seatError={seatError}
      />

      <ChatDrawer
        isOpen={activePanel === 'chat'}
        onClose={() => setActivePanel('none')}
        currentUserId={session.userId}
        messages={messages}
        members={members}
        onSendMessage={handleSendMessage}
      />

      <AttendanceDrawer
        isOpen={activePanel === 'attendance'}
        onClose={() => setActivePanel('none')}
        attendanceMap={attendanceMap}
        onCycleDay={handleCycleAttendanceDay}
        onRetryFailedDay={handleRetryFailedAttendance}
        failedDate={failedAttendanceDate}
        attendanceError={attendanceError}
        walletBalanceVnd={userWallet.balanceVnd}
        onBroadcastReminder={() => {
          broadcastAttendanceReminderEvent({
            roomCode: room.code,
            senderNickname: session.nickname,
          });
          showToast('📣 Đã gửi nhắc nhở chấm công tới cả phòng!');
        }}
      />

      <DiaryDrawer
        isOpen={activePanel === 'diary'}
        onClose={() => setActivePanel('none')}
        currentUserId={session.userId}
        members={members}
        publicFeed={diaryFeed}
        myEntries={myDiary}
        onCreateEntry={handleCreateDiary}
        onUpdateEntry={handleUpdateDiary}
        onLookupById={handleLookupDiaryById}
      />

      <ZenSanctuaryOverlay
        isOpen={activePanel === 'zen'}
        onExitZenRoom={exitZenRoom}
        selectedDeity={selectedDeity}
        onSelectDeity={(d) => {
          setSelectedDeity(d);
          setActiveBlessing(null);
        }}
        meritCount={meritCount}
        incenseLit={incenseLit}
        isBowing={isBowing}
        autoMo={autoMo}
        soundEnabled={soundEnabled}
        selectedTrackId={zenTrackId}
        customTrackName={customZenTrackName}
        onSelectTrack={(trackId) => {
          setZenTrackId(trackId);
          if (trackId !== 'off' && !soundEnabled) {
            setSoundEnabled(true);
          }
        }}
        onUploadCustomMp3={handleUploadCustomZenMp3}
        activeBlessing={activeBlessing}
        cameraMode={cameraMode}
        onToggleCameraMode={() =>
          setCameraMode((prev) => (prev === 'overview' ? 'first_person' : 'overview'))
        }
        onStrikeMo={handleStrikeMo}
        onRingBell={handleRingBell}
        onBow={handleBowToDeity}
        onLightIncense={() => setIncenseLit((v) => !v)}
        onToggleAutoMo={() => setAutoMo((v) => !v)}
        onToggleSound={() => setSoundEnabled((v) => !v)}
        zenCount={zenMembersCount}
        onInviteToZenRoom={() => {
          handleSendMessage(
            `🪷 [RỦ THIỀN] ${session.nickname} đang ngồi ở Phòng Tịnh Tâm (${zenMembersCount}/10 người) — Mọi người bấm vào Phòng Tịnh Tâm để vào ngồi chung nhé!`
          ).catch(() => {});
          showToast('📣 Đã gửi lời rủ mọi người vào Phòng Tịnh Tâm!');
        }}
        walletBalanceVnd={userWallet.balanceVnd}
        donationBox={roomDonationBox}
        isDonationModalOpen={isDonationModalOpen}
        onOpenDonationModal={() => setIsDonationModalOpen(true)}
        onCloseDonationModal={() => setIsDonationModalOpen(false)}
        onDonateToBox={handleDonateToBox}
      />

      <EntertainmentRoomModal
        isOpen={activePanel === 'games'}
        onExitGameRoom={() => setActivePanel('none')}
        currentUserId={session.userId}
        currentNickname={session.nickname}
        members={members}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
        onBroadcastChallengeMessage={(text) => {
          handleSendMessage(text).catch(() => {});
        }}
        activeChallengeBanner={activeChallengeBanner}
        meritCount={meritCount}
        onSpendMerit={handleSpendMerit}
        roomCats={roomCats}
        myCatInventory={myCatInventory}
        giftRequests={giftRequests}
        onAdoptOrUpdateMyCat={handleAdoptOrUpdateMyCat}
        onUpdateMyCatInventory={handleUpdateMyCatInventory}
        onCreateGiftRequest={handleCreateGiftRequest}
        onFulfillGiftRequest={handleFulfillGiftRequest}
        roomPuzzleState={roomPuzzleState}
        onPlacePuzzlePiece={handlePlacePuzzlePiece}
        onSelectNextPuzzle={handleSelectNextPuzzle}
      />

      {/* THANH ĐIỀU KHIỂN DƯỚI CÙNG (Có thể click thu gọn / mở rộng để không che màn hình) */}
      {dockCollapsed ? (
        <button
          type="button"
          data-testid="expand-bottom-dock-btn"
          onClick={() => setDockCollapsed(false)}
          className="fixed bottom-2.5 right-3 z-30 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-slate-900/90 hover:bg-slate-800 px-3.5 py-2 text-xs font-extrabold text-amber-300 shadow-2xl backdrop-blur-xl cursor-pointer"
        >
          <ChevronUp className="h-4 w-4" />
          <span>Menu</span>
          {unreadChatCount > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-black text-white animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>
      ) : (
        <nav
          aria-label="Điều khiển văn phòng"
          className="fixed bottom-2 left-1/2 -translate-x-1/2 z-30 flex items-center justify-between sm:justify-center gap-0.5 sm:gap-1 rounded-2xl sm:rounded-full border border-white/20 bg-slate-900/90 px-1.5 sm:px-3 py-1 sm:py-1.5 backdrop-blur-xl shadow-2xl w-[calc(100vw-12px)] sm:w-auto max-w-xl"
        >
          <button
            type="button"
            data-testid="dock-seats-btn"
            onClick={() => togglePanel('seats')}
            className={`flex flex-1 sm:flex-initial flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap rounded-xl sm:rounded-full px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
              activePanel === 'seats'
                ? 'bg-sky-500 text-slate-950 shadow'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <Armchair className="h-3.5 w-3.5 shrink-0" />
            <span>Ghế</span>
          </button>

          <button
            type="button"
            data-testid="dock-chat-btn"
            onClick={() => togglePanel('chat')}
            className={`relative flex flex-1 sm:flex-initial flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap rounded-xl sm:rounded-full px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
              activePanel === 'chat'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            <span>Chat</span>
            {unreadChatCount > 0 ? (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] font-black text-white animate-bounce">
                {unreadChatCount}
              </span>
            ) : (
              messages.length > 0 && (
                <span className="rounded-full bg-white/20 px-1 text-[9px] hidden sm:inline">
                  {messages.length}
                </span>
              )
            )}
          </button>

          <button
            type="button"
            data-testid="dock-attendance-btn"
            onClick={() => togglePanel('attendance')}
            className={`flex flex-1 sm:flex-initial flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap rounded-xl sm:rounded-full px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
              activePanel === 'attendance'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
            <span>Công</span>
          </button>

          <button
            type="button"
            data-testid="dock-diary-btn"
            onClick={() => togglePanel('diary')}
            className={`flex flex-1 sm:flex-initial flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap rounded-xl sm:rounded-full px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
              activePanel === 'diary'
                ? 'bg-purple-500 text-white shadow'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <BookHeart className="h-3.5 w-3.5 shrink-0" />
            <span>Nhật ký</span>
          </button>

          <button
            type="button"
            data-testid="dock-zen-btn"
            onClick={() => togglePanel('zen')}
            className={`flex flex-1 sm:flex-initial flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap rounded-xl sm:rounded-full px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
              activePanel === 'zen'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-400/30'
            }`}
          >
            <span className="text-xs leading-none">🪷</span>
            <span>Tịnh Tâm</span>
          </button>

          <button
            type="button"
            data-testid="dock-games-btn"
            onClick={() => togglePanel('games')}
            className={`flex flex-1 sm:flex-initial flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap rounded-xl sm:rounded-full px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
              activePanel === 'games'
                ? 'bg-indigo-500 text-white shadow'
                : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-400/35'
            }`}
          >
            <Gamepad2 className="h-3.5 w-3.5 shrink-0" />
            <span>Giải Trí</span>
          </button>

          <button
            type="button"
            data-testid="collapse-bottom-dock-btn"
            onClick={() => setDockCollapsed(true)}
            title="Thu gọn thanh menu"
            className="flex items-center justify-center rounded-xl sm:rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer shrink-0"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </nav>
      )}
    </main>
  );
}

export default App;
