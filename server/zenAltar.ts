import type { ShopConsumable, ShopOffering } from '../src/utils/officeShop';
import {
  ALTAR_CAPACITY, REPLACE_MERIT, altarRitualDuration,
  type AltarKind, type AltarResult, type AltarRitual, type AltarTray, type AltarView,
} from '../src/utils/zenAltar';

interface AltarMember {
  userId: string;
  nickname: string;
  avatarGender: 'male' | 'female';
}

interface MemberAltarState {
  merit: number;
  lastMeritAt: number;
  results: AltarResult[];
}

export interface RoomAltarState {
  trays: AltarTray[];
  rituals: AltarRitual[];
  incenseUntil: number;
  members: Record<string, MemberAltarState>;
  abbotUserId?: string;
}

export const createAltarState = (): RoomAltarState => ({
  trays: [], rituals: [], incenseUntil: 0, members: {},
});

function account(state: RoomAltarState, id: string): MemberAltarState {
  return state.members[id] ??= { merit: 0, lastMeritAt: 0, results: [] };
}

export function adjustAltarMerit(state: RoomAltarState, userId: string, delta: number): void {
  const member = account(state, userId);
  member.merit = Math.max(0, member.merit + delta);
}

function finishOffering(state: RoomAltarState, ritual: AltarRitual, owner: MemberAltarState): AltarResult {
  const result = { id: ritual.id, kind: ritual.kind, ok: false, message: '' };
  const target = state.trays.find((tray) => tray.id === ritual.targetId && tray.userId !== ritual.userId);
  if (ritual.targetId && (!target || owner.merit < REPLACE_MERIT)) {
    return { ...result, message: !target ? 'Mâm đã được dọn hoặc thay. Vui lòng thử lại.' : 'Bạn cần ít nhất 50 công đức.' };
  }
  const slot = target?.slot ?? ritual.slot;
  if (slot === undefined || (!target && state.trays.some((tray) => tray.slot === slot))) {
    return { ...result, message: 'Vị trí đã có mâm lễ. Vui lòng thử lại.' };
  }

  const tray = { id: ritual.id, slot, userId: ritual.userId, nickname: ritual.nickname, item: ritual.item as ShopOffering | undefined };
  state.trays = target ? state.trays.map((item) => item.id === target.id ? tray : item) : [...state.trays, tray];
  if (target) owner.merit -= REPLACE_MERIT;
  return { ...result, ok: true, message: 'Dâng lễ thành công' };
}

export function settleAltar(state: RoomAltarState, now: number, consume?: (userId: string, item: ShopConsumable) => void): boolean {
  const due = state.rituals.filter((ritual) => ritual.finishAt <= now)
    .sort((a, b) => a.finishAt - b.finishAt || a.id.localeCompare(b.id));
  if (!due.length) return false;
  state.rituals = state.rituals.filter((ritual) => ritual.finishAt > now);
  for (const ritual of due) {
    const owner = account(state, ritual.userId);
    const result = ritual.kind === 'offering'
      ? finishOffering(state, ritual, owner)
      : { id: ritual.id, kind: ritual.kind, ok: true, message: 'Đã dâng hương' };
    if (ritual.kind === 'incense') state.incenseUntil = ritual.finishAt + 60_000;
    if (result.ok && ritual.item) consume?.(ritual.userId, ritual.item);
    owner.results.push(result);
  }
  return true;
}

export function updateAltar(
  state: RoomAltarState, member: AltarMember, body: Record<string, unknown>, now: number, item?: ShopConsumable,
): string | undefined {
  const owner = account(state, member.userId);
  if (body.action === 'clear') {
    if (state.abbotUserId !== member.userId) return 'Chỉ Trụ trì có thể dọn mâm lễ.';
    state.trays = [];
    return;
  }
  if (body.action === 'merit') {
    if (body.practice !== 'bow' && body.practice !== 'bell') return 'Hoạt động không hợp lệ.';
    if (now - owner.lastMeritAt >= (body.practice === 'bow' ? 3000 : 600)) {
      owner.merit += body.practice === 'bow' ? 3 : 1;
      owner.lastMeritAt = now;
    }
    return;
  }
  const kind = body.kind as AltarKind;
  if (body.action !== 'start' || (kind !== 'incense' && kind !== 'offering') ||
      typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) return 'Nghi thức không hợp lệ.';
  const id = body.id;
  if (owner.results.some((result) => result.id === id) ||
      state.rituals.some((ritual) => ritual.id === id && ritual.userId === member.userId)) return;
  if (Object.values(state.members).some((entry) => entry.results.some((result) => result.id === id))) {
    return 'Mã nghi thức đã được sử dụng.';
  }
  if (state.rituals.some((ritual) => ritual.userId === member.userId || ritual.id === id)) return 'Bạn đang thực hiện nghi thức.';
  const targetId = kind === 'offering' && typeof body.targetId === 'string' ? body.targetId : undefined;
  let slot: number | undefined;
  if (kind === 'offering') {
    if (targetId) {
      const target = state.trays.find((tray) => tray.id === targetId && tray.userId !== member.userId);
      if (!target) {
        return 'Mâm đã được dọn hoặc thay. Vui lòng thử lại.';
      }
      if (owner.merit < REPLACE_MERIT) return 'Bạn cần ít nhất 50 công đức.';
      if (state.rituals.some((ritual) => ritual.targetId === targetId)) return 'Mâm này đang được thay. Hãy chọn mâm khác.';
      slot = target.slot;
    } else {
      const busySlots = new Set([...state.trays, ...state.rituals].map((item) => item.slot));
      slot = Array.from({ length: ALTAR_CAPACITY }, (_, i) => i).find((i) => !busySlots.has(i));
      if (slot === undefined) return state.trays.length >= ALTAR_CAPACITY
        ? 'Bàn thờ đã đủ 5 mâm lễ.' : 'Các vị trí còn lại đang có người dâng lễ. Vui lòng đợi.';
    }
  }
  const startAt = now + 900;
  const { userId, nickname, avatarGender } = member;
  state.rituals.push({ userId, nickname, avatarGender, id, kind, item, targetId, slot, startAt,
    finishAt: startAt + altarRitualDuration(kind, Boolean(targetId)) });
}

export function altarView(state: RoomAltarState, userId: string, now: number): AltarView {
  return {
    trays: state.trays, rituals: state.rituals, incenseUntil: state.incenseUntil,
    merit: state.members[userId]?.merit ?? 0, recentResults: state.members[userId]?.results.slice(-20) ?? [],
    canClear: state.abbotUserId === userId, serverTime: now,
  };
}
