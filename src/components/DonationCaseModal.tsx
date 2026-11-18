import React, { useEffect, useState } from 'react';
import { ShieldAlert, Clock, Search, Vote, X } from 'lucide-react';
import type { PublicDonationCaseView } from '../utils/donationCaseEngine';
import { formatVnd } from '../utils/officeEconomyData';

interface DonationCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseView: PublicDonationCaseView | null;
  isAbbotUser: boolean;
  onReportPolice: () => Promise<void>;
  onVoteSuspect: (suspectName: string) => Promise<{ ok: boolean; error?: string }>;
  onOpenChat: () => void;
}

function formatCountdown(targetMs: number | null, nowMs: number): string {
  if (!targetMs) return '--:--';
  const diff = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const DonationCaseModal: React.FC<DonationCaseModalProps> = ({
  isOpen,
  onClose,
  caseView,
  isAbbotUser,
  onReportPolice,
  onVoteSuspect,
  onOpenChat,
}) => {
  const [suspectDraft, setSuspectDraft] = useState('');
  const [voteError, setVoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    setSuspectDraft('');
    setVoteError(null);
  }, [caseView?.id]);

  if (!isOpen) return null;

  const handleSubmitVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspectDraft.trim() || submitting) return;
    setSubmitting(true);
    setVoteError(null);
    const res = await onVoteSuspect(suspectDraft.trim());
    setSubmitting(false);
    if (res.ok) {
      setSuspectDraft('');
    } else {
      setVoteError(res.error || 'Không thể gửi phiếu bình chọn.');
    }
  };

  return (
    <div
      data-testid="donation-case-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2.5 backdrop-blur-sm"
    >
      <div className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-[#1a130e] text-amber-50 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-500/20 bg-black/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-black text-amber-300">
                🚓 Bảng Vụ Án Hòm Công Đức
              </h3>
              <p className="text-[10px] text-amber-200/75">
                Thảo luận tại Chat chung • Bình chọn kín theo tên nhân vật
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 hover:bg-white/20 p-1.5 text-amber-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!caseView ? (
            <div className="rounded-2xl border border-amber-500/25 bg-black/25 p-5 text-center text-xs text-amber-200/80">
              Hiện tại Hòm Công Đức đang bình yên, chưa có vụ án nào.
            </div>
          ) : (
            <>
              {/* Trạng thái + Đếm ngược */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl border border-amber-500/25 bg-black/30 p-2.5">
                  <div className="text-[10px] text-amber-200/70">Trạng thái</div>
                  <div className="mt-0.5 font-black text-amber-300">
                    {caseView.status === 'stolen_unreported' && '🚨 Chưa báo cảnh sát'}
                    {caseView.status === 'investigating' &&
                      (caseView.currentPhase === 0
                        ? '🚓 NPC đang tiếp nhận'
                        : `🔎 Manh mối ${caseView.currentPhase}/5`)}
                    {caseView.status === 'caught' && '✅ Đã bắt được kẻ trộm'}
                    {caseView.status === 'escaped' && '💨 Kẻ trộm đã thoát'}
                  </div>
                  <div className="text-[10px] text-rose-300 mt-0.5 font-bold">
                    Đã mất: {formatVnd(caseView.stolenAmountVnd)}
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-400/25 bg-black/30 p-2.5">
                  <div className="flex items-center gap-1 text-[10px] text-sky-200/75">
                    <Clock className="h-3 w-3" />
                    <span>
                      {caseView.currentPhase === 0 ? 'Manh mối 1 sau' : 'Đợt kế tiếp'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-base font-black text-sky-300 font-mono">
                    {caseView.status === 'investigating'
                      ? formatCountdown(caseView.nextPhaseAt, nowMs)
                      : '--:--'}
                  </div>
                  <div className="text-[10px] text-amber-200/80 font-bold">
                    {caseView.queuedCaseCount > 0 && `${caseView.queuedCaseCount} vụ đang chờ`}
                  </div>
                </div>
              </div>

              {/* Nút Báo cảnh sát dành riêng cho Chủ trì */}
              {caseView.status === 'stolen_unreported' && (
                <div className="rounded-2xl border border-rose-400/40 bg-rose-500/15 p-3 text-center space-y-2">
                  <div className="text-xs font-bold text-rose-200">
                    Hòm công đức vừa bị trộm! Mọi người có thể bình chọn ngay. {isAbbotUser && 'Trụ trì có thể báo cảnh sát NPC để nhận manh mối.'}
                  </div>
                  {caseView.canReportPolice && (
                    <button
                      type="button"
                      data-testid="abbot-report-police-btn"
                      onClick={() => void onReportPolice()}
                      className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 py-2.5 text-xs font-black text-white shadow-lg hover:brightness-105 active:scale-95 cursor-pointer"
                    >
                      🚔 Báo cảnh sát ngay
                    </button>
                  )}
                </div>
              )}

              {/* Danh sách Manh mối đã công bố */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs font-black text-amber-300">
                    <Search className="h-3.5 w-3.5" />
                    Manh mối đã công bố ({caseView.publishedClues.length}/5)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenChat();
                    }}
                    className="text-[11px] font-bold text-emerald-300 hover:underline cursor-pointer"
                  >
                    💬 Sang Chat chung bàn bạc
                  </button>
                </div>

                {caseView.publishedClues.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-amber-100/75">
                    {caseView.status === 'investigating'
                      ? 'Cảnh sát NPC đang thu thập chứng cứ. Manh mối đầu tiên sẽ công bố ở phút thứ 5.'
                      : 'Chưa có manh mối nào được công bố.'}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {[...caseView.publishedClues].reverse().map((clue) => (
                      <div
                        key={clue.round}
                        className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs"
                      >
                        <div className="font-black text-amber-300">{clue.title}</div>
                        <div className="mt-0.5 text-amber-50/95 leading-snug">{clue.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Khu vực Bình chọn kẻ trộm (Không có danh sách gợi ý nghi phạm) */}
              {(caseView.status === 'stolen_unreported' || caseView.status === 'investigating') && (
                <form
                  onSubmit={(e) => void handleSubmitVote(e)}
                  className="rounded-2xl border border-emerald-400/30 bg-black/30 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
                      <Vote className="h-3.5 w-3.5" />
                      Bình chọn kẻ trộm
                    </span>
                    {caseView.myCurrentVoteLabel && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                        Đã chọn: {caseView.myCurrentVoteLabel}
                      </span>
                    )}
                  </div>

                  {caseView.quickVoteEndsAt !== null && (
                    <p className="text-[11px] text-amber-200" role="status">
                      {nowMs >= caseView.quickVoteEndsAt
                        ? 'Đang chốt kết quả…'
                        : `Còn ${Math.ceil((caseView.quickVoteEndsAt - nowMs) / 1000)} giây · ${caseView.currentRoundVoteCount} phiếu`}
                    </p>
                  )}
                  {caseView.lastQuickVoteResult === 'incorrect' && (
                    <p className="text-[11px] font-bold text-rose-200" role="status">
                      Lượt trước chưa đoán đúng. Bạn có thể bình chọn tiếp.
                    </p>
                  )}
                      <input
                        type="text"
                        autoComplete="off"
                        value={suspectDraft}
                        onChange={(e) => setSuspectDraft(e.target.value)}
                        placeholder="Nhập chính xác tên nhân vật nghi ngờ (hoặc Tên #ABCD)..."
                        className="w-full rounded-xl border border-amber-500/35 bg-black/40 px-3 py-2 text-xs font-bold text-amber-50 placeholder-amber-200/40 outline-none focus:border-emerald-400"
                      />
                      {voteError && (
                        <p role="alert" className="rounded-xl bg-rose-500/20 px-2.5 py-1.5 text-[11px] font-bold text-rose-200">
                          {voteError}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={submitting || !suspectDraft.trim() ||
                          (caseView.quickVoteEndsAt !== null && nowMs >= caseView.quickVoteEndsAt)}
                        className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 py-2 text-xs font-black text-slate-950 shadow cursor-pointer"
                      >
                        {caseView.hasVotedCurrentRound
                          ? '🔄 Đổi phiếu bình chọn'
                          : caseView.quickVoteEndsAt !== null ? '🗳️ Gửi phiếu' : '🗳️ Mở lượt bình chọn 5 giây'}
                      </button>
                </form>
              )}

              {/* Kết quả kết thúc vụ án */}
              {(caseView.status === 'caught' || caseView.status === 'escaped') &&
                caseView.settlementSummary && (
                  <div
                    className={`rounded-2xl border p-3 text-xs space-y-1 ${
                      caseView.status === 'caught'
                        ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
                        : 'border-rose-400/50 bg-rose-500/15 text-rose-100'
                    }`}
                  >
                    <div className="text-sm font-black">
                      {caseView.status === 'caught'
                        ? `🎉 Bắt đúng kẻ trộm: ${caseView.caughtThiefNickname}`
                        : '💨 Hết 30 phút — Kẻ trộm đã thoát!'}
                    </div>
                    {caseView.status === 'caught' ? (
                      <>
                        <div>
                          • Đã hoàn trả vào hòm công đức:{' '}
                          <strong>{formatVnd(caseView.settlementSummary.actualRefundedVnd)}</strong>
                        </div>
                        <div>
                          • Đã bồi thường thực tế cho mọi người:{' '}
                          <strong>
                            {formatVnd(caseView.settlementSummary.actualCompensatedTotalVnd)}
                          </strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          • Tổng tiền phạt thực tế đã thu:{' '}
                          <strong>{formatVnd(caseView.settlementSummary.actualFinedTotalVnd)}</strong>
                        </div>
                        <div>
                          • Chủ trì mất thêm:{' '}
                          <strong>{caseView.settlementSummary.abbotExtraMeritPenalty} Công đức</strong>
                        </div>
                      </>
                    )}
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
