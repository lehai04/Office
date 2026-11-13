import {
  WORK_SEAT_LAYOUTS,
  MEETING_CHAIRS,
  DEFAULT_ROOM_CODE,
  DEFAULT_ROOM_NAME,
} from '../constants/officeLayout';
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
} from '../types/office';

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

interface StaticDatabaseSchema {
  dbVersion: number;
  accounts: Record<string, StoredAccount>;
  rooms: Record<string, RoomInfo>;
  roomMembers: StoredRoomMember[];
  seats: WorkSeat[];
  activeMeetingChairs: Record<string, string>; // key = `${roomId}:${userId}` -> meetingChairId
  messages: ChatMessage[];
  attendance: Record<string, AttendanceRecord>;
  diaryEntries: StoredDiaryEntry[];
}

const STATIC_DB_KEY = 'van_phong_ao_static_db_v3';
const STATIC_CHANNEL_NAME = 'van_phong_ao_realtime_channel_v3';
const MQTT_TOPIC = 'van_phong_ao_tinhtam_v3/room_sync_bus';
const CURRENT_DB_VERSION = 3;

export type StaticRealtimeEvent = {
  roomId: string;
  roomCode: string;
  hiddenUserIds?: string[];
  payload: Record<string, unknown>;
};

type RealtimeListener = (event: StaticRealtimeEvent) => void;
const listeners = new Set<RealtimeListener>();

function randomHex(bytes = 8): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

const PEER_NODE_ID = `peer_${randomHex(6)}`;

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(STATIC_CHANNEL_NAME);
    broadcastChannel.onmessage = (evt) => {
      if (evt.data && typeof evt.data === 'object') {
        const event = evt.data as StaticRealtimeEvent;
        for (const listener of listeners) {
          listener(event);
        }
      }
    };
  } catch {
    broadcastChannel = null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (evt) => {
    if (evt.key === STATIC_DB_KEY && evt.newValue) {
      try {
        const updatedDb = JSON.parse(evt.newValue) as StaticDatabaseSchema;
        for (const room of Object.values(updatedDb.rooms || {})) {
          const roomState = buildRoomStatePayload(updatedDb, room);
          for (const listener of listeners) {
            listener({
              roomId: room.id,
              roomCode: room.code,
              payload: { type: 'room_state', ...roomState },
            });
          }
        }
      } catch {
        // ignore
      }
    }
  });
}

// ============================================================================
// Đồng bộ đa thiết bị qua MQTT-over-WebSocket công cộng (không cần cài server)
// ============================================================================
let mqttWs: WebSocket | null = null;
let mqttConnected = false;
let mqttPingTimer: number | null = null;

function encodeRemainingLength(length: number): number[] {
  const bytes: number[] = [];
  let x = length;
  do {
    let encodedByte = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) {
      encodedByte = encodedByte | 128;
    }
    bytes.push(encodedByte);
  } while (x > 0);
  return bytes;
}

function encodeUtf8WithLength(str: string): Uint8Array {
  const utf8 = new TextEncoder().encode(str);
  const out = new Uint8Array(2 + utf8.length);
  out[0] = (utf8.length >> 8) & 0xff;
  out[1] = utf8.length & 0xff;
  out.set(utf8, 2);
  return out;
}

function buildMqttConnectPacket(clientId: string): Uint8Array {
  const protoName = encodeUtf8WithLength('MQTT');
  const clientIdBytes = encodeUtf8WithLength(clientId);
  const varHeader = new Uint8Array([
    ...protoName,
    0x04, // Protocol level 4 (MQTT 3.1.1)
    0x02, // Clean session
    0x00,
    0x3c, // Keepalive 60s
  ]);
  const remLen = varHeader.length + clientIdBytes.length;
  const remBytes = encodeRemainingLength(remLen);
  const packet = new Uint8Array(1 + remBytes.length + remLen);
  packet[0] = 0x10;
  packet.set(remBytes, 1);
  packet.set(varHeader, 1 + remBytes.length);
  packet.set(clientIdBytes, 1 + remBytes.length + varHeader.length);
  return packet;
}

function buildMqttSubscribePacket(topic: string): Uint8Array {
  const topicBytes = encodeUtf8WithLength(topic);
  const remLen = 2 + topicBytes.length + 1;
  const remBytes = encodeRemainingLength(remLen);
  const packet = new Uint8Array(1 + remBytes.length + remLen);
  let offset = 0;
  packet[offset++] = 0x82;
  for (const b of remBytes) packet[offset++] = b;
  packet[offset++] = 0x00;
  packet[offset++] = 0x01; // Packet ID 1
  packet.set(topicBytes, offset);
  offset += topicBytes.length;
  packet[offset] = 0x00; // QoS 0
  return packet;
}

function buildMqttPublishPacket(topic: string, payloadStr: string): Uint8Array {
  const topicBytes = encodeUtf8WithLength(topic);
  const payloadBytes = new TextEncoder().encode(payloadStr);
  const remLen = topicBytes.length + payloadBytes.length;
  const remBytes = encodeRemainingLength(remLen);
  const packet = new Uint8Array(1 + remBytes.length + remLen);
  let offset = 0;
  packet[offset++] = 0x30; // PUBLISH QoS 0
  for (const b of remBytes) packet[offset++] = b;
  packet.set(topicBytes, offset);
  offset += topicBytes.length;
  packet.set(payloadBytes, offset);
  return packet;
}

function publishOverMqtt(data: Record<string, unknown>): void {
  if (!mqttWs || !mqttConnected || mqttWs.readyState !== WebSocket.OPEN) return;
  try {
    const json = JSON.stringify({ ...data, senderPeerId: PEER_NODE_ID });
    mqttWs.send(buildMqttPublishPacket(MQTT_TOPIC, json));
  } catch {
    // ignore
  }
}

function mergeRemoteDatabase(remoteDb: StaticDatabaseSchema): StaticDatabaseSchema {
  const local = loadStaticDb();

  // Merge accounts
  for (const [token, acc] of Object.entries(remoteDb.accounts || {})) {
    local.accounts[token] = acc;
  }

  // Merge rooms
  for (const [code, room] of Object.entries(remoteDb.rooms || {})) {
    local.rooms[code] = room;
  }

  // Merge roomMembers
  for (const rm of remoteDb.roomMembers || []) {
    const idx = local.roomMembers.findIndex(
      (m) => m.roomId === rm.roomId && m.userId === rm.userId
    );
    if (idx === -1) {
      local.roomMembers.push(rm);
    } else if (rm.lastSeenAt >= local.roomMembers[idx].lastSeenAt) {
      local.roomMembers[idx] = rm;
    }
  }

  // Merge seats
  for (const rs of remoteDb.seats || []) {
    const idx = local.seats.findIndex(
      (s) => s.roomId === rs.roomId && s.seatId === rs.seatId
    );
    if (idx === -1) {
      local.seats.push(rs);
    } else {
      local.seats[idx] = rs;
    }
  }

  // Merge activeMeetingChairs
  if (remoteDb.activeMeetingChairs) {
    local.activeMeetingChairs = {
      ...local.activeMeetingChairs,
      ...remoteDb.activeMeetingChairs,
    };
  }

  // Merge messages
  const msgIds = new Set(local.messages.map((m) => m.id));
  for (const msg of remoteDb.messages || []) {
    if (!msgIds.has(msg.id)) {
      local.messages.push(msg);
      msgIds.add(msg.id);
    }
  }
  local.messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (local.messages.length > 500) {
    local.messages = local.messages.slice(-500);
  }

  // Merge attendance
  for (const [k, rec] of Object.entries(remoteDb.attendance || {})) {
    const cur = local.attendance[k];
    if (!cur || rec.seq >= cur.seq) {
      local.attendance[k] = rec;
    }
  }

  // Merge diaryEntries
  for (const entry of remoteDb.diaryEntries || []) {
    const idx = local.diaryEntries.findIndex((d) => d.id === entry.id);
    if (idx === -1) {
      local.diaryEntries.push(entry);
    } else if (entry.updatedAt >= local.diaryEntries[idx].updatedAt) {
      local.diaryEntries[idx] = entry;
    }
  }

  saveStaticDb(local);
  return local;
}

function ensureMqttBridge(): void {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
  if (mqttWs && (mqttWs.readyState === WebSocket.OPEN || mqttWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    const ws = new WebSocket('wss://broker.emqx.io:8084/mqtt', 'mqtt');
    ws.binaryType = 'arraybuffer';
    mqttWs = ws;

    ws.onopen = () => {
      try {
        ws.send(buildMqttConnectPacket(`vpa_${PEER_NODE_ID}`));
      } catch {
        // ignore
      }
    };

    ws.onmessage = (evt) => {
      if (!(evt.data instanceof ArrayBuffer)) return;
      const bytes = new Uint8Array(evt.data);
      if (bytes.length < 2) return;
      const packetType = bytes[0] & 0xf0;

      // CONNACK (0x20)
      if (packetType === 0x20) {
        mqttConnected = true;
        ws.send(buildMqttSubscribePacket(MQTT_TOPIC));
        publishOverMqtt({ type: 'peer_hello' });
        if (mqttPingTimer) window.clearInterval(mqttPingTimer);
        mqttPingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(new Uint8Array([0xc0, 0x00]));
          }
        }, 25000);
        return;
      }

      // PUBLISH (0x30)
      if (packetType === 0x30) {
        let idx = 1;
        let multiplier = 1;
        let remLen = 0;
        let encodedByte = 0;
        do {
          if (idx >= bytes.length) return;
          encodedByte = bytes[idx++];
          remLen += (encodedByte & 127) * multiplier;
          multiplier *= 128;
        } while ((encodedByte & 128) !== 0);

        if (idx + 2 > bytes.length) return;
        const topicLen = (bytes[idx] << 8) | bytes[idx + 1];
        idx += 2 + topicLen;

        const qos = (bytes[0] & 0x06) >> 1;
        if (qos > 0) idx += 2;

        if (idx >= bytes.length) return;
        const payloadBytes = bytes.subarray(idx, idx + remLen - (2 + topicLen + (qos > 0 ? 2 : 0)));
        const jsonStr = new TextDecoder().decode(payloadBytes);
        try {
          const msg = JSON.parse(jsonStr);
          if (!msg || msg.senderPeerId === PEER_NODE_ID) return;

          if (msg.type === 'peer_hello') {
            publishOverMqtt({
              type: 'peer_sync',
              db: loadStaticDb(),
            });
            return;
          }

          if (msg.type === 'peer_reset') {
            const fresh = createFreshStaticDb();
            saveStaticDb(fresh);
            return;
          }

          if (msg.type === 'peer_sync' && msg.db) {
            const merged = mergeRemoteDatabase(msg.db as StaticDatabaseSchema);
            if (msg.event) {
              const ev = msg.event as StaticRealtimeEvent;
              for (const listener of listeners) {
                listener(ev);
              }
              broadcastChannel?.postMessage(ev);
            } else {
              for (const r of Object.values(merged.rooms)) {
                const st = buildRoomStatePayload(merged, r);
                const ev: StaticRealtimeEvent = {
                  roomId: r.id,
                  roomCode: r.code,
                  payload: { type: 'room_state', ...st },
                };
                for (const listener of listeners) {
                  listener(ev);
                }
              }
            }
          }
        } catch {
          // ignore malformed packet
        }
      }
    };

    ws.onclose = () => {
      mqttConnected = false;
      if (mqttPingTimer) {
        window.clearInterval(mqttPingTimer);
        mqttPingTimer = null;
      }
    };

    ws.onerror = () => {
      mqttConnected = false;
    };
  } catch {
    // ignore WebSocket creation failure
  }
}

export function subscribeStaticRealtime(listener: RealtimeListener): () => void {
  ensureMqttBridge();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitRealtimeEvent(
  db: StaticDatabaseSchema,
  room: RoomInfo,
  payload: Record<string, unknown>,
  hiddenUserIds?: string[]
): void {
  const evt: StaticRealtimeEvent = {
    roomId: room.id,
    roomCode: room.code,
    hiddenUserIds,
    payload,
  };
  for (const listener of listeners) {
    listener(evt);
  }
  try {
    broadcastChannel?.postMessage(evt);
  } catch {
    // ignore
  }
  publishOverMqtt({
    type: 'peer_sync',
    db,
    event: evt,
  });
}

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

function createFreshStaticDb(): StaticDatabaseSchema {
  const defaultRoomId = 'room_tinhtam_default';
  const secondRoomId = 'room_ketnoi_02';
  return {
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
    activeMeetingChairs: {},
    messages: [],
    attendance: {},
    diaryEntries: [],
  };
}

function loadStaticDb(): StaticDatabaseSchema {
  if (typeof window === 'undefined') {
    return createFreshStaticDb();
  }
  try {
    const raw = window.localStorage.getItem(STATIC_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StaticDatabaseSchema;
      if (parsed && parsed.dbVersion === CURRENT_DB_VERSION && parsed.rooms && parsed.seats) {
        if (!parsed.activeMeetingChairs) parsed.activeMeetingChairs = {};
        return parsed;
      }
    }
  } catch {
    // ignore corrupt storage
  }
  const fresh = createFreshStaticDb();
  saveStaticDb(fresh);
  return fresh;
}

function saveStaticDb(db: StaticDatabaseSchema): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STATIC_DB_KEY, JSON.stringify(db));
  } catch {
    // ignore quota error
  }
}

function buildRoomStatePayload(db: StaticDatabaseSchema, room: RoomInfo) {
  const roomSeats = db.seats.filter((s) => s.roomId === room.id);
  const rawMembers = db.roomMembers.filter((m) => m.roomId === room.id);

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
    const currentMeetingChair = db.activeMeetingChairs[`${room.id}:${m.userId}`] ?? null;
    return {
      userId: m.userId,
      roomId: m.roomId,
      nickname: m.nickname,
      avatarGender: m.avatarGender,
      memberTag: m.memberTag,
      seatId: mySeat ? mySeat.seatId : null,
      meetingChairId: currentMeetingChair,
      online: true,
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

function createApiError(status: number, code: string, message: string): Error {
  const err = new Error(message) as Error & { code?: string; status?: number };
  err.code = code;
  err.status = status;
  return err;
}

export async function handleStaticFallbackRequest<T>(
  path: string,
  options: RequestInit = {},
  sessionToken?: string
): Promise<T> {
  ensureMqttBridge();
  const method = (options.method || 'GET').toUpperCase();
  const body: Record<string, unknown> =
    typeof options.body === 'string' && options.body.trim()
      ? JSON.parse(options.body)
      : {};

  const urlObj = new URL(path, 'http://localhost');
  const pathname = urlObj.pathname;
  let db = loadStaticDb();

  if (pathname === '/api/health' && method === 'GET') {
    return { ok: true, mode: 'static_fallback' } as unknown as T;
  }

  if (pathname === '/api/reset' && method === 'POST') {
    db = createFreshStaticDb();
    saveStaticDb(db);
    publishOverMqtt({ type: 'peer_reset' });
    return {
      ok: true,
      message: 'Đã xóa toàn bộ tài khoản cũ để bắt đầu game mới.',
    } as unknown as T;
  }

  if (pathname === '/api/auth/join' && method === 'POST') {
    const rawNickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
    const rawGender: AvatarGender = body.avatarGender === 'female' ? 'female' : 'male';
    const rawRoomCode =
      typeof body.roomCode === 'string' && body.roomCode.trim()
        ? body.roomCode.trim().toUpperCase()
        : DEFAULT_ROOM_CODE;
    const createIfMissing = Boolean(body.createIfMissing);

    const existingAccount = sessionToken ? db.accounts[sessionToken] ?? null : null;

    if (!rawNickname && !existingAccount) {
      throw createApiError(400, 'INVALID_NICKNAME', 'Vui lòng nhập biệt danh của bạn.');
    }

    let room = db.rooms[rawRoomCode];
    if (!room) {
      if (createIfMissing && rawRoomCode.length >= 2 && rawRoomCode.length <= 20) {
        const newRoomId = `room_${rawRoomCode.toLowerCase()}_${randomHex(3)}`;
        room = {
          id: newRoomId,
          code: rawRoomCode,
          name: `Văn phòng ${rawRoomCode}`,
        };
        db.rooms[rawRoomCode] = room;
        db.seats.push(...createInitialSeatsForRoom(newRoomId));
      } else {
        throw createApiError(
          404,
          'ROOM_NOT_FOUND',
          `Mã phòng "${rawRoomCode}" không tồn tại. Hãy dùng mã "${DEFAULT_ROOM_CODE}" hoặc bật tùy chọn tạo phòng mới.`
        );
      }
    }

    let account = existingAccount;
    const nowIso = new Date().toISOString();

    if (!account) {
      const userId = `usr_${randomHex(8)}`;
      const newToken = sessionToken || `tok_${randomHex(18)}`;
      const memberTag = `#${userId.slice(4, 8).toUpperCase()}`;
      account = {
        userId,
        sessionToken: newToken,
        nickname: rawNickname || 'Thành viên',
        avatarGender: rawGender,
        memberTag,
        createdAt: nowIso,
      };
      db.accounts[newToken] = account;
    } else {
      if (rawNickname) account.nickname = rawNickname;
      if (body.avatarGender === 'male' || body.avatarGender === 'female') {
        account.avatarGender = body.avatarGender;
      }
    }

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

    delete db.activeMeetingChairs[`${room.id}:${account.userId}`];
    saveStaticDb(db);

    const roomState = buildRoomStatePayload(db, room);
    emitRealtimeEvent(db, room, {
      type: 'room_state',
      ...roomState,
    });

    const mySeat = roomState.seats.find((s) => s.occupiedByUserId === account!.userId);

    return {
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
    } as unknown as T;
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)(?:\/(.*))?$/);
  if (!roomMatch) {
    throw createApiError(404, 'NOT_FOUND', 'API endpoint không tồn tại.');
  }

  const roomCode = decodeURIComponent(roomMatch[1]).toUpperCase();
  const subPath = roomMatch[2] || '';
  const room = db.rooms[roomCode];

  if (!room) {
    throw createApiError(404, 'ROOM_NOT_FOUND', 'Phòng không tồn tại.');
  }

  const account = sessionToken ? db.accounts[sessionToken] ?? null : null;
  if (!account) {
    throw createApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  }

  const memberRecord = db.roomMembers.find(
    (m) => m.roomId === room.id && m.userId === account.userId
  );
  if (!memberRecord) {
    throw createApiError(
      403,
      'FORBIDDEN_NOT_ROOM_MEMBER',
      'Bạn không phải là thành viên của văn phòng này.'
    );
  }

  memberRecord.lastSeenAt = new Date().toISOString();

  if (subPath === 'state' && method === 'GET') {
    const roomState = buildRoomStatePayload(db, room);
    const recentMessages = db.messages.filter((m) => m.roomId === room.id).slice(-60);
    const prefix = `${room.id}:${account.userId}:`;
    const myAttendance: AttendanceRecord[] = [];
    for (const [k, val] of Object.entries(db.attendance)) {
      if (k.startsWith(prefix)) {
        myAttendance.push(val);
      }
    }
    const visibleDiary = db.diaryEntries
      .filter((d) => d.roomId === room.id && !d.hiddenUserIds.includes(account.userId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(sanitizeDiaryEntryForPublic);
    const myDiary = db.diaryEntries
      .filter((d) => d.roomId === room.id && d.authorId === account.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toMyDiaryEntry);

    saveStaticDb(db);
    return {
      ...roomState,
      messages: recentMessages,
      attendance: myAttendance,
      diaryFeed: visibleDiary,
      myDiary,
    } as unknown as T;
  }

  if (subPath === 'code' && method === 'PUT') {
    const newCode =
      typeof body.newRoomCode === 'string' ? body.newRoomCode.trim().toUpperCase() : '';
    const newName =
      typeof body.newRoomName === 'string' && body.newRoomName.trim()
        ? body.newRoomName.trim()
        : `Văn phòng ${newCode}`;

    if (!newCode || newCode.length < 2 || newCode.length > 20) {
      throw createApiError(400, 'INVALID_ROOM_CODE', 'Mã phòng phải từ 2 đến 20 ký tự.');
    }

    if (newCode !== room.code && db.rooms[newCode]) {
      throw createApiError(
        409,
        'ROOM_CODE_EXISTS',
        `Mã phòng "${newCode}" đã tồn tại. Hãy chọn mã khác.`
      );
    }

    const oldCode = room.code;
    delete db.rooms[oldCode];
    room.code = newCode;
    room.name = newName;
    db.rooms[newCode] = room;
    saveStaticDb(db);

    const roomState = buildRoomStatePayload(db, room);
    emitRealtimeEvent(db, room, { type: 'room_state', ...roomState });

    return {
      ...roomState,
      session: {
        userId: account.userId,
        sessionToken: account.sessionToken,
        roomCode: room.code,
        nickname: account.nickname,
        avatarGender: account.avatarGender,
        memberTag: account.memberTag,
      },
    } as unknown as T;
  }

  if (subPath === 'seats/claim' && method === 'POST') {
    const seatId = typeof body.seatId === 'string' ? body.seatId.trim() : '';
    const targetSeat = db.seats.find((s) => s.roomId === room.id && s.seatId === seatId);
    if (!targetSeat) {
      throw createApiError(404, 'SEAT_NOT_FOUND', 'Ghế làm việc không tồn tại.');
    }

    if (
      targetSeat.occupiedByUserId !== null &&
      targetSeat.occupiedByUserId !== account.userId
    ) {
      const occupier = db.roomMembers.find(
        (m) => m.roomId === room.id && m.userId === targetSeat.occupiedByUserId
      );
      throw createApiError(
        409,
        'SEAT_TAKEN',
        `Ghế này đã được ${occupier ? occupier.nickname : 'đồng nghiệp khác'} chọn trước. Vui lòng chọn ghế trống khác hoặc đứng gần cửa!`
      );
    }

    for (const s of db.seats) {
      if (
        s.roomId === room.id &&
        s.occupiedByUserId === account.userId &&
        s.seatId !== seatId
      ) {
        s.occupiedByUserId = null;
        s.claimedAt = null;
      }
    }

    targetSeat.occupiedByUserId = account.userId;
    targetSeat.claimedAt = new Date().toISOString();
    delete db.activeMeetingChairs[`${room.id}:${account.userId}`];
    saveStaticDb(db);

    const roomState = buildRoomStatePayload(db, room);
    emitRealtimeEvent(db, room, { type: 'room_state', ...roomState });

    return {
      claimedSeatId: targetSeat.seatId,
      ...roomState,
    } as unknown as T;
  }

  if (subPath === 'seats/stand' && method === 'POST') {
    for (const s of db.seats) {
      if (s.roomId === room.id && s.occupiedByUserId === account.userId) {
        s.occupiedByUserId = null;
        s.claimedAt = null;
      }
    }
    delete db.activeMeetingChairs[`${room.id}:${account.userId}`];
    saveStaticDb(db);

    const roomState = buildRoomStatePayload(db, room);
    emitRealtimeEvent(db, room, { type: 'room_state', ...roomState });

    return {
      claimedSeatId: null,
      ...roomState,
    } as unknown as T;
  }

  if (subPath === 'meeting/sit' && method === 'POST') {
    const meetingChairId =
      typeof body.meetingChairId === 'string' && body.meetingChairId.trim()
        ? body.meetingChairId.trim()
        : null;
    const key = `${room.id}:${account.userId}`;

    if (!meetingChairId) {
      delete db.activeMeetingChairs[key];
      saveStaticDb(db);
      const roomState = buildRoomStatePayload(db, room);
      emitRealtimeEvent(db, room, { type: 'room_state', ...roomState });
      return { meetingChairId: null, ...roomState } as unknown as T;
    }

    const validChair = MEETING_CHAIRS.find((c) => c.id === meetingChairId);
    if (!validChair) {
      throw createApiError(404, 'MEETING_CHAIR_NOT_FOUND', 'Ghế bàn họp không tồn tại.');
    }

    for (const [k, chairId] of Object.entries(db.activeMeetingChairs)) {
      if (k.startsWith(`${room.id}:`) && k !== key && chairId === meetingChairId) {
        throw createApiError(
          409,
          'MEETING_CHAIR_TAKEN',
          'Ghế bàn họp này đang có đồng nghiệp ngồi. Hãy chọn ghế họp trống bên cạnh!'
        );
      }
    }

    db.activeMeetingChairs[key] = meetingChairId;
    saveStaticDb(db);
    const roomState = buildRoomStatePayload(db, room);
    emitRealtimeEvent(db, room, { type: 'room_state', ...roomState });
    return { meetingChairId, ...roomState } as unknown as T;
  }

  if (subPath === 'messages' && method === 'POST') {
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const clientMsgId =
      typeof body.clientMsgId === 'string' && body.clientMsgId.trim()
        ? body.clientMsgId.trim()
        : `cmsg_${randomHex(6)}`;

    if (!content) {
      throw createApiError(400, 'EMPTY_MESSAGE', 'Nội dung tin nhắn không được để trống.');
    }

    const existingMsg = db.messages.find(
      (m) =>
        m.roomId === room.id &&
        m.userId === account.userId &&
        m.clientMsgId === clientMsgId
    );
    if (existingMsg) {
      return { message: existingMsg, deduplicated: true } as unknown as T;
    }

    const newMsg: ChatMessage = {
      id: `msg_${randomHex(8)}`,
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
    saveStaticDb(db);

    emitRealtimeEvent(db, room, {
      type: 'chat_message',
      message: newMsg,
    });

    return { message: newMsg, deduplicated: false } as unknown as T;
  }

  if (subPath === 'attendance' && method === 'POST') {
    const date = typeof body.date === 'string' ? body.date.trim() : '';
    const status = body.status as AttendanceStatus;
    const seq = typeof body.seq === 'number' ? body.seq : 1;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw createApiError(400, 'INVALID_DATE', 'Định dạng ngày không hợp lệ (YYYY-MM-DD).');
    }
    if (!['none', 'full', 'half', 'off'].includes(status)) {
      throw createApiError(400, 'INVALID_STATUS', 'Trạng thái chấm công không hợp lệ.');
    }

    const key = `${room.id}:${account.userId}:${date}`;
    const current = db.attendance[key];
    if (!current || seq >= current.seq) {
      db.attendance[key] = {
        date,
        status,
        seq,
        updatedAt: new Date().toISOString(),
      };
      saveStaticDb(db);
    }

    return { record: db.attendance[key] } as unknown as T;
  }

  if (subPath === 'diary' && method === 'GET') {
    const visibleEntries = db.diaryEntries
      .filter((d) => d.roomId === room.id && !d.hiddenUserIds.includes(account.userId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(sanitizeDiaryEntryForPublic);

    return { entries: visibleEntries } as unknown as T;
  }

  if (subPath === 'diary/mine' && method === 'GET') {
    const myEntries = db.diaryEntries
      .filter((d) => d.roomId === room.id && d.authorId === account.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toMyDiaryEntry);

    return { entries: myEntries } as unknown as T;
  }

  if (subPath === 'diary' && method === 'POST') {
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
      throw createApiError(400, 'EMPTY_DIARY', 'Hãy viết đôi dòng tâm sự trước khi đăng nhé.');
    }

    const nowIso = new Date().toISOString();
    const newEntry: StoredDiaryEntry = {
      id: `diary_${randomHex(8)}`,
      roomId: room.id,
      authorId: account.userId,
      mood,
      content,
      hiddenUserIds,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.diaryEntries.push(newEntry);
    saveStaticDb(db);

    emitRealtimeEvent(
      db,
      room,
      {
        type: 'diary_sync',
        timestamp: nowIso,
      },
      hiddenUserIds
    );

    return {
      myEntry: toMyDiaryEntry(newEntry),
      publicEntry: sanitizeDiaryEntryForPublic(newEntry),
    } as unknown as T;
  }

  const diaryIdMatch = subPath.match(/^diary\/([^/]+)$/);
  if (diaryIdMatch) {
    const entryId = decodeURIComponent(diaryIdMatch[1]);
    const entry = db.diaryEntries.find((d) => d.roomId === room.id && d.id === entryId);

    if (method === 'GET') {
      if (!entry || entry.hiddenUserIds.includes(account.userId)) {
        throw createApiError(
          404,
          'DIARY_NOT_FOUND_OR_HIDDEN',
          'Bài nhật ký không tồn tại hoặc không khả dụng với bạn.'
        );
      }
      return { entry: sanitizeDiaryEntryForPublic(entry) } as unknown as T;
    }

    if (method === 'PUT') {
      if (!entry) {
        throw createApiError(404, 'DIARY_NOT_FOUND', 'Không tìm thấy bài nhật ký.');
      }
      if (entry.authorId !== account.userId) {
        throw createApiError(
          403,
          'FORBIDDEN_NOT_AUTHOR',
          'Chỉ người viết mới được chỉnh sửa bài nhật ký của mình.'
        );
      }

      if (typeof body.content === 'string') {
        const trimmed = body.content.trim();
        if (!trimmed) {
          throw createApiError(400, 'EMPTY_DIARY', 'Nội dung bài viết không được để trống.');
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
      saveStaticDb(db);

      emitRealtimeEvent(db, room, {
        type: 'diary_sync',
        timestamp: entry.updatedAt,
      });

      return {
        myEntry: toMyDiaryEntry(entry),
        publicEntry: sanitizeDiaryEntryForPublic(entry),
      } as unknown as T;
    }
  }

  throw createApiError(404, 'NOT_FOUND', 'Không tìm thấy đường dẫn yêu cầu.');
}
