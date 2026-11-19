import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { LowPolyCharacter } from './OfficeScene3D';
import type { AvatarGender } from '../types/office';
import { OUTFIT_SLOTS, type OfficeAction, type ShopEquipment, type ShopAppearance } from '../utils/officeShop';

const poses = {
  standing: 'Đứng', seated: 'Ngồi', wave: 'Vẫy tay', dance: 'Nhảy múa',
  bow: 'Cúi chào', clap: 'Vỗ tay', spin: 'Xoay', heart: 'Thả tim',
} as const;

export function OutfitPreview({ item, gender, outfit }: {
  item: ShopEquipment; gender: AvatarGender; outfit: ShopAppearance;
}) {
  const [pose, setPose] = useState<keyof typeof poses>('standing');
  const actionEvent = useMemo(() => pose === 'standing' || pose === 'seated' ? undefined : {
    type: 'office_action' as const, eventId: 'preview', userId: 'preview',
    action: pose as OfficeAction, startedAt: Date.now(),
  }, [pose]);
  return <>
    <div className="office-shop__avatar" aria-label="Avatar mặc thử, kéo để xoay trước và sau">
      <Canvas camera={{ position: [2.2, 1.5, 3.5], fov: 33 }} dpr={[1, 1.5]}>
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 5, 4]} intensity={2.3} />
        <LowPolyCharacter gender={gender} nickname="" memberTag="" isCurrentUser={false}
          isOnline isSeated={pose === 'seated'} position={[0, 0, 0]} rotationY={0}
          actionEvent={actionEvent}
          duplicateNicknameCount={1} hideLabel
          outfit={{ ...outfit, [OUTFIT_SLOTS[item]]: item }} />
        <OrbitControls target={[0, 0.85, 0]} enablePan={false} enableZoom={false} />
      </Canvas>
    </div>
    <select aria-label="Tư thế mặc thử" className="office-shop__secondary" value={pose}
      onChange={(event) => setPose(event.target.value as keyof typeof poses)}>
      {Object.entries(poses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  </>;
}
