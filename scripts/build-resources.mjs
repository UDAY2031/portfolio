#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// The Archive is data-driven. This script runs before `dev` and `build` and
// materialises /resources into the static bundle:
//
//   resources/milestones/<id>.json  → one room each (schema: resources/README.md)
//   resources/media/<id>/*          → that room's images / video / models
//
// Output (fully generated — never edit by hand):
//   public/resources/manifest.json  → what the Archive fetches at load
//   public/resources/media/<id>/*   → media, served as-is
//
// Adding a milestone = drop a JSON file (and media folder). No render code
// is touched; the scene instantiates rooms and threads from the manifest.
// ─────────────────────────────────────────────────────────────────────────────

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "resources");
const MILESTONES = path.join(SRC, "milestones");
const MEDIA = path.join(SRC, "media");
const PUB = path.join(root, "public", "resources");

const REQUIRED = ["id", "order", "title", "description", "dateRange"];
const LISTS = ["metrics", "images", "techStack", "links", "achievements"];
const MEDIA_FILE = /\.(png|jpe?g|webp|gif|avif|svg|mp4|webm|mov|glb|gltf|pdf)$/i;

let failed = false;
const fail = (msg) => { console.error(`✗ ${msg}`); failed = true; };

// public/resources is generated in full every run
rmSync(PUB, { recursive: true, force: true });
mkdirSync(path.join(PUB, "media"), { recursive: true });

const milestones = [];
const seenIds = new Set();
const seenOrders = new Set();

if (existsSync(MILESTONES)) {
  const files = readdirSync(MILESTONES).filter((f) => f.endsWith(".json") && !f.startsWith("_") && !f.startsWith(".")).sort();
  for (const file of files) {
    let m;
    try {
      m = JSON.parse(readFileSync(path.join(MILESTONES, file), "utf8"));
    } catch (err) {
      fail(`resources/milestones/${file} is not valid JSON: ${err.message}`);
      continue;
    }
    for (const key of REQUIRED) {
      if (m[key] === undefined || m[key] === null || m[key] === "") fail(`${file}: missing required field "${key}"`);
    }
    if (typeof m.order !== "number") fail(`${file}: "order" must be a number`);
    if (seenIds.has(m.id)) fail(`${file}: duplicate id "${m.id}"`);
    if (seenOrders.has(m.order)) fail(`${file}: duplicate order ${m.order}`);
    seenIds.add(m.id);
    seenOrders.add(m.order);
    for (const key of LISTS) {
      if (m[key] === undefined) m[key] = [];
      else if (!Array.isArray(m[key])) fail(`${file}: "${key}" must be an array`);
    }
    if (m.video === undefined) m.video = null;

    // media: copy the milestone's folder, resolve relative references
    const mediaDir = path.join(MEDIA, m.id);
    const available = new Set();
    if (existsSync(mediaDir)) {
      for (const f of readdirSync(mediaDir)) {
        if (f.startsWith(".") || !MEDIA_FILE.test(f)) continue;
        available.add(f);
        const to = path.join(PUB, "media", m.id, f);
        mkdirSync(path.dirname(to), { recursive: true });
        cpSync(path.join(mediaDir, f), to);
      }
    }
    const resolve = (ref, what) => {
      if (typeof ref !== "string") { fail(`${file}: ${what} entries must be strings`); return null; }
      if (/^(https?:)?\/\//.test(ref) || ref.startsWith("/")) return ref;
      if (!available.has(ref)) fail(`${file}: ${what} "${ref}" not found in resources/media/${m.id}/`);
      return `/resources/media/${m.id}/${ref}`;
    };
    m.images = m.images.map((r) => resolve(r, "images")).filter(Boolean);
    if (m.video) m.video = resolve(m.video, "video");

    milestones.push(m);
  }
}

milestones.sort((a, b) => a.order - b.order);

if (!milestones.length) console.warn("! no milestones found under resources/milestones — the archive will open quiet");

writeFileSync(
  path.join(PUB, "manifest.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), milestones }, null, 2) + "\n"
);

if (failed) {
  console.error("resources → manifest written with errors above");
  process.exitCode = 1;
} else {
  console.log(`resources → ${milestones.length} milestone room(s) manifested`);
}
