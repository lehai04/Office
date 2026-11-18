import { useId, useRef, useState } from 'react';
import { Sticker } from 'lucide-react';
import stickerSheet from '../assets/chat-stickers-pink-cat.png';
import { CHAT_STICKERS, chatStickerContent, type ChatSticker } from '../utils/chatStickers';

const columns = [0, 442, 872, 1312];
const rows = [0, 421, 805, 1199];

export function ChatStickerImage({ sticker, decorative = false }: {
  sticker: ChatSticker;
  decorative?: boolean;
}) {
  const index = CHAT_STICKERS.indexOf(sticker);
  const column = index % 3;
  const row = Math.floor(index / 3);
  const width = columns[column + 1] - columns[column];
  const height = rows[row + 1] - rows[row];

  return (
    <span className="relative block w-full overflow-hidden" style={{ aspectRatio: width / height }}>
      <img
        src={stickerSheet}
        alt={decorative ? '' : sticker.label}
        draggable={false}
        className="pointer-events-none absolute max-w-none"
        style={{
          width: `${1312 / width * 100}%`,
          left: `${-columns[column] / width * 100}%`,
          top: `${-rows[row] / height * 100}%`,
        }}
      />
    </span>
  );
}

export function ChatStickerPicker({ disabled, onSend }: {
  disabled: boolean;
  onSend: (content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerId = useId();
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <div
      className="shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label="Sticker"
        title="Sticker"
        aria-expanded={open}
        aria-controls={open ? pickerId : undefined}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-pink-300 hover:bg-pink-500/20 aria-expanded:bg-pink-500/20 disabled:opacity-50"
      >
        <Sticker size={21} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={pickerId}
          role="group"
          aria-label="Sticker mèo hồng"
          className="absolute bottom-full left-3 right-3 z-10 mb-2 grid max-w-64 grid-cols-3 gap-1 rounded-2xl border border-pink-300/25 bg-slate-950 p-2 shadow-2xl"
        >
          {CHAT_STICKERS.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              disabled={disabled}
              aria-label={`Gửi sticker ${sticker.label}`}
              title={sticker.label}
              className="min-w-0 rounded-lg p-1 hover:bg-white/10 focus-visible:outline focus-visible:outline-pink-300 disabled:opacity-50"
              onClick={() => {
                setOpen(false);
                onSend(chatStickerContent(sticker));
              }}
            >
              <ChatStickerImage sticker={sticker} decorative />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
