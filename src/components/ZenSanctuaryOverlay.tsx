import React from 'react';
import { Sparkles, Flame, Volume2, VolumeX, HeartHandshake, ArrowLeft, Eye } from 'lucide-react';

export type DeityType = 'buddha' | 'ong_dia' | 'than_tai';

export interface DeityMeta {
  id: DeityType;
  name: string;
  title: string;
  subtitle: string;
  colorClass: string;
  floatingTexts: string[];
  blessings: string[];
}

export const DEITY_OPTIONS: Record<DeityType, DeityMeta> = {
  buddha: {
    id: 'buddha',
    name: 'Đức Phật',
    title: 'Bàn thờ Phật — Tịnh Tâm & Bình An',
    subtitle: 'Buông bỏ áp lực deadline, giữ tâm sáng và bình an giữa ngày làm việc.',
    colorClass: 'from-amber-500/25 to-yellow-500/10 border-amber-400/50 text-amber-200',
    floatingTexts: [
      '+1 Công đức • Tâm bất biến giữa dòng đời vạn biến',
      '+1 Tịnh tâm • Hít vào tâm tĩnh lặng, thở ra miệng mỉm cười',
      '+1 Bình an • Mọi áp lực rồi sẽ nhẹ nhàng qua đi',
      '+1 Chánh niệm • An trú trong giây phút hiện tại',
    ],
    blessings: [
      '🌸 Tâm an vạn sự an: Hôm nay hãy làm việc với tâm thế nhẹ nhàng, từng việc một sẽ đâu vào đấy.',
      '🪷 Nhẫn một chút sóng yên gió lặng, lùi một bước biển rộng trời cao. Chúc bạn một ngày làm việc thư thái!',
      '✨ Mọi khó khăn trong công việc chỉ là thử thách tạm thời. Giữ hơi thở sâu và nụ cười an nhiên nhé!',
    ],
  },
  ong_dia: {
    id: 'ong_dia',
    name: 'Ông Địa',
    title: 'Bàn thờ Ông Địa — Hòa Thuận & Suôn Sẻ',
    subtitle: 'Cầu văn phòng vui vẻ, đồng nghiệp tương trợ, mọi việc hanh thông.',
    colorClass: 'from-emerald-500/25 to-teal-500/10 border-emerald-400/50 text-emerald-200',
    floatingTexts: [
      '+1 Phước lành • Văn phòng hòa thuận, đồng nghiệp yêu thương',
      '+1 Hanh thông • Việc khó hóa dễ, làm đâu thắng đó',
      '+1 May mắn • Ông Địa cười tươi, cả ngày vui vẻ',
      '+1 Suôn sẻ • Code không bug, họp hành êm xuôi',
    ],
    blessings: [
      '🪭 Ông Địa ban phước: Hôm nay trong phòng ai cũng vui vẻ, phối hợp ăn ý, việc lớn việc nhỏ đều trôi chảy!',
      '🍵 Lộc đất bình an: Chỗ ngồi vững chãi, tinh thần phấn chấn, quý nhân đồng nghiệp luôn sẵn lòng hỗ trợ bạn.',
      '🌿 Cười lên như Ông Địa: Tinh thần lạc quan chính là chìa khóa mở ra mọi cơ hội tốt đẹp hôm nay!',
    ],
  },
  than_tai: {
    id: 'than_tai',
    name: 'Thần Tài',
    title: 'Bàn thờ Thần Tài — Tài Lộc & Thăng Tiến',
    subtitle: 'Cầu dự án thành công rực rỡ, KPI vượt chỉ tiêu, lương thưởng dồi dào.',
    colorClass: 'from-rose-500/25 to-amber-500/15 border-rose-400/50 text-rose-200',
    floatingTexts: [
      '+1 Tài lộc • Tiền vào như nước, thưởng vượt KPI',
      '+1 Thịnh vượng • Dự án thuận buồm xuôi gió',
      '+1 Lộc phát • Chốt deal liền tay, vận may rực rỡ',
      '+1 Kim Nguyên Bảo • Sự nghiệp thăng hoa, tài chính vững vàng',
    ],
    blessings: [
      '🪙 Thần Tài gõ cửa: Chúc bạn hôm nay công việc hanh thông, dự án bứt phá, sớm nhận tin vui về lương thưởng!',
      '💰 Kim Nguyên Bảo chiếu sáng: Mọi nỗ lực chăm chỉ của bạn đều sắp kết trái ngọt xứng đáng.',
      '🔥 Vận khí hanh thông: Gặp khách hàng thuận lợi, trình bày ý tưởng được đánh giá cao, tài lộc đầy nhà!',
    ],
  },
};

interface ZenSanctuaryOverlayProps {
  isOpen: boolean;
  onExitZenRoom: () => void;
  selectedDeity: DeityType;
  onSelectDeity: (deity: DeityType) => void;
  meritCount: number;
  incenseLit: boolean;
  isBowing: boolean;
  autoMo: boolean;
  soundEnabled: boolean;
  activeBlessing: string | null;
  cameraMode: 'overview' | 'first_person';
  onToggleCameraMode: () => void;
  onStrikeMo: () => void;
  onRingBell: () => void;
  onBow: () => void;
  onLightIncense: () => void;
  onToggleAutoMo: () => void;
  onToggleSound: () => void;
}

export const ZenSanctuaryOverlay: React.FC<ZenSanctuaryOverlayProps> = ({
  isOpen,
  onExitZenRoom,
  selectedDeity,
  onSelectDeity,
  meritCount,
  incenseLit,
  isBowing,
  autoMo,
  soundEnabled,
  activeBlessing,
  cameraMode,
  onToggleCameraMode,
  onStrikeMo,
  onRingBell,
  onBow,
  onLightIncense,
  onToggleAutoMo,
  onToggleSound,
}) => {
  if (!isOpen) return null;

  const currentMeta = DEITY_OPTIONS[selectedDeity];

  return (
    <div
      data-testid="zen-sanctuary-overlay"
      className="pointer-events-none fixed inset-x-0 bottom-16 sm:bottom-20 z-30 flex flex-col items-center px-3"
    >
      {/* Lời chúc phúc / Quẻ tịnh tâm nổi lên khi Lạy khấn */}
      {activeBlessing && (
        <div
          data-testid="zen-blessing-banner"
          className="pointer-events-auto mb-3 max-w-md rounded-2xl border border-amber-300/60 bg-slate-950/90 px-4 py-3 text-center text-xs sm:text-sm font-medium text-amber-100 shadow-2xl backdrop-blur-xl animate-bounce-short"
        >
          {activeBlessing}
        </div>
      )}

      {/* Bảng điều khiển Phòng Tịnh Tâm kính mờ gọn ở phía dưới */}
      <div className="pointer-events-auto w-full max-w-2xl rounded-3xl border border-amber-400/30 bg-slate-900/90 p-4 shadow-2xl backdrop-blur-xl text-slate-100 space-y-3">
        {/* Hàng trên: Tiêu đề + Điểm Công Đức / Tịnh Tâm + Nút Góc nhìn thứ nhất + Quay về văn phòng */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-200 leading-tight">
                {currentMeta.title}
              </h3>
              <p className="text-[11px] text-slate-400">{currentMeta.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bộ đếm Công đức / Tịnh tâm */}
            <div
              data-testid="zen-merit-counter"
              className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-3 py-1 text-xs font-bold text-amber-300"
            >
              ✨ Tịnh tâm: {meritCount}
            </div>

            {/* Đổi góc nhìn Thứ nhất / Toàn cảnh ngay trong phòng Tịnh Tâm */}
            <button
              type="button"
              data-testid="zen-toggle-fpv-btn"
              onClick={onToggleCameraMode}
              className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                cameraMode === 'first_person'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'
              }`}
              title="Chuyển đổi góc nhìn thứ nhất của nhân vật"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{cameraMode === 'first_person' ? 'Góc nhìn thứ 1' : 'Góc nhìn 3D'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleSound}
              className="rounded-xl bg-slate-800 hover:bg-slate-700 p-1.5 text-slate-300 cursor-pointer"
              title={soundEnabled ? 'Tắt âm thanh mõ/chuông' : 'Bật âm thanh mõ/chuông'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-amber-300" /> : <VolumeX className="h-4 w-4 text-slate-500" />}
            </button>

            <button
              type="button"
              data-testid="exit-zen-room-btn"
              onClick={onExitZenRoom}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Về bàn làm việc</span>
            </button>
          </div>
        </div>

        {/* Hàng chọn vị tôn tượng: Phật • Ông Địa • Thần Tài */}
        <div className="grid grid-cols-3 gap-2">
          {(['buddha', 'ong_dia', 'than_tai'] as DeityType[]).map((key) => {
            const item = DEITY_OPTIONS[key];
            const active = selectedDeity === key;
            return (
              <button
                key={key}
                type="button"
                data-testid={`deity-select-${key}`}
                onClick={() => onSelectDeity(key)}
                className={`flex flex-col items-center justify-center rounded-2xl border py-2 px-3 transition-all cursor-pointer ${
                  active
                    ? `bg-gradient-to-br ${item.colorClass} ring-2 ring-amber-300/60 font-bold`
                    : 'border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-xs sm:text-sm">
                  {key === 'buddha' ? '🪷 Đức Phật' : key === 'ong_dia' ? '🪭 Ông Địa' : '🪙 Thần Tài'}
                </span>
                <span className="text-[10px] opacity-80 hidden sm:inline">
                  {key === 'buddha'
                    ? 'Tịnh tâm • Bình an'
                    : key === 'ong_dia'
                      ? 'Hòa thuận • Suôn sẻ'
                      : 'Tài lộc • Thăng tiến'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Hàng nút tương tác: Gõ Mõ • Tự động Gõ Mõ • Thành tâm Lạy • Thắp Nhang • Thỉnh Chuông */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            type="button"
            data-testid="zen-strike-mo-btn"
            onClick={onStrikeMo}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 px-3 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
          >
            <span>🪵 Gõ Mõ (Cốc!)</span>
          </button>

          <button
            type="button"
            data-testid="zen-bow-btn"
            disabled={isBowing}
            onClick={onBow}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-rose-500 hover:bg-rose-400 disabled:opacity-60 active:scale-95 px-3 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-500/25 transition-all cursor-pointer"
          >
            <HeartHandshake className="h-4 w-4" />
            <span>{isBowing ? 'Đang lạy 3 lạy...' : '🙏 Lạy & Khấn'}</span>
          </button>

          <button
            type="button"
            data-testid="zen-incense-btn"
            onClick={onLightIncense}
            className={`flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
              incenseLit
                ? 'border-orange-400 bg-orange-500/20 text-orange-200'
                : 'border-white/15 bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <Flame className="h-4 w-4 text-orange-400" />
            <span>{incenseLit ? 'Đang cháy 3 nén nhang' : '🔥 Thắp 3 nén nhang'}</span>
          </button>

          <button
            type="button"
            data-testid="zen-bell-btn"
            onClick={onRingBell}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-2.5 text-xs font-semibold text-amber-200 transition-all cursor-pointer"
          >
            <span>🔔 Thỉnh Chuông</span>
          </button>

          <button
            type="button"
            data-testid="zen-auto-mo-btn"
            onClick={onToggleAutoMo}
            className={`col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
              autoMo
                ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200 ring-2 ring-emerald-400/40'
                : 'border-white/15 bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <span>{autoMo ? '⏸ Dừng tự gõ' : '🔄 Tự gõ mõ'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

