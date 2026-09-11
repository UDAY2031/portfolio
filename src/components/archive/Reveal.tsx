"use client";
/* eslint-disable @next/next/no-img-element -- archive media renders inside a
   transformed 3D plane; next/image adds nothing to a static export */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { RoomPlacement } from "./path";
import { temperatureColor } from "./path";
import { archive, registerPlane, PLANE_W, PLANE_H, STAGE_LEAD, STAGE_GAP, STAGE_FADE } from "./state";
import type { ThreadSpec } from "./Threads";
import { metricNumber, type Milestone } from "@/lib/milestones";
import { arch } from "@/lib/refs";

// The memory itself. When a thread is bent, a thin holographic plane
// assembles along it — a procedural line-draw, not a PNG fade — and the
// content resolves in order: title → description → achievements → metrics
// (numbers counting up) → image / video → tech chips → links. Nothing
// appears faster than ~600ms per element; released, it reverses.

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform float uDraw;
  uniform float uTime;
  uniform float uFade;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    float x = vUv.x;
    float y = vUv.y;
    float e = 0.012;
    float drawn = step(x, uDraw);
    // borders draw from the thread edge outward; the far edge closes last
    float lines = (step(y, e * 1.6) + step(1.0 - e * 1.6, y)) * drawn;
    lines += step(x, e * 0.8);
    lines += step(1.0 - e * 0.8, x) * step(0.985, uDraw);
    lines = clamp(lines, 0.0, 1.0);
    // the drawing head
    float head = exp(-pow((x - uDraw) * 70.0, 2.0)) * step(0.002, uDraw) * (1.0 - step(0.999, uDraw));
    // faint scanned glass behind the words
    float scan = 0.85 + 0.15 * sin(y * 220.0 + uTime * 0.8);
    float glass = drawn * 0.16 * scan;
    vec3 col = uColor * (lines * 1.5 + head * 2.6) + uColor * 0.35 * glass;
    float a = clamp(lines * 0.95 + head + glass * 2.0, 0.0, 1.0) * uFade;
    gl_FragColor = vec4(col, a);
  }
`;

type StageKey = "title" | "desc" | "ach" | "metrics" | "media" | "tech" | "links";

// Which stages a memory resolves through, in order.
function stageKeys(m: Milestone): StageKey[] {
  const s: StageKey[] = ["title", "desc"];
  if (m.achievements.length) s.push("ach");
  if (m.metrics.length) s.push("metrics");
  if (m.video || m.images.length) s.push("media");
  if (m.techStack.length) s.push("tech");
  if (m.links.length) s.push("links");
  return s;
}

export function Reveal({ room, milestone, threads, temperature, near }: {
  room: RoomPlacement; milestone: Milestone; threads: ThreadSpec[]; temperature: number; near: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const plane = useRef<THREE.Mesh>(null);
  const rootEl = useRef<HTMLDivElement>(null);
  const stageEls = useRef<(HTMLDivElement | null)[]>([]);
  const numRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const playing = useRef(false);

  const stages = useMemo(() => stageKeys(milestone), [milestone]);
  const numbers = useMemo(() => milestone.metrics.map((m) => metricNumber(m.value)), [milestone]);
  const duration = STAGE_LEAD + STAGE_GAP * (stages.length - 1) + STAGE_FADE + 0.2;

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uDraw: { value: 0 },
          uTime: { value: 0 },
          uFade: { value: 1 },
          uColor: { value: temperatureColor(temperature).lerp(new THREE.Color("#ffe2a8"), 0.5) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [temperature]
  );

  useEffect(() => {
    registerPlane(room.index, group.current);
    return () => registerPlane(room.index, null);
  }, [room.index]);

  useFrame((state) => {
    const g = group.current;
    const rs = archive.roomState[room.index];
    if (!g || !rs) return;
    const p = rs.reveal;
    const anchor = rs.anchor ? threads.find((t) => t.id === rs.anchor) : null;
    const open = p > 0.001 && !!anchor;
    g.visible = open;
    if (rootEl.current) rootEl.current.style.display = open ? "" : "none";
    if (!anchor || !open) return;

    // the plane hangs from its thread, opening toward the centre of the path,
    // and turns to face the visitor
    const side = anchor.rx > 0 ? -1 : 1;
    g.position.copy(anchor.center).add(room.right.clone().multiplyScalar(side * (PLANE_W / 2 + 0.35))).add(new THREE.Vector3(0, 0.3, 0));
    g.lookAt(state.camera.position.x, g.position.y, state.camera.position.z);

    const time = p * duration;
    const draw = THREE.MathUtils.clamp(time / STAGE_LEAD, 0, 1);
    if (plane.current) {
      const u = (plane.current.material as THREE.ShaderMaterial).uniforms;
      u.uDraw.value = draw;
      u.uTime.value = arch.freeze ? 37.0 : state.clock.elapsedTime;
      u.uFade.value = 1 - arch.recede;
    }

    if (rootEl.current) {
      rootEl.current.style.clipPath = `inset(0 ${Math.round((1 - draw) * 100)}% 0 0)`;
      rootEl.current.style.opacity = String(Math.min(1, draw * 1.5) * (1 - arch.recede));
      rootEl.current.style.pointerEvents = p > 0.95 ? "auto" : "none";
    }
    stages.forEach((_, i) => {
      const el = stageEls.current[i];
      if (!el) return;
      const start = STAGE_LEAD + i * STAGE_GAP;
      const local = THREE.MathUtils.clamp((time - start) / STAGE_FADE, 0, 1);
      const eased = local * local * (3 - 2 * local);
      el.style.opacity = String(eased);
      el.style.transform = `translateY(${(1 - eased) * 7}px)`;
      el.style.filter = eased < 1 ? `blur(${(1 - eased) * 3}px)` : "none";
    });
    // metrics count up through their own stage
    const metricStage = stages.indexOf("metrics");
    if (metricStage >= 0) {
      const start = STAGE_LEAD + metricStage * STAGE_GAP;
      const local = THREE.MathUtils.clamp((time - start) / 1.1, 0, 1);
      const eased = 1 - Math.pow(1 - local, 3);
      numbers.forEach((n, i) => {
        const el = numRefs.current[i];
        if (!el || !n) return;
        const v = n.n * eased;
        const text = Number.isInteger(n.n) ? Math.round(v).toString() : v.toFixed(2);
        el.textContent = `${n.prefix}${text}${n.suffix}`;
      });
    }
    // the demo reel plays only while it is on screen
    const mediaStage = stages.indexOf("media");
    const v = vidRef.current;
    if (v && mediaStage >= 0) {
      const visible = time > STAGE_LEAD + mediaStage * STAGE_GAP + 0.1;
      if (visible && !playing.current) { playing.current = true; v.play().catch(() => { /* autoplay refused — the poster frame stays */ }); }
      if (!visible && playing.current) { playing.current = false; v.pause(); }
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={plane} material={material}>
        <planeGeometry args={[PLANE_W, PLANE_H]} />
      </mesh>
      {near && (
        <Html transform distanceFactor={5.333} position={[0, 0, 0.03]} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div ref={rootEl} className="rv" style={{ opacity: 0 }}>
            {stages.map((key, i) => (
              <div key={key} className={`rv__stage rv__stage--${key}`} ref={(el) => { stageEls.current[i] = el; }} style={{ opacity: 0 }}>
                {key === "title" && (
                  <div className="rv__head">
                    <span className="rv__date">{milestone.dateRange}</span>
                    <h2 className="rv__title">{milestone.title}</h2>
                  </div>
                )}
                {key === "desc" && (
                  <div>
                    {milestone.subtitle && <p className="rv__sub">{milestone.subtitle}</p>}
                    <p className="rv__desc">{milestone.description}</p>
                  </div>
                )}
                {key === "ach" && (
                  <ul className="rv__ach">{milestone.achievements.map((a, j) => <li key={j}>{a}</li>)}</ul>
                )}
                {key === "metrics" && (
                  <div className="rv__metrics">
                    {milestone.metrics.map((mt, j) => (
                      <div key={mt.label} className="rv__metric">
                        <span className="rv__num" ref={(el) => { numRefs.current[j] = el; }}>{mt.value}</span>
                        <span className="rv__label">{mt.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {key === "media" && (
                  <div className="rv__media">
                    {milestone.video
                      ? <video ref={vidRef} src={milestone.video} muted loop playsInline preload="none" />
                      : <img src={milestone.images[0]} alt="" loading="lazy" decoding="async" />}
                  </div>
                )}
                {key === "tech" && (
                  <div className="rv__chips">{milestone.techStack.map((t) => <span key={t} className="rv__chip">{t}</span>)}</div>
                )}
                {key === "links" && (
                  <div className="rv__links">
                    {milestone.links.map((l) => (
                      <a key={l.url} href={l.url} target={l.url.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer">{l.label} ↗</a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Html>
      )}
    </group>
  );
}
