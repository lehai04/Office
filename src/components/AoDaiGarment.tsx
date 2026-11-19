import { aoDaiPalette, type AoDaiColors, type AoDaiItem } from '../utils/aoDai';

function Block({ at, size, color, turn = 0 }: {
  at: [number, number, number]; size: [number, number, number]; color: string; turn?: number;
}) {
  return <mesh position={at} rotation-z={turn} castShadow>
    <boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.8} />
  </mesh>;
}

// Coordinates are relative to the existing avatar hip, in the same units as its torso.
export function AoDaiGarment({ item, seated, colors }: { item: AoDaiItem; seated: boolean; colors?: AoDaiColors }) {
  const palette = aoDaiPalette(item, colors);
  return <group>
    <Block at={[0, 0.635, 0]} size={[0.25, 0.055, 0.245]} color={palette.cloth} />
    <Block at={[0, 0.662, 0]} size={[0.255, 0.012, 0.25]} color={palette.trim} />
    <Block at={[0.075, 0.55, 0.132]} size={[0.018, 0.20, 0.016]} color={palette.trim} turn={-0.85} />
    {[0, 1, 2].map((i) => <Block key={i} at={[0.024 + i * 0.041, 0.50 + i * 0.036, 0.144]}
      size={[0.036, 0.014, 0.016]} color={palette.trim} turn={0.55} />)}
    {/* Front folds over the thighs while seated. The shorter back clears the seat. */}
    <group position={[0, 0.11, 0.145]} rotation-x={seated ? -1.40 : 0}>
      <Block at={[0, -0.29, 0]} size={[0.405, 0.58, 0.035]} color={palette.cloth} />
      {item === 'ao_dai_truc_vang' ? <group position={[0.10, -0.43, 0.026]}>
        {[0, 1].map((stem) => <group key={stem} position-x={stem * 0.045}>
          <Block at={[0, 0, 0]} size={[0.016, 0.24, 0.012]} color={palette.trim} />
          {[-0.08, -0.01, 0.06].map((y) => <Block key={y} at={[0, y, 0.008]}
            size={[0.025, 0.009, 0.009]} color="#f4d78e" />)}
        </group>)}
        {[0, 1, 2].map((leaf) => <Block key={leaf} at={[-0.026, leaf * 0.07 - 0.045, 0.009]}
          size={[0.065, 0.018, 0.014]} color={palette.trim} turn={leaf % 2 ? 0.65 : -0.60} />)}
      </group> : <group position={[0.105, -0.43, 0.028]}>
        <Block at={[0, -0.027, 0]} size={[0.012, 0.16, 0.012]} color={palette.trim} />
        {[-1, 0, 1].map((petal) => <Block key={petal} at={[petal * 0.034, 0.06 - Math.abs(petal) * 0.014, 0.01]}
          size={[0.033, 0.075, 0.018]} color={petal === 0 ? '#ffe0d6' : '#efb5b4'} turn={petal * -0.52} />)}
        {[-1, 1].map((side) => <Block key={side} at={[side * 0.035, -0.065, 0.008]}
          size={[0.060, 0.024, 0.014]} color={palette.trim} turn={side * 0.45} />)}
      </group>}
    </group>
    <group position={[0, 0.11, -0.145]} rotation-x={seated ? 0.28 : 0}>
      <Block at={[0, seated ? -0.12 : -0.29, 0]} size={[0.405, seated ? 0.24 : 0.58, 0.035]} color={palette.cloth} />
    </group>
  </group>;
}
