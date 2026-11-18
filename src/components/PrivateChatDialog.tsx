import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { LockKeyhole, Send, X } from 'lucide-react';
import { officeSocialRequest, type PrivateChatView } from '../services/officeSocial';
import { PRIVATE_CHAT_EVENT, type PrivateChatGroup, type PrivateChatInvite } from '../utils/officeSocial';
import { getChatSticker } from '../utils/chatStickers';
import { ChatStickerImage, ChatStickerPicker } from './ChatStickerPicker';

interface Props {
  room: string; token: string; userId: string; onClose: () => void;
  embedded?: boolean;
  initialCode?: string;
  people?: { userId: string; nickname: string }[];
  onJoined?: (code: string) => void;
}

const inputClass = 'h-11 min-w-0 rounded-lg border border-white/15 bg-slate-950 px-3 text-sm text-white focus-visible:outline-violet-300';
const buttonClass = 'min-h-10 rounded-lg bg-violet-700 px-3 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50';

export function PrivateChatDialog({ room, token, userId, onClose, embedded = false, initialCode = '', people = [], onJoined }: Props) {
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const version = useRef(0);
  const [groups, setGroups] = useState<PrivateChatGroup[]>([]);
  const [selected, setSelected] = useState(initialCode);
  const [invites, setInvites] = useState<PrivateChatInvite[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteUser, setInviteUser] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState<PrivateChatView>();
  const [mode, setMode] = useState<'groups' | 'create' | 'join'>('groups');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (embedded) return;
    const panel = dialog.current;
    panel?.showModal();
    return () => { panel?.close(); };
  }, [embedded]);

  useEffect(() => {
    const controller = new AbortController();
    let refreshTimer: number | undefined;
    const refresh = async () => {
      const revision = ++version.current;
      try {
        if (selected) {
          const opened = await officeSocialRequest<PrivateChatView>(room, token, 'private-chat?group=' + encodeURIComponent(selected), undefined, controller.signal);
          if (!controller.signal.aborted && revision === version.current) setView(opened);
        } else {
          const list = await officeSocialRequest<{ groups: PrivateChatGroup[]; invites?: PrivateChatInvite[] }>(room, token, 'private-chat', undefined, controller.signal);
          if (!controller.signal.aborted && revision === version.current) {
            setGroups(list.groups);
            setInvites(list.invites ?? []);
          }
        }
      } catch (problem) {
        if (!controller.signal.aborted && revision === version.current) setError(problem instanceof Error ? problem.message : 'Chưa tải được chat nhóm.');
      }
    };
    const onUpdate = (event: Event) => {
      if (selected && (event as CustomEvent<string>).detail !== selected) return;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refresh(), 100);
    };
    void refresh();
    window.addEventListener(PRIVATE_CHAT_EVENT, onUpdate);
    const interval = window.setInterval(() => { if (!document.hidden && !pending.current) void refresh(); }, 15_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.clearTimeout(refreshTimer);
      window.removeEventListener(PRIVATE_CHAT_EVENT, onUpdate);
    };
  }, [room, token, selected]);

  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [view?.messages.at(-1)?.id]);

  const open = (code: string) => {
    setView(undefined);
    setSelected(code);
    setDraft('');
    setError('');
    setMode('groups');
  };

  const changeMode = (next: typeof mode) => {
    setError('');
    setMode(next);
  };

  const submit = async (body: Record<string, unknown>, clearDraft = true) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await officeSocialRequest<PrivateChatView>(room, token, 'private-chat', body);
      version.current++;
      setView(updated);
      setSelected(updated.group.code);
      setMode('groups');
      if (body.action === 'create' || body.action === 'join') onJoined?.(updated.group.code);
      if (body.action === 'invite') {
        setNotice('Đã gửi lời mời. Người được mời sẽ cần mật khẩu nhóm.');
        setInviteUser('');
      } else if (clearDraft) setDraft('');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Chưa thực hiện được thao tác.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const submitAccess = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fields = mode === 'create' ? { name: data.get('name') } : { code: data.get('code') };
    void submit({ action: mode, ...fields, password: data.get('password') });
  };

  const content = <section className={embedded ? "flex min-h-0 flex-1 flex-col" : "flex max-h-[85dvh] min-h-[20rem] flex-col"}>
      {!embedded && <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
        <h2 id={title} className="flex items-center gap-2 font-bold"><LockKeyhole size={17} /> Nhóm chat riêng</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Đóng nhóm chat"><X size={18} /></button>
      </header>}
      {selected ? <>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
          {!embedded && <button type="button" onClick={() => open('')} className="text-sm text-violet-200" disabled={busy}>← Danh sách nhóm</button>}
          {view && <span className="select-text text-xs text-slate-300">Mã nhóm <strong className="font-mono text-white">{view.group.code}</strong></span>}
        </div>
        {view && people.length > 0 && <form className="flex gap-2 px-3 pt-2" onSubmit={(event) => {
          event.preventDefault();
          if (inviteUser) void submit({ action: 'invite', code: selected, userId: inviteUser });
        }}>
          <select value={inviteUser} onChange={(event) => setInviteUser(event.target.value)} aria-label="Chọn đồng nghiệp để mời"
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-950 p-2 text-xs">
            <option value="">Mời đồng nghiệp…</option>
            {people.filter((person) => person.userId !== userId).map((person) =>
              <option key={person.userId} value={person.userId}>{person.nickname}</option>)}
          </select>
          <button type="submit" disabled={!inviteUser || busy} className={buttonClass}>Mời</button>
        </form>}
        <div ref={scroll} className="min-h-40 flex-1 overflow-y-auto px-4 py-3">
          <h3 className="mb-3 break-words font-semibold">{view?.group.name ?? 'Đang tải nhóm…'}</h3>
          {view?.messages.length === 0 && <p className="text-sm text-slate-400">Nhóm chưa có tin nhắn.</p>}
          <ul className="space-y-3">
            {view?.messages.map((message) => {
              const sticker = getChatSticker(message.content);
              return <li key={message.userId + ':' + message.id}
                className={message.userId === userId ? 'text-right' : ''}>
                <p className="mb-1 text-xs font-semibold text-violet-200">{message.userId === userId ? 'Bạn' : message.nickname}</p>
                {sticker ? (
                  <span className="inline-block w-36 max-w-[85%]"><ChatStickerImage sticker={sticker} /></span>
                ) : (
                  <p className="inline-block max-w-[85%] whitespace-pre-wrap break-words rounded-xl bg-white/10 px-3 py-2 text-left text-sm">{message.content}</p>
                )}
              </li>;
            })}
          </ul>
        </div>
        <form className="relative flex items-center gap-2 border-t border-white/10 p-3" onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) void submit({ action: 'send', code: selected, content: draft, id: crypto.randomUUID() });
        }}>
          <ChatStickerPicker disabled={busy || !view} onSend={(content) => {
            void submit({ action: 'send', code: selected, content, id: crypto.randomUUID() }, false);
          }} />
          <input className={inputClass + ' flex-1'} aria-label="Tin nhắn nhóm riêng" placeholder="Nhắn vào nhóm…" value={draft}
            onChange={(event) => setDraft(event.target.value)} maxLength={1000} />
          <button type="submit" className={buttonClass} disabled={busy || !view || !draft.trim()} aria-label="Gửi vào nhóm"><Send size={17} /></button>
        </form>
      </> : <div className="overflow-y-auto p-4">
        <nav aria-label="Thao tác nhóm" className="mb-4 flex flex-wrap gap-2">
          {([['groups', 'Nhóm của tôi'], ['create', 'Tạo nhóm'], ['join', 'Tham gia']] as const).map(([key, label]) =>
            <button key={key} type="button" onClick={() => changeMode(key)} disabled={busy} aria-pressed={mode === key}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm aria-pressed:bg-violet-700">{label}</button>)}
        </nav>
        {mode === 'groups' && invites.length > 0 && <ul className="mb-3 space-y-2">
          {invites.map((invite) => <li key={invite.code}>
            <button type="button" onClick={() => { setInviteCode(invite.code); changeMode('join'); }}
              className="w-full rounded-lg bg-violet-800/40 p-3 text-left text-xs">
              {invite.from} mời bạn vào <strong>{invite.name}</strong>
            </button>
          </li>)}
        </ul>}
        {mode === 'groups' ? (
          groups.length ? <ul className="space-y-2">{groups.map((group) => <li key={group.code}>
            <button type="button" onClick={() => open(group.code)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/5 p-3 text-left text-sm hover:bg-white/10">
              <strong className="break-words">{group.name}</strong><small className="shrink-0 text-slate-300">{group.memberCount} người</small>
            </button>
          </li>)}</ul> : <p className="text-sm text-slate-400">Bạn chưa tham gia nhóm riêng nào.</p>
        ) : <form key={mode} onSubmit={submitAccess} className="grid gap-3">
          <label className="grid gap-1 text-sm">{mode === 'create' ? 'Tên nhóm' : 'Mã nhóm'}
            <input className={inputClass} name={mode === 'create' ? 'name' : 'code'} maxLength={mode === 'create' ? 50 : 12} defaultValue={mode === 'join' ? inviteCode : undefined} required />
          </label>
          <label className="grid gap-1 text-sm">Mật khẩu nhóm
            <input className={inputClass} name="password" type="password" autoComplete="off" minLength={4} maxLength={64} required />
          </label>
          <button type="submit" className={buttonClass} disabled={busy}>{mode === 'create' ? 'Tạo nhóm riêng' : 'Vào nhóm'}</button>
        </form>}
      </div>}
      {notice && <p role="status" className="px-4 py-1 text-xs text-violet-200">{notice}</p>}
      {error && <p role="alert" className="px-4 pb-3 text-sm text-rose-200">{error}</p>}
    </section>;
  if (embedded) return content;
  return <dialog ref={dialog} aria-labelledby={title}
    className="m-auto max-h-[90dvh] w-[min(34rem,calc(100vw-1rem))] rounded-2xl border border-white/15 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/70"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    {content}
  </dialog>;
}
