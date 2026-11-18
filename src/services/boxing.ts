import { useCallback, useEffect, useRef, useState } from 'react';
import { isUsingStaticFallback, officeApiUrl } from './officeApi';
import { USE_OFFICE_WEBSOCKET } from './zenAltar';
import { BOXING, type BoxingView, type BoxingZone } from '../utils/boxing';
import type { ScenePoint } from '../utils/officeShop';

export const BOXING_UPDATE_EVENT = 'office-boxing-updated';
const HIT_KEY = 'KeyF';

export function useBoxing(room: string | undefined, token: string | undefined, zone: BoxingZone, enabled: boolean,
  onSpend: () => void) {
  const [view, setView] = useState<BoxingView | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const position = useRef<ScenePoint | null>(null);
  const last = useRef<{ zone: BoxingZone; x: number; z: number; at: number }>();
  const inFlight = useRef<Promise<boolean> | null>(null);
  const generation = useRef(0);
  const strikeAt = useRef(0);
  const striking = useRef(false);
  const feedbackTimer = useRef<number>();
  const spend = useRef(onSpend);
  spend.current = onSpend;
  const real = Boolean(room && token && !isUsingStaticFallback());

  const setPosition = useCallback((point: ScenePoint) => { position.current = point; }, []);
  const accept = useCallback((next: BoxingView, personal: boolean) => {
    const offset = Date.now() - next.serverTime;
    const message = { ...next, hits: next.hits.map((hit) => ({ ...hit, at: hit.at + offset })),
      fishRecoverAt: next.fishRecoverAt ? next.fishRecoverAt + offset : 0 };
    setView((current) => {
      if (!current) return message;
      if (current.serverTime > next.serverTime) return personal ? { ...current, merit: next.merit } : current;
      return personal ? message : { ...message, merit: current.merit };
    });
  }, []);

  const request = useCallback(async (body?: Record<string, unknown>) => {
    if (!room || !token || !real) return;
    const number = generation.current;
    const response = await fetch(officeApiUrl('/api/rooms/' + encodeURIComponent(room) + '/boxing'), {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + token, ...(body && { 'Content-Type': 'application/json' }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json() as BoxingView & { message?: string };
    if (number !== generation.current) return;
    if (!response.ok) throw new Error(data.message ?? 'Chưa kết nối được Boxing.');
    accept(data, true);
    setError('');
    return data;
  }, [room, token, real, accept]);

  const sync = useCallback(async (force = false) => {
    if (inFlight.current) await inFlight.current;
    if (!real || (!position.current && zone !== 'away')) return false;
    const [x, , z] = position.current ?? [0, 0, 0];
    const previous = last.current;
    const now = Date.now();
    if (!force && previous && previous.zone === zone &&
      (zone === 'away' || (now - previous.at < 8000 && Math.hypot(previous.x - x, previous.z - z) < 0.15))) return true;
    const pending = request({ action: 'move', zone, x, z }).then((data) => {
      if (data) last.current = { zone, x, z, at: now };
      return Boolean(data);
    }).catch(() => false);
    inFlight.current = pending;
    try { return await pending; }
    finally { if (inFlight.current === pending) inFlight.current = null; }
  }, [request, real, zone]);

  useEffect(() => {
    generation.current++;
    last.current = undefined;
    setView(null);
    setFeedback('');
    if (!real) return;
    const receive = (event: Event) => accept((event as CustomEvent<BoxingView>).detail, false);
    window.addEventListener(BOXING_UPDATE_EVENT, receive);
    return () => {
      window.removeEventListener(BOXING_UPDATE_EVENT, receive);
      window.clearTimeout(feedbackTimer.current);
      generation.current++;
    };
  }, [request, accept, real]);

  useEffect(() => {
    if (!real) return;
    void sync();
    const timer = window.setInterval(() => { if (!document.hidden) void sync(); }, 235);
    const read = () => void request().catch(() => {});
    const poll = !USE_OFFICE_WEBSOCKET && zone !== 'away' ? window.setInterval(read, 700) : undefined;
    if (zone !== 'away') read();
    return () => { window.clearInterval(timer); window.clearInterval(poll); };
  }, [request, sync, real, zone]);

  const punch = useCallback(async () => {
    const now = Date.now();
    if (!enabled || !real || zone === 'away' || striking.current || now - strikeAt.current < BOXING.punchDelayMs) return;
    striking.current = true;
    strikeAt.current = now;
    const id = crypto.randomUUID();
    try {
      if (!await sync(true)) throw new Error('Chưa đồng bộ được vị trí Boxing.');
      const result = await request({ action: 'punch', id });
      const hit = result?.hits.find((event) => event.id === id);
      if (hit) {
        setFeedback(hit.target ? 'Đấm trúng' : 'Đấm hụt');
        window.clearTimeout(feedbackTimer.current);
        feedbackTimer.current = window.setTimeout(() => setFeedback(''), 1800);
        if (zone === 'office' && hit.target) spend.current();
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Chưa kết nối được Boxing.');
    } finally {
      striking.current = false;
    }
  }, [enabled, real, zone, sync, request]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.code !== HIT_KEY || event.repeat || event.defaultPrevented || event.isComposing ||
          event.ctrlKey || event.altKey || event.metaKey ||
          (target instanceof HTMLElement && (target.isContentEditable ||
            target.closest('input, textarea, select, [role="textbox"], dialog')))) return;
      if (enabled && real) { event.preventDefault(); void punch(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [enabled, real, punch]);

  return { view, error, feedback, setPosition, punch, available: real };
}
