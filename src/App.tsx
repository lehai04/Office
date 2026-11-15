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
} from 'lucide-react';
import { OfficeScene3D, type ActiveSpeechBubble } from './components/OfficeScene3D';
import { EntryModal } from './components/EntryModal';
import { SeatSelectorModal } from './components/SeatSelectorModal';
import { ChatDrawer } from './components/ChatDrawer';
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
  playWoodenFishSound,
  playTempleBellSound,
  startZenBackgroundMusic,
  stopZenBackgroundMusic,
  type ZenTrackId,
} from './utils/zenSound';
import {
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
  leaveWorkSeatToStand,
  loadSavedSession,
  officeApiUrl,
  sendChatMessage,
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

  // State cho Game "Nuôi Mèo Văn Phòng" (Mèo của tôi • Cửa hàng mèo • Quà tặng • Sân ngoài văn phòng)
  const [roomCats, setRoomCats] = useState<Record<string, OfficeCatProfile>>({});
  const [myCatInventory, setMyCatInventory] = useState<Record<string, number>>({});
  const [giftRequests, setGiftRequests] = useState<CatGiftRequest[]>([]);

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
    setActiveBubbles((prev) => ({
      ...prev,
      [userId]: { userId, content, expiresAt },
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
    setRoomCats(loadRoomCats(room.code));
    setMyCatInventory(loadMyCatInventory(session.userId));
    setGiftRequests(loadRoomGiftRequests(room.code));

    const onStorageChange = () => {
      setRoomCats(loadRoomCats(room.code));
      setMyCatInventory(loadMyCatInventory(session.userId));
      setGiftRequests(loadRoomGiftRequests(room.code));
    };
    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
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

  const handleAdoptOrUpdateMyCat = useCallback(
    (catProfile: OfficeCatProfile, broadcastMsg?: string) => {
      if (!room) return;
      setRoomCats((prev) => {
        const nextMap = {
          ...prev,
          [catProfile.ownerUserId]: catProfile,
        };
        saveRoomCats(room.code, nextMap);
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
    [room, session]
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
    [room, session]
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

      // 3. Tự động đóng yêu cầu (status = 'fulfilled')
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
    [room, session, giftRequests, myCatInventory]
  );

  const handlePetCatIn3D = useCallback(
    (cat: OfficeCatProfile) => {
      if (!room) return;
      const updated: OfficeCatProfile = {
        ...cat,
        petCount: (cat.petCount || 0) + 1,
        happiness: Math.min(100, (cat.happiness || 80) + 10),
        updatedAt: Date.now(),
      };
      setRoomCats((prev) => {
        const nextMap = { ...prev, [cat.ownerUserId]: updated };
        saveRoomCats(room.code, nextMap);
        return nextMap;
      });
      showToast(
        `🤚 Bạn vừa vuốt ve bé mèo "${cat.catName}" của ${cat.ownerNickname}! 💕`
      );
    },
    [room, showToast]
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
    const saved = loadSavedSession();
    const inviteCode = getInviteRoomFromUrl();

    if (!saved) {
      setInitializing(false);
      return;
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

      if (data.type === 'connected' || data.type === 'room_state') {
        if (data.room && typeof data.room === 'object') {
          setRoom(data.room as RoomInfo);
        }
        if (Array.isArray(data.members)) setMembers(data.members as RoomMember[]);
        if (Array.isArray(data.seats)) setSeats(data.seats as WorkSeat[]);
      } else if (data.type === 'chat_message' && data.message) {
        const incoming = data.message as ChatMessage;
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
          return [...prev, { ...incoming, status: 'sent' }];
        });
        triggerSpeechBubble(incoming.userId, incoming.content);
        if (
          incoming.content.startsWith('🎯 [THÁCH ĐẤU PHI TIÊU]') &&
          incoming.userId !== session.userId
        ) {
          setActiveChallengeBanner(incoming.content);
          showToast(`${incoming.nickname} vừa thách đấu Phóng Phi Tiêu trong 🎮 Phòng Giải Trí!`);
        }
      } else if (data.type === 'diary_sync') {
        fetchDiaryLists(room.code, session.sessionToken)
          .then(({ feed, mine }) => {
            setDiaryFeed(feed);
            setMyDiary(mine);
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
    avatarGender: AvatarGender;
    createIfMissing: boolean;
  }) => {
    setEntryLoading(true);
    setEntryError(null);
    try {
      const joined = await joinOrRestoreRoom({
        roomCode: params.roomCode,
        nickname: params.nickname,
        avatarGender: params.avatarGender,
        createIfMissing: params.createIfMissing,
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
    const nextStatus = getNextAttendanceStatus(currentStatus);
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

  const handleLogoutOrSwitch = () => {
    clearSavedSession();
    setSession(null);
    setRoom(null);
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

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel((prev) => {
      if (prev === 'zen' && panel !== 'zen') {
        setAutoMo(false);
        setActiveBlessing(null);
      }
      return prev === panel ? 'none' : panel;
    });
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
        onEnterZenRoom={() => setActivePanel('zen')}
        inGameRoom={activePanel === 'games'}
        onEnterGameRoom={() => setActivePanel('games')}
        selectedDeity={selectedDeity}
        incenseLit={incenseLit}
        isBowing={isBowing}
        moPulseKey={moPulseKey}
        floatingMeritText={floatingMeritText}
        onStrikeMo={handleStrikeMo}
        onRingBell={handleRingBell}
        roomCats={roomCats}
        onPetCatIn3D={handlePetCatIn3D}
      />

      {/* THANH THÔNG TIN PHÒNG, CHỖ NGỒI & NÚT CHUYỂN GÓC NHÌN THỨ NHẤT Ở TRÊN CÙNG */}
      <header className="pointer-events-none fixed top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 z-20 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 rounded-2xl border border-white/15 bg-slate-900/80 px-2.5 sm:px-3.5 py-1.5 sm:py-2 backdrop-blur-md shadow-lg max-w-full">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[11px] sm:text-sm font-bold text-white truncate max-w-[110px] sm:max-w-none">
              {room.name}
            </span>
          </div>
          {editingRoomCode ? (
            <form onSubmit={handleSaveNewRoomCode} className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                maxLength={20}
                value={newRoomCodeDraft}
                onChange={(e) => setNewRoomCodeDraft(e.target.value.toUpperCase())}
                placeholder="ID phòng..."
                className="w-20 sm:w-28 rounded-lg border border-emerald-400 bg-slate-950 px-2 py-0.5 text-xs sm:text-[11px] font-mono font-bold uppercase text-emerald-300 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-slate-950 cursor-pointer"
              >
                Lưu
              </button>
              <button
                type="button"
                onClick={() => setEditingRoomCode(false)}
                className="rounded-lg bg-slate-800 px-1.5 py-0.5 text-[10px] sm:text-[11px] text-slate-400 cursor-pointer"
              >
                Hủy
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNewRoomCodeDraft(room.code);
                setEditingRoomCode(true);
              }}
              title="Bấm để đổi ID / Mã phòng"
              className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-semibold text-emerald-300 border border-white/10 transition-all cursor-pointer shrink-0"
            >
              <span>{room.code}</span>
              <PenSquare className="h-3 w-3 text-emerald-400" />
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyInviteLink}
            title="Sao chép link mời vào phòng"
            className="inline-flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-slate-200 transition-all cursor-pointer shrink-0"
          >
            {copiedInvite ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-300 hidden xs:inline">Đã chép</span>
              </>
            ) : (
              <>
                <Share2 className="h-3 w-3" />
                <span className="hidden sm:inline">Link mời</span>
              </>
            )}
          </button>
        </div>

        {/* Nút chuyển đổi Góc nhìn thứ nhất (FPV) & Trạng thái nhân vật */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 sm:gap-2 rounded-2xl border border-white/15 bg-slate-900/80 px-2 sm:px-3 py-1 sm:py-1.5 backdrop-blur-md shadow-lg text-[11px] sm:text-xs max-w-full">
          {/* Nút bật/tắt Góc nhìn thứ nhất của nhân vật */}
          <button
            type="button"
            data-testid="toggle-camera-mode-btn"
            onClick={() =>
              setCameraMode((prev) => (prev === 'overview' ? 'first_person' : 'overview'))
            }
            className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-xl px-2 sm:px-2.5 py-1 font-bold transition-all cursor-pointer ${
              cameraMode === 'first_person'
                ? 'bg-emerald-500 text-slate-950 shadow ring-2 ring-emerald-300'
                : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40'
            }`}
            title="Chuyển đổi giữa Góc nhìn thứ nhất (nhìn từ mắt nhân vật) và Góc nhìn toàn cảnh 3D"
          >
            {cameraMode === 'first_person' ? (
              <>
                <Compass className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Đang ở Góc nhìn thứ 1 (Bấm về 3D)</span>
                <span className="sm:hidden">Về 3D</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Góc nhìn thứ nhất</span>
                <span className="sm:hidden">Góc nhìn 1</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => togglePanel('seats')}
            title="Xem danh sách thành viên & Quản lý Trưởng phòng"
            className="flex items-center gap-1 sm:gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 px-2 py-1 text-slate-200 transition-all cursor-pointer"
          >
            <Users className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <span data-testid="hud-user-nickname" className="font-bold text-white truncate max-w-[80px] sm:max-w-none">
              {session.nickname}
            </span>
            {myMember?.isManager && (
              <span
                data-testid="hud-manager-badge"
                className="inline-flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-extrabold text-slate-950 shrink-0"
              >
                <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="hidden xs:inline">Trưởng phòng</span>
              </span>
            )}
          </button>

          <button
            type="button"
            data-testid="hud-seat-status-btn"
            onClick={() => togglePanel('seats')}
            className={`inline-flex items-center gap-1 rounded-xl px-2 sm:px-2.5 py-1 font-semibold transition-all cursor-pointer ${
              activePanel === 'zen'
                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                : myMeetingChair
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                  : mySeatLayout
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-400/40 animate-pulse'
            }`}
          >
            <Armchair className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[115px] sm:max-w-none">
              {activePanel === 'zen'
                ? 'Phòng Tịnh Tâm'
                : myMeetingChair
                  ? `Họp ${myMeetingChair.shortLabel}${mySeatLayout ? ` (${mySeatLayout.shortLabel})` : ''}`
                  : mySeatLayout
                    ? `Ghế ${mySeatLayout.shortLabel}`
                    : 'Chọn ghế'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleLogoutOrSwitch}
            title="Rời phòng / Đổi tài khoản ẩn danh"
            className="rounded-xl bg-slate-800 hover:bg-rose-500/20 p-1.5 text-slate-400 hover:text-rose-300 transition-all cursor-pointer shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* THÔNG BÁO NHANH (TOAST) */}
      {toastMessage && (
        <div
          data-testid="toast-banner"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-40 rounded-2xl border border-emerald-400/40 bg-slate-900/95 px-4 py-2.5 text-xs sm:text-sm font-medium text-emerald-200 shadow-2xl backdrop-blur-md"
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
        onExitZenRoom={() => {
          setAutoMo(false);
          setActiveBlessing(null);
          setActivePanel('none');
        }}
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
      />

      {/* THANH NÚT KÍNH MỜ GỌN Ở PHÍA DƯỚI MÀN HÌNH (Tối ưu cho cả Điện thoại & Máy tính) */}
      <nav
        aria-label="Điều khiển văn phòng"
        className="fixed bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center justify-between sm:justify-center gap-1 sm:gap-1.5 rounded-2xl sm:rounded-full border border-white/20 bg-slate-900/90 px-1.5 sm:px-3.5 py-1.5 sm:py-2 backdrop-blur-xl shadow-2xl w-[calc(100vw-16px)] sm:w-auto max-w-2xl no-scrollbar overflow-x-auto"
      >
        <button
          type="button"
          data-testid="dock-seats-btn"
          onClick={() => togglePanel('seats')}
          className={`flex flex-1 sm:flex-initial flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 whitespace-nowrap rounded-xl sm:rounded-full px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
            activePanel === 'seats'
              ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/30'
              : 'text-slate-200 hover:bg-white/10'
          }`}
        >
          <Armchair className="h-4 w-4 shrink-0" />
          <span>Chỗ ngồi</span>
        </button>

        <button
          type="button"
          data-testid="dock-chat-btn"
          onClick={() => togglePanel('chat')}
          className={`relative flex flex-1 sm:flex-initial flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 whitespace-nowrap rounded-xl sm:rounded-full px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
            activePanel === 'chat'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
              : 'text-slate-200 hover:bg-white/10'
          }`}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span>Chat</span>
          {messages.length > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[9px] sm:text-[10px] hidden sm:inline">
              {messages.length}
            </span>
          )}
        </button>

        <button
          type="button"
          data-testid="dock-attendance-btn"
          onClick={() => togglePanel('attendance')}
          className={`flex flex-1 sm:flex-initial flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 whitespace-nowrap rounded-xl sm:rounded-full px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
            activePanel === 'attendance'
              ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/30'
              : 'text-slate-200 hover:bg-white/10'
          }`}
        >
          <CalendarCheck className="h-4 w-4 shrink-0" />
          <span>Chấm công</span>
        </button>

        <button
          type="button"
          data-testid="dock-diary-btn"
          onClick={() => togglePanel('diary')}
          className={`flex flex-1 sm:flex-initial flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 whitespace-nowrap rounded-xl sm:rounded-full px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
            activePanel === 'diary'
              ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
              : 'text-slate-200 hover:bg-white/10'
          }`}
        >
          <BookHeart className="h-4 w-4 shrink-0" />
          <span className="sm:hidden">Nhật ký</span>
          <span className="hidden sm:inline">Nhật ký ẩn danh</span>
        </button>

        <button
          type="button"
          data-testid="dock-zen-btn"
          onClick={() => togglePanel('zen')}
          className={`flex flex-1 sm:flex-initial flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 whitespace-nowrap rounded-xl sm:rounded-full px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
            activePanel === 'zen'
              ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-200'
              : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-400/30'
          }`}
        >
          <span className="text-sm sm:text-xs leading-none">🪷</span>
          <span className="sm:hidden">Tịnh Tâm</span>
          <span className="hidden sm:inline">Phòng Tịnh Tâm</span>
        </button>

        <button
          type="button"
          data-testid="dock-games-btn"
          onClick={() => togglePanel('games')}
          className={`flex flex-1 sm:flex-initial flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 whitespace-nowrap rounded-xl sm:rounded-full px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
            activePanel === 'games'
              ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-300'
              : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-400/35'
          }`}
        >
          <Gamepad2 className="h-4 w-4 shrink-0" />
          <span className="sm:hidden">Giải Trí</span>
          <span className="hidden sm:inline">Phòng Giải Trí</span>
        </button>
      </nav>
    </main>
  );
}

export default App;
