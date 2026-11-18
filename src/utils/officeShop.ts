import type { RoomDonationBoxState } from './officeEconomyData';

export const SHOP_CATEGORIES = {
  outfit: 'Trang phục',
  action: 'Hành động',
  altar: 'Nhang & đồ cúng',
  equipment: 'Thiết bị',
  decor: 'Trang trí',
} as const;

export const OFFICE_SHOP = {
  outfit: { name: 'Áo tím', icon: '👕', price: 120_000, kind: 'equip', category: 'outfit', description: 'Áo tím cho nhân vật.' },
  dance: { name: 'Nhảy múa', icon: '💃', price: 150_000, kind: 'action', category: 'action', description: 'Nhún nhảy và lắc mình theo nhịp.' },
  incense: { name: 'Nhang', icon: '🪔', price: 5_000, kind: 'consumable', category: 'altar', description: 'Dùng một nén để dâng hương tại Phòng Tịnh Tâm.' },
  computer: { name: 'Máy tính', icon: '💻', price: 300_000, kind: 'decor', category: 'equipment', description: 'Máy tính để trên bàn làm việc.' },
  offering: { name: 'Mâm trái cây', icon: '🍎', price: 30_000, kind: 'consumable', category: 'altar', description: 'Mâm trái cây để dâng lên bàn thờ trong Phòng Tịnh Tâm.' },
  plant: { name: 'Chậu cây', icon: '🪴', price: 60_000, kind: 'decor', category: 'decor', description: 'Chậu cây nhỏ để trang trí bàn hoặc văn phòng.' },
  headstand: { name: 'Ke đầu', icon: '🤸', price: 180_000, kind: 'action', category: 'action', description: 'Chống tay, lộn người và giữ thăng bằng.' },
  lamp: { name: 'Đèn bàn', icon: '💡', price: 90_000, kind: 'decor', category: 'decor', description: 'Đèn nhỏ cho góc làm việc.' },
  hoodie: { name: 'Hoodie xanh', icon: '🧥', price: 140_000, kind: 'equip', category: 'outfit', description: 'Áo hoodie xanh cho nhân vật.' },
  glasses: { name: 'Kính tròn', icon: '👓', price: 75_000, kind: 'equip', category: 'outfit', description: 'Kính tròn đeo trên mặt nhân vật.' },
  cap: { name: 'Mũ lưỡi trai', icon: '🧢', price: 85_000, kind: 'equip', category: 'outfit', description: 'Mũ lưỡi trai cho nhân vật.' },
  wave: { name: 'Vẫy tay', icon: '👋', price: 70_000, kind: 'action', category: 'action', description: 'Vẫy tay chào đồng nghiệp.' },
  clap: { name: 'Vỗ tay', icon: '👏', price: 90_000, kind: 'action', category: 'action', description: 'Vỗ tay ăn mừng.' },
  confetti: { name: 'Tung confetti', icon: '🎉', price: 160_000, kind: 'action', category: 'action', description: 'Tung giấy màu lên cao.' },
  lotus: { name: 'Hoa sen', icon: '🪷', price: 18_000, kind: 'consumable', category: 'altar', description: 'Hoa sen dâng tại Phòng Tịnh Tâm.' },
  tea: { name: 'Chén trà', icon: '🍵', price: 12_000, kind: 'consumable', category: 'altar', description: 'Chén trà dâng tại bàn thờ.' },
  cake: { name: 'Đĩa bánh', icon: '🍰', price: 25_000, kind: 'consumable', category: 'altar', description: 'Đĩa bánh dâng tại bàn thờ.' },
  headphones: { name: 'Tai nghe', icon: '🎧', price: 110_000, kind: 'decor', category: 'equipment', description: 'Tai nghe để trên bàn.' },
  keyboard: { name: 'Bàn phím', icon: '⌨️', price: 95_000, kind: 'decor', category: 'equipment', description: 'Bàn phím để trên bàn làm việc.' },
  monitor: { name: 'Màn hình phụ', icon: '🖥️', price: 210_000, kind: 'decor', category: 'equipment', description: 'Màn hình phụ cho góc làm việc.' },
  frame: { name: 'Khung tranh', icon: '🖼️', price: 80_000, kind: 'decor', category: 'decor', description: 'Khung tranh nhỏ để bàn.' },
  bed: { name: 'Giường ngủ', icon: '🛏️', price: 0, kind: 'decor', category: 'decor', description: 'Đặt trên sàn văn phòng và bấm giường để nằm ngủ.' },
  clock: { name: 'Đồng hồ bàn', icon: '🕰️', price: 65_000, kind: 'decor', category: 'decor', description: 'Đồng hồ để bàn làm việc.' },
} as const;

export type ShopItem = keyof typeof OFFICE_SHOP;
type ItemOfKind<K> = { [I in ShopItem]: (typeof OFFICE_SHOP)[I]['kind'] extends K ? I : never }[ShopItem];
export type DecorationItem = ItemOfKind<'decor'>;
export type OfficeAction = ItemOfKind<'action'>;
export type ShopConsumable = ItemOfKind<'consumable'>;
export type ShopOffering = Exclude<ShopConsumable, 'incense'>;
export type ShopEquipment = ItemOfKind<'equip'>;
export const OUTFIT_SLOTS = { outfit: 'shirt', hoodie: 'shirt', glasses: 'eyes', cap: 'head' } as const;
export type ShopOutfit = Partial<Record<typeof OUTFIT_SLOTS[ShopEquipment], ShopEquipment>>;
export const SHOP_OFFERINGS: readonly ShopOffering[] = ['offering', 'lotus', 'tea', 'cake'];

export function isShopItem(value: unknown): value is ShopItem {
  return typeof value === 'string' && Object.hasOwn(OFFICE_SHOP, value);
}

export const equippedItems = (shop: OfficeShopState): ShopOutfit =>
  shop.equipped ?? (shop.outfit ? { shirt: shop.outfit } : {});

export type ScenePoint = [number, number, number];

export interface OfficeDecoration {
  id: string;
  item: DecorationItem;
  position: ScenePoint;
  seatId?: string;
}

export interface OfficeShopState {
  inventory: Partial<Record<ShopItem, number>>;
  decorations: OfficeDecoration[];
  outfit?: 'outfit';
  equipped?: ShopOutfit;
  sleepingBedId?: string;
}

export const EMPTY_OFFICE_SHOP: OfficeShopState = { inventory: {}, decorations: [] };

export type ShopCommand =
  | { action: 'buy' | 'equip'; item: ShopItem; id: string }
  | { action: 'place'; item: ShopItem; position: ScenePoint; id: string }
  | { action: 'spend' | 'donate'; amount: number; id: string }
  | { action: 'remove' | 'sleep'; decorationId: string; id: string };

export interface RoomShopView {
  shop: OfficeShopState;
  balanceVnd: number;
  donationTotalVnd: number;
  donationBox?: RoomDonationBoxState;
  altarMerit?: number;
  appearances: Record<string, ShopOutfit>;
  decorations: OfficeDecoration[];
  sleeping?: Record<string, ScenePoint>;
}

export const OFFICE_ACTION_DURATION_MS = 3000;

export interface OfficeActionEvent {
  type: 'office_action';
  eventId: string;
  userId: string;
  action: OfficeAction;
  startedAt: number;
}

export function isOfficeAction(value: unknown): value is OfficeAction {
  return isShopItem(value) && OFFICE_SHOP[value].kind === 'action';
}
