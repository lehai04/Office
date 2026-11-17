export const ALTAR_CAPACITY = 5;
export const REPLACE_MERIT = 50;
export const ALTAR_WALK_MS = 1400;
export const ALTAR_BOW_MS = 850;
export const ALTAR_PLACE_MS = 700;
export const ALTAR_KICK_MS = 700;

export type AltarKind = 'incense' | 'offering';

export interface AltarTray {
  id: string;
  slot: number;
  userId: string;
  nickname: string;
}

export interface AltarRitual {
  id: string;
  userId: string;
  nickname: string;
  avatarGender: 'male' | 'female';
  kind: AltarKind;
  targetId?: string;
  slot?: number;
  startAt: number;
  finishAt: number;
}

export interface AltarResult {
  id: string;
  kind: AltarKind;
  ok: boolean;
  message: string;
}

export interface AltarView {
  trays: AltarTray[];
  rituals: AltarRitual[];
  incenseUntil: number;
  merit: number;
  canClear: boolean;
  recentResults: AltarResult[];
  serverTime: number;
}

export function altarRitualDuration(kind: AltarKind, replacing: boolean): number {
  return ALTAR_WALK_MS + ALTAR_PLACE_MS + (
    kind === 'incense' ? 3 * ALTAR_BOW_MS : replacing ? ALTAR_KICK_MS : 0
  );
}
