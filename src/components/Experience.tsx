"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom, Noise, Vignette } from "@react-three/postprocessing";
import { ChromaticAberrationEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import VoidScene from "./void/VoidScene";
import ArchiveScene from "./archive/ArchiveScene";
import { useStore, type Quality } from "@/store/useStore";
import { post, arch } from "@/lib/refs";
import { saveResumePoint, takeResumePoint } from "@/lib/persist";

// Timelines must track wall-clock time even when a weak GPU drops frames —
// otherwise the fall sequence stalls on low-end hardware.
gsap.ticker.lagSmoothing(0);

// Three quality tiers, one renderer, one post pipeline for every phase — the
// Archive is graded by the same DP as the black hole.
const TIERS: Quality[] = ["high", "medium", "low"];
const DPR: Record<Quality, () => number> = {
  high: () => Math.min(window.devicePixelRatio, 2),
  medium: () => Math.min(window.devicePixelRatio, 1.5),
  low: () => 1,
};
const BLOOM: Record<Quality, number> = { high: 0.85, medium: 0.72, low: 0.6 };

function Effects({ quality }: { quality: Quality }) {
  // Built imperatively so we can animate the offset per-frame without
  // round-tripping through React props.
  const ca = useMemo(
    () =>
      new ChromaticAberrationEffect({
        offset: new THREE.Vector2(0.0004, 0.00024),
        radialModulation: true,
        modulationOffset: 0.4,
      }),
    []
  );

  // Explicit ACES filmic — never the adaptive-luminance default, which slowly
  // auto-brightens the deliberately dark scenes.
  const toneMapping = useMemo(
    () => new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
    []
  );

  useFrame(() => {
    ca.offset.set(post.aberration, post.aberration * 0.6);
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur intensity={BLOOM[quality]} luminanceThreshold={0.32} luminanceSmoothing={0.22} />
      <primitive object={ca} />
      <Noise premultiply opacity={0.55} />
      <Vignette eskil={false} offset={0.18} darkness={0.78} />
      <primitive object={toneMapping} />
    </EffectComposer>
  );
}

export default function Experience() {
  const phase = useStore((s) => s.phase);
  const quality = useStore((s) => s.quality);
  const setQuality = useStore((s) => s.setQuality);
  const [dpr, setDpr] = useState(1.5);

  const step = useCallback((dir: 1 | -1) => {
    const s = useStore.getState();
    if (s.qualityLocked) return;
    const i = TIERS.indexOf(s.quality);
    const next = TIERS[Math.min(TIERS.length - 1, Math.max(0, i + dir))];
    if (next !== s.quality) setQuality(next);
    setDpr(DPR[next]());
  }, [setQuality]);

  // Graceful WebGL context loss: the frame is skipped, never a black screen
  // of death; every mutable ref (phase, spline progress, timelines) lives
  // outside the GL state, so a restore resumes in the same room. If the
  // browser refuses to restore and the page must reload, the resume point
  // brings the visitor back to that room, not to Phase 01.
  const onCreated = useCallback((state: RootState) => {
    const canvas = state.gl.domElement;
    state.gl.setClearColor("#000000", 1);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      const s = useStore.getState();
      saveResumePoint({ phase: s.phase, u: arch.u });
      console.warn("[gargantua] WebGL context lost — holding state, awaiting restore");
    });
    canvas.addEventListener("webglcontextrestored", () => {
      takeResumePoint();
      state.invalidate();
      console.warn("[gargantua] WebGL context restored — resuming in place");
    });
    // deterministic hook for automated recovery tests
    (window as unknown as { __loseContext?: () => boolean }).__loseContext = () => {
      const ext = state.gl.getContext().getExtension("WEBGL_lose_context");
      if (!ext) return false;
      ext.loseContext();
      window.setTimeout(() => ext.restoreContext(), 600);
      return true;
    };
  }, []);

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0.6, 8], fov: 55, near: 0.1, far: 400 }}
      gl={{
        antialias: false,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      onCreated={onCreated}
      style={{ position: "fixed", inset: 0, touchAction: "none" }}
    >
      <PerformanceMonitor
        onIncline={() => step(1)}
        onDecline={() => step(-1)}
        flipflops={3}
      >
        <Suspense fallback={null}>
          {phase === "archive" ? <ArchiveScene /> : <VoidScene />}
        </Suspense>
        <Effects quality={quality} />
      </PerformanceMonitor>
    </Canvas>
  );
}
