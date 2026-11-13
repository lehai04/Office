export interface SeatTransform {
  seatId: string;
  label: string;
  shortLabel: string;
  zone: 'top_row' | 'lower_row_1' | 'lower_row_2' | 'right_wall';
  zoneLabel: string;
  chairPosition: [number, number, number];
  deskPosition: [number, number, number];
  chairRotationY: number; // Hướng nhân vật nhìn khi ngồi vào bàn
  deskRotationY: number;
}

export interface MeetingChairTransform {
  id: string;
  shortLabel: string;
  label: string;
  position: [number, number, number];
  rotationY: number;
}

export const DEFAULT_ROOM_CODE = 'TINHTAM';
export const DEFAULT_ROOM_NAME = 'Văn phòng Tịnh Tâm';

/**
 * 8 ghế làm việc cố định bám sát 100% ảnh sơ đồ:
 * - 2 ghế ở dãy trên (seat-top-1, seat-top-2): Ghế ở phía trên (-Z), nhìn xuống bàn (+Z, rotationY = 0)
 * - 4 ghế ở hai dãy phía dưới (seat-mid-1, seat-mid-2 cụm trái; seat-bot-1, seat-bot-2 cụm phải):
 *   Ghế ở phía dưới bàn (+Z), nhìn lên bàn (-Z, rotationY = Math.PI)
 * - 2 ghế sát tường phải (seat-right-1 trên, seat-right-2 dưới, có chậu cây xen giữa):
 *   Ghế ở bên phải bàn (+X), nhìn sang trái vào bàn (-X, rotationY = -Math.PI / 2)
 */
export const WORK_SEAT_LAYOUTS: SeatTransform[] = [
  // 1. Dãy trên (2 ghế ở nửa trên bên trái, phía trên bàn họp)
  {
    seatId: 'seat-top-1',
    label: 'Bàn A1 — Dãy trên (Trái)',
    shortLabel: 'A1',
    zone: 'top_row',
    zoneLabel: 'Dãy trên',
    chairPosition: [-4.3, 0, -4.05],
    deskPosition: [-4.3, 0, -3.2],
    chairRotationY: 0, // Nhìn xuống (+Z) về phía bàn
    deskRotationY: 0,
  },
  {
    seatId: 'seat-top-2',
    label: 'Bàn A2 — Dãy trên (Phải)',
    shortLabel: 'A2',
    zone: 'top_row',
    zoneLabel: 'Dãy trên',
    chairPosition: [-2.45, 0, -4.05],
    deskPosition: [-2.45, 0, -3.2],
    chairRotationY: 0, // Nhìn xuống (+Z) về phía bàn
    deskRotationY: 0,
  },

  // 2. Hai dãy phía dưới (4 ghế chia làm 2 cụm bàn đôi ngang phía dưới, ghế ở dưới nhìn lên -Z)
  {
    seatId: 'seat-mid-1',
    label: 'Bàn B1 — Dãy dưới cụm trái (Trái)',
    shortLabel: 'B1',
    zone: 'lower_row_1',
    zoneLabel: 'Dãy dưới (Cụm trái)',
    chairPosition: [-4.3, 0, 2.85],
    deskPosition: [-4.3, 0, 2.0],
    chairRotationY: Math.PI, // Nhìn lên (-Z) về phía bàn
    deskRotationY: 0,
  },
  {
    seatId: 'seat-mid-2',
    label: 'Bàn B2 — Dãy dưới cụm trái (Phải)',
    shortLabel: 'B2',
    zone: 'lower_row_1',
    zoneLabel: 'Dãy dưới (Cụm trái)',
    chairPosition: [-2.45, 0, 2.85],
    deskPosition: [-2.45, 0, 2.0],
    chairRotationY: Math.PI,
    deskRotationY: 0,
  },
  {
    seatId: 'seat-bot-1',
    label: 'Bàn C1 — Dãy dưới cụm phải (Trái)',
    shortLabel: 'C1',
    zone: 'lower_row_2',
    zoneLabel: 'Dãy dưới (Cụm phải)',
    chairPosition: [0.55, 0, 2.85],
    deskPosition: [0.55, 0, 2.0],
    chairRotationY: Math.PI, // Nhìn lên (-Z) về phía bàn
    deskRotationY: 0,
  },
  {
    seatId: 'seat-bot-2',
    label: 'Bàn C2 — Dãy dưới cụm phải (Phải)',
    shortLabel: 'C2',
    zone: 'lower_row_2',
    zoneLabel: 'Dãy dưới (Cụm phải)',
    chairPosition: [2.4, 0, 2.85],
    deskPosition: [2.4, 0, 2.0],
    chairRotationY: Math.PI,
    deskRotationY: 0,
  },

  // 3. Sát tường phải (2 bàn dọc bên phải, ghế nằm bên phải bàn nhìn sang trái -X)
  {
    seatId: 'seat-right-1',
    label: 'Bàn D1 — Sát tường phải (Trên)',
    shortLabel: 'D1',
    zone: 'right_wall',
    zoneLabel: 'Sát tường phải',
    chairPosition: [6.4, 0, -1.25],
    deskPosition: [5.55, 0, -1.25],
    chairRotationY: -Math.PI / 2, // Nhìn sang trái (-X) vào mặt bàn
    deskRotationY: Math.PI / 2,
  },
  {
    seatId: 'seat-right-2',
    label: 'Bàn D2 — Sát tường phải (Dưới)',
    shortLabel: 'D2',
    zone: 'right_wall',
    zoneLabel: 'Sát tường phải',
    chairPosition: [6.4, 0, 1.85],
    deskPosition: [5.55, 0, 1.85],
    chairRotationY: -Math.PI / 2, // Nhìn sang trái (-X) vào mặt bàn
    deskRotationY: Math.PI / 2,
  },
];

/**
 * 6 ghế bàn họp dùng chung ở nửa trái phòng (ngồi tự do, nằm ngoài danh sách 8 ghế đăng ký cố định):
 * - 2 ghế phía trên bàn họp nhìn xuống (+Z)
 * - 2 ghế phía dưới bàn họp nhìn lên (-Z)
 * - 1 ghế đầu trái bàn họp nhìn sang phải (+X)
 * - 1 ghế đầu phải bàn họp nhìn sang trái (-X)
 */
export const MEETING_TABLE_POSITION: [number, number, number] = [-3.38, 0, -0.55];

export const MEETING_CHAIRS: MeetingChairTransform[] = [
  // 2 ghế cạnh trên bàn họp
  {
    id: 'meet-top-1',
    shortLabel: 'H1',
    label: 'Ghế họp H1 (Cạnh trên - Trái)',
    position: [-4.05, 0, -1.65],
    rotationY: 0,
  },
  {
    id: 'meet-top-2',
    shortLabel: 'H2',
    label: 'Ghế họp H2 (Cạnh trên - Phải)',
    position: [-2.7, 0, -1.65],
    rotationY: 0,
  },
  // 2 ghế cạnh dưới bàn họp
  {
    id: 'meet-bot-1',
    shortLabel: 'H3',
    label: 'Ghế họp H3 (Cạnh dưới - Trái)',
    position: [-4.05, 0, 0.55],
    rotationY: Math.PI,
  },
  {
    id: 'meet-bot-2',
    shortLabel: 'H4',
    label: 'Ghế họp H4 (Cạnh dưới - Phải)',
    position: [-2.7, 0, 0.55],
    rotationY: Math.PI,
  },
  // 1 ghế đầu trái bàn họp
  {
    id: 'meet-left',
    shortLabel: 'H5',
    label: 'Ghế họp H5 (Đầu bàn Trái)',
    position: [-5.15, 0, -0.55],
    rotationY: Math.PI / 2,
  },
  // 1 ghế đầu phải bàn họp
  {
    id: 'meet-right',
    shortLabel: 'H6',
    label: 'Ghế họp H6 (Đầu bàn Phải)',
    position: [-1.6, 0, -0.55],
    rotationY: -Math.PI / 2,
  },
];

/**
 * Các vị trí đứng lệch nhau ở vùng trống gần cửa ra vào (góc trên bên phải, bên phải tủ ngăn giữa)
 * để nhiều nhân vật chưa chọn ghế hoặc hết ghế không bị chồng lên nhau.
 */
export const DOOR_STANDING_SLOTS: Array<{ position: [number, number, number]; rotationY: number }> = [
  { position: [3.8, 0, -3.6], rotationY: 0 },
  { position: [4.9, 0, -3.4], rotationY: -0.25 },
  { position: [2.7, 0, -3.3], rotationY: 0.2 },
  { position: [3.4, 0, -2.3], rotationY: 0.1 },
  { position: [4.5, 0, -2.2], rotationY: -0.2 },
  { position: [2.5, 0, -2.0], rotationY: 0.25 },
  { position: [3.9, 0, -1.1], rotationY: -0.1 },
  { position: [2.8, 0, -0.9], rotationY: 0.15 },
  { position: [5.2, 0, -4.1], rotationY: -0.35 },
  { position: [1.9, 0, -2.8], rotationY: 0.3 },
];
