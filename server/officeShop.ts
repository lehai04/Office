import { calculateDonationMerit } from '../src/utils/officeEconomyData';
import { CABINET_TOP_Y, OFFICE_CABINETS, WORK_SEAT_LAYOUTS } from '../src/constants/officeLayout';
import {
  OFFICE_SHOP, OUTFIT_SLOTS, equippedItems, isShopItem,
  type DecorationItem, type OfficeDecoration, type OfficeShopState, type ShopEquipment, type ShopCommand, type ScenePoint,
} from '../src/utils/officeShop';
import type { UserEconomyLedgerEntry } from '../src/utils/donationCaseEngine';
import { AO_DAI, isAoDai, parseAoDaiPalette, type AoDaiItem } from '../src/utils/aoDai';

export interface StoredShop {
  state: OfficeShopState;
  receipts: Record<string, string>;
  settledMonths: string[];
  bedGranted?: boolean;
}

export function restoreShop(raw: unknown): { shop: StoredShop; balance?: number } {
  let wallet: { balanceVnd?: number; shop?: OfficeShopState; settledMonths?: string[] } = {};
  try { wallet = (typeof raw === 'string' ? JSON.parse(raw) : raw) ?? {}; } catch { /* No readable wallet. */ }
  const inventory: OfficeShopState['inventory'] = {};
  for (const [item, count] of Object.entries(wallet.shop?.inventory ?? {})) {
    if (isShopItem(item) && Number.isSafeInteger(count) && count > 0) inventory[item] = count;
  }
  const decorations = (Array.isArray(wallet.shop?.decorations) ? wallet.shop.decorations : []).filter((placed) =>
    placed && typeof placed.id === 'string' && isShopItem(placed.item) && OFFICE_SHOP[placed.item].kind === 'decor' &&
    Array.isArray(placed.position) && placed.position.length === 3 && placed.position.every(Number.isFinite));
  const outfit = wallet.shop?.outfit === 'outfit' && inventory.outfit ? 'outfit' : undefined;
  const equipped: OfficeShopState['equipped'] = wallet.shop?.equipped ? {} : undefined;
  if (equipped) {
    for (const [slot, item] of Object.entries(wallet.shop?.equipped ?? {})) {
      if (isShopItem(item) && inventory[item] && item in OUTFIT_SLOTS) {
        const expected = OUTFIT_SLOTS[item as ShopEquipment];
        if (slot === expected) equipped[expected] = item as ShopEquipment;
      }
    }
  }
  const aoDaiColors: OfficeShopState['aoDaiColors'] = {};
  for (const item of Object.keys(AO_DAI) as AoDaiItem[]) {
    const colors = parseAoDaiPalette(wallet.shop?.aoDaiColors?.[item]);
    if (inventory[item] && colors) aoDaiColors[item] = colors;
  }
  return {
    shop: { state: { inventory, decorations, outfit, equipped, aoDaiColors }, receipts: {},
      settledMonths: Array.isArray(wallet.settledMonths) ? wallet.settledMonths.filter((month) => /^\d{4}-\d{2}$/.test(month)) : [] },
    balance: Number.isSafeInteger(wallet.balanceVnd) && wallet.balanceVnd! >= 0 ? wallet.balanceVnd : undefined,
  };
}

function deskPoint(position: unknown, seatId: string | undefined): ScenePoint | undefined {
  const desk = WORK_SEAT_LAYOUTS.find((layout) => layout.seatId === seatId);
  if (!desk || !Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) return;
  const [x, , z] = position;
  const dx = x - desk.deskPosition[0];
  const dz = z - desk.deskPosition[2];
  const cosine = Math.cos(desk.deskRotationY);
  const sine = Math.sin(desk.deskRotationY);
  if (Math.abs(dx * cosine - dz * sine) > 0.84 || Math.abs(dx * sine + dz * cosine) > 0.46) return;
  return [x, desk.deskPosition[1] + 0.755, z];
}

function sittingCatAtEdge(point: ScenePoint, center: ScenePoint, rotationY: number, halfWidth: number, halfDepth: number) {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  const dx = point[0] - center[0];
  const dz = point[2] - center[2];
  const localX = dx * c - dz * s;
  const localZ = dx * s + dz * c;
  if (Math.abs(localX) > halfWidth + 0.02 || Math.abs(localZ) > halfDepth + 0.02) return;
  const x = Math.max(-halfWidth + 0.19, Math.min(halfWidth - 0.19, localX));
  const towardFront = localZ >= 0;
  const z = (towardFront ? 1 : -1) * (halfDepth - 0.075);
  return {
    position: [center[0] + x * c + z * s, point[1], center[2] - x * s + z * c] as ScenePoint,
    rotationY: rotationY + (towardFront ? 0 : Math.PI),
  };
}

interface RoomShopContext {
  debitMerit: (amount: number) => boolean;
  roomDecorations: () => readonly OfficeDecoration[];
}

export function runShopCommand(stored: StoredShop, wallet: UserEconomyLedgerEntry, body: Record<string, unknown>, seatId: string | undefined, box: { totalVnd: number; updatedAt: number }, onDonate?: (id: string, amount: number, merit: number) => void, room?: RoomShopContext): string | undefined {
  const { id, action, item } = body;
  if (typeof id !== 'string' || !/^[\da-f-]{36}$/i.test(id)) return 'Mã giao dịch không hợp lệ.';
  const signature = JSON.stringify(action === 'customize'
    ? [action, item, body.colors]
    : [action, item, body.decorationId, body.position, body.amount]);
  if (Object.hasOwn(stored.receipts, id)) {
    return stored.receipts[id] === signature ? undefined : 'Mã giao dịch đã được dùng.';
  }
  const shop = stored.state;
  if (action === 'spend' || action === 'donate') {
    const requested = body.amount;
    if (typeof requested !== 'number' || !Number.isSafeInteger(requested) || requested < (action === 'spend' ? 1 : 1000)) return 'Số tiền không hợp lệ.';
    if (wallet.balanceVnd < requested) return 'Không đủ số dư.';
    wallet.balanceVnd -= requested;
    if (action === 'donate') {
      box.totalVnd += requested;
      box.updatedAt = Date.now();
      const merit = calculateDonationMerit(requested);
      wallet.meritCount += merit;
      onDonate?.(id, requested, merit);
    }
  } else if (action === 'sleep') {
    const bed = shop.decorations.find((placed) => placed.id === body.decorationId && placed.item === 'bed');
    if (!bed) return 'Bạn chỉ có thể ngủ trên giường của mình.';
    shop.sleepingBedId = shop.sleepingBedId === bed.id ? undefined : bed.id;
  } else if (action === 'remove') {
    const index = shop.decorations.findIndex((placed) => placed.id === body.decorationId);
    if (index < 0) return 'Vật phẩm đã được cất.';
    const [{ item: removed, id: placedId }] = shop.decorations.splice(index, 1);
    if (shop.sleepingBedId === placedId) shop.sleepingBedId = undefined;
    shop.inventory[removed] = (shop.inventory[removed] ?? 0) + 1;
  } else {
    if (!isShopItem(item)) return 'Vật phẩm không hợp lệ.';
    const product = OFFICE_SHOP[item];
    const count = shop.inventory[item] ?? 0;
    switch (action as ShopCommand['action']) {
      case 'customize': {
        if (!isAoDai(item) || !count) return 'Bạn cần sở hữu bộ áo dài này trước khi đổi màu.';
        const colors = parseAoDaiPalette(body.colors);
        if (!colors) return 'Màu không hợp lệ. Vui lòng chọn màu theo định dạng #RRGGBB.';
        shop.aoDaiColors = { ...shop.aoDaiColors, [item]: colors };
        break;
      }
      case 'buy':
        if (item === 'bed') return 'Giường ngủ đã có sẵn trong túi đồ.';
        if ((product.kind === 'equip' || product.kind === 'action') && count) return 'Bạn đã sở hữu vật phẩm này.';
        if ('currency' in product && product.currency === 'merit') {
          if (!room?.debitMerit(product.price)) return 'Không đủ công đức.';
        } else {
          if (wallet.balanceVnd < product.price) return 'Không đủ số dư.';
          wallet.balanceVnd -= product.price;
        }
        shop.inventory[item] = count + 1;
        break;
      case 'equip': {
        if (product.kind !== 'equip' || !count) return 'Bạn chưa sở hữu trang phục này.';
        const equipment = item as ShopEquipment;
        const slot = OUTFIT_SLOTS[equipment];
        shop.equipped = { ...equippedItems(shop), [slot]: equippedItems(shop)[slot] === equipment ? undefined : equipment };
        break;
      }
      case 'place': {
        if (product.kind !== 'decor' || !count) return 'Bạn không có vật phẩm để đặt.';
        const raw = body.position;
        const floor = Array.isArray(raw) && raw.length === 3 && raw.every(Number.isFinite) &&
          Math.abs(raw[0]) < 7.2 && Math.abs(raw[2]) < 4.8 && Math.abs(raw[1]) < 0.06;
        if (item === 'pink_cat') {
          const point = Array.isArray(raw) && raw.length === 3 && raw.every(Number.isFinite) ? raw as ScenePoint : undefined;
          if (!point) return 'Hãy chọn mép bàn hoặc nóc tủ.';
          let anchor: ReturnType<typeof sittingCatAtEdge>;
          let assignedSeat: string | undefined;
          if (Math.abs(point[1] - CABINET_TOP_Y) < 0.04) {
            for (const cabinet of OFFICE_CABINETS) {
              anchor = sittingCatAtEdge([point[0], CABINET_TOP_Y, point[2]], cabinet.position, cabinet.rotationY, cabinet.length / 2, cabinet.depth / 2);
              if (anchor) break;
            }
          } else {
            const desk = WORK_SEAT_LAYOUTS.find((layout) => layout.seatId === seatId);
            const onDesk = deskPoint(point, seatId);
            if (desk && onDesk && Math.abs(point[1] - onDesk[1]) < 0.04) {
              anchor = sittingCatAtEdge(onDesk, desk.deskPosition, desk.deskRotationY, 0.84, 0.46);
              assignedSeat = seatId;
            }
          }
          if (!anchor) return 'Hãy chọn mép bàn của bạn hoặc nóc tủ.';
          const position = anchor.position;
          const existing = room?.roomDecorations() ?? shop.decorations;
          if (existing.some((placed) => Math.abs(placed.position[1] - position[1]) < 0.1 &&
            Math.hypot(placed.position[0] - position[0], placed.position[2] - position[2]) < 0.3)) {
            return 'Chỗ này đã có vật phẩm.';
          }
          shop.inventory[item] = count - 1;
          shop.decorations.push({ id, item, ...anchor, seatId: assignedSeat });
          break;
        }
        const position: ScenePoint | undefined = item === 'bed'
          ? floor ? [raw[0], 0, raw[2]] : undefined : deskPoint(raw, seatId);
        if (!position) return item === 'bed' ? 'Hãy chọn vị trí trên sàn.' : 'Hãy chọn vị trí trên bàn của bạn.';
        if (shop.decorations.some((placed) => Math.hypot(placed.position[0] - position[0], placed.position[2] - position[2]) < 0.3)) {
          return 'Chỗ này đã có vật phẩm.';
        }
        shop.inventory[item] = count - 1;
        shop.decorations.push({ id, item: item as DecorationItem, position, seatId: item === 'bed' ? undefined : seatId });
        break;
      }
      default:
        return 'Thao tác không hợp lệ.';
    }
  }
  stored.receipts[id] = signature;
}
