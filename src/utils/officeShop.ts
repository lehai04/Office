import type { RoomDonationBoxState } from './officeEconomyData';
import type { AoDaiColors, AoDaiItem, AoDaiPalette } from './aoDai';

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
  princess_dress: { name: 'Váy công chúa', icon: '👗', price: 240_000, kind: 'equip', category: 'outfit', description: 'Váy hồng nhiều tầng, thắt nơ ở eo.' },
  princess_tiara: { name: 'Vương miện công chúa', icon: '👑', price: 95_000, kind: 'equip', category: 'outfit', description: 'Vương miện vàng đính đá hồng, có thể phối cùng váy công chúa.' },
  cat_cosplay: { name: 'Cosplay mèo hồng', icon: '🐱', price: 220_000, kind: 'equip', category: 'outfit', description: 'Bộ đồ mèo hồng có tai nhọn, bụng sáng màu và đuôi cong.' },
  rabbit_cosplay: { name: 'Cosplay thỏ trắng', icon: '🐰', price: 220_000, kind: 'equip', category: 'outfit', description: 'Bộ đồ thỏ trắng có tai dài và đuôi tròn.' },
  panda_cosplay: { name: 'Cosplay gấu trúc', icon: '🐼', price: 220_000, kind: 'equip', category: 'outfit', description: 'Bộ đồ gấu trúc đen trắng với hai tai tròn.' },
  monk_robe: { name: 'Áo sư chùa', icon: '🟤', price: 180_000, kind: 'equip', category: 'outfit', description: 'Áo nâu dài với vạt chéo màu vàng đất.' },
  ao_dai_truc_vang: { name: 'Áo dài Trúc Vàng', icon: '🎋', price: 30, currency: 'merit', kind: 'equip', category: 'outfit', description: 'Áo xanh ngọc đậm, cổ đứng viền vàng, tà xẻ hai bên và họa tiết trúc vàng. Quần kem, giày đen. Vừa cả avatar nam và nữ.' },
  ao_dai_sen_hong: { name: 'Áo dài Sen Hồng', icon: '🪷', price: 30, currency: 'merit', kind: 'equip', category: 'outfit', description: 'Áo hồng sen trầm, cổ đứng, đường cài chéo viền kem và hoa sen khối. Quần kem, giày hồng. Vừa cả avatar nam và nữ.' },
  pixel_glasses: { name: 'Kính pixel', icon: '🕶️', price: 80_000, kind: 'equip', category: 'outfit', description: 'Kính đen góc vuông có điểm sáng kiểu pixel.' },
  wave: { name: 'Vẫy tay', icon: '👋', price: 70_000, kind: 'action', category: 'action', description: 'Vẫy tay chào đồng nghiệp.' },
  clap: { name: 'Vỗ tay', icon: '👏', price: 90_000, kind: 'action', category: 'action', description: 'Vỗ tay ăn mừng.' },
  confetti: { name: 'Tung confetti', icon: '🎉', price: 160_000, kind: 'action', category: 'action', description: 'Tung giấy màu lên cao.' },
  spin: { name: 'Xoay một vòng', icon: '🔄', price: 105_000, kind: 'action', category: 'action', description: 'Xoay người một vòng tại chỗ.' },
  nap: { name: 'Gục đầu chợp mắt', icon: '💤', price: 95_000, kind: 'action', category: 'action', description: 'Cúi đầu chợp mắt trong vài giây.' },
  bow: { name: 'Chắp tay cúi chào', icon: '🙏', price: 85_000, kind: 'action', category: 'action', description: 'Chắp tay và cúi người chào.' },
  cheer: { name: 'Nhảy reo mừng', icon: '🙌', price: 120_000, kind: 'action', category: 'action', description: 'Bật nhảy tại chỗ và giơ cao hai tay.' },
  salute: { name: 'Chào kiểu đội trưởng', icon: '🫡', price: 85_000, kind: 'action', category: 'action', description: 'Giơ một tay lên trán để chào.' },
  heart: { name: 'Thả tim', icon: '💗', price: 110_000, kind: 'action', category: 'action', description: 'Tạo dáng và gửi một trái tim bay lên.' },
  stretch: { name: 'Vươn vai', icon: '🧘', price: 75_000, kind: 'action', category: 'action', description: 'Duỗi hai tay sang ngang rồi vươn cao.' },
  laugh: { name: 'Cười nghiêng ngả', icon: '😂', price: 95_000, kind: 'action', category: 'action', description: 'Ôm bụng và lắc người vì cười.' },
  lotus: { name: 'Hoa sen', icon: '🪷', price: 18_000, kind: 'consumable', category: 'altar', description: 'Hoa sen dâng tại Phòng Tịnh Tâm.' },
  tea: { name: 'Chén trà', icon: '🍵', price: 12_000, kind: 'consumable', category: 'altar', description: 'Chén trà dâng tại bàn thờ.' },
  cake: { name: 'Đĩa bánh', icon: '🍰', price: 25_000, kind: 'consumable', category: 'altar', description: 'Đĩa bánh dâng tại bàn thờ.' },
  headphones: { name: 'Tai nghe', icon: '🎧', price: 110_000, kind: 'decor', category: 'equipment', description: 'Tai nghe để trên bàn.' },
  keyboard: { name: 'Bàn phím', icon: '⌨️', price: 95_000, kind: 'decor', category: 'equipment', description: 'Bàn phím để trên bàn làm việc.' },
  monitor: { name: 'Màn hình phụ', icon: '🖥️', price: 210_000, kind: 'decor', category: 'equipment', description: 'Màn hình phụ cho góc làm việc.' },
  frame: { name: 'Khung tranh', icon: '🖼️', price: 80_000, kind: 'decor', category: 'decor', description: 'Khung tranh nhỏ để bàn.' },
  bed: { name: 'Giường ngủ', icon: '🛏️', price: 0, kind: 'decor', category: 'decor', description: 'Đặt trên sàn văn phòng và bấm giường để nằm ngủ.' },
  pink_cat: { name: 'Mèo hồng ngồi', icon: '🐱', price: 100, currency: 'merit', kind: 'decor', category: 'decor', description: 'Tượng mèo voxel nhỏ, ngồi thả chân ở mép bàn làm việc hoặc tủ hồ sơ.' },
  clock: { name: 'Đồng hồ bàn', icon: '🕰️', price: 65_000, kind: 'decor', category: 'decor', description: 'Đồng hồ để bàn làm việc.' },
} as const;

export type ShopItem = keyof typeof OFFICE_SHOP;
type ItemOfKind<K> = { [I in ShopItem]: (typeof OFFICE_SHOP)[I]['kind'] extends K ? I : never }[ShopItem];
export type DecorationItem = ItemOfKind<'decor'>;
export type OfficeAction = ItemOfKind<'action'>;
export type ShopConsumable = ItemOfKind<'consumable'>;
export type ShopOffering = Exclude<ShopConsumable, 'incense'>;
export type ShopEquipment = ItemOfKind<'equip'>;
export const OUTFIT_SLOTS = {
  outfit: 'shirt', hoodie: 'shirt', glasses: 'eyes', cap: 'head',
  princess_dress: 'shirt', princess_tiara: 'head', cat_cosplay: 'shirt',
  rabbit_cosplay: 'shirt', panda_cosplay: 'shirt', monk_robe: 'shirt', pixel_glasses: 'eyes',
  ao_dai_truc_vang: 'shirt', ao_dai_sen_hong: 'shirt',
} as const satisfies Record<ShopEquipment, 'shirt' | 'eyes' | 'head'>;

export const COSPLAY_COLORS = {
  cat_cosplay: { suit: '#eb5ba1', accent: '#ffd1e8' },
  rabbit_cosplay: { suit: '#f4f4ff', accent: '#f4a6bf' },
  panda_cosplay: { suit: '#242638', accent: '#ffffff' },
} as const;

export function isAnimalCostume(item: ShopEquipment | undefined): item is keyof typeof COSPLAY_COLORS {
  return item !== undefined && Object.hasOwn(COSPLAY_COLORS, item);
}
export type ShopOutfit = Partial<Record<typeof OUTFIT_SLOTS[ShopEquipment], ShopEquipment>>;
export type ShopAppearance = ShopOutfit & { aoDaiColors?: AoDaiColors };
export const SHOP_OFFERINGS: readonly ShopOffering[] = ['offering', 'lotus', 'tea', 'cake'];

export function isShopItem(value: unknown): value is ShopItem {
  return typeof value === 'string' && Object.hasOwn(OFFICE_SHOP, value);
}

export function usesMerit(item: ShopItem): boolean {
  const product = OFFICE_SHOP[item];
  return 'currency' in product && product.currency === 'merit';
}

export const equippedItems = (shop: OfficeShopState): ShopOutfit =>
  shop.equipped ?? (shop.outfit ? { shirt: shop.outfit } : {});

export const equippedAppearance = (shop: OfficeShopState): ShopAppearance =>
  ({ ...equippedItems(shop), aoDaiColors: shop.aoDaiColors });

export type ScenePoint = [number, number, number];

export interface OfficeDecoration {
  id: string;
  item: DecorationItem;
  position: ScenePoint;
  seatId?: string;
  rotationY?: number;
}

export interface OfficeShopState {
  inventory: Partial<Record<ShopItem, number>>;
  decorations: OfficeDecoration[];
  outfit?: 'outfit';
  equipped?: ShopOutfit;
  aoDaiColors?: AoDaiColors;
  sleepingBedId?: string;
}

export const EMPTY_OFFICE_SHOP: OfficeShopState = { inventory: {}, decorations: [] };

export type ShopCommand =
  | { action: 'customize'; item: AoDaiItem; colors: AoDaiPalette; id: string }
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
  appearances: Record<string, ShopAppearance>;
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
