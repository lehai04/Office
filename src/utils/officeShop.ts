export const OFFICE_SHOP = {
  outfit: { name: 'Áo tím', icon: '👕', price: 120_000, kind: 'equip' },
  dance: { name: 'Nhảy múa', icon: '💃', price: 150_000, kind: 'action' },
  headstand: { name: 'Ke đầu', icon: '🤸', price: 180_000, kind: 'action' },
  incense: { name: 'Nhang', icon: '🪔', price: 5_000, kind: 'consumable' },
  offering: { name: 'Mâm trái cây', icon: '🍎', price: 30_000, kind: 'consumable' },
  computer: { name: 'Máy tính', icon: '💻', price: 300_000, kind: 'decor' },
  plant: { name: 'Chậu cây', icon: '🪴', price: 60_000, kind: 'decor' },
  lamp: { name: 'Đèn bàn', icon: '💡', price: 90_000, kind: 'decor' },
} as const;

export type ShopItem = keyof typeof OFFICE_SHOP;
export type DecorationItem = 'computer' | 'plant' | 'lamp';
export type OfficeAction = 'dance' | 'headstand';
export type ScenePoint = [number, number, number];

export interface OfficeDecoration {
  id: string;
  item: DecorationItem;
  position: ScenePoint;
}

export interface OfficeShopState {
  inventory: Partial<Record<ShopItem, number>>;
  decorations: OfficeDecoration[];
  outfit?: 'outfit';
}

export const EMPTY_OFFICE_SHOP: OfficeShopState = { inventory: {}, decorations: [] };
