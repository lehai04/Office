import { isUsingStaticFallback, officeApiUrl } from './officeApi';
import type { OfficeAction, OfficeActionEvent, RoomShopView, ShopCommand } from '../utils/officeShop';

export const SHOP_UPDATE_EVENT = 'office-shop-updated';

export async function requestRoomShop(room: string, token: string, command?: ShopCommand, signal?: AbortSignal): Promise<RoomShopView> {
  if (isUsingStaticFallback()) throw new Error('Cửa hàng cần kết nối máy chủ Office.');
  const response = await fetch(officeApiUrl(`/api/rooms/${encodeURIComponent(room)}/shop`), {
    method: command ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(command && { 'Content-Type': 'application/json' }) },
    body: command ? JSON.stringify(command) : undefined,
    signal,
  });
  const data = await response.json() as RoomShopView & { message?: string };
  if (!response.ok || !data.shop) throw new Error(data.message ?? 'Chưa tải được Cửa hàng văn phòng.');
  return data;
}

export async function performOfficeAction(room: string, token: string, action: OfficeAction): Promise<OfficeActionEvent> {
  const response = await fetch(officeApiUrl('/api/rooms/' + encodeURIComponent(room) + '/actions'), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(result.message ?? 'Chưa đồng bộ được hiệu ứng.');
  }
  return await response.json() as OfficeActionEvent;
}
