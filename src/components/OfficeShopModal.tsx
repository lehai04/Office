import { formatVnd } from '../utils/officeEconomyData';
import { OFFICE_SHOP, type OfficeShopState, type ShopItem } from '../utils/officeShop';

interface Props {
  balance: number;
  shop: OfficeShopState;
  onClose: () => void;
  onBuy: (item: ShopItem) => void;
  onUse: (item: ShopItem) => void;
  onRemove: (id: string) => void;
}

export function OfficeShopModal({ balance, shop, onClose, onBuy, onUse, onRemove }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3">
      <section role="dialog" aria-modal="true" aria-label="Cửa hàng văn phòng"
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-slate-900 p-4 text-sm text-slate-100">
        <header className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Cửa hàng văn phòng</h2>
            <p className="text-emerald-300">{formatVnd(balance)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-white/10 px-3 py-2">Đóng</button>
        </header>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(OFFICE_SHOP) as ShopItem[]).map((id) => {
            const item = OFFICE_SHOP[id];
            const quantity = shop.inventory[id] ?? 0;
            const permanent = item.kind === 'equip' || item.kind === 'action';
            const useLabel = item.kind === 'decor' ? 'Đặt' : id === 'incense' ? 'Thắp' : id === 'offering' ? 'Dâng' :
              id === 'outfit' ? (shop.outfit ? 'Tháo' : 'Mặc') : 'Thực hiện';
            return (
              <li key={id} className="rounded-xl border border-white/10 p-3">
                <div className="font-semibold">{item.icon} {item.name}</div>
                <div className="mb-2 text-xs text-slate-400">Trong túi: {quantity}</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onBuy(id)}
                    disabled={balance < item.price || (permanent && quantity > 0)}
                    className="rounded-lg bg-emerald-500 px-2 py-1 font-semibold text-slate-950 disabled:opacity-40">
                    Mua {formatVnd(item.price)}
                  </button>
                  {quantity > 0 && <button type="button" onClick={() => onUse(id)} className="rounded-lg bg-white/10 px-2 py-1">{useLabel}</button>}
                </div>
              </li>
            );
          })}
        </ul>
        {shop.decorations.length > 0 && (
          <ul className="mt-4 space-y-2">
            {shop.decorations.map(({ id, item }) => (
              <li key={id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
                <span>{OFFICE_SHOP[item].name} đang đặt trong phòng</span>
                <button type="button" onClick={() => onRemove(id)} className="rounded-lg bg-white/10 px-2 py-1">Thu về túi</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
