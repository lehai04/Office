import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { BOXING, FISH_ID, boxingRoomPoint, type BoxingHit, type BoxingView } from '../utils/boxing';
import type { ScenePoint } from '../utils/officeShop';

function Block({ at, size, color }: { at: ScenePoint; size: ScenePoint; color: string }) {
  return <mesh position={at} castShadow receiveShadow>
    <boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.78} />
  </mesh>;
}

const gold = '#fcca69';
const navy = '#29334d';
const plum = '#463064';
const violet = '#7854b1';
const ring = BOXING.ringX;
const ringZ = BOXING.ringZ;
const fishX = BOXING.fishX;
const fishZ = BOXING.fishZ;

function SquareStars({ point, hit }: { point: ScenePoint; hit?: BoxingHit }) {
  const stars = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!stars.current) return;
    const age = hit ? (Date.now() - hit.at) / 620 : 0;
    stars.current.visible = age < 1;
    stars.current.rotation.y = clock.elapsedTime * 5.2;
    stars.current.position.y = point[1] + (hit ? Math.max(0, Math.min(age, 1)) * 0.33 : 0);
    stars.current.scale.setScalar(hit ? 0.7 + Math.min(age, 1) * 0.85 : 1);
  });
  return <group ref={stars} position={point}>
    {Array.from({ length: 5 }, (_, i) => {
      const a = i * Math.PI * 0.4;
      const x = Math.cos(a) * 0.46;
      const z = Math.sin(a) * 0.46;
      return <group key={i} position={[x, 0.09 * (i % 3), z]} rotation={[0, -a, i * 0.2]}>
        <Block at={[0, 0, 0]} size={[0.17, 0.045, 0.045]} color={hit?.attacker === FISH_ID ? "#c38aff" : gold} />
        <Block at={[0, 0, 0]} size={[0.045, 0.17, 0.046]} color="#fff2a8" />
      </group>;
    })}
  </group>;
}

export function BoxingImpact({ point, hit }: { point: ScenePoint; hit: BoxingHit }) {
  return <SquareStars point={[point[0], point[1] + 1.12, point[2]]} hit={hit} />;
}

export function BoxingRoom({ view, onFloor }: { view: BoxingView | null; onFloor?: (point: ScenePoint, isTouch: boolean) => void }) {
  const fish = useRef<Group>(null);
  const glove = useRef<Group>(null);
  const knockout = view?.fishHp === 0;
  const recentHit = view?.hits.filter((hit) => hit.target === FISH_ID).at(-1);
  const counter = view?.hits.filter((hit) => hit.attacker === FISH_ID).at(-1);
  useFrame(({ clock }) => {
    if (!fish.current || !glove.current) return;
    const struck = Boolean(recentHit && Date.now() - recentHit.at < 280);
    const throwing = Boolean(counter && Date.now() - counter.at < 270);
    const target = counter?.target ? view?.fighters[counter.target] : undefined;
    fish.current.position.y = knockout ? -0.44 : Math.sin(clock.elapsedTime * 2.7) * 0.027;
    fish.current.rotation.x = knockout ? -0.27 : struck ? -0.13 : 0;
    if (throwing && target) fish.current.rotation.y = Math.atan2(target.x - fishX, target.z - fishZ);
    glove.current.position.z = throwing ? 0.46 : 0;
  });
  return <group>
    <group position={[0, 0, BOXING.centerZ]}>
      <mesh position={[0,-0.08,0]} receiveShadow onClick={onFloor ? (event) => {
        event.stopPropagation();
        onFloor(boxingRoomPoint(event.point.x, event.point.z), (event.nativeEvent as PointerEvent).pointerType === 'touch');
      } : undefined}>
        <boxGeometry args={[BOXING.width,0.16,BOXING.depth]} /><meshStandardMaterial color="#707083" />
      </mesh>
      <Block at={[0,0.86,-4.38]} size={[13.2,1.72,.17]} color={navy} />
      {[-6.52,6.52].map((x) => <Block key={x} at={[x,0.62,0]} size={[.16,1.24,8.8]} color={plum} />)}
      {[-4.8,0,4.8].map((x) => <Block key={x} at={[x,1.23,-4.25]} size={[.46,.35,.17]} color={gold} />)}
      <Block at={[0,0.006,3.08]} size={[1.32,.014,2.5]} color={violet} />
      {[-4.8,-2.5,3.15,5.2].map((x) => <group key={x} position={[x,0,3.62]}>
        <Block at={[0,.19,0]} size={[1.55,.28,.49]} color={navy} />
        <Block at={[0,.36,0]} size={[1.58,.13,.54]} color="#d99d59" />
      </group>)}
    </group>
    <group position={[ring,0,ringZ]}>
      <Block at={[0,.045,0]} size={[4.8,.09,4.6]} color={plum} />
      <Block at={[0,.097,0]} size={[4.55,.035,4.38]} color={violet} />
      <Block at={[0,.12,0]} size={[1.15,.02,.82]} color="#a785d2" />
      {[-2.34,2.34].flatMap((x) => [-2.24,2.24].map((z) =>
        <Block key={x + ':' + z} at={[x,.56,z]} size={[.23,1.12,.23]} color={x * z < 0 ? '#eb6686' : '#9a69d7'} />
      ))}
      {[.48,.77].map((y) => <group key={y}>
        <Block at={[0,y,-2.24]} size={[4.68,.043,.043]} color="#f6dbbc" />
        {[-2.34,2.34].map((x) => <Block key={x} at={[x,y,0]} size={[.043,.043,4.48]} color="#f6dbbc" />)}
        {[-1.52,1.52].map((x) => <Block key={x} at={[x,y,2.24]} size={[1.58,.043,.043]} color="#f6dbbc" />)}
      </group>)}
    </group>
    <group position={[fishX,0,fishZ]}>
      <Block at={[0,.012,0]} size={[3.7,.025,3.8]} color="#467b71" />
      <group position={[.6,0,-2.82]}>
        <Block at={[0,.35,0]} size={[1.82,.7,.8]} color={navy} />
        <mesh position={[0,.99,0]}><boxGeometry args={[1.78,.63,.78]} />
          <meshStandardMaterial color="#59cdbf" transparent opacity={.55} depthWrite={false} />
        </mesh>
        <Block at={[0,.74,0]} size={[1.68,.14,.7]} color="#cea46e" />
        {[-.6,.5].map((x) => <Block key={x} at={[x,.9,0]} size={[.15,.27,.16]} color="#679b4f" />)}
      </group>
      <group ref={fish}>
        <Block at={[0,.68,0]} size={[.87,1.02,.69]} color="#328775" />
        <Block at={[0,.65,.365]} size={[.63,.65,.11]} color="#78c9a7" />
        <Block at={[0,1.15,.13]} size={[1,.59,.74]} color="#4daa93" />
        <Block at={[0,1.55,-.14]} size={[.23,.34,.67]} color="#267664" />
        <Block at={[.65,.68,-.27]} size={[.56,.19,.22]} color="#328775" />
        <Block at={[.93,.69,-.27]} size={[.19,.6,.2]} color="#51a78d" />
        {[-.27,.27].map((x) => <group key={x}>
          <Block at={[x,1.25,.52]} size={[.21,.21,.065]} color="#fff4e3" />
          <Block at={[x+.035,1.24,.56]} size={[.094,.105,.04]} color="#142d36" />
          <Block at={[x,.17,.065]} size={[.27,.31,.42]} color="#246653" />
        </group>)}
        <Block at={[0,1.02,.52]} size={[.28,.11,.075]} color="#2d4b46" />
        <group ref={glove}>
          {[-.59,.59].map((x) => <group key={x}>
            <Block at={[x,.79,.25]} size={[.24,.23,.36]} color="#2d7869" />
            <Block at={[x,.84,.52]} size={[.4,.38,.39]} color="#9255dc" />
            <Block at={[x,.82,.35]} size={[.36,.3,.15]} color="#c394fb" />
          </group>)}
        </group>
      </group>
      {knockout && <SquareStars point={[0,1.59,0]} />}
      {recentHit && <BoxingImpact point={[0,0,0.3]} hit={recentHit} />}
      <Html position={[0,1.96,0]} center zIndexRange={[12, 4]} style={{ pointerEvents: 'none' }}>
        <div className="w-32 rounded-lg border border-violet-300/50 bg-slate-950/95 p-1.5 text-center text-[10px] text-white shadow">
          <strong>Cá Dọn Bể</strong>
          <div aria-hidden className="mt-1 h-[6px] overflow-hidden rounded bg-slate-700">
            <div className="h-full bg-emerald-400 transition-[width]" style={{ width: (view?.fishHp ?? BOXING.maxHp) / BOXING.maxHp * 100 + '%' }} />
          </div>
          <span>{knockout ? 'Đang hồi phục' : (view?.fishHp ?? BOXING.maxHp) + '/' + BOXING.maxHp}</span>
        </div>
      </Html>
    </group>
  </group>;
}
