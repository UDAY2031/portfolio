"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import { fall, thr } from "@/lib/refs";

// TARS, faithful to the film: four articulated matte-black monolith segments,
// brushed-aluminum finish, hinge servos, an amber telemetry readout and an
// etched name plate. Deliberately small in frame — the singularity behind it
// must feel colossal. Idle = micro servo corrections, surface rotations and
// mechanical breathing. During the fall it is tidally stretched and pulled in.

const SLAB_X = [-0.51, -0.17, 0.17, 0.51];
const SEAM_X = [-0.34, 0, 0.34];

// The whole robot is scaled down against the black hole so the accretion disk
// towers over it — scale relationship is the shot's core statement.
// Off-centre right so the ENTER button never covers the robot.
const COMPOSITION = { scale: 0.5, position: [1.55, -1.25, 1.9] as [number, number, number] };

function easeInCubic(t: number) {
  return t * t * t;
}

// Vertical micro-streak texture: reads as brushed aluminum under grazing light.
function makeBrushedTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#7a7a7a";
  g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 256;
    const len = 8 + Math.random() * 60;
    const shade = 90 + Math.floor(Math.random() * 80);
    g.strokeStyle = `rgba(${shade},${shade},${shade},0.18)`;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y + len);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Scrolling telemetry readout for the chest screen — the film's TARS settings.
function makeReadoutTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#050300";
  g.fillRect(0, 0, 128, 512);
  g.font = "13px monospace";
  const lines = [
    "TARS  v9.1",
    "HONESTY  90%",
    "HUMOR    75%",
    "GRAV  1.2e9 g",
    "TIDAL  RISING",
    "HULL   NOMINAL",
    "SIGNAL  LOCKED",
    "> STAND BY",
  ];
  for (let rep = 0; rep < 2; rep++) {
    lines.forEach((line, i) => {
      const y = rep * 256 + 22 + i * 30;
      g.fillStyle = i % 3 === 0 ? "#ffd9a0" : "#e9a84c";
      g.fillText(line, 8, y);
    });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 0.5);
  return tex;
}

function makeNamePlateTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 128, 64);
  g.font = "bold 34px monospace";
  g.fillStyle = "#c9ccd4";
  g.textAlign = "center";
  g.fillText("TARS", 64, 44);
  return new THREE.CanvasTexture(c);
}

export default function Tars() {
  const outer = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const slabs = useRef<(THREE.Group | null)[]>([]);
  const screen = useRef<THREE.Mesh>(null);

  const { brushed, readoutTex, plateTex } = useMemo(
    () => ({
      brushed: makeBrushedTexture(),
      readoutTex: makeReadoutTexture(),
      plateTex: makeNamePlateTexture(),
    }),
    []
  );

  useFrame((state) => {
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    const t = state.clock.elapsedTime;
    const p = fall.progress;

    // the unit exists only where the mass does: gone during the light-speed
    // flight of the Threshold, condensing back with the hole on the Return
    if (outer.current) {
      const v = COMPOSITION.scale * thr.hole;
      outer.current.scale.setScalar(Math.max(v, 0.0001));
      outer.current.visible = thr.hole > 0.01;
    }

    // telemetry screen slowly scrolls
    const screenMat = screen.current?.material as THREE.MeshStandardMaterial | undefined;
    if (screenMat?.emissiveMap) screenMat.emissiveMap.offset.y = (t * 0.03) % 1;

    // ── Idle life: breathing bob + tiny servo corrections ──
    const idle = 1 - Math.min(p * 3, 1);
    b.position.y = Math.sin(t * 0.6) * 0.02 * idle;
    b.rotation.z = Math.sin(t * 0.23) * 0.008 * idle;
    b.rotation.y = Math.sin(t * 0.11) * 0.03 * idle;

    slabs.current.forEach((s, i) => {
      if (!s) return;
      // phase-shifted micro shifts, like servos holding position
      const servo = Math.sin(t * 0.9 + i * 1.7) * 0.006 + Math.sin(t * 3.1 + i * 5.2) * 0.0015;
      s.position.y = servo * idle;
      // occasional twitch
      const tw = Math.max(0, Math.sin(t * 0.31 + i * 2.3) - 0.985) * 2.2;
      s.rotation.x = tw * 0.5 * idle;
      // rare weight-shift: one segment slides forward then settles
      const shuffle = Math.max(0, Math.sin(t * 0.13 + i * 2.9) - 0.965) * 12;
      s.position.z = Math.min(shuffle, 1) * 0.05 * idle;
      // subtle surface rotation, a servo re-indexing its facing
      const twist = Math.max(0, Math.sin(t * 0.19 + i * 4.1) - 0.975) * 8;
      s.rotation.y = Math.min(twist, 1) * 0.09 * idle;

      // resist phase: slabs strain apart, mechanical panic
      const strain = Math.min(p / 0.35, 1) * (1 - easeInCubic(Math.max(0, (p - 0.35) / 0.65)));
      s.position.x = SLAB_X[i] + SLAB_X[i] * strain * 0.28;
      s.position.y += Math.sin(t * 22 + i * 9) * 0.012 * fall.shake;
    });

    // ── Structural shake as gravity takes hold ──
    g.position.x = (Math.sin(t * 41.3) + Math.sin(t * 27.7)) * 0.012 * fall.shake;

    // ── The fall: tidal stretch toward the hole (screen centre, far -z) ──
    if (p > 0.35) {
      const f = easeInCubic((p - 0.35) / 0.65);
      g.position.z = -f * 90;
      g.position.y = -0.35 + f * 1.1;
      g.scale.set(
        1 - f * 0.8,
        1 + f * 9,
        1 - f * 0.8
      );
      g.rotation.z = f * 0.9;
    } else {
      g.position.z = -p * 1.5;
      g.position.y = -0.35;
      g.scale.set(1, 1, 1);
      g.rotation.z = 0;
      g.rotation.x = -p * 0.25; // leans back, resisting the pull
    }
  });

  return (
    <group ref={outer} scale={COMPOSITION.scale} position={COMPOSITION.position}>
      <group ref={root} position={[0, -0.35, 0]}>
        <group ref={body}>
          {SLAB_X.map((x, i) => (
            <group key={i} ref={(el) => { slabs.current[i] = el; }} position={[x, 0, 0]}>
              <RoundedBox args={[0.3, 2.3, 0.62]} radius={0.035} smoothness={3} castShadow>
                <meshStandardMaterial
                  color="#14161a"
                  roughness={0.42}
                  metalness={0.78}
                  roughnessMap={brushed}
                />
              </RoundedBox>
              {/* recessed horizontal grooves */}
              {[0.55, 0, -0.55].map((y) => (
                <mesh key={y} position={[0, y, 0.312]}>
                  <boxGeometry args={[0.26, 0.012, 0.004]} />
                  <meshStandardMaterial color="#000" roughness={0.9} metalness={0} />
                </mesh>
              ))}
              {/* etched vertical panel lines */}
              {[-0.09, 0.09].map((ex) => (
                <mesh key={ex} position={[ex, -0.95, 0.312]}>
                  <boxGeometry args={[0.006, 0.32, 0.003]} />
                  <meshStandardMaterial color="#020202" roughness={0.95} metalness={0.1} />
                </mesh>
              ))}
            </group>
          ))}

          {/* hinge servos along the seams — the articulation hardware */}
          {SEAM_X.map((x) =>
            [0.95, -0.95].map((y) => (
              <mesh key={`${x}:${y}`} position={[x, y, 0]}>
                <cylinderGeometry args={[0.045, 0.045, 0.16, 12]} />
                <meshStandardMaterial color="#26282e" roughness={0.35} metalness={0.9} />
              </mesh>
            ))
          )}

          {/* light seams between slabs */}
          {SEAM_X.map((x) => (
            <mesh key={x} position={[x, 0, 0.1]}>
              <boxGeometry args={[0.006, 2.16, 0.4]} />
              <meshStandardMaterial
                color="#1a1208"
                emissive="#ff8a2a"
                emissiveIntensity={0.55}
                roughness={1}
              />
            </mesh>
          ))}

          {/* telemetry readout screen, slow-scrolling */}
          <mesh position={[-0.17, 0.28, 0.313]}>
            <boxGeometry args={[0.24, 0.4, 0.006]} />
            <meshStandardMaterial color="#050505" roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh ref={screen} position={[-0.17, 0.28, 0.318]}>
            <planeGeometry args={[0.21, 0.36]} />
            <meshStandardMaterial
              color="#000"
              emissive="#ffffff"
              emissiveIntensity={1.1}
              emissiveMap={readoutTex}
              toneMapped={false}
            />
          </mesh>

          {/* etched name plate */}
          <mesh position={[0.51, 0.92, 0.318]}>
            <planeGeometry args={[0.2, 0.1]} />
            <meshStandardMaterial
              color="#000"
              emissive="#ffffff"
              emissiveIntensity={0.35}
              emissiveMap={plateTex}
            />
          </mesh>

          {/* status eye */}
          <mesh position={[0.17, 0.72, 0.318]}>
            <boxGeometry args={[0.14, 0.05, 0.004]} />
            <meshStandardMaterial color="#0a0a0a" emissive="#e8f4ff" emissiveIntensity={1.6} />
          </mesh>
        </group>
      </group>

      {/* HUD callout: names the unit and lifts it out of the darkness */}
      <Html center position={[0, 1.9, 0]} style={{ pointerEvents: "none" }} zIndexRange={[10, 0]} distanceFactor={7}>
        <div className="tars-tag">
          <span className="tars-tag__name">TARS</span>
          <span className="tars-tag__sub">MARINE-CLASS UNIT · ONBOARD</span>
          <span className="tars-tag__line" />
        </div>
      </Html>

      {/* a soft key from the disk's glow so the chassis reads against space */}
      <pointLight position={[1.6, 0.8, 2.4]} intensity={5} color="#ffd9a8" distance={9} decay={2} />
      <pointLight position={[-1.4, -0.4, 1.8]} intensity={1.6} color="#9fb0c8" distance={7} decay={2} />
    </group>
  );
}
