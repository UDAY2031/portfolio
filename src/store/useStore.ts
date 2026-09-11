"use client";

import { create } from "zustand";
import type { Milestone } from "@/lib/milestones";
import { loadParam, saveParam } from "@/lib/persist";

// The six-phase journey, as a state machine:
//   intro → void (the beginning) → crossing → threshold → archive → return
//   → void … and around again, forever.
export type Phase = "intro" | "void" | "crossing" | "threshold" | "archive" | "return";
export type Quality = "high" | "medium" | "low";

interface State {
  phase: Phase;
  setPhase: (p: Phase) => void;
  muted: boolean;
  toggleMuted: () => void;
  volume: number;
  setVolume: (v: number) => void;
  quality: Quality;
  setQuality: (q: Quality) => void;
  /** a ?quality= deep link pins the tier; the performance monitor stands down */
  qualityLocked: boolean;
  setQualityLocked: (v: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  /** the visitor-facing experience has no chrome; H reveals the developer HUD */
  hudVisible: boolean;
  setHudVisible: (v: boolean) => void;
  /** the Archive's own debug view: thread hitboxes, room bounds, the spline */
  archiveDebug: boolean;
  setArchiveDebug: (v: boolean) => void;
  /** the one line of the Threshold, and the two of the Return */
  caption: string | null;
  setCaption: (c: string | null) => void;
  /** the archive is dissolving — the return has begun */
  returning: boolean;
  setReturning: (v: boolean) => void;
  /** the content manifest, loaded once at boot */
  milestones: Milestone[];
  setMilestones: (m: Milestone[]) => void;
  /** which room the camera is nearest; the room whose memory is open */
  roomIndex: number;
  setRoomIndex: (i: number) => void;
  activeRoom: string | null;
  setActiveRoom: (id: string | null) => void;
}

export const useStore = create<State>((set) => ({
  phase: "intro",
  setPhase: (phase) => set({ phase }),
  muted: loadParam("muted", false),
  toggleMuted: () => set((s) => { saveParam("muted", !s.muted); return { muted: !s.muted }; }),
  volume: loadParam("volume", 0.7),
  setVolume: (volume) => { saveParam("volume", volume); set({ volume }); },
  quality: loadParam<Quality>("quality", "high"),
  setQuality: (quality) => { saveParam("quality", quality); set({ quality }); },
  qualityLocked: false,
  setQualityLocked: (qualityLocked) => set({ qualityLocked }),
  reducedMotion: false,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  hudVisible: false,
  setHudVisible: (hudVisible) => set({ hudVisible }),
  archiveDebug: false,
  setArchiveDebug: (archiveDebug) => set({ archiveDebug }),
  caption: null,
  setCaption: (caption) => set({ caption }),
  returning: false,
  setReturning: (returning) => set({ returning }),
  milestones: [],
  setMilestones: (milestones) => set({ milestones }),
  roomIndex: 0,
  setRoomIndex: (roomIndex) => set({ roomIndex }),
  activeRoom: null,
  setActiveRoom: (activeRoom) => set({ activeRoom }),
}));
