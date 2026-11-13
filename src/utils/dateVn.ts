export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Trả về thông tin năm, tháng (1-12), ngày (1-31) hiện tại theo múi giờ Asia/Ho_Chi_Minh
 */
export function getNowInHoChiMinh(): { year: number; month: number; day: number; dateStr: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 2026);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? 1);
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, dateStr };
}

/**
 * Định dạng giờ gửi tin nhắn hoặc bài nhật ký theo múi giờ Asia/Ho_Chi_Minh
 */
export function formatTimeHoChiMinh(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: VN_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(isoString));
  } catch {
    return '';
  }
}

export function formatDateTimeHoChiMinh(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: VN_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false,
    }).format(new Date(isoString));
  } catch {
    return '';
  }
}

/**
 * Tạo lưới lịch theo tháng (Thứ Hai là ngày đầu tuần theo chuẩn Việt Nam)
 */
export function buildMonthCalendarGrid(year: number, month: number): Array<{
  dateStr: string | null;
  dayNumber: number | null;
  isWeekend: boolean;
}> {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const firstDayUtc = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  // Chuyển sang hệ Thứ Hai = 0 ... Chủ Nhật = 6
  const leadingEmptyDays = (firstDayUtc + 6) % 7;

  const cells: Array<{
    dateStr: string | null;
    dayNumber: number | null;
    isWeekend: boolean;
  }> = [];

  for (let i = 0; i < leadingEmptyDays; i++) {
    cells.push({ dateStr: null, dayNumber: null, isWeekend: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = (leadingEmptyDays + day - 1) % 7;
    const isWeekend = dow === 5 || dow === 6; // Thứ Bảy, Chủ Nhật
    cells.push({ dateStr, dayNumber: day, isWeekend });
  }

  return cells;
}

