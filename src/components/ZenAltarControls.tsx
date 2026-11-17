import { useEffect, useRef, useState } from 'react';
import { ALTAR_UPDATE_EVENT, requestAltar, USE_OFFICE_WEBSOCKET, type AltarCommand } from '../services/zenAltar';
import { isUsingStaticFallback } from '../services/officeApi';
import { ALTAR_CAPACITY, REPLACE_MERIT, type AltarKind, type AltarView } from '../utils/zenAltar';

interface Props {
  roomCode: string;
  token: string;
  userId: string;
  incense: number;
  offerings: number;
  onBuy: () => void;
  onCompletion: (kind: AltarKind) => void;
  onChange: (view: AltarView | null) => void;
  onToast: (message: string) => void;
}

export function ZenAltarControls({ roomCode, token, userId, incense, offerings, onBuy, onCompletion, onChange, onToast }: Props) {
  const [view, setView] = useState<AltarView | null>(null);
  const [error, setError] = useState('');
  const [chooseTray, setChooseTray] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const newestView = useRef(0);
  const pendingKey = `office-altar-pending:${roomCode}:${userId}`;
  const [savedPending] = useState(() => sessionStorage.getItem(pendingKey));
  const pending = useRef<string | null>(savedPending);
  const notifiedFull = useRef(false);
  const callbacks = useRef({ onCompletion, onChange, onToast });
  callbacks.current = { onCompletion, onChange, onToast };

  const accept = (snapshot: AltarView & { error?: string }, reportError = false) => {
    if (snapshot.serverTime < newestView.current) return;
    newestView.current = snapshot.serverTime;
    setView(snapshot);
    callbacks.current.onChange(snapshot);
    if (reportError) setError(snapshot.error ?? '');
    if (snapshot.canClear && snapshot.trays.length >= ALTAR_CAPACITY) {
      if (!notifiedFull.current) callbacks.current.onToast('Bàn thờ đã đủ 5 mâm lễ.');
      notifiedFull.current = true;
    } else {
      notifiedFull.current = false;
    }
    const result = snapshot.recentResults.find((item) => item.id === pending.current);
    if (result) {
      pending.current = null;
      sessionStorage.removeItem(pendingKey);
      if (result.ok) callbacks.current.onCompletion(result.kind);
      callbacks.current.onToast(result.message);
    }
  };

  useEffect(() => {
    if (isUsingStaticFallback()) {
      setError('Nghi thức chung cần máy chủ Office để đồng bộ bàn thờ.');
      return;
    }
    const controller = new AbortController();
    let timer: number | undefined;
    let refreshing = false;
    let refreshAgain = false;
    const poll = async () => {
      if (refreshing) {
        refreshAgain = true;
        return;
      }
      refreshing = true;
      try {
        const state = await requestAltar(roomCode, token, undefined, controller.signal);
        if (!controller.signal.aborted) accept(state);
      } catch (problem) {
        if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : 'Chưa kết nối được bàn thờ.');
      } finally {
        refreshing = false;
        if (controller.signal.aborted) return;
        if (refreshAgain) {
          refreshAgain = false;
          void poll();
        } else if (!USE_OFFICE_WEBSOCKET) {
          timer = window.setTimeout(poll, 500);
        }
      }
    };
    if (USE_OFFICE_WEBSOCKET) window.addEventListener(ALTAR_UPDATE_EVENT, poll);
    void poll();
    return () => {
      controller.abort();
      window.removeEventListener(ALTAR_UPDATE_EVENT, poll);
      window.clearTimeout(timer);
      callbacks.current.onChange(null);
    };
  }, [roomCode, token]);

  const busy = sending || Boolean(view?.rituals.some((ritual) => ritual.userId === userId));
  const full = (view?.trays.length ?? 0) >= ALTAR_CAPACITY;
  const selected = view?.trays.find((tray) => tray.id === selectedId && tray.userId !== userId);

  useEffect(() => {
    if (full) return;
    setChooseTray(false);
    setSelectedId(null);
  }, [full]);

  const send = async (command: AltarCommand) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError('');
    if (command.action === 'start') {
      pending.current = command.id;
      sessionStorage.setItem(pendingKey, command.id);
    }
    try {
      const snapshot = await requestAltar(roomCode, token, command);
      accept(snapshot, true);
      if (command.action === 'start' && snapshot.error) {
        pending.current = null;
        sessionStorage.removeItem(pendingKey);
      }
      if (command.action === 'start' && !snapshot.error) {
        setChooseTray(false);
        setSelectedId(null);
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Chưa kết nối được bàn thờ.');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  const begin = (kind: AltarKind, targetId?: string) => {
    if (busy || !view) return;
    if ((kind === 'incense' ? incense : offerings) < 1) return onBuy();
    if (kind === 'offering' && full && !targetId) {
      setChooseTray(true);
      return;
    }
    void send({ action: 'start', kind, targetId, id: crypto.randomUUID() });
  };

  const button = 'rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold hover:bg-white/20 disabled:opacity-50';
  return (
    <section aria-label="Nghi thức bàn thờ" className="pointer-events-auto fixed left-3 top-14 z-40 max-h-[65dvh] w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-amber-400/30 bg-slate-950/95 p-3 text-xs text-white shadow-lg">
      <div className="flex justify-between gap-2">
        <strong>Bàn thờ · {view?.trays.length ?? '—'}/5 mâm</strong>
        {view && <span>{view.merit} công đức</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={button} disabled={!view || busy} onClick={() => begin('incense')}>Thắp nhang ({incense})</button>
        <button type="button" className={button} disabled={!view || busy} onClick={() => begin('offering')}>Dâng lễ ({offerings})</button>
        {view?.canClear && full && <button type="button" className={button} disabled={busy} onClick={() => void send({ action: 'clear' })}>Dọn mâm lễ</button>}
      </div>
      {full && view?.canClear && <p role="status" className="mt-2 text-amber-300">Bàn thờ đã đủ 5 mâm lễ. Trụ trì có thể dọn mâm.</p>}
      {chooseTray && full && (
        <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
          <p>Bàn thờ đã đủ 5 mâm lễ.</p>
          <button type="button" className={button} onClick={() => { setChooseTray(false); setSelectedId(null); }}>Chờ Trụ trì dọn</button>
          {[...(view?.trays ?? [])].sort((a, b) => a.slot - b.slot).map((tray) => (
            <button key={tray.id} type="button" aria-pressed={tray.id === selectedId}
              disabled={tray.userId === userId || busy}
              className={`${button} block w-full text-left aria-pressed:bg-amber-700`}
              onClick={() => setSelectedId(tray.id)}>
              Đá mâm lễ của {tray.nickname} · vị trí {tray.slot + 1}
            </button>
          ))}
          <p>Mỗi lần đá mâm lễ tốn 50 công đức.</p>
          {selectedId && !selected && <p className="text-amber-300">Mâm đã thay đổi. Hãy chọn lại.</p>}
          {selected && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={button} disabled={busy || (view?.merit ?? 0) < REPLACE_MERIT}
                onClick={() => begin('offering', selected.id)}>Xác nhận đá mâm lễ (−50 công đức)</button>
              <button type="button" className={button} onClick={() => setSelectedId(null)}>Hủy</button>
              {(view?.merit ?? 0) < REPLACE_MERIT && <p className="text-amber-300">Bạn cần ít nhất 50 công đức.</p>}
            </div>
          )}
        </div>
      )}
      {busy && <p className="mt-2" role="status">Đang thực hiện nghi thức…</p>}
      {error && <p className="mt-2 text-amber-300" role="status">{error}</p>}
    </section>
  );
}
