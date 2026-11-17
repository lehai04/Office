import { officeApiUrl } from './officeApi';

export async function syncReminderPush(roomCode: string, token: string, preferences: {
  enableWork: boolean;
  enableAttendance: boolean;
  enableBuddha: boolean;
  bowDate?: string;
}): Promise<void> {
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
    throw new Error('Thiết bị này chưa hỗ trợ thông báo nền.');
  }
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active) throw new Error('Thông báo nền đang khởi động. Hãy thử lại.');
  const response = await fetch(officeApiUrl('/api/reminders/push-key'));
  const config = response.ok ? await response.json().catch(() => null) : null;
  if (!config?.publicKey) throw new Error('Máy chủ chưa bật thông báo nền.');
  let subscription = await registration.pushManager.getSubscription();
  const enabled = preferences.enableWork || preferences.enableAttendance || preferences.enableBuddha;
  if (!subscription && !enabled) return;
  const key = Uint8Array.from(atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  if (subscription && subscription.options.applicationServerKey &&
      new Uint8Array(subscription.options.applicationServerKey).some((byte, index) => byte !== key[index])) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const saved = await fetch(officeApiUrl(`/api/rooms/${encodeURIComponent(roomCode)}/reminders/device`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...preferences, subscription }),
  });
  if (!saved.ok || !(await saved.json().catch(() => null))?.ok) {
    throw new Error('Chưa lưu được thiết bị nhận thông báo.');
  }
}
