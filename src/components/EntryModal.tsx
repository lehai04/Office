import React, { useState } from 'react';
import { UserCheck, ShieldAlert, Sparkles, KeyRound, Users } from 'lucide-react';
import type { AvatarGender } from '../types/office';
import { DEFAULT_ROOM_CODE } from '../constants/officeLayout';

interface EntryModalProps {
  initialRoomCode: string;
  onJoin: (params: {
    roomCode: string;
    nickname: string;
    avatarGender: AvatarGender;
    createIfMissing: boolean;
  }) => Promise<void>;
  error: string | null;
  loading: boolean;
}

export const EntryModal: React.FC<EntryModalProps> = ({
  initialRoomCode,
  onJoin,
  error,
  loading,
}) => {
  const [nickname, setNickname] = useState('');
  const [avatarGender, setAvatarGender] = useState<AvatarGender>('male');
  const [roomCode, setRoomCode] = useState(initialRoomCode || DEFAULT_ROOM_CODE);
  const [createIfMissing, setCreateIfMissing] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    await onJoin({
      roomCode: roomCode.trim().toUpperCase() || DEFAULT_ROOM_CODE,
      nickname: nickname.trim(),
      avatarGender,
      createIfMissing,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/95 p-6 sm:p-7 shadow-2xl text-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Văn phòng ảo — Tịnh Tâm
            </h1>
            <p className="text-xs text-slate-400">
              Không gian 3D trò chuyện, chấm công & chia sẻ tâm sự ẩn danh
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Biệt danh */}
          <div>
            <label
              htmlFor="nickname-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Biệt danh trong phòng
            </label>
            <input
              id="nickname-input"
              data-testid="entry-nickname-input"
              type="text"
              required
              maxLength={40}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="VD: Minh, Lan, Cà Phê Sữa..."
              className="w-full rounded-xl border border-white/15 bg-slate-800/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
            />
          </div>

          {/* Chọn mẫu nhân vật 3D: Nam hoặc Nữ */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Chọn mẫu nhân vật 3D
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="gender-male-btn"
                onClick={() => setAvatarGender('male')}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3.5 transition-all ${
                  avatarGender === 'male'
                    ? 'border-emerald-400 bg-emerald-500/15 text-white ring-2 ring-emerald-400/30'
                    : 'border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/25 border border-blue-400/40">
                  {/* Biểu tượng nhân vật Nam low-poly */}
                  <div className="flex flex-col items-center">
                    <div className="h-3.5 w-3.5 rounded-sm bg-amber-300 border-t-2 border-slate-900" />
                    <div className="mt-0.5 h-4 w-5 rounded-sm bg-blue-500" />
                  </div>
                </div>
                <span className="text-xs font-semibold">Mẫu Nam</span>
              </button>

              <button
                type="button"
                data-testid="gender-female-btn"
                onClick={() => setAvatarGender('female')}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3.5 transition-all ${
                  avatarGender === 'female'
                    ? 'border-pink-400 bg-pink-500/15 text-white ring-2 ring-pink-400/30'
                    : 'border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/25 border border-pink-400/40">
                  {/* Biểu tượng nhân vật Nữ low-poly */}
                  <div className="flex flex-col items-center">
                    <div className="h-3.5 w-3.5 rounded-sm bg-amber-300 border-t-2 border-amber-950" />
                    <div className="mt-0.5 h-4 w-5 rounded-t-sm rounded-b-md bg-pink-500" />
                  </div>
                </div>
                <span className="text-xs font-semibold">Mẫu Nữ</span>
              </button>
            </div>
          </div>

          {/* Mã phòng / Link mời */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="room-code-input"
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
                <span>Mã phòng văn phòng</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Mặc định: <code className="text-emerald-300 font-mono">TINHTAM</code>
              </span>
            </div>
            <input
              id="room-code-input"
              data-testid="entry-room-code-input"
              type="text"
              required
              maxLength={20}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="TINHTAM"
              className="w-full rounded-xl border border-white/15 bg-slate-800/90 px-3.5 py-2 text-sm font-mono uppercase tracking-wider text-emerald-300 placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createIfMissing}
                onChange={(e) => setCreateIfMissing(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Tạo phòng mới nếu mã phòng này chưa tồn tại</span>
            </label>
          </div>

          {/* Lưu ý tài khoản ẩn danh */}
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200/90 leading-relaxed flex gap-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-amber-300">Tài khoản ẩn danh:</strong> Bạn không cần email hay tên thật. Lưu ý rằng việc{' '}
              <span className="underline decoration-amber-400/60">
                xóa dữ liệu trình duyệt hoặc đổi thiết bị
              </span>{' '}
              có thể làm mất quyền truy cập vào tài khoản ẩn danh, chỗ ngồi và lịch sử cũ của bạn.
            </div>
          </div>

          {error && (
            <div
              data-testid="entry-error-msg"
              className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-xs font-medium text-rose-200"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !nickname.trim()}
            data-testid="entry-submit-btn"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <UserCheck className="h-4 w-4" />
            <span>{loading ? 'Đang vào văn phòng...' : 'Vào văn phòng 3D'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

