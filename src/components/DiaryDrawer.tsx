import React, { useMemo, useState } from 'react';
import {
  BookHeart,
  EyeOff,
  Lock,
  PenSquare,
  Send,
  X,
  ChevronDown,
  Check,
  Search,
  Sparkles,
} from 'lucide-react';
import type { MyDiaryEntry, PublicDiaryEntry, RoomMember } from '../types/office';
import { formatDateTimeHoChiMinh } from '../utils/dateVn';

interface DiaryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  members: RoomMember[];
  publicFeed: PublicDiaryEntry[];
  myEntries: MyDiaryEntry[];
  onCreateEntry: (payload: {
    mood: 'joy' | 'sadness' | 'pressure' | 'unsaid';
    content: string;
    hiddenUserIds: string[];
  }) => Promise<void>;
  onUpdateEntry: (
    entryId: string,
    payload: {
      mood: 'joy' | 'sadness' | 'pressure' | 'unsaid';
      content: string;
      hiddenUserIds: string[];
    }
  ) => Promise<void>;
  onLookupById: (entryId: string) => Promise<PublicDiaryEntry | null>;
}

const MOOD_OPTIONS: Array<{
  id: 'joy' | 'sadness' | 'pressure' | 'unsaid';
  label: string;
  badgeClass: string;
}> = [
  {
    id: 'joy',
    label: 'Niềm vui công việc',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  },
  {
    id: 'sadness',
    label: 'Nỗi buồn',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
  },
  {
    id: 'pressure',
    label: 'Áp lực công việc',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  },
  {
    id: 'unsaid',
    label: 'Chuyện khó nói',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
  },
];

export const DiaryDrawer: React.FC<DiaryDrawerProps> = ({
  isOpen,
  onClose,
  currentUserId,
  members,
  publicFeed,
  myEntries,
  onCreateEntry,
  onUpdateEntry,
  onLookupById,
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'compose' | 'mine'>('feed');
  const [mood, setMood] = useState<'joy' | 'sadness' | 'pressure' | 'unsaid'>('joy');
  const [content, setContent] = useState('');
  const [hiddenUserIds, setHiddenUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State chỉnh sửa bài trong "Bài của tôi"
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editMood, setEditMood] = useState<'joy' | 'sadness' | 'pressure' | 'unsaid'>('joy');
  const [editContent, setEditContent] = useState('');
  const [editHiddenIds, setEditHiddenIds] = useState<string[]>([]);

  // State kiểm tra mở trực tiếp bài theo ID
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<PublicDiaryEntry | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const otherMembers = useMemo(
    () => members.filter((m) => m.userId !== currentUserId),
    [members, currentUserId]
  );

  // Phát hiện biệt danh trùng nhau để thêm dấu hiệu phân biệt trong danh sách chọn thành viên
  const nicknameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      const k = m.nickname.trim().toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [members]);

  const formatMemberOptionLabel = (m: RoomMember) => {
    const dupCount = nicknameCounts.get(m.nickname.trim().toLowerCase()) ?? 1;
    if (dupCount > 1) {
      const seatHint = m.seatId ? ` • Ghế ${m.seatId.replace('seat-', '').toUpperCase()}` : ' • Đứng gần cửa';
      return `${m.nickname} (${m.memberTag}${seatHint})`;
    }
    return m.nickname;
  };

  if (!isOpen) return null;

  const toggleHiddenUser = (userId: string, isEditMode = false) => {
    if (isEditMode) {
      setEditHiddenIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    } else {
      setHiddenUserIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreateEntry({
        mood,
        content: content.trim(),
        hiddenUserIds,
      });
      setContent('');
      setHiddenUserIds([]);
      setActiveTab('feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng bài nhật ký.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (entry: MyDiaryEntry) => {
    setEditingEntryId(entry.id);
    setEditMood(entry.mood);
    setEditContent(entry.content);
    setEditHiddenIds([...entry.hiddenUserIds]);
  };

  const handleSaveEdit = async (entryId: string) => {
    if (!editContent.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onUpdateEntry(entryId, {
        mood: editMood,
        content: editContent.trim(),
        hiddenUserIds: editHiddenIds,
      });
      setEditingEntryId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật bài nhật ký.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDirectLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupId.trim()) return;
    setLookupError(null);
    setLookupResult(null);
    try {
      const found = await onLookupById(lookupId.trim());
      if (found) {
        setLookupResult(found);
      } else {
        setLookupError('Không tìm thấy bài hoặc bạn không có quyền xem bài này.');
      }
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : 'Không thể truy cập bài nhật ký này.'
      );
    }
  };

  return (
    <div
      data-testid="diary-drawer"
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/65 p-0 sm:p-4 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-3xl border border-white/15 bg-slate-900/95 shadow-2xl text-slate-100 max-h-[86vh] overflow-hidden">
        {/* Header câu hỏi chính */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4 bg-gradient-to-r from-purple-950/50 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300 ring-1 ring-purple-400/30">
              <BookHeart className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-300">
                Phòng nhật ký ẩn danh • Góc Tịnh Tâm
              </span>
              <h2
                data-testid="diary-main-question"
                className="text-base sm:text-lg font-bold text-white"
              >
                Hôm nay đi làm bạn thấy thế nào?
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-diary-btn"
            className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
          >
            <ChevronDown className="h-4 w-4 sm:hidden" />
            <X className="h-4 w-4 hidden sm:block" />
          </button>
        </div>

        {/* Thanh chuyển Tab */}
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-2.5 bg-slate-900/80">
          <button
            type="button"
            data-testid="diary-tab-feed"
            onClick={() => setActiveTab('feed')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-purple-500 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Bảng tâm sự chung ({publicFeed.length})
          </button>
          <button
            type="button"
            data-testid="diary-tab-compose"
            onClick={() => setActiveTab('compose')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'compose'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <PenSquare className="h-3.5 w-3.5" />
            <span>Viết tâm sự</span>
          </button>
          <button
            type="button"
            data-testid="diary-tab-mine"
            onClick={() => setActiveTab('mine')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'mine'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Bài của tôi ({myEntries.length})
          </button>
        </div>

        {/* Nội dung Tab */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          {/* TAB 1: BẢNG TÂM SỰ CHUNG */}
          {activeTab === 'feed' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-400">
                  Mọi bài chia sẻ đều ẩn danh hoàn toàn và không phát bong bóng trên đầu nhân vật.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('compose')}
                  className="shrink-0 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 px-3 py-1.5 text-xs font-semibold text-purple-200 cursor-pointer"
                >
                  + Chia sẻ ngay
                </button>
              </div>

              {publicFeed.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-8 text-center">
                  <Sparkles className="mx-auto h-7 w-7 text-purple-400/70 mb-2" />
                  <p className="text-sm font-medium text-slate-300">
                    Chưa có bài tâm sự nào trên bảng chung.
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Hãy là người đầu tiên gửi gắm niềm vui hoặc nỗi niềm hôm nay nhé!
                  </p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="diary-public-feed-list">
                  {publicFeed.map((item) => {
                    const moodObj =
                      MOOD_OPTIONS.find((m) => m.id === item.mood) ?? MOOD_OPTIONS[0];
                    return (
                      <article
                        key={item.id}
                        data-testid={`diary-feed-item-${item.id}`}
                        className="rounded-2xl border border-white/10 bg-slate-800/70 p-4 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              data-testid="diary-author-label"
                              className="inline-flex items-center gap-1.5 rounded-full bg-slate-700/90 px-2.5 py-0.5 text-xs font-bold text-slate-200"
                            >
                              <Lock className="h-3 w-3 text-purple-400" />
                              {item.authorLabel}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${moodObj.badgeClass}`}
                            >
                              {moodObj.label}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {formatDateTimeHoChiMinh(item.createdAt)}
                          </span>
                        </div>

                        <p className="text-sm text-slate-100 whitespace-pre-wrap break-words leading-relaxed">
                          {item.content}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* Hộp tra cứu trực tiếp theo ID để kiểm chứng quyền xem ở máy chủ */}
              <div className="pt-3 border-t border-white/10">
                <form
                  onSubmit={handleDirectLookup}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                >
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
                    <Search className="h-3.5 w-3.5" />
                    <span>Mở trực tiếp bằng ID bài:</span>
                  </div>
                  <input
                    type="text"
                    data-testid="diary-direct-id-input"
                    value={lookupId}
                    onChange={(e) => setLookupId(e.target.value)}
                    placeholder="Nhập mã ID bài nhật ký..."
                    className="flex-1 rounded-xl border border-white/10 bg-slate-800/80 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    data-testid="diary-direct-id-btn"
                    className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    Mở bài
                  </button>
                </form>

                {lookupError && (
                  <p
                    data-testid="diary-direct-lookup-error"
                    className="mt-2 text-xs text-rose-400"
                  >
                    {lookupError}
                  </p>
                )}
                {lookupResult && (
                  <div
                    data-testid="diary-direct-lookup-result"
                    className="mt-2 rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 text-xs space-y-1"
                  >
                    <div className="font-bold text-purple-300">
                      Tác giả: {lookupResult.authorLabel}
                    </div>
                    <div className="text-slate-200 whitespace-pre-wrap">
                      {lookupResult.content}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MÀN HÌNH SOẠN BÀI NHẬT KÝ */}
          {activeTab === 'compose' && (
            <form onSubmit={handlePublish} className="space-y-4">
              {/* Ghi chú bắt buộc trong màn hình soạn */}
              <div
                data-testid="diary-anonymity-warning"
                className="rounded-2xl border border-purple-400/30 bg-purple-500/10 px-3.5 py-2.5 text-xs text-purple-200 flex items-center gap-2"
              >
                <Lock className="h-4 w-4 text-purple-300 shrink-0" />
                <span>
                  Bài đăng hiện dưới tên Ẩn danh. Chi tiết trong nội dung có thể khiến người khác đoán ra bạn.
                </span>
              </div>

              {/* Chọn chủ đề cảm xúc */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Chủ đề cảm xúc hôm nay:
                </label>
                <div className="flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMood(opt.id)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        mood === opt.id
                          ? `${opt.badgeClass} ring-2 ring-white/40`
                          : 'border-white/10 bg-slate-800/60 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nội dung tâm sự */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nội dung chia sẻ (niềm vui, nỗi buồn, áp lực hoặc chuyện khó nói):
                </label>
                <textarea
                  data-testid="diary-content-textarea"
                  rows={4}
                  required
                  maxLength={4000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Hôm nay đi làm bạn thấy thế nào? Hãy viết ra để nhẹ lòng hơn nhé..."
                  className="w-full rounded-2xl border border-white/15 bg-slate-800/90 p-3.5 text-sm text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
                />
              </div>

              {/* Mục "Ẩn bài này với..." */}
              <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-3.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 mb-2">
                  <EyeOff className="h-4 w-4 text-amber-400" />
                  <span>Ẩn bài này với… (Lưu theo ID tài khoản nội bộ)</span>
                </div>
                {otherMembers.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Hiện chưa có thành viên nào khác trong phòng.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2" data-testid="diary-hide-member-list">
                    {otherMembers.map((member) => {
                      const isHidden = hiddenUserIds.includes(member.userId);
                      return (
                        <button
                          key={member.userId}
                          type="button"
                          data-testid={`hide-member-btn-${member.nickname}`}
                          data-userid={member.userId}
                          onClick={() => toggleHiddenUser(member.userId, false)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                            isHidden
                              ? 'border-rose-400 bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40'
                              : 'border-white/10 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {isHidden && <Check className="h-3.5 w-3.5 text-rose-400" />}
                          <span>{formatMemberOptionLabel(member)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('feed')}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  data-testid="diary-publish-btn"
                  disabled={submitting || !content.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? 'Đang đăng...' : 'Đăng ẩn danh'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: BÀI CỦA TÔI */}
          {activeTab === 'mine' && (
            <div className="space-y-3" data-testid="diary-my-posts-list">
              {myEntries.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-6 text-center text-xs text-slate-400">
                  Bạn chưa đăng bài tâm sự nào trong phòng này.
                </div>
              ) : (
                myEntries.map((entry) => {
                  const isEditing = editingEntryId === entry.id;
                  const moodObj =
                    MOOD_OPTIONS.find((m) => m.id === entry.mood) ?? MOOD_OPTIONS[0];

                  return (
                    <div
                      key={entry.id}
                      data-testid={`my-diary-item-${entry.id}`}
                      className="rounded-2xl border border-white/15 bg-slate-800/80 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${moodObj.badgeClass}`}
                          >
                            {moodObj.label}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            ID: {entry.id}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {formatDateTimeHoChiMinh(entry.updatedAt)}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="space-y-3">
                          <textarea
                            rows={3}
                            data-testid="edit-diary-textarea"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                          />

                          <div>
                            <div className="text-xs font-semibold text-slate-300 mb-1.5">
                              Cập nhật danh sách “Ẩn bài này với…”:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {otherMembers.map((member) => {
                                const isHidden = editHiddenIds.includes(member.userId);
                                return (
                                  <button
                                    key={member.userId}
                                    type="button"
                                    data-testid={`edit-hide-member-${member.nickname}`}
                                    onClick={() => toggleHiddenUser(member.userId, true)}
                                    className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs cursor-pointer ${
                                      isHidden
                                        ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                                        : 'border-white/10 bg-slate-900 text-slate-300'
                                    }`}
                                  >
                                    {isHidden && <Check className="h-3 w-3 text-rose-400" />}
                                    <span>{formatMemberOptionLabel(member)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingEntryId(null)}
                              className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs text-slate-200 cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              data-testid="save-diary-edit-btn"
                              onClick={() => handleSaveEdit(entry.id)}
                              className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 cursor-pointer"
                            >
                              Lưu thay đổi
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">
                            {entry.content}
                          </p>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
                            <div className="text-slate-400">
                              Đang ẩn với:{' '}
                              {entry.hiddenUserIds.length === 0 ? (
                                <span className="text-emerald-400">Không ẩn ai</span>
                              ) : (
                                <span className="text-rose-300 font-medium">
                                  {entry.hiddenUserIds
                                    .map((uid) => {
                                      const m = members.find((mem) => mem.userId === uid);
                                      return m ? formatMemberOptionLabel(m) : uid;
                                    })
                                    .join(', ')}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              data-testid={`edit-my-diary-btn-${entry.id}`}
                              onClick={() => startEditing(entry)}
                              className="rounded-xl bg-slate-700 hover:bg-slate-600 px-3 py-1 text-xs font-semibold text-white cursor-pointer"
                            >
                              Chỉnh sửa bài & quyền xem
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

