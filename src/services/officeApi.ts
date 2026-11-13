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

const STORAGE_PREFIX = 'van_phong_ao_session_v2';
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN?.trim().replace(/\/+$/, '') ?? '';

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
  return s || 'default';
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

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  sessionToken?: string
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (sessionToken) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  const res = await fetch(officeApiUrl(path), {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Lỗi máy chủ (${res.status})`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = data.error;
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
  avatarGender: AvatarGender;
  sessionToken?: string;
  createIfMissing?: boolean;
}): Promise<JoinRoomResponse> {
  const result = await apiFetch<JoinRoomResponse>(
    '/api/auth/join',
    {
      method: 'POST',
      body: JSON.stringify({
        roomCode: params.roomCode,
        nickname: params.nickname,
        avatarGender: params.avatarGender,
        createIfMissing: params.createIfMissing ?? false,
      }),
    },
    params.sessionToken
  );
  saveSessionToStorage(result.session);
  return result;
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

