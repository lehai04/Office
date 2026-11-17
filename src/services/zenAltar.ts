import { isUsingStaticFallback, officeApiUrl } from './officeApi';
import type { AltarView } from '../utils/zenAltar';

export const USE_OFFICE_WEBSOCKET = import.meta.env.VITE_OFFICE_WEBSOCKET === 'true';
export const ALTAR_UPDATE_EVENT = 'office-altar-updated';

export type AltarCommand =
  | { action: 'start'; kind: 'incense' | 'offering'; id: string; targetId?: string }
  | { action: 'clear' }
  | { action: 'merit'; practice: 'bell' | 'bow' };

export async function requestAltar(room: string, token: string, command?: AltarCommand, signal?: AbortSignal) {
  if (isUsingStaticFallback()) throw new Error('Nghi thức chung cần máy chủ Office để đồng bộ bàn thờ.');
  const sentAt = Date.now();
  const response = await fetch(officeApiUrl(`/api/rooms/${encodeURIComponent(room)}/altar`), {
    method: command ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(command && { 'Content-Type': 'application/json' }) },
    body: command ? JSON.stringify(command) : undefined,
    signal,
  });
  const result = await response.json() as AltarView & { error?: string };
  if (!Array.isArray(result.trays) || !Array.isArray(result.rituals)) {
    throw new Error('Chưa kết nối được bàn thờ chung.');
  }
  const offset = Math.round((sentAt + Date.now()) / 2) - result.serverTime;
  return {
    ...result,
    incenseUntil: result.incenseUntil + offset,
    rituals: result.rituals.map((ritual) => ({
      ...ritual, startAt: ritual.startAt + offset, finishAt: ritual.finishAt + offset,
    })),
  };
}
