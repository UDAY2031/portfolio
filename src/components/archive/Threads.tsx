"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { RoomPlacement } from "./path";
import { roomHash, temperatureColor } from "./path";
import { archive, registerThread, threadId, THREAD_HALF, type ThreadRef } from "./state";
import { threadCount, type Milestone } from "@/lib/milestones";
import { arch } from "@/lib/refs";

// The light-threads — the Archive's one mechanic. A few thin volumetric
// shafts hang in each room with a slow noise waver. On approach a thread
// brightens; held, its waver slows and straightens and it pulls taut toward
// the camera; bent, it becomes the delivery mechanism for the room's memory.
// Released, the waver resumes. All threads are ONE instanced draw.

const vertex = /* glsl */ `
  attribute float aSeed;
  attribute float aBright;
  attribute float aTaut;
  attribute float aFade;
  attribute vec3 aColor;
  uniform vec3 uCamPos;
  uniform float uTime;
  varying float vDepth;
  varying float vX;
  varying float vV;
  varying float vBright;
  varying float vTaut;
  varying float vFade;
  varying float vSeed;
  varying vec3 vColor;

  void main() {
    vec3 origin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    // cylindrical billboard: the strip always faces the camera around its axis
    vec3 toCam = uCamPos - origin;
    toCam.y = 0.0;
    float dist = length(toCam);
    toCam = dist > 0.001 ? toCam / dist : vec3(0.0, 0.0, 1.0);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));

    float v = position.y / ${(THREAD_HALF * 2).toFixed(1)} + 0.5;
    float pin = sin(v * 3.14159);
    // the waver: two slow sines; it slows and straightens as the thread tautens
    float slow = 1.0 - aTaut * 0.85;
    float w = (sin(v * 7.0 + uTime * 1.1 * slow + aSeed * 6.0) * 0.6
             + sin(v * 15.0 - uTime * 0.7 * slow + aSeed * 3.0) * 0.4) * 0.42 * (1.0 - aTaut);
    float width = 1.0 + aBright * 0.9;
    vec3 p = origin + vec3(0.0, position.y, 0.0)
           + right * (position.x * width + w * pin)
           + toCam * (w * 0.4 * pin + aTaut * 1.5 * pin); // pulls taut toward the camera

    vX = position.x / 0.275;
    vV = v;
    vBright = aBright;
    vTaut = aTaut;
    vFade = aFade;
    vSeed = aSeed;
    vColor = aColor;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uFogDensity;
  varying float vDepth;
  varying float vX;
  varying float vV;
  varying float vBright;
  varying float vTaut;
  varying float vFade;
  varying float vSeed;
  varying vec3 vColor;

  void main() {
    float core = exp(-vX * vX * 24.0);
    float halo = exp(-vX * vX * 3.0) * 0.18;
    float ends = smoothstep(0.0, 0.1, vV) * smoothstep(1.0, 0.9, vV);
    // volumetric flicker along the shaft, calming as it tautens
    float n = 0.6 + 0.4 * sin(vV * 40.0 + uTime * (2.0 - vTaut * 1.5) + vSeed * 9.0) * (1.0 - vTaut * 0.7);
    vec3 hot = vec3(1.6, 1.45, 1.2);
    vec3 col = mix(vColor, hot, vBright * 0.8);
    // the same fog as the architecture: distant threads are hints, not lamps
    float fog = exp(-uFogDensity * uFogDensity * vDepth * vDepth);
    float a = (core * (0.9 + vBright * 1.3) + halo) * ends * n * (0.3 + vBright * 1.1) * vFade * fog;
    gl_FragColor = vec4(col * a, a);
  }
`;

// lateral / along-path slots so threads never stack, jittered per room
const LATERAL = [-4.4, 3.6, -2.0, 4.8, 1.3, -3.4];
const ALONG = [-4.5, 3.0, 6.5, -1.5, 1.0, -7.0];

export interface ThreadSpec extends ThreadRef {
  color: THREE.Color;
  /** room-local lateral offset (sign decides which side the memory opens) */
  rx: number;
}

export function buildThreads(rooms: RoomPlacement[], milestones: Milestone[]): ThreadSpec[] {
  const out: ThreadSpec[] = [];
  rooms.forEach((room, i) => {
    const m = milestones[i];
    const n = m ? threadCount(m) : 3;
    const temp = milestones.length <= 1 ? 0.6 : i / (milestones.length - 1);
    const color = temperatureColor(m?.look?.temperature ?? temp).lerp(new THREE.Color("#f1e4c6"), 0.35);
    for (let j = 0; j < n; j++) {
      const rx = LATERAL[j % LATERAL.length] + (roomHash(i, 100 + j) - 0.5) * 1.2;
      const fz = ALONG[j % ALONG.length] + (roomHash(i, 200 + j) - 0.5) * 2.0;
      const ry = (roomHash(i, 300 + j) - 0.5) * 1.0;
      const center = room.center.clone()
        .add(room.right.clone().multiplyScalar(rx))
        .add(room.forward.clone().multiplyScalar(fz))
        .add(new THREE.Vector3(0, ry, 0));
      out.push({
        id: threadId(i, j),
        room: i,
        index: j,
        center,
        a: center.clone().add(new THREE.Vector3(0, -THREAD_HALF, 0)),
        b: center.clone().add(new THREE.Vector3(0, THREAD_HALF, 0)),
        engage: 0,
        released: 0,
        color,
        rx,
      });
    }
  });
  return out;
}

export function ThreadField({ threads }: { threads: ThreadSpec[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = threads.length;

  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(0.55, THREAD_HALF * 2, 1, 48);
    const seed = new Float32Array(count);
    const bright = new Float32Array(count);
    const taut = new Float32Array(count);
    const fade = new Float32Array(count);
    const color = new Float32Array(count * 3);
    threads.forEach((t, i) => {
      seed[i] = roomHash(t.room, 400 + t.index) * 10;
      fade[i] = 1;
      color[i * 3] = t.color.r; color[i * 3 + 1] = t.color.g; color[i * 3 + 2] = t.color.b;
    });
    geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    geometry.setAttribute("aBright", new THREE.InstancedBufferAttribute(bright, 1));
    geometry.setAttribute("aTaut", new THREE.InstancedBufferAttribute(taut, 1));
    geometry.setAttribute("aFade", new THREE.InstancedBufferAttribute(fade, 1));
    geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(color, 3));
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uCamPos: { value: new THREE.Vector3() }, uTime: { value: 0 }, uFogDensity: { value: 0.03 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return { geometry, material };
  }, [threads, count]);

  useLayoutEffect(() => {
    const im = mesh.current;
    if (!im) return;
    const m = new THREE.Matrix4();
    threads.forEach((t, i) => {
      m.makeTranslation(t.center.x, t.center.y, t.center.z);
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }, [threads]);

  // registration is a passive effect: the scene's layout effect has already
  // configured the rooms by the time this runs
  useEffect(() => {
    threads.forEach(registerThread);
  }, [threads]);

  const frozenTime = useRef(37.0);

  useFrame((state) => {
    const im = mesh.current;
    if (!im) return;
    // per-frame writes go through the mesh's own material/geometry, never the memo
    const uniforms = (im.material as THREE.ShaderMaterial).uniforms;
    const attrs = im.geometry.attributes;
    const bright = attrs.aBright.array as Float32Array;
    const taut = attrs.aTaut.array as Float32Array;
    const fade = attrs.aFade.array as Float32Array;
    const t = arch.freeze ? frozenTime.current : state.clock.elapsedTime;
    uniforms.uTime.value = t;
    uniforms.uCamPos.value.copy(state.camera.position);
    const fog = state.scene.fog as THREE.FogExp2 | null;
    if (fog) uniforms.uFogDensity.value = fog.density;
    const cam = state.camera.position;
    const lastRoom = archive.rooms.length - 1;
    threads.forEach((th, i) => {
      // proximity glow invites; engagement brightens; the Return lets go
      const dist = th.center.distanceTo(cam);
      const near = THREE.MathUtils.clamp(1 - (dist - 6) / 22, 0, 1) * 0.18;
      // the last room's threads let go one by one; every other room follows
      const perThread = th.room === lastRoom
        ? THREE.MathUtils.clamp(arch.release * 1.6 - th.index * 0.22, 0, 1)
        : arch.release;
      th.released = perThread;
      const alive = (1 - perThread) * (1 - arch.recede);
      bright[i] = Math.max(near, th.engage) * alive;
      taut[i] = THREE.MathUtils.smoothstep(th.engage, 0.15, 1) * alive;
      fade[i] = alive;
    });
    attrs.aBright.needsUpdate = true;
    attrs.aTaut.needsUpdate = true;
    attrs.aFade.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />;
}
