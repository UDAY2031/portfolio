"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { fall, thr, post, resetFall, resetArchive, RETURN_DISTANCE } from "@/lib/refs";
import { useStore } from "@/store/useStore";
import { NARRATIVE } from "@/data/content";
import { cutAmbient, archiveEntrance, restoreAmbient, silenceBeat } from "@/lib/audio";

// Phase 03 — THE THRESHOLD. An eye blink, taken literally as an aperture:
//
//   1. the lens itself irises closed — the image compresses into the centre
//   2. one frame of true black; the ambient bed is cut, not ducked
//   3. one small line resolves — the only time the visitor's name appears
//   4. it dissolves; the same star field streaks past at extreme velocity
//   5. the streaks resolve into stillness; silence breaks into the first
//      note of the Archive's bed, and Phase 04 begins
//
// Everything is animated on uniforms the raytracer already exposes; the only
// DOM element is the caption. Wall-clock GSAP so weak GPUs never stall it.

export const THRESHOLD_TEXT_MS = 5200; // caption fade in · hold · dissolve (CSS)

export function Threshold() {
  const setPhase = useStore((s) => s.setPhase);
  const setCaption = useStore((s) => s.setCaption);
  const reducedMotion = useStore((s) => s.reducedMotion);

  useEffect(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        resetArchive(0);
        setPhase("archive");
        archiveEntrance();
        resetFall();
      },
    });

    const title = () => {
      setCaption(NARRATIVE.threshold);
      window.setTimeout(() => {
        // never a hard cut: the caption's own CSS dissolve has finished by now
        if (useStore.getState().caption === NARRATIVE.threshold) setCaption(null);
      }, THRESHOLD_TEXT_MS + 100);
    };

    if (reducedMotion) {
      tl.to(thr, { iris: 1, duration: 0.8, ease: "power2.in" }, 0)
        .set(fall, { black: 1 }, 0.8)
        .call(cutAmbient, undefined, 0.8)
        .call(title, undefined, 1.6)
        .to({}, { duration: THRESHOLD_TEXT_MS / 1000 + 0.6 }, 1.6);
      return () => { tl.kill(); };
    }

    // 1 · iris-close (the lens distortion, not a wipe); the last of the light
    //     smears in the glass as the aperture shrinks to a point
    tl.to(thr, { iris: 1, duration: 1.6, ease: "power3.in" }, 0);
    tl.to(fall, { camDist: 1.9, duration: 1.6, ease: "power2.in" }, 0);
    tl.to(post, { aberration: 0.022, duration: 1.4, ease: "power2.in" }, 0.2);
    // 2 · true black, total silence
    tl.set(fall, { black: 1 }, 1.6);
    tl.call(cutAmbient, undefined, 1.6);
    tl.set(post, { aberration: 0.0004 }, 1.7);
    // 3 · the one line (2.5s → ~7.7s, its own CSS handles fade/hold/dissolve)
    tl.call(title, undefined, 2.5);
    // 4 · the mass leaves the field; the sky opens onto flight
    tl.set(thr, { hole: 0, iris: 0, streak: 0.08 }, 7.6);
    tl.set(fall, { camDist: 30, warp: 0, progress: 0 }, 7.6);
    tl.to(fall, { black: 0, duration: 1.1, ease: "power1.inOut" }, 7.6);
    tl.to(thr, { streak: 1, duration: 4.4, ease: "power2.in" }, 7.8);
    tl.to(post, { aberration: 0.006, duration: 4.0, ease: "power2.in" }, 8.0);
    // 5 · resolve into stillness, hold, then the dark before the archive
    tl.to(thr, { streak: 0, duration: 1.6, ease: "power3.out" }, 12.2);
    tl.to(post, { aberration: 0.0004, duration: 1.4, ease: "power2.out" }, 12.2);
    tl.to(fall, { black: 1, duration: 0.8, ease: "power2.in" }, 14.2);

    return () => { tl.kill(); };
  }, [reducedMotion, setPhase, setCaption]);

  return null;
}

// Phase 05/06 — THE RETURN's arrival back in space: the exact reverse of the
// Threshold. Black lifts onto the same star field still streaking, the
// streaks decelerate into stillness, the mass settles back into the lens —
// slightly further away than at the beginning — and two lines close the film
// before the drift of Phase 01 resumes with no seam.
export const RETURN_TOTAL_MS = 18400;

export function ReturnArrival() {
  const setPhase = useStore((s) => s.setPhase);
  const setCaption = useStore((s) => s.setCaption);
  const reducedMotion = useStore((s) => s.reducedMotion);

  useEffect(() => {
    resetFall(RETURN_DISTANCE);
    thr.hole = 0;
    thr.streak = 1;
    fall.black = 0;

    const line = (i: number) => () => {
      setCaption(NARRATIVE.closing[i]);
      window.setTimeout(() => {
        if (useStore.getState().caption === NARRATIVE.closing[i]) setCaption(null);
      }, THRESHOLD_TEXT_MS + 100);
    };

    const tl = gsap.timeline({
      onComplete: () => {
        // the archive exists outside conventional time — the journey resumes
        setPhase("void");
      },
    });

    if (reducedMotion) {
      tl.set(thr, { streak: 0, hole: 1 }, 0)
        .call(line(0), undefined, 1.0)
        .call(line(1), undefined, 6.6)
        .to({}, { duration: 12.4 }, 0);
      return () => { tl.kill(); };
    }

    // streaks decelerate; the hole condenses back into the field
    tl.to(thr, { streak: 0, duration: 3.6, ease: "power3.out" }, 0.4);
    tl.to(thr, { hole: 1, duration: 1.6, ease: "power1.inOut" }, 3.2);
    tl.fromTo(post, { aberration: 0.006 }, { aberration: 0.0004, duration: 3.4, ease: "power2.out" }, 0.4);
    // a beat of silence before each closing line, then the bed returns softly
    tl.call(() => silenceBeat(1100), undefined, 5.0);
    tl.call(line(0), undefined, 5.6);
    tl.call(() => silenceBeat(1100), undefined, 11.2);
    tl.call(line(1), undefined, 11.8);
    tl.call(restoreAmbient, undefined, 17.4);
    tl.to({}, { duration: RETURN_TOTAL_MS / 1000 }, 0);

    return () => { tl.kill(); };
  }, [reducedMotion, setPhase, setCaption]);

  return null;
}
