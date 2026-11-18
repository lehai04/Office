import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, Check, Smile, X } from 'lucide-react';
import { OFFICE_MOODS, type OfficeMood, type OfficePresence } from '../utils/officeSocial';
import { PixelMoodIcon } from './PixelMoodIcon';
import './officeMood.css';

const moods = Object.keys(OFFICE_MOODS) as OfficeMood[];
const defaultPresence: OfficePresence = { doNotDisturb: false, mood: null };

export function MoodPicker({ id, value, pending, onSelect, onClose }: {
  id: string;
  value: OfficeMood | null;
  pending: boolean;
  onSelect: (mood: OfficeMood | null) => void;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeButton.current?.focus({ preventScroll: true }); }, []);
  return <section className="office-mood-picker" id={id} role="dialog" aria-labelledby={id + '-title'}
    onKeyDown={(event) => { if (event.key.length === 1) event.stopPropagation(); }}>
    <header className="office-mood-heading">
      <h2 id={id + '-title'}>Cảm xúc</h2>
      <button ref={closeButton} type="button" aria-label="Đóng bảng cảm xúc" className="office-mood-close" onClick={onClose}><X size={21} strokeWidth={3} /></button>
    </header>
    <div className="office-mood-grid">
      {moods.map((mood) => (
        <button key={mood} type="button" aria-pressed={value === mood} disabled={pending}
          className="office-mood-option" onClick={() => onSelect(mood)}>
          {value === mood && <span aria-hidden="true" className="office-mood-check"><Check size={13} strokeWidth={3} /></span>}
          <PixelMoodIcon mood={mood} className="office-mood-face" />
          <span>{OFFICE_MOODS[mood].label}</span>
        </button>
      ))}
    </div>
    <button type="button" className="office-mood-clear" disabled={pending || value === null} onClick={() => onSelect(null)}>
      Xóa cảm xúc
    </button>
  </section>;
}

export function OfficePresenceControl({ presence, pending, onChange }: {
  presence?: OfficePresence;
  pending: boolean;
  onChange: (state: OfficePresence) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  const root = useRef<HTMLDivElement>(null);
  const portal = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const value = presence ?? defaultPresence;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const change = () => setMobile(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && !portal.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', key);
    };
  }, [open, mobile]);

  const panel = open && <MoodPicker id={id} value={value.mood} pending={pending}
    onSelect={(mood) => { if (mood !== value.mood) onChange({ ...value, mood }); }} onClose={close} />;

  return <div ref={root} className="pointer-events-auto relative flex shrink-0 gap-1">
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog"
      aria-label="Cảm xúc" title="Cảm xúc" onClick={() => setOpen((current) => !current)}
      className="flex h-8 items-center justify-center gap-1 rounded-full border border-white/15 bg-slate-900/90 px-2 text-xs font-bold text-white">
      {value.mood ? <PixelMoodIcon mood={value.mood} className="h-4 w-4" /> : <Smile size={16} />}
      <span className="hidden sm:inline">Cảm xúc</span>
    </button>
    <button type="button" aria-label="Không làm phiền" aria-pressed={value.doNotDisturb} title="Không làm phiền"
      disabled={pending} onClick={() => onChange({ ...value, doNotDisturb: !value.doNotDisturb })}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-slate-900/90 text-slate-200 aria-pressed:border-rose-400/70 aria-pressed:bg-rose-950 aria-pressed:text-rose-200">
      {value.doNotDisturb ? <BellOff size={15} /> : <Bell size={15} />}
    </button>
    {mobile && open ? createPortal(
      <div ref={portal} className="office-mood-sheet">
        <button className="office-mood-overlay" type="button" onClick={close} aria-label="Đóng bảng cảm xúc" tabIndex={-1} />
        {panel}
      </div>, document.body) : panel}
  </div>;
}
