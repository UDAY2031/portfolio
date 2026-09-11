# Automatic film verification — 2026-09-10

## Automated integration checks

`node scripts/test-director.mjs`: **11 checks pass**. This samples the entire
345-second timeline at 30 Hz, seeks in both directions, and checks finite state,
room-camera continuity, complete reverse reveals, data-driven runtime extension,
blackout/silence/caption holds, hidden post-horizon HUD, looping, URL parsing,
pause/resume and invalid content. All tests are local and require no browser.

`tsc --noEmit`: pass. ESLint on all changed first-party modules: pass, no warnings.
Next.js 16.2.12 production build/static export: pass. The first sandboxed build
failed because Turbopack's CSS worker requires a local port; the same command
succeeded with permission to run its worker.

## Browser checks

Used the Codex in-app browser against the native static entry. Its exact browser/GPU
combination is not a controlled reference machine. `browser-checks.json` records
**42 completed UI-driven seeks**: 21 timestamps at each of high and low quality.
They cover the approach, crossing, black hold, title, fall, formation, every room,
release, return silhouette, both closing lines, and loop boundary.

No console errors were reported during those checks. Screenshots at t=20, 88, 120,
215, 307 and 325 record key compositions (developer controls are visible).
Each stage was reached with the real exact-time control, not by mutating internal
runtime state. These checks establish correct reconstruction/rendering at sampled
states, not a pixel-perfect cinematic certification of every intervening frame.

Context-loss check: seek Innovation at 215 s, press “Lose context”, observe holding
status, press “Restore context”; the time remains **215 s** and the room remains
**Innovation**. No console errors after restoration. The developer controls work
while the GL context is unavailable. An actual spontaneous driver reset remains
hardware-dependent.

Playback check: play from 344.99 s and observe Act I at 0.23 s; no new scene load,
caption, or loading overlay. The seam is mathematically covered by identical black
endpoints and checked with playback across the boundary. A subjective assessment
of multiple complete 5:45 screenings is still appropriate.

## Performance observations

At the default 1280×720 viewport the available browser typically reported around
60 FPS on Archive held shots. High-quality instrumentation showed roughly 87–91
draw calls, and the exterior release about 139, including postprocessing/shadow
passes. Allocated instanced architecture/strands: 36,114; dust is additional
(8,000 high / 4,500 medium / 1,800 low).

At a requested 2560×1440 viewport, high quality reported about **20–30 FPS**, so the
60 FPS acceptance target is **not met here**. These are observed live debug readings,
not a statistically controlled GPU benchmark. No claim is made that they predict
performance on a particular mid-tier discrete GPU. Automatic quality selection and
manual tiers are implemented; high quality is not certified at 1440p. The temporary
viewport override was reset after testing.

## Known implementation boundaries

- WebGPU is not implemented. The starting repository had only WebGL/GLSL; this
  revision retains that core and one active WebGL 2 renderer.
- Temporal accumulation is limited to held shots; moving shots use depth-derived
  blur. Paused screenshots bypass history for reproducibility.
- Local depth-neighbour occlusion is a lightweight approximation of SSAO, not a
  full multi-scale SSAO implementation. The soft shadow key uses Three's VSM.
- The LOD book atlas is procedural and small; there is no KTX2/Basis compression
  pipeline. Shelf geometry recurs around the corridor with cullable depth slices,
  rather than allocating full-detail books on all six faces of every outer cell.
- The formation uses directional star samples transported to projected rib
  segments. It is shader-based geometric alignment, not a simulated identity for
  every individual star transforming into one individual bookcase edge.
- Browser autoplay can suspend the score until an incidental gesture. The film
  does not require a gesture and keeps its master time; audio joins that time.
- All ten rooms use the supplied, sourced data. Only Innovation currently has
  supplied imagery; no fictional project screenshots or achievements were added.

## Visitor input and narrow screens

At frozen t=120 with no debug query, the developer-controls region is absent.
Sending the `1` key and scrolling produced a **byte-identical screenshot** before
and after; the authored camera did not move. Console errors: none.

A 390×844 viewport check exposed the need to reflow the world-space reveal. The
plane now uses a portrait text layout and fits the camera's horizontal field of
view; typography and metrics remain visible without horizontal clipping. The
result is recorded in `mobile.png`. No console errors. Viewport override reset.
