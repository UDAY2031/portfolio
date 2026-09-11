"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { RoomPlacement } from "./path";
import { temperatureColor } from "./path";
import { archive } from "./state";
import { arch } from "@/lib/refs";
import type { Quality } from "@/store/useStore";

// ONE dominant light per room: a suspended emissive plane and the point
// light it casts. Everything else falls into shadow — that alone makes the
// space read as infinite rather than busy.

const INTENSITY: Record<Quality, number> = { high: 120, medium: 105, low: 90 };

export function RoomLight({ room, temperature, quality }: { room: RoomPlacement; temperature: number; quality: Quality }) {
  const light = useRef<THREE.PointLight>(null);
  const slab = useRef<THREE.Mesh>(null);
  const color = useMemo(() => temperatureColor(temperature), [temperature]);
  const slabColor = useMemo(() => temperatureColor(temperature).multiplyScalar(2.2), [temperature]);
  const position = useMemo(() => room.center.clone().add(room.up.clone().multiplyScalar(6.4)), [room]);
  const quaternion = useMemo(() => {
    const m = new THREE.Matrix4().makeBasis(room.right, room.up, room.forward);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }, [room]);

  useFrame((_, delta) => {
    const rs = archive.roomState[room.index];
    const reveal = rs ? rs.reveal : 0;
    const alive = 1 - arch.recede;
    if (light.current) {
      const target = (INTENSITY[quality] * (1 + reveal * 0.35)) * alive;
      light.current.intensity = THREE.MathUtils.lerp(light.current.intensity, target, Math.min(1, delta * 3));
    }
    if (slab.current) {
      const m = slab.current.material as THREE.MeshBasicMaterial;
      m.color.copy(slabColor).multiplyScalar(alive * (0.9 + reveal * 0.2));
    }
  });

  return (
    <group position={position} quaternion={quaternion}>
      {/* the suspended emissive plane */}
      <mesh ref={slab} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[5.2, 1.3, 0.12]} />
        <meshBasicMaterial color={slabColor} toneMapped={false} />
      </mesh>
      {/* its hanging — two hairline rods to the structure above */}
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} position={[x, 1.2, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 2.4, 6]} />
          <meshStandardMaterial color="#2a1c10" roughness={0.8} metalness={0.4} />
        </mesh>
      ))}
      <pointLight ref={light} color={color} intensity={INTENSITY[quality]} distance={54} decay={2} position={[0, -0.4, 0]} />
    </group>
  );
}
