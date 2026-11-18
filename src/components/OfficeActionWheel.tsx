import { useEffect, useId, useRef } from 'react';
import { OFFICE_SHOP, type OfficeAction } from '../utils/officeShop';

interface Props {
  actions: OfficeAction[];
  onSelect: (action: OfficeAction) => void;
  onClose: () => void;
}

export function OfficeActionWheel({ actions, onSelect, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const heading = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby={heading}
      className="m-auto max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] rounded-full border border-violet-300/35 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/60"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="relative flex aspect-square w-[min(18.5rem,calc(100vw-1rem),calc(100dvh-1rem))] items-center justify-center rounded-full bg-gradient-to-br from-violet-950 via-slate-950 to-slate-900">
        <div aria-hidden="true" className="pointer-events-none absolute inset-[13.5%] rounded-full border border-violet-300/25" />
        <div className="relative z-10 text-center">
          <h2 id={heading} className="text-sm font-black text-violet-100">Hiệu ứng</h2>
          {!actions.length && <p className="mx-auto mt-2 max-w-36 text-xs text-slate-300">Bạn chưa sở hữu hiệu ứng nào.</p>}
          <button type="button" onClick={onClose} autoFocus
            className="mt-2 min-h-8 rounded-full border border-white/20 px-2.5 text-xs font-semibold text-slate-200 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300">
            Đóng
          </button>
        </div>
        {actions.map((id, index) => {
          const angle = index * 2 * Math.PI / actions.length - Math.PI / 2;
          const item = OFFICE_SHOP[id];
          return <button key={id} type="button" onClick={() => onSelect(id)}
            style={{ left: (50 + 35.5 * Math.cos(angle)) + '%', top: (50 + 35.5 * Math.sin(angle)) + '%' }}
            className="absolute flex h-[25%] w-[25%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full border border-violet-300/50 bg-violet-700 px-1 text-center text-[10px] font-bold leading-tight text-white shadow-lg hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200 active:scale-95">
            <span className="text-lg leading-none" aria-hidden="true">{item.icon}</span>
            <span>{item.name}</span>
          </button>;
        })}
      </div>
    </dialog>
  );
}
