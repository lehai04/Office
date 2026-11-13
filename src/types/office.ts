export type AvatarGender = 'male' | 'female';

export type AttendanceStatus = 'none' | 'full' | 'half' | 'off';

export interface RoomInfo {
  id: string;
  code: string;
  name: string;
}

export interface RoomMember {
  userId: string;
  roomId: string;
  nickname: string;
  avatarGender: AvatarGender;
  memberTag: string; // e.g., "#A1B2" used to disambiguate duplicate nicknames
  seatId: string | null;
  meetingChairId?: string | null;
  online: boolean;
  joinedAt: string;
  lastSeenAt: string;
}

export interface WorkSeat {
  seatId: string;
  roomId: string;
  label: string;
  zone: 'top_row' | 'lower_row_1' | 'lower_row_2' | 'right_wall';
  occupiedByUserId: string | null;
  occupiedByNickname?: string | null;
  occupiedByTag?: string | null;
  claimedAt: string | null;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  nickname: string;
  memberTag: string;
  clientMsgId: string;
  content: string;
  createdAt: string;
  status?: 'sending' | 'sent' | 'failed';
}

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD in Asia/Ho_Chi_Minh
  status: AttendanceStatus;
  seq: number;
  updatedAt: string;
}

/**
 * Public diary entry returned to room members.
 * Strictly omits authorId, nickname, avatarGender, seatId, or profile links.
 */
export interface PublicDiaryEntry {
  id: string;
  roomId: string;
  authorLabel: 'Ẩn danh';
  mood: 'joy' | 'sadness' | 'pressure' | 'unsaid';
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Author-only diary entry returned from /diary/mine for "Bài của tôi" management.
 */
export interface MyDiaryEntry {
  id: string;
  roomId: string;
  mood: 'joy' | 'sadness' | 'pressure' | 'unsaid';
  content: string;
  hiddenUserIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  userId: string;
  sessionToken: string;
  roomCode: string;
  nickname: string;
  avatarGender: AvatarGender;
  memberTag: string;
}

