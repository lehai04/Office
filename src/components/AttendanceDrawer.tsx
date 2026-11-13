import React, { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, ChevronDown, AlertCircle, RotateCcw } from 'lucide-react';
import type { AttendanceStatus } from '../types/office';
import { buildMonthCalendarGrid, getNowInHoChiMinh } from '../utils/dateVn';

interface AttendanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceMap: Record<string, AttendanceStatus>;
  onCycleDay: (dateStr: string) => Promise<void>;
  onRetryFailedDay: (dateStr: string) => Promise<void>;
  failedDate: string | null;
  attendanceError: string | null;
}

export const ATTENDANCE_CYCLE: AttendanceStatus[] = ['none', 'full', 'half', 'off'];

export const ATTENDANCE_META: Record<
  AttendanceStatus,
  {
    label: string;
    shortLabel: string;
    colorName: string;
    bgClass: string;
    dotClass: string;
  }
> = {
  none: {
    label: 'Chưa chấm công',
    shortLabel: 'Chưa chấm',
    colorName: 'Xám',
    bgClass:
      'bg-slate-700/80 hover:bg-slate-600/80 text-slate-200 border-slate-500/40',
    dotClass: 'bg-slate-400',
  },
  full: {
    label: 'Làm đủ ca',
    shortLabel: 'Đủ ca',
    colorName: 'Xanh lá',
    bgClass:
      'bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 font-bold border-emerald-300 shadow-sm shadow-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  half: {
    label: 'Làm nửa ngày',
    shortLabel: 'Nửa ngày',
    colorName: 'Vàng',
    bgClass:
      'bg-amber-400/95 hover:bg-amber-300 text-slate-950 font-bold border-amber-200 shadow-sm shadow-amber-400/30',
    dotClass: 'bg-amber-400',
  },
  off: {
    label: 'Nghỉ',
    shortLabel: 'Nghỉ',
    colorName: 'Đỏ',
    bgClass:
      'bg-rose-500/90 hover:bg-rose-400 text-white font-bold border-rose-300 shadow-sm shadow-rose-500/30',
    dotClass: 'bg-rose-500',
  },
};

export function getNextAttendanceStatus(current: AttendanceStatus): AttendanceStatus {
  const idx = ATTENDANCE_CYCLE.indexOf(current);
  if (idx === -1) return 'full';
  return ATTENDANCE_CYCLE[(idx + 1) % ATTENDANCE_CYCLE.length];
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const AttendanceDrawer: React.FC<AttendanceDrawerProps> = ({
  isOpen,
  onClose,
  attendanceMap,
  onCycleDay,
  onRetryFailedDay,
  failedDate,
  attendanceError,
}) => {
  const nowVn = useMemo(() => getNowInHoChiMinh(), []);
  const [viewYear, setViewYear] = useState(nowVn.year);
  const [viewMonth, setViewMonth] = useState(nowVn.month);

  const cells = useMemo(
    () => buildMonthCalendarGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  // Thống kê nhanh trong tháng đang xem
  const stats = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth).padStart(2, '0')}-`;
    let full = 0;
    let half = 0;
    let off = 0;
    for (const [dateStr, st] of Object.entries(attendanceMap)) {
      if (dateStr.startsWith(prefix)) {
        if (st === 'full') full++;
        else if (st === 'half') half++;
        else if (st === 'off') off++;
      }
    }
    return { full, half, off };
  }, [attendanceMap, viewYear, viewMonth]);

  if (!isOpen) return null;

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <aside
      data-testid="attendance-drawer"
      className="fixed z-30 bottom-16 sm:bottom-20 left-0 sm:left-4 right-0 sm:right-auto w-full sm:w-[410px] max-h-[75vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-white/15 bg-slate-900/95 backdrop-blur-xl shadow-2xl text-slate-100 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight">
              Lịch chấm công cá nhân
            </h3>
            <p className="text-[11px] text-slate-400">
              Múi giờ Asia/Ho_Chi_Minh • Chỉ mình bạn xem & chỉnh sửa
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          data-testid="close-attendance-btn"
          className="rounded-xl bg-slate-800/80 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
        >
          <ChevronDown className="h-4 w-4 sm:hidden" />
          <X className="h-4 w-4 hidden sm:block" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {/* Điều hướng tháng */}
        <div className="flex items-center justify-between rounded-2xl bg-slate-800/80 px-3 py-2 border border-white/10">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="rounded-xl p-1.5 text-slate-300 hover:bg-slate-700 cursor-pointer"
            title="Tháng trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-bold text-white">
            Tháng {String(viewMonth).padStart(2, '0')} / {viewYear}
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            className="rounded-xl p-1.5 text-slate-300 hover:bg-slate-700 cursor-pointer"
            title="Tháng sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Thông báo lỗi nếu lưu thất bại */}
        {attendanceError && (
          <div
            data-testid="attendance-error-banner"
            className="flex items-center justify-between gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{attendanceError}</span>
            </div>
            {failedDate && (
              <button
                type="button"
                onClick={() => onRetryFailedDay(failedDate)}
                className="inline-flex items-center gap-1 rounded-xl bg-rose-500/30 hover:bg-rose-500/40 px-2.5 py-1 font-semibold text-white shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Thử lại
              </button>
            )}
          </div>
        )}

        {/* Lưới lịch theo tháng */}
        <div>
          <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-center text-[11px] font-semibold text-slate-400">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((cell, idx) => {
              if (!cell.dateStr || !cell.dayNumber) {
                return <div key={`empty-${idx}`} className="h-12 rounded-xl bg-slate-900/30" />;
              }

              const status: AttendanceStatus = attendanceMap[cell.dateStr] ?? 'none';
              const meta = ATTENDANCE_META[status];
              const isToday = cell.dateStr === nowVn.dateStr;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  data-testid={`attendance-day-${cell.dayNumber}`}
                  data-date={cell.dateStr}
                  data-status={status}
                  onClick={() => onCycleDay(cell.dateStr!)}
                  title={`Ngày ${cell.dayNumber}/${viewMonth}/${viewYear}: ${meta.colorName} — ${meta.label} (Bấm để đổi)`}
                  className={`relative flex h-12 flex-col items-center justify-center rounded-xl border transition-all active:scale-95 cursor-pointer select-none ${meta.bgClass} ${
                    isToday ? 'ring-2 ring-white' : ''
                  }`}
                >
                  <span className="text-xs leading-none">{cell.dayNumber}</span>
                  <span className="mt-1 text-[9px] leading-none opacity-90 truncate max-w-full px-0.5">
                    {meta.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chú giải màu & Vòng chuyển trạng thái */}
        <div className="rounded-2xl border border-white/10 bg-slate-800/60 p-3 space-y-2">
          <div className="text-[11px] font-semibold text-slate-300">
            Chú giải màu & Thứ tự bấm trên ô ngày:
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {ATTENDANCE_CYCLE.map((st) => {
              const meta = ATTENDANCE_META[st];
              return (
                <div
                  key={st}
                  className="flex items-center gap-2 rounded-xl bg-slate-900/60 px-2.5 py-1.5"
                >
                  <span className={`h-3 w-3 rounded-full shrink-0 ${meta.dotClass}`} />
                  <div className="truncate">
                    <span className="font-semibold text-slate-200">{meta.colorName}: </span>
                    <span className="text-slate-400">{meta.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <span>Tổng kết tháng {viewMonth}:</span>
            <div className="flex items-center gap-2.5 font-medium">
              <span className="text-emerald-400">Đủ ca: {stats.full}</span>
              <span className="text-amber-400">Nửa ngày: {stats.half}</span>
              <span className="text-rose-400">Nghỉ: {stats.off}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

