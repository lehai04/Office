import React from 'react';
import {
  Armchair,
  DoorOpen,
  CheckCircle2,
  X,
  Users,
  AlertCircle,
  Crown,
  UserMinus,
} from 'lucide-react';
import { WORK_SEAT_LAYOUTS, MEETING_CHAIRS } from '../constants/officeLayout';
import type { RoomMember, WorkSeat } from '../types/office';

interface SeatSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  seats: WorkSeat[];
  members: RoomMember[];
  onClaimSeat: (seatId: string) => Promise<void>;
  onSelectMeetingChair: (chairId: string | null) => Promise<void>;
  onStandNearDoor: () => Promise<void>;
  onTransferManager: (targetUserId: string) => Promise<void>;
  onKickMember: (targetUserId: string) => Promise<void>;
  claimingSeatId: string | null;
  seatError: string | null;
}

export const SeatSelectorModal: React.FC<SeatSelectorModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  seats,
  members,
  onClaimSeat,
  onSelectMeetingChair,
  onStandNearDoor,
  onTransferManager,
  onKickMember,
  claimingSeatId,
  seatError,
}) => {
  if (!isOpen) return null;

  const mySeat = seats.find((s) => s.occupiedByUserId === currentUserId);
  const myMember = members.find((m) => m.userId === currentUserId);
  const isMeManager = Boolean(myMember?.isManager);
  const myMeetingChairId = myMember?.meetingChairId ?? null;
  const availableCount = seats.filter((s) => !s.occupiedByUserId).length;

  const renderSeatButton = (seatId: string) => {
    const layout = WORK_SEAT_LAYOUTS.find((l) => l.seatId === seatId)!;
    const seatData = seats.find((s) => s.seatId === seatId);
    const occupiedBy = seatData?.occupiedByUserId ?? null;
    const isMine = occupiedBy === currentUserId;
    const isAvailable = occupiedBy === null;
    const occupierMember = members.find((m) => m.userId === occupiedBy);
    const occupierName =
      seatData?.occupiedByNickname || occupierMember?.nickname || 'Đồng nghiệp';

    return (
      <button
        key={seatId}
        type="button"
        data-testid={`seat-card-${seatId}`}
        disabled={(!isAvailable && !isMine) || claimingSeatId !== null}
        onClick={() => onClaimSeat(seatId)}
        className={`flex flex-col items-start justify-between rounded-2xl border p-2.5 text-left transition-all ${
          isMine
            ? 'border-emerald-400 bg-emerald-500/20 text-white ring-2 ring-emerald-400/40 cursor-pointer'
            : isAvailable
              ? 'border-sky-400/50 bg-sky-500/10 hover:bg-sky-500/20 text-slate-100 cursor-pointer'
              : 'border-white/10 bg-slate-800/70 text-slate-400 opacity-75 cursor-not-allowed'
        }`}
      >
        <div className="flex w-full items-center justify-between gap-1 mb-1">
          <span className="inline-flex items-center gap-1 text-xs font-bold">
            <Armchair
              className={`h-3.5 w-3.5 ${
                isMine
                  ? 'text-emerald-400'
                  : isAvailable
                    ? 'text-sky-400'
                    : 'text-slate-500'
              }`}
            />
            <span>{layout.shortLabel}</span>
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isMine
                ? 'bg-emerald-500 text-slate-950'
                : isAvailable
                  ? 'bg-sky-400/20 text-sky-300'
                  : 'bg-slate-700 text-slate-300'
            }`}
          >
            {isMine ? 'Ghế của bạn' : isAvailable ? 'Trống' : 'Đã có người'}
          </span>
        </div>

        <div className="text-[11px] text-slate-300 truncate w-full">
          {isMine
            ? myMeetingChairId
              ? 'Bấm để quay về ghế này'
              : 'Đang lưu cố định'
            : isAvailable
              ? claimingSeatId === seatId
                ? 'Đang nhận...'
                : 'Bấm chọn ghế'
              : `Của: ${occupierName}`}
        </div>
      </button>
    );
  };

  const renderMeetingChairPill = (chairId: string) => {
    const chair = MEETING_CHAIRS.find((c) => c.id === chairId)!;
    const occupier = members.find((m) => m.meetingChairId === chairId);
    const isMine = occupier?.userId === currentUserId;
    const isAvailable = !occupier;

    return (
      <button
        key={chairId}
        type="button"
        data-testid={`meeting-card-${chairId}`}
        disabled={!isAvailable && !isMine}
        onClick={() => onSelectMeetingChair(isMine ? null : chairId)}
        title={
          isMine
            ? 'Bạn đang ngồi ghế họp này (Bấm để rời bàn họp)'
            : isAvailable
              ? `${chair.label} — Bấm để ngồi tự do`
              : `Đang có ${occupier?.nickname} ngồi họp`
        }
        className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-1 text-[10px] font-bold transition-all ${
          isMine
            ? 'border-amber-300 bg-amber-400 text-slate-950 ring-2 ring-amber-300/50 cursor-pointer'
            : isAvailable
              ? 'border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/30 text-amber-200 cursor-pointer'
              : 'border-white/10 bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        <span>{ isMine ? `${chair.shortLabel} • Bạn` : isAvailable ? 'Trống' : `${chair.shortLabel} • ${occupier?.nickname}` }</span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-t-3xl sm:rounded-3xl border border-white/15 bg-slate-900/95 p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Armchair className="h-5 w-5 text-emerald-400" />
              <span>Sơ đồ chỗ ngồi làm việc & Bàn họp chung</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              8 ghế cố định (A1–D2) để lưu chỗ làm việc + 6 ghế bàn họp chung (H1–H6) cho phép vào ngồi tự do.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-seat-modal-btn"
            className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Chú giải trạng thái ghế */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-800/70 px-3.5 py-2 text-xs mb-3 border border-white/10">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-sky-400" />
            <span>Ghế làm việc trống ({availableCount}/8)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span>Ghế cố định của mình</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span>Ghế bàn họp (6 ghế ngồi tự do)</span>
          </div>
        </div>

        {seatError && (
          <div
            data-testid="seat-claim-error"
            className="mb-3 flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-xs font-medium text-rose-200"
          >
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{seatError}</span>
          </div>
        )}

        {/* Sơ đồ mặt bằng khớp 1:1 với ảnh sơ đồ gốc */}
        <div className="rounded-2xl border border-white/15 bg-slate-950/80 p-3.5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
            {/* Cột 1 (Sát tường trái): 2 tủ dọc lớn + Chậu cây góc dưới trái */}
            <div className="md:col-span-2 flex flex-col justify-between gap-2">
              <div className="flex-1 rounded-xl border border-slate-700 bg-slate-800/60 p-2 text-center text-[10px] text-slate-300 flex items-center justify-center">
                🗄️ Tủ dọc trái 1 (Ngăn kéo)
              </div>
              <div className="flex-1 rounded-xl border border-slate-700 bg-slate-800/60 p-2 text-center text-[10px] text-slate-300 flex items-center justify-center">
                🗄️ Tủ dọc trái 2 (Ngăn kéo)
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-2 text-center text-[11px] text-emerald-300">
                🌿 Cây xanh góc dưới trái
              </div>
            </div>

            {/* Cột 2 (Nửa trái): Dãy trên 2 ghế (A1-A2) -> Bàn họp 6 ghế ngồi tự do (giữa) -> Dãy dưới trái 2 ghế (B1-B2) */}
            <div className="md:col-span-4 flex flex-col justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-1">
                  Dãy trên (2 ghế nhìn xuống bàn):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {renderSeatButton('seat-top-1')}
                  {renderSeatButton('seat-top-2')}
                </div>
              </div>

              {/* Bàn họp 6 ghế ở giữa nửa trái (Cho phép bấm vào ngồi tự do) */}
              <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-200">
                    <Users className="h-3.5 w-3.5 text-amber-400" />
                    Bàn họp chung (Ngồi tự do)
                  </span>
                  {myMeetingChairId && (
                    <button
                      type="button"
                      onClick={() => onSelectMeetingChair(null)}
                      className="rounded-lg bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 cursor-pointer"
                    >
                      Về chỗ
                    </button>
                  )}
                </div>

                {/* 2 ghế cạnh trên bàn họp */}
                <div className="grid grid-cols-2 gap-1.5">
                  {renderMeetingChairPill('meet-top-1')}
                  {renderMeetingChairPill('meet-top-2')}
                </div>

                {/* Ghế đầu trái - Mặt bàn họp - Ghế đầu phải */}
                <div className="grid grid-cols-3 gap-1.5 items-center">
                  {renderMeetingChairPill('meet-left')}
                  <div className="rounded-lg bg-slate-800/90 border border-white/10 py-1.5 text-center text-[10px] font-semibold text-slate-300">
                    Bàn họp
                  </div>
                  {renderMeetingChairPill('meet-right')}
                </div>

                {/* 2 ghế cạnh dưới bàn họp */}
                <div className="grid grid-cols-2 gap-1.5">
                  {renderMeetingChairPill('meet-bot-1')}
                  {renderMeetingChairPill('meet-bot-2')}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-1">
                  Dãy dưới — Cụm trái (2 ghế nhìn lên bàn):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {renderSeatButton('seat-mid-1')}
                  {renderSeatButton('seat-mid-2')}
                </div>
              </div>
            </div>

            {/* Cột 3 (Giữa phòng): Tủ ngăn dọc giữa ở phía trên + Vùng đứng gần cửa + Cụm bàn dưới phải (C1-C2) */}
            <div className="md:col-span-3 flex flex-col justify-between gap-3">
              <div className="grid grid-cols-2 gap-2 flex-1">
                <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2 text-[10px] text-slate-300 flex items-center justify-center text-center">
                  🗄️ Tủ dọc ngăn giữa
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2 flex flex-col justify-between">
                  <div className="text-[10px] font-semibold text-emerald-300">
                    Khu đứng gần cửa
                  </div>
                  <button
                    type="button"
                    data-testid="stand-near-door-btn"
                    onClick={onStandNearDoor}
                    className="mt-1 w-full rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 px-2 py-1 text-[10px] font-semibold text-slate-200 cursor-pointer"
                  >
                    {mySeat || myMeetingChairId ? 'Ra đứng gần cửa' : 'Đang đứng tại đây'}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-1">
                  Dãy dưới — Cụm phải (2 ghế nhìn lên bàn):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {renderSeatButton('seat-bot-1')}
                  {renderSeatButton('seat-bot-2')}
                </div>
              </div>
            </div>

            {/* Cột 4 (Sát tường phải): Cửa đôi góc trên phải -> Cây xanh -> Bàn D1 -> Cây xanh -> Bàn D2 */}
            <div className="md:col-span-3 flex flex-col justify-between gap-2">
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <DoorOpen className="h-3.5 w-3.5" />
                  Cửa đôi (Góc trên phải)
                </span>
                <span>🌿</span>
              </div>

              <div>
                <div className="text-[10px] font-semibold text-slate-400 mb-1">
                  Sát tường phải — Trên (D1):
                </div>
                {renderSeatButton('seat-right-1')}
              </div>

              <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/20 py-1 text-center text-[10px] text-emerald-300">
                🌿 Cây xanh giữa 2 bàn phải
              </div>

              <div>
                <div className="text-[10px] font-semibold text-slate-400 mb-1">
                  Sát tường phải — Dưới (D2):
                </div>
                {renderSeatButton('seat-right-2')}
              </div>
            </div>
          </div>

          {/* Hàng dưới cùng: 4 tủ hồ sơ ngang sát tường dưới */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-700 bg-slate-800/60 py-1.5 text-center text-[10px] text-slate-400"
              >
                🗄️ Tủ ngang dưới {idx}
              </div>
            ))}
          </div>
        </div>

        {/* KHU VỰC QUẢN LÝ THÀNH VIÊN & QUYỀN TRƯỞNG PHÒNG */}
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-slate-950/75 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" />
              <span className="text-xs sm:text-sm font-bold text-white">
                Thành viên trong phòng ({members.length}) & Quyền Trưởng phòng
              </span>
            </div>
            <span className="rounded-full bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
              {isMeManager
                ? '👑 Bạn là Trưởng phòng (Có quyền chuyển chức vụ & xóa người chơi)'
                : 'Người tạo phòng là Trưởng phòng'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {members.map((m) => {
              const isSelf = m.userId === currentUserId;
              const seatObj = m.seatId
                ? WORK_SEAT_LAYOUTS.find((l) => l.seatId === m.seatId)
                : null;
              const meetObj = m.meetingChairId
                ? MEETING_CHAIRS.find((c) => c.id === m.meetingChairId)
                : null;

              return (
                <div
                  key={m.userId}
                  data-testid={`member-row-${m.userId}`}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                    m.isManager
                      ? 'border-amber-400/50 bg-amber-500/10'
                      : 'border-white/10 bg-slate-900/80'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          m.online ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                      <span className="font-bold text-white truncate">{m.nickname}</span>
                      <span className="text-[10px] font-mono text-slate-400">{m.memberTag}</span>
                      {isSelf && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-300">
                          Bạn
                        </span>
                      )}
                      {m.isManager && (
                        <span
                          data-testid={`manager-badge-${m.userId}`}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-slate-950"
                        >
                          <Crown className="h-3 w-3" />
                          Trưởng phòng
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {meetObj
                        ? `Đang ngồi ${meetObj.label}`
                        : seatObj
                          ? `Ghế cố định: ${seatObj.shortLabel}`
                          : 'Đang đứng gần cửa'}
                    </div>
                  </div>

                  {isMeManager && !isSelf && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        data-testid={`transfer-manager-btn-${m.userId}`}
                        onClick={() => onTransferManager(m.userId)}
                        title={`Chuyển quyền Trưởng phòng cho ${m.nickname}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 px-2 py-1 text-[10px] font-bold text-amber-200 transition-all cursor-pointer"
                      >
                        <Crown className="h-3 w-3 text-amber-300" />
                        <span>Nhường quyền</span>
                      </button>
                      <button
                        type="button"
                        data-testid={`kick-member-btn-${m.userId}`}
                        onClick={() => onKickMember(m.userId)}
                        title={`Xóa ${m.nickname} ra khỏi phòng`}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 px-2 py-1 text-[10px] font-bold text-rose-200 transition-all cursor-pointer"
                      >
                        <UserMinus className="h-3 w-3 text-rose-300" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>
              {myMeetingChairId
                ? `Bạn đang ngồi bàn họp chung (${myMeetingChairId})${mySeat ? ` • Ghế cố định vẫn giữ: ${mySeat.label}` : ''}`
                : mySeat
                  ? `Bạn đang giữ ghế cố định: ${mySeat.label}`
                  : 'Bạn đang đứng ở khu vực gần cửa'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 transition-all cursor-pointer"
          >
            Đóng sơ đồ
          </button>
        </div>
      </div>
    </div>
  );
};
