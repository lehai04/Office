// Hệ thống Dữ liệu & Đồng bộ cho Game "Nuôi Mèo Văn Phòng" (src/utils/officeCatsData.ts)

export type CatBreedId = 'orange' | 'white' | 'tuxedo' | 'calico' | 'gray';
export type CatActivity = 'walking' | 'playing' | 'sleeping';
export type CatItemCategory = 'food' | 'toy' | 'bed';

export interface CatBreedMeta {
  id: CatBreedId;
  name: string;
  badge: string;
  bodyColor: string;
  earColor: string;
  bellyColor: string;
}

export const CAT_BREEDS: CatBreedMeta[] = [
  {
    id: 'orange',
    name: 'Mèo Cam Mập',
    badge: '🍊 Hảo ăn • Quấn chủ',
    bodyColor: '#f97316',
    earColor: '#ea580c',
    bellyColor: '#ffedd5',
  },
  {
    id: 'white',
    name: 'Mèo Trắng Tuyết',
    badge: '❄️ Thanh lịch • Dịu dàng',
    bodyColor: '#f8fafc',
    earColor: '#f472b6',
    bellyColor: '#ffffff',
  },
  {
    id: 'tuxedo',
    name: 'Mèo Đen Đi Tất',
    badge: '🎩 Tinh nghịch • Nhanh nhẹn',
    bodyColor: '#1e293b',
    earColor: '#334155',
    bellyColor: '#f8fafc',
  },
  {
    id: 'calico',
    name: 'Mèo Tam Thể May Mắn',
    badge: '🌸 Đáng yêu • Gọi lộc',
    bodyColor: '#fbbf24',
    earColor: '#78350f',
    bellyColor: '#fef3c7',
  },
  {
    id: 'gray',
    name: 'Mèo Xám Lông Ngắn',
    badge: '☁️ Điềm tĩnh • Thích ngủ',
    bodyColor: '#64748b',
    earColor: '#475569',
    bellyColor: '#e2e8f0',
  },
];

export interface CatShopItem {
  id: string;
  name: string;
  icon: string;
  category: CatItemCategory;
  priceMerit: number; // Mua bằng tiền công đức của Phòng Tịnh Tâm
  fullnessBoost: number;
  happinessBoost: number;
  description: string;
}

export const CAT_SHOP_ITEMS: CatShopItem[] = [
  // 1. Thức ăn cho mèo
  {
    id: 'dried_fish',
    name: 'Cá khô nhỏ',
    icon: '🐟',
    category: 'food',
    priceMerit: 5,
    fullnessBoost: 20,
    happinessBoost: 10,
    description: 'Món ăn vặt giòn rụm thơm lừng cho bé mèo (+20 Độ no).',
  },
  {
    id: 'warm_milk',
    name: 'Sữa ấm cho mèo',
    icon: '🥛',
    category: 'food',
    priceMerit: 8,
    fullnessBoost: 25,
    happinessBoost: 15,
    description: 'Chén sữa ấm giúp bé mèo no bụng và ngủ ngon (+25 Độ no).',
  },
  {
    id: 'tuna_pate',
    name: 'Pate cá ngừ',
    icon: '🥫',
    category: 'food',
    priceMerit: 12,
    fullnessBoost: 40,
    happinessBoost: 25,
    description: 'Bữa chính giàu dinh dưỡng, mèo nào cũng mê (+40 Độ no).',
  },
  {
    id: 'ciao_treat',
    name: 'Súp thưởng Ciao',
    icon: '🍤',
    category: 'food',
    priceMerit: 15,
    fullnessBoost: 30,
    happinessBoost: 40,
    description: 'Món khoái khẩu giúp mèo quấn quýt cực đại (+30 Độ no, +40 Vui vẻ).',
  },
  // 2. Đệm ngủ & Đồ chơi (Có thể đặt ở khu vực bên ngoài văn phòng cho mèo dùng)
  {
    id: 'yarn_ball',
    name: 'Cuộn len cầu vồng',
    icon: '🧶',
    category: 'toy',
    priceMerit: 18,
    fullnessBoost: 0,
    happinessBoost: 35,
    description: 'Đồ chơi đặt ngoài sân văn phòng để các bé mèo vờn đùa.',
  },
  {
    id: 'feather_wand',
    name: 'Cần câu lông vũ',
    icon: '🪶',
    category: 'toy',
    priceMerit: 22,
    fullnessBoost: 0,
    happinessBoost: 45,
    description: 'Đồ chơi thu hút các bé mèo nhảy nhót ngoài sân.',
  },
  {
    id: 'daisy_bed',
    name: 'Đệm ngủ hoa cúc',
    icon: '🛏️',
    category: 'bed',
    priceMerit: 25,
    fullnessBoost: 0,
    happinessBoost: 50,
    description: 'Đệm êm đặt ở khu vực bên ngoài văn phòng cho mèo nằm ngủ.',
  },
  {
    id: 'royal_cushion',
    name: 'Đệm nhung hoàng gia',
    icon: '👑',
    category: 'bed',
    priceMerit: 35,
    fullnessBoost: 0,
    happinessBoost: 65,
    description: 'Chiếc ổ êm ái bậc nhất đặt ngoài sân vườn cho các bé mèo.',
  },
];

export interface OfficeCatProfile {
  ownerUserId: string;
  ownerNickname: string;
  catName: string;
  breedId: CatBreedId;
  activity: CatActivity;
  fullness: number; // 0..100
  happiness: number; // 0..100
  petCount: number;
  placedYardItems: string[]; // Danh sách id của toy/bed đã đặt ra khu vực ngoài văn phòng
  updatedAt: number;
}

export interface CatGiftRequest {
  id: string;
  requesterUserId: string;
  requesterNickname: string;
  catName: string;
  itemId: string;
  targetUserId: string | null; // null = đăng chung vào mục Quà tặng của phòng
  targetNickname: string | null;
  status: 'open' | 'fulfilled';
  fulfilledByNickname?: string;
  createdAt: number;
}

const STORAGE_ROOM_CATS_PREFIX = 'van_phong_ao_room_cats_v1:';
const STORAGE_MY_INVENTORY_PREFIX = 'van_phong_ao_cat_inventory_v1:';
const STORAGE_GIFT_REQUESTS_PREFIX = 'van_phong_ao_cat_gifts_v1:';

export function loadRoomCats(roomCode: string): Record<string, OfficeCatProfile> {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_ROOM_CATS_PREFIX}${roomCode}`);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, OfficeCatProfile>;
  } catch {
    return {};
  }
}

export function saveRoomCats(
  roomCode: string,
  catsMap: Record<string, OfficeCatProfile>
): void {
  try {
    window.localStorage.setItem(
      `${STORAGE_ROOM_CATS_PREFIX}${roomCode}`,
      JSON.stringify(catsMap)
    );
  } catch {
    // ignore
  }
}

export function loadMyCatInventory(userId: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_MY_INVENTORY_PREFIX}${userId}`);
    if (!raw) {
      // Tặng sẵn 1 phần Cá khô nhỏ khi mới bắt đầu để người chơi thử cho ăn hoặc tặng bạn bè
      const starter = { dried_fish: 1 };
      window.localStorage.setItem(
        `${STORAGE_MY_INVENTORY_PREFIX}${userId}`,
        JSON.stringify(starter)
      );
      return starter;
    }
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return { dried_fish: 1 };
  }
}

export function saveMyCatInventory(
  userId: string,
  inv: Record<string, number>
): void {
  try {
    window.localStorage.setItem(
      `${STORAGE_MY_INVENTORY_PREFIX}${userId}`,
      JSON.stringify(inv)
    );
  } catch {
    // ignore
  }
}

export function loadRoomGiftRequests(roomCode: string): CatGiftRequest[] {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_GIFT_REQUESTS_PREFIX}${roomCode}`);
    if (!raw) return [];
    return JSON.parse(raw) as CatGiftRequest[];
  } catch {
    return [];
  }
}

export function saveRoomGiftRequests(
  roomCode: string,
  requests: CatGiftRequest[]
): void {
  try {
    window.localStorage.setItem(
      `${STORAGE_GIFT_REQUESTS_PREFIX}${roomCode}`,
      JSON.stringify(requests)
    );
  } catch {
    // ignore
  }
}

export function getActivityLabel(act: CatActivity): string {
  if (act === 'playing') return '🧶 Đang chơi đùa';
  if (act === 'sleeping') return '💤 Đang nằm ngủ';
  return '🐾 Đang đi dạo';
}

