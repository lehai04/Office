import { ALL_PET_BREEDS } from '../src/utils/officeCatsData';
import { PET_EVENTS, type PetEvent, type PrivateChatInvite } from '../src/utils/officeSocial';
import { isOfficeMood, type OfficePresence, type PrivateChatGroup, type PrivateChatMessage } from '../src/utils/officeSocial';
import { isOfficeAction, type OfficeActionEvent } from '../src/utils/officeShop';
import { BOXING } from '../src/utils/boxing';
import { activeFighters, boxingView, createBoxingState, punch, recoverFish, updateFighter, type BoxingState } from './boxing';
import { restoreShop, runShopCommand, type StoredShop } from './officeShop';
import { OFFICE_SHOP, SHOP_OFFERINGS, equippedItems, type RoomShopView, type ShopConsumable } from '../src/utils/officeShop';
import { calculateDonationMerit, createDefaultWalletState, settlePastMonthsSalary, type DonationRecord, type RoomDonationBoxState } from '../src/utils/officeEconomyData';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { adjustAltarMerit, altarView, createAltarState, settleAltar, updateAltar, type RoomAltarState } from './zenAltar';
import { getNowInHoChiMinh, VN_TIMEZONE } from '../src/utils/dateVn';
import { pushPublicKey, parseReminderDevice, sendReminder, type ReminderDevice } from './reminderPush';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { WORK_SEAT_LAYOUTS, MEETING_CHAIRS, DOOR_STANDING_SLOTS, DEFAULT_ROOM_CODE, DEFAULT_ROOM_NAME } from '../src/constants/officeLayout';
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
import {
  advanceDonationCaseByTime,
  calculateAbbotTheftMeritPenalty,
  calculateStealAmountVnd,
  ensureUserLedger,
  isAbbotNickname,
  isDonationCaseOpen,
  nextDonationCase,
  nextDonationCaseUpdateAt,
  queueDonationCase,
  resolveSuspectByInput,
  submitDonationCaseVote,
  toPublicDonationCaseView,
  type DonationCaseServerRecord,
  type RoomEconomyLedger,
} from '../src/utils/donationCaseEngine';

interface StoredAccount {
  passwordHash?: string;
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
  presence?: OfficePresence;
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

interface StoredPrivateChat {
  code: string;
  name: string;
  passwordHash: string;
  members: string[];
  invites?: Record<string, PrivateChatInvite>;
  messages: PrivateChatMessage[];
}

function publicChat(group: StoredPrivateChat): PrivateChatGroup {
  return { code: group.code, name: group.name, memberCount: group.members.length };
}

const petEventTimes = new Map<string, number>();
const privateChatAttempts = new Map<string, { count: number; expiresAt: number }>();

interface DatabaseSchema {
  dbVersion?: number;
  accounts: Record<string, StoredAccount>; // keyed by sessionToken
  rooms: Record<string, RoomInfo>; // keyed by uppercase roomCode
  roomMembers: StoredRoomMember[];
  seats: WorkSeat[];
  messages: ChatMessage[];
  attendance: Record<string, AttendanceRecord>; // keyed by `${roomId}:${userId}:${date}`
  diaryEntries: StoredDiaryEntry[];
  roomDonationBoxes?: Record<string, Omit<RoomDonationBoxState, 'donations'> & { donations?: DonationRecord[] }>;
  roomDonationCases?: Record<string, DonationCaseServerRecord>;
  roomEconomyLedgers?: Record<string, RoomEconomyLedger>;
  reminderDevices?: Record<string, ReminderDevice>;
  altars?: Record<string, RoomAltarState>;
  legacyRoomData?: Record<string, unknown>;
  shops?: Record<string, Record<string, StoredShop>>;
  boxing?: Record<string, BoxingState>;
  privateChats?: Record<string, Record<string, StoredPrivateChat>>;
  vggMeritBatch?: { members: number; records: number; credited: number; skipped: number; gift: number };
}

export async function dispatchDailyReminders(): Promise<void> {
  if (!pushPublicKey) return;
  db ??= loadDatabase();
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TIMEZONE, hour: '2-digit', hourCycle: 'h23',
  }).format(new Date());
  if (hour < '09' || hour >= '21') return;
  const { dateStr } = getNowInHoChiMinh();
  const devices = db.reminderDevices;
  if (!devices) return;
  for (const [id, device] of Object.entries(devices)) {
    if (device.lastSent === dateStr) continue;
    const room = Object.values(db.rooms).find((item) => item.id === device.roomId);
    if (!room || !db.roomMembers.some((m) => m.roomId === room.id && m.userId === device.userId)) continue;
    const attendance = db.attendance[`${room.id}:${device.userId}:${dateStr}`]?.status;
    const worked = device.workDate === dateStr;
    const lines = [
      device.enableWork && !worked && 'Hôm nay bạn đã đi làm chưa?',
      device.enableAttendance && (!attendance || attendance === 'none') && 'Hôm nay bạn đã chấm công chưa?',
      device.enableBuddha && device.bowDate !== dateStr && 'Hôm nay bạn đã lạy Phật chưa?',
    ].filter(Boolean);
    if (!lines.length) continue;
    try {
      await sendReminder(device, lines.join('\n'), dateStr);
      if (devices[id]?.userId === device.userId) devices[id].lastSent = dateStr;
      saveDatabase(db, true);
    } catch (error) {
      const status = (error as {statusCode?: number}).statusCode;
      if ((status === 404 || status === 410) && devices[id] === device) {
        delete devices[id];
        saveDatabase(db, true);
      }
    }
  }
}

const CURRENT_DB_VERSION = 3;

interface SseClient {
  id: string;
  userId: string;
  roomId: string;
  roomCode: string;
  res: ServerResponse;
}

export type OfficeRealtimeMember = Pick<SseClient, 'roomId' | 'userId'>;

interface OfficeStorage {
  save: (database: string) => void;
  broadcast: (roomId: string, event: Record<string, unknown>, filter?: (member: OfficeRealtimeMember) => boolean) => void;
  isOnline: (roomId: string, userId: string) => boolean;
  zenStatus: (roomId: string, userId: string, active?: boolean) => boolean;
  schedule: (time: number | undefined) => Promise<void>;
}

let officeStorage: OfficeStorage | undefined;

export function configureOfficeStorage(storage: OfficeStorage, snapshot?: string): void {
  officeStorage = storage;
  if (snapshot) {
    const parsed = JSON.parse(snapshot) as DatabaseSchema;
    if (parsed.dbVersion !== CURRENT_DB_VERSION || !parsed.rooms || !parsed.accounts || !parsed.seats) {
      throw new Error('Invalid Office database snapshot');
    }
    db = parsed;
  } else {
    db = loadDatabase();
  }
}

export function authorizeOfficeRealtime(roomCode: string, token: string): OfficeRealtimeMember | null {
  const room = db.rooms[roomCode];
  const account = db.accounts[token];
  if (!room || !account || !db.roomMembers.some((member) => member.roomId === room.id && member.userId === account.userId)) return null;
  return { roomId: room.id, userId: account.userId };
}

interface VggImport {
  format: string;
  room: RoomInfo;
  accounts: Omit<StoredAccount, 'sessionToken'>[];
  roomMembers: StoredRoomMember[];
  seats: WorkSeat[];
  attendance: Record<string, AttendanceRecord>;
  messages: ChatMessage[];
  diaryEntries: StoredDiaryEntry[];
  legacyRoomData?: unknown;
}

export function importVggRoom(data: VggImport): { members: number; accounts: number; messages: number } {
  if (db.rooms.VGG) throw new Error('VGG_ALREADY_EXISTS');
  const room = data.room;
  if (data.format !== 'office-room-import-v1' || room?.code !== 'VGG' ||
      !/^[\w-]{1,100}$/.test(room.id) ||
      Object.values(db.rooms).some((existing) => existing.id === room.id) ||
      ![data.accounts, data.roomMembers, data.seats, data.messages, data.diaryEntries].every(Array.isArray) ||
      !data.attendance || typeof data.attendance !== 'object') throw new Error('INVALID_OFFICE_BACKUP');
  const ids = new Set(data.roomMembers.map((member) => member.userId));
  if (ids.size !== data.roomMembers.length || (room.managerUserId && !ids.has(room.managerUserId)) ||
      data.roomMembers.some((member) => member.roomId !== room.id || !member.userId || typeof member.nickname !== 'string') ||
      new Set(data.accounts.map((account) => account.userId)).size !== data.accounts.length ||
      data.accounts.some((account) => !ids.has(account.userId) ||
        !/^[0-9a-f]{32}:[0-9a-f]{64}$/.test(account.passwordHash ?? '') ||
        Object.values(db.accounts).some((existing) => existing.userId === account.userId)) ||
      [...data.seats, ...data.messages, ...data.diaryEntries].some((item) => item.roomId !== room.id) ||
      Object.keys(data.attendance).some((key) => !key.startsWith(`${room.id}:`))) throw new Error('INVALID_OFFICE_BACKUP');

  const accounts = { ...db.accounts };
  for (const { userId, nickname, avatarGender, memberTag, createdAt, passwordHash } of data.accounts) {
    const sessionToken = `tok_${crypto.randomBytes(18).toString('hex')}`;
    accounts[sessionToken] = { userId, nickname, avatarGender, memberTag, createdAt, passwordHash, sessionToken };
  }
  const next = {
    ...db,
    rooms: { ...db.rooms, VGG: room },
    accounts,
    roomMembers: [...db.roomMembers, ...data.roomMembers],
    seats: [...db.seats, ...data.seats],
    messages: [...db.messages, ...data.messages],
    attendance: { ...db.attendance, ...data.attendance },
    diaryEntries: [...db.diaryEntries, ...data.diaryEntries],
    legacyRoomData: { ...db.legacyRoomData, VGG: data.legacyRoomData },
  };
  saveDatabase(next, true);
  db = next;
  return { members: data.roomMembers.length, accounts: data.accounts.length, messages: data.messages.length };
}

export function publishOfficePresence(roomId: string): void {
  const room = Object.values(db.rooms).find((item) => item.id === roomId);
  if (room) broadcastToRoom(room.id, { type: 'room_state', ...buildRoomStatePayload(room) });
}

function getRoomShop(room: RoomInfo, userId: string) {
  const shops = ((db.shops ??= {})[room.id] ??= {});
  const roomLedger = ((db.roomEconomyLedgers ??= {})[room.code] ??= { users: {}, abbotStealCount: 0 });
  if (!shops[userId]) {
    const backup = db.legacyRoomData?.[room.code] as { browserData?: Record<string, unknown> } | undefined;
    const restored = restoreShop(backup?.browserData?.[`van_phong_ao_wallet_v1:${room.code}:${userId}`]);
    shops[userId] = restored.shop;
    const ledger = ensureUserLedger(roomLedger, userId, restored.balance);
    if (restored.balance !== undefined) ledger.balanceVnd = restored.balance;
  }
  const stored = shops[userId];
  if (!stored.bedGranted) {
    stored.bedGranted = true;
    if (!stored.state.inventory.bed && !stored.state.decorations.some((placed) => placed.item === 'bed')) stored.state.inventory.bed = 1;
  }
  return { shops, stored, ledger: ensureUserLedger(roomLedger, userId) };
}

function serverDonationBox(room: RoomInfo): RoomDonationBoxState {
  const boxes = db.roomDonationBoxes ??= {};
  const existing = boxes[room.code];
  if (existing?.donations) return existing as RoomDonationBoxState;
  const archived = db.legacyRoomData?.[room.code] as {
    roomDonationBoxes?: Partial<RoomDonationBoxState> | Record<string, Partial<RoomDonationBoxState>>;
    browserData?: Record<string, unknown>;
  } | undefined;
  const archivedBoxes = archived?.roomDonationBoxes;
  const archivedBox = archivedBoxes && typeof archivedBoxes === 'object' && 'totalVnd' in archivedBoxes
    ? archivedBoxes as Partial<RoomDonationBoxState>
    : (archivedBoxes as Record<string, Partial<RoomDonationBoxState>> | undefined)?.[room.code];
  let browserBox: Partial<RoomDonationBoxState> | undefined;
  const raw = archived?.browserData?.['van_phong_ao_donation_box_v1:' + room.code];
  if (typeof raw === 'string') {
    try { browserBox = JSON.parse(raw) as Partial<RoomDonationBoxState>; } catch { /* Missing archived hòm data. */ }
  }
  const total = archivedBox?.totalVnd ?? browserBox?.totalVnd;
  const box = boxes[room.code] ??= { totalVnd: Number.isSafeInteger(total) && total! >= 0 ? total! : 0, updatedAt: Date.now() };
  box.donations ??= [archivedBox?.donations, browserBox?.donations].find(Array.isArray)
    ?.filter((entry) => entry && entry.kind !== 'rob').slice(0, 50) ?? [];
  return box as RoomDonationBoxState;
}

function changeRoomAltarMerit(roomId: string, userId: string, delta: number) {
  if (delta) adjustAltarMerit((db.altars ??= {})[roomId] ??= createAltarState(), userId, delta);
}

export function auditVggMeritBatch(apply: boolean, expected?: string) {
  if (db.vggMeritBatch) return { ...db.vggMeritBatch, applied: true };
  const room = db.rooms.VGG;
  if (!room) throw new Error('VGG_NOT_FOUND');
  const members = db.roomMembers.filter((member) => member.roomId === room.id);
  const box = serverDonationBox(room);
  const credited = new Set(box.donations.map((entry) => entry.donorUserId + ':' + entry.id));
  const credits = new Map<string, number>();
  const records: string[] = [];
  let skipped = 0;
  for (const member of members) {
    const receipts = db.shops?.[room.id]?.[member.userId]?.receipts ?? {};
    for (const [id, signature] of Object.entries(receipts)) {
      let values: unknown[];
      try { values = JSON.parse(signature) as unknown[]; } catch { continue; }
      if (!Array.isArray(values) || values[0] !== 'donate' || credited.has(member.userId + ':' + id)) continue;
      const amount = values[4];
      if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1000) continue;
      // At the retention boundary, an absent record may already have earned points.
      if (box.donations.length >= 50) { skipped++; continue; }
      records.push(member.userId + ':' + id);
      credits.set(member.userId, (credits.get(member.userId) ?? 0) + calculateDonationMerit(amount));
    }
  }
  const gift = 300;
  const summary = { members: members.length, records: records.length, credited: [...credits.values()].reduce((a, b) => a + b, 0), skipped, gift };
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify([
    members.map(({ userId }) => userId).sort(), records.sort(), summary,
  ])).digest('hex');
  if (!apply) return { ...summary, fingerprint, applied: false };
  if (expected !== fingerprint) throw new Error('AUDIT_CHANGED');

  for (const member of members) changeRoomAltarMerit(room.id, member.userId, gift + (credits.get(member.userId) ?? 0));
  db.vggMeritBatch = summary;
  const leader = members.find((member) => member.userId === room.managerUserId);
  const message: ChatMessage = {
    id: 'vgg_merit_gift_300', clientMsgId: 'vgg_merit_gift_300', roomId: room.id,
    userId: 'npc_office', nickname: 'Thông báo Office', memberTag: '#OFFICE',
    content: `🎁 Trưởng nhóm${leader ? ' ' + leader.nickname : ''} đã tặng mỗi thành viên VGG 300 công đức!`,
    createdAt: new Date().toISOString(), status: 'sent',
  };
  db.messages.push(message);
  saveDatabase(db, true);
  broadcastToRoom(room.id, { type: 'chat_message', message });
  broadcastToRoom(room.id, { type: 'altar_updated' });
  broadcastToRoom(room.id, { type: 'shop_updated' });
  return { ...summary, applied: true };
}

function trackDonationCaseMerit(roomId: string, ledger: RoomEconomyLedger) {
  const before = new Map<string, number>();
  return {
    getUserLedger: (userId: string) => {
      const entry = ensureUserLedger(ledger, userId);
      if (!before.has(userId)) {
        entry.meritCount = db.altars?.[roomId]?.members[userId]?.merit ?? 0;
        before.set(userId, entry.meritCount);
      }
      return entry;
    },
    apply: () => {
      const updated: string[] = [];
      for (const [userId, oldMerit] of before) {
        const delta = ledger.users[userId].meritCount - oldMerit;
        if (delta) {
          changeRoomAltarMerit(roomId, userId, delta);
          updated.push(userId);
        }
      }
      return updated;
    },
  };
}

function roomShopView(room: RoomInfo, userId: string): RoomShopView {
  const { shops, stored, ledger } = getRoomShop(room, userId);
  const members = db.roomMembers.filter((member) => member.roomId === room.id);
  const appearances = Object.fromEntries(members.flatMap((member) =>
    shops[member.userId] ? [[member.userId, equippedItems(shops[member.userId].state)]] : []));
  const decorations = members.flatMap((member) => {
    const seat = db.seats.find((entry) => entry.roomId === room.id && entry.occupiedByUserId === member.userId);
    return (shops[member.userId]?.state.decorations ?? []).filter((placed) => !placed.seatId || placed.seatId === seat?.seatId);
  });
  const box = serverDonationBox(room);
  return { shop: stored.state, balanceVnd: ledger.balanceVnd, donationTotalVnd: box.totalVnd,
    sleeping: Object.fromEntries(members.flatMap((member) => {
      const state = shops[member.userId]?.state;
      const bed = state?.decorations.find((placed) => placed.id === state.sleepingBedId);
      return bed ? [[member.userId, bed.position]] : [];
    })),
    donationBox: box, altarMerit: db.altars?.[room.id]?.members[userId]?.merit ?? 0, appearances, decorations };
}

function settleRoomAltar(roomId: string, altar: RoomAltarState, now: number) {
  return settleAltar(altar, now, (userId, item) => {
    const inventory = db.shops?.[roomId]?.[userId]?.state.inventory;
    if (inventory?.[item]) inventory[item] = inventory[item]! - 1;
  });
}

const currentOfficeActions = new Map<string, OfficeActionEvent>();

const boxingAway = new Map<string, number>();
const boxingPresence = new Map<string, Parameters<typeof updateFighter>[0]>();

function publishBoxing(roomId: string, state: BoxingState, now: number) {
  const view = boxingView(state, boxingPresence.get(roomId) ?? {}, 0, now);
  broadcastToRoom(roomId, { type: 'boxing_updated', ...view });
}

export function removeBoxingPresence(roomId: string, userId: string): void {
  boxingAway.delete(roomId + ':' + userId);
  const fighters = boxingPresence.get(roomId);
  if (!fighters?.[userId]) return;
  delete fighters[userId];
  const state = db.boxing?.[roomId];
  if (state) publishBoxing(roomId, state, Date.now());
}

function postDonationCaseChat(roomId: string, content: string): void {
  const id = `npc_${crypto.randomBytes(6).toString('hex')}`;
  const message: ChatMessage = {
    id,
    roomId,
    userId: 'npc_police',
    nickname: '🚓 Cảnh sát Văn phòng (NPC)',
    memberTag: '#NPC0',
    clientMsgId: id,
    content,
    createdAt: new Date().toISOString(),
    status: 'sent',
  };
  db.messages.push(message);
  if (db.messages.length > 500) db.messages = db.messages.slice(-500);
  broadcastToRoom(roomId, { type: 'chat_message', message });
}

function advanceRoomDonationCase(room: RoomInfo, now: number): void {
  const cases = db.roomDonationCases;
  const current = cases?.[room.code];
  if (!cases || !current) return;
  const due = nextDonationCaseUpdateAt(current);
  if (due === undefined || now < due) return;

  const next = nextDonationCase(current, now);
  cases[room.code] = next;
  const ledgers = db.roomEconomyLedgers ??= {};
  const ledger = ledgers[room.code] ??= { users: {}, abbotStealCount: 0 };
  const box = serverDonationBox(room);
  const trackedMerit = trackDonationCaseMerit(room.id, ledger);
  const changed = advanceDonationCaseByTime(next, now, {
    onPostNpcChat: (content) => postDonationCaseChat(room.id, content),
    onAdjustDonationBox: (deltaVnd) => {
      box.totalVnd = Math.max(0, box.totalVnd + deltaVnd);
      box.updatedAt = now;
    },
    getUserLedger: trackedMerit.getUserLedger,
  });
  if (!changed && next === current) return;
  const updatedMerit = trackedMerit.apply();
  saveDatabase(db, true);
  broadcastToRoom(room.id, { type: 'donation_case_sync', caseId: next.id });
  if (updatedMerit.length) {
    broadcastToRoom(room.id, { type: 'altar_updated' }, (client) => updatedMerit.includes(client.userId));
  }
}

export async function settleOfficeAlarms(): Promise<void> {
  const now = Date.now();
  let next: number | undefined;
  for (const [roomId, altar] of Object.entries(db.altars ?? {})) {
    if (settleRoomAltar(roomId, altar, now)) {
      saveDatabase(db, true);
      broadcastToRoom(roomId, { type: 'altar_updated' });
    }
    if (altar.incenseUntil && altar.incenseUntil <= now) {
      altar.incenseUntil = 0;
      saveDatabase(db, true);
      broadcastToRoom(roomId, { type: 'altar_updated' });
    }
    const times = altar.rituals.map((ritual) => ritual.finishAt);
    if (altar.incenseUntil > now) times.push(altar.incenseUntil);
    for (const time of times) next = next === undefined ? time : Math.min(next, time);
  }
  for (const [roomId, state] of Object.entries(db.boxing ?? {})) {
    if (recoverFish(state, now)) {
      saveDatabase(db, true);
      publishBoxing(roomId, state, now);
    }
    if (state.recoverAt) next = Math.min(next ?? Infinity, state.recoverAt);
  }
  for (const roomCode of Object.keys(db.roomDonationCases ?? {})) {
    const room = db.rooms[roomCode];
    if (!room) continue;
    advanceRoomDonationCase(room, now);
    const current = db.roomDonationCases?.[roomCode];
    const time = current && nextDonationCaseUpdateAt(current);
    if (time !== undefined) next = Math.min(next ?? Infinity, time);
  }
  await officeStorage?.schedule(next);
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
    if (!officeStorage && !fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!officeStorage && fs.existsSync(DB_FILE)) {
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
let db: DatabaseSchema;

function saveDatabase(state: DatabaseSchema = db, immediate = false): void {
  if (officeStorage) {
    officeStorage.save(JSON.stringify(state));
    return;
  }
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
const zenPresence = new Set<string>();

function hashAccountPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}

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
  if (officeStorage) return officeStorage.isOnline(roomId, userId);
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
      presence: m.presence,
      inZenRoom: officeStorage?.zenStatus(room.id, m.userId) ?? zenPresence.has(`${room.id}:${m.userId}`),
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
  predicate?: (client: OfficeRealtimeMember) => boolean
): void {
  if (officeStorage) {
    officeStorage.broadcast(roomId, event, predicate);
    return;
  }
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
  zenPresence.clear();
  saveDatabase(freshDb, true);
  return freshDb;
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  db ??= loadDatabase();
  const rawUrl = req.url || '/';
  if (!rawUrl.startsWith('/api/')) {
    return false;
  }
  if (!officeStorage) ensureServerCaseTicker();

  const urlObj = new URL(rawUrl, 'http://localhost');
  const pathname = urlObj.pathname;
  const method = req.method || 'GET';

  if (db.dbVersion !== CURRENT_DB_VERSION) {
    resetDatabaseToInitial();
  }

  try {
    // 1. Health / Reset for starting a fresh game
    if (pathname === '/api/reminders/push-key' && method === 'GET') {
      sendJson(res, 200, { publicKey: pushPublicKey });
      return true;
    }
    if (pathname === '/api/health' && method === 'GET') {
      sendJson(res, 200, { ok: true, mode: 'local_server', shopItems: Object.keys(OFFICE_SHOP) });
      return true;
    }

    if (pathname === '/api/reset' && method === 'POST') {
      resetDatabaseToInitial();
      sendJson(res, 200, { ok: true, message: 'Đã xóa toàn bộ tài khoản cũ để bắt đầu game mới.' });
      return true;
    }

    if (pathname === '/api/auth/password' && method === 'POST') {
      const account = getAuthenticatedAccount(req);
      if (!account) {
        sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập lại.' });
        return true;
      }
      const body = await readJsonBody(req);
      const password = typeof body.password === 'string' ? body.password.trim() : '';
      if (!password || password.length > 64) {
        sendJson(res, 400, { error: 'INVALID_PASSWORD', message: 'Mật khẩu phải có từ 1 đến 64 ký tự.' });
        return true;
      }
      account.passwordHash = hashAccountPassword(password);
      saveDatabase(db, true);
      sendJson(res, 200, { ok: true, hasPassword: true });
      return true;
    }

    // 2. Create or restore anonymous session & join room
    // POST /api/auth/join
    if (pathname === '/api/auth/join' && method === 'POST') {
      const body = await readJsonBody(req);
      const rawNickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
      const password = typeof body.password === 'string' ? body.password.trim() : '';
      if (password.length > 64) {
        sendJson(res, 400, { error: 'INVALID_PASSWORD', message: 'Mật khẩu phải có từ 1 đến 64 ký tự.' });
        return true;
      }
      const rawGender = body.avatarGender === 'female' ? 'female' : 'male';
      const rawRoomCode = typeof body.roomCode === 'string' ? body.roomCode.trim().toUpperCase() : DEFAULT_ROOM_CODE;
      const createIfMissing = Boolean(body.createIfMissing);

      let existingAccount = getAuthenticatedAccount(req, urlObj);

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

      const normalizeNickname = (name: string) => name.normalize('NFC').trim().toLowerCase();
      const nickname = normalizeNickname(rawNickname);
      const matchingMembers = nickname ? db.roomMembers.filter((member) =>
        member.roomId === room.id && normalizeNickname(member.nickname) === nickname
      ) : [];
      if (matchingMembers.length && !matchingMembers.some((member) => member.userId === existingAccount?.userId)) {
        const matches = new Set(matchingMembers.map((member) => member.userId));
        const protectedAccount = !existingAccount && password && Object.values(db.accounts).find((account) =>
          matches.has(account.userId) && account.passwordHash &&
          crypto.timingSafeEqual(
            Buffer.from(account.passwordHash),
            Buffer.from(hashAccountPassword(password, account.passwordHash.split(':', 1)[0])),
          )
        );
        if (!protectedAccount) {
          sendJson(res, 409, { error: 'DUPLICATE_NICKNAME', message: 'Biệt danh đã được dùng. Kiểm tra lại mật khẩu hoặc chọn tên khác.' });
          return true;
        }
        existingAccount = protectedAccount;
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
          passwordHash: password ? hashAccountPassword(password) : undefined,
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
          hasPassword: Boolean(account.passwordHash),
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

    if (subPath === 'zen' && method === 'POST') {
      const body = await readJsonBody(req);
      const key = `${room.id}:${account.userId}`;
      if (body.active === true) {
        const inZen = (userId: string) => officeStorage?.zenStatus(room.id, userId) ?? zenPresence.has(`${room.id}:${userId}`);
        const count = db.roomMembers.filter((member) => member.roomId === room.id && inZen(member.userId)).length;
        if (!inZen(account.userId) && count >= 10) {
          sendJson(res, 409, { error: 'ZEN_ROOM_FULL', message: 'Phòng Tịnh Tâm đã đủ 10 người.' });
          return true;
        }
        zenPresence.add(key);
        removeBoxingPresence(room.id, account.userId);
        officeStorage?.zenStatus(room.id, account.userId, true);
      } else {
        zenPresence.delete(key);
        officeStorage?.zenStatus(room.id, account.userId, false);
      }
      const roomState = buildRoomStatePayload(room);
      broadcastToRoom(room.id, { type: 'room_state', ...roomState });
      sendJson(res, 200, roomState);
      return true;
    }

    if (subPath === 'pet-event' && method === 'POST') {
      const body = await readJsonBody(req);
      const activity = body.activity as PetEvent;
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
      const other = db.roomMembers.find((member) => member.roomId === room.id && member.userId === body.otherUserId && member.userId !== account.userId);
      const otherName = typeof body.otherName === 'string' ? body.otherName.trim().slice(0, 40) : '';
      if (!name || typeof activity !== 'string' || !Object.hasOwn(PET_EVENTS, activity) ||
          (activity === 'fighting' && (!other || !otherName))) {
        sendJson(res, 400, { message: 'Hoạt động thú cưng không hợp lệ.' });
        return true;
      }
      const key = room.id + ':' + account.userId;
      const now = Date.now();
      for (const [id, time] of petEventTimes) if (now - time > 60_000) petEventTimes.delete(id);
      if (now - (petEventTimes.get(key) ?? 0) < 20_000) {
        sendJson(res, 429, { message: 'Thú cưng đang hoạt động.' });
        return true;
      }
      petEventTimes.set(key, now);
      const pet = name + ' của ' + memberRecord.nickname;
      const message = activity === 'fighting' && other
        ? pet + ' và ' + otherName + ' của ' + other.nickname + ' đang đánh nhau, mau mau cản!'
        : pet + ' ' + PET_EVENTS[activity] + (activity === 'bathroom' ? ', mau mau dọn!' : '!');
      const profiles = [
        { member: memberRecord, name, breedId: body.breedId },
        ...(activity === 'fighting' && other ? [{ member: other, name: otherName, breedId: body.otherBreedId }] : []),
      ].flatMap((entry) => {
        const breed = ALL_PET_BREEDS.find((candidate) => candidate.id === entry.breedId);
        return breed ? [{
          ownerUserId: entry.member.userId, ownerNickname: entry.member.nickname, catName: entry.name, breedId: breed.id,
          species: breed.species ?? 'cat', activity, fullness: 80, happiness: 80, petCount: 0, placedYardItems: [], updatedAt: now,
        }] : [];
      });
      const event = { type: 'pet_activity', activity, userId: account.userId,
        otherUserId: activity === 'fighting' ? other?.userId : undefined, message, profiles };
      broadcastToRoom(room.id, event);
      sendJson(res, 200, event);
      return true;
    }

    if (subPath === 'presence' && method === 'POST') {
      const body = await readJsonBody(req);
      if (typeof body.doNotDisturb !== 'boolean' || (body.mood !== null && !isOfficeMood(body.mood))) {
        sendJson(res, 400, { message: 'Trạng thái không hợp lệ.' });
        return true;
      }
      memberRecord.presence = { doNotDisturb: body.doNotDisturb, mood: body.mood };
      saveDatabase(db, true);
      const snapshot = buildRoomStatePayload(room);
      broadcastToRoom(room.id, { type: 'room_state', ...snapshot });
      sendJson(res, 200, snapshot);
      return true;
    }

    if (subPath === 'private-chat' && (method === 'GET' || method === 'POST')) {
      const groups = (db.privateChats ??= {})[room.id] ??= {};
      const memberId = account.userId;
      if (method === 'GET') {
        const code = urlObj.searchParams.get('group')?.toUpperCase();
        if (!code) {
          sendJson(res, 200, { groups: Object.values(groups).filter((group) => group.members.includes(memberId)).map(publicChat),
            invites: Object.values(groups).flatMap((group) => group.invites?.[memberId] && !group.members.includes(memberId) ? [group.invites[memberId]] : []) });
          return true;
        }
        const group = Object.hasOwn(groups, code) ? groups[code] : undefined;
        if (!group?.members.includes(memberId)) sendJson(res, 404, { message: 'Bạn chưa tham gia nhóm này.' });
        else sendJson(res, 200, { group: publicChat(group), messages: group.messages });
        return true;
      }

      const body = await readJsonBody(req);
      const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
      const group = /^[A-F0-9]{12}$/.test(code) ? groups[code] : undefined;
      const password = typeof body.password === 'string' ? body.password : '';
      if (body.action === 'create') {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name || name.length > 50 || password.length < 4 || password.length > 64 || !password.trim()) {
          sendJson(res, 400, { message: 'Nhập tên nhóm tối đa 50 ký tự và mật khẩu từ 4 đến 64 ký tự.' });
          return true;
        }
        let next = crypto.randomBytes(6).toString('hex').toUpperCase();
        while (Object.hasOwn(groups, next)) next = crypto.randomBytes(6).toString('hex').toUpperCase();
        const created: StoredPrivateChat = { code: next, name, passwordHash: hashAccountPassword(password), members: [memberId], messages: [] };
        groups[next] = created;
        saveDatabase(db, true);
        sendJson(res, 200, { group: publicChat(created), messages: [] });
        return true;
      }
      if (body.action === 'invite') {
        const invitee = db.roomMembers.find((member) => member.roomId === room.id && member.userId === body.userId);
        if (!group?.members.includes(memberId) || !invitee || group.members.includes(invitee.userId)) {
          sendJson(res, 400, { message: 'Không thể mời thành viên này.' });
          return true;
        }
        (group.invites ??= {})[invitee.userId] = { code: group.code, name: group.name, from: memberRecord.nickname };
        saveDatabase(db, true);
        broadcastToRoom(room.id, { type: 'private_chat_updated', code: group.code }, (client) => client.userId === invitee.userId);
        sendJson(res, 200, { group: publicChat(group), messages: group.messages });
        return true;
      }
      if (body.action === 'join') {
        if (group?.members.includes(memberId)) {
          sendJson(res, 200, { group: publicChat(group), messages: group.messages });
          return true;
        }
        const now = Date.now();
        const attemptKey = room.id + ':' + memberId;
        for (const [key, attempts] of privateChatAttempts) if (attempts.expiresAt <= now) privateChatAttempts.delete(key);
        const attempts = privateChatAttempts.get(attemptKey) ?? { count: 0, expiresAt: now + 60_000 };
        if (attempts.count >= 5) {
          sendJson(res, 429, { message: 'Bạn đã thử quá nhiều lần. Hãy thử lại sau một phút.' });
          return true;
        }
        attempts.count++;
        privateChatAttempts.set(attemptKey, attempts);
        if (!group || password.length < 4 || password.length > 64 ||
            !crypto.timingSafeEqual(Buffer.from(group.passwordHash), Buffer.from(hashAccountPassword(password, group.passwordHash.split(':', 1)[0])))) {
          sendJson(res, 403, { message: 'Mã nhóm hoặc mật khẩu không đúng.' });
          return true;
        }
        group.members.push(memberId);
        if (group.invites) delete group.invites[memberId];
        privateChatAttempts.delete(attemptKey);
        saveDatabase(db, true);
        broadcastToRoom(room.id, { type: 'private_chat_updated', code: group.code }, (client) => group.members.includes(client.userId));
        sendJson(res, 200, { group: publicChat(group), messages: group.messages });
        return true;
      }
      if (body.action === 'send') {
        if (!group?.members.includes(memberId)) {
          sendJson(res, 404, { message: 'Bạn chưa tham gia nhóm này.' });
          return true;
        }
        const content = typeof body.content === 'string' ? body.content.trim() : '';
        const id = typeof body.id === 'string' && /^[a-f0-9-]{36}$/i.test(body.id) ? body.id : undefined;
        if (!id || !content || content.length > 1000) {
          sendJson(res, 400, { message: 'Tin nhắn cần có từ 1 đến 1.000 ký tự.' });
          return true;
        }
        if (!group.messages.some((message) => message.id === id && message.userId === memberId)) {
          group.messages = [...group.messages.slice(-299), {
            id, content, userId: memberId, nickname: memberRecord.nickname, createdAt: new Date().toISOString(),
          }];
          saveDatabase(db, true);
          broadcastToRoom(room.id, { type: 'private_chat_updated', code: group.code }, (client) => group.members.includes(client.userId));
        }
        sendJson(res, 200, { group: publicChat(group), messages: group.messages });
        return true;
      }
      sendJson(res, 400, { message: 'Thao tác nhóm chat không hợp lệ.' });
      return true;
    }

    if (subPath === 'actions' && method === 'POST') {
      const body = await readJsonBody(req);
      const item = body.action;
      if (!isOfficeAction(item) || !getRoomShop(room, account.userId).stored.state.inventory[item]) {
        sendJson(res, 403, { message: 'Bạn chưa sở hữu hiệu ứng này.' });
        return true;
      }
      const now = Date.now();
      const key = room.id + ':' + account.userId;
      for (const [id, active] of currentOfficeActions) {
        if (now - active.startedAt >= 3000) currentOfficeActions.delete(id);
      }
      const previous = currentOfficeActions.get(key);
      if (previous && now - previous.startedAt < 220) {
        sendJson(res, 429, { message: 'Vui lòng chờ một chút trước khi dùng hiệu ứng tiếp.' });
        return true;
      }
      const event: OfficeActionEvent = { type: 'office_action', eventId: crypto.randomUUID(), userId: account.userId,
        action: item, startedAt: now };
      currentOfficeActions.set(key, event);
      broadcastToRoom(room.id, { ...event });
      sendJson(res, 200, event);
      return true;
    }

    if (subPath === 'shop' && (method === 'GET' || method === 'POST')) {
      const body = method === 'POST' ? await readJsonBody(req) : null;
      const initial = !db.shops?.[room.id]?.[account.userId]?.bedGranted;
      const { stored, ledger } = getRoomShop(room, account.userId);
      const attendance: Record<string, AttendanceStatus> = {};
      const prefix = `${room.id}:${account.userId}:`;
      for (const [key, value] of Object.entries(db.attendance)) {
        if (key.startsWith(prefix)) attendance[key.slice(prefix.length)] = value.status;
      }
      const salary = settlePastMonthsSalary({ ...createDefaultWalletState(), settledMonths: stored.settledMonths },
        attendance, getNowInHoChiMinh().dateStr.slice(0, 7));
      stored.settledMonths = salary.wallet.settledMonths;
      ledger.balanceVnd += salary.addedVnd;
      const seat = db.seats.find((entry) => entry.roomId === room.id && entry.occupiedByUserId === account.userId);
      const box = serverDonationBox(room);
      let altarBalanceChanged = false;
      const error = body ? runShopCommand(stored, ledger, body, seat?.seatId, box, (id, amountVnd, meritAwarded) => {
        altarBalanceChanged = true;
        changeRoomAltarMerit(room.id, account.userId, meritAwarded);
        box.donations = [{ id, amountVnd, meritAwarded, donorUserId: account.userId,
          donorNickname: memberRecord.nickname, createdAt: Date.now(), kind: 'donate' as const }, ...box.donations].slice(0, 50);
      }, {
        debitMerit: (amount) => {
          const merit = db.altars?.[room.id]?.members[account.userId]?.merit ?? 0;
          if (merit < amount) return false;
          changeRoomAltarMerit(room.id, account.userId, -amount);
          altarBalanceChanged = true;
          return true;
        },
        roomDecorations: () => roomShopView(room, account.userId).decorations,
      }) : undefined;
      if (initial || (body && !error) || salary.addedVnd) saveDatabase(db, true);
      if (body && !error) broadcastToRoom(room.id, { type: 'shop_updated' });
      if (altarBalanceChanged) broadcastToRoom(room.id, { type: 'altar_updated' }, (client) => client.userId === account.userId);
      sendJson(res, error ? 409 : 200, error ? { message: error } : roomShopView(room, account.userId));
      return true;
    }

    if (subPath === 'boxing' && (method === 'GET' || method === 'POST')) {
      const body = method === 'POST' ? await readJsonBody(req) : null;
      const now = Date.now();
      const state = (db.boxing ??= {})[room.id] ??= createBoxingState();
      let fighters = boxingPresence.get(room.id);
      if (!fighters) boxingPresence.set(room.id, fighters = {});
      activeFighters(fighters, now);
      for (const id of Object.keys(fighters)) {
        if (!db.roomMembers.some((member) => member.roomId === room.id && member.userId === id)) delete fighters[id];
      }
      const recovered = recoverFish(state, now);
      const altar = (db.altars ??= {})[room.id] ??= createAltarState();
      const getMerit = () => altar.members[account.userId]?.merit ?? 0;
      if (recovered) { saveDatabase(db, true); publishBoxing(room.id, state, now); }
      if (body?.action === 'move') {
        const inZen = officeStorage?.zenStatus(room.id, account.userId) ?? zenPresence.has(`${room.id}:${account.userId}`);
        const zone = inZen ? 'away' : body.zone;
        if (!updateFighter(fighters, account.userId, zone, body.x, body.z, now)) {
          sendJson(res, 409, { message: 'Vị trí Boxing chưa hợp lệ.' });
          return true;
        }
        const key = room.id + ':' + account.userId;
        if (zone === 'away') boxingAway.set(key, now);
        else boxingAway.delete(key);
        publishBoxing(room.id, state, now);
      } else if (body?.action === 'punch' && typeof body.id === 'string' && /^[\da-f-]{36}$/i.test(body.id)) {
        const currentlyInZen = officeStorage?.zenStatus(room.id, account.userId) ?? zenPresence.has(`${room.id}:${account.userId}`);
        if (currentlyInZen) delete fighters[account.userId];
        const candidates = { ...fighters };
        if (fighters[account.userId]?.zone === 'office') {
          const current = buildRoomStatePayload(room).members;
          const standing = current.filter((member) => !member.seatId && !member.meetingChairId && !member.inZenRoom)
            .sort((a, b) => a.userId.localeCompare(b.userId));
          for (const member of current) {
            if (candidates[member.userId] || member.inZenRoom ||
                (member.online && boxingAway.has(room.id + ':' + member.userId))) continue;
            const seat = WORK_SEAT_LAYOUTS.find((layout) => layout.seatId === member.seatId)?.chairPosition;
            const meeting = MEETING_CHAIRS.find((chair) => chair.id === member.meetingChairId)?.position;
            const index = Math.max(0, standing.findIndex((entry) => entry.userId === member.userId));
            const slot = DOOR_STANDING_SLOTS[index % DOOR_STANDING_SLOTS.length].position;
            const row = Math.floor(index / DOOR_STANDING_SLOTS.length);
            const [x, , z] = seat ?? meeting ?? [slot[0] - row * 0.55, 0, slot[2] + row * 0.45];
            candidates[member.userId] = { zone: 'office', x, z, at: now };
          }
        }
        const hit = punch(state, candidates, account.userId, body.id, now, () => {
          if (getMerit() < BOXING.officeMeritCost) return false;
          altar.members[account.userId].merit -= BOXING.officeMeritCost;
          return true;
        });
        if (hit) {
          saveDatabase(db, true);
          publishBoxing(room.id, state, now);
          if (state.recoverAt) {
            if (officeStorage) await settleOfficeAlarms();
            else setTimeout(() => {
              if (recoverFish(state, Date.now())) {
                saveDatabase(db, true);
                publishBoxing(room.id, state, Date.now());
              }
            }, BOXING.recoveryMs + 10).unref();
          }
        }
      } else if (body) {
        sendJson(res, 400, { message: 'Thao tác Boxing không hợp lệ.' });
        return true;
      }
      sendJson(res, 200, boxingView(state, fighters, getMerit(), Date.now()));
      return true;
    }

    if (subPath === 'altar' && (method === 'GET' || method === 'POST')) {
      const body = method === 'POST' ? await readJsonBody(req) : null;
      const now = Date.now();
      const altars = db.altars ??= {};
      const altar = altars[room.id] ??= createAltarState();
      const appointedAbbot = process.env.OFFICE_ABBOT_USER_ID;
      const abbot = appointedAbbot || db.roomMembers.find((member) =>
        member.roomId === room.id && member.nickname.normalize('NFC').trim().toLowerCase() === 'trụ trì thanh ngọc'
      )?.userId;
      if (appointedAbbot) altar.abbotUserId = appointedAbbot;
      else if (abbot) altar.abbotUserId ??= abbot;
      const settled = settleRoomAltar(room.id, altar, now);
      let item: ShopConsumable | undefined;
      let error: string | undefined;
      if (body?.action === 'start') {
        const repeated = altar.rituals.some((ritual) => ritual.id === body.id && ritual.userId === account.userId) ||
          altar.members[account.userId]?.results.some((result) => result.id === body.id);
        item = body.kind === 'incense' && (body.item === undefined || body.item === 'incense') ? 'incense' :
          body.kind === 'offering' && body.item === undefined ? 'offering' :
          body.kind === 'offering' ? SHOP_OFFERINGS.find((offering) => offering === body.item) : undefined;
        if (!repeated && (!item || !(getRoomShop(room, account.userId).stored.state.inventory[item] ?? 0))) {
          error = 'Bạn không có vật phẩm này trong túi.';
        }
      }
      if (body && !error) error = updateAltar(altar, memberRecord, body, now, item);
      if (settled || (body && !error)) saveDatabase(db, true);
      const started = body?.action === 'start' && !error
        ? altar.rituals.find((ritual) => ritual.id === body.id && ritual.userId === account.userId) : undefined;
      if (officeStorage) {
        if (settled || started || (body?.action === 'clear' && !error)) {
          broadcastToRoom(room.id, { type: 'altar_updated' });
          await settleOfficeAlarms();
        } else if (body?.action === 'merit' && !error) {
          broadcastToRoom(room.id, { type: 'altar_updated' }, (client) => client.userId === account.userId);
        }
      } else if (started) {
        setTimeout(() => {
          if (db.altars?.[room.id] === altar && settleRoomAltar(room.id, altar, Date.now())) saveDatabase(db, true);
        }, Math.max(1, started.finishAt - Date.now() + 10)).unref();
      }
      sendJson(res, error ? 409 : 200, { ...altarView(altar, account.userId, now), error });
      return true;
    }

    if (subPath === 'reminders/device' && method === 'POST') {
      if (!pushPublicKey) {
        sendJson(res, 503, { message: 'Máy chủ chưa bật thông báo nền.' });
        return true;
      }
      const body = await readJsonBody(req);
      const device = parseReminderDevice(body, account.userId, room.id);
      if (!device) {
        sendJson(res, 400, { message: 'Thiết bị thông báo không hợp lệ.' });
        return true;
      }
      const id = crypto.createHash('sha256').update(device.subscription.endpoint).digest('hex');
      const devices = db.reminderDevices ??= {};
      const previous = devices[id];
      if (previous?.userId === device.userId && previous.roomId === device.roomId) {
        device.lastSent = previous.lastSent;
        device.workDate ||= previous.workDate;
        device.bowDate ||= previous.bowDate;
      }
      devices[id] = device;
      saveDatabase(db, true);
      sendJson(res, 200, { ok: true });
      return true;
    }

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

      res.once('close', () => {
        clearInterval(heartbeat);
        sseClients.delete(clientId);
        if (!isUserOnlineInRoom(room.id, account.userId)) {
          zenPresence.delete(`${room.id}:${account.userId}`);
        }
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
        for (const device of Object.values(db.reminderDevices ?? {})) {
          if (device.userId === account.userId && device.roomId === room.id) {
            device.workDate = getNowInHoChiMinh().dateStr;
          }
        }
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
      const todayStr = getNowInHoChiMinh().dateStr;
      if (date > todayStr) {
        sendJson(res, 400, {
          error: 'FUTURE_DATE_NOT_ALLOWED',
          message: 'Không được chấm công cho ngày trong tương lai!',
        });
        return true;
      }
      if (date < todayStr) {
        sendJson(res, 400, {
          error: 'PAST_DATE_LOCKED',
          message: 'Chỉ được chấm công đúng ngày đi làm hôm nay!',
        });
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

    // 9B. Vụ án Hòm Công Đức (Server-authoritative)
    if (subPath.startsWith('donation-case')) {
      const voteBody = subPath === 'donation-case/vote' && method === 'POST'
        ? await readJsonBody(req)
        : null;
      if (!db.roomDonationBoxes) db.roomDonationBoxes = {};
      if (!db.roomDonationCases) db.roomDonationCases = {};
      if (!db.roomEconomyLedgers) db.roomEconomyLedgers = {};
      if (!db.roomEconomyLedgers[room.code]) {
        db.roomEconomyLedgers[room.code] = { users: {}, abbotStealCount: 0 };
      }

      const ledger = db.roomEconomyLedgers[room.code];
      const box = serverDonationBox(room);
      const roomMembersList = db.roomMembers
        .filter((m) => m.roomId === room.id)
        .map((m) => ({
          userId: m.userId,
          nickname: m.nickname,
          memberTag: m.memberTag,
          avatarGender: m.avatarGender,
        }));

      const postNpcChat = (content: string) => postDonationCaseChat(room.id, content);
      advanceRoomDonationCase(room, Date.now());

      const { ledger: myLedger } = getRoomShop(room, account.userId);
      const activeCase = db.roomDonationCases[room.code] || null;

      if (subPath === 'donation-case' && method === 'GET') {
        sendJson(res, 200, {
          caseView: toPublicDonationCaseView(
            activeCase,
            account.userId,
            memberRecord.nickname,
            roomMembersList
          ),
          myLedger,
        });
        return true;
      }

      if (subPath === 'donation-case/tick' && method === 'POST') {
        sendJson(res, 200, {
          caseView: toPublicDonationCaseView(
            activeCase,
            account.userId,
            memberRecord.nickname,
            roomMembersList
          ),
          myLedger,
        });
        return true;
      }

      if (subPath === 'donation-case/steal' && method === 'POST') {
        if (box.totalVnd <= 0) {
          sendJson(res, 400, {
            error: { code: 'EMPTY_DONATION_BOX', message: 'Hòm công đức đang trống!' },
          });
          return true;
        }

        const stolenAmountVnd = calculateStealAmountVnd(box.totalVnd);
        box.totalVnd = Math.max(0, box.totalVnd - stolenAmountVnd);
        box.updatedAt = Date.now();

        const thiefEntry = ensureUserLedger(ledger, account.userId);
        if (thiefEntry.pendingDebtVnd > 0) {
          const paid = Math.min(thiefEntry.pendingDebtVnd, stolenAmountVnd);
          thiefEntry.pendingDebtVnd -= paid;
          thiefEntry.balanceVnd += stolenAmountVnd - paid;
        } else {
          thiefEntry.balanceVnd += stolenAmountVnd;
        }

        const abbotMember = roomMembersList.find((m) => isAbbotNickname(m.nickname));
        ledger.abbotStealCount = (ledger.abbotStealCount || 0) + 1;
        const abbotPenalty = calculateAbbotTheftMeritPenalty(ledger.abbotStealCount);
        if (abbotMember) {
          const abbotEntry = ensureUserLedger(ledger, abbotMember.userId);
          abbotEntry.meritCount = Math.max(0, abbotEntry.meritCount - abbotPenalty);
          changeRoomAltarMerit(room.id, abbotMember.userId, -abbotPenalty);
        }

        const newCase: DonationCaseServerRecord = {
          id: `case_${crypto.randomBytes(6).toString('hex')}`,
          roomId: room.id,
          roomCode: room.code,
          status: 'stolen_unreported',
          stolenAmountVnd,
          stolenAt: Date.now(),
          thiefSnapshot: {
            userId: account.userId,
            nickname: memberRecord.nickname,
            memberTag: memberRecord.memberTag,
            avatarGender: memberRecord.avatarGender,
          },
          abbotUserId: abbotMember?.userId || null,
          abbotMeritLostOnTheft: abbotPenalty,
          stealSequenceNumber: ledger.abbotStealCount,
          policeReportedAt: null,
          currentPhase: 0,
          publishedClues: [],
          votesByRound: {},
          scopeUserIds: [],
          settlementDone: false,
          settlementSummary: null,
          resolvedAt: null,
        };
        const currentCase = queueDonationCase(activeCase, newCase);
        db.roomDonationCases[room.code] = currentCase;

        postNpcChat(
          `🚨 [VỤ ÁN CÔNG ĐỨC] Hòm công đức đã bị trộm, mau mau bắt tên trộm! Đã mất ${stolenAmountVnd.toLocaleString('vi-VN')} xu Office.`
        );
        saveDatabase(db, true);
        if (officeStorage) await settleOfficeAlarms();
        broadcastToRoom(room.id, { type: 'donation_theft_alert' });
        broadcastToRoom(room.id, { type: 'donation_case_sync', caseId: currentCase.id });
        broadcastToRoom(room.id, { type: 'shop_updated' });
        if (abbotMember) broadcastToRoom(room.id, { type: 'altar_updated' }, (client) => client.userId === abbotMember.userId);
        sendJson(res, 200, {
          caseView: toPublicDonationCaseView(
            currentCase,
            account.userId,
            memberRecord.nickname,
            roomMembersList
          ),
          myLedger: thiefEntry,
          stolenAmountVnd,
        });
        return true;
      }

      if (subPath === 'donation-case/report' && method === 'POST') {
        if (!isAbbotNickname(memberRecord.nickname)) {
          sendJson(res, 403, {
            error: {
              code: 'FORBIDDEN_ABBOT_ONLY',
              message: 'Chỉ Chủ trì (Trụ trì Thanh Ngọc) mới có quyền báo cảnh sát!',
            },
          });
          return true;
        }
        if (!activeCase || activeCase.status !== 'stolen_unreported') {
          sendJson(res, 409, {
            error: { code: 'NO_UNREPORTED_CASE', message: 'Không có vụ trộm mới nào đang chờ báo cảnh sát.' },
          });
          return true;
        }
        const nowMs = Date.now();
        const onlineIds = db.roomMembers
          .filter((m) => m.roomId === room.id && nowMs - Date.parse(m.lastSeenAt) < 120_000)
          .map((m) => m.userId);
        if (!onlineIds.includes(account.userId)) onlineIds.push(account.userId);
        if (activeCase.thiefSnapshot.userId && !onlineIds.includes(activeCase.thiefSnapshot.userId)) {
          onlineIds.push(activeCase.thiefSnapshot.userId);
        }

        activeCase.status = 'investigating';
        activeCase.policeReportedAt = nowMs;
        activeCase.currentPhase = 0;
        activeCase.scopeUserIds = Array.from(new Set(onlineIds));

        postNpcChat(
          `🚔 [VỤ ÁN CÔNG ĐỨC] Cảnh sát NPC đã tiếp nhận trình báo! Manh mối 1 sẽ được công bố sau 5 phút. Mọi người hãy thảo luận tại đây và mở Bảng vụ án để theo dõi.`
        );
        saveDatabase(db, true);
        if (officeStorage) await settleOfficeAlarms();
        broadcastToRoom(room.id, { type: 'donation_case_sync', caseId: activeCase.id });
        sendJson(res, 200, {
          caseView: toPublicDonationCaseView(
            activeCase,
            account.userId,
            memberRecord.nickname,
            roomMembersList
          ),
          myLedger,
        });
        return true;
      }

      if (voteBody) {
        if (!activeCase || !isDonationCaseOpen(activeCase) || (voteBody.caseId && voteBody.caseId !== activeCase.id)) {
          sendJson(res, 409, {
            error: { code: 'CASE_NOT_OPEN', message: 'Vụ án này đã kết thúc hoặc đã chuyển sang vụ khác.' },
          });
          return true;
        }
        const now = Date.now();
        if (typeof voteBody.roundEndsAt === 'number' &&
          (activeCase.quickVote?.endsAt !== voteBody.roundEndsAt || now >= voteBody.roundEndsAt)) {
          sendJson(res, 409, {
            error: { code: 'VOTE_ALREADY_CLOSED', message: 'Lượt bình chọn này đã hết giờ. Hãy xem kết quả rồi mở lượt mới.' },
          });
          return true;
        }
        const suspectInput = typeof voteBody.suspectName === 'string' ? voteBody.suspectName : '';
        const resolved = resolveSuspectByInput(roomMembersList, suspectInput);
        if (!resolved.ok) {
          sendJson(res, resolved.code === 'AMBIGUOUS' ? 409 : 404, {
            error: { code: resolved.code, message: resolved.message },
          });
          return true;
        }

        if (submitDonationCaseVote(activeCase, account.userId, resolved.member.userId, now)) {
          postNpcChat('🗳️ [VỤ ÁN CÔNG ĐỨC] Vừa mở lượt bình chọn 5 giây. Mở Bảng vụ án để bỏ phiếu.');
        }
        saveDatabase(db, true);
        if (officeStorage) await settleOfficeAlarms();

        broadcastToRoom(room.id, { type: 'donation_case_sync', caseId: activeCase.id });
        sendJson(res, 200, {
          caseView: toPublicDonationCaseView(
            activeCase,
            account.userId,
            memberRecord.nickname,
            roomMembersList
          ),
          myLedger,
        });
        return true;
      }
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

let serverCaseTickerStarted = false;
function ensureServerCaseTicker() {
  if (serverCaseTickerStarted) return;
  serverCaseTickerStarted = true;
  setInterval(() => {
    try {
      const now = Date.now();
      for (const roomCode of Object.keys(db.roomDonationCases ?? {})) {
        const room = db.rooms[roomCode];
        if (room) advanceRoomDonationCase(room, now);
      }
    } catch {
      // ignore background tick errors
    }
  }, 1000).unref();
}

