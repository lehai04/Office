import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isUsingStaticFallback } from '../services/officeApi';
import { uniqueStaticRoomMembers } from '../utils/roomMemberDisplay';
import type { OfficeAction, OfficeDecoration, ScenePoint } from '../utils/officeShop';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import {
  WORK_SEAT_LAYOUTS,
  MEETING_TABLE_POSITION,
  MEETING_CHAIRS,
  DOOR_STANDING_SLOTS,
  type SeatTransform,
  type MeetingChairTransform,
} from '../constants/officeLayout';
import type { AvatarGender, RoomMember, WorkSeat } from '../types/office';
import type { DeityType } from './ZenSanctuaryOverlay';
import {
  ALL_PET_BREEDS,
  CAT_BREEDS,
  getActivityLabel,
  isDogBreed,
  type OfficeCatProfile,
} from '../utils/officeCatsData';

export interface ActiveSpeechBubble {
  userId: string;
  content: string;
  expiresAt: number;
}

interface OfficeScene3DProps {
  walkTarget: ScenePoint | null;
  decorations: OfficeDecoration[];
  outfit: boolean;
  action: OfficeAction | null;
  offeringVisible: boolean;
  onFloorClick: (point: ScenePoint) => void;
  onDeskClick?: (point: ScenePoint) => void;
  currentUserId: string;
  members: RoomMember[];
  seats: WorkSeat[];
  activeBubbles: Record<string, ActiveSpeechBubble>;
  onSelectSeat: (seatId: string) => void;
  onSelectMeetingChair: (chairId: string | null) => void;
  claimingSeatId: string | null;
  // Góc nhìn & Phòng Tịnh Tâm / Phòng Giải Trí
  cameraMode: 'overview' | 'first_person';
  inZenRoom: boolean;
  onEnterZenRoom: () => void;
  inGameRoom?: boolean;
  onEnterGameRoom?: () => void;
  selectedDeity: DeityType;
  incenseLit: boolean;
  isBowing: boolean;
  moPulseKey: number;
  floatingMeritText: string | null;
  onStrikeMo: () => void;
  onRingBell: () => void;
  onOpenDonationBox?: () => void;
  donationTotalVnd?: number;
  abbotAtDonationDesk?: boolean;
  // Hệ thống Mèo Văn Phòng ở khu vực bên ngoài văn phòng
  roomCats?: Record<string, OfficeCatProfile>;
  onPetCatIn3D?: (cat: OfficeCatProfile) => void;
}

/**
 * Bộ điều khiển Camera linh hoạt:
 * - Chế độ Toàn cảnh (overview): Nhìn từ trên chéo xuống Văn phòng hoặc cận cảnh Bàn thờ Phòng Tịnh Tâm
 * - Chế độ Góc nhìn thứ nhất (first_person): Đặt camera đúng vị trí mắt của nhân vật,
 *   cho phép kéo chuột / chạm để xoay nhìn 360 độ, dùng WASD để bước đi, và cúi lạy theo nhịp khi hành lễ!
 */
const SceneCameraController: React.FC<{
  cameraMode: 'overview' | 'first_person';
  inZenRoom: boolean;
  inGameRoom?: boolean;
  isBowing: boolean;
  myPosition: [number, number, number];
  myRotationY: number;
  isMyCharacterSeated: boolean;
  virtualKeysRef: React.MutableRefObject<Set<string>>;
}> = ({
  cameraMode,
  inZenRoom,
  inGameRoom = false,
  isBowing,
  myPosition,
  myRotationY,
  isMyCharacterSeated,
  virtualKeysRef,
}) => {
  const { camera, gl, size } = useThree();
  const yawRef = useRef(0);
  const pitchRef = useRef(-0.06);
  const walkOffsetRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const keysPressedRef = useRef<Set<string>>(new Set());
  const draggingRef = useRef(false);
  const prevPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const bowStartRef = useRef<number>(0);

  const isPortraitMobile = size.width < size.height * 0.85;

  // Khi chuyển vị trí ghế / vào phòng tịnh tâm / phòng giải trí / đổi chế độ camera, đặt hướng nhìn mắt nhân vật theo hướng nhân vật đang quay
  useEffect(() => {
    yawRef.current = myRotationY;
    pitchRef.current = inZenRoom || inGameRoom ? 0.08 : -0.05;
    walkOffsetRef.current = { x: 0, z: 0 };
  }, [myPosition[0], myPosition[2], myRotationY, inZenRoom, inGameRoom, cameraMode]);

  useEffect(() => {
    if (isBowing) {
      bowStartRef.current = performance.now();
    }
  }, [isBowing]);

  // Khi ở chế độ overview, chuyển góc nhìn mượt giữa Văn phòng chính, Phòng Tịnh Tâm và Phòng Giải Trí
  useEffect(() => {
    if (cameraMode === 'overview') {
      if (inZenRoom) {
        if (isPortraitMobile) {
          camera.position.set(0, 4.3, -4.6);
        } else {
          camera.position.set(0, 3.6, -6.2);
        }
        camera.lookAt(0, 1.1, -11.4);
      } else if (inGameRoom) {
        if (isPortraitMobile) {
          camera.position.set(-7.6, 4.5, -4.8);
        } else {
          camera.position.set(-7.6, 3.8, -6.2);
        }
        camera.lookAt(-7.6, 1.2, -11.4);
      } else {
        if (isPortraitMobile) {
          camera.position.set(0, 21.5, 16.5);
        } else {
          camera.position.set(0, 14.2, 11.2);
        }
        camera.lookAt(0, 0, 0);
      }
    }
  }, [cameraMode, inZenRoom, inGameRoom, isPortraitMobile, camera]);

  // Sự kiện chuột / bàn phím cho Góc nhìn thứ nhất (First-Person View)
  useEffect(() => {
    if (cameraMode !== 'first_person') return;

    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      draggingRef.current = true;
      prevPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - prevPointerRef.current.x;
      const dy = e.clientY - prevPointerRef.current.y;
      prevPointerRef.current = { x: e.clientX, y: e.clientY };

      yawRef.current -= dx * 0.0055;
      pitchRef.current = Math.max(
        -Math.PI / 2.6,
        Math.min(Math.PI / 2.6, pitchRef.current - dy * 0.0045)
      );
    };

    const onPointerUp = () => {
      draggingRef.current = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      keysPressedRef.current.add(e.key.toLowerCase());

      if (e.key === 'ArrowLeft') yawRef.current += 0.08;
      if (e.key === 'ArrowRight') yawRef.current -= 0.08;
      if (e.key === 'ArrowUp') {
        pitchRef.current = Math.min(Math.PI / 2.6, pitchRef.current + 0.06);
      }
      if (e.key === 'ArrowDown') {
        pitchRef.current = Math.max(-Math.PI / 2.6, pitchRef.current - 0.06);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.key.toLowerCase());
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [cameraMode, gl]);

  useFrame((_, delta) => {
    if (cameraMode !== 'first_person') return;

    const speed = 3.2 * delta;
    const keys = keysPressedRef.current;
    const vKeys = virtualKeysRef.current;
    const forwardX = Math.sin(yawRef.current);
    const forwardZ = Math.cos(yawRef.current);
    const rightX = Math.cos(yawRef.current);
    const rightZ = -Math.sin(yawRef.current);

    if (keys.has('w') || vKeys.has('w')) {
      walkOffsetRef.current.x += forwardX * speed;
      walkOffsetRef.current.z += forwardZ * speed;
    }
    if (keys.has('s') || vKeys.has('s')) {
      walkOffsetRef.current.x -= forwardX * speed;
      walkOffsetRef.current.z -= forwardZ * speed;
    }
    if (keys.has('a') || vKeys.has('a')) {
      walkOffsetRef.current.x += rightX * speed;
      walkOffsetRef.current.z += rightZ * speed;
    }
    if (keys.has('d') || vKeys.has('d')) {
      walkOffsetRef.current.x -= rightX * speed;
      walkOffsetRef.current.z -= rightZ * speed;
    }

    // Độ cao mắt nhân vật (ngồi ghế, quỳ bồ đoàn hoặc đứng)
    const baseEyeY = inZenRoom ? 0.92 : isMyCharacterSeated ? 1.04 : 1.24;

    // Hiệu ứng cúi đầu 3 lạy khi đang hành lễ trong góc nhìn thứ nhất
    let bowPitchOffset = 0;
    let bowHeightOffset = 0;
    if (isBowing) {
      const elapsed = (performance.now() - bowStartRef.current) / 1000;
      const wave = Math.max(0, Math.sin(elapsed * Math.PI * 2.0));
      bowPitchOffset = -wave * 0.48;
      bowHeightOffset = -wave * 0.22;
    }

    const eyeX = myPosition[0] + walkOffsetRef.current.x;
    const eyeY = baseEyeY + bowHeightOffset;
    const eyeZ = myPosition[2] + walkOffsetRef.current.z;

    camera.position.set(eyeX, eyeY, eyeZ);

    const totalPitch = pitchRef.current + bowPitchOffset;
    const lookX = eyeX + Math.sin(yawRef.current) * Math.cos(totalPitch) * 5;
    const lookY = eyeY + Math.sin(totalPitch) * 5;
    const lookZ = eyeZ + Math.cos(yawRef.current) * Math.cos(totalPitch) * 5;

    camera.lookAt(lookX, lookY, lookZ);
  });

  if (cameraMode === 'first_person') {
    return null;
  }

  return (
    <OrbitControls
      makeDefault
      target={
        inZenRoom
          ? [0, 0.9, -11.2]
          : inGameRoom
            ? [-7.6, 0.9, -11.2]
            : [0, 0, 0]
      }
      minPolarAngle={Math.PI / 8}
      maxPolarAngle={Math.PI / 2.15}
      minAzimuthAngle={-Math.PI / 2.2}
      maxAzimuthAngle={Math.PI / 2.2}
      minDistance={inZenRoom || inGameRoom ? 3.5 : 6.5}
      maxDistance={28}
      enablePan={true}
    />
  );
};

/**
 * Vầng hào quang phát sáng tia vàng rực phía sau đầu nhân vật Trụ trì Thanh Ngọc
 */
const RadiantHaloAura3D: React.FC = () => {
  const auraPlaneRef = useRef<THREE.Mesh>(null);
  const auraTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const cx = size / 2;
      const cy = size / 2;

      // 1. Ánh hào quang tỏa sáng mềm từ tâm
      const radial = ctx.createRadialGradient(cx, cy, 24, cx, cy, 126);
      radial.addColorStop(0, 'rgba(255, 248, 200, 0.92)');
      radial.addColorStop(0.32, 'rgba(253, 224, 71, 0.72)');
      radial.addColorStop(0.6, 'rgba(251, 191, 36, 0.28)');
      radial.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, size, size);

      // 2. Các tia sáng đa sắc vàng-trắng-xanh-cam tỏa ra xung quanh (28 tia như ảnh mẫu)
      const rayPalettes = [
        ['rgba(255, 252, 220, 0.96)', 'rgba(253, 224, 71, 0.72)'],
        ['rgba(224, 242, 254, 0.9)', 'rgba(125, 211, 252, 0.55)'],
        ['rgba(255, 237, 213, 0.92)', 'rgba(251, 146, 60, 0.62)'],
        ['rgba(255, 255, 255, 0.95)', 'rgba(254, 240, 138, 0.65)'],
      ];
      const numRays = 28;
      for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        const spread = 0.075;
        const [c0, c1] = rayPalettes[i % rayPalettes.length];
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle - spread) * 126, cy + Math.sin(angle - spread) * 126);
        ctx.lineTo(cx + Math.cos(angle + spread) * 126, cy + Math.sin(angle + spread) * 126);
        ctx.closePath();
        const rayGrad = ctx.createRadialGradient(cx, cy, 34, cx, cy, 126);
        rayGrad.addColorStop(0, c0);
        rayGrad.addColorStop(0.5, c1);
        rayGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = rayGrad;
        ctx.fill();
        ctx.restore();
      }

      // 3. Các đốm sáng lấp lánh quanh vòng hào quang
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + 0.2;
        const r = 56 + (i % 3) * 10;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, i % 2 === 0 ? 3 : 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fill();
      }

      // 4. Vòng hào quang sáng chói quanh đầu
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(255, 252, 230, 0.95)';
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 18;
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useFrame((_, delta) => {
    if (auraPlaneRef.current) {
      auraPlaneRef.current.rotation.z += delta * 0.35;
    }
  });

  return (
    <group position={[0, 0.72, -0.18]}>
      <pointLight position={[0, 0.05, 0.25]} color="#fde047" intensity={1.35} distance={3.8} />
      <mesh ref={auraPlaneRef}>
        <planeGeometry args={[1.65, 1.65]} />
        <meshBasicMaterial
          map={auraTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

/**
 * Mô hình nhân vật 3D Low-Poly nhẹ (Nam / Nữ)
 * Có tư thế ngồi/quỳ (isSeated=true), đứng (isSeated=false), và cúi lạy 3 lạy (isBowing=true)
 */
const LowPolyCharacter: React.FC<{
  gender: AvatarGender;
  nickname: string;
  memberTag: string;
  isCurrentUser: boolean;
  isManager?: boolean;
  isOnline: boolean;
  isSeated: boolean;
  isBowing?: boolean;
  hideMeshInFpv?: boolean;
  position: [number, number, number];
  rotationY: number;
  bubbleText?: string;
  outfit?: boolean;
  action?: OfficeAction | null;
  duplicateNicknameCount: number;
}> = ({
  gender,
  nickname,
  memberTag,
  isCurrentUser,
  isManager = false,
  isOnline,
  isSeated,
  isBowing = false,
  hideMeshInFpv = false,
  position,
  rotationY,
  bubbleText,
  outfit,
  action,
  duplicateNicknameCount,
}) => {
  const upperBodyRef = useRef<THREE.Group>(null);
  const bowStartRef = useRef<number>(0);
  const actorRef = useRef<THREE.Group>(null);
  const startPosition = useRef(position);

  useEffect(() => {
    if (isBowing) {
      bowStartRef.current = performance.now();
    } else if (upperBodyRef.current) {
      upperBodyRef.current.rotation.x = 0;
    }
  }, [isBowing]);

  useFrame(({ clock }, delta) => {
    const actor = actorRef.current;
    if (actor) {
      const [x, y, z] = position;
      const distance = Math.hypot(x - actor.position.x, y - actor.position.y, z - actor.position.z);
      const step = action || isSeated || distance > 18 ? 1 : Math.min(1, (delta * 5) / Math.max(distance, 0.001));
      actor.position.x += (x - actor.position.x) * step;
      actor.position.y += (y - actor.position.y) * step;
      actor.position.z += (z - actor.position.z) * step;
      actor.rotation.z = action === 'dance' ? Math.sin(clock.elapsedTime * 9) * 0.18 : action === 'headstand' ? Math.PI : 0;
    }
    if (!upperBodyRef.current) return;
    if (isBowing) {
      const elapsed = (performance.now() - bowStartRef.current) / 1000;
      const wave = Math.max(0, Math.sin(elapsed * Math.PI * 2.0));
      upperBodyRef.current.rotation.x = wave * 0.65;
    } else {
      upperBodyRef.current.rotation.x = 0;
    }
  });

  const shirtColor =
    outfit ? '#a855f7' : gender === 'male'
      ? isCurrentUser
        ? '#10b981'
        : '#3b82f6'
      : isCurrentUser
        ? '#ec4899'
        : '#f43f5e';
  const pantsColor = gender === 'male' ? '#1e293b' : '#334155';
  const hairColor = gender === 'male' ? '#1f2937' : '#451a03';
  const skinColor = '#fcd34d';

  const hipY = isSeated ? 0.52 : 0.68;
  const torsoY = hipY + 0.36;
  const headY = torsoY + 0.44;
  const labelY = headY + 0.48;

  const normalizedNickname =
    nickname.trim() === 'Người Ngoài Phòng' ? 'Kẻ lạ' : nickname;
  const isAbbotThanhNgoc = normalizedNickname
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .includes('thanh ngoc');
  const displayName =
    duplicateNicknameCount > 1
      ? `${normalizedNickname} (${memberTag})`
      : normalizedNickname;

  return (
    <group ref={actorRef} position={startPosition.current} rotation={[0, rotationY, 0]}>
      <group position-y={action === 'headstand' ? -1.65 : 0}>
      {!hideMeshInFpv && (
        <>
          {/* Đài sen hồng 2 tầng cánh nở dưới chân Trụ trì Thanh Ngọc */}
          {isAbbotThanhNgoc && (
            <group position={[0, 0.02, 0]}>
              <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.38, 0.44, 0.06, 20]} />
                <meshStandardMaterial color="#f59e0b" metalness={0.35} roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.07, 0]} receiveShadow>
                <cylinderGeometry args={[0.34, 0.36, 0.05, 20]} />
                <meshStandardMaterial color="#ec4899" roughness={0.45} />
              </mesh>
              {/* Tầng cánh sen ngoài (10 cánh lớn) */}
              {Array.from({ length: 10 }, (_, idx) => {
                const angle = (idx / 10) * Math.PI * 2;
                return (
                  <group key={`outer-${idx}`} rotation={[0, -angle, 0]}>
                    <mesh
                      position={[0.42, 0.12, 0]}
                      rotation={[0, 0, -0.82]}
                      scale={[0.55, 1.1, 0.36]}
                      castShadow
                    >
                      <sphereGeometry args={[0.2, 12, 10]} />
                      <meshStandardMaterial color="#f472b6" roughness={0.4} />
                    </mesh>
                  </group>
                );
              })}
              {/* Tầng cánh sen trong (8 cánh so le) */}
              {Array.from({ length: 8 }, (_, idx) => {
                const angle = (idx / 8) * Math.PI * 2 + 0.35;
                return (
                  <group key={`inner-${idx}`} rotation={[0, -angle, 0]}>
                    <mesh
                      position={[0.3, 0.16, 0]}
                      rotation={[0, 0, -0.52]}
                      scale={[0.5, 0.95, 0.34]}
                      castShadow
                    >
                      <sphereGeometry args={[0.18, 12, 10]} />
                      <meshStandardMaterial color="#f9a8d4" roughness={0.38} />
                    </mesh>
                  </group>
                );
              })}
            </group>
          )}
          {isCurrentUser && (
            <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.42, 0.54, 24]} />
              <meshBasicMaterial color="#10b981" transparent opacity={0.85} />
            </mesh>
          )}

          {/* Chân */}
          {isSeated ? (
            <group>
              <mesh position={[-0.11, 0.46, 0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <boxGeometry args={[0.13, 0.34, 0.13]} />
                <meshStandardMaterial color={pantsColor} roughness={0.8} />
              </mesh>
              <mesh position={[0.11, 0.46, 0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <boxGeometry args={[0.13, 0.34, 0.13]} />
                <meshStandardMaterial color={pantsColor} roughness={0.8} />
              </mesh>
              <mesh position={[-0.11, 0.24, 0.3]} castShadow>
                <boxGeometry args={[0.12, 0.36, 0.12]} />
                <meshStandardMaterial color={pantsColor} roughness={0.8} />
              </mesh>
              <mesh position={[0.11, 0.24, 0.3]} castShadow>
                <boxGeometry args={[0.12, 0.36, 0.12]} />
                <meshStandardMaterial color={pantsColor} roughness={0.8} />
              </mesh>
            </group>
          ) : (
            <group>
              <mesh position={[-0.11, 0.34, 0]} castShadow>
                <boxGeometry args={[0.14, 0.62, 0.14]} />
                <meshStandardMaterial color={pantsColor} roughness={0.8} />
              </mesh>
              <mesh position={[0.11, 0.34, 0]} castShadow>
                <boxGeometry args={[0.14, 0.62, 0.14]} />
                <meshStandardMaterial color={pantsColor} roughness={0.8} />
              </mesh>
            </group>
          )}

          {/* Phần thân trên & đầu (Có thể cúi lạy khi ở Phòng Tịnh Tâm) */}
          <group ref={upperBodyRef} position={[0, hipY, 0]}>
            {gender === 'male' ? (
              <mesh position={[0, 0.36, 0]} castShadow>
                <boxGeometry args={[0.42, 0.52, 0.24]} />
                <meshStandardMaterial
                  color={shirtColor}
                  roughness={0.65}
                  transparent={!isOnline}
                  opacity={isOnline ? 1 : 0.55}
                />
              </mesh>
            ) : (
              <group position={[0, 0.36, 0]}>
                <mesh position={[0, 0.06, 0]} castShadow>
                  <boxGeometry args={[0.38, 0.42, 0.22]} />
                  <meshStandardMaterial
                    color={shirtColor}
                    roughness={0.6}
                    transparent={!isOnline}
                    opacity={isOnline ? 1 : 0.55}
                  />
                </mesh>
                <mesh position={[0, -0.2, 0]} castShadow>
                  <cylinderGeometry args={[0.18, 0.26, 0.22, 10]} />
                  <meshStandardMaterial
                    color="#475569"
                    roughness={0.7}
                    transparent={!isOnline}
                    opacity={isOnline ? 1 : 0.55}
                  />
                </mesh>
              </group>
            )}

            {/* Hai tay (Chắp tay trước ngực khi đang lạy khấn) */}
            <mesh
              position={[-0.24, 0.38, isBowing ? 0.18 : isSeated ? 0.1 : 0]}
              rotation={[isBowing ? -1.1 : isSeated ? -0.55 : 0, 0, isBowing ? -0.35 : 0.08]}
              castShadow
            >
              <boxGeometry args={[0.11, 0.42, 0.11]} />
              <meshStandardMaterial color={shirtColor} roughness={0.65} />
            </mesh>
            <mesh
              position={[0.24, 0.38, isBowing ? 0.18 : isSeated ? 0.1 : 0]}
              rotation={[isBowing ? -1.1 : isSeated ? -0.55 : 0, 0, isBowing ? 0.35 : -0.08]}
              castShadow
            >
              <boxGeometry args={[0.11, 0.42, 0.11]} />
              <meshStandardMaterial color={shirtColor} roughness={0.65} />
            </mesh>

            {/* Đầu */}
            <group position={[0, 0.8, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.34, 0.34, 0.34]} />
                <meshStandardMaterial
                  color={skinColor}
                  roughness={0.5}
                  transparent={!isOnline}
                  opacity={isOnline ? 1 : 0.6}
                />
              </mesh>
              <mesh position={[-0.08, 0.02, 0.175]}>
                <boxGeometry args={[0.045, 0.045, 0.02]} />
                <meshBasicMaterial color="#0f172a" />
              </mesh>
              <mesh position={[0.08, 0.02, 0.175]}>
                <boxGeometry args={[0.045, 0.045, 0.02]} />
                <meshBasicMaterial color="#0f172a" />
              </mesh>

              {gender === 'male' ? (
                <mesh position={[0, 0.16, -0.01]} castShadow>
                  <boxGeometry args={[0.37, 0.11, 0.37]} />
                  <meshStandardMaterial color={hairColor} roughness={0.8} />
                </mesh>
              ) : (
                <group>
                  <mesh position={[0, 0.16, -0.01]} castShadow>
                    <boxGeometry args={[0.37, 0.11, 0.37]} />
                    <meshStandardMaterial color={hairColor} roughness={0.8} />
                  </mesh>
                  <mesh position={[0, -0.02, -0.17]} castShadow>
                    <boxGeometry args={[0.35, 0.32, 0.08]} />
                    <meshStandardMaterial color={hairColor} roughness={0.8} />
                  </mesh>
                  <mesh position={[0, 0.22, -0.16]} castShadow>
                    <sphereGeometry args={[0.09, 8, 8]} />
                    <meshStandardMaterial color={hairColor} roughness={0.8} />
                  </mesh>
                </group>
              )}

              {/* Vương miện vàng 3D cho Trưởng phòng */}
              {isManager && (
                <group position={[0, 0.26, 0]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.14, 0.12, 0.08, 8]} />
                    <meshStandardMaterial color="#fbbf24" metalness={0.75} roughness={0.2} />
                  </mesh>
                  <mesh position={[0, 0.05, 0.11]}>
                    <sphereGeometry args={[0.028, 8, 8]} />
                    <meshBasicMaterial color="#ef4444" />
                  </mesh>
                </group>
              )}

              {/* Vầng hào quang phát sáng tia vàng sau đầu Trụ trì Thanh Ngọc */}
              {isAbbotThanhNgoc && <RadiantHaloAura3D />}
            </group>
          </group>
        </>
      )}

      {/* Nhãn Biệt danh & Bong bóng Chat */}
      {!hideMeshInFpv && (
        <Html
          position={[0, labelY, 0]}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="relative flex flex-col items-center select-none">
            {bubbleText && (
              <div
                data-testid={`speech-bubble-${nickname}`}
                className="mb-2 w-max max-w-[210px] sm:max-w-[240px] rounded-2xl bg-white/95 px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 shadow-xl ring-2 ring-emerald-400/80 whitespace-pre-wrap break-words leading-snug animate-bounce-short"
              >
                {bubbleText}
                <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 rotate-45 bg-white border-r border-b border-emerald-400/60" />
              </div>
            )}

            <div
              className={`flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold shadow backdrop-blur-sm transition-all ${
                isCurrentUser
                  ? 'bg-emerald-600/90 text-white ring-1 ring-emerald-300'
                  : isOnline
                    ? 'bg-slate-900/75 text-slate-100 ring-1 ring-white/20'
                    : 'bg-slate-800/55 text-slate-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isOnline ? 'bg-emerald-400' : 'bg-slate-400'
                }`}
              />
              {isManager && <span title="Trưởng phòng">👑</span>}
              <span>{displayName}</span>
            </div>
          </div>
        </Html>
      )}
      </group>
    </group>
  );
};

/**
 * Gian Phòng Tịnh Tâm 3D (Có tượng Đức Phật, Ông Địa, Thần Tài, Mõ Gỗ, Chuông Đồng, Lư Hương & Bồ Đoàn)
 */
const ZenSanctuaryRoom3D: React.FC<{
  selectedDeity: DeityType;
  incenseLit: boolean;
  offeringVisible: boolean;
  moPulseKey: number;
  floatingMeritText: string | null;
  onStrikeMo: () => void;
  onRingBell: () => void;
  onOpenDonationBox?: () => void;
  donationTotalVnd?: number;
}> = ({
  selectedDeity,
  incenseLit,
  offeringVisible,
  moPulseKey,
  floatingMeritText,
  onStrikeMo,
  onRingBell,
  onOpenDonationBox,
  donationTotalVnd = 0,
}) => {
  const haloRef = useRef<THREE.Mesh>(null);
  const moGroupRef = useRef<THREE.Group>(null);
  const malletRef = useRef<THREE.Group>(null);
  const pulseStartRef = useRef<number>(0);

  useEffect(() => {
    if (moPulseKey > 0) {
      pulseStartRef.current = performance.now();
    }
  }, [moPulseKey]);

  useFrame((_, delta) => {
    if (haloRef.current) {
      haloRef.current.rotation.z += delta * 0.6;
    }
    if (moGroupRef.current && malletRef.current) {
      const elapsed = (performance.now() - pulseStartRef.current) / 1000;
      if (elapsed < 0.25) {
        const s = 1 + Math.sin((elapsed / 0.25) * Math.PI) * 0.22;
        moGroupRef.current.scale.set(s, s, s);
        malletRef.current.rotation.z = -Math.sin((elapsed / 0.25) * Math.PI) * 0.55;
      } else {
        moGroupRef.current.scale.set(1, 1, 1);
        malletRef.current.rotation.z = 0;
      }
    }
  });

  return (
    <group position={[0, 0, -10.2]}>
      {/* Ánh sáng ấm áp trang nghiêm cho Phòng Tịnh Tâm */}
      <pointLight position={[0, 3.4, -0.5]} intensity={1.4} color="#fbbf24" distance={9} />
      <pointLight position={[0, 2.2, -1.5]} intensity={0.9} color="#f59e0b" distance={6} />

      {/* Sàn gỗ trầm hương Phòng Tịnh Tâm */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[8.2, 0.14, 6.4]} />
        <meshStandardMaterial color="#451a03" roughness={0.75} />
      </mesh>
      {/* Thảm sen giữa phòng */}
      <mesh position={[0, 0.03, 0.6]} receiveShadow>
        <boxGeometry args={[5.8, 0.02, 3.4]} />
        <meshStandardMaterial color="#7c2d12" roughness={0.85} />
      </mesh>

      {/* 10 ĐỆM BỒ ĐOÀN (2 hàng x 5 chỗ) để tối đa 10 người cùng ngồi thiền chung */}
      {[-2.2, -1.1, 0, 1.1, 2.2].map((cx) =>
        [1.0, 2.05].map((cz) => (
          <mesh key={`zen-pad-${cx}-${cz}`} position={[cx, 0.06, cz]} receiveShadow>
            <cylinderGeometry args={[0.38, 0.42, 0.08, 16]} />
            <meshStandardMaterial color="#b45309" roughness={0.8} />
          </mesh>
        ))
      )}

      {/* Vách hậu cung & Vách hai bên */}
      <mesh position={[0, 1.6, -2.95]} receiveShadow castShadow>
        <boxGeometry args={[8.2, 3.2, 0.18]} />
        <meshStandardMaterial color="#78350f" roughness={0.7} />
      </mesh>
      <mesh position={[-4.05, 1.6, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.18, 3.2, 6.4]} />
        <meshStandardMaterial color="#78350f" roughness={0.7} />
      </mesh>
      <mesh position={[4.05, 1.6, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.18, 3.2, 6.4]} />
        <meshStandardMaterial color="#78350f" roughness={0.7} />
      </mesh>

      {/* Đệm ngồi Bồ đoàn (Nơi nhân vật ngồi/quỳ hành lễ nhìn vào bàn thờ) */}
      <group position={[0, 0, 1.25]}>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.58, 0.64, 0.18, 24]} />
          <meshStandardMaterial color="#b45309" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.46, 0.52, 0.04, 24]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.7} />
        </mesh>
      </group>

      {/* BÀN GÓC TRÁI MẶC ĐỊNH CHO TRỤ TRÌ THANH NGỌC + HÒM CÔNG ĐỨC NHỎ */}
      <group position={[-3.22, 0, -0.15]}>
        {/* Mặt bàn gỗ góc trái */}
        <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.78, 0.08, 1.55]} />
          <meshStandardMaterial color="#5c280e" roughness={0.55} />
        </mesh>
        {/* 4 chân bàn */}
        {[
          [-0.3, -0.64],
          [0.3, -0.64],
          [-0.3, 0.64],
          [0.3, 0.64],
        ].map(([lx, lz], idx) => (
          <mesh key={idx} position={[lx, 0.36, lz]} castShadow>
            <boxGeometry args={[0.08, 0.72, 0.08]} />
            <meshStandardMaterial color="#3f1a08" />
          </mesh>
        ))}

        {/* Ghế / Đệm ngồi của Trụ trì Thanh Ngọc bên trái bàn, quay mặt vào bàn */}
        <group position={[-0.54, 0, 0]}>
          <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.26, 0.28, 0.08, 16]} />
            <meshStandardMaterial color="#b45309" roughness={0.75} />
          </mesh>
          <mesh position={[-0.22, 0.45, 0]} castShadow>
            <boxGeometry args={[0.06, 0.44, 0.42]} />
            <meshStandardMaterial color="#7c2d12" />
          </mesh>
        </group>

        {/* HÒM CÔNG ĐỨC NHỎ TRÊN BÀN (Bấm để bỏ tiền công đức) */}
        <group
          position={[0.05, 0.88, 0.3]}
          onClick={(e) => {
            e.stopPropagation();
            onOpenDonationBox?.();
          }}
          onPointerOver={() => {
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          {/* Thân hòm gỗ sơn son */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.36, 0.24, 0.28]} />
            <meshStandardMaterial color="#991b1b" roughness={0.45} />
          </mesh>
          {/* Viền vàng trên nắp hòm */}
          <mesh position={[0, 0.13, 0]}>
            <boxGeometry args={[0.38, 0.03, 0.3]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.55} roughness={0.3} />
          </mesh>
          {/* Khe bỏ tiền công đức */}
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[0.16, 0.012, 0.025]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <Html position={[0, 0.32, 0]} center distanceFactor={8}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDonationBox?.();
              }}
              className="whitespace-nowrap rounded-full border border-amber-300 bg-amber-400 hover:bg-amber-300 px-2 py-0.5 text-[10px] font-black text-slate-950 shadow-lg cursor-pointer"
            >
              🪙 Hòm Công Đức: {donationTotalVnd.toLocaleString('vi-VN')}đ
            </button>
          </Html>
        </group>
      </group>

      {/* BÀN THỜ GỖ CHẠM KHẮC TRANG NGHIÊM */}
      <group position={[0, 0, -1.55]}>
        {/* Mặt bàn thờ chính */}
        <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.6, 0.14, 1.35]} />
          <meshStandardMaterial color="#7c2d12" roughness={0.5} />
        </mesh>
        {/* Bệ thờ tầng cao đặt Tôn Tượng */}
        <mesh position={[0, 1.22, -0.25]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.42, 0.75]} />
          <meshStandardMaterial color="#9a3412" roughness={0.5} />
        </mesh>
        {/* Chân bàn thờ */}
        <mesh position={[-1.55, 0.46, 0]} castShadow>
          <boxGeometry args={[0.24, 0.92, 1.15]} />
          <meshStandardMaterial color="#451a03" />
        </mesh>
        <mesh position={[1.55, 0.46, 0]} castShadow>
          <boxGeometry args={[0.24, 0.92, 1.15]} />
          <meshStandardMaterial color="#451a03" />
        </mesh>

        {/* Đèn hoa sen hai bên bàn thờ */}
        {[-1.35, 1.35].map((xPos, idx) => (
          <group key={idx} position={[xPos, 1.02, -0.2]}>
            <mesh position={[0, 0.22, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.14, 0.44, 12]} />
              <meshStandardMaterial color="#d97706" metalness={0.5} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <sphereGeometry args={[0.16, 12, 12]} />
              <meshStandardMaterial
                color="#fef08a"
                emissive="#f59e0b"
                emissiveIntensity={1.2}
              />
            </mesh>
          </group>
        ))}

        {/* ==================== TÔN TƯỢNG 3D THEO LỰA CHỌN ==================== */}

        {/* LỰA CHỌN 1: ĐỨC PHẬT TỌA ĐÀI SEN VÀNG */}
        {selectedDeity === 'buddha' && (
          <group position={[0, 1.45, -0.25]}>
            {/* Hào quang vàng xoay nhẹ phía sau */}
            <mesh ref={haloRef} position={[0, 0.72, -0.22]}>
              <ringGeometry args={[0.42, 0.62, 24]} />
              <meshBasicMaterial color="#fde047" side={THREE.DoubleSide} transparent opacity={0.8} />
            </mesh>
            {/* Đài sen hồng */}
            <mesh position={[0, 0.1, 0]} castShadow>
              <cylinderGeometry args={[0.46, 0.34, 0.2, 16]} />
              <meshStandardMaterial color="#f472b6" roughness={0.4} />
            </mesh>
            {/* Thân tượng Phật vàng */}
            <mesh position={[0, 0.48, 0]} castShadow>
              <coneGeometry args={[0.38, 0.68, 16]} />
              <meshStandardMaterial
                color="#fbbf24"
                metalness={0.65}
                roughness={0.25}
                emissive="#b45309"
                emissiveIntensity={0.2}
              />
            </mesh>
            {/* Đầu tượng Phật & Nhục kế */}
            <mesh position={[0, 0.92, 0]} castShadow>
              <sphereGeometry args={[0.21, 16, 16]} />
              <meshStandardMaterial color="#fcd34d" metalness={0.55} roughness={0.3} />
            </mesh>
            <mesh position={[0, 1.14, 0]} castShadow>
              <sphereGeometry args={[0.09, 12, 12]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        )}

        {/* LỰA CHỌN 2: ÔNG ĐỊA CƯỜI HIỀN HÒA CẦM QUẠT BA TIÊU */}
        {selectedDeity === 'ong_dia' && (
          <group position={[0, 1.45, -0.25]}>
            {/* Ngai đỏ viền vàng */}
            <mesh position={[0, 0.35, -0.18]} castShadow>
              <boxGeometry args={[0.88, 0.75, 0.12]} />
              <meshStandardMaterial color="#991b1b" roughness={0.5} />
            </mesh>
            {/* Bụng tròn phúc hậu của Ông Địa */}
            <mesh position={[0, 0.38, 0.04]} castShadow>
              <sphereGeometry args={[0.36, 16, 16]} />
              <meshStandardMaterial color="#fcd34d" roughness={0.45} />
            </mesh>
            {/* Áo choàng đỏ thêu vàng hai bên */}
            <mesh position={[0, 0.36, -0.02]} castShadow>
              <cylinderGeometry args={[0.37, 0.42, 0.56, 16]} />
              <meshStandardMaterial color="#dc2626" roughness={0.5} />
            </mesh>
            {/* Đầu Ông Địa & Khăn vấn đầu */}
            <mesh position={[0, 0.84, 0.02]} castShadow>
              <sphereGeometry args={[0.23, 16, 16]} />
              <meshStandardMaterial color="#fde68a" roughness={0.45} />
            </mesh>
            <mesh position={[0, 0.96, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.21, 0.045, 10, 20]} />
              <meshStandardMaterial color="#dc2626" />
            </mesh>
            {/* Quạt ba tiêu bên tay phải */}
            <mesh position={[0.38, 0.58, 0.16]} rotation={[0, 0, -0.35]} castShadow>
              <cylinderGeometry args={[0.16, 0.04, 0.32, 12]} />
              <meshStandardMaterial color="#16a34a" roughness={0.5} />
            </mesh>
          </group>
        )}

        {/* LỰA CHỌN 3: THẦN TÀI CẦM THỎI VÀNG KIM NGUYÊN BẢO */}
        {selectedDeity === 'than_tai' && (
          <group position={[0, 1.45, -0.25]}>
            {/* Hào quang kim tiền */}
            <mesh ref={haloRef} position={[0, 0.72, -0.2]}>
              <ringGeometry args={[0.4, 0.58, 16]} />
              <meshBasicMaterial color="#fbbf24" side={THREE.DoubleSide} transparent opacity={0.75} />
            </mesh>
            {/* Áo gấm đỏ thêu vàng */}
            <mesh position={[0, 0.44, 0]} castShadow>
              <cylinderGeometry args={[0.3, 0.4, 0.72, 16]} />
              <meshStandardMaterial color="#b91c1c" roughness={0.4} />
            </mesh>
            {/* Đai ngọc vàng */}
            <mesh position={[0, 0.38, 0.02]}>
              <cylinderGeometry args={[0.35, 0.35, 0.09, 16]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.7} roughness={0.2} />
            </mesh>
            {/* Đầu Thần Tài, Râu dài & Mão cánh chuồn vàng */}
            <mesh position={[0, 0.9, 0]} castShadow>
              <sphereGeometry args={[0.21, 16, 16]} />
              <meshStandardMaterial color="#fde68a" roughness={0.4} />
            </mesh>
            {/* Râu dài */}
            <mesh position={[0, 0.7, 0.18]} castShadow>
              <coneGeometry args={[0.08, 0.28, 8]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
            {/* Mão Thần Tài */}
            <mesh position={[0, 1.1, 0]} castShadow>
              <boxGeometry args={[0.28, 0.18, 0.24]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.7} roughness={0.25} />
            </mesh>
            <mesh position={[0, 1.1, -0.05]} castShadow>
              <boxGeometry args={[0.64, 0.05, 0.06]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.6} />
            </mesh>
            {/* Thỏi vàng Kim Nguyên Bảo lớn trên tay */}
            <mesh position={[0, 0.56, 0.32]} castShadow>
              <boxGeometry args={[0.36, 0.16, 0.2]} />
              <meshStandardMaterial
                color="#fde047"
                metalness={0.85}
                roughness={0.15}
                emissive="#ca8a04"
                emissiveIntensity={0.4}
              />
            </mesh>
          </group>
        )}

        {/* ==================== LƯ HƯƠNG & 3 NÉN NHANG ==================== */}
        <group position={[0, 1.02, 0.28]}>
          {/* Bát hương đồng */}
          <mesh position={[0, 0.14, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.18, 0.26, 16]} />
            <meshStandardMaterial color="#d97706" metalness={0.6} roughness={0.35} />
          </mesh>
          {/* 3 nén nhang cháy đỏ khi thắp nhang */}
          {offeringVisible && (
            <group position={[0.38, 0.05, 0]}>
              <mesh><cylinderGeometry args={[0.17, 0.14, 0.035, 16]} /><meshStandardMaterial color="#fde68a" /></mesh>
              {[-0.09, 0, 0.09].map((x, index) => (
                <mesh key={x} position={[x, 0.072, 0]}><sphereGeometry args={[0.055, 10, 8]} />
                  <meshStandardMaterial color={['#ef4444', '#fb923c', '#84cc16'][index]} /></mesh>
              ))}
            </group>
          )}
          {incenseLit && (
            <group>
              {[-0.06, 0, 0.06].map((xOffset, idx) => (
                <group key={idx} position={[xOffset, 0.38, 0]}>
                  <mesh>
                    <cylinderGeometry args={[0.008, 0.008, 0.32, 6]} />
                    <meshStandardMaterial color="#dc2626" />
                  </mesh>
                  <mesh position={[0, 0.17, 0]}>
                    <sphereGeometry args={[0.018, 8, 8]} />
                    <meshBasicMaterial color="#fb923c" />
                  </mesh>
                </group>
              ))}
            </group>
          )}
        </group>

        {/* ==================== CÁI MÕ GỖ & DÙI MÕ (BẤM GÕ TRỰC TIẾP TRONG 3D) ==================== */}
        <group
          position={[0.85, 1.04, 0.32]}
          onClick={(e) => {
            e.stopPropagation();
            onStrikeMo();
          }}
          onPointerOver={() => {
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          {/* Đệm lót mõ */}
          <mesh position={[0, 0.04, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.26, 0.07, 16]} />
            <meshStandardMaterial color="#991b1b" />
          </mesh>
          {/* Thân mõ gỗ tròn */}
          <group ref={moGroupRef} position={[0, 0.18, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.19, 16, 16]} />
              <meshStandardMaterial color="#b45309" roughness={0.45} />
            </mesh>
            {/* Khe miệng mõ */}
            <mesh position={[0, 0, 0.16]}>
              <boxGeometry args={[0.24, 0.035, 0.06]} />
              <meshBasicMaterial color="#271203" />
            </mesh>
          </group>
          {/* Dùi gõ mõ */}
          <group ref={malletRef} position={[0.22, 0.32, 0]}>
            <mesh position={[-0.08, 0, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.28, 8]} />
              <meshStandardMaterial color="#78350f" />
            </mesh>
          </group>

          {/* Chữ +1 Công đức / Tịnh tâm bay lên khi gõ mõ */}
          {floatingMeritText && (
            <Html position={[0, 0.65, 0]} center zIndexRange={[30, 0]}>
              <div
                key={moPulseKey}
                data-testid="zen-floating-merit"
                className="pointer-events-none whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold text-slate-950 shadow-xl ring-2 ring-white animate-bounce"
              >
                {floatingMeritText}
              </div>
            </Html>
          )}
        </group>

        {/* ==================== CHUÔNG ĐỒNG (BẤM THỈNH CHUÔNG TRONG 3D) ==================== */}
        <group
          position={[-0.85, 1.04, 0.32]}
          onClick={(e) => {
            e.stopPropagation();
            onRingBell();
          }}
          onPointerOver={() => {
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <mesh position={[0, 0.04, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.24, 0.07, 16]} />
            <meshStandardMaterial color="#991b1b" />
          </mesh>
          <mesh position={[0, 0.16, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.13, 0.22, 16]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.75} roughness={0.25} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

/**
 * Gian Phòng Giải Trí 3D (Bia Phóng Phi Tiêu 3D, Máy Game Arcade Neon & Bàn Bida/Lounge)
 * Nằm cạnh Phòng Tịnh Tâm ở phía sau bức tường Bắc (-7.6, 0, -10.2)
 */
const EntertainmentRoom3D: React.FC<{
  onOpenGameHub?: () => void;
}> = ({ onOpenGameHub }) => {
  return (
    <group position={[-7.6, 0, -10.2]}>
      {/* Đèn Neon Tím & Xanh Cyan cho Phòng Giải Trí */}
      <pointLight position={[0, 3.4, -0.5]} intensity={1.35} color="#818cf8" distance={9} />
      <pointLight position={[-2.0, 2.2, -1.2]} intensity={0.9} color="#ec4899" distance={6} />
      <pointLight position={[2.0, 2.2, -1.2]} intensity={0.9} color="#06b6d4" distance={6} />

      {/* Sàn Phòng Giải Trí (Tông xanh đen Cyber) */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[7.0, 0.14, 6.2]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.7} />
      </mesh>
      {/* Thảm đứng phóng phi tiêu */}
      <mesh position={[0, 0.03, 0.5]} receiveShadow>
        <boxGeometry args={[2.8, 0.02, 3.4]} />
        <meshStandardMaterial color="#312e81" roughness={0.85} />
      </mesh>
      {/* Vạch đứng ném tiêu (Throw line) */}
      <mesh position={[0, 0.045, 1.4]}>
        <boxGeometry args={[1.8, 0.01, 0.08]} />
        <meshBasicMaterial color="#f43f5e" />
      </mesh>

      {/* Vách tường hậu & Vách 2 bên của Phòng Giải Trí */}
      <mesh position={[0, 1.6, -2.95]} receiveShadow castShadow>
        <boxGeometry args={[7.0, 3.2, 0.18]} />
        <meshStandardMaterial color="#0f172a" roughness={0.65} />
      </mesh>
      <mesh position={[-3.45, 1.6, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.18, 3.2, 6.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      <mesh position={[3.45, 1.6, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.18, 3.2, 6.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>

      {/* BIA PHÓNG PHI TIÊU 3D TREO TRÊN TƯỜNG CHÍNH GIỮA */}
      <group
        position={[0, 1.75, -2.8]}
        onClick={(e) => {
          e.stopPropagation();
          onOpenGameHub?.();
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        {/* Bảng gỗ lót sau bia */}
        <mesh position={[0, 0, -0.03]} castShadow>
          <boxGeometry args={[1.7, 1.7, 0.06]} />
          <meshStandardMaterial color="#31102f" roughness={0.6} />
        </mesh>
        {/* Các vòng tròn đồng tâm của Bia Phóng Phi Tiêu 3D */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
          <cylinderGeometry args={[0.68, 0.68, 0.05, 32]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.03]}>
          <cylinderGeometry args={[0.52, 0.52, 0.05, 32]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.04]}>
          <cylinderGeometry args={[0.36, 0.36, 0.05, 32]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]}>
          <cylinderGeometry args={[0.21, 0.21, 0.05, 32]} />
          <meshStandardMaterial color="#16a34a" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.06]}>
          <cylinderGeometry args={[0.09, 0.09, 0.05, 24]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      </group>

      {/* 2 MÁY GAME THÙNG ARCADE HAI BÊN TƯỜNG */}
      {[-2.15, 2.15].map((xPos, idx) => (
        <group key={idx} position={[xPos, 0, -2.2]}>
          <mesh position={[0, 0.95, 0]} castShadow>
            <boxGeometry args={[0.95, 1.9, 0.85]} />
            <meshStandardMaterial color={idx === 0 ? '#4f46e5' : '#db2777'} roughness={0.4} />
          </mesh>
          {/* Màn hình phát sáng */}
          <mesh position={[0, 1.25, 0.43]}>
            <boxGeometry args={[0.72, 0.58, 0.04]} />
            <meshBasicMaterial color={idx === 0 ? '#38bdf8' : '#f472b6'} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * Bàn và ghế làm việc cố định (8 vị trí đăng ký)
 */
const WorkDeskUnit: React.FC<{
  onDeskClick?: (point: ScenePoint) => void;
  layout: SeatTransform;
  seatData?: WorkSeat;
  currentUserId: string;
  onSelectSeat: (seatId: string) => void;
  isClaiming: boolean;
}> = ({ layout, seatData, currentUserId, onSelectSeat, isClaiming, onDeskClick }) => {
  const [hovered, setHovered] = useState(false);
  const occupiedBy = seatData?.occupiedByUserId ?? null;
  const isMine = occupiedBy === currentUserId;
  const isAvailable = occupiedBy === null;

  const chairColor = isMine
    ? '#10b981'
    : isAvailable
      ? hovered
        ? '#38bdf8'
        : '#0284c7'
      : '#64748b';

  return (
    <group>
      <group position={layout.deskPosition} rotation={[0, layout.deskRotationY, 0]}>
        <mesh position={[0, 0.72, 0]} castShadow receiveShadow onClick={onDeskClick ? (e) => {
          e.stopPropagation();
          onDeskClick([e.point.x, layout.deskPosition[1] + 0.755, e.point.z]);
        } : undefined}>
          <boxGeometry args={[1.72, 0.07, 0.85]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.69, 0]} receiveShadow>
          <boxGeometry args={[1.76, 0.03, 0.89]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>
        {[
          [-0.78, 0.35, -0.36],
          [0.78, 0.35, -0.36],
          [-0.78, 0.35, 0.36],
          [0.78, 0.35, 0.36],
        ].map((pos, idx) => (
          <mesh key={idx} position={pos as [number, number, number]} castShadow>
            <boxGeometry args={[0.06, 0.7, 0.06]} />
            <meshStandardMaterial color="#334155" roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 0.77, 0]} castShadow>
          <boxGeometry args={[0.42, 0.03, 0.28]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.4} />
        </mesh>
      </group>

      <group
        position={layout.chairPosition}
        rotation={[0, layout.chairRotationY, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (isAvailable || isMine) {
            onSelectSeat(layout.seatId);
          }
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (isAvailable || isMine) {
            setHovered(true);
            document.body.style.cursor = 'pointer';
          }
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.48, 24]} />
          <meshBasicMaterial
            color={isMine ? '#10b981' : isAvailable ? '#38bdf8' : '#94a3b8'}
            transparent
            opacity={isAvailable || isMine ? 0.85 : 0.4}
          />
        </mesh>

        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.54, 0.08, 0.52]} />
          <meshStandardMaterial color={chairColor} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.72, -0.23]} castShadow>
          <boxGeometry args={[0.52, 0.54, 0.08]} />
          <meshStandardMaterial color={chairColor} roughness={0.5} />
        </mesh>
        <mesh position={[-0.29, 0.56, -0.02]} castShadow>
          <boxGeometry args={[0.06, 0.06, 0.36]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0.29, 0.56, -0.02]} castShadow>
          <boxGeometry args={[0.06, 0.06, 0.36]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0, 0.21, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 10]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>

        {isAvailable && hovered && (
          <Html position={[0, 1.02, 0]} center zIndexRange={[10, 0]}>
            <button
              type="button"
              disabled={isClaiming}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSeat(layout.seatId);
              }}
              data-testid={`seat-3d-btn-${layout.seatId}`}
              className="flex items-center justify-center whitespace-nowrap rounded-full bg-sky-500 px-2 py-0.5 text-[9px] font-bold text-slate-950 shadow cursor-pointer"
            >
              <span>Ngồi</span>
            </button>
          </Html>
        )}
      </group>
    </group>
  );
};

/**
 * Ghế bàn họp dùng chung (6 ghế ngồi tự do: H1..H6)
 */
const SharedMeetingChairUnit: React.FC<{
  chair: MeetingChairTransform;
  occupier?: RoomMember;
  currentUserId: string;
  onSelectMeetingChair: (chairId: string | null) => void;
}> = ({ chair, occupier, currentUserId, onSelectMeetingChair }) => {
  const [hovered, setHovered] = useState(false);
  const isMine = occupier?.userId === currentUserId;
  const isAvailable = !occupier;

  const chairColor = isMine
    ? '#f59e0b'
    : isAvailable
      ? hovered
        ? '#fbbf24'
        : '#cbd5e1'
      : '#64748b';

  return (
    <group
      position={chair.position}
      rotation={[0, chair.rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        if (isMine) {
          onSelectMeetingChair(null);
        } else if (isAvailable) {
          onSelectMeetingChair(chair.id);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (isAvailable || isMine) {
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.43, 24]} />
        <meshBasicMaterial
          color={isMine ? '#f59e0b' : isAvailable ? '#f59e0b' : '#64748b'}
          transparent
          opacity={isMine ? 0.9 : hovered ? 0.75 : 0.35}
        />
      </mesh>

      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.48, 0.07, 0.46]} />
        <meshStandardMaterial color={chairColor} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.7, -0.21]} castShadow>
        <boxGeometry args={[0.46, 0.48, 0.07]} />
        <meshStandardMaterial color={chairColor} roughness={0.55} />
      </mesh>
      <mesh position={[-0.25, 0.55, -0.02]} castShadow>
        <boxGeometry args={[0.05, 0.05, 0.32]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0.25, 0.55, -0.02]} castShadow>
        <boxGeometry args={[0.05, 0.05, 0.32]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0, 0.21, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {isAvailable && hovered && (
        <Html position={[0, 0.98, 0]} center zIndexRange={[10, 0]}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectMeetingChair(chair.id);
            }}
            data-testid={`meeting-chair-3d-${chair.id}`}
            className="flex items-center justify-center whitespace-nowrap rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold text-slate-950 shadow cursor-pointer"
          >
            <span>Ngồi họp</span>
          </button>
        </Html>
      )}
    </group>
  );
};

/**
 * Cây xanh chậu tròn tán lá xòe tự nhiên như trong ảnh sơ đồ
 */
const LushOfficePlant: React.FC<{ position: [number, number, number]; scale?: number }> = ({
  position,
  scale = 1,
}) => {
  const leafAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.26, 0.48, 16]} />
        <meshStandardMaterial color="#be185d" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.33, 0.33, 0.05, 16]} />
        <meshStandardMaterial color="#3f2e21" roughness={0.9} />
      </mesh>
      {leafAngles.map((deg, idx) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <group key={idx} position={[0, 0.52, 0]} rotation={[0, rad, 0]}>
            <mesh position={[0, 0.18, 0.32]} rotation={[0.55, 0, 0]} castShadow>
              <boxGeometry args={[0.16, 0.04, 0.62]} />
              <meshStandardMaterial
                color={idx % 2 === 0 ? '#15803d' : '#22c55e'}
                roughness={0.55}
              />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.72, 0]} castShadow>
        <dodecahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color="#16a34a" roughness={0.6} />
      </mesh>
    </group>
  );
};

/**
 * Tủ hồ sơ có ngăn kéo mở hé và tay nắm đúng như ký hiệu trong sơ đồ
 */
const DrawerCabinetUnit: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  length?: number;
  depth?: number;
  height?: number;
}> = ({ position, rotationY = 0, length = 3.1, depth = 0.85, height = 1.25 }) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, height, depth]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.55} />
      </mesh>
      <mesh position={[0, height + 0.01, 0]}>
        <boxGeometry args={[length + 0.04, 0.03, depth + 0.04]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>

      <mesh position={[-length * 0.28, height * 0.55, depth / 2 + 0.04]} castShadow>
        <boxGeometry args={[length * 0.26, height * 0.75, 0.06]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
      </mesh>
      <mesh position={[-length * 0.28, height * 0.55, depth / 2 + 0.09]}>
        <boxGeometry args={[0.16, 0.05, 0.04]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      <mesh position={[0, height * 0.55, depth / 2 + 0.04]} castShadow>
        <boxGeometry args={[length * 0.26, height * 0.75, 0.06]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
      </mesh>
      <mesh position={[0, height * 0.55, depth / 2 + 0.09]}>
        <boxGeometry args={[0.16, 0.05, 0.04]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      <mesh position={[length * 0.3, height * 0.52, depth / 2 + 0.16]} castShadow>
        <boxGeometry args={[length * 0.28, height * 0.72, 0.28]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
      </mesh>
      <mesh position={[length * 0.3, height * 0.52, depth / 2 + 0.32]}>
        <boxGeometry args={[0.18, 0.06, 0.05]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
};

/**
 * Mô hình Bé Mèo 3D dễ thương đi dạo, chơi đùa hoặc nằm ngủ NGAY TRONG VĂN PHÒNG LÀM VIỆC.
 * Mặc định chỉ hiện nhãn rất nhỏ; khi click vào bé mèo mới xổ ra hộp thông tin & nút Vuốt ve.
 */
const LowPolyCat3D: React.FC<{
  cat: OfficeCatProfile;
  index: number;
  isSelected: boolean;
  onSelectCat: () => void;
  onPetCat: () => void;
}> = ({ cat, index, isSelected, onSelectCat, onPetCat }) => {
  const groupRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const [petHeartBurst, setPetHeartBurst] = useState(false);

  const breed = ALL_PET_BREEDS.find((b) => b.id === cat.breedId) || CAT_BREEDS[0];
  const isMonkey = cat.breedId === 'monkey' || cat.species === 'monkey';
  const isDog = !isMonkey && (cat.species === 'dog' || isDogBreed(cat.breedId));

  // Các vị trí lối đi thông thoáng ngay bên trong văn phòng làm việc
  const officeWaypoints: [number, number][] = useMemo(
    () => [
      [-1.9, 0.3],   // Lối đi giữa bàn họp và dãy bàn làm việc
      [0.6, 1.35],   // Sảnh trung tâm văn phòng
      [-1.4, 2.55],  // Lối đi phía trước tủ hồ sơ dưới
      [3.7, -0.35],  // Hành lang giữa 2 cụm bàn làm việc
      [-4.6, -2.3],  // Góc thoáng phía trên bàn họp
      [1.8, -2.4],   // Lối đi gần cửa chính
    ],
    []
  );

  const [baseAnchorX, baseAnchorZ] = officeWaypoints[index % officeWaypoints.length];

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime() + index * 2.3;

    if (cat.activity === 'sleeping') {
      // Mèo nằm cuộn tròn thở nhịp nhàng trên đệm ngủ trong văn phòng
      groupRef.current.position.set(baseAnchorX, 0.05, baseAnchorZ);
      groupRef.current.rotation.y = 0.4;
      const breath = 1 + Math.sin(t * 2.2) * 0.04;
      groupRef.current.scale.set(breath, 0.82, breath);
    } else if (cat.activity === 'playing') {
      // Mèo nhảy nhót vờn quanh đồ chơi trong văn phòng
      const px = baseAnchorX + Math.cos(t * 1.5) * 0.48;
      const pz = baseAnchorZ + Math.sin(t * 1.5) * 0.42;
      const hop = Math.abs(Math.sin(t * 4.5)) * 0.14;
      groupRef.current.position.set(px, hop, pz);
      groupRef.current.rotation.y = -t * 1.5 + Math.PI / 2;
      groupRef.current.scale.set(1, 1, 1);
    } else {
      // Mèo đi dạo thong thả quanh các bàn làm việc trong văn phòng
      const wx = baseAnchorX + Math.sin(t * 0.65) * 0.95;
      const wz = baseAnchorZ + Math.cos(t * 0.48) * 0.65;
      const stepBob = Math.abs(Math.sin(t * 3.5)) * 0.045;
      const dx = Math.cos(t * 0.65) * 0.65 * 0.95;
      const dz = -Math.sin(t * 0.48) * 0.48 * 0.65;
      groupRef.current.position.set(wx, stepBob, wz);
      groupRef.current.rotation.y = Math.atan2(dx, dz);
      groupRef.current.scale.set(1, 1, 1);
    }

    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(t * 4.2) * 0.35;
    }
  });

  const handlePetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPetHeartBurst(true);
    onPetCat();
    window.setTimeout(() => {
      setPetHeartBurst(false);
    }, 1400);
  };

  return (
    <group
      ref={groupRef}
      position={[baseAnchorX, 0, baseAnchorZ]}
      onClick={(e) => {
        e.stopPropagation();
        onSelectCat();
      }}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Thân mèo */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.34, 0.24, 0.52]} />
        <meshStandardMaterial color={breed.bodyColor} roughness={0.65} />
      </mesh>

      {/* Bụng mèo */}
      <mesh position={[0, 0.19, 0.02]}>
        <boxGeometry args={[0.35, 0.14, 0.42]} />
        <meshStandardMaterial color={breed.bellyColor} roughness={0.75} />
      </mesh>

      {/* Đầu */}
      <mesh position={[0, 0.38, 0.24]} castShadow>
        <boxGeometry args={[0.32, 0.28, 0.28]} />
        <meshStandardMaterial
          color={isMonkey ? '#6b4423' : breed.bodyColor}
          roughness={0.6}
        />
      </mesh>

      {/* Khỉ Chó: Ngực kem, mặt nạ kem, tai tròn 8 cạnh, vòng cổ xanh thẻ vàng */}
      {isMonkey ? (
        <>
          {/* Ngực kem phía trước */}
          <mesh position={[0, 0.2, 0.25]}>
            <boxGeometry args={[0.26, 0.18, 0.04]} />
            <meshStandardMaterial color="#f2d0a9" roughness={0.65} />
          </mesh>
          {/* Mặt nạ kem 2 thùy (trái tim) */}
          <mesh position={[-0.055, 0.4, 0.382]}>
            <boxGeometry args={[0.12, 0.14, 0.02]} />
            <meshStandardMaterial color="#f2d0a9" roughness={0.65} />
          </mesh>
          <mesh position={[0.055, 0.4, 0.382]}>
            <boxGeometry args={[0.12, 0.14, 0.02]} />
            <meshStandardMaterial color="#f2d0a9" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.34, 0.383]}>
            <boxGeometry args={[0.22, 0.14, 0.02]} />
            <meshStandardMaterial color="#f2d0a9" roughness={0.65} />
          </mesh>
          {/* Tai tròn 8 cạnh bên trái */}
          <mesh position={[-0.19, 0.39, 0.23]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.05, 8]} />
            <meshStandardMaterial color="#6b4423" roughness={0.65} />
          </mesh>
          <mesh position={[-0.2, 0.39, 0.245]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.062, 0.062, 0.055, 8]} />
            <meshStandardMaterial color="#d99b82" roughness={0.65} />
          </mesh>
          {/* Tai tròn 8 cạnh bên phải */}
          <mesh position={[0.19, 0.39, 0.23]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.05, 8]} />
            <meshStandardMaterial color="#6b4423" roughness={0.65} />
          </mesh>
          <mesh position={[0.2, 0.39, 0.245]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.062, 0.062, 0.055, 8]} />
            <meshStandardMaterial color="#d99b82" roughness={0.65} />
          </mesh>
          {/* Vòng cổ xanh & thẻ vàng */}
          <mesh position={[0, 0.26, 0.22]}>
            <boxGeometry args={[0.35, 0.05, 0.16]} />
            <meshStandardMaterial color="#134e4a" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.24, 0.31]}>
            <boxGeometry args={[0.075, 0.075, 0.02]} />
            <meshStandardMaterial color="#eab308" metalness={0.5} roughness={0.3} />
          </mesh>
        </>
      ) : isDog ? (
        <>
          <mesh position={[-0.17, 0.42, 0.24]} rotation={[0.1, 0, 0.28]} castShadow>
            <boxGeometry args={[0.07, 0.16, 0.11]} />
            <meshStandardMaterial color={breed.earColor} roughness={0.65} />
          </mesh>
          <mesh position={[0.17, 0.42, 0.24]} rotation={[0.1, 0, -0.28]} castShadow>
            <boxGeometry args={[0.07, 0.16, 0.11]} />
            <meshStandardMaterial color={breed.earColor} roughness={0.65} />
          </mesh>
          {/* Mõm chó */}
          <mesh position={[0, 0.33, 0.41]} castShadow>
            <boxGeometry args={[0.16, 0.11, 0.12]} />
            <meshStandardMaterial color={breed.bellyColor} roughness={0.65} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[-0.1, 0.56, 0.24]} rotation={[0, 0, 0.18]} castShadow>
            <coneGeometry args={[0.065, 0.13, 4]} />
            <meshStandardMaterial color={breed.earColor} roughness={0.65} />
          </mesh>
          <mesh position={[0.1, 0.56, 0.24]} rotation={[0, 0, -0.18]} castShadow>
            <coneGeometry args={[0.065, 0.13, 4]} />
            <meshStandardMaterial color={breed.earColor} roughness={0.65} />
          </mesh>
        </>
      )}

      {/* Mắt & Mũi hồng */}
      <mesh position={[-0.07, 0.4, 0.385]}>
        <sphereGeometry args={[0.026, 8, 8]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.07, 0.4, 0.385]}>
        <sphereGeometry args={[0.026, 8, 8]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, 0.35, 0.39]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshBasicMaterial color="#f472b6" />
      </mesh>

      {/* 4 chân nhỏ */}
      {[
        [-0.11, 0.08, 0.17],
        [0.11, 0.08, 0.17],
        [-0.11, 0.08, -0.17],
        [0.11, 0.08, -0.17],
      ].map(([lx, ly, lz], i) => (
        <mesh key={i} position={[lx, ly, lz]} castShadow>
          <boxGeometry args={[0.08, 0.16, 0.08]} />
          <meshStandardMaterial color={breed.bellyColor} roughness={0.7} />
        </mesh>
      ))}

      {/* Đuôi mèo ngoe nguẩy */}
      <mesh
        ref={tailRef}
        position={[0, 0.32, -0.28]}
        rotation={[-0.65, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.03, 0.035, 0.32, 8]} />
        <meshStandardMaterial color={breed.earColor} roughness={0.65} />
      </mesh>

      {/* Nhãn siêu gọn trên đầu bé mèo: Click vào mới xổ thẻ chi tiết, click ✕ để đóng */}
      <Html position={[0, 0.78, 0]} center zIndexRange={[15, 0]}>
        {isSelected ? (
          <div
            data-testid={`cat-3d-popup-${cat.ownerUserId}`}
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col items-center gap-1 rounded-2xl border-2 border-amber-400 bg-slate-950/95 px-2.5 py-2 text-center shadow-2xl backdrop-blur-md min-w-[148px]"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-[11px] font-black text-amber-300">
                🐱 {cat.catName}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCat();
                }}
                className="text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="text-[10px] font-semibold text-slate-200 whitespace-nowrap">
              Chủ: <strong className="text-emerald-300">{cat.ownerNickname}</strong>
            </div>
            <div className="text-[9px] font-bold text-amber-200/90">
              {getActivityLabel(cat.activity)}
            </div>
            {petHeartBurst && (
              <div className="text-[10px] font-black text-rose-400 animate-bounce">
                💕 Meow~ (+1)
              </div>
            )}
            <button
              type="button"
              data-testid={`pet-3d-cat-btn-${cat.ownerUserId}`}
              onClick={handlePetClick}
              className="mt-0.5 inline-flex items-center gap-1 rounded-xl bg-rose-500 hover:bg-rose-400 px-2.5 py-1 text-[10px] font-black text-white shadow cursor-pointer"
            >
              🤚 Vuốt ve ({cat.petCount})
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid={`inspect-3d-cat-btn-${cat.ownerUserId}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectCat();
            }}
            className="whitespace-nowrap rounded-full border border-amber-300/60 bg-slate-950/75 hover:bg-slate-900 px-1.5 py-0.2 text-[9px] font-bold text-amber-200 shadow-sm cursor-pointer"
          >
            🐾 {cat.catName}
          </button>
        )}
      </Html>
    </group>
  );
};

/**
 * Các bé mèo, đệm ngủ và đồ chơi được đặt NGAY TRONG VĂN PHÒNG LÀM VIỆC
 * để mọi người vừa làm việc vừa ngắm mèo đi dạo, chơi đùa hoặc nằm ngủ.
 */
const OutdoorCatCourtyard3D: React.FC<{
  roomCats?: Record<string, OfficeCatProfile>;
  members?: RoomMember[];
  currentUserId: string;
  onPetCatIn3D?: (cat: OfficeCatProfile) => void;
  onOpenCatGame?: () => void;
}> = ({ roomCats = {}, members = [], currentUserId, onPetCatIn3D }) => {
  const [selectedCatOwnerId, setSelectedCatOwnerId] = useState<string | null>(null);

  // Chỉ hiển thị các bé thú cưng THẬT gắn với thành viên trong phòng
  const displayCats = useMemo(() => {
    const validOwnerIds = new Set(members.map((m) => m.userId));
    if (currentUserId) validOwnerIds.add(currentUserId);
    const mapByOwner = new Map<string, OfficeCatProfile>();
    for (const c of Object.values(roomCats)) {
      if (
        c &&
        c.ownerUserId &&
        c.ownerUserId !== 'colleague_demo_linh' &&
        (validOwnerIds.size === 0 || validOwnerIds.has(c.ownerUserId))
      ) {
        mapByOwner.set(c.ownerUserId, c);
      }
    }
    return Array.from(mapByOwner.values());
  }, [roomCats, members, currentUserId]);

  const placedItems = useMemo(() => {
    const set = new Set<string>(['yarn_ball', 'daisy_bed']);
    for (const c of Object.values(roomCats)) {
      for (const itemId of c.placedYardItems || []) {
        set.add(itemId);
      }
    }
    return Array.from(set);
  }, [roomCats]);

  return (
    <group position={[0, 0, 0]}>
      {/* Đệm ngủ hoa cúc đặt ngay góc thoáng trong văn phòng */}
      {placedItems.includes('daisy_bed') && (
        <group position={[-1.9, 0.04, 2.65]}>
          <mesh receiveShadow castShadow>
            <cylinderGeometry args={[0.42, 0.46, 0.08, 20]} />
            <meshStandardMaterial color="#fde047" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.28, 0.28, 0.04, 16]} />
            <meshStandardMaterial color="#fffbeb" roughness={0.8} />
          </mesh>
        </group>
      )}

      {/* Đệm nhung hoàng gia đặt trong văn phòng */}
      {placedItems.includes('royal_cushion') && (
        <group position={[0.6, 0.05, 2.7]}>
          <mesh receiveShadow castShadow>
            <cylinderGeometry args={[0.45, 0.48, 0.1, 20]} />
            <meshStandardMaterial color="#ec4899" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.04, 16]} />
            <meshStandardMaterial color="#fce7f3" roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* Cuộn len đồ chơi đặt giữa lối đi văn phòng */}
      {placedItems.includes('yarn_ball') && (
        <mesh position={[-1.1, 0.12, 0.55]} castShadow>
          <sphereGeometry args={[0.13, 14, 14]} />
          <meshStandardMaterial color="#f43f5e" roughness={0.5} />
        </mesh>
      )}

      {/* Cần câu lông vũ đặt trong văn phòng */}
      {placedItems.includes('feather_wand') && (
        <group position={[0.9, 0, 0.85]}>
          <mesh position={[0, 0.24, 0]} rotation={[0, 0, 0.3]} castShadow>
            <cylinderGeometry args={[0.02, 0.025, 0.48, 8]} />
            <meshStandardMaterial color="#d97706" />
          </mesh>
          <mesh position={[0.1, 0.45, 0]} castShadow>
            <sphereGeometry args={[0.08, 10, 10]} />
            <meshStandardMaterial color="#38bdf8" />
          </mesh>
        </group>
      )}

      {/* Các bé mèo của mình và của đồng nghiệp đi chơi ngay trong văn phòng làm việc */}
      {displayCats.map((cat, idx) => (
        <LowPolyCat3D
          key={cat.ownerUserId}
          cat={cat}
          index={idx}
          isSelected={selectedCatOwnerId === cat.ownerUserId}
          onSelectCat={() =>
            setSelectedCatOwnerId((prev) =>
              prev === cat.ownerUserId ? null : cat.ownerUserId
            )
          }
          onPetCat={() => {
            if (onPetCatIn3D) onPetCatIn3D(cat);
          }}
        />
      ))}
    </group>
  );
};

export const OfficeScene3D: React.FC<OfficeScene3DProps> = ({
  walkTarget,
  decorations,
  outfit,
  action,
  offeringVisible,
  onFloorClick,
  onDeskClick,
  currentUserId,
  members: roomMembers,
  seats,
  activeBubbles,
  onSelectSeat,
  onSelectMeetingChair,
  claimingSeatId,
  cameraMode,
  inZenRoom,
  onEnterZenRoom,
  inGameRoom = false,
  onEnterGameRoom,
  selectedDeity,
  incenseLit,
  isBowing,
  moPulseKey,
  floatingMeritText,
  onStrikeMo,
  onRingBell,
  onOpenDonationBox,
  donationTotalVnd = 0,
  abbotAtDonationDesk = true,
  roomCats,
  onPetCatIn3D,
}) => {
  const staticRoom = isUsingStaticFallback();
  const members = useMemo(() => staticRoom
    ? uniqueStaticRoomMembers(roomMembers, currentUserId)
    : roomMembers, [staticRoom, roomMembers, currentUserId]);
  const nicknameCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members) {
      const key = m.nickname.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [members]);

  const characterPlacements = useMemo(() => {
    const seatLayoutMap = new Map<string, SeatTransform>();
    for (const l of WORK_SEAT_LAYOUTS) {
      seatLayoutMap.set(l.seatId, l);
    }

    const meetingChairMap = new Map<string, MeetingChairTransform>();
    for (const c of MEETING_CHAIRS) {
      meetingChairMap.set(c.id, c);
    }

    const standingMembers = members
      .filter((m) => !m.seatId && !m.meetingChairId && !m.inZenRoom)
      .sort((a, b) => a.userId.localeCompare(b.userId));

    // Tối đa 10 chỗ ngồi Bồ đoàn trong Phòng Tịnh Tâm (2 hàng x 5 chỗ)
    const zenCushionSlots: [number, number, number][] = [
      [0, 0.08, -9.2],
      [-1.1, 0.08, -9.2],
      [1.1, 0.08, -9.2],
      [-2.2, 0.08, -9.2],
      [2.2, 0.08, -9.2],
      [0, 0.08, -8.15],
      [-1.1, 0.08, -8.15],
      [1.1, 0.08, -8.15],
      [-2.2, 0.08, -8.15],
      [2.2, 0.08, -8.15],
    ];
    const zenMembers = members
      .filter((m) => m.inZenRoom || (m.userId === currentUserId && inZenRoom))
      .sort((a, b) => a.userId.localeCompare(b.userId));

    return members.map((member) => {
      // Nếu thành viên đang ở trong Phòng Tịnh Tâm -> đặt ngồi trên 1 trong 10 đệm Bồ đoàn (hoặc bàn góc trái cho Trụ trì Thanh Ngọc)
      const zenIdx = zenMembers.findIndex((zm) => zm.userId === member.userId);
      if (zenIdx !== -1) {
        const normalizedNick = member.nickname
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        if (normalizedNick.includes('thanh ngoc') && abbotAtDonationDesk) {
          return {
            member,
            isSeated: true,
            position: [-3.76, 0.12, -10.35] as [number, number, number],
            rotationY: Math.PI / 2, // Ngồi ở bàn công đức góc trái quay mặt sang phải
          };
        }
        const slot = zenCushionSlots[zenIdx % zenCushionSlots.length];
        return {
          member,
          isSeated: true,
          position: slot,
          rotationY: Math.PI, // Nhìn thẳng về phía bàn thờ Phật / Ông Địa / Thần Tài (-Z)
        };
      }

      // Nếu là người dùng hiện tại đang ở trong Phòng Giải Trí -> đứng trước vạch phóng phi tiêu nhìn vào Bia 3D
      if (member.userId === currentUserId && inGameRoom) {
        return {
          member,
          isSeated: false,
          position: [-7.6, 0, -8.85] as [number, number, number],
          rotationY: Math.PI, // Nhìn thẳng về phía Bia Phóng Phi Tiêu (-Z)
        };
      }

      if (member.userId === currentUserId && walkTarget) {
        return { member, isSeated: false, position: walkTarget, rotationY: 0 };
      }
      if (member.meetingChairId && meetingChairMap.has(member.meetingChairId)) {
        const mChair = meetingChairMap.get(member.meetingChairId)!;
        return {
          member,
          isSeated: true,
          position: mChair.position,
          rotationY: mChair.rotationY,
        };
      }

      if (member.seatId && seatLayoutMap.has(member.seatId)) {
        const seatLayout = seatLayoutMap.get(member.seatId)!;
        return {
          member,
          isSeated: true,
          position: seatLayout.chairPosition,
          rotationY: seatLayout.chairRotationY,
        };
      }

      const standIndex = standingMembers.findIndex((m) => m.userId === member.userId);
      const slot =
        DOOR_STANDING_SLOTS[Math.max(0, standIndex) % DOOR_STANDING_SLOTS.length];
      const overflowLayer = Math.floor(Math.max(0, standIndex) / DOOR_STANDING_SLOTS.length);
      const pos: [number, number, number] = [
        slot.position[0] - overflowLayer * 0.55,
        0,
        slot.position[2] + overflowLayer * 0.45,
      ];

      return {
        member,
        isSeated: false,
        position: pos,
        rotationY: slot.rotationY,
      };
    });
  }, [members, currentUserId, inZenRoom, inGameRoom, abbotAtDonationDesk, walkTarget]);

  const myPlacement = useMemo(() => {
    const found = characterPlacements.find((p) => p.member.userId === currentUserId);
    return (
      found ?? {
        position: [3.8, 0, -3.6] as [number, number, number],
        rotationY: 0,
        isSeated: false,
      }
    );
  }, [characterPlacements, currentUserId]);

  const myMember = members.find((m) => m.userId === currentUserId);
  const isMeAtMeetingTable = Boolean(myMember?.meetingChairId);
  const virtualKeysRef = useRef<Set<string>>(new Set());

  const bindVirtualKey = (key: 'w' | 'a' | 's' | 'd') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      virtualKeysRef.current.add(key);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.stopPropagation();
      virtualKeysRef.current.delete(key);
    },
    onPointerLeave: () => {
      virtualKeysRef.current.delete(key);
    },
    onPointerCancel: () => {
      virtualKeysRef.current.delete(key);
    },
  });

  return (
    <div className="relative w-full h-full touch-none bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900">
      {/* Tâm ngắm, hướng dẫn & Cụm nút di chuyển cảm ứng (D-Pad) cho điện thoại khi ở Góc nhìn thứ nhất */}
      {cameraMode === 'first_person' && (
        <>
          <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
            <div className="h-2.5 w-2.5 rounded-full border-2 border-emerald-400/80 bg-white/40 shadow" />
          </div>
          <div className="pointer-events-none fixed top-20 sm:top-16 left-1/2 -translate-x-1/2 z-20 max-w-[92vw] text-center rounded-full border border-white/15 bg-slate-950/75 px-3 py-1 text-[10px] sm:text-[11px] text-slate-200 backdrop-blur-md shadow">
            👁️ Vuốt màn hình để nhìn 360° • Dùng nút di chuyển hoặc phím <strong>WASD</strong> để đi bộ
          </div>

          {/* Cụm phím di chuyển cảm ứng (D-Pad) hỗ trợ điện thoại & máy tính bảng */}
          <div
            data-testid="mobile-fpv-dpad"
            className="fixed bottom-20 left-3 z-20 grid grid-cols-3 gap-1.5 w-28 h-28 select-none"
          >
            <div />
            <button
              type="button"
              aria-label="Tiến lên"
              {...bindVirtualKey('w')}
              className="flex items-center justify-center rounded-xl border border-white/25 bg-slate-900/75 active:bg-emerald-500 active:text-slate-950 text-white text-sm font-bold backdrop-blur-md shadow-lg cursor-pointer"
            >
              ▲
            </button>
            <div />
            <button
              type="button"
              aria-label="Sang trái"
              {...bindVirtualKey('a')}
              className="flex items-center justify-center rounded-xl border border-white/25 bg-slate-900/75 active:bg-emerald-500 active:text-slate-950 text-white text-sm font-bold backdrop-blur-md shadow-lg cursor-pointer"
            >
              ◀
            </button>
            <button
              type="button"
              aria-label="Lùi lại"
              {...bindVirtualKey('s')}
              className="flex items-center justify-center rounded-xl border border-white/25 bg-slate-900/75 active:bg-emerald-500 active:text-slate-950 text-white text-sm font-bold backdrop-blur-md shadow-lg cursor-pointer"
            >
              ▼
            </button>
            <button
              type="button"
              aria-label="Sang phải"
              {...bindVirtualKey('d')}
              className="flex items-center justify-center rounded-xl border border-white/25 bg-slate-900/75 active:bg-emerald-500 active:text-slate-950 text-white text-sm font-bold backdrop-blur-md shadow-lg cursor-pointer"
            >
              ▶
            </button>
          </div>
        </>
      )}

      <Canvas
        shadows
        camera={{ position: [0, 14.2, 11.2], fov: 45 }}
        dpr={[1, 1.75]}
      >
        <color attach="background" args={['#0f172a']} />
        <ambientLight intensity={0.82} />
        <directionalLight
          castShadow
          position={[7, 16, 8]}
          intensity={1.2}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-14}
        />

        <group position={[0, -0.3, 0]}>
          {/* GIAN PHÒNG TỊNH TÂM 3D (Phật • Ông Địa • Thần Tài • Mõ Gỗ • Chuông Đồng) */}
          <ZenSanctuaryRoom3D
            selectedDeity={selectedDeity}
            incenseLit={incenseLit}
            offeringVisible={offeringVisible}
            moPulseKey={moPulseKey}
            floatingMeritText={floatingMeritText}
            onStrikeMo={onStrikeMo}
            onRingBell={onRingBell}
            onOpenDonationBox={onOpenDonationBox}
            donationTotalVnd={donationTotalVnd}
          />

          {/* GIAN PHÒNG GIẢI TRÍ 3D (Bia Phóng Phi Tiêu 3D • Máy Arcade • Đấu Solo) */}
          <EntertainmentRoom3D onOpenGameHub={onEnterGameRoom} />

          {/* KHU VỰC BÊN NGOÀI VĂN PHÒNG (Sân Vườn Mèo 3D: Gặp mèo của mình & mèo của đồng nghiệp) */}
          <OutdoorCatCourtyard3D
            roomCats={roomCats}
            members={members}
            currentUserId={currentUserId}
            onPetCatIn3D={onPetCatIn3D}
            onOpenCatGame={onEnterGameRoom}
          />

          {/* SÀN PHÒNG VĂN PHÒNG CHÍNH (16.0m x 10.8m) */}
          <mesh position={[0, -0.08, 0]} receiveShadow onClick={(e) => {
            e.stopPropagation();
            onFloorClick([e.point.x, 0, e.point.z]);
          }}>
            <boxGeometry args={[16.0, 0.16, 10.8]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.88} />
          </mesh>
          {decorations.map(({ id, item, position }) => (
            <group key={id} position={position}>
              <mesh position={[0, item === 'plant' ? 0.13 : 0.045, 0]} castShadow>
                <boxGeometry args={item === 'computer' ? [0.44, 0.09, 0.3] : [0.23, item === 'plant' ? 0.26 : 0.09, 0.23]} />
                <meshStandardMaterial color={item === 'plant' ? '#92400e' : '#334155'} />
              </mesh>
              <mesh position={[0, item === 'plant' ? 0.42 : 0.27, item === 'computer' ? -0.12 : 0]} castShadow>
                {item === 'plant' ? <sphereGeometry args={[0.21, 10, 8]} /> :
                  item === 'lamp' ? <coneGeometry args={[0.15, 0.2, 12]} /> : <boxGeometry args={[0.46, 0.33, 0.045]} />}
                <meshStandardMaterial color={item === 'plant' ? '#15803d' : item === 'lamp' ? '#fbbf24' : '#0284c7'} />
              </mesh>
            </group>
          ))}

          {/* TƯỜNG BAO QUANH MẢNH */}
          <mesh position={[0, 0.9, -5.35]} receiveShadow castShadow>
            <boxGeometry args={[16.0, 1.8, 0.14]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.75} />
          </mesh>
          <mesh position={[-7.95, 0.9, 0]} receiveShadow castShadow>
            <boxGeometry args={[0.14, 1.8, 10.8]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.75} />
          </mesh>
          <mesh position={[7.95, 0.9, 0.8]} receiveShadow castShadow>
            <boxGeometry args={[0.14, 1.8, 9.2]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.75} />
          </mesh>

          {/* CỔNG VÀO PHÒNG TỊNH TÂM & PHÒNG GIẢI TRÍ TRÊN TƯỜNG BẮC */}
          {!inZenRoom && !inGameRoom && (
            <>
              <group
                position={[2.3, 0, -5.22]}
                onClick={(e) => {
                  e.stopPropagation();
                  onEnterZenRoom();
                }}
                onPointerOver={() => {
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                  document.body.style.cursor = 'auto';
                }}
              >
                <mesh position={[0, 0.95, 0]} castShadow>
                  <boxGeometry args={[1.55, 1.9, 0.16]} />
                  <meshStandardMaterial color="#78350f" roughness={0.6} />
                </mesh>
                <mesh position={[0, 0.92, 0.04]}>
                  <boxGeometry args={[1.3, 1.75, 0.12]} />
                  <meshStandardMaterial color="#b45309" roughness={0.5} />
                </mesh>
                <Html position={[0, 2.02, 0]} center zIndexRange={[10, 0]}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEnterZenRoom();
                    }}
                    className="whitespace-nowrap rounded-full bg-amber-500/95 hover:bg-amber-400 px-2 py-0.5 text-[9px] font-bold text-slate-950 shadow cursor-pointer"
                  >
                    🪷 Tịnh Tâm
                  </button>
                </Html>
              </group>

              {onEnterGameRoom && (
                <group
                  position={[-3.2, 0, -5.22]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnterGameRoom();
                  }}
                  onPointerOver={() => {
                    document.body.style.cursor = 'pointer';
                  }}
                  onPointerOut={() => {
                    document.body.style.cursor = 'auto';
                  }}
                >
                  <mesh position={[0, 0.95, 0]} castShadow>
                    <boxGeometry args={[1.55, 1.9, 0.16]} />
                    <meshStandardMaterial color="#312e81" roughness={0.5} />
                  </mesh>
                  <mesh position={[0, 0.92, 0.04]}>
                    <boxGeometry args={[1.3, 1.75, 0.12]} />
                    <meshStandardMaterial color="#4f46e5" roughness={0.4} />
                  </mesh>
                  <Html position={[0, 2.02, 0]} center zIndexRange={[10, 0]}>
                    <button
                      type="button"
                      data-testid="enter-game-room-3d-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEnterGameRoom();
                      }}
                      className="whitespace-nowrap rounded-full bg-indigo-500/95 hover:bg-indigo-400 px-2 py-0.5 text-[9px] font-bold text-white shadow cursor-pointer"
                    >
                      🎮 Giải Trí
                    </button>
                  </Html>
                </group>
              )}
            </>
          )}

          {/* 1. CỬA ĐÔI MỞ VÀO Ở GÓC TRÊN BÊN PHẢI */}
          <group position={[7.85, 0, -4.15]}>
            <mesh position={[-0.35, 0.85, -0.58]} rotation={[0, 0.55, 0]} castShadow>
              <boxGeometry args={[0.75, 1.7, 0.06]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
            </mesh>
            <mesh position={[-0.35, 0.85, 0.58]} rotation={[0, -0.55, 0]} castShadow>
              <boxGeometry args={[0.75, 1.7, 0.06]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
            </mesh>
            <mesh position={[-0.05, 0.02, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <ringGeometry args={[0.68, 0.73, 24, 1, 0, Math.PI]} />
              <meshBasicMaterial color="#475569" />
            </mesh>
          </group>

          {/* 2. TỦ HỒ SƠ DỌC TƯỜNG TRÁI */}
          <DrawerCabinetUnit
            position={[-6.95, 0, -2.85]}
            rotationY={Math.PI / 2}
            length={3.5}
            depth={0.95}
          />
          <DrawerCabinetUnit
            position={[-6.95, 0, 0.8]}
            rotationY={Math.PI / 2}
            length={3.0}
            depth={0.95}
          />

          {/* 3. TỦ HỒ SƠ NGĂN GIỮA PHÍA TRÊN */}
          <DrawerCabinetUnit
            position={[0.75, 0, -2.75]}
            rotationY={Math.PI / 2}
            length={3.6}
            depth={0.95}
          />

          {/* 4. DÃY 4 TỦ HỒ SƠ NGANG SÁT TƯỜNG DƯỚI */}
          <DrawerCabinetUnit
            position={[-4.55, 0, 4.55]}
            rotationY={Math.PI}
            length={2.75}
            depth={0.85}
          />
          <DrawerCabinetUnit
            position={[-1.6, 0, 4.55]}
            rotationY={Math.PI}
            length={2.75}
            depth={0.85}
          />
          <DrawerCabinetUnit
            position={[1.35, 0, 4.55]}
            rotationY={Math.PI}
            length={2.75}
            depth={0.85}
          />
          <DrawerCabinetUnit
            position={[4.3, 0, 4.55]}
            rotationY={Math.PI}
            length={2.75}
            depth={0.85}
          />

          {/* 5. BA CHẬU CÂY XANH ĐÚNG VỊ TRÍ TRONG SƠ ĐỒ */}
          <LushOfficePlant position={[-6.85, 0, 3.65]} scale={1.25} />
          <LushOfficePlant position={[6.8, 0, -2.65]} scale={1.05} />
          <LushOfficePlant position={[5.2, 0, 0.3]} scale={0.95} />

          {/* 6. BÀN HỌP Ở NỬA TRÁI (Có 6 ghế dùng chung, ngồi tự do) */}
          <group position={MEETING_TABLE_POSITION}>
            <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.75, 0.08, 1.55]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.7, 0]}>
              <boxGeometry args={[2.8, 0.03, 1.6]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            <mesh position={[-0.9, 0.36, 0]} castShadow>
              <cylinderGeometry args={[0.16, 0.24, 0.72, 12]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            <mesh position={[0.9, 0.36, 0]} castShadow>
              <cylinderGeometry args={[0.16, 0.24, 0.72, 12]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            {isMeAtMeetingTable && (
              <Html position={[0, 1.02, 0]} center zIndexRange={[10, 0]}>
                <button
                  type="button"
                  data-testid="leave-meeting-3d-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectMeetingChair(null);
                  }}
                  className="whitespace-nowrap rounded-full bg-emerald-500 hover:bg-emerald-400 px-2.5 py-0.5 text-[10px] font-bold text-slate-950 shadow cursor-pointer"
                >
                  Rời bàn họp (Về chỗ)
                </button>
              </Html>
            )}
          </group>

          {/* 6 ghế bàn họp dùng chung (Ngồi tự do) */}
          {MEETING_CHAIRS.map((chair) => {
            const occupier = members.find((m) => m.meetingChairId === chair.id);
            return (
              <SharedMeetingChairUnit
                key={chair.id}
                chair={chair}
                occupier={occupier}
                currentUserId={currentUserId}
                onSelectMeetingChair={onSelectMeetingChair}
              />
            );
          })}

          {/* 7. 8 BÀN & GHẾ LÀM VIỆC CỐ ĐỊNH */}
          {WORK_SEAT_LAYOUTS.map((layout) => {
            const seatData = seats.find((s) => s.seatId === layout.seatId);
            return (
              <WorkDeskUnit
                key={layout.seatId}
                layout={layout}
                seatData={seatData}
                currentUserId={currentUserId}
                onSelectSeat={onSelectSeat}
                onDeskClick={onDeskClick}
                isClaiming={claimingSeatId === layout.seatId}
              />
            );
          })}

          {/* 8. CÁC NHÂN VẬT 3D TRONG PHÒNG */}
          {characterPlacements.map(({ member, isSeated, position, rotationY }) => {
            const isMe = member.userId === currentUserId;
            const bubble = activeBubbles[member.userId];
            const dupCount =
              nicknameCounts.get(member.nickname.trim().toLowerCase()) ?? 1;
            return (
              <LowPolyCharacter
                key={member.userId}
                gender={member.avatarGender}
                nickname={member.nickname}
                memberTag={member.memberTag}
                isCurrentUser={isMe}
                isManager={Boolean(member.isManager)}
                isOnline={member.online}
                isSeated={isSeated}
                isBowing={isMe && isBowing}
                outfit={isMe && outfit}
                action={isMe ? action : null}
                hideMeshInFpv={isMe && cameraMode === 'first_person'}
                position={position}
                rotationY={rotationY}
                bubbleText={bubble?.content}
                duplicateNicknameCount={dupCount}
              />
            );
          })}

          {/* Nhân vật mặc định Trụ trì Thanh Ngọc ngồi bàn góc trái (chỉ hiện khi phòng chưa có tài khoản Thanh Ngọc nào) */}
          {!members.some((m) =>
            m.nickname
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .includes('thanh ngoc')
          ) && (
            <LowPolyCharacter
              gender="female"
              nickname="Trụ trì Thanh Ngọc"
              memberTag="TRỤ TRÌ"
              isCurrentUser={false}
              isManager={false}
              isOnline={true}
              isSeated={true}
              isBowing={false}
              hideMeshInFpv={false}
              position={[-3.76, 0.12, -10.35]}
              rotationY={Math.PI / 2}
              duplicateNicknameCount={1}
            />
          )}

          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.3}
            scale={20}
            blur={2.2}
            far={4}
          />

          {/* BỘ ĐIỀU KHIỂN CAMERA (Toàn cảnh 3D / Góc nhìn thứ nhất của nhân vật) */}
          <SceneCameraController
            cameraMode={cameraMode}
            inZenRoom={inZenRoom}
            inGameRoom={inGameRoom}
            isBowing={isBowing}
            myPosition={myPlacement.position}
            myRotationY={myPlacement.rotationY}
            isMyCharacterSeated={myPlacement.isSeated}
            virtualKeysRef={virtualKeysRef}
          />
        </group>
      </Canvas>
    </div>
  );
};
