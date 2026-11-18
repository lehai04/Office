export const CHAT_STICKERS = [
  { id: 'ua-alo', label: 'Ủa alo?' },
  { id: 'gia-bo-ban', label: 'Đang giả bộ bận' },
  { id: 'coc-nha', label: 'Cọc nha' },
  { id: 'deadline-di', label: 'Deadline dí' },
  { id: 'rep-di-ba', label: 'Rep đi bà' },
  { id: 'luong-ve-chua', label: 'Lương về chưa?' },
  { id: 'nghi-som', label: 'Xin vía nghỉ sớm' },
  { id: 'di-an-hong', label: 'Đi ăn hong?' },
  { id: 'tui-lay', label: 'Tui lạy' },
  { id: 'tha-tym', label: 'Thả tym' },
  { id: 'het-cong-duc', label: 'Hết công đức' },
  { id: 'cuoi-lan-lon', label: 'Cười lăn lộn' },
  { id: 'nup-thung', label: 'Núp thùng' },
  { id: 'mua-xu', label: 'Mưa xu' },
  { id: 'cung-do', label: 'Cứng đơ' },
  { id: 'ngu-guc', label: 'Ngủ gục' },
  { id: 'tra-sua', label: 'Trà sữa' },
  { id: 'tui-a', label: 'Tui á?' },
  { id: 'hong-drama', label: 'Hóng drama' },
  { id: 'gio-ngon-cai', label: 'Giơ ngón cái' },
  { id: 'lui-ghe', label: 'Lùi ghế' },
] as const;

export type ChatSticker = (typeof CHAT_STICKERS)[number];

export function chatStickerContent(sticker: ChatSticker): string {
  return `[[office-sticker:${sticker.id}]]`;
}

export function getChatSticker(content: string): ChatSticker | undefined {
  if (!content.startsWith('[[office-sticker:')) return;
  return CHAT_STICKERS.find((sticker) => chatStickerContent(sticker) === content);
}

export function chatStickerPreview(content: string): string {
  const sticker = getChatSticker(content);
  return sticker ? `🖼️ Sticker · ${sticker.label}` : content;
}
