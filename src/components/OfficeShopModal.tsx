import { useEffect, useId, useRef, useState } from 'react';
import { formatVnd } from '../utils/officeEconomyData';
import { OFFICE_SHOP, SHOP_CATEGORIES, equippedItems, type OfficeShopState, type ShopItem } from '../utils/officeShop';
import { ShopVoxel } from './ShopVoxel';
import './OfficeShopModal.css';

interface Props {
  balance: number;
  connectionError?: string;
  shop: OfficeShopState;
  onClose: () => void;
  onBuy: (item: ShopItem, requestId: string) => void | Promise<void>;
  onUse: (item: ShopItem) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
}

type Category = keyof typeof SHOP_CATEGORIES;
const items = Object.keys(OFFICE_SHOP) as ShopItem[];
const categories = Object.keys(SHOP_CATEGORIES) as Category[];
const itemColors: Partial<Record<ShopItem, string>> = {
  outfit: '#efdcfa', dance: '#ffdfed', incense: '#ffedca', computer: '#e1e9ff',
  offering: '#ffe0dc', plant: '#dcf5e8', headstand: '#ffe9e0', lamp: '#fff1cc',
};
const categoryIcons = { all: '💻', outfit: '👕', action: '💃', altar: '🪷', equipment: '💻', decor: '🪴' };

function normalizeName(value: string): string {
  return value.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').trim();
}

export function OfficeShopModal({ balance, shop, connectionError, onClose, onBuy, onUse, onRemove }: Props) {
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const sheetClose = useRef<HTMLButtonElement>(null);
  const operation = useRef(false);
  const previewTimer = useRef<number>();
  const [tab, setTab] = useState<'store' | 'bag'>('store');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'default' | 'low' | 'high'>('default');
  const [selected, setSelected] = useState<ShopItem>('outfit');
  const [sheet, setSheet] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [buyIntent, setBuyIntent] = useState<{ item: ShopItem; id: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      window.clearTimeout(previewTimer.current);
    };
  }, []);

  useEffect(() => {
    if (sheet && sheetClose.current?.getClientRects().length) sheetClose.current.focus({ preventScroll: true });
  }, [sheet]);

  useEffect(() => {
    const region = list.current;
    if (!region) return;
    region.inert = sheet;
    if (!sheet) trigger.current?.focus({ preventScroll: true });
    return () => { region.inert = false; };
  }, [sheet]);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)');
    const resetSheet = () => { if (!mobile.matches) setSheet(false); };
    mobile.addEventListener('change', resetSheet);
    return () => mobile.removeEventListener('change', resetSheet);
  }, []);

  const placed = (id: ShopItem) => shop.decorations.filter(({ item }) => item === id);
  const quantity = (id: ShopItem) => shop.inventory[id] ?? 0;
  const source = tab === 'store' ? items.filter((id) => id !== 'bed') : items.filter((id) => quantity(id) || placed(id).length);
  const visible = source.filter((id) =>
    (category === 'all' || OFFICE_SHOP[id].category === category) &&
    normalizeName(OFFICE_SHOP[id].name).includes(normalizeName(query))
  );
  if (sort !== 'default') visible.sort((a, b) => (OFFICE_SHOP[a].price - OFFICE_SHOP[b].price) * (sort === 'low' ? 1 : -1));
  const active = visible.includes(selected) ? selected : visible[0];
  const selectedItem = active ? OFFICE_SHOP[active] : undefined;
  const owned = active ? quantity(active) : 0;
  const placements = active ? placed(active) : [];
  const permanent = selectedItem?.kind === 'equip' || selectedItem?.kind === 'action';
  const canBuy = Boolean(selectedItem && balance >= selectedItem.price && !(permanent && owned));
  const equipped = Object.values(equippedItems(shop));
  const status = (id: ShopItem) => {
    if (equipped.some((item) => item === id)) return 'Đang mặc';
    if (placed(id).length) return 'Đã đặt';
    if (quantity(id) && ['equip', 'action'].includes(OFFICE_SHOP[id].kind)) return 'Đã sở hữu';
    return quantity(id) ? `Trong túi: ${quantity(id)}` : 'Chưa sở hữu';
  };

  const closeSheet = () => {
    setBuyIntent(null);
    setSheet(false);
  };

  const openItem = (id: ShopItem, button: HTMLButtonElement) => {
    window.clearTimeout(previewTimer.current);
    setPreviewing(false);
    setError('');
    setSelected(id);
    setBuyIntent(null);
    trigger.current = button;
    if (window.matchMedia('(max-width: 767px)').matches) setSheet(true);
  };

  const changeTab = (next: 'store' | 'bag') => {
    setTab(next);
    setBuyIntent(null);
    setCategory('all');
    setQuery('');
    setError('');
    trigger.current = null;
    setSheet(false);
    list.current?.scrollTo({ top: 0 });
  };

  const run = async (action: () => void | Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setPending(true);
    setError('');
    try {
      await action();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Chưa thể thực hiện thao tác.');
    } finally {
      operation.current = false;
      setPending(false);
    }
  };

  const preview = () => {
    window.clearTimeout(previewTimer.current);
    setPreviewing(true);
    previewTimer.current = window.setTimeout(() => setPreviewing(false), 1800);
  };

  return (
    <dialog ref={dialog} aria-labelledby={title} className="office-shop"
      onCancel={(event) => { event.preventDefault(); if (sheet) closeSheet(); else onClose(); }}>
      <header className="office-shop__header">
        <div className="office-shop__title">
          <span className="office-shop__mark" aria-hidden="true">◆</span>
          <div><h2 id={title}>Cửa hàng văn phòng</h2><p>Trang phục, hành động và đồ dùng trong game</p></div>
        </div>
        <nav aria-label="Khu vực cửa hàng" className="office-shop__tabs">
          <strong className="office-shop__balance" aria-label={`Số dư ${formatVnd(balance)}`}>{formatVnd(balance)}</strong>
          <button type="button" aria-pressed={tab === 'store'} onClick={() => changeTab('store')}>Cửa hàng</button>
          <button type="button" aria-pressed={tab === 'bag'} onClick={() => changeTab('bag')}>Túi đồ {items.filter((id) => quantity(id) || placed(id).length).length}</button>
        </nav>
        <button type="button" className="office-shop__close" onClick={onClose} aria-label="Đóng cửa hàng">×</button>
      </header>

      <div className="office-shop__layout">
        <nav className="office-shop__categories" aria-label="Danh mục vật phẩm">
          <h3>Danh mục</h3>
          {(['all', ...categories] as const).map((key) => {
            const count = key === 'all' ? source.length : source.filter((id) => OFFICE_SHOP[id].category === key).length;
            return <button key={key} type="button" aria-pressed={category === key} onClick={() => setCategory(key)}>
              <span aria-hidden="true">{categoryIcons[key]}</span>
              <span>{key === 'all' ? 'Tất cả' : SHOP_CATEGORIES[key]}</span>
              <small>{count}</small>
            </button>;
          })}
        </nav>
        <div className="office-shop__list" ref={list}>
          {tab === 'store' && <div className="office-shop__hero">
            <div><h3>Trang bị cho Office</h3><p>Thử trang phục, mở khóa hành động và sắm đồ cho từng phòng.</p></div>
            <div aria-hidden="true" className="office-shop__hero-art"><ShopVoxel item="computer" /><ShopVoxel item="plant" /></div>
          </div>}
          <div className="office-shop__filters">
            <h3>{category === 'all' ? (tab === 'store' ? 'Tất cả vật phẩm' : 'Vật phẩm của bạn') : SHOP_CATEGORIES[category]}</h3>
            <div>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Tìm vật phẩm" placeholder="Tìm vật phẩm…" />
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sắp xếp theo giá">
                <option value="default">Mặc định</option><option value="low">Giá tăng dần</option><option value="high">Giá giảm dần</option>
              </select>
            </div>
          </div>
          {visible.length === 0 ? <p className="office-shop__empty" role="status">{!source.length ? 'Túi đồ đang trống.' : 'Không tìm thấy vật phẩm phù hợp.'}</p> : (
            <ul className="office-shop__grid">
              {visible.map((id) => {
                const item = OFFICE_SHOP[id];
                return <li key={id}>
                  <button type="button" className="office-shop__card" aria-pressed={active === id}
                    onClick={(event) => openItem(id, event.currentTarget)}>
                    <span className="office-shop__art" style={{ backgroundColor: itemColors[id] ?? '#eee4ff' }}><ShopVoxel item={id} /></span>
                    <strong>{item.name}</strong>
                    <small>{SHOP_CATEGORIES[item.category]}</small>
                    <span className="office-shop__card-footer"><b>{formatVnd(item.price)}</b><small>{status(id)}</small></span>
                  </button>
                </li>;
              })}
            </ul>
          )}
        </div>

        {sheet && <button type="button" className="office-shop__scrim" onClick={closeSheet} tabIndex={-1} aria-hidden="true" />}
        {active && selectedItem && (
          <aside className={`office-shop__detail${sheet ? ' office-shop__detail--open' : ''}`} aria-label="Xem trước vật phẩm">
            <div className="office-shop__detail-heading"><h3>Xem trước</h3>
              <button type="button" ref={sheetClose} onClick={closeSheet} aria-label="Đóng chi tiết">×</button>
            </div>
            <div className="office-shop__preview" style={{ backgroundColor: itemColors[active] ?? '#eee4ff' }}>
              <div className={previewing ? `office-shop__motion office-shop__motion--${active}` : undefined}>
                <ShopVoxel item={active} />
              </div>
            </div>
            <h4>{selectedItem.name}</h4>
            <p>{selectedItem.description}</p>
            <div className="office-shop__detail-meta"><strong>{formatVnd(selectedItem.price)}</strong><span>{status(active)}</span></div>
            <p>Trong túi: {owned}</p>
            {tab === 'store' && (!(permanent && owned > 0) || buyIntent?.item === active) && (
              buyIntent?.item === active ? <>
                <button className="office-shop__primary" type="button" disabled={!canBuy || pending}
                  onClick={() => void run(async () => { await onBuy(active, buyIntent.id); setBuyIntent(null); })}>
                  Xác nhận mua · {formatVnd(selectedItem.price)}
                </button>
                <button className="office-shop__secondary" type="button" disabled={pending} onClick={() => setBuyIntent(null)}>Hủy mua</button>
              </> : <button className="office-shop__primary" type="button" disabled={!canBuy || pending}
                onClick={() => setBuyIntent({ item: active, id: crypto.randomUUID() })}>Mua · {formatVnd(selectedItem.price)}</button>
            )}
            {tab === 'store' && balance < selectedItem.price && !(permanent && owned > 0) && <p role="status">Không đủ số dư.</p>}
            {selectedItem.kind === 'action' && <button type="button" className="office-shop__secondary" onClick={preview}>Thử hiệu ứng</button>}
            {!!owned && (tab === 'bag' || selectedItem.kind !== 'equip') && (
              <button type="button" className={tab === 'bag' ? 'office-shop__primary' : 'office-shop__secondary'} disabled={pending}
                onClick={() => void run(() => onUse(active))}>
                {selectedItem.kind === 'decor' ? 'Đặt vật phẩm' : selectedItem.kind === 'equip' ? (equipped.some((item) => item === active) ? 'Tháo' : 'Mặc') :
                  active === 'incense' ? 'Thắp nhang' : selectedItem.kind === 'consumable' ? 'Dâng lễ' : 'Thực hiện'}
              </button>
            )}
            {tab === 'bag' && placements.map(({ id }, index) => (
              <button key={id} type="button" className="office-shop__secondary" disabled={pending}
                onClick={() => void run(() => onRemove(id))}>Cất vào túi{placements.length > 1 ? ` · món ${index + 1}` : ''}</button>
            ))}
            {(error || connectionError) && <p role="alert" className="office-shop__error">{error || connectionError}</p>}
          </aside>
        )}
      </div>
    </dialog>
  );
}
