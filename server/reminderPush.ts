import { sendNotification, type PushSubscription } from 'web-push';
import { getNowInHoChiMinh } from '../src/utils/dateVn';

const publicKey = process.env.OFFICE_PUSH_PUBLIC_KEY;
const privateKey = process.env.OFFICE_PUSH_PRIVATE_KEY;
const subject = process.env.OFFICE_PUSH_SUBJECT;
const vapidDetails = publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
export const pushPublicKey = vapidDetails?.publicKey ?? null;

export interface ReminderDevice {
  userId: string;
  roomId: string;
  subscription: PushSubscription;
  enableWork: boolean;
  enableAttendance: boolean;
  enableBuddha: boolean;
  workDate?: string;
  bowDate?: string;
  lastSent?: string;
}

export function parseReminderDevice(body: Record<string, unknown>, userId: string, roomId: string): ReminderDevice | null {
  const subscription = body.subscription as Partial<PushSubscription> | null;
  if (!subscription || typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 2048) return null;
  const url = URL.canParse(subscription.endpoint) ? new URL(subscription.endpoint) : null;
  if (!url || url.protocol !== 'https:' || url.port || url.username || url.password) return null;
  const host = url.hostname;
  if (!(
    (host === 'fcm.googleapis.com' && url.pathname.startsWith('/fcm/send/')) ||
    (host === 'updates.push.services.mozilla.com' && url.pathname.startsWith('/wpush/')) ||
    host === 'web.push.apple.com' ||
    host.endsWith('.notify.windows.com')
  )) return null;

  const keys = subscription.keys;
  if (!keys || typeof keys.auth !== 'string' || typeof keys.p256dh !== 'string' ||
      !/^[\w-]{22}$/.test(keys.auth) || !/^[\w-]{87}$/.test(keys.p256dh)) return null;
  const { dateStr } = getNowInHoChiMinh();
  return {
    userId,
    roomId,
    subscription: { endpoint: url.href, keys: { auth: keys.auth, p256dh: keys.p256dh } },
    enableWork: body.enableWork === true,
    enableAttendance: body.enableAttendance === true,
    enableBuddha: body.enableBuddha === true,
    bowDate: body.bowDate === dateStr ? dateStr : undefined,
  };
}

export async function sendReminder(device: ReminderDevice, body: string, date: string): Promise<void> {
  if (!vapidDetails) return;
  await sendNotification(
    device.subscription,
    JSON.stringify({ title: 'Nhắc nhở Văn phòng 3D', body, tag: `daily-reminder-${date}` }),
    { vapidDetails, TTL: 12 * 60 * 60, timeout: 10_000 }
  );
}
