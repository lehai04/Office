export const BOXING = {
  centerZ: 18,
  width: 13.2,
  depth: 8.8,
  ringX: -3,
  ringZ: 17.2,
  ringHalfWidth: 2.4,
  ringHalfDepth: 2.3,
  fishX: 3.35,
  fishZ: 17.35,
  spawn: [0, 0, 21.65] as [number, number, number],
  maxHp: 60,
  damage: 12,
  recoveryMs: 4800,
  punchRange: 1.38,
  punchDelayMs: 420,
  counterDelayMs: 1200,
  officeMeritCost: 5,
  presenceMs: 16_000,
} as const;

export type BoxingZone = 'office' | 'boxing' | 'away';
export type BoxingPosition = { zone: Exclude<BoxingZone, 'away'>; x: number; z: number };
export type BoxingHit = {
  id: string;
  attacker: string;
  target?: string;
  at: number;
};
export interface BoxingView {
  fighters: Record<string, BoxingPosition>;
  hits: BoxingHit[];
  fishHp: number;
  fishRecoverAt: number;
  merit: number;
  serverTime: number;
}

export const FISH_ID = 'boxing-fish';
export const inBoxingRing = ({ x, z }: BoxingPosition) =>
  Math.abs(x - BOXING.ringX) <= BOXING.ringHalfWidth && Math.abs(z - BOXING.ringZ) <= BOXING.ringHalfDepth;
export const BOXING_MAP = {
  scale: 0.72,
  x: 8.8,
  z: -8.65,
} as const;

export const BOXING_MAP_OFFSET: [number, number, number] = [
  BOXING_MAP.x, 0, BOXING_MAP.z - BOXING.centerZ * BOXING_MAP.scale,
];

export function boxingMapPoint(x: number, y: number, z: number): [number, number, number] {
  return [BOXING_MAP.x + x * BOXING_MAP.scale, y * BOXING_MAP.scale,
    BOXING_MAP.z + (z - BOXING.centerZ) * BOXING_MAP.scale];
}

export function boxingRoomPoint(x: number, z: number): [number, number, number] {
  return [(x - BOXING_MAP.x) / BOXING_MAP.scale, 0,
    BOXING.centerZ + (z - BOXING_MAP.z) / BOXING_MAP.scale];
}
