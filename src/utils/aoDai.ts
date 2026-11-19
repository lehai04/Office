import type { ShopItem } from './officeShop';

export const AO_DAI = {
  ao_dai_truc_vang: { cloth: '#20534d', trim: '#e9bd61', trousers: '#f4e6ca', shoes: '#252321' },
  ao_dai_sen_hong: { cloth: '#b95e76', trim: '#f6dcc3', trousers: '#f4e6ca', shoes: '#b95b78' },
} as const;

export type AoDaiItem = keyof typeof AO_DAI;
export function isAoDai(item: ShopItem | undefined): item is AoDaiItem {
  return item !== undefined && Object.hasOwn(AO_DAI, item);
}
