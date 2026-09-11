"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { ArchivePath } from "./path";
import { archive, tick, roomIndexAt, beginReturn } from "./state";
import { arch, look } from "@/lib/refs";
import { useStore } from "@/store/useStore";
import { setProximity } from "@/lib/audio";

// The camera drifts room-to-room along the fixed spline. It is weightless:
// gentle acceleration, smooth deceleration, a little inertia. The visitor's
// wheel, touch-drag and arrow keys NUDGE the drift; the cursor leans the view;
// nothing ever leaves the path. No FPS controls, ever.

const SECONDS_PER_ROOM = 22;
const DWELL_TO_RETURN = 5.0;

export function CameraRig({ path }: { path: ArchivePath }) {
  const reducedMotion = useStore((s) => s.reducedMotion);
  const setRoomIndex = useStore((s) => s.setRoomIndex);
  const pointer = useRef({ x: 0, y: 0 });
  const impulse = useRef(0);
  const dwell = useRef(0);
  const lastRoom = useRef(-1);
  const proximityClock = useRef(0);
  const gaze = useRef(new THREE.Vector3());
  const placed = useRef(false);
  const tap = useRef<{ pending: boolean; x: number; y: number; moved: number }>({ pending: false, x: 0, y: 0, moved: 0 });
  const touchY = useRef<number | null>(null);
  const cruise = 1 / (Math.max(1, path.rooms.length) * SECONDS_PER_ROOM);

  useEffect(() => {
    const setPointer = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
      archive.pointer.set(pointer.current.x, pointer.current.y);
      archive.pointerActive = true;
    };
    const onMove = (e: PointerEvent) => {
      setPointer(e);
      if (e.pointerType === "touch" && archive.dragging && touchY.current !== null) {
        const dy = e.clientY - touchY.current;
        touchY.current = e.clientY;
        tap.current.moved += Math.abs(dy);
        impulse.current = THREE.MathUtils.clamp(impulse.current - dy * 0.00035, -0.05, 0.05);
      }
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.(".hud, .corner-sound, .rv, a, button, input")) return;
      setPointer(e);
      archive.dragging = true;
      touchY.current = e.pointerType === "touch" ? e.clientY : null;
      tap.current = { pending: e.pointerType === "touch", x: e.clientX, y: e.clientY, moved: 0 };
    };
    const onUp = () => {
      archive.dragging = false;
      touchY.current = null;
      // a touch that did not drag is a tap: it takes (or lets go of) a thread
      if (tap.current.pending) {
        tap.current.pending = false;
        if (tap.current.moved < 10) archive.sticky = archive.hover ?? null;
      }
    };
    const onLeave = () => { archive.pointerActive = false; };
    const onWheel = (e: WheelEvent) => {
      impulse.current = THREE.MathUtils.clamp(impulse.current + e.deltaY * 0.00009, -0.05, 0.05);
    };
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") impulse.current = Math.min(0.05, impulse.current + 0.012);
      if (e.key === "ArrowUp" || e.key === "PageUp") impulse.current = Math.max(-0.05, impulse.current - 0.012);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      archive.dragging = false;
      archive.pointerActive = false;
    };
  }, []);

  const P = useRef(new THREE.Vector3());
  const T = useRef(new THREE.Vector3());
  const R = useRef(new THREE.Vector3());
  const U = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const UP = new THREE.Vector3(0, 1, 0);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.1);
    const { curve } = path;
    const returning = useStore.getState().returning;

    // ── interaction ──
    tick(d, state.camera);
    if (archive.sticky && !archive.threads.has(archive.sticky)) archive.sticky = null;

    // ── the drift ──
    if (!arch.freeze) {
      const hold = 1 - archive.hold;
      const targetV = returning ? 0 : cruise * hold * (reducedMotion ? 0.7 : 1) + impulse.current;
      arch.velocity = THREE.MathUtils.lerp(arch.velocity, targetV, Math.min(1, d * 1.6));
      impulse.current *= Math.exp(-d * 2.2);
      arch.u = THREE.MathUtils.clamp(arch.u + arch.velocity * d, 0, 1);
      if ((arch.u <= 0 && arch.velocity < 0) || (arch.u >= 1 && arch.velocity > 0)) arch.velocity *= 0.2;
    }

    // ── placement on the spline ──
    const u = arch.u;
    curve.getPointAt(u, P.current);
    curve.getTangentAt(u, T.current).normalize();
    R.current.crossVectors(T.current, UP).normalize();
    U.current.crossVectors(R.current, T.current).normalize();

    const amp = reducedMotion ? 0.15 : 1;
    const k = Math.min(1, d * 1.6);
    if (!arch.freeze) {
      look.x = THREE.MathUtils.lerp(look.x, pointer.current.x * amp, k);
      look.y = THREE.MathUtils.lerp(look.y, pointer.current.y * amp, k);
    }
    const t = arch.freeze ? 12.0 : state.clock.elapsedTime;
    desired.current.copy(P.current)
      .addScaledVector(R.current, look.x * 1.3 + Math.sin(t * 0.17) * 0.18 * amp)
      .addScaledVector(U.current, look.y * 0.6 + Math.sin(t * 0.21) * 0.12 * amp + 0.2);

    curve.getPointAt(Math.min(1, u + 0.02), target.current)
      .addScaledVector(R.current, look.x * 2.6)
      .addScaledVector(U.current, look.y * 1.3 + 0.2);

    // an open memory draws the gaze
    const idx = roomIndexAt(u);
    const rs = archive.roomState[idx];
    if (rs && rs.reveal > 0.02 && rs.plane) {
      const pp = new THREE.Vector3().setFromMatrixPosition(rs.plane.matrixWorld);
      target.current.lerp(pp, THREE.MathUtils.smoothstep(rs.reveal, 0, 0.6) * 0.6);
    }

    const cam = state.camera;
    if (!placed.current || arch.freeze) {
      cam.position.copy(desired.current);
      gaze.current.copy(target.current);
      placed.current = true;
    } else {
      cam.position.lerp(desired.current, Math.min(1, d * 2.6));
      gaze.current.lerp(target.current, Math.min(1, d * 2.2));
    }
    cam.up.set(0, 1, 0);
    cam.lookAt(gaze.current);

    // ── bookkeeping ──
    if (idx !== lastRoom.current) { lastRoom.current = idx; setRoomIndex(idx); }
    proximityClock.current += d;
    if (proximityClock.current > 0.25) {
      proximityClock.current = 0;
      const room = path.rooms[idx];
      const dist = room ? room.center.distanceTo(cam.position) : 99;
      setProximity(THREE.MathUtils.clamp(1 - (dist - 4) / 16, 0, 1));
    }

    // the end of the path: linger, and the archive lets go
    if (!returning && u > 0.985 && Math.abs(arch.velocity) < cruise * 0.5 && !arch.freeze) {
      dwell.current += d;
      if (dwell.current > DWELL_TO_RETURN) beginReturn();
    } else dwell.current = 0;
  });

  return null;
}
