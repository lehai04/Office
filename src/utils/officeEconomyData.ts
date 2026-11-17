// Hệ thống Ví Tiền, Lương Chấm Công & Hòm Công Đức (src/utils/officeEconomyData.ts)
import type { AttendanceStatus } from '../types/office';
import type { OfficeShopState } from './officeShop';

export const INITIAL_WALLET_BALANCE_VND = 5_000_000;
export const WORK_HOURS_PER_DAY = 8;
export const HOURLY_WAGE_VND = 100_000;
export const FULL_DAY_WAGE_VND = WORK_HOURS_PER_DAY * HOURLY_WAGE_VND; // 800.000đ/ngày
export const HALF_DAY_WAGE_VND = FULL_DAY_WAGE_VND / 2; // 400.000đ/nửa ngày
export const MIN_DONATION_MERIT = 10;

export interface UserWalletState {
  shop?: OfficeShopState;
  balanceVnd: number;
  settledMonths: string[]; // các tháng 'YYYY-MM' đã trả lương vào ví
  totalDonatedVnd: number;
  updatedAt: number;
}

export interface DonationRecord {
  id: string;
  donorUserId: string;
  donorNickname: string;
  amountVnd: number;
  meritAwarded: number;
  kind?: 'donate' | 'rob';
  createdAt: number;
}

export interface RoomDonationBoxState {
  totalVnd: number;
  donations: DonationRecord[];
  updatedAt: number;
}

const WALLET_STORAGE_PREFIX = 'van_phong_ao_wallet_v1:';
const DONATION_BOX_STORAGE_PREFIX = 'van_phong_ao_donation_box_v1:';

export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
}

export function calculateDonationMerit(amountVnd: number): number {
  if (amountVnd <= 0) return 0;
  // Mỗi lần bỏ tiền vào hòm công đức được tặng tối thiểu 10 công đức trở lên
  return Math.max(MIN_DONATION_MERIT, MIN_DONATION_MERIT + Math.floor(amountVnd / 50_000) * 5);
}

export function calculateMonthSalaryVnd(
  attendanceMap: Record<string, AttendanceStatus>,
  yearMonth: string
): { fullDays: number; halfDays: number; offDays: number; totalVnd: number } {
  let fullDays = 0;
  let halfDays = 0;
  let offDays = 0;
  const prefix = `${yearMonth}-`;
  for (const [dateStr, status] of Object.entries(attendanceMap)) {
    if (!dateStr.startsWith(prefix)) continue;
    if (status === 'full') fullDays += 1;
    else if (status === 'half') halfDays += 1;
    else if (status === 'off') offDays += 1;
  }
  const totalVnd = fullDays * FULL_DAY_WAGE_VND + halfDays * HALF_DAY_WAGE_VND;
  return { fullDays, halfDays, offDays, totalVnd };
}

export function createDefaultWalletState(): UserWalletState {
  return {
    balanceVnd: INITIAL_WALLET_BALANCE_VND,
    settledMonths: [],
    totalDonatedVnd: 0,
    updatedAt: Date.now(),
  };
}

export function loadUserWalletState(roomCode: string, userId: string): UserWalletState {
  try {
    const raw = window.localStorage.getItem(`${WALLET_STORAGE_PREFIX}${roomCode}:${userId}`);
    if (!raw) return createDefaultWalletState();
    const parsed = JSON.parse(raw) as UserWalletState;
    if (parsed && typeof parsed.balanceVnd === 'number') {
      return {
        ...createDefaultWalletState(),
        ...parsed,
        settledMonths: Array.isArray(parsed.settledMonths) ? parsed.settledMonths : [],
      };
    }
    return createDefaultWalletState();
  } catch {
    return createDefaultWalletState();
  }
}

export function saveUserWalletState(
  roomCode: string,
  userId: string,
  wallet: UserWalletState
): void {
  try {
    window.localStorage.setItem(
      `${WALLET_STORAGE_PREFIX}${roomCode}:${userId}`,
      JSON.stringify(wallet)
    );
  } catch {
    // ignore
  }
}

/**
 * Tự động kết toán trả lương các tháng trước đã chấm công (nếu chưa trả vào ví).
 */
export function settlePastMonthsSalary(
  wallet: UserWalletState,
  attendanceMap: Record<string, AttendanceStatus>,
  currentYearMonth: string
): { wallet: UserWalletState; newlySettledMonths: string[]; addedVnd: number } {
  const monthsWithAttendance = new Set<string>();
  for (const [dateStr, st] of Object.entries(attendanceMap)) {
    if (st === 'full' || st === 'half') {
      const ym = dateStr.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym) && ym < currentYearMonth) {
        monthsWithAttendance.add(ym);
      }
    }
  }

  let addedVnd = 0;
  const newlySettledMonths: string[] = [];
  const nextSettled = new Set(wallet.settledMonths);

  for (const ym of Array.from(monthsWithAttendance).sort()) {
    if (nextSettled.has(ym)) continue;
    const { totalVnd } = calculateMonthSalaryVnd(attendanceMap, ym);
    if (totalVnd > 0) {
      addedVnd += totalVnd;
      newlySettledMonths.push(ym);
    }
    nextSettled.add(ym);
  }

  if (newlySettledMonths.length === 0 && nextSettled.size === wallet.settledMonths.length) {
    return { wallet, newlySettledMonths: [], addedVnd: 0 };
  }

  return {
    wallet: {
      ...wallet,
      balanceVnd: wallet.balanceVnd + addedVnd,
      settledMonths: Array.from(nextSettled),
      updatedAt: Date.now(),
    },
    newlySettledMonths,
    addedVnd,
  };
}

export function createDefaultDonationBoxState(): RoomDonationBoxState {
  return {
    totalVnd: 0,
    donations: [],
    updatedAt: 0,
  };
}

export function loadRoomDonationBoxState(roomCode: string): RoomDonationBoxState {
  try {
    const raw = window.localStorage.getItem(`${DONATION_BOX_STORAGE_PREFIX}${roomCode}`);
    if (!raw) return createDefaultDonationBoxState();
    const parsed = JSON.parse(raw) as RoomDonationBoxState;
    if (parsed && typeof parsed.totalVnd === 'number') {
      return {
        ...createDefaultDonationBoxState(),
        ...parsed,
        donations: Array.isArray(parsed.donations) ? parsed.donations : [],
      };
    }
    return createDefaultDonationBoxState();
  } catch {
    return createDefaultDonationBoxState();
  }
}

export function saveRoomDonationBoxState(
  roomCode: string,
  state: RoomDonationBoxState
): void {
  try {
    window.localStorage.setItem(
      `${DONATION_BOX_STORAGE_PREFIX}${roomCode}`,
      JSON.stringify(state)
    );
  } catch {
    // ignore
  }
}
