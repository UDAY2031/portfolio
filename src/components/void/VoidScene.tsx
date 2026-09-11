"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import BlackHole from "./BlackHole";
import Tars from "./Tars";
import { fall, look, post, thr, arch, APPROACH_START, APPROACH_END } from "@/lib/refs";
import { useStore } from "@/store/useStore";
import { setSwell, releaseSwell, startAmbient } from "@/lib/audio";
import { Threshold, ReturnArrival } from "./Threshold";

// deterministic PRNG — the same dust field greets every visitor
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function SpaceDust() {
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const rnd = seeded(1337);
    const count = 500;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 30;
      pos[i * 3 + 1] = (rnd() - 0.5) * 18;
      pos[i * 3 + 2] = (rnd() - 0.5) * 24 - 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame((state) => {
    const p = points.current;
    if (!p) return;
    p.rotation.y = (arch.freeze ? 12.0 : state.clock.elapsedTime) * 0.008;
    // dust accelerates inward as gravity rises; during the light-speed
    // flight there is no near field at all
    const s = (1 - fall.warp * 0.85) * thr.hole;
    p.scale.set(Math.max(s, 0.0001), Math.max(s, 0.0001), Math.max(s, 0.0001));
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial size={0.02} color="#9fb4d8" transparent opacity={0.55} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ── Phase 01, the beginning: no interface, no instructions. The camera
// drifts toward Gargantua on its own; curiosity (any movement, any touch)
// leans the drift forward. When the approach ends, the crossing begins.
function Approach() {
  const phase = useStore((s) => s.phase);
  const setPhase = useStore((s) => s.setPhase);
  const engagement = useRef(0);

  useEffect(() => {
    if (phase !== "void") return;
    // Any gesture is curiosity; a press or key is also the browser's cue
    // that sound may begin. Silence until then — intentionally.
    const lean = (amount: number) => {
      engagement.current = Math.min(1, engagement.current + amount);
    };
    const onPress = () => { startAmbient(); lean(0.5); };
    const onKey = () => { startAmbient(); lean(0.4); };
    const onMove = () => lean(0.02);
    const onWheel = () => lean(0.25);
    window.addEventListener("pointerdown", onPress);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPress);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("wheel", onWheel);
    };
  }, [phase]);

  useFrame((_, delta) => {
    if (phase !== "void") return;
    const d = Math.min(delta, 0.1);
    // the drift: slow on its own, leaning in with the visitor's curiosity
    fall.camDist -= d * (0.2 + engagement.current * 0.6);
    engagement.current *= Math.exp(-d * 0.35);
    // light already bending, faintly, as the mass grows in the window
    const approach = THREE.MathUtils.clamp(
      (APPROACH_START - fall.camDist) / (APPROACH_START - APPROACH_END), 0, 1
    );
    fall.approach = approach;
    fall.warp = approach * 0.1;
    fall.crossing = approach * 0.12;
    if (fall.camDist <= APPROACH_END) setPhase("crossing");
  });

  return null;
}

// The REAL scene camera (the one TARS and the dust live in) is never still:
// it pushes slowly forward as the approach deepens — dust and TARS sliding
// past sell the motion — and it leans toward wherever the cursor rests, a
// weightless float rather than a control.
function CameraDrift() {
  const reducedMotion = useStore((s) => s.reducedMotion);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.1);
    const amp = reducedMotion ? 0.15 : 1;
    // heavy smoothing: the gaze drifts after the cursor, never snaps to it
    const k = Math.min(1, d * 1.6);
    look.x = THREE.MathUtils.lerp(look.x, pointer.current.x * amp, k);
    look.y = THREE.MathUtils.lerp(look.y, pointer.current.y * amp, k);

    const cam = state.camera;
    const t = arch.freeze ? 12.0 : state.clock.elapsedTime;
    // push-in: 8 → ~4.6 across the approach, a touch more as the fall begins
    const z = 8 - fall.approach * 3.0 - fall.progress * 0.9;
    cam.position.z = THREE.MathUtils.lerp(cam.position.z, Math.max(z, 3.8), Math.min(1, d * 2));
    cam.position.x = look.x * 0.7 + Math.sin(t * 0.05) * 0.12 * amp;
    cam.position.y = 0.6 + look.y * 0.35 + Math.sin(t * 0.083) * 0.06 * amp;
    cam.lookAt(0, 0.15, 0);
  });

  return null;
}

export default function VoidScene() {
  const phase = useStore((s) => s.phase);
  const setPhase = useStore((s) => s.setPhase);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  // Phase 02, the crossing — one continuous choreographed shot, all of it
  // riding the single crossing parameter 0 → 1. When it completes the
  // Threshold (Phase 03) takes over the same shader.
  useEffect(() => {
    if (phase !== "crossing") return;
    const tl = gsap.timeline({
      onUpdate: () => setSwell(Math.min(fall.crossing * 1.25, 1)),
      onComplete: () => {
        releaseSwell();
        setPhase("threshold");
      },
    });
    timeline.current = tl;

    if (reducedMotion) {
      tl.to(fall, { progress: 1, crossing: 1, duration: 1.2, ease: "power1.in" }, 0)
        .to(fall, { black: 1, duration: 0.8, ease: "power1.in" }, 0.6);
      return () => { tl.kill(); };
    }

    // the one parameter the whole crossing rides
    tl.to(fall, { crossing: 1, duration: 9.0, ease: "power1.in" }, 0);
    // 0–2s  slow push-in, sound builds
    tl.to(fall, { camDist: 20, duration: 2.4, ease: "power1.inOut" }, 0);
    // 1–4s  gravity takes hold — TARS shakes, resists
    tl.to(fall, { shake: 1, duration: 2.2, ease: "power2.in" }, 1.0);
    tl.to(fall, { progress: 0.35, duration: 3.2, ease: "power1.in" }, 0.8);
    // 4–8s  TARS loses — stretched, pulled in; we follow
    tl.to(fall, { progress: 1, duration: 4.4, ease: "power2.in" }, 4.0);
    tl.to(fall, { shake: 0.25, duration: 1.5, ease: "power1.out" }, 5.0);
    tl.to(fall, { camDist: 2.4, duration: 4.6, ease: "power2.in" }, 4.0);
    tl.to(fall, { warp: 1, duration: 4.4, ease: "power2.in" }, 4.2);
    tl.to(post, { aberration: 0.014, duration: 3.4, ease: "power2.in" }, 5.0);
    // 8.2–9s the horizon engulfs everything
    tl.to(fall, { black: 1, duration: 0.8, ease: "power1.in" }, 8.2);

    return () => { tl.kill(); };
  }, [phase, reducedMotion, setPhase]);

  return (
    <group>
      <BlackHole />
      <SpaceDust />
      <Approach />
      <CameraDrift />
      {phase === "threshold" && <Threshold />}
      {phase === "return" && <ReturnArrival />}
      {/* warm key from the accretion disk, cold starlight fill */}
      <pointLight position={[2, 3, -6]} intensity={26} color="#ff9440" distance={40} decay={2} />
      <pointLight position={[-6, 2, 5]} intensity={4} color="#6d86c9" distance={30} decay={2} />
      <ambientLight intensity={0.06} />
      <Tars />
    </group>
  );
}
