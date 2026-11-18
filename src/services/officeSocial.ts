import type { RoomMember, WorkSeat } from '../types/office';
import type { OfficePresence, PrivateChatGroup, PrivateChatMessage } from '../utils/officeSocial';
import { isUsingStaticFallback, officeApiUrl } from './officeApi';

export async function officeSocialRequest<T>(room: string, token: string, path: string,
  body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  if (isUsingStaticFallback()) throw new Error('Tính năng này cần kết nối máy chủ Office.');
  const response = await fetch(officeApiUrl('/api/rooms/' + encodeURIComponent(room) + '/' + path), {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(body && { 'Content-Type': 'application/json' }) },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const json = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(json.message ?? 'Chưa thể kết nối Office.');
  return json;
}

export const updateOfficePresence = (room: string, token: string, presence: OfficePresence) =>
  officeSocialRequest<{ members: RoomMember[]; seats: WorkSeat[] }>(room, token, 'presence', { ...presence });

export interface PrivateChatView {
  group: PrivateChatGroup;
  messages: PrivateChatMessage[];
}
