import React, { useEffect, useMemo, useRef, useState } from 'react';
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

export interface ActiveSpeechBubble {
  userId: string;
  content: string;
  expiresAt: number;
}

interface OfficeScene3DProps {
  currentUserId: string;
  members: RoomMember[];
  seats: WorkSeat[];
  activeBubbles: Record<string, ActiveSpeechBubble>;
  onSelectSeat: (seatId: string) => void;
  onSelectMeetingChair: (chairId: string | null) => void;
  claimingSeatId: string | null;
  // Góc nhìn & Phòng Tịnh Tâm
  cameraMode: 'overview' | 'first_person';
  inZenRoom: boolean;
  onEnterZenRoom: () => void;
  selectedDeity: DeityType;
  incenseLit: boolean;
  isBowing: boolean;
  moPulseKey: number;
  floatingMeritText: string | null;
  onStrikeMo: () => void;
  onRingBell: () => void;
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
  isBowing: boolean;
  myPosition: [number, number, number];
  myRotationY: number;
  isMyCharacterSeated: boolean;
}> = ({
  cameraMode,
  inZenRoom,
  isBowing,
  myPosition,
  myRotationY,
  isMyCharacterSeated,
}) => {
  const { camera, gl } = useThree();
  const yawRef = useRef(0);
  const pitchRef = useRef(-0.06);
  const walkOffsetRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const keysPressedRef = useRef<Set<string>>(new Set());
  const draggingRef = useRef(false);
  const prevPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const bowStartRef = useRef<number>(0);

  // Khi chuyển vị trí ghế / vào phòng tịnh tâm / đổi chế độ camera, đặt hướng nhìn mắt nhân vật theo hướng nhân vật đang quay
  useEffect(() => {
    yawRef.current = myRotationY;
    pitchRef.current = inZenRoom ? 0.08 : -0.05;
    walkOffsetRef.current = { x: 0, z: 0 };
  }, [myPosition[0], myPosition[2], myRotationY, inZenRoom, cameraMode]);

  useEffect(() => {
    if (isBowing) {
      bowStartRef.current = performance.now();
    }
  }, [isBowing]);

  // Khi ở chế độ overview, chuyển góc nhìn mượt giữa Văn phòng chính và Phòng Tịnh Tâm
  useEffect(() => {
    if (cameraMode === 'overview') {
      if (inZenRoom) {
        camera.position.set(0, 3.6, -6.2);
        camera.lookAt(0, 1.1, -11.4);
      } else {
        camera.position.set(0, 14.2, 11.2);
        camera.lookAt(0, 0, 0);
      }
    }
  }, [cameraMode, inZenRoom, camera]);

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
    const forwardX = Math.sin(yawRef.current);
    const forwardZ = Math.cos(yawRef.current);
    const rightX = Math.cos(yawRef.current);
    const rightZ = -Math.sin(yawRef.current);

    if (keys.has('w')) {
      walkOffsetRef.current.x += forwardX * speed;
      walkOffsetRef.current.z += forwardZ * speed;
    }
    if (keys.has('s')) {
      walkOffsetRef.current.x -= forwardX * speed;
      walkOffsetRef.current.z -= forwardZ * speed;
    }
    if (keys.has('a')) {
      walkOffsetRef.current.x += rightX * speed;
      walkOffsetRef.current.z += rightZ * speed;
    }
    if (keys.has('d')) {
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
      target={inZenRoom ? [0, 0.9, -11.2] : [0, 0, 0]}
      minPolarAngle={Math.PI / 8}
      maxPolarAngle={Math.PI / 2.15}
      minAzimuthAngle={-Math.PI / 2.2}
      maxAzimuthAngle={Math.PI / 2.2}
      minDistance={inZenRoom ? 3.5 : 7}
      maxDistance={21}
      enablePan={true}
    />
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
  duplicateNicknameCount,
}) => {
  const upperBodyRef = useRef<THREE.Group>(null);
  const bowStartRef = useRef<number>(0);

  useEffect(() => {
    if (isBowing) {
      bowStartRef.current = performance.now();
    } else if (upperBodyRef.current) {
      upperBodyRef.current.rotation.x = 0;
    }
  }, [isBowing]);

  useFrame(() => {
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
    gender === 'male'
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
  const displayName =
    duplicateNicknameCount > 1
      ? `${normalizedNickname} (${memberTag})`
      : normalizedNickname;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {!hideMeshInFpv && (
        <>
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
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-md backdrop-blur-md transition-all ${
                isCurrentUser
                  ? 'bg-emerald-600/95 text-white ring-2 ring-emerald-300'
                  : isOnline
                    ? 'bg-slate-900/85 text-slate-100 ring-1 ring-white/25'
                    : 'bg-slate-800/65 text-slate-300 ring-1 ring-white/10'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isOnline ? 'bg-emerald-400' : 'bg-slate-400'
                }`}
              />
              {isManager && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.2 text-[9px] font-extrabold text-slate-950 shadow-sm">
                  👑 Trưởng phòng
                </span>
              )}
              <span>{displayName}</span>
              {isCurrentUser && <span className="text-[10px] opacity-90">(Bạn)</span>}
              {!isOnline && <span className="text-[10px] opacity-75">(Offline)</span>}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

/**
 * Gian Phòng Tịnh Tâm 3D (Có tượng Đức Phật, Ông Địa, Thần Tài, Mõ Gỗ, Chuông Đồng, Lư Hương & Bồ Đoàn)
 */
const ZenSanctuaryRoom3D: React.FC<{
  selectedDeity: DeityType;
  incenseLit: boolean;
  moPulseKey: number;
  floatingMeritText: string | null;
  onStrikeMo: () => void;
  onRingBell: () => void;
}> = ({
  selectedDeity,
  incenseLit,
  moPulseKey,
  floatingMeritText,
  onStrikeMo,
  onRingBell,
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
        <boxGeometry args={[7.4, 0.14, 6.2]} />
        <meshStandardMaterial color="#451a03" roughness={0.75} />
      </mesh>
      {/* Thảm sen giữa phòng */}
      <mesh position={[0, 0.03, 0.4]} receiveShadow>
        <boxGeometry args={[3.6, 0.02, 3.4]} />
        <meshStandardMaterial color="#7c2d12" roughness={0.85} />
      </mesh>

      {/* Vách hậu cung & Vách hai bên */}
      <mesh position={[0, 1.6, -2.95]} receiveShadow castShadow>
        <boxGeometry args={[7.4, 3.2, 0.18]} />
        <meshStandardMaterial color="#78350f" roughness={0.7} />
      </mesh>
      <mesh position={[-3.65, 1.6, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.18, 3.2, 6.2]} />
        <meshStandardMaterial color="#78350f" roughness={0.7} />
      </mesh>
      <mesh position={[3.65, 1.6, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.18, 3.2, 6.2]} />
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
 * Bàn và ghế làm việc cố định (8 vị trí đăng ký)
 */
const WorkDeskUnit: React.FC<{
  layout: SeatTransform;
  seatData?: WorkSeat;
  currentUserId: string;
  onSelectSeat: (seatId: string) => void;
  isClaiming: boolean;
}> = ({ layout, seatData, currentUserId, onSelectSeat, isClaiming }) => {
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
        <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
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

        {isAvailable && (
          <Html position={[0, 1.08, 0]} center zIndexRange={[10, 0]}>
            <button
              type="button"
              disabled={isClaiming}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSeat(layout.seatId);
              }}
              data-testid={`seat-3d-btn-${layout.seatId}`}
              className="group flex items-center justify-center whitespace-nowrap rounded-full bg-sky-500/90 hover:bg-sky-400 active:scale-95 px-2.5 py-0.5 text-[11px] font-semibold text-slate-950 shadow-lg ring-2 ring-white/70 transition-all cursor-pointer"
            >
              <span>Trống</span>
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

      {isAvailable && (
        <Html position={[0, 1.02, 0]} center zIndexRange={[10, 0]}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectMeetingChair(chair.id);
            }}
            data-testid={`meeting-chair-3d-${chair.id}`}
            title={`${chair.label} — Bấm để vào ngồi họp tự do`}
            className="flex items-center justify-center whitespace-nowrap rounded-full bg-amber-500/90 hover:bg-amber-400 active:scale-95 px-2.5 py-0.5 text-[10px] font-bold text-slate-950 shadow-md ring-1 ring-white/70 transition-all cursor-pointer"
          >
            <span>Trống</span>
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

export const OfficeScene3D: React.FC<OfficeScene3DProps> = ({
  currentUserId,
  members,
  seats,
  activeBubbles,
  onSelectSeat,
  onSelectMeetingChair,
  claimingSeatId,
  cameraMode,
  inZenRoom,
  onEnterZenRoom,
  selectedDeity,
  incenseLit,
  isBowing,
  moPulseKey,
  floatingMeritText,
  onStrikeMo,
  onRingBell,
}) => {
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
      .filter((m) => !m.seatId && !m.meetingChairId)
      .sort((a, b) => a.userId.localeCompare(b.userId));

    return members.map((member) => {
      // Nếu là người dùng hiện tại đang ở trong Phòng Tịnh Tâm -> đặt ngồi trên đệm Bồ đoàn đối diện bàn thờ
      if (member.userId === currentUserId && inZenRoom) {
        return {
          member,
          isSeated: true,
          position: [0, 0.08, -8.95] as [number, number, number],
          rotationY: Math.PI, // Nhìn thẳng về phía bàn thờ Phật / Ông Địa / Thần Tài (-Z)
        };
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
  }, [members, currentUserId, inZenRoom]);

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

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900">
      {/* Tâm ngắm & hướng dẫn nhanh khi đang ở Góc nhìn thứ nhất (First-Person View) */}
      {cameraMode === 'first_person' && (
        <>
          <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
            <div className="h-2.5 w-2.5 rounded-full border-2 border-emerald-400/80 bg-white/40 shadow" />
          </div>
          <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-20 rounded-full border border-white/15 bg-slate-950/75 px-3.5 py-1 text-[11px] text-slate-200 backdrop-blur-md shadow">
            👁️ <strong>Góc nhìn thứ nhất:</strong> Kéo chuột / phím mũi tên để nhìn 360° • Phím <strong>W A S D</strong> để bước đi
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
            moPulseKey={moPulseKey}
            floatingMeritText={floatingMeritText}
            onStrikeMo={onStrikeMo}
            onRingBell={onRingBell}
          />

          {/* SÀN PHÒNG VĂN PHÒNG CHÍNH (16.0m x 10.8m) */}
          <mesh position={[0, -0.08, 0]} receiveShadow>
            <boxGeometry args={[16.0, 0.16, 10.8]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.88} />
          </mesh>

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

          {/* CỔNG VÀO PHÒNG TỊNH TÂM TRÊN TƯỜNG Bắc (Giữa tủ ngăn và khu vực cửa) */}
          {!inZenRoom && (
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
              <Html position={[0, 2.05, 0]} center zIndexRange={[10, 0]}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnterZenRoom();
                  }}
                  className="whitespace-nowrap rounded-full bg-amber-500/95 hover:bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-slate-950 shadow-lg ring-2 ring-amber-200 cursor-pointer"
                >
                  🪷 Vào Phòng Tịnh Tâm (Phật • Ông Địa • Thần Tài)
                </button>
              </Html>
            </group>
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
                hideMeshInFpv={isMe && cameraMode === 'first_person'}
                position={position}
                rotationY={rotationY}
                bubbleText={bubble?.content}
                duplicateNicknameCount={dupCount}
              />
            );
          })}

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
            isBowing={isBowing}
            myPosition={myPlacement.position}
            myRotationY={myPlacement.rotationY}
            isMyCharacterSeated={myPlacement.isSeated}
          />
        </group>
      </Canvas>
    </div>
  );
};
