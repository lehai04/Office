// Hệ thống Dữ liệu & Tranh ghép cho Game "Ghép Tranh Cùng Phòng" (src/utils/officePuzzleData.ts)

export interface PuzzleArtwork {
  id: string;
  title: string;
  subtitle: string;
  gridCols: number;
  gridRows: number;
  imageUrl: string;
}

export interface PlacedPieceInfo {
  placedByNickname: string;
  placedAt: number;
}

export interface CompletedPuzzleEntry {
  id: string;
  artworkId: string;
  title: string;
  contributors: string[];
  completedAt: number;
}

export interface RoomPuzzleState {
  artworkId: string;
  placedPieces: Record<number, PlacedPieceInfo>;
  completedGallery: CompletedPuzzleEntry[];
  updatedAt: number;
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PUZZLE_ARTWORKS: PuzzleArtwork[] = [
  {
    id: 'cat_moon',
    title: 'Mèo Tịnh Tâm Dưới Trăng',
    subtitle: '3×3 (9 mảnh)',
    gridCols: 3,
    gridRows: 3,
    imageUrl: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
        <defs>
          <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1e1b4b"/>
            <stop offset="60%" stop-color="#4338ca"/>
            <stop offset="100%" stop-color="#f472b6"/>
          </linearGradient>
        </defs>
        <rect width="300" height="300" fill="url(#sky1)"/>
        <circle cx="230" cy="65" r="36" fill="#fef08a"/>
        <circle cx="55" cy="50" r="3" fill="#fff"/>
        <circle cx="110" cy="35" r="2.5" fill="#fff"/>
        <circle cx="165" cy="70" r="3" fill="#fff"/>
        <circle cx="270" cy="120" r="2" fill="#fff"/>
        <path d="M0 215 Q80 185 160 210 T300 205 L300 300 L0 300 Z" fill="#14532d"/>
        <path d="M0 245 Q120 225 300 250 L300 300 L0 300 Z" fill="#166534"/>
        <!-- Bé mèo cam ngồi ngắm trăng -->
        <ellipse cx="150" cy="215" rx="46" ry="38" fill="#f97316"/>
        <circle cx="150" cy="155" r="36" fill="#fb923c"/>
        <polygon points="120,135 128,100 144,125" fill="#ea580c"/>
        <polygon points="180,135 172,100 156,125" fill="#ea580c"/>
        <circle cx="136" cy="152" r="5" fill="#0f172a"/>
        <circle cx="164" cy="152" r="5" fill="#0f172a"/>
        <ellipse cx="150" cy="162" rx="4" ry="3" fill="#f43f5e"/>
        <path d="M188 225 Q225 215 215 180" stroke="#ea580c" stroke-width="12" fill="none" stroke-linecap="round"/>
        <circle cx="65" cy="255" r="10" fill="#fde047"/>
        <circle cx="245" cy="260" r="12" fill="#f9a8d4"/>
      </svg>
    `),
  },
  {
    id: 'lotus_zen',
    title: 'Hồ Sen Bình An',
    subtitle: '3×3 (9 mảnh)',
    gridCols: 3,
    gridRows: 3,
    imageUrl: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
        <defs>
          <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fde68a"/>
            <stop offset="50%" stop-color="#fca5a5"/>
            <stop offset="100%" stop-color="#0284c7"/>
          </linearGradient>
        </defs>
        <rect width="300" height="300" fill="url(#sky2)"/>
        <circle cx="150" cy="95" r="45" fill="#fef08a" opacity="0.9"/>
        <rect y="165" width="300" height="135" fill="#0369a1"/>
        <!-- Lá sen -->
        <ellipse cx="80" cy="240" rx="52" ry="18" fill="#16a34a"/>
        <ellipse cx="220" cy="245" rx="48" ry="16" fill="#15803d"/>
        <ellipse cx="155" cy="265" rx="60" ry="20" fill="#22c55e"/>
        <!-- Hoa sen hồng -->
        <ellipse cx="150" cy="205" rx="18" ry="38" fill="#f472b6"/>
        <ellipse cx="128" cy="212" rx="15" ry="32" transform="rotate(-25 128 212)" fill="#ec4899"/>
        <ellipse cx="172" cy="212" rx="15" ry="32" transform="rotate(25 172 212)" fill="#ec4899"/>
        <ellipse cx="110" cy="222" rx="12" ry="24" transform="rotate(-48 110 222)" fill="#f9a8d4"/>
        <ellipse cx="190" cy="222" rx="12" ry="24" transform="rotate(48 190 222)" fill="#f9a8d4"/>
        <circle cx="150" cy="225" r="12" fill="#facc15"/>
        <!-- Đèn lồng -->
        <rect x="45" y="30" width="24" height="34" rx="10" fill="#ef4444"/>
        <rect x="235" y="40" width="24" height="34" rx="10" fill="#f59e0b"/>
      </svg>
    `),
  },
  {
    id: 'milk_tea_friday',
    title: 'Trà Sữa Chiều Thứ Sáu',
    subtitle: '3×3 (9 mảnh)',
    gridCols: 3,
    gridRows: 3,
    imageUrl: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
        <rect width="300" height="300" fill="#fffbeb"/>
        <circle cx="60" cy="60" r="35" fill="#fde68a"/>
        <circle cx="250" cy="70" r="28" fill="#fbcfe8"/>
        <rect y="220" width="300" height="80" fill="#fed7aa"/>
        <!-- Ly trà sữa lớn -->
        <rect x="142" y="25" width="16" height="85" rx="5" fill="#ec4899"/>
        <polygon points="95,95 205,95 188,245 112,245" fill="#d97706"/>
        <polygon points="100,115 200,115 188,245 112,245" fill="#f59e0b"/>
        <ellipse cx="150" cy="95" rx="58" ry="12" fill="#fff"/>
        <!-- Trân châu -->
        <circle cx="130" cy="225" r="8" fill="#1e293b"/>
        <circle cx="150" cy="230" r="8" fill="#1e293b"/>
        <circle cx="170" cy="224" r="8" fill="#1e293b"/>
        <circle cx="140" cy="212" r="7" fill="#1e293b"/>
        <circle cx="162" cy="212" r="7" fill="#1e293b"/>
        <!-- Mặt cười trên ly -->
        <circle cx="135" cy="160" r="5" fill="#0f172a"/>
        <circle cx="165" cy="160" r="5" fill="#0f172a"/>
        <path d="M142 172 Q150 182 158 172" stroke="#0f172a" stroke-width="4" fill="none" stroke-linecap="round"/>
        <!-- Bánh donut bên cạnh -->
        <circle cx="65" cy="235" r="26" fill="#fb7185"/>
        <circle cx="65" cy="235" r="9" fill="#fed7aa"/>
      </svg>
    `),
  },
  {
    id: 'sunny_office',
    title: 'Văn Phòng Nắng Mai',
    subtitle: '3×3 (9 mảnh)',
    gridCols: 3,
    gridRows: 3,
    imageUrl: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
        <rect width="300" height="300" fill="#e0f2fe"/>
        <rect x="25" y="25" width="110" height="120" rx="8" fill="#7dd3fc" stroke="#0284c7" stroke-width="6"/>
        <circle cx="65" cy="65" r="20" fill="#fde047"/>
        <rect y="195" width="300" height="105" fill="#bae6fd"/>
        <!-- Bàn làm việc & Laptop -->
        <rect x="55" y="180" width="190" height="18" rx="4" fill="#92400e"/>
        <rect x="75" y="198" width="12" height="75" fill="#78350f"/>
        <rect x="213" y="198" width="12" height="75" fill="#78350f"/>
        <rect x="110" y="125" width="80" height="52" rx="5" fill="#334155"/>
        <rect x="116" y="131" width="68" height="40" fill="#38bdf8"/>
        <!-- Chậu cây xanh -->
        <polygon points="220,155 246,155 242,180 224,180" fill="#ea580c"/>
        <circle cx="233" cy="138" r="18" fill="#22c55e"/>
        <!-- Cốc cà phê -->
        <rect x="72" y="154" width="20" height="24" rx="4" fill="#f43f5e"/>
        <circle cx="245" cy="55" r="24" fill="#fff" opacity="0.85"/>
      </svg>
    `),
  },
];

const STORAGE_PUZZLE_PREFIX = 'van_phong_ao_room_puzzle_v1:';

export function createDefaultPuzzleState(): RoomPuzzleState {
  return {
    artworkId: PUZZLE_ARTWORKS[0].id,
    placedPieces: {},
    completedGallery: [],
    updatedAt: Date.now(),
  };
}

export function loadRoomPuzzleState(roomCode: string): RoomPuzzleState {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PUZZLE_PREFIX}${roomCode}`);
    if (!raw) return createDefaultPuzzleState();
    const parsed = JSON.parse(raw) as RoomPuzzleState;
    if (parsed && parsed.artworkId && parsed.placedPieces) {
      return {
        ...createDefaultPuzzleState(),
        ...parsed,
      };
    }
    return createDefaultPuzzleState();
  } catch {
    return createDefaultPuzzleState();
  }
}

export function saveRoomPuzzleState(
  roomCode: string,
  state: RoomPuzzleState
): void {
  try {
    window.localStorage.setItem(
      `${STORAGE_PUZZLE_PREFIX}${roomCode}`,
      JSON.stringify(state)
    );
  } catch {
    // ignore
  }
}
