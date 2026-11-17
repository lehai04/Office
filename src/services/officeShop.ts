import { isUsingStaticFallback, officeApiUrl } from './officeApi';
import type { RoomShopView, ShopCommand } from '../utils/officeShop';

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
