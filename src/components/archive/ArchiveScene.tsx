"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { buildPath } from "./path";
import { temperature as tempOf, type Milestone } from "@/lib/milestones";
import { RoomFrames, Rails } from "./Frames";
import { RoomLight } from "./RoomLight";
import { RoomDust } from "./Dust";
import { ThreadField, buildThreads } from "./Threads";
import { Reveal } from "./Reveal";
import { CameraRig } from "./CameraRig";
import { DebugOverlay } from "./DebugOverlay";
import { configure, applyPending, pending } from "./state";
import { useStore } from "@/store/useStore";
import { arch, post } from "@/lib/refs";
import gsap from "gsap";

// Phase 04 — THE ARCHIVE. A single continuous structure of large frames,
// one dominant light per room, dust, and a few light-threads; rooms are
// instantiated from the milestone manifest — nothing here knows any one
// milestone. Depth is fog and light falloff. Silence is a design tool.

const FOG_COLOR = "#030201";
const FOG_BASE = 0.031;

const QUIET: Milestone[] = [{
  id: "quiet", order: 1, title: "The archive is quiet", description: "No milestones were found.",
  dateRange: "—", metrics: [], images: [], video: null, techStack: [], links: [], achievements: [],
}];

export default function ArchiveScene() {
  const getThree = useThree((s) => s.get);
  const stored = useStore((s) => s.milestones);
  const quality = useStore((s) => s.quality);
  const roomIndex = useStore((s) => s.roomIndex);
  const archiveDebug = useStore((s) => s.archiveDebug);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const milestones = stored.length ? stored : QUIET;

  const path = useMemo(() => buildPath(milestones.length), [milestones.length]);
  const threads = useMemo(() => buildThreads(path.rooms, milestones), [path, milestones]);
  const temps = useMemo(() => milestones.map((m, i) => tempOf(m, i, milestones.length)), [milestones]);

  // rooms/threads become the interaction state before children register
  useLayoutEffect(() => {
    configure(path.rooms, milestones);
    // a fresh entry materialises just before the first room, already inside
    // the structure — never out in the run-in looking at fog
    if (arch.u === 0 && pending.room === null && path.rooms.length) arch.u = Math.max(0, path.rooms[0].u - 0.035);
    applyPending();
  }, [path, milestones]);

  // near-black fog: the voids between frames read as true dark; distant
  // frames are silhouettes. The Return thickens it until nothing is left.
  useEffect(() => {
    const scene = getThree().scene;
    scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_BASE);
    scene.background = new THREE.Color(FOG_COLOR);
    // the light of the crossing still smearing in the lens, settling
    if (!reducedMotion) gsap.fromTo(post, { aberration: 0.005 }, { aberration: 0.0004, duration: 4.0, ease: "power2.out" });
    return () => { scene.fog = null; scene.background = null; };
  }, [getThree, reducedMotion]);

  useFrame((state) => {
    const fog = state.scene.fog as THREE.FogExp2 | null;
    if (fog) fog.density = FOG_BASE + arch.recede * arch.recede * 0.3;
  });

  return (
    <group>
      <Rails curve={path.curve} />
      {path.rooms.map((room, i) => (
        <group key={milestones[i].id}>
          <RoomFrames room={room} temperature={temps[i]} />
          <RoomLight room={room} temperature={temps[i]} quality={quality} />
          <RoomDust room={room} temperature={temps[i]} quality={quality} />
          <Reveal
            room={room}
            milestone={milestones[i]}
            threads={threads.filter((t) => t.room === i)}
            temperature={temps[i]}
            near={Math.abs(i - roomIndex) <= 1}
          />
        </group>
      ))}
      <ThreadField threads={threads} />
      {/* the faintest fill — everything that is not the one light is shadow */}
      <ambientLight intensity={0.09} color="#d8cfc0" />
      <CameraRig path={path} />
      {archiveDebug && <DebugOverlay path={path} threads={threads} />}
    </group>
  );
}
