import { DurableObject } from 'cloudflare:workers';
import { timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  authorizeOfficeRealtime, configureOfficeStorage, handleApiRequest, importVggRoom, publishOfficePresence, settleOfficeAlarms,
  removeBoxingPresence, auditVggMeritBatch,
  type OfficeRealtimeMember,
} from '../server/officeServer';

interface Env {
  OFFICE_STATE: DurableObjectNamespace<OfficeState>;
  OFFICE_WEB_ORIGIN: string;
  OFFICE_VGG_IMPORT_TOKEN?: string;
  OFFICE_VGG_MERIT_TOKEN?: string;
}

type Attachment = OfficeRealtimeMember & { inZen: boolean };
const STORAGE_CHUNK = 128 * 1024;
const MAX_REQUEST_BYTES = 64 * 1024;

async function dispatchHttp(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const chunks: Buffer[] = [];
  if (request.body) {
    const reader = request.body.getReader();
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_REQUEST_BYTES) {
          await reader.cancel();
          return Response.json({ error: 'REQUEST_TOO_LARGE', message: 'Yêu cầu vượt quá dung lượng cho phép.' }, { status: 413 });
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
  }
  const req = Object.assign(Readable.from(chunks, { objectMode: false }), {
    url: url.pathname + url.search,
    method: request.method,
    headers: Object.fromEntries(request.headers),
  }) as unknown as IncomingMessage;
  const headers = new Headers();
  let response: Response | undefined;
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) { headers.set(name, value); return this; },
    end(body?: string) { response = new Response(body, { status: this.statusCode, headers }); },
  };
  try {
    const handled = await handleApiRequest(req, res as unknown as ServerResponse);
    if (handled && response) return response;
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  } catch {
    return Response.json({ error: 'OFFICE_ERROR', message: 'Không xử lý được yêu cầu Office.' }, { status: 500 });
  }
}

export class OfficeState extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS office_snapshot (part INTEGER PRIMARY KEY, data BLOB NOT NULL)');
    const saved = ctx.storage.sql.exec<{ data: ArrayBuffer }>('SELECT data FROM office_snapshot ORDER BY part').toArray();
    const previous = saved.length ? Buffer.concat(saved.map(({ data }) => Buffer.from(data))).toString('utf8') : undefined;
    configureOfficeStorage({
      save: (database) => {
        const bytes = Buffer.from(database, 'utf8');
        ctx.storage.transactionSync(() => {
          ctx.storage.sql.exec('DELETE FROM office_snapshot');
          for (let start = 0; start < bytes.length; start += STORAGE_CHUNK) {
            ctx.storage.sql.exec('INSERT INTO office_snapshot (part, data) VALUES (?, ?)',
              start / STORAGE_CHUNK, Uint8Array.from(bytes.subarray(start, start + STORAGE_CHUNK)).buffer);
          }
        });
      },
      broadcast: (roomId, event, filter) => {
        const message = JSON.stringify(event);
        for (const socket of ctx.getWebSockets(roomId)) {
          const member = socket.deserializeAttachment() as Attachment;
          if (socket.readyState === WebSocket.OPEN && (!filter || filter(member))) socket.send(message);
        }
      },
      isOnline: (roomId, userId) => this.memberSockets(roomId, userId).length > 0,
      zenStatus: (roomId, userId, active) => {
        const sockets = this.memberSockets(roomId, userId);
        if (active !== undefined) {
          for (const socket of sockets) {
            const saved = socket.deserializeAttachment() as Attachment;
            socket.serializeAttachment({ ...saved, inZen: active });
          }
          return active && sockets.length > 0;
        }
        return sockets.some((socket) => (socket.deserializeAttachment() as Attachment).inZen);
      },
      schedule: async (time) => {
        const current = await ctx.storage.getAlarm();
        if (time !== undefined && current !== time) await ctx.storage.setAlarm(time);
        else if (time === undefined && current !== null) await ctx.storage.deleteAlarm();
      },
    }, previous);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private memberSockets(room: string, user: string): WebSocket[] {
    return this.ctx.getWebSockets(room).filter((socket) =>
      socket.readyState === WebSocket.OPEN && (socket.deserializeAttachment() as Attachment).userId === user
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/internal/vgg-merit' && (request.method === 'GET' || request.method === 'POST')) {
      const token = this.env.OFFICE_VGG_MERIT_TOKEN;
      const supplied = Buffer.from(request.headers.get('Authorization') ?? '');
      if (!token) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
      const expected = Buffer.from('Bearer ' + token);
      if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      try {
        const body = request.method === 'POST' ? await request.json() as { fingerprint?: string } : undefined;
        return Response.json(auditVggMeritBatch(request.method === 'POST', body?.fingerprint));
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'MERIT_AUDIT_FAILED' }, { status: 409 });
      }
    }
    if (url.pathname === '/internal/import-vgg' && request.method === 'POST') {
      const token = this.env.OFFICE_VGG_IMPORT_TOKEN;
      if (!token) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
      const expected = Buffer.from(`Bearer ${token}`);
      const supplied = Buffer.from(request.headers.get('Authorization') ?? '');
      if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) {
        return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
      const length = Number(request.headers.get('Content-Length'));
      if (!Number.isSafeInteger(length) || length < 1 || length > 512 * 1024) {
        return Response.json({ error: 'INVALID_BACKUP_SIZE' }, { status: 413 });
      }
      try {
        const result = importVggRoom(await request.json() as Parameters<typeof importVggRoom>[0]);
        return Response.json(result, { status: 201 });
      } catch (error) {
        return error instanceof Error && error.message === 'VGG_ALREADY_EXISTS'
          ? Response.json({ error: 'VGG_ALREADY_EXISTS' }, { status: 409 })
          : Response.json({ error: 'VGG_IMPORT_FAILED' }, { status: 400 });
      }
    }
    if (url.pathname === '/api/reset') return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    const events = url.pathname.match(/^\/api\/rooms\/([^/]+)\/events$/);
    if (!events) return dispatchHttp(request);
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return Response.json({ error: 'WEBSOCKET_REQUIRED' }, { status: 426 });
    }
    const member = authorizeOfficeRealtime(decodeURIComponent(events[1]).toUpperCase(), url.searchParams.get('token') ?? '');
    if (!member) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { 0: client, 1: server } = new WebSocketPair();
    const inZen = this.memberSockets(member.roomId, member.userId)
      .some((socket) => (socket.deserializeAttachment() as Attachment).inZen);
    server.serializeAttachment({ ...member, inZen });
    this.ctx.acceptWebSocket(server, [member.roomId]);
    publishOfficePresence(member.roomId);
    server.send(JSON.stringify({ type: 'altar_updated' }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketClose(socket: WebSocket, code: number, reason: string): void {
    const member = socket.deserializeAttachment() as Attachment | null;
    socket.close(code, reason);
    if (member) {
      if (!this.memberSockets(member.roomId, member.userId).length) removeBoxingPresence(member.roomId, member.userId);
      publishOfficePresence(member.roomId);
    }
  }

  async alarm(): Promise<void> {
    await settleOfficeAlarms();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    if (origin && origin !== env.OFFICE_WEB_ORIGIN) {
      return Response.json({ error: 'FORBIDDEN_ORIGIN' }, { status: 403 });
    }
    const cors = {
      'Access-Control-Allow-Origin': env.OFFICE_WEB_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const response = await env.OFFICE_STATE.get(env.OFFICE_STATE.idFromName('office-v1')).fetch(request);
    if (response.status === 101) return response;
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(cors)) headers.set(name, value);
    return new Response(response.body, { status: response.status, headers });
  },
};
