"use client";

// The Archive's content system. Every room is one milestone, described by a
// JSON file under /resources/milestones and materialised into
// public/resources/manifest.json by scripts/build-resources.mjs. The render
// layer knows nothing about any specific milestone: it queries this manifest
// at load and builds rooms and threads from whatever it finds.

export interface Metric { label: string; value: string }
export interface Link { label: string; url: string }

export interface Milestone {
  id: string;
  order: number;
  title: string;
  subtitle?: string;
  description: string;
  dateRange: string;
  metrics: Metric[];
  images: string[];
  video: string | null;
  techStack: string[];
  links: Link[];
  achievements: string[];
  /** optional look overrides — the render layer derives both when absent */
  look?: { temperature?: number; threads?: number };
  /** provenance for every non-obvious claim — never invented */
  sources?: string[];
}

interface Manifest { generatedAt?: string; milestones: Milestone[] }

// If the manifest cannot be reached the archive still opens: one empty room,
// honestly labelled, rather than a black screen.
const FALLBACK: Milestone[] = [
  {
    id: "archive-unavailable",
    order: 1,
    title: "The archive is quiet",
    description: "Its records could not be loaded. Run the resources script and rebuild.",
    dateRange: "—",
    metrics: [],
    images: [],
    video: null,
    techStack: [],
    links: [],
    achievements: [],
  },
];

let pending: Promise<Milestone[]> | null = null;

export function loadMilestones(): Promise<Milestone[]> {
  if (pending) return pending;
  pending = fetch("/resources/manifest.json", { cache: "no-cache" })
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : Promise.reject(new Error(String(r.status)))))
    .then((m) => normalise(m.milestones))
    .catch((err) => {
      console.warn("[archive] manifest unavailable — opening a quiet archive", err);
      return FALLBACK;
    });
  return pending;
}

function normalise(list: Milestone[]): Milestone[] {
  const clean = (Array.isArray(list) ? list : [])
    .filter((m) => m && typeof m.id === "string" && typeof m.title === "string")
    .map((m) => ({
      ...m,
      order: Number.isFinite(m.order) ? m.order : 0,
      description: m.description ?? "",
      dateRange: m.dateRange ?? "",
      metrics: m.metrics ?? [],
      images: m.images ?? [],
      video: m.video ?? null,
      techStack: m.techStack ?? [],
      links: m.links ?? [],
      achievements: m.achievements ?? [],
    }))
    .sort((a, b) => a.order - b.order);
  return clean.length ? clean : FALLBACK;
}

/** How many light-threads a room carries: the more facets a memory has, the
 *  denser its threads (3–6). A JSON `look.threads` overrides. */
export function threadCount(m: Milestone): number {
  if (m.look?.threads) return Math.max(1, Math.min(6, Math.round(m.look.threads)));
  let facets = 0;
  if (m.metrics.length) facets++;
  if (m.images.length || m.video) facets++;
  if (m.links.length) facets++;
  if (m.achievements.length) facets++;
  if (m.techStack.length) facets++;
  return Math.max(3, Math.min(6, 2 + facets));
}

/** 0 (cool, muted white — the beginning) → 1 (deep amber — the present). */
export function temperature(m: Milestone, index: number, total: number): number {
  if (typeof m.look?.temperature === "number") return Math.max(0, Math.min(1, m.look.temperature));
  return total <= 1 ? 0.6 : index / (total - 1);
}

/** The numeric part of a metric, for the counting animation: "23K+" → 23. */
export function metricNumber(value: string): { n: number; prefix: string; suffix: string } | null {
  const m = /^([^0-9]*)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(value.trim());
  if (!m) return null;
  const n = parseFloat(m[2].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return { n, prefix: m[1], suffix: m[3] };
}
