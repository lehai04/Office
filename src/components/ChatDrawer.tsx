import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, RotateCcw, AlertTriangle, ChevronDown, X } from 'lucide-react';
import type { ChatMessage, RoomMember } from '../types/office';
import { formatTimeHoChiMinh } from '../utils/dateVn';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  messages: ChatMessage[];
  members: RoomMember[];
  onSendMessage: (content: string, existingClientMsgId?: string) => Promise<void>;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  currentUserId,
  messages,
  members,
  onSendMessage,
}) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Đếm biệt danh trùng để hiển thị mã phân biệt khi cần
  const duplicateNicknames = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      const k = m.nickname.trim().toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [members]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setDraft('');
    setSending(true);
    try {
      await onSendMessage(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <aside
      data-testid="chat-drawer"
      className="fixed z-30 bottom-16 sm:bottom-20 right-0 sm:right-4 left-0 sm:left-auto w-full sm:w-[360px] max-h-[56vh] sm:max-h-[68vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-white/15 bg-slate-900/90 backdrop-blur-xl shadow-2xl text-slate-100 transition-all"
    >
      {/* Thanh tiêu đề ngăn trượt */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight">
              Trò chuyện trong phòng
            </h3>
            <p className="text-[11px] text-slate-400">
              {members.filter((m) => m.online).length}/{members.length} thành viên trực tuyến • Hiện bong bóng 5s
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          data-testid="close-chat-btn"
          title="Thu gọn khung chat"
          className="rounded-xl bg-slate-800/80 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
        >
          <ChevronDown className="h-4 w-4 sm:hidden" />
          <X className="h-4 w-4 hidden sm:block" />
        </button>
      </div>

      {/* Danh sách tin nhắn */}
      <div
        ref={listRef}
        data-testid="chat-message-list"
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-[200px]"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center text-xs text-slate-400">
            <p>Chưa có tin nhắn nào trong phòng.</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Hãy gửi lời chào đầu tiên để bong bóng xuất hiện trên đầu nhân vật 3D!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.userId === currentUserId;
            const isDuplicateName =
              (duplicateNicknames.get(msg.nickname.trim().toLowerCase()) ?? 0) > 1;
            const senderDisplay = isDuplicateName
              ? `${msg.nickname} (${msg.memberTag})`
              : msg.nickname;

            return (
              <div
                key={msg.clientMsgId || msg.id}
                data-testid="chat-message-item"
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5 px-1">
                  <span className="text-[11px] font-semibold text-slate-300">
                    {senderDisplay}
                    {isMine ? ' (Bạn)' : ''}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {formatTimeHoChiMinh(msg.createdAt)}
                  </span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap ${
                    msg.status === 'failed'
                      ? 'bg-rose-950/80 text-rose-200 border border-rose-500/50'
                      : isMine
                        ? 'bg-emerald-500 text-slate-950 font-medium rounded-br-xs'
                        : 'bg-slate-800 text-slate-100 border border-white/10 rounded-bl-xs'
                  }`}
                >
                  {msg.content}
                </div>

                {msg.status === 'failed' && (
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-rose-400">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Gửi thất bại
                    </span>
                    <button
                      type="button"
                      data-testid={`retry-msg-${msg.clientMsgId}`}
                      onClick={() => onSendMessage(msg.content, msg.clientMsgId)}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 px-2 py-0.5 font-semibold text-rose-200 cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Gửi lại
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Ô nhập tin nhắn */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-white/10 p-3 flex items-center gap-2"
      >
        <input
          type="text"
          data-testid="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          placeholder="Nhập tin nhắn cho đồng nghiệp..."
          className="flex-1 rounded-2xl border border-white/15 bg-slate-800/90 px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none"
        />
        <button
          type="submit"
          data-testid="chat-send-btn"
          disabled={!draft.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 transition-all cursor-pointer"
          title="Gửi tin nhắn"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
};

