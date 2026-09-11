"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { fall, look, thr, arch } from "@/lib/refs";
import { useStore, type Quality } from "@/store/useStore";

// Full-screen ray-marched black hole. Rays are integrated through a
// Schwarzschild-approximate gravity field (units: event horizon radius = 1),
// producing genuine gravitational lensing, the photon ring and the doubled
// image of the accretion disk above/below the horizon — the Gargantua look,
// built from physics rather than copied imagery.
//
// The same shader also carries the Threshold and the Return: an iris-close
// performed by the lens itself (uIris), and light-speed flight through the
// very same star field (uStreak, uHole) — no second star system, no overlay.

import { vertex, fragment } from "../../../public/film/shaders/black-hole.js";

const STEPS: Record<Quality, number> = { high: 130, medium: 96, low: 64 };

export default function BlackHole() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const size = useThree((s) => s.size);
  const quality = useStore((s) => s.quality);
  const frozenTime = useRef<number | null>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
    );
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uCamDist: { value: 26 },
      uCamY: { value: 1.7 },
      uWarp: { value: 0 },
      uBlack: { value: 0 },
      uSteps: { value: 130 },
      uLook: { value: new THREE.Vector2(0, 0) },
      uIris: { value: 0 },
      uStreak: { value: 0 },
      uHole: { value: 1 },
      uFormation: { value: 0 },
      uRibs: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
    }),
    []
  );

  useFrame((state) => {
    const m = matRef.current;
    if (!m) return;
    // deterministic screenshot mode: the sky, the disk and the sway stand still
    if (arch.freeze) {
      if (frozenTime.current === null) frozenTime.current = 12.0;
    } else frozenTime.current = null;
    m.uniforms.uTime.value = frozenTime.current ?? state.clock.elapsedTime;
    m.uniforms.uRes.value.set(size.width, size.height);
    m.uniforms.uCamDist.value = fall.camDist;
    m.uniforms.uWarp.value = fall.warp;
    m.uniforms.uBlack.value = fall.black;
    m.uniforms.uCamY.value = 1.7 * (1 - fall.progress * 0.85);
    m.uniforms.uSteps.value = STEPS[quality];
    m.uniforms.uLook.value.set(look.x, look.y);
    m.uniforms.uIris.value = thr.iris;
    m.uniforms.uStreak.value = thr.streak;
    m.uniforms.uHole.value = thr.hole;
  });

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={-10}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
