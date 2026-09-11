"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useStore, type Phase, type Quality } from "@/store/useStore";
import { IDENTITY, NARRATIVE } from "@/data/content";
import { setMuted as setAudioMuted, setVolume as setAudioVolume, setScene, uiBlip, startAmbient } from "@/lib/audio";
import { arch, resetArchive, resetFall } from "@/lib/refs";
import { loadMilestones } from "@/lib/milestones";
import { beginReturn, jumpToRoom, pending, archive } from "@/components/archive/state";
import { takeResumePoint } from "@/lib/persist";

// The world itself is the interface. What remains in the DOM is narration
// (the intro lines, the Threshold's one line, the two closing lines), one
// corner glyph for sound, and a developer HUD hidden behind the H key —
// diegetic instrumentation, not website chrome.

function Intro() {
  const setPhase = useStore((s) => s.setPhase);
  const [line, setLine] = useState(0);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setLine(1), 2400),
      window.setTimeout(() => setLine(2), 4800),
      window.setTimeout(() => setPhase("void"), 7600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [setPhase]);

  return (
    <div className="intro" onClick={() => useStore.getState().setPhase("void")}>
      <p key={line} className={`intro-line ${line === 2 ? "intro-line--name" : ""}`}>
        {NARRATIVE.intro[line]}
      </p>
    </div>
  );
}

// Shown once per visit, then never again — two practical courtesies that
// fade away before the approach deepens. Not instructions.
let hintsShown = false;

function BeginningHints() {
  const [visible, setVisible] = useState(!hintsShown);
  useEffect(() => {
    if (hintsShown) return;
    hintsShown = true;
    const t = window.setTimeout(() => setVisible(false), 10000);
    return () => window.clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="begin-hints" aria-hidden>
      <p className="landing-hint">headphones recommended</p>
      <p className="landing-hint landing-hint--device">best experienced on a laptop / desktop</p>
    </div>
  );
}

// The Threshold's line and the two closing lines: small, centred, low
// contrast, generous negative space; fade in, hold, dissolve — never a cut.
function Caption() {
  const caption = useStore((s) => s.caption);
  if (!caption) return null;
  return (
    <div className="caption" key={caption} aria-live="polite">
      <p>{caption}</p>
    </div>
  );
}

// The one persistent affordance: a whisper-quiet sound glyph in the corner.
function CornerSound() {
  const muted = useStore((s) => s.muted);
  const toggleMuted = useStore((s) => s.toggleMuted);
  return (
    <button
      className="corner-sound"
      onClick={() => { setAudioMuted(!muted); toggleMuted(); }}
      aria-label={muted ? "Enable sound" : "Mute sound"}
    >
      {muted ? "◌" : "◉"}
    </button>
  );
}

const QUALITIES: Quality[] = ["high", "medium", "low"];

// Developer HUD — telemetry, parameters and room jumps. Hidden behind H.
function Hud() {
  const phase = useStore((s) => s.phase);
  const milestones = useStore((s) => s.milestones);
  const roomIndex = useStore((s) => s.roomIndex);
  const activeRoom = useStore((s) => s.activeRoom);
  const quality = useStore((s) => s.quality);
  const qualityLocked = useStore((s) => s.qualityLocked);
  const setQuality = useStore((s) => s.setQuality);
  const setQualityLocked = useStore((s) => s.setQualityLocked);
  const archiveDebug = useStore((s) => s.archiveDebug);
  const setArchiveDebug = useStore((s) => s.setArchiveDebug);
  const helpOpen = useStore((s) => s.helpOpen);
  const setHelpOpen = useStore((s) => s.setHelpOpen);
  const muted = useStore((s) => s.muted);
  const toggleMuted = useStore((s) => s.toggleMuted);
  const volume = useStore((s) => s.volume);
  const setVolume = useStore((s) => s.setVolume);
  const root = useRef<HTMLDivElement>(null);
  const [telemetry, setTelemetry] = useState({ u: 0, v: 0, fps: 0 });

  useEffect(() => {
    if (!root.current) return;
    gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.7 });
  }, []);

  // 4 Hz telemetry readout; the render loop is never touched by React
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const count = () => { frames++; raf = requestAnimationFrame(count); };
    raf = requestAnimationFrame(count);
    const id = window.setInterval(() => {
      const now = performance.now();
      const fps = Math.round((frames * 1000) / Math.max(1, now - last));
      frames = 0; last = now;
      setTelemetry({ u: arch.u, v: arch.velocity, fps });
    }, 250);
    return () => { window.clearInterval(id); cancelAnimationFrame(raf); };
  }, []);

  const cycleQuality = () => {
    const next = QUALITIES[(QUALITIES.indexOf(quality) + 1) % QUALITIES.length];
    setQuality(next);
    setQualityLocked(true);
    uiBlip(700);
  };

  return (
    <div ref={root} className="hud">
      <header className="hud-top">
        <div className="hud-id">
          <span className="landing-name">{IDENTITY.shortName}</span>
          <span className="hud-tele">
            {phase.toUpperCase()} · room {roomIndex + 1}/{Math.max(1, milestones.length)} · u {telemetry.u.toFixed(3)} · v {(telemetry.v * 1000).toFixed(1)}‰ · {telemetry.fps} fps
            {activeRoom ? ` · open ${activeRoom}` : ""}
          </span>
        </div>
        <div className="hud-actions">
          <button className="hud-btn" onClick={cycleQuality} title="quality tier (click cycles; pins the tier)">
            {quality.toUpperCase()}{qualityLocked ? " ·" : ""}
          </button>
          <button className="hud-btn" onClick={() => { setAudioMuted(!muted); toggleMuted(); }}>
            {muted ? "SOUND OFF" : "SOUND ON"}
          </button>
          <input
            className="volume-slider" type="range" min={0} max={1} step={0.05} value={volume} aria-label="Volume"
            onChange={(e) => { const v = Number(e.target.value); setVolume(v); setAudioVolume(v); }}
          />
          <button className={`hud-btn ${archiveDebug ? "hud-btn--on" : ""}`} onClick={() => setArchiveDebug(!archiveDebug)}>DEBUG</button>
          <button className="hud-btn" onClick={() => setHelpOpen(!helpOpen)} aria-label="Help">?</button>
        </div>
      </header>

      {phase === "archive" && (
        <nav className="hud-nav">
          {milestones.map((m, i) => (
            <button
              key={m.id}
              className={`hud-nav__item ${roomIndex === i ? "hud-nav__item--active" : ""}`}
              onClick={() => { uiBlip(660); jumpToRoom(i); }}
            >
              {String(m.order).padStart(2, "0")} {m.title}
            </button>
          ))}
          <button className="hud-nav__item hud-nav__item--return" onClick={() => { uiBlip(290); beginReturn(); }}>RETURN</button>
        </nav>
      )}

      {helpOpen && (
        <div className="help" onClick={() => setHelpOpen(false)}>
          <div className="help-card" onClick={(e) => e.stopPropagation()}>
            <h3>Instrumentation</h3>
            <ul>
              <li><b>Scroll / drag / ↑↓</b> — nudge the drift along the path</li>
              <li><b>Hover or hold a thread</b> — bend it; the memory assembles</li>
              <li><b>H</b> HUD · <b>M</b> sound · <b>D</b> archive debug view · <b>T</b> trigger the threshold</li>
              <li><b>[ ]</b> — previous / next room · <b>ESC</b> — close</li>
              <li>
                Deep links: <code>?phase=void|crossing|threshold|archive|return</code>,
                <code>&room=&lt;id|order&gt;</code>, <code>&reveal=1</code>, <code>&freeze=1</code>,
                <code>&quality=high|medium|low</code>, <code>&hud=1</code>, <code>&debug=1</code>
              </li>
            </ul>
            <button className="hud-btn" onClick={() => setHelpOpen(false)}>CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}

// One dark veil serves every threshold: the cut into the Archive, the
// dissolve of the Archive, the lift as space returns.
function Blackout() {
  const phase = useStore((s) => s.phase);
  const returning = useStore((s) => s.returning);
  const setPhase = useStore((s) => s.setPhase);
  const setReturning = useStore((s) => s.setReturning);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !returning) return;
    // the architecture recedes for a while first; then the veil completes it
    const tween = gsap.to(ref.current, {
      opacity: 1, duration: 3.4, delay: 2.6, ease: "power2.in",
      onComplete: () => {
        resetArchive(0);
        setReturning(false);
        setPhase("return");
      },
    });
    return () => { tween.kill(); };
  }, [returning, setPhase, setReturning]);

  useEffect(() => {
    if (!ref.current) return;
    if (phase === "archive") {
      // out of the Threshold's dark: black holds a beat, then lifts slowly
      gsap.timeline()
        .set(ref.current, { opacity: 1, backgroundColor: "#030201" })
        .to(ref.current, { opacity: 0, duration: 3.4, ease: "power1.inOut" }, 0.4);
    } else if (phase === "return") {
      // space returns under the decelerating streaks
      gsap.timeline()
        .set(ref.current, { opacity: 1, backgroundColor: "#000000" })
        .to(ref.current, { opacity: 0, duration: 2.8, ease: "power1.inOut" }, 0.5);
    } else if (phase === "void" || phase === "intro") {
      gsap.set(ref.current, { opacity: 0 });
    }
  }, [phase]);

  return <div ref={ref} className="blackout" style={{ opacity: 0 }} />;
}

const SCENE_FOR_PHASE: Record<Phase, "void" | "crossing" | "threshold" | "archive" | "return"> = {
  intro: "void",
  void: "void",
  crossing: "crossing",
  threshold: "threshold",
  archive: "archive",
  return: "return",
};

const PHASES: Phase[] = ["intro", "void", "crossing", "threshold", "archive", "return"];

export default function Overlay() {
  const phase = useStore((s) => s.phase);
  const hudVisible = useStore((s) => s.hudVisible);
  const setHudVisible = useStore((s) => s.setHudVisible);
  const setReducedMotion = useStore((s) => s.setReducedMotion);
  const setMilestones = useStore((s) => s.setMilestones);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setReducedMotion]);

  // Boot: the content manifest, then deep links / recovery, in that order.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = useStore.getState();

    if (params.get("hud") === "1") setHudVisible(true);
    if (params.get("debug") === "1") s.setArchiveDebug(true);
    if (params.get("freeze") === "1") arch.freeze = true;
    const q = params.get("quality");
    if (q === "high" || q === "medium" || q === "low") { s.setQuality(q); s.setQualityLocked(true); }

    // deterministic hooks for automated verification of the whole loop
    (window as unknown as { __journey?: object }).__journey = {
      setPhase: (ph: Phase) => { if (ph === "archive") resetArchive(arch.u); useStore.getState().setPhase(ph); },
      getPhase: () => useStore.getState().phase,
      getRoom: () => useStore.getState().roomIndex,
      getU: () => arch.u,
      setU: (u: number) => { arch.u = Math.max(0, Math.min(1, u)); arch.velocity = 0; },
      getReveal: () => archive.roomState.map((r) => r.reveal),
      jumpToRoom,
      beginReturn,
      threshold: () => useStore.getState().setPhase("threshold"),
      startAudio: startAmbient,
    };

    let cancelled = false;
    loadMilestones().then((list) => {
      if (cancelled) return;
      setMilestones(list);

      // a GPU context loss survived by reloading resumes in the same room
      const resume = takeResumePoint();
      const p = params.get("phase") ?? (resume?.phase === "archive" ? "archive" : null);
      const room = params.get("room");
      const wantsArchive = p === "archive" || p === "tesseract";
      if (wantsArchive) {
        resetFall();
        resetArchive(resume?.u ?? 0);
        if (room) { pending.room = room; pending.reveal = params.get("reveal") === "1"; }
        useStore.getState().setPhase("archive");
      } else if (p && (PHASES as string[]).includes(p) && p !== "intro") {
        resetFall();
        useStore.getState().setPhase(p as Phase);
      }
    });
    return () => { cancelled = true; };
  }, [setHudVisible, setMilestones]);

  // Hotkeys — H hud · M sound · D archive debug · T threshold · [ ] rooms · ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const s = useStore.getState();
      switch (e.key) {
        case "h": case "H": s.setHudVisible(!s.hudVisible); break;
        case "m": case "M": setAudioMuted(!s.muted); s.toggleMuted(); break;
        case "d": case "D": s.setArchiveDebug(!s.archiveDebug); break;
        case "t": case "T": if (s.phase === "void" || s.phase === "crossing") s.setPhase("threshold"); break;
        case "[": if (s.phase === "archive") jumpToRoom(Math.max(0, s.roomIndex - 1)); break;
        case "]": if (s.phase === "archive") jumpToRoom(Math.min(s.milestones.length - 1, s.roomIndex + 1)); break;
        case "Escape": s.setHelpOpen(false); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The soundtrack breathes with the journey.
  useEffect(() => {
    setScene(SCENE_FOR_PHASE[phase]);
  }, [phase]);

  return (
    <>
      {phase === "intro" && <Intro />}
      {phase === "void" && <BeginningHints />}
      {hudVisible && phase !== "intro" && <Hud />}
      {phase !== "intro" && <CornerSound />}
      <Caption />
      <Blackout />
    </>
  );
}
