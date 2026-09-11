"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { RoomPlacement } from "./path";
import { roomHash, temperatureColor } from "./path";
import { archive } from "./state";
import { arch } from "@/lib/refs";
import type { Quality } from "@/store/useStore";

// Dust: GPU point particles per room, drifting in the one light. When a
// thread is engaged the dust is drawn toward it; on the Return it disperses
// outward instead of fading.

const COUNT: Record<Quality, number> = { high: 720, medium: 460, low: 240 };

const vertex = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uPull;
  uniform float uDisperse;
  uniform float uPixelRatio;
  uniform float uFogDensity;
  uniform vec3 uAttract;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    // slow, weightless drift
    p += vec3(sin(uTime * 0.13 + aSeed * 7.0), cos(uTime * 0.11 + aSeed * 3.0) * 0.6, sin(uTime * 0.09 + aSeed * 5.0)) * 0.9;
    // drawn toward the engaged thread, gathering along its length
    float dA = length(uAttract - p);
    float w = uPull * smoothstep(16.0, 2.0, dA);
    vec3 onThread = uAttract + normalize(p - uAttract + vec3(0.001)) * (0.5 + aSeed * 1.1) + vec3(0.0, (aSeed - 0.5) * 9.0, 0.0);
    p = mix(p, onThread, w * 0.85);
    // the Return: outward, not away
    p += normalize(position + vec3(0.001)) * uDisperse * 28.0;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aSize * (1.0 + w * 0.8) * uPixelRatio * 120.0 / max(-mv.z, 1.0);
    gl_PointSize = clamp(size, 1.0, 12.0);
    float fog = exp(-uFogDensity * uFogDensity * mv.z * mv.z);
    vAlpha = (0.3 + 0.7 * aSeed) * (1.0 - uDisperse) * fog * (0.55 + w * 0.9);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.12, d) * vAlpha * 0.55;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const V = new THREE.Vector3();
const INV = new THREE.Matrix4();

export function RoomDust({ room, temperature, quality }: { room: RoomPlacement; temperature: number; quality: Quality }) {
  const points = useRef<THREE.Points>(null);
  const count = COUNT[quality];

  const { geometry, material, basis } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (roomHash(room.index, 1000 + i) - 0.5) * 20;
      pos[i * 3 + 1] = (roomHash(room.index, 2000 + i) - 0.5) * 13;
      pos[i * 3 + 2] = (roomHash(room.index, 3000 + i) - 0.5) * 26;
      seed[i] = roomHash(room.index, 4000 + i);
      size[i] = 0.5 + roomHash(room.index, 5000 + i) * 1.1;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geometry.computeBoundingSphere();
    if (geometry.boundingSphere) geometry.boundingSphere.radius += 30; // room for the disperse
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uTime: { value: 0 },
        uPull: { value: 0 },
        uDisperse: { value: 0 },
        uPixelRatio: { value: 1 },
        uFogDensity: { value: 0.03 },
        uAttract: { value: new THREE.Vector3(0, 0, 0) },
        uColor: { value: temperatureColor(temperature).lerp(new THREE.Color("#e9dcc2"), 0.45) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const basis = new THREE.Matrix4().makeBasis(room.right, room.up, room.forward);
    return { geometry, material, basis };
  }, [room, count, temperature]);

  const quaternion = useMemo(() => new THREE.Quaternion().setFromRotationMatrix(basis), [basis]);

  useFrame((state) => {
    const p = points.current;
    if (!p) return;
    // per-frame writes go through the mesh's own material, never the memo
    const u = (p.material as THREE.ShaderMaterial).uniforms;
    u.uTime.value = arch.freeze ? 37.0 : state.clock.elapsedTime;
    u.uPixelRatio.value = state.gl.getPixelRatio();
    const fog = state.scene.fog as THREE.FogExp2 | null;
    if (fog) u.uFogDensity.value = fog.density;
    u.uDisperse.value = arch.disperse;
    const rs = archive.roomState[room.index];
    const anchor = rs?.anchor ? archive.threads.get(rs.anchor) : null;
    const pull = anchor ? THREE.MathUtils.smoothstep(anchor.engage, 0.1, 0.9) * (1 - arch.recede) : 0;
    u.uPull.value = THREE.MathUtils.lerp(u.uPull.value, pull, 0.08);
    if (anchor) {
      // thread centre → room-local space
      V.copy(anchor.center).sub(room.center);
      INV.copy(basis).invert();
      V.applyMatrix4(INV);
      u.uAttract.value.lerp(V, 0.2);
    }
  });

  return <points ref={points} geometry={geometry} material={material} position={room.center} quaternion={quaternion} />;
}
