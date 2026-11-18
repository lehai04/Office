import { useCallback, useEffect, useRef, useState } from 'react';
import { isUsingStaticFallback, officeApiUrl } from './officeApi';
import { USE_OFFICE_WEBSOCKET } from './zenAltar';
import { BOXING, FISH_ID, type BoxingView, type BoxingZone } from '../utils/boxing';
import type { ScenePoint } from '../utils/officeShop';

export const BOXING_UPDATE_EVENT = 'office-boxing-updated';
const HIT_KEY = 'KeyF';

export function useBoxing(room: string | undefined, token: string | undefined, userId: string | undefined,
  zone: BoxingZone, enabled: boolean, playerName: (id: string) => string) {
  const [view, setView] = useState<BoxingView | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [recentlyHit, setRecentlyHit] = useState(false);
  const position = useRef<ScenePoint | null>(null);
  const last = useRef<{ zone: BoxingZone; x: number; z: number; at: number }>();
  const inFlight = useRef<Promise<boolean> | null>(null);
  const generation = useRef(0);
  const strikeAt = useRef(0);
  const striking = useRef(false);
  const feedbackTimer = useRef<number>();
  const impactTimer = useRef<number>();
  const handled = useRef(new Set<string>());
  const lookup = useRef(playerName);
  lookup.current = playerName;
  const real = Boolean(room && token && !isUsingStaticFallback());

  const setPosition = useCallback((point: ScenePoint) => { position.current = point; }, []);
  const notify = useCallback((message: string) => {
    setFeedback(message);
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(''), 2600);
  }, []);
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
    handled.current.clear();
    setView(null);
    setFeedback('');
    setRecentlyHit(false);
    if (!real) return;
    const receive = (event: Event) => accept((event as CustomEvent<BoxingView>).detail, false);
    window.addEventListener(BOXING_UPDATE_EVENT, receive);
    return () => {
      window.removeEventListener(BOXING_UPDATE_EVENT, receive);
      window.clearTimeout(feedbackTimer.current);
      window.clearTimeout(impactTimer.current);
      generation.current++;
    };
  }, [request, accept, real]);

  useEffect(() => {
    if (!view || !userId) return;
    const incoming = view.hits.filter((hit) => hit.target === userId &&
      hit.attacker !== userId && !handled.current.has(hit.id));
    if (!incoming.length) return;
    if (handled.current.size > 128) handled.current.clear();
    for (const hit of incoming) handled.current.add(hit.id);
    const lastHit = incoming.at(-1)!;
    const ownHit = view.hits.some((hit) => hit.attacker === userId && hit.target === FISH_ID && hit.id + '-fish' === lastHit.id);
    notify(lastHit.attacker === FISH_ID
      ? ownHit ? `Trúng Cá · −${BOXING.damage} máu · Cá đấm trả!` : 'Cá Dọn Bể vừa đấm trả bạn!'
      : `${lookup.current(lastHit.attacker)} vừa đấm trúng bạn!`);
    setRecentlyHit(true);
    window.clearTimeout(impactTimer.current);
    impactTimer.current = window.setTimeout(() => setRecentlyHit(false), 420);
  }, [view, userId, notify]);

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
      if (hit?.target === FISH_ID) {
        const retaliated = result?.hits.some((event) => event.id === id + '-fish' && event.target === userId);
        notify(result?.fishHp === 0 ? 'Cá Dọn Bể đã gục!' : retaliated ?
          `Trúng Cá · −${BOXING.damage} máu · Cá đấm trả!` : `Trúng Cá Dọn Bể · −${BOXING.damage} máu`);
      } else if (hit?.target) {
        const cost = result?.fighters[hit.attacker]?.zone === 'office' ? ` · −${BOXING.officeMeritCost} công đức` : '';
        notify(`Đã đấm trúng ${lookup.current(hit.target)}${cost}`);
      } else if (hit) notify('Đấm hụt');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Chưa kết nối được Boxing.');
    } finally {
      striking.current = false;
    }
  }, [enabled, real, zone, sync, request, notify, userId]);

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

  return { view, error, feedback, recentlyHit, setPosition, punch, available: real };
}
