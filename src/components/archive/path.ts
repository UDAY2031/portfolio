import * as THREE from "three";

// The Archive is one continuous structure: rooms strung along a single,
// gently winding spline. The camera never leaves it. Everything here is
// deterministic — the same path greets every visitor.

export const ROOM_SPACING = 30;
export const LEAD = 34; // run-in before the first room and run-out after the last

export interface RoomPlacement {
  index: number;
  center: THREE.Vector3;
  /** arc-length parameter of the room centre on the curve */
  u: number;
  forward: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
}

export interface ArchivePath {
  curve: THREE.CatmullRomCurve3;
  rooms: RoomPlacement[];
  length: number;
}

export function roomCenter(i: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(i * 1.9 + 0.4) * 6.0,
    Math.cos(i * 1.3) * 2.2,
    -i * ROOM_SPACING
  );
}

export function buildPath(count: number): ArchivePath {
  const n = Math.max(1, count);
  const centers = Array.from({ length: n }, (_, i) => roomCenter(i));
  const first = centers[0];
  const last = centers[n - 1];
  const pts = [
    new THREE.Vector3(first.x - 1.5, first.y + 0.6, first.z + LEAD),
    ...centers,
    new THREE.Vector3(last.x + 0.8, last.y - 0.4, last.z - LEAD),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
  curve.arcLengthDivisions = 800;
  const length = curve.getLength();

  // find each room's arc-length parameter: coarse scan, then refine
  const SAMPLES = 2400;
  const sampled = curve.getSpacedPoints(SAMPLES);
  const rooms: RoomPlacement[] = centers.map((c, index) => {
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s <= SAMPLES; s++) {
      const d = sampled[s].distanceToSquared(c);
      if (d < bestD) { bestD = d; best = s; }
    }
    let u = best / SAMPLES;
    const step = 1 / SAMPLES;
    for (let k = 0; k < 6; k++) {
      const h = step / Math.pow(2, k + 1);
      const a = curve.getPointAt(Math.max(0, u - h)).distanceToSquared(c);
      const b = curve.getPointAt(Math.min(1, u + h)).distanceToSquared(c);
      if (a < bestD) { bestD = a; u = Math.max(0, u - h); }
      else if (b < bestD) { bestD = b; u = Math.min(1, u + h); }
    }
    const forward = curve.getTangentAt(u).normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    return { index, center: c.clone(), u, forward, right, up };
  });

  return { curve, rooms, length };
}

/** Parallel rail: the curve offset sideways/upward in its own moving frame. */
export function offsetCurve(curve: THREE.CatmullRomCurve3, side: number, lift: number, samples = 160): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const upWorld = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const r = new THREE.Vector3().crossVectors(t, upWorld).normalize();
    const up = new THREE.Vector3().crossVectors(r, t).normalize();
    pts.push(p.add(r.multiplyScalar(side)).add(up.multiplyScalar(lift)));
  }
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

/** Deterministic per-room hash in [0,1). */
export function roomHash(i: number, salt: number): number {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// Light colour temperature: 0 = cool, muted white (the beginning) → 1 = deep
// amber (the present). Always inside the palette — no blues, no neon.
const COOL = new THREE.Color("#d9d2c4");
const WARM = new THREE.Color("#ffb14e");
export function temperatureColor(t: number, out = new THREE.Color()): THREE.Color {
  return out.copy(COOL).lerp(WARM, THREE.MathUtils.clamp(t, 0, 1));
}
