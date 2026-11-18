import type {
  AuthSession,
  AvatarGender,
  AttendanceRecord,
  AttendanceStatus,
  ChatMessage,
  MyDiaryEntry,
  PublicDiaryEntry,
  RoomInfo,
  RoomMember,
  WorkSeat,
} from '../types/office';
import {
  broadcastCatSyncEvent,
  broadcastPuzzleSyncEvent,
  broadcastDonationBoxSyncEvent,
  broadcastAttendanceReminderEvent,
  handleStaticFallbackRequest,
  subscribeStaticRealtime,
  type StaticRealtimeEvent,
} from './staticFallbackEngine';
import type {
  PublicDonationCaseView,
  UserEconomyLedgerEntry,
} from '../utils/donationCaseEngine';

export {
  broadcastCatSyncEvent,
  broadcastPuzzleSyncEvent,
  broadcastDonationBoxSyncEvent,
  broadcastAttendanceReminderEvent,
  subscribeStaticRealtime,
  type StaticRealtimeEvent,
};

const STORAGE_PREFIX = 'van_phong_ao_session_v2';
const API_ORIGIN_STORAGE_KEY = 'van_phong_ao_api_origin';

function resolveApiOrigin(): string {
  const envOrigin = import.meta.env.VITE_API_ORIGIN?.trim().replace(/\/+$/, '') ?? '';
  if (envOrigin || typeof window === 'undefined') return envOrigin;
  try {
    const params = new URLSearchParams(window.location.search);
    const queryApi = params.get('api')?.trim().replace(/\/+$/, '');
    if (queryApi) {
      window.sessionStorage.setItem(API_ORIGIN_STORAGE_KEY, queryApi);
      return queryApi;
    }
    const savedApi = window.sessionStorage.getItem(API_ORIGIN_STORAGE_KEY)?.trim();
    if (savedApi) return savedApi;
  } catch {
    // ignore
  }
  return envOrigin;
}

const API_ORIGIN = resolveApiOrigin();

// Nếu trang đang chạy trên GitHub Pages (*.github.io) và không cấu hình API_ORIGIN riêng,
// tự động bật chế độ Static Fallback Engine ngay lập tức để không bao giờ gặp lỗi 405.
let staticFallbackActive =
  typeof window !== 'undefined' &&
  !API_ORIGIN &&
  window.location.hostname.endsWith('.github.io');

export function isUsingStaticFallback(): boolean {
  return staticFallbackActive;
}

export function officeApiUrl(path: string): string {
  return `${API_ORIGIN}${path}`;
}

/**
 * Hỗ trợ nhiều phiên độc lập trên cùng trình duyệt thông qua query ?session=A, ?session=B, ?session=C
 * hoặc mặc định lưu tại key chuẩn khi dùng bình thường.
 */
export function getSessionNamespace(): string {
  if (typeof window === 'undefined') return 'default';
  const params = new URLSearchParams(window.location.search);
  const s = params.get('session')?.trim();
  return API_ORIGIN ? `${API_ORIGIN}:${s || 'default'}` : s || 'default';
}

export function getInviteRoomFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('room')?.trim();
  return code ? code.toUpperCase() : null;
}

export function loadSavedSession(): AuthSession | null {
  try {
    const key = `${STORAGE_PREFIX}:${getSessionNamespace()}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed && parsed.userId && parsed.sessionToken && parsed.roomCode) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSessionToStorage(session: AuthSession): void {
  try {
    const key = `${STORAGE_PREFIX}:${getSessionNamespace()}`;
    window.localStorage.setItem(key, JSON.stringify(session));
  } catch (err) {
    console.warn('Could not save session to localStorage:', err);
  }
}

export function clearSavedSession(): void {
  try {
    const key = `${STORAGE_PREFIX}:${getSessionNamespace()}`;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export interface RememberedDeviceCredentials {
  roomCode: string;
  nickname: string;
  password: string;
  avatarGender: AvatarGender;
}

const CREDENTIALS_STORAGE_PREFIX = 'van_phong_ao_device_creds_v1';

export function loadRememberedCredentials(): RememberedDeviceCredentials | null {
  try {
    const key = `${CREDENTIALS_STORAGE_PREFIX}:${getSessionNamespace()}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RememberedDeviceCredentials;
    if (parsed && parsed.nickname) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveRememberedCredentials(creds: RememberedDeviceCredentials): void {
  try {
    const key = `${CREDENTIALS_STORAGE_PREFIX}:${getSessionNamespace()}`;
    window.localStorage.setItem(key, JSON.stringify(creds));
  } catch {
    // ignore
  }
}

export function clearRememberedCredentials(): void {
  try {
    const key = `${CREDENTIALS_STORAGE_PREFIX}:${getSessionNamespace()}`;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function resetAllServerAccounts(): Promise<void> {
  await apiFetch('/api/reset', { method: 'POST', body: JSON.stringify({}) });
  clearSavedSession();
}

export async function changeRoomCodeApi(
  currentRoomCode: string,
  newRoomCode: string,
  sessionToken: string
): Promise<{
  session: AuthSession;
  room: RoomInfo;
  members: RoomMember[];
  seats: WorkSeat[];
}> {
  const res = await apiFetch<{
    session: AuthSession;
    room: RoomInfo;
    members: RoomMember[];
    seats: WorkSeat[];
  }>(
    `/api/rooms/${encodeURIComponent(currentRoomCode)}/code`,
    {
      method: 'PUT',
      body: JSON.stringify({ newRoomCode }),
    },
    sessionToken
  );
  saveSessionToStorage(res.session);
  return res;
}

export async function transferRoomManager(
  roomCode: string,
  targetUserId: string,
  sessionToken: string
): Promise<{
  managerUserId: string;
  room: RoomInfo;
  members: RoomMember[];
  seats: WorkSeat[];
}> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/manager/transfer`,
    {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    },
    sessionToken
  );
}

export async function kickRoomMember(
  roomCode: string,
  targetUserId: string,
  sessionToken: string
): Promise<{
  kickedUserId: string;
  kickedNickname: string;
  room: RoomInfo;
  members: RoomMember[];
  seats: WorkSeat[];
}> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/members/kick`,
    {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    },
    sessionToken
  );
}

export async function setZenRoomPresenceApi(
  roomCode: string,
  active: boolean,
  sessionToken: string
): Promise<{
  room: RoomInfo;
  members: RoomMember[];
  seats: WorkSeat[];
}> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/zen`,
    {
      method: 'POST',
      body: JSON.stringify({ active }),
    },
    sessionToken
  );
}

export async function leaveRoomApi(
  roomCode: string,
  sessionToken: string
): Promise<{
  leftUserId: string;
  room: RoomInfo;
  members: RoomMember[];
  seats: WorkSeat[];
}> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/leave`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    sessionToken
  );
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  sessionToken?: string
): Promise<T> {
  if (staticFallbackActive) {
    return handleStaticFallbackRequest<T>(path, options, sessionToken);
  }

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (sessionToken) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  let res: Response;
  try {
    res = await fetch(officeApiUrl(path), {
      ...options,
      headers,
    });
  } catch (problem) {
    if (options.signal?.aborted) throw problem;
    if (API_ORIGIN) throw new Error('Chưa kết nối được máy chủ Office. Vui lòng thử lại.');
    // Khi không kết nối được máy chủ Node (ví dụ chạy bản tĩnh), chuyển sang Static Fallback Engine
    staticFallbackActive = true;
    return handleStaticFallbackRequest<T>(path, options, sessionToken);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : {};

  // Nếu máy chủ tĩnh (như GitHub Pages / Netlify / Vercel static) trả về 405 Method Not Allowed,
  // 404 HTML (không phải JSON từ API của chúng ta), hoặc 502/503, tự động chuyển sang Static Fallback Engine
  if (
    !API_ORIGIN &&
    !res.ok &&
    (res.status === 405 ||
      res.status === 502 ||
      res.status === 503 ||
      (res.status === 404 && !data.error))
  ) {
    staticFallbackActive = true;
    return handleStaticFallbackRequest<T>(path, options, sessionToken);
  }

  if (!res.ok) {
    const err = new Error(data.message || data.error?.message || `Lỗi máy chủ (${res.status})`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = typeof data.error === 'string' ? data.error : data.error?.code;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export interface JoinRoomResponse {
  session: AuthSession;
  mySeatId: string | null;
  room: RoomInfo;
  members: RoomMember[];
  seats: WorkSeat[];
}

export async function joinOrRestoreRoom(params: {
  roomCode: string;
  nickname: string;
  password?: string;
  avatarGender: AvatarGender;
  sessionToken?: string;
  createIfMissing?: boolean;
  rememberDevice?: boolean;
}): Promise<JoinRoomResponse> {
  const result = await apiFetch<JoinRoomResponse>(
    '/api/auth/join',
    {
      method: 'POST',
      body: JSON.stringify({
        roomCode: params.roomCode,
        nickname: params.nickname,
        password: params.password ?? '',
        avatarGender: params.avatarGender,
        createIfMissing: params.createIfMissing ?? false,
      }),
    },
    params.sessionToken
  );
  saveSessionToStorage(result.session);
  if (params.rememberDevice !== false && params.password) {
    saveRememberedCredentials({
      roomCode: result.room.code,
      nickname: result.session.nickname,
      password: params.password,
      avatarGender: result.session.avatarGender,
    });
  }
  return result;
}

export async function setAccountPasswordApi(
  roomCode: string,
  password: string,
  sessionToken: string
): Promise<{ ok: boolean; hasPassword: boolean }> {
  const res = await apiFetch<{ ok: boolean; hasPassword: boolean }>(
    '/api/auth/password',
    {
      method: 'POST',
      body: JSON.stringify({ roomCode, password }),
    },
    sessionToken
  );
  const current = loadSavedSession();
  if (current) {
    const updated: AuthSession = { ...current, hasPassword: true };
    saveSessionToStorage(updated);
    saveRememberedCredentials({
      roomCode: current.roomCode,
      nickname: current.nickname,
      password,
      avatarGender: current.avatarGender,
    });
  }
  return res;
}

export interface FullRoomStateResponse {
  room: RoomInfo;
  members: RoomMember[];
  seats: WorkSeat[];
  messages: ChatMessage[];
  attendance: AttendanceRecord[];
  diaryFeed: PublicDiaryEntry[];
  myDiary: MyDiaryEntry[];
}

export async function fetchFullRoomState(
  roomCode: string,
  sessionToken: string
): Promise<FullRoomStateResponse> {
  return apiFetch<FullRoomStateResponse>(
    `/api/rooms/${encodeURIComponent(roomCode)}/state`,
    { method: 'GET' },
    sessionToken
  );
}

export async function claimWorkSeat(
  roomCode: string,
  seatId: string,
  sessionToken: string
): Promise<{ claimedSeatId: string; room: RoomInfo; members: RoomMember[]; seats: WorkSeat[] }> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/seats/claim`,
    {
      method: 'POST',
      body: JSON.stringify({ seatId }),
    },
    sessionToken
  );
}

export async function leaveWorkSeatToStand(
  roomCode: string,
  sessionToken: string
): Promise<{ claimedSeatId: null; room: RoomInfo; members: RoomMember[]; seats: WorkSeat[] }> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/seats/stand`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    sessionToken
  );
}

export async function sitAtMeetingChair(
  roomCode: string,
  meetingChairId: string | null,
  sessionToken: string
): Promise<{ meetingChairId: string | null; room: RoomInfo; members: RoomMember[]; seats: WorkSeat[] }> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/meeting/sit`,
    {
      method: 'POST',
      body: JSON.stringify({ meetingChairId }),
    },
    sessionToken
  );
}

export async function sendChatMessage(
  roomCode: string,
  content: string,
  clientMsgId: string,
  sessionToken: string
): Promise<{ message: ChatMessage; deduplicated: boolean }> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content, clientMsgId }),
    },
    sessionToken
  );
}

export async function updateAttendanceDay(
  roomCode: string,
  date: string,
  status: AttendanceStatus,
  seq: number,
  sessionToken: string
): Promise<{ record: AttendanceRecord }> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/attendance`,
    {
      method: 'POST',
      body: JSON.stringify({ date, status, seq }),
    },
    sessionToken
  );
}

export async function fetchDiaryLists(
  roomCode: string,
  sessionToken: string
): Promise<{ feed: PublicDiaryEntry[]; mine: MyDiaryEntry[] }> {
  const [feedRes, mineRes] = await Promise.all([
    apiFetch<{ entries: PublicDiaryEntry[] }>(
      `/api/rooms/${encodeURIComponent(roomCode)}/diary`,
      { method: 'GET' },
      sessionToken
    ),
    apiFetch<{ entries: MyDiaryEntry[] }>(
      `/api/rooms/${encodeURIComponent(roomCode)}/diary/mine`,
      { method: 'GET' },
      sessionToken
    ),
  ]);
  return {
    feed: feedRes.entries,
    mine: mineRes.entries,
  };
}

export async function fetchSingleDiaryEntry(
  roomCode: string,
  entryId: string,
  sessionToken: string
): Promise<{ entry: PublicDiaryEntry }> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/diary/${encodeURIComponent(entryId)}`,
    { method: 'GET' },
    sessionToken
  );
}

export async function createDiaryEntry(
  roomCode: string,
  payload: {
    mood: 'joy' | 'sadness' | 'pressure' | 'unsaid';
    content: string;
    hiddenUserIds: string[];
  },
  sessionToken: string
): Promise<{ myEntry: MyDiaryEntry; publicEntry: PublicDiaryEntry }> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/diary`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    sessionToken
  );
}

export async function updateDiaryEntry(
  roomCode: string,
  entryId: string,
  payload: {
    mood?: 'joy' | 'sadness' | 'pressure' | 'unsaid';
    content?: string;
    hiddenUserIds?: string[];
  },
  sessionToken: string
): Promise<{ myEntry: MyDiaryEntry; publicEntry: PublicDiaryEntry }> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/diary/${encodeURIComponent(entryId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    sessionToken
  );
}

// ==================== VỤ ÁN HÒM CÔNG ĐỨC ====================
export interface DonationCaseApiResponse {
  caseView: PublicDonationCaseView | null;
  myLedger: UserEconomyLedgerEntry;
  stolenAmountVnd?: number;
}

export async function fetchDonationCaseApi(
  roomCode: string,
  sessionToken: string,
  signal?: AbortSignal
): Promise<DonationCaseApiResponse> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/donation-case`,
    { method: 'GET', signal },
    sessionToken
  );
}

export async function stealDonationBoxCaseApi(
  roomCode: string,
  sessionToken: string
): Promise<DonationCaseApiResponse> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/donation-case/steal`,
    { method: 'POST', body: JSON.stringify({}) },
    sessionToken
  );
}

export async function reportDonationCasePoliceApi(
  roomCode: string,
  sessionToken: string
): Promise<DonationCaseApiResponse> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/donation-case/report`,
    { method: 'POST', body: JSON.stringify({}) },
    sessionToken
  );
}

export async function voteDonationCaseApi(
  roomCode: string,
  suspectName: string,
  sessionToken: string,
  caseId?: string,
  roundEndsAt?: number
): Promise<DonationCaseApiResponse> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/donation-case/vote`,
    { method: 'POST', body: JSON.stringify({ suspectName, caseId, roundEndsAt }) },
    sessionToken
  );
}

export async function tickDonationCaseApi(
  roomCode: string,
  sessionToken: string
): Promise<DonationCaseApiResponse> {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/donation-case/tick`,
    { method: 'POST', body: JSON.stringify({}) },
    sessionToken
  );
}
