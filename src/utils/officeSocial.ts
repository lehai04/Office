export const OFFICE_MOODS = {
  happy: { label: 'Vui', icon: '😄' },
  sad: { label: 'Buồn', icon: '😢' },
  curt: { label: 'Cọc', icon: '😒' },
  grumpy: { label: 'Quạu', icon: '😠' },
  love: { label: 'Yêu', icon: '😍' },
  hate: { label: 'Ghét', icon: '😤' },
} as const;
export type OfficeMood = keyof typeof OFFICE_MOODS;

export interface OfficePresence {
  doNotDisturb: boolean;
  mood: OfficeMood | null;
}

export interface PrivateChatGroup {
  code: string;
  name: string;
  memberCount: number;
}

export interface PrivateChatMessage {
  id: string;
  content: string;
  userId: string;
  nickname: string;
  createdAt: string;
}

export const PRIVATE_CHAT_EVENT = 'office-private-chat-updated';

export function isOfficeMood(value: unknown): value is OfficeMood {
  return typeof value === 'string' && Object.hasOwn(OFFICE_MOODS, value);
}
