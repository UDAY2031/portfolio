"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Detailed } from "@react-three/drei";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { RoomPlacement } from "./path";
import { roomHash, offsetCurve, temperatureColor } from "./path";

// The structural language of the Archive (spec §4.2): 3–5 LARGE frames per
// room — cathedral ribs, ship-hull frames — not a hypercube net. Depth comes
// from fog and light falloff, not from more geometry. Near frames read as
// brushed bronze; distant ones are silhouettes lit only at their edges.

const BRONZE = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#8a6238"),
  metalness: 0.58,
  roughness: 0.5,
  emissive: new THREE.Color("#140b04"),
  emissiveIntensity: 0.7,
});
const WOOD = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#4a3320"),
  metalness: 0.06,
  roughness: 0.8,
  emissive: new THREE.Color("#0f0904"),
  emissiveIntensity: 0.7,
});

// One frame: four beams and four joints, merged into a single draw.
function frameGeometry(w: number, h: number, t: number, d: number, joints: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const beam = (sx: number, sy: number, x: number, y: number) => {
    const g = new THREE.BoxGeometry(sx, sy, d);
    g.translate(x, y, 0);
    parts.push(g);
  };
  beam(w, t, 0, h / 2 - t / 2);
  beam(w, t, 0, -h / 2 + t / 2);
  beam(t, h - 2 * t, -w / 2 + t / 2, 0);
  beam(t, h - 2 * t, w / 2 - t / 2, 0);
  if (joints) {
    const j = t * 1.7;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const g = new THREE.BoxGeometry(j, j, d * 1.25);
      g.translate(sx * (w / 2 - t / 2), sy * (h / 2 - t / 2), 0);
      parts.push(g);
    }
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

// The inner edge bead: a hairline of light along the frame's inside edge.
// This is what survives the fog on distant frames — "lit only at their edges".
function edgeGeometry(w: number, h: number, t: number): THREE.BufferGeometry {
  const iw = w - 2 * t, ih = h - 2 * t, b = 0.035;
  const parts: THREE.BufferGeometry[] = [];
  const strip = (sx: number, sy: number, x: number, y: number) => {
    const g = new THREE.BoxGeometry(sx, sy, b);
    g.translate(x, y, 0);
    parts.push(g);
  };
  strip(iw, b, 0, ih / 2);
  strip(iw, b, 0, -ih / 2);
  strip(b, ih, -iw / 2, 0);
  strip(b, ih, iw / 2, 0);
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

interface FrameSpec { offset: number; w: number; h: number; roll: number; lift: number; wood: boolean }

function specsFor(room: RoomPlacement): FrameSpec[] {
  const i = room.index;
  const count = 3 + Math.floor(roomHash(i, 1) * 3); // 3..5
  const specs: FrameSpec[] = [];
  for (let k = 0; k < count; k++) {
    const t = count === 1 ? 0.5 : k / (count - 1);
    const offset = THREE.MathUtils.lerp(-11, 11, t) + (roomHash(i, 10 + k) - 0.5) * 3.5;
    const big = roomHash(i, 20 + k) > 0.55;
    specs.push({
      offset,
      w: big ? 18.5 + roomHash(i, 30 + k) * 2.5 : 15 + roomHash(i, 30 + k) * 2.5,
      h: big ? 13 + roomHash(i, 40 + k) * 1.5 : 11 + roomHash(i, 40 + k) * 1.5,
      roll: (roomHash(i, 50 + k) - 0.5) * 0.12,
      lift: (roomHash(i, 60 + k) - 0.5) * 1.2,
      wood: roomHash(i, 70 + k) > 0.72,
    });
  }
  return specs;
}

const EDGE_MATS = new Map<number, THREE.MeshBasicMaterial>();
function edgeMaterial(temperature: number) {
  const key = Math.round(temperature * 20);
  let m = EDGE_MATS.get(key);
  if (!m) {
    const c = temperatureColor(temperature).multiplyScalar(0.24);
    m = new THREE.MeshBasicMaterial({ color: c, toneMapped: true });
    EDGE_MATS.set(key, m);
  }
  return m;
}

function Frame({ spec, room, temperature }: { spec: FrameSpec; room: RoomPlacement; temperature: number }) {
  const T = 0.62, D = 1.05;
  const { detailed, simple, edge } = useMemo(
    () => ({
      detailed: frameGeometry(spec.w, spec.h, T, D, true),
      simple: frameGeometry(spec.w, spec.h, T, D, false),
      edge: edgeGeometry(spec.w, spec.h, T),
    }),
    [spec.w, spec.h]
  );

  // place the frame perpendicular to the path, offset along it
  const { position, quaternion } = useMemo(() => {
    const position = room.center.clone()
      .add(room.forward.clone().multiplyScalar(spec.offset))
      .add(room.up.clone().multiplyScalar(spec.lift));
    const m = new THREE.Matrix4().makeBasis(room.right, room.up, room.forward);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(m);
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), spec.roll));
    return { position, quaternion };
  }, [room, spec.offset, spec.lift, spec.roll]);

  const mat = spec.wood ? WOOD : BRONZE;

  return (
    <group position={position} quaternion={quaternion}>
      <Detailed distances={[0, 78]}>
        {/* near: full frame with joints and a lit inner edge */}
        <group>
          <mesh geometry={detailed} material={mat} />
          <mesh geometry={edge} material={edgeMaterial(temperature)} position={[0, 0, D / 2 + 0.03]} />
        </group>
        {/* far: silhouette — only the edge light survives the fog */}
        <group>
          <mesh geometry={simple} material={mat} />
          <mesh geometry={edge} material={edgeMaterial(temperature)} position={[0, 0, D / 2 + 0.03]} />
        </group>
      </Detailed>
    </group>
  );
}

export function RoomFrames({ room, temperature }: { room: RoomPlacement; temperature: number }) {
  const specs = useMemo(() => specsFor(room), [room]);
  return (
    <group>
      {specs.map((s, k) => <Frame key={k} spec={s} room={room} temperature={temperature} />)}
    </group>
  );
}

// Two long stringers run the whole structure — the hull keel lines that make
// ten rooms read as one vessel rather than ten levels.
export function Rails({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geometries = useMemo(() => {
    return [[-7.9, 5.6], [7.9, 5.6], [-7.9, -5.9], [7.9, -5.9]].map(([side, lift]) => {
      const c = offsetCurve(curve, side, lift, 200);
      return new THREE.TubeGeometry(c, 420, 0.16, 6, false);
    });
  }, [curve]);
  return (
    <group>
      {geometries.map((g, i) => <mesh key={i} geometry={g} material={BRONZE} frustumCulled={false} />)}
    </group>
  );
}
