import { useState } from 'react';
import { BellOff, Smile, X } from 'lucide-react';
import { OFFICE_MOODS, type OfficeMood, type OfficePresence } from '../utils/officeSocial';

export function OfficePresenceControl({ presence, pending, onChange }: {
  presence?: OfficePresence;
  pending: boolean;
  onChange: (state: OfficePresence) => void;
}) {
  const [open, setOpen] = useState(false);
  const value = presence ?? { doNotDisturb: false, mood: null };
  return <div className="pointer-events-auto relative">
    <button type="button" aria-expanded={open} aria-label="Trạng thái và cảm xúc" title="Trạng thái và cảm xúc"
      onClick={() => setOpen((current) => !current)}
      className="flex h-8 min-w-8 items-center justify-center gap-1 rounded-full border border-white/15 bg-slate-900/90 px-2 text-sm text-white">
      {value.mood ? <span aria-hidden="true">{OFFICE_MOODS[value.mood].icon}</span> : <Smile size={15} />}
      {value.doNotDisturb && <BellOff size={13} className="text-rose-300" />}
    </button>
    {open && <section aria-label="Trạng thái và cảm xúc"
      className="absolute right-0 top-full z-30 mt-2 w-52 rounded-2xl border border-white/15 bg-slate-900 p-2.5 text-xs text-white shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <strong>Trạng thái của bạn</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="Đóng trạng thái"><X size={15} /></button>
      </div>
      <button type="button" aria-pressed={value.doNotDisturb} disabled={pending}
        onClick={() => onChange({ ...value, doNotDisturb: !value.doNotDisturb })}
        className="flex w-full items-center gap-2 rounded-lg bg-white/5 p-2 text-left aria-pressed:bg-rose-700/60">
        <BellOff size={14} /> Không làm phiền
      </button>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {(Object.keys(OFFICE_MOODS) as OfficeMood[]).map((mood) => (
          <button key={mood} type="button" aria-pressed={value.mood === mood} disabled={pending}
            className="rounded-lg bg-white/5 px-2 py-1.5 text-left aria-pressed:bg-violet-700"
            onClick={() => onChange({ ...value, mood: value.mood === mood ? null : mood })}>
            <span aria-hidden="true">{OFFICE_MOODS[mood].icon}</span> {OFFICE_MOODS[mood].label}
          </button>
        ))}
      </div>
    </section>}
  </div>;
}
