import type { ShopItem } from './officeShop';

export const AO_DAI = {
  ao_dai_truc_vang: { cloth: '#20534d', trim: '#e9bd61', trousers: '#f4e6ca', shoes: '#252321' },
  ao_dai_sen_hong: { cloth: '#b95e76', trim: '#f6dcc3', trousers: '#f4e6ca', shoes: '#b95b78' },
} as const;

export type AoDaiItem = keyof typeof AO_DAI;
export type AoDaiPalette = { cloth: string; trim: string; trousers: string; shoes: string };
export type AoDaiColors = Partial<Record<AoDaiItem, AoDaiPalette>>;
export const AO_DAI_COLOR_LABELS: Record<keyof AoDaiPalette, string> = {
  cloth: 'Màu áo', trim: 'Màu viền', trousers: 'Màu quần', shoes: 'Màu giày',
};

export function parseAoDaiPalette(value: unknown): AoDaiPalette | undefined {
  if (!value || typeof value !== 'object') return;
  const palette = value as Record<string, unknown>;
  const result = {} as AoDaiPalette;
  for (const key of Object.keys(AO_DAI_COLOR_LABELS) as Array<keyof AoDaiPalette>) {
    const color = palette[key];
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return;
    result[key] = color.toLowerCase();
  }
  return result;
}

export function aoDaiPalette(item: AoDaiItem, colors?: AoDaiColors): AoDaiPalette {
  return parseAoDaiPalette(colors?.[item]) ?? AO_DAI[item];
}
export function isAoDai(item: ShopItem | undefined): item is AoDaiItem {
  return item !== undefined && Object.hasOwn(AO_DAI, item);
}
