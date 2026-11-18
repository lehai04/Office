import React, { useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  ArrowLeft,
  Music,
  Upload,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ZEN_MUSIC_TRACKS, type ZenTrackId } from '../utils/zenSound';
import {
  calculateDonationMerit,
  formatVnd,
  type RoomDonationBoxState,
} from '../utils/officeEconomyData';
import type { PublicDonationCaseView } from '../utils/donationCaseEngine';

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
  isBowing: boolean;
  autoMo: boolean;
  soundEnabled: boolean;
  selectedTrackId: ZenTrackId;
  customTrackName: string | null;
  onSelectTrack: (trackId: ZenTrackId) => void;
  onUploadCustomMp3: (file: File) => void;
  activeBlessing: string | null;
  cameraMode: 'overview' | 'first_person';
  onToggleCameraMode: () => void;
  onStrikeMo: () => void;
  onRingBell: () => void;
  onBow: () => void;
  onToggleAutoMo: () => void;
  onToggleSound: () => void;
  zenCount?: number;
  onInviteToZenRoom?: () => void;
  walletBalanceVnd: number;
  donationBox: RoomDonationBoxState;
  isDonationModalOpen: boolean;
  onOpenDonationModal: () => void;
  onCloseDonationModal: () => void;
  onDonateToBox: (amountVnd: number) => Promise<{
    ok: boolean;
    error?: string;
    meritAwarded?: number;
  }>;
  onRobDonationBox: (amountVnd: number) => Promise<{
    ok: boolean;
    error?: string;
    robbedVnd?: number;
  }>;
  isAbbotUser?: boolean;
  abbotAtDonationDesk?: boolean;
  onToggleAbbotDesk?: () => void;
  donationCaseView?: PublicDonationCaseView | null;
  onStealDonationBox?: () => Promise<void>;
  onReportPolice?: () => Promise<void>;
  onOpenCaseBoard?: () => void;
}

export const ZenSanctuaryOverlay: React.FC<ZenSanctuaryOverlayProps> = ({
  isOpen,
  onExitZenRoom,
  selectedDeity,
  onSelectDeity,
  meritCount,
  isBowing,
  autoMo,
  soundEnabled,
  selectedTrackId,
  customTrackName,
  onSelectTrack,
  onUploadCustomMp3,
  activeBlessing,
  cameraMode,
  onToggleCameraMode,
  onStrikeMo,
  onRingBell,
  onBow,
  onToggleAutoMo,
  onToggleSound,
  zenCount = 1,
  onInviteToZenRoom,
  walletBalanceVnd,
  donationBox,
  isDonationModalOpen,
  onOpenDonationModal,
  onCloseDonationModal,
  onDonateToBox,
  onRobDonationBox,
  isAbbotUser = false,
  abbotAtDonationDesk = true,
  onToggleAbbotDesk,
  donationCaseView = null,
  onStealDonationBox,
  onReportPolice,
  onOpenCaseBoard,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showMusicMenu, setShowMusicMenu] = useState(false);
  const [donationAmountDraft, setDonationAmountDraft] = useState<string>('50000');
  const [donationBusy, setDonationBusy] = useState(false);
  const donationRequest = useRef(false);
  const [donationNotice, setDonationNotice] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const currentMeta = DEITY_OPTIONS[selectedDeity];
  const pillBaseClass =
    'flex items-center gap-2.5 w-[142px] sm:w-[158px] rounded-2xl border px-3.5 py-2 text-xs font-semibold shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer select-none';
  const pillDefaultStyle =
    'border-amber-500/35 bg-[#211811]/90 hover:bg-[#312318]/95 text-amber-50 hover:border-amber-400/60';
  const pillActiveStyle =
    'border-amber-300/80 bg-gradient-to-r from-[#4b341c]/95 to-[#332211]/95 text-amber-200 ring-1 ring-amber-400/50';

  return (
    <div
      data-testid="zen-sanctuary-overlay"
      className="pointer-events-none fixed inset-0 z-30"
    >
      {/* Huy hiệu Điểm Tịnh Tâm + Quẻ Chúc Phúc nhỏ gọn ở phía trên (không che bàn thờ ở giữa) */}
      <div className="pointer-events-none fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 px-3 max-w-md w-full">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-[#1e1610]/85 px-3.5 py-1 text-xs font-bold text-amber-200 shadow-xl backdrop-blur-md">
          <span>
            {selectedDeity === 'buddha'
              ? '🪷 Bàn thờ Phật'
              : selectedDeity === 'ong_dia'
                ? '🪭 Bàn thờ Ông Địa'
                : '🪙 Bàn thờ Thần Tài'}
          </span>
          <span className="text-amber-500/60">•</span>
          <span data-testid="zen-merit-counter" className="text-amber-300">
            ✨ Công đức: {meritCount}
          </span>
          <span className="text-amber-500/60">•</span>
          <span data-testid="zen-member-count" className="text-emerald-300">
            🧘 {zenCount}/10
          </span>
        </div>

        {activeBlessing && (
          <div
            data-testid="zen-blessing-banner"
            className="pointer-events-auto rounded-2xl border border-amber-300/60 bg-[#1c140e]/95 px-4 py-2.5 text-center text-xs sm:text-sm font-medium text-amber-100 shadow-2xl backdrop-blur-xl animate-bounce-short"
          >
            {activeBlessing}
          </div>
        )}
      </div>

      {/* CỘT NÚT BẤM BÊN PHẢI MÀN HÌNH (Phong cách gọn sang 1 bên như Hình 2, không che bàn thờ) */}
      <div className="pointer-events-auto fixed right-2.5 sm:right-4 bottom-16 sm:bottom-20 top-16 flex flex-col items-end justify-end gap-1.5">
        {/* Bảng chọn nhạc thiền nhỏ bật ra bên trái cột nút khi bấm "Nhạc thiền" */}
        {showMusicMenu && !isCollapsed && (
          <div className="mb-1 w-64 rounded-2xl border border-amber-400/40 bg-[#1c140d]/95 p-3 text-amber-50 shadow-2xl backdrop-blur-xl space-y-2">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Music className="h-3.5 w-3.5" />
                Chọn nhạc Phòng Thiền
              </span>
              <button
                type="button"
                onClick={() => setShowMusicMenu(false)}
                className="text-[11px] text-amber-200/70 hover:text-amber-100 cursor-pointer"
              >
                Đóng ✕
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {ZEN_MUSIC_TRACKS.filter((t) => t.id !== 'custom_mp3').map((track) => {
                const isSelected = selectedTrackId === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    data-testid={`zen-music-${track.id}`}
                    onClick={() => onSelectTrack(track.id)}
                    className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-medium transition-all cursor-pointer ${isSelected
                        ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                        : 'bg-white/5 text-amber-100/90 hover:bg-white/10 border border-amber-500/20'
                      }`}
                    title={track.description}
                  >
                    <span>{track.name}</span>
                    {isSelected && <span className="text-[10px]">●</span>}
                  </button>
                );
              })}

              <button
                type="button"
                data-testid="zen-upload-mp3-btn"
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${selectedTrackId === 'custom_mp3'
                    ? 'bg-emerald-400 text-slate-950 font-bold shadow-sm'
                    : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-400/30'
                  }`}
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {customTrackName ? `🎵 ${customTrackName}` : 'Chọn nhạc MP3 từ máy'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Input file MP3 ẩn */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onUploadCustomMp3(file);
            }
          }}
        />

        {/* Danh sách các nút dọc bên phải (Có thanh cuộn nhẹ nếu màn hình điện thoại thấp) */}
        <div
          className={`flex flex-col items-end gap-1.5 overflow-y-auto no-scrollbar max-h-[calc(100dvh-160px)] pr-0.5 transition-all ${isCollapsed ? 'hidden' : 'flex'
            }`}
        >
          {/* Cụm chuyển đổi 3 bàn thờ: Phật • Ông Địa • Thần Tài */}
          <div className="flex items-center gap-1 rounded-2xl border border-amber-500/35 bg-[#211811]/90 p-1 shadow-lg backdrop-blur-md w-[142px] sm:w-[158px]">
            {(['buddha', 'ong_dia', 'than_tai'] as DeityType[]).map((key) => {
              const active = selectedDeity === key;
              return (
                <button
                  key={key}
                  type="button"
                  data-testid={`deity-select-${key}`}
                  onClick={() => onSelectDeity(key)}
                  title={DEITY_OPTIONS[key].title}
                  className={`flex-1 rounded-xl py-1 text-[11px] font-bold transition-all cursor-pointer ${active
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-amber-100/80 hover:bg-white/10'
                    }`}
                >
                  {key === 'buddha' ? '🪷 Phật' : key === 'ong_dia' ? '🪭 Địa' : '🪙 Tài'}
                </button>
              );
            })}
          </div>

          {/* 1. Lạy Phật / Khấn */}
          <button
            type="button"
            data-testid="zen-bow-btn"
            disabled={isBowing}
            onClick={onBow}
            className={`${pillBaseClass} ${isBowing ? pillActiveStyle : pillDefaultStyle} disabled:opacity-60`}
            title={currentMeta.subtitle}
          >
            <span className="text-base leading-none">🙇</span>
            <span>{isBowing ? 'Đang lạy...' : `Lạy ${currentMeta.name}`}</span>
          </button>

          {/* 3. Gõ mõ */}
          <button
            type="button"
            data-testid="zen-strike-mo-btn"
            onClick={onStrikeMo}
            className={`${pillBaseClass} ${pillDefaultStyle}`}
          >
            <span className="text-base leading-none">🪵</span>
            <span>Gõ mõ</span>
          </button>

          {/* 4. Tự gõ mõ */}
          <button
            type="button"
            data-testid="zen-auto-mo-btn"
            onClick={onToggleAutoMo}
            className={`${pillBaseClass} ${autoMo ? pillActiveStyle : pillDefaultStyle}`}
          >
            <span className="text-base leading-none">📿</span>
            <span>{autoMo ? 'Tự gõ (Đang bật)' : 'Tự gõ mõ'}</span>
          </button>

          {/* 5. Thỉnh chuông */}
          <button
            type="button"
            data-testid="zen-bell-btn"
            onClick={onRingBell}
            className={`${pillBaseClass} ${pillDefaultStyle}`}
          >
            <span className="text-base leading-none">🔔</span>
            <span>Thỉnh chuông</span>
          </button>

          {/* 6. Nhạc thiền */}
          <button
            type="button"
            data-testid="zen-music-menu-btn"
            onClick={() => setShowMusicMenu((v) => !v)}
            className={`${pillBaseClass} ${showMusicMenu ? pillActiveStyle : pillDefaultStyle}`}
          >
            <span className="text-base leading-none">🎵</span>
            <span>Nhạc thiền</span>
          </button>

          {/* 7. Góc nhìn */}
          <button
            type="button"
            data-testid="zen-toggle-fpv-btn"
            onClick={onToggleCameraMode}
            className={`${pillBaseClass} ${cameraMode === 'first_person' ? pillActiveStyle : pillDefaultStyle
              }`}
          >
            <span className="text-base leading-none">🎥</span>
            <span>{cameraMode === 'first_person' ? 'Góc nhìn thứ 1' : 'Góc nhìn 3D'}</span>
          </button>

          {/* 8. Âm thanh */}
          <button
            type="button"
            onClick={onToggleSound}
            className={`${pillBaseClass} ${soundEnabled ? pillDefaultStyle : 'border-rose-500/40 bg-[#211811]/90 text-rose-200'}`}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-amber-300 shrink-0" />
            ) : (
              <VolumeX className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{soundEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}</span>
          </button>

          {/* 9. Hòm Công Đức (Mọi người đều thấy tiền & có thể bỏ hoặc cướp tiền) */}
          <button
            type="button"
            data-testid="zen-donation-box-btn"
            onClick={() => {
              setDonationNotice(null);
              onOpenDonationModal();
            }}
            className={`${pillBaseClass} border-amber-300/60 bg-amber-950/90 hover:bg-amber-900/95 text-amber-200 justify-between`}
          >
            <span className="flex items-center gap-1.5">
              <span className="text-base leading-none">🪙</span>
              <span>Hòm Công Đức</span>
            </span>
          </button>

          {/* Chức năng riêng của Trụ trì Thanh Ngọc: chọn ngồi Bàn Công Đức hoặc Bồ đoàn */}
          {isAbbotUser && onToggleAbbotDesk && (
            <button
              type="button"
              onClick={onToggleAbbotDesk}
              className={`${pillBaseClass} ${abbotAtDonationDesk ? pillActiveStyle : pillDefaultStyle}`}
            >
              <span className="text-base leading-none">🪷</span>
              <span>{abbotAtDonationDesk ? 'Đang ngồi Bàn CĐ' : 'Ngồi Bàn Công Đức'}</span>
            </button>
          )}

          {/* VỤ ÁN HÒM CÔNG ĐỨC: Trộm hòm / Chủ trì Báo cảnh sát / Bảng vụ án */}
          {onStealDonationBox &&
            donationBox.totalVnd > 0 &&
            (!donationCaseView ||
              donationCaseView.status === 'caught' ||
              donationCaseView.status === 'escaped') && (
              <button
                type="button"
                data-testid="zen-steal-box-btn"
                onClick={() => void onStealDonationBox()}
                className={`${pillBaseClass} border-rose-400/50 bg-rose-950/90 hover:bg-rose-900/95 text-rose-200`}
              >
                <span className="text-base leading-none">🕵️</span>
                <span>Trộm hòm công đức</span>
              </button>
            )}

          {donationCaseView?.canReportPolice && onReportPolice && (
            <button
              type="button"
              data-testid="zen-report-police-btn"
              onClick={() => void onReportPolice()}
              className={`${pillBaseClass} border-rose-400 bg-rose-600 hover:bg-rose-500 text-white animate-pulse`}
            >
              <span className="text-base leading-none">🚔</span>
              <span>Báo cảnh sát</span>
            </button>
          )}

          {donationCaseView && onOpenCaseBoard && (
            <button
              type="button"
              data-testid="zen-case-board-btn"
              onClick={onOpenCaseBoard}
              className={`${pillBaseClass} border-sky-400/60 bg-sky-950/90 hover:bg-sky-900/95 text-sky-200`}
            >
              <span className="text-base leading-none">🚓</span>
              <span>Bảng vụ án</span>
            </button>
          )}

          {/* 10. Rủ bạn bè vào ngồi chung Phòng Tịnh Tâm */}
          {onInviteToZenRoom && (
            <button
              type="button"
              data-testid="zen-invite-friends-btn"
              onClick={onInviteToZenRoom}
              className={`${pillBaseClass} border-emerald-400/50 bg-emerald-950/85 hover:bg-emerald-900/90 text-emerald-200`}
            >
              <span className="text-base leading-none">📣</span>
              <span>Rủ vào Tịnh Tâm</span>
            </button>
          )}

          {/* 10. Về bàn làm việc */}
          <button
            type="button"
            data-testid="exit-zen-room-btn"
            onClick={onExitZenRoom}
            className={`${pillBaseClass} ${pillDefaultStyle}`}
          >
            <ArrowLeft className="h-4 w-4 text-amber-300 shrink-0" />
            <span>Về bàn làm việc</span>
          </button>
        </div>

        {/* Nút Thu gọn / Mở rộng ở dưới cùng cột phải giống Hình 2 */}
        <button
          type="button"
          data-testid="zen-collapse-btn"
          onClick={() => {
            setIsCollapsed((v) => !v);
            setShowMusicMenu(false);
          }}
          className="flex items-center justify-center gap-1.5 rounded-full border border-amber-500/40 bg-[#1c140d]/90 hover:bg-[#2c2015]/95 px-4 py-1.5 text-xs font-semibold text-amber-200 shadow-lg backdrop-blur-md transition-all cursor-pointer"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Mở rộng</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Thu gọn</span>
            </>
          )}
        </button>
      </div>

      {/* MODAL HÒM CÔNG ĐỨC (Đặt trên bàn góc trái Trụ trì Thanh Ngọc) */}
      {isDonationModalOpen && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border-2 border-amber-400/50 bg-[#1e130c] p-4 text-amber-50 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
              <div>
                <h3 className="text-sm font-black text-amber-300">
                  🪙 Hòm Công Đức — Bàn Trụ Trì Thanh Ngọc
                </h3>
                <p className="text-[11px] text-amber-200/75">
                  Bỏ tiền tùy ý • Mỗi lần bỏ được tặng tối thiểu <strong>+10 Công đức</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseDonationModal}
                className="rounded-xl bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl border border-amber-500/25 bg-black/30 p-2.5">
                <div className="text-[10px] text-amber-200/70">Tổng Hòm Công Đức</div>
                <div className="text-sm font-black text-amber-300 mt-0.5">
                  {formatVnd(donationBox.totalVnd)}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-500/25 bg-black/30 p-2.5">
                <div className="text-[10px] text-emerald-200/70">Ví tiền của bạn</div>
                <div className="text-sm font-black text-emerald-300 mt-0.5">
                  {formatVnd(walletBalanceVnd)}
                </div>
              </div>
            </div>

            {donationNotice && (
              <div
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                  donationNotice.type === 'ok'
                    ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                    : 'border-rose-400/50 bg-rose-500/15 text-rose-200'
                }`}
              >
                {donationNotice.text}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-amber-200/85">
                Chọn nhanh hoặc nhập số tiền tùy ý:
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[10_000, 50_000, 100_000, 500_000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDonationAmountDraft(String(preset))}
                    className={`rounded-xl border py-1.5 text-[11px] font-black transition cursor-pointer ${
                      Number(donationAmountDraft) === preset
                        ? 'border-amber-300 bg-amber-400 text-slate-950'
                        : 'border-amber-500/30 bg-white/5 text-amber-100 hover:bg-white/10'
                    }`}
                  >
                    {preset / 1000}k
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={donationAmountDraft}
                  onChange={(e) => setDonationAmountDraft(e.target.value)}
                  className="flex-1 rounded-xl border border-amber-500/35 bg-black/40 px-3 py-2 text-xs font-bold text-amber-100 outline-none focus:border-amber-300"
                  placeholder="Nhập số tiền (VNĐ)..."
                />
                <span className="rounded-xl bg-amber-500/20 border border-amber-400/30 px-2.5 py-2 text-[11px] font-black text-amber-300 whitespace-nowrap">
                  +{calculateDonationMerit(Number(donationAmountDraft) || 0)} Công đức
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (donationRequest.current) return;
                    const amt = Math.round(Number(donationAmountDraft) || 0);
                    donationRequest.current = true;
                    setDonationBusy(true);
                    const res = await onDonateToBox(amt).finally(() => {
                      donationRequest.current = false;
                      setDonationBusy(false);
                    });
                    if (res.ok) {
                      setDonationNotice({
                        type: 'ok',
                        text: `🙏 Đã bỏ ${formatVnd(amt)} vào Hòm Công Đức! Bạn được tặng +${res.meritAwarded} Công đức.`,
                      });
                    } else {
                      setDonationNotice({
                        type: 'err',
                        text: res.error || 'Không thể bỏ tiền vào hòm lúc này.',
                      });
                    }
                  }}
                  disabled={donationBusy}
                  className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 py-2.5 px-2 text-xs font-black text-slate-950 shadow-lg hover:brightness-105 active:scale-95 cursor-pointer"
                >
                  🙏 Bỏ tiền Công Đức
                </button>
                <button
                  type="button"
                  disabled={donationBusy || donationBox.totalVnd <= 0}
                  onClick={async () => {
                    if (donationRequest.current) return;
                    donationRequest.current = true;
                    setDonationBusy(true);
                    const entered = Math.round(Number(donationAmountDraft) || 0);
                    const amount = entered > 0 ? Math.min(entered, donationBox.totalVnd) : donationBox.totalVnd;
                    const res = await onRobDonationBox(amount).finally(() => {
                      donationRequest.current = false;
                      setDonationBusy(false);
                    });
                    if (res.ok) {
                      setDonationNotice({
                        type: 'err',
                        text: `🥷 Bạn vừa cướp ${formatVnd(res.robbedVnd ?? 0)} từ Hòm Công Đức!`,
                      });
                    } else {
                      setDonationNotice({
                        type: 'err',
                        text: res.error || 'Không thể cướp tiền lúc này.',
                      });
                    }
                  }}
                  className="w-full rounded-2xl border border-rose-400/50 bg-rose-600/85 hover:bg-rose-500 disabled:opacity-40 py-2.5 px-2 text-xs font-black text-white shadow-lg active:scale-95 cursor-pointer"
                >
                  🥷 {donationBox.totalVnd > 0 ? 'Cướp hòm' : 'Hòm trống'}
                </button>
              </div>
            </div>

            {donationBox.donations.length > 0 && (
              <div className="space-y-1.5 border-t border-amber-500/20 pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200/70">
                  Biến động Hòm Công Đức
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                  {donationBox.donations.slice(0, 10).map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-xl bg-white/5 px-2.5 py-1 text-[11px]"
                    >
                      <span className="font-bold text-amber-100 truncate">
                        {d.kind === 'rob' ? `🥷 ${d.donorNickname} (Cướp)` : `🙏 ${d.donorNickname}`}
                      </span>
                      <span
                        className={`font-black shrink-0 ${
                          d.kind === 'rob' ? 'text-rose-400' : 'text-amber-300'
                        }`}
                      >
                        {d.kind === 'rob'
                          ? `-${formatVnd(d.amountVnd)} (-5 CĐ)`
                          : `+${formatVnd(d.amountVnd)} (+${d.meritAwarded} CĐ)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

