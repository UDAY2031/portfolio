"use client";

import * as THREE from "three";
import gsap from "gsap";
import { arch } from "@/lib/refs";
import { useStore } from "@/store/useStore";
import type { Milestone } from "@/lib/milestones";
import type { RoomPlacement } from "./path";
import { revealChime, setThreadTension, pluckHum } from "@/lib/audio";

// The Archive's interaction state, outside React: the camera rig, the thread
// field, the dust and the reveal planes all read from here every frame, and
// one tick() per frame advances it. Nothing here re-renders anything.

export interface ThreadRef {
  id: string;
  room: number;
  index: number;
  /** world-space foot and head of the thread */
  a: THREE.Vector3;
  b: THREE.Vector3;
  /** world-space centre */
  center: THREE.Vector3;
  /** engagement 0..1 — hovering / bending pulls it toward 1 */
  engage: number;
  /** how far the thread has let go during the Return, 0..1 */
  released: number;
}

export interface RoomState {
  index: number;
  /** content assembling along the anchor thread, 0..1 */
  reveal: number;
  /** id of the thread that carries the reveal */
  anchor: string | null;
  /** seconds for a full assembly (from the number of content stages) */
  duration: number;
  /** the reveal plane's world transform, for pointer hit-testing */
  plane: THREE.Object3D | null;
  chimed: boolean;
}

export const THREAD_HALF = 6.0;   // threads span ±6 units vertically
export const HIT_RADIUS = 0.75;
export const PLANE_W = 6.4;
export const PLANE_H = 4.4;

export const archive = {
  rooms: [] as RoomPlacement[],
  milestones: [] as Milestone[],
  threads: new Map<string, ThreadRef>(),
  roomState: [] as RoomState[],
  /** thread id under the pointer this frame (thread body or its plane) */
  hover: null as string | null,
  /** touch: a tapped thread stays engaged until the visitor taps elsewhere */
  sticky: null as string | null,
  /** the pointer is held down — "bending" the thread */
  dragging: false,
  /** any thread being pulled → the drift holds */
  hold: 0,
  /** loudest engagement this frame (drives the tension tone) */
  tension: 0,
  /** normalised pointer, -1..1 */
  pointer: new THREE.Vector2(0, 0),
  pointerActive: false,
};

export const threadId = (room: number, index: number) => `${room}:${index}`;

// How many staggered elements the room's memory resolves through — nothing
// appears faster than ~600ms per element. Order (spec §4.4): title →
// description → achievements → metrics → media → tech chips → links.
export function stagesFor(m: Milestone): number {
  let n = 2; // title, description
  if (m.achievements.length) n++;
  if (m.metrics.length) n++;
  if (m.images.length || m.video) n++;
  if (m.techStack.length) n++;
  if (m.links.length) n++;
  return n;
}
export const STAGE_LEAD = 0.8;   // the plane draws itself first
export const STAGE_GAP = 0.65;   // seconds between elements
export const STAGE_FADE = 0.55;  // each element's own fade
export function revealDuration(m: Milestone) {
  return STAGE_LEAD + STAGE_GAP * (stagesFor(m) - 1) + STAGE_FADE + 0.2;
}

export function configure(rooms: RoomPlacement[], milestones: Milestone[]) {
  archive.rooms = rooms;
  archive.milestones = milestones;
  archive.threads.clear();
  archive.roomState = rooms.map((r, i) => ({
    index: i,
    reveal: 0,
    anchor: null,
    duration: revealDuration(milestones[i]),
    plane: null,
    chimed: false,
  }));
  archive.hover = null;
  archive.sticky = null;
  archive.hold = 0;
}

export function registerThread(t: ThreadRef) {
  archive.threads.set(t.id, t);
}

export function registerPlane(room: number, obj: THREE.Object3D | null) {
  const rs = archive.roomState[room];
  if (rs) rs.plane = obj;
}

// ── pointer picking: rays against thread capsules and open planes ──────────
const ray = new THREE.Ray();
const rc = new THREE.Raycaster();
const segClosest = new THREE.Vector3();
const rayClosest = new THREE.Vector3();
const planeLocal = new THREE.Vector3();
const inv = new THREE.Matrix4();
const planeNormal = new THREE.Vector3();
const planePoint = new THREE.Vector3();
const hitPlane = new THREE.Plane();

function pick(camera: THREE.Camera): string | null {
  rc.setFromCamera(archive.pointer, camera);
  ray.copy(rc.ray);
  let best: string | null = null;
  let bestT = Infinity;

  for (const t of archive.threads.values()) {
    // an engaged thread is easier to keep hold of
    const radius = HIT_RADIUS * (1 + t.engage * 1.6);
    ray.distanceSqToSegment(t.a, t.b, rayClosest, segClosest);
    const d2 = rayClosest.distanceToSquared(segClosest);
    if (d2 < radius * radius) {
      const along = rayClosest.distanceTo(ray.origin);
      if (along < bestT) { bestT = along; best = t.id; }
    }
  }

  // an open memory plane keeps its thread engaged while the visitor reads
  for (const rs of archive.roomState) {
    if (!rs.plane || rs.reveal < 0.05 || !rs.anchor) continue;
    rs.plane.updateWorldMatrix(true, false);
    planeNormal.set(0, 0, 1).transformDirection(rs.plane.matrixWorld);
    planePoint.setFromMatrixPosition(rs.plane.matrixWorld);
    hitPlane.setFromNormalAndCoplanarPoint(planeNormal, planePoint);
    const hit = ray.intersectPlane(hitPlane, planeLocal);
    if (!hit) continue;
    inv.copy(rs.plane.matrixWorld).invert();
    planeLocal.applyMatrix4(inv);
    if (Math.abs(planeLocal.x) < PLANE_W / 2 + 0.4 && Math.abs(planeLocal.y) < PLANE_H / 2 + 0.4) {
      const along = hit.distanceTo(ray.origin);
      if (along < bestT) { bestT = along; best = rs.anchor; }
    }
  }
  return best;
}

let lastChimeRoom = -1;

/** Advance engagement and reveals by one frame. */
export function tick(dt: number, camera: THREE.Camera) {
  const d = Math.min(dt, 0.1);
  applyPendingReveal();
  archive.hover = archive.pointerActive ? pick(camera) : null;

  let maxEngage = 0;
  let tensionPitch = 440;
  for (const t of archive.threads.values()) {
    const active = (archive.hover === t.id || archive.sticky === t.id) && arch.release <= 0;
    const rs = archive.roomState[t.room];
    // bending (pointer held) pulls faster; a thread carrying an open memory
    // lets go slowly, so reading it never feels like a chase
    const carrying = rs?.anchor === t.id && rs.reveal > 0.2;
    const rate = active ? (archive.dragging ? 2.4 : 1 / 0.9) : -(carrying ? 1 / 2.2 : 1 / 0.9);
    const before = t.engage;
    t.engage = THREE.MathUtils.clamp(t.engage + rate * d, 0, 1);
    if (before > 0.3 && t.engage <= 0.3 && !active) {
      pluckHum(55 + t.index * 13.75, 0.35 + t.room * 0.02); // the thread releases
    }
    if (t.engage > maxEngage) { maxEngage = t.engage; tensionPitch = 392 + t.index * 33 + t.room * 6; }
  }
  archive.hold = THREE.MathUtils.lerp(archive.hold, maxEngage > 0.12 ? 1 : 0, Math.min(1, d * 3));
  archive.tension = maxEngage;
  setThreadTension(maxEngage, tensionPitch);

  for (const rs of archive.roomState) {
    // the anchor: the room's most-engaged thread
    let anchor: ThreadRef | null = null;
    for (const t of archive.threads.values()) {
      if (t.room !== rs.index) continue;
      if (!anchor || t.engage > anchor.engage) anchor = t;
    }
    if (anchor && anchor.engage > 0.02 && (rs.reveal < 0.05 || !rs.anchor)) rs.anchor = anchor.id;
    const carrier = rs.anchor ? archive.threads.get(rs.anchor) : null;
    const pulling = !!carrier && carrier.engage >= (rs.reveal > 0 ? 0.5 : 0.98) && arch.release <= 0;
    const rate = pulling ? 1 / rs.duration : -1 / (rs.duration * 0.55);
    const before = rs.reveal;
    rs.reveal = THREE.MathUtils.clamp(rs.reveal + rate * d, 0, 1);
    if (rs.reveal >= 1 && before < 1 && !rs.chimed) {
      rs.chimed = true;
      if (lastChimeRoom !== rs.index) { lastChimeRoom = rs.index; revealChime(rs.index); }
      useStore.getState().setActiveRoom(archive.milestones[rs.index]?.id ?? null);
    }
    if (rs.reveal <= 0) {
      rs.chimed = false;
      if (before > 0) {
        rs.anchor = null;
        const s = useStore.getState();
        if (s.activeRoom === archive.milestones[rs.index]?.id) s.setActiveRoom(null);
      }
    }
  }
}

/** Developer HUD / deep links: glide the drift to a room. */
export function jumpToRoom(index: number, immediate = false) {
  const r = archive.rooms[index];
  if (!r) return;
  gsap.killTweensOf(arch);
  const target = Math.max(0, r.u - 0.012); // park just before the centre
  if (immediate) { arch.u = target; arch.velocity = 0; return; }
  gsap.to(arch, { u: target, duration: 2.6, ease: "power2.inOut", onStart: () => { arch.velocity = 0; } });
}

export function roomIndexAt(u: number): number {
  const rooms = archive.rooms;
  if (!rooms.length) return 0;
  let best = 0;
  let bestD = Infinity;
  for (const r of rooms) {
    const d = Math.abs(r.u - u);
    if (d < bestD) { bestD = d; best = r.index; }
  }
  return best;
}

// Phase 05 — THE RETURN. The last room's threads let go one by one, dust
// disperses outward, the architecture recedes into black exactly as it
// arrived; then the dark veil carries the visitor back to space.
export function beginReturn() {
  const s = useStore.getState();
  if (s.returning || s.phase !== "archive") return;
  s.setReturning(true);
  s.setActiveRoom(null);
  archive.sticky = null;
  gsap.killTweensOf(arch);
  const tl = gsap.timeline();
  tl.to(arch, { release: 1, duration: 3.2, ease: "power1.inOut" }, 0);
  tl.to(arch, { disperse: 1, duration: 4.2, ease: "power2.in" }, 0.8);
  tl.to(arch, { recede: 1, duration: 4.6, ease: "power2.in" }, 1.2);
  tl.to(arch, { velocity: 0.0, duration: 1.0 }, 0);
}

// ── deterministic screenshot mode ───────────────────────────────────────────
// ?phase=archive&room=<id|order>&reveal=1&freeze=1 — parked at a room, its
// memory fully assembled, every waver still. Applied once the scene has
// configured its rooms.
export const pending: { room: string | null; reveal: boolean } = { room: null, reveal: false };

let pendingRevealRoom: number | null = null;

export function applyPending() {
  if (pending.room === null) return;
  const wanted = pending.room;
  let index = archive.milestones.findIndex((m) => m.id === wanted);
  if (index < 0) index = archive.milestones.findIndex((m) => String(m.order) === wanted);
  if (index < 0 && /^\d+$/.test(wanted)) index = Math.min(archive.rooms.length - 1, Math.max(0, parseInt(wanted, 10) - 1));
  pending.room = null;
  if (index < 0) return;
  jumpToRoom(index, true);
  if (pending.reveal) {
    pending.reveal = false;
    pendingRevealRoom = index; // threads register a beat later — applied in tick()
  }
}

function applyPendingReveal() {
  if (pendingRevealRoom === null || archive.threads.size === 0) return;
  const index = pendingRevealRoom;
  pendingRevealRoom = null;
  const rs = archive.roomState[index];
  let anchor: ThreadRef | null = null;
  for (const t of archive.threads.values()) if (t.room === index && (!anchor || t.index < anchor.index)) anchor = t;
  if (rs && anchor) {
    anchor.engage = 1;
    rs.anchor = anchor.id;
    rs.reveal = 1;
    rs.chimed = true;
    archive.sticky = anchor.id;
    useStore.getState().setActiveRoom(archive.milestones[index]?.id ?? null);
  }
}
