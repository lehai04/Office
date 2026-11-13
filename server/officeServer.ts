import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { WORK_SEAT_LAYOUTS, MEETING_CHAIRS, DEFAULT_ROOM_CODE, DEFAULT_ROOM_NAME } from '../src/constants/officeLayout';
import type {
  AvatarGender,
  AttendanceStatus,
  RoomInfo,
  RoomMember,
  WorkSeat,
  ChatMessage,
  AttendanceRecord,
  PublicDiaryEntry,
  MyDiaryEntry,
} from '../src/types/office';

interface StoredAccount {
  userId: string;
  sessionToken: string;
  nickname: string;
  avatarGender: AvatarGender;
  memberTag: string;
  createdAt: string;
}

interface StoredRoomMember {
  roomId: string;
  userId: string;
  nickname: string;
  avatarGender: AvatarGender;
  memberTag: string;
  joinedAt: string;
  lastSeenAt: string;
}

interface StoredDiaryEntry {
  id: string;
  roomId: string;
  authorId: string;
  mood: 'joy' | 'sadness' | 'pressure' | 'unsaid';
  content: string;
  hiddenUserIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface DatabaseSchema {
  dbVersion?: number;
  accounts: Record<string, StoredAccount>; // keyed by sessionToken
  rooms: Record<string, RoomInfo>; // keyed by uppercase roomCode
  roomMembers: StoredRoomMember[];
  seats: WorkSeat[];
  messages: ChatMessage[];
  attendance: Record<string, AttendanceRecord>; // keyed by `${roomId}:${userId}:${date}`
  diaryEntries: StoredDiaryEntry[];
}

const CURRENT_DB_VERSION = 3;

interface SseClient {
  id: string;
  userId: string;
  roomId: string;
  roomCode: string;
  res: ServerResponse;
}

const DATA_DIR = path.resolve(process.env.OFFICE_DATA_DIR || path.join('server', 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');

function createInitialSeatsForRoom(roomId: string): WorkSeat[] {
  return WORK_SEAT_LAYOUTS.map((layout) => ({
    seatId: layout.seatId,
    roomId,
    label: layout.label,
    zone: layout.zone,
    occupiedByUserId: null,
    claimedAt: null,
  }));
}

function loadDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (parsed && parsed.dbVersion === CURRENT_DB_VERSION && parsed.rooms && parsed.seats) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[OfficeServer] Failed to load db.json, initializing fresh DB:', err);
  }

  const defaultRoomId = 'room_tinhtam_default';
  const secondRoomId = 'room_ketnoi_02';
  const initialDb: DatabaseSchema = {
    dbVersion: CURRENT_DB_VERSION,
    accounts: {},
    rooms: {
      [DEFAULT_ROOM_CODE]: {
        id: defaultRoomId,
        code: DEFAULT_ROOM_CODE,
        name: DEFAULT_ROOM_NAME,
      },
      KETNOI: {
        id: secondRoomId,
        code: 'KETNOI',
        name: 'Văn phòng Kết Nối',
      },
    },
    roomMembers: [],
    seats: [
      ...createInitialSeatsForRoom(defaultRoomId),
      ...createInitialSeatsForRoom(secondRoomId),
    ],
    messages: [],
    attendance: {},
    diaryEntries: [],
  };

  saveDatabase(initialDb);
  return initialDb;
}

let saveTimer: NodeJS.Timeout | null = null;
let db: DatabaseSchema = loadDatabase();

function saveDatabase(state: DatabaseSchema = db, immediate = false): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (immediate) {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
      return;
    }
    if (!saveTimer) {
      saveTimer = setTimeout(() => {
        saveTimer = null;
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
        } catch (err) {
          console.error('[OfficeServer] Error saving db.json:', err);
        }
      }, 50);
    }
  } catch (err) {
    console.error('[OfficeServer] Error writing db.json:', err);
  }
}

const sseClients = new Map<string, SseClient>();
const roomLocks = new Map<string, Promise<unknown>>();
// Lưu trạng thái ngồi tự do tạm thời tại 6 ghế bàn họp chung: key = `${roomId}:${userId}` -> meetingChairId
const activeMeetingChairs = new Map<string, string>();

async function withRoomLock<T>(roomId: string, fn: () => Promise<T> | T): Promise<T> {
  const prev = roomLocks.get(roomId) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  roomLocks.set(roomId, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8').trim();
        if (!raw) {
          resolve({});
          return;
        }
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function getAuthenticatedAccount(req: IncomingMessage, urlObj?: URL): StoredAccount | null {
  const authHeader = req.headers['authorization'];
  let token = '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (urlObj && urlObj.searchParams.get('token')) {
    token = urlObj.searchParams.get('token')!.trim();
  }
  if (!token) return null;
  return db.accounts[token] ?? null;
}

function isUserOnlineInRoom(roomId: string, userId: string): boolean {
  for (const client of sseClients.values()) {
    if (client.roomId === roomId && client.userId === userId) {
      return true;
    }
  }
  return false;
}

function buildRoomStatePayload(room: RoomInfo) {
  const roomSeats = db.seats.filter((s) => s.roomId === room.id);
  const rawMembers = db.roomMembers.filter((m) => m.roomId === room.id);

  // Đảm bảo phòng luôn có Trưởng phòng (người tạo phòng hoặc thành viên đầu tiên trong phòng)
  if (
    rawMembers.length > 0 &&
    (!room.managerUserId || !rawMembers.some((m) => m.userId === room.managerUserId))
  ) {
    room.managerUserId = rawMembers[0].userId;
  }

  const memberMap = new Map<string, StoredRoomMember>();
  for (const m of rawMembers) {
    memberMap.set(m.userId, m);
  }

  const enrichedSeats: WorkSeat[] = roomSeats.map((s) => {
    const occ = s.occupiedByUserId ? memberMap.get(s.occupiedByUserId) : undefined;
    return {
      ...s,
      occupiedByNickname: occ ? occ.nickname : null,
      occupiedByTag: occ ? occ.memberTag : null,
    };
  });

  const members: RoomMember[] = rawMembers.map((m) => {
    const mySeat = roomSeats.find((s) => s.occupiedByUserId === m.userId);
    const currentMeetingChair = activeMeetingChairs.get(`${room.id}:${m.userId}`) ?? null;
    return {
      userId: m.userId,
      roomId: m.roomId,
      nickname: m.nickname,
      avatarGender: m.avatarGender,
      memberTag: m.memberTag,
      seatId: mySeat ? mySeat.seatId : null,
      meetingChairId: currentMeetingChair,
      isManager: room.managerUserId === m.userId,
      online: isUserOnlineInRoom(room.id, m.userId),
      joinedAt: m.joinedAt,
      lastSeenAt: m.lastSeenAt,
    };
  });

  return {
    room,
    members,
    seats: enrichedSeats,
  };
}

function broadcastToRoom(
  roomId: string,
  event: Record<string, unknown>,
  predicate?: (client: SseClient) => boolean
): void {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients.values()) {
    if (client.roomId === roomId && (!predicate || predicate(client))) {
      try {
        client.res.write(data);
      } catch {
        sseClients.delete(client.id);
      }
    }
  }
}

/**
 * Strips all author-identifying fields from a diary entry before sending to any reader.
 */
function sanitizeDiaryEntryForPublic(entry: StoredDiaryEntry): PublicDiaryEntry {
  return {
    id: entry.id,
    roomId: entry.roomId,
    authorLabel: 'Ẩn danh',
    mood: entry.mood,
    content: entry.content,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function toMyDiaryEntry(entry: StoredDiaryEntry): MyDiaryEntry {
  return {
    id: entry.id,
    roomId: entry.roomId,
    mood: entry.mood,
    content: entry.content,
    hiddenUserIds: [...entry.hiddenUserIds],
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function resetDatabaseToInitial(): DatabaseSchema {
  const defaultRoomId = 'room_tinhtam_default';
  const secondRoomId = 'room_ketnoi_02';
  const freshDb: DatabaseSchema = {
    dbVersion: CURRENT_DB_VERSION,
    accounts: {},
    rooms: {
      [DEFAULT_ROOM_CODE]: {
        id: defaultRoomId,
        code: DEFAULT_ROOM_CODE,
        name: DEFAULT_ROOM_NAME,
      },
      KETNOI: {
        id: secondRoomId,
        code: 'KETNOI',
        name: 'Văn phòng Kết Nối',
      },
    },
    roomMembers: [],
    seats: [
      ...createInitialSeatsForRoom(defaultRoomId),
      ...createInitialSeatsForRoom(secondRoomId),
    ],
    messages: [],
    attendance: {},
    diaryEntries: [],
  };
  db = freshDb;
  activeMeetingChairs.clear();
  saveDatabase(freshDb, true);
  return freshDb;
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const rawUrl = req.url || '/';
  if (!rawUrl.startsWith('/api/')) {
    return false;
  }

  const urlObj = new URL(rawUrl, 'http://localhost');
  const pathname = urlObj.pathname;
  const method = req.method || 'GET';

  if (db.dbVersion !== CURRENT_DB_VERSION) {
    resetDatabaseToInitial();
  }

  try {
    // 1. Health / Reset for starting a fresh game
    if (pathname === '/api/health' && method === 'GET') {
      sendJson(res, 200, { ok: true, mode: 'local_server' });
      return true;
    }

    if (pathname === '/api/reset' && method === 'POST') {
      resetDatabaseToInitial();
      sendJson(res, 200, { ok: true, message: 'Đã xóa toàn bộ tài khoản cũ để bắt đầu game mới.' });
      return true;
    }

    // 2. Create or restore anonymous session & join room
    // POST /api/auth/join
    if (pathname === '/api/auth/join' && method === 'POST') {
      const body = await readJsonBody(req);
      const rawNickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
      const rawGender = body.avatarGender === 'female' ? 'female' : 'male';
      const rawRoomCode = typeof body.roomCode === 'string' ? body.roomCode.trim().toUpperCase() : DEFAULT_ROOM_CODE;
      const createIfMissing = Boolean(body.createIfMissing);

      const existingAccount = getAuthenticatedAccount(req, urlObj);

      if (!rawNickname && !existingAccount) {
        sendJson(res, 400, { error: 'INVALID_NICKNAME', message: 'Vui lòng nhập biệt danh của bạn.' });
        return true;
      }

      let room = db.rooms[rawRoomCode];
      let isRoomCreator = false;
      if (!room) {
        if (createIfMissing && rawRoomCode.length >= 2 && rawRoomCode.length <= 20) {
          const newRoomId = `room_${rawRoomCode.toLowerCase()}_${crypto.randomBytes(3).toString('hex')}`;
          room = {
            id: newRoomId,
            code: rawRoomCode,
            name: `Văn phòng ${rawRoomCode}`,
            managerUserId: null,
          };
          db.rooms[rawRoomCode] = room;
          db.seats.push(...createInitialSeatsForRoom(newRoomId));
          isRoomCreator = true;
        } else {
          sendJson(res, 404, {
            error: 'ROOM_NOT_FOUND',
            message: `Mã phòng "${rawRoomCode}" không tồn tại. Hãy dùng mã "${DEFAULT_ROOM_CODE}" hoặc bật tùy chọn tạo phòng mới.`,
          });
          return true;
        }
      }

      let account = existingAccount;
      const nowIso = new Date().toISOString();

      if (!account) {
        const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
        const sessionToken = `tok_${crypto.randomBytes(18).toString('hex')}`;
        const memberTag = `#${userId.slice(4, 8).toUpperCase()}`;
        account = {
          userId,
          sessionToken,
          nickname: rawNickname,
          avatarGender: rawGender,
          memberTag,
          createdAt: nowIso,
        };
        db.accounts[sessionToken] = account;
      } else {
        if (rawNickname) account.nickname = rawNickname;
        if (body.avatarGender === 'male' || body.avatarGender === 'female') {
          account.avatarGender = body.avatarGender;
        }
      }

      // Nếu là người tạo phòng mới hoặc phòng chưa có Trưởng phòng hợp lệ -> gán làm Trưởng phòng
      const existingRoomMembers = db.roomMembers.filter((m) => m.roomId === room.id);
      if (
        isRoomCreator ||
        !room.managerUserId ||
        !existingRoomMembers.some((m) => m.userId === room.managerUserId)
      ) {
        room.managerUserId = account.userId;
      }

      // Upsert room membership
      let member = db.roomMembers.find(
        (m) => m.roomId === room.id && m.userId === account!.userId
      );
      if (!member) {
        member = {
          roomId: room.id,
          userId: account.userId,
          nickname: account.nickname,
          avatarGender: account.avatarGender,
          memberTag: account.memberTag,
          joinedAt: nowIso,
          lastSeenAt: nowIso,
        };
        db.roomMembers.push(member);
      } else {
        member.nickname = account.nickname;
        member.avatarGender = account.avatarGender;
        member.lastSeenAt = nowIso;
      }

      saveDatabase(db, true);

      // Khi vào lại hoặc tải lại trang, đưa nhân vật thẳng về ghế cố định đã lưu (rời ghế họp tạm thời nếu có)
      activeMeetingChairs.delete(`${room.id}:${account.userId}`);

      const roomState = buildRoomStatePayload(room);
      broadcastToRoom(room.id, {
        type: 'room_state',
        ...roomState,
      });

      const mySeat = roomState.seats.find((s) => s.occupiedByUserId === account!.userId);

      sendJson(res, 200, {
        session: {
          userId: account.userId,
          sessionToken: account.sessionToken,
          roomCode: room.code,
          nickname: account.nickname,
          avatarGender: account.avatarGender,
          memberTag: account.memberTag,
        },
        mySeatId: mySeat ? mySeat.seatId : null,
        ...roomState,
      });
      return true;
    }

    // Match room-scoped routes: /api/rooms/:roomCode/...
    const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)(?:\/(.*))?$/);
    if (!roomMatch) {
      sendJson(res, 404, { error: 'NOT_FOUND', message: 'API endpoint không tồn tại.' });
      return true;
    }

    const roomCode = decodeURIComponent(roomMatch[1]).toUpperCase();
    const subPath = roomMatch[2] || '';
    const room = db.rooms[roomCode];

    if (!room) {
      sendJson(res, 404, { error: 'ROOM_NOT_FOUND', message: 'Phòng không tồn tại.' });
      return true;
    }

    // Authenticate caller via session token
    const account = getAuthenticatedAccount(req, urlObj);
    if (!account) {
      sendJson(res, 401, {
        error: 'UNAUTHORIZED',
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      });
      return true;
    }

    // Verify room membership on EVERY room endpoint
    const memberRecord = db.roomMembers.find(
      (m) => m.roomId === room.id && m.userId === account.userId
    );
    if (!memberRecord) {
      sendJson(res, 403, {
        error: 'FORBIDDEN_NOT_ROOM_MEMBER',
        message: 'Bạn không phải là thành viên của văn phòng này.',
      });
      return true;
    }

    memberRecord.lastSeenAt = new Date().toISOString();

    // 3. SSE Realtime Stream: GET /api/rooms/:roomCode/events
    if (subPath === 'events' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });

      const clientId = `sse_${crypto.randomBytes(8).toString('hex')}`;
      const client: SseClient = {
        id: clientId,
        userId: account.userId,
        roomId: room.id,
        roomCode: room.code,
        res,
      };
      sseClients.set(clientId, client);

      // Immediately push initial connected event & updated online state
      const roomState = buildRoomStatePayload(room);
      res.write(`data: ${JSON.stringify({ type: 'connected', clientId, ...roomState })}\n\n`);
      broadcastToRoom(room.id, { type: 'room_state', ...roomState });

      const heartbeat = setInterval(() => {
        try {
          res.write(`: heartbeat\n\n`);
        } catch {
          clearInterval(heartbeat);
          sseClients.delete(clientId);
        }
      }, 15000);

      req.on('close', () => {
        clearInterval(heartbeat);
        sseClients.delete(clientId);
        const updatedState = buildRoomStatePayload(room);
        broadcastToRoom(room.id, { type: 'room_state', ...updatedState });
      });

      return true;
    }

    // 4. GET /api/rooms/:roomCode/state
    if (subPath === 'state' && method === 'GET') {
      const roomState = buildRoomStatePayload(room);
      const recentMessages = db.messages
        .filter((m) => m.roomId === room.id)
        .slice(-60);
      const myAttendance = Object.values(db.attendance).filter(
        (a) => a.date && db.attendance[`${room.id}:${account.userId}:${a.date}`] === a
      );
      const visibleDiary = db.diaryEntries
        .filter((d) => d.roomId === room.id && !d.hiddenUserIds.includes(account.userId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(sanitizeDiaryEntryForPublic);
      const myDiary = db.diaryEntries
        .filter((d) => d.roomId === room.id && d.authorId === account.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toMyDiaryEntry);

      sendJson(res, 200, {
        ...roomState,
        messages: recentMessages,
        attendance: myAttendance,
        diaryFeed: visibleDiary,
        myDiary,
      });
      return true;
    }

    // 5. Update Profile (Nickname / Avatar Gender) in Room: PUT /api/rooms/:roomCode/profile
    if (subPath === 'profile' && method === 'PUT') {
      const body = await readJsonBody(req);
      const newNickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
      const newGender = body.avatarGender === 'female' ? 'female' : body.avatarGender === 'male' ? 'male' : account.avatarGender;

      if (!newNickname || newNickname.length > 40) {
        sendJson(res, 400, { error: 'INVALID_NICKNAME', message: 'Biệt danh phải từ 1 đến 40 ký tự.' });
        return true;
      }

      account.nickname = newNickname;
      account.avatarGender = newGender;
      memberRecord.nickname = newNickname;
      memberRecord.avatarGender = newGender;
      saveDatabase(db, true);

      // Khi vào lại hoặc tải lại trang, đưa nhân vật thẳng về ghế cố định đã lưu (rời ghế họp tạm thời nếu có)
      activeMeetingChairs.delete(`${room.id}:${account.userId}`);

      const roomState = buildRoomStatePayload(room);
      broadcastToRoom(room.id, { type: 'room_state', ...roomState });
      sendJson(res, 200, {
        session: {
          userId: account.userId,
          sessionToken: account.sessionToken,
          roomCode: room.code,
          nickname: account.nickname,
          avatarGender: account.avatarGender,
          memberTag: account.memberTag,
        },
        ...roomState,
      });
      return true;
    }

    // 5b. Rename/Change Room Code (ID phòng): PUT /api/rooms/:roomCode/code
    if (subPath === 'code' && method === 'PUT') {
      const body = await readJsonBody(req);
      const newCode =
        typeof body.newRoomCode === 'string'
          ? body.newRoomCode.trim().toUpperCase()
          : '';
      const newName =
        typeof body.newRoomName === 'string' && body.newRoomName.trim()
          ? body.newRoomName.trim()
          : `Văn phòng ${newCode}`;

      if (!newCode || newCode.length < 2 || newCode.length > 20) {
        sendJson(res, 400, {
          error: 'INVALID_ROOM_CODE',
          message: 'Mã phòng phải từ 2 đến 20 ký tự.',
        });
        return true;
      }

      if (newCode !== room.code && db.rooms[newCode]) {
        sendJson(res, 409, {
          error: 'ROOM_CODE_EXISTS',
          message: `Mã phòng "${newCode}" đã tồn tại. Hãy chọn mã khác hoặc chuyển sang phòng đó.`,
        });
        return true;
      }

      const oldCode = room.code;
      delete db.rooms[oldCode];
      room.code = newCode;
      room.name = newName;
      db.rooms[newCode] = room;

      for (const client of sseClients.values()) {
        if (client.roomId === room.id) {
          client.roomCode = newCode;
        }
      }

      saveDatabase(db, true);
      const roomState = buildRoomStatePayload(room);
      broadcastToRoom(room.id, { type: 'room_state', ...roomState });

      sendJson(res, 200, {
        ...roomState,
        session: {
          userId: account.userId,
          sessionToken: account.sessionToken,
          roomCode: room.code,
          nickname: account.nickname,
          avatarGender: account.avatarGender,
          memberTag: account.memberTag,
        },
      });
      return true;
    }

    // 5c. Transfer Room Manager Role (Chuyển quyền Trưởng phòng): POST /api/rooms/:roomCode/manager/transfer
    if (subPath === 'manager/transfer' && method === 'POST') {
      const body = await readJsonBody(req);
      const targetUserId =
        typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';

      if (room.managerUserId !== account.userId) {
        sendJson(res, 403, {
          error: 'FORBIDDEN_NOT_MANAGER',
          message: 'Chỉ Trưởng phòng mới có quyền chuyển chức vụ Trưởng phòng cho người khác.',
        });
        return true;
      }

      const targetMember = db.roomMembers.find(
        (m) => m.roomId === room.id && m.userId === targetUserId
      );
      if (!targetMember) {
        sendJson(res, 404, {
          error: 'MEMBER_NOT_FOUND',
          message: 'Thành viên được chọn không còn trong văn phòng này.',
        });
        return true;
      }

      room.managerUserId = targetMember.userId;
      saveDatabase(db, true);

      const roomState = buildRoomStatePayload(room);
      broadcastToRoom(room.id, {
        type: 'room_state',
        ...roomState,
      });

      sendJson(res, 200, {
        managerUserId: room.managerUserId,
        ...roomState,
      });
      return true;
    }

    // 5d. Kick Member from Room (Trưởng phòng xóa người chơi khác khỏi phòng): POST /api/rooms/:roomCode/members/kick
    if (subPath === 'members/kick' && method === 'POST') {
      const body = await readJsonBody(req);
      const targetUserId =
        typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';

      if (room.managerUserId !== account.userId) {
        sendJson(res, 403, {
          error: 'FORBIDDEN_NOT_MANAGER',
          message: 'Chỉ Trưởng phòng mới có quyền xóa người chơi khác ra khỏi phòng.',
        });
        return true;
      }

      if (!targetUserId || targetUserId === account.userId) {
        sendJson(res, 400, {
          error: 'CANNOT_KICK_SELF',
          message: 'Trưởng phòng không thể tự xóa chính mình khỏi phòng.',
        });
        return true;
      }

      const targetMember = db.roomMembers.find(
        (m) => m.roomId === room.id && m.userId === targetUserId
      );
      if (!targetMember) {
        sendJson(res, 404, {
          error: 'MEMBER_NOT_FOUND',
          message: 'Người chơi này không còn trong phòng.',
        });
        return true;
      }

      // Giải phóng ghế làm việc cố định và ghế bàn họp của người bị xóa
      for (const s of db.seats) {
        if (s.roomId === room.id && s.occupiedByUserId === targetUserId) {
          s.occupiedByUserId = null;
          s.claimedAt = null;
        }
      }
      activeMeetingChairs.delete(`${room.id}:${targetUserId}`);

      // Xóa khỏi danh sách thành viên phòng
      db.roomMembers = db.roomMembers.filter(
        (m) => !(m.roomId === room.id && m.userId === targetUserId)
      );
      saveDatabase(db, true);

      const roomState = buildRoomStatePayload(room);
      broadcastToRoom(room.id, {
        type: 'member_kicked',
        kickedUserId: targetUserId,
        kickedNickname: targetMember.nickname,
        ...roomState,
      });
      broadcastToRoom(room.id, {
        type: 'room_state',
        ...roomState,
      });

      sendJson(res, 200, {
        kickedUserId: targetUserId,
        kickedNickname: targetMember.nickname,
        ...roomState,
      });
      return true;
    }

    // 6. Atomic Seat Claim: POST /api/rooms/:roomCode/seats/claim
    if (subPath === 'seats/claim' && method === 'POST') {
      const body = await readJsonBody(req);
      const seatId = typeof body.seatId === 'string' ? body.seatId.trim() : '';

      const result = await withRoomLock(room.id, () => {
        const targetSeat = db.seats.find(
          (s) => s.roomId === room.id && s.seatId === seatId
        );
        if (!targetSeat) {
          return {
            status: 404,
            payload: { error: 'SEAT_NOT_FOUND', message: 'Ghế làm việc không tồn tại.' },
          };
        }

        if (
          targetSeat.occupiedByUserId !== null &&
          targetSeat.occupiedByUserId !== account.userId
        ) {
          const occupier = db.roomMembers.find(
            (m) => m.roomId === room.id && m.userId === targetSeat.occupiedByUserId
          );
          return {
            status: 409,
            payload: {
              error: 'SEAT_TAKEN',
              message: `Ghế này đã được ${occupier ? occupier.nickname : 'đồng nghiệp khác'} chọn trước. Vui lòng chọn ghế trống khác hoặc đứng gần cửa!`,
            },
          };
        }

        // Release any previous seat held by this user in this room
        for (const s of db.seats) {
          if (s.roomId === room.id && s.occupiedByUserId === account.userId && s.seatId !== seatId) {
            s.occupiedByUserId = null;
            s.claimedAt = null;
          }
        }

        targetSeat.occupiedByUserId = account.userId;
        targetSeat.claimedAt = new Date().toISOString();
        activeMeetingChairs.delete(`${room.id}:${account.userId}`);
        saveDatabase(db, true);

        const roomState = buildRoomStatePayload(room);
        broadcastToRoom(room.id, { type: 'room_state', ...roomState });

        return {
          status: 200,
          payload: {
            claimedSeatId: targetSeat.seatId,
            ...roomState,
          },
        };
      });

      sendJson(res, result.status, result.payload);
      return true;
    }

    // 7. Stand Up (Leave Seat to stand near the door): POST /api/rooms/:roomCode/seats/stand
    if (subPath === 'seats/stand' && method === 'POST') {
      const result = await withRoomLock(room.id, () => {
        for (const s of db.seats) {
          if (s.roomId === room.id && s.occupiedByUserId === account.userId) {
            s.occupiedByUserId = null;
            s.claimedAt = null;
          }
        }
        activeMeetingChairs.delete(`${room.id}:${account.userId}`);
        saveDatabase(db, true);
        const roomState = buildRoomStatePayload(room);
        broadcastToRoom(room.id, { type: 'room_state', ...roomState });
        return roomState;
      });
      sendJson(res, 200, { claimedSeatId: null, ...result });
      return true;
    }

    // 7b. Free Seating at Shared Meeting Table (6 chairs): POST /api/rooms/:roomCode/meeting/sit
    if (subPath === 'meeting/sit' && method === 'POST') {
      const body = await readJsonBody(req);
      const meetingChairId =
        typeof body.meetingChairId === 'string' && body.meetingChairId.trim()
          ? body.meetingChairId.trim()
          : null;

      const result = await withRoomLock(room.id, () => {
        const key = `${room.id}:${account.userId}`;
        if (!meetingChairId) {
          activeMeetingChairs.delete(key);
          const roomState = buildRoomStatePayload(room);
          broadcastToRoom(room.id, { type: 'room_state', ...roomState });
          return {
            status: 200,
            payload: { meetingChairId: null, ...roomState },
          };
        }

        const validChair = MEETING_CHAIRS.find((c) => c.id === meetingChairId);
        if (!validChair) {
          return {
            status: 404,
            payload: { error: 'MEETING_CHAIR_NOT_FOUND', message: 'Ghế bàn họp không tồn tại.' },
          };
        }

        for (const [k, chairId] of activeMeetingChairs.entries()) {
          if (k.startsWith(`${room.id}:`) && k !== key && chairId === meetingChairId) {
            return {
              status: 409,
              payload: {
                error: 'MEETING_CHAIR_TAKEN',
                message: 'Ghế bàn họp này đang có đồng nghiệp ngồi. Hãy chọn ghế họp trống bên cạnh!',
              },
            };
          }
        }

        activeMeetingChairs.set(key, meetingChairId);
        const roomState = buildRoomStatePayload(room);
        broadcastToRoom(room.id, { type: 'room_state', ...roomState });
        return {
          status: 200,
          payload: { meetingChairId, ...roomState },
        };
      });

      sendJson(res, result.status, result.payload);
      return true;
    }

    // 8. Chat Messages: GET & POST /api/rooms/:roomCode/messages
    if (subPath === 'messages' && method === 'GET') {
      const recentMessages = db.messages
        .filter((m) => m.roomId === room.id)
        .slice(-60);
      sendJson(res, 200, { messages: recentMessages });
      return true;
    }

    if (subPath === 'messages' && method === 'POST') {
      const body = await readJsonBody(req);
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      const clientMsgId =
        typeof body.clientMsgId === 'string' && body.clientMsgId.trim()
          ? body.clientMsgId.trim()
          : `cmsg_${crypto.randomBytes(6).toString('hex')}`;

      if (!content) {
        sendJson(res, 400, { error: 'EMPTY_MESSAGE', message: 'Nội dung tin nhắn không được để trống.' });
        return true;
      }
      if (content.length > 1000) {
        sendJson(res, 400, { error: 'MESSAGE_TOO_LONG', message: 'Tin nhắn tối đa 1000 ký tự.' });
        return true;
      }

      // Check idempotency by (roomId, userId, clientMsgId) to prevent duplicate messages on retry
      let existingMsg = db.messages.find(
        (m) =>
          m.roomId === room.id &&
          m.userId === account.userId &&
          m.clientMsgId === clientMsgId
      );

      if (existingMsg) {
        sendJson(res, 200, { message: existingMsg, deduplicated: true });
        return true;
      }

      const newMsg: ChatMessage = {
        id: `msg_${crypto.randomBytes(8).toString('hex')}`,
        roomId: room.id,
        userId: account.userId,
        nickname: memberRecord.nickname,
        memberTag: memberRecord.memberTag,
        clientMsgId,
        content,
        createdAt: new Date().toISOString(),
        status: 'sent',
      };

      db.messages.push(newMsg);
      if (db.messages.length > 500) {
        db.messages = db.messages.slice(-500);
      }
      saveDatabase(db, true);

      broadcastToRoom(room.id, {
        type: 'chat_message',
        message: newMsg,
      });

      sendJson(res, 201, { message: newMsg, deduplicated: false });
      return true;
    }

    // 9. Personal Attendance Calendar: GET & POST /api/rooms/:roomCode/attendance
    if (subPath === 'attendance' && method === 'GET') {
      const prefix = `${room.id}:${account.userId}:`;
      const records: AttendanceRecord[] = [];
      for (const [key, val] of Object.entries(db.attendance)) {
        if (key.startsWith(prefix)) {
          records.push(val);
        }
      }
      sendJson(res, 200, { attendance: records });
      return true;
    }

    if (subPath === 'attendance' && method === 'POST') {
      const body = await readJsonBody(req);
      const date = typeof body.date === 'string' ? body.date.trim() : '';
      const status = body.status as AttendanceStatus;
      const seq = typeof body.seq === 'number' ? body.seq : 1;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        sendJson(res, 400, { error: 'INVALID_DATE', message: 'Định dạng ngày không hợp lệ (YYYY-MM-DD).' });
        return true;
      }
      if (!['none', 'full', 'half', 'off'].includes(status)) {
        sendJson(res, 400, { error: 'INVALID_STATUS', message: 'Trạng thái chấm công không hợp lệ.' });
        return true;
      }

      const key = `${room.id}:${account.userId}:${date}`;
      const current = db.attendance[key];

      // Preserve order when clicking rapidly: only apply if seq >= current.seq
      if (!current || seq >= current.seq) {
        db.attendance[key] = {
          date,
          status,
          seq,
          updatedAt: new Date().toISOString(),
        };
        saveDatabase(db, true);
      }

      sendJson(res, 200, { record: db.attendance[key] });
      return true;
    }

    // 10. Anonymous Diary Room:
    // - GET /api/rooms/:roomCode/diary (Public feed filtered by caller permissions, stripped of author identity)
    // - GET /api/rooms/:roomCode/diary/mine (Caller's own posts for "Bài của tôi")
    // - GET /api/rooms/:roomCode/diary/:entryId (Direct lookup by ID, filtered & stripped of author identity)
    // - POST /api/rooms/:roomCode/diary (Create new anonymous entry)
    // - PUT /api/rooms/:roomCode/diary/:entryId (Author updates content or hiddenUserIds)
    if (subPath === 'diary' && method === 'GET') {
      const visibleEntries = db.diaryEntries
        .filter((d) => d.roomId === room.id && !d.hiddenUserIds.includes(account.userId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(sanitizeDiaryEntryForPublic);

      sendJson(res, 200, { entries: visibleEntries });
      return true;
    }

    if (subPath === 'diary/mine' && method === 'GET') {
      const myEntries = db.diaryEntries
        .filter((d) => d.roomId === room.id && d.authorId === account.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toMyDiaryEntry);

      sendJson(res, 200, { entries: myEntries });
      return true;
    }

    if (subPath === 'diary' && method === 'POST') {
      const body = await readJsonBody(req);
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      const mood = ['joy', 'sadness', 'pressure', 'unsaid'].includes(String(body.mood))
        ? (body.mood as 'joy' | 'sadness' | 'pressure' | 'unsaid')
        : 'joy';
      const rawHiddenIds = Array.isArray(body.hiddenUserIds) ? body.hiddenUserIds : [];
      const hiddenUserIds = Array.from(
        new Set(
          rawHiddenIds
            .map((id) => String(id).trim())
            .filter((id) => id && id !== account.userId)
        )
      );

      if (!content) {
        sendJson(res, 400, { error: 'EMPTY_DIARY', message: 'Hãy viết đôi dòng tâm sự trước khi đăng nhé.' });
        return true;
      }

      const nowIso = new Date().toISOString();
      const newEntry: StoredDiaryEntry = {
        id: `diary_${crypto.randomBytes(8).toString('hex')}`,
        roomId: room.id,
        authorId: account.userId,
        mood,
        content,
        hiddenUserIds,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      db.diaryEntries.push(newEntry);
      saveDatabase(db, true);

      // Broadcast lightweight signal (no content, no author identity) ONLY to members who are NOT hidden
      broadcastToRoom(
        room.id,
        {
          type: 'diary_sync',
          timestamp: nowIso,
        },
        (client) => !hiddenUserIds.includes(client.userId)
      );

      sendJson(res, 201, {
        myEntry: toMyDiaryEntry(newEntry),
        publicEntry: sanitizeDiaryEntryForPublic(newEntry),
      });
      return true;
    }

    const diaryIdMatch = subPath.match(/^diary\/([^/]+)$/);
    if (diaryIdMatch) {
      const entryId = decodeURIComponent(diaryIdMatch[1]);
      const entry = db.diaryEntries.find(
        (d) => d.roomId === room.id && d.id === entryId
      );

      if (method === 'GET') {
        // Server-enforced visibility check on direct ID access
        if (!entry || entry.hiddenUserIds.includes(account.userId)) {
          sendJson(res, 404, {
            error: 'DIARY_NOT_FOUND_OR_HIDDEN',
            message: 'Bài nhật ký không tồn tại hoặc không khả dụng với bạn.',
          });
          return true;
        }
        sendJson(res, 200, { entry: sanitizeDiaryEntryForPublic(entry) });
        return true;
      }

      if (method === 'PUT') {
        if (!entry) {
          sendJson(res, 404, { error: 'DIARY_NOT_FOUND', message: 'Không tìm thấy bài nhật ký.' });
          return true;
        }
        if (entry.authorId !== account.userId) {
          sendJson(res, 403, {
            error: 'FORBIDDEN_NOT_AUTHOR',
            message: 'Chỉ người viết mới được chỉnh sửa bài nhật ký của mình.',
          });
          return true;
        }

        const body = await readJsonBody(req);
        if (typeof body.content === 'string') {
          const trimmed = body.content.trim();
          if (!trimmed) {
            sendJson(res, 400, { error: 'EMPTY_DIARY', message: 'Nội dung bài viết không được để trống.' });
            return true;
          }
          entry.content = trimmed;
        }
        if (['joy', 'sadness', 'pressure', 'unsaid'].includes(String(body.mood))) {
          entry.mood = body.mood as 'joy' | 'sadness' | 'pressure' | 'unsaid';
        }
        if (Array.isArray(body.hiddenUserIds)) {
          entry.hiddenUserIds = Array.from(
            new Set(
              body.hiddenUserIds
                .map((id) => String(id).trim())
                .filter((id) => id && id !== account.userId)
            )
          );
        }
        entry.updatedAt = new Date().toISOString();
        saveDatabase(db, true);

        // Notify all room members to refresh their filtered diary list when permissions or content change
        broadcastToRoom(room.id, {
          type: 'diary_sync',
          timestamp: entry.updatedAt,
        });

        sendJson(res, 200, {
          myEntry: toMyDiaryEntry(entry),
          publicEntry: sanitizeDiaryEntryForPublic(entry),
        });
        return true;
      }
    }

    sendJson(res, 404, { error: 'NOT_FOUND', message: 'Không tìm thấy đường dẫn yêu cầu.' });
    return true;
  } catch (err) {
    console.error('[OfficeServer] Internal error:', err);
    sendJson(res, 500, {
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Đã xảy ra lỗi trên máy chủ. Vui lòng thử lại.',
    });
    return true;
  }
}

