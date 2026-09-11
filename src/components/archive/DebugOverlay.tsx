"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import type { ArchivePath } from "./path";
import { HIT_RADIUS, THREAD_HALF } from "./state";
import type { ThreadSpec } from "./Threads";

// The Archive's own debug view (hotkey D): the camera spline, room bounds,
// thread hitboxes and room ids. Diegetic instrumentation, developer only.

export function DebugOverlay({ path, threads }: { path: ArchivePath; threads: ThreadSpec[] }) {
  const spline = useMemo(() => path.curve.getSpacedPoints(400), [path]);
  const roomQuats = useMemo(
    () => path.rooms.map((r) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(r.right, r.up, r.forward))),
    [path]
  );
  return (
    <group>
      <Line points={spline} color="#7fd0ff" lineWidth={1} transparent opacity={0.7} />
      {path.rooms.map((r, i) => (
        <group key={r.index} position={r.center} quaternion={roomQuats[i]}>
          <mesh>
            <boxGeometry args={[20, 14, 24]} />
            <meshBasicMaterial color="#ffb14e" wireframe transparent opacity={0.35} />
          </mesh>
          <Html center position={[0, 7.6, 0]} style={{ pointerEvents: "none" }} zIndexRange={[30, 0]}>
            <div className="dbg-label">room {r.index} · u {r.u.toFixed(3)}</div>
          </Html>
        </group>
      ))}
      {threads.map((t) => (
        <mesh key={t.id} position={t.center}>
          <cylinderGeometry args={[HIT_RADIUS, HIT_RADIUS, THREAD_HALF * 2, 10, 1, true]} />
          <meshBasicMaterial color="#5cff9a" wireframe transparent opacity={0.45} />
        </mesh>
      ))}
    </group>
  );
}
