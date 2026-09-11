"use client";

// Small, forgiving parameter persistence. Everything the visitor or the
// developer tunes (sound, volume, quality tier, HUD) survives a reload;
// nothing here is ever allowed to throw — private windows and blocked
// storage simply fall back to defaults.

const PREFIX = "gargantua:";

export function loadParam<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveParam(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the parameter simply doesn't persist */
  }
}

// Session-scoped resume point written only when the GPU context is lost, so
// a worst-case recovery (full reload) lands in the same room, never Phase 01.
const RESUME_KEY = PREFIX + "resume";

export interface ResumePoint { phase: string; u: number }

export function saveResumePoint(p: ResumePoint) {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(RESUME_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function takeResumePoint(): ResumePoint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(RESUME_KEY);
    return JSON.parse(raw) as ResumePoint;
  } catch {
    return null;
  }
}
