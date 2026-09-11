# GARGANTUA — An archive beyond time

A scroll-driven journey through a Schwarzschild black hole and an impossible archive.
Enter once to unlock sound. Wheel, trackpad, touch drag, or arrow/Page keys control
forward and backward progress along an authored route. Stop to read. There is no free
steering, pointer lock, or public developer HUD.

## Run locally, without a build

```sh
npm run film
# http://127.0.0.1:4173/film/index.html
```

A generic static server can serve `public/`. Three.js and postprocessing are local
native ES modules under `public/film/vendor/`, with their licenses. No CDN or bundler
is needed. The existing Next.js root embeds that same entry and forwards query
parameters; `npm run dev` and `npm run build` remain supported.

After changing data, run `npm run prepare:film` to validate and copy the manifest/media
into `public/resources/`. This copies assets; it does not compile source.

## Scroll, timeline, and scenes

`ScrollDirector` extends the existing six-act sampler. Progress, in `[0,1]`, maps to
its time coordinate: `t = progress * duration`. Time is an editing coordinate rather
than an autoplay promise. Ten rooms give 345 seconds of authored material. Adding a
room adds 19 seconds and a proportional amount of scroll travel.

| Source | Responsibility |
| --- | --- |
| `public/film/scroll-director.js` | Wheel-unit normalization, bounded input, touch momentum, keyboard access, frame-independent damping, idle drift and exact seeks. |
| `public/film/director.js`, `timing.js`, `ease.js` | Pure act state, shared easing, narrative, stagger/reversal and silence gates. |
| `public/film/maze.js` | Seeded snapped room positions, occlusion raycasts, cell-corner routes, Catmull–Rom travel, arbitrary entry faces, roll, FOV and restrained camera drift. |
| `public/film/lattice.js`, `lattice-geometry.js` | Seven plus modules per cell, 84 boxes per cell, fixed instancing, exact six-metre wraps, distance falloff and shader folds. |
| `public/film/tesseract.js`, `rooms.js`, `atmosphere.js` | Anchored interiors, opening portals, soft key light, strands, instanced dust and release overview. |
| `public/film/memory.js` | Selectable DOM content, counters, links, lazy room media and progress-driven reveals. Outside all post effects. |
| `public/film/main.js`, `post.js` | One existing WebGL renderer and HDR composer, adaptive quality, debug controls and context recovery. |
| `public/film/audio*.js` | Original piano-like ostinato, organ pad and analytic tails; progress controls the mix and hard silence gates. |

The original Schwarzschild integration and disk shader remain shared with the retained
React `BlackHole.tsx`. The iris and star transport extend that shader. The arrival
projects real lattice-arm endpoints into the existing starfield; its samples contract
into amber arm shells, while the camera travels through the lattice before the first
room. There is no second renderer, video transition, or second star particle system.

| Act | Ten-room authored interval |
| --- | --- |
| Approach | 0–70; instrumentation fades at 60–68 |
| Crossing | 70–95; iris, true black/silence at 84, title and dissolve |
| Fall | 95–110; radial streaks condense onto structural arms |
| Archive | 110–300; ten rooms, each with approach, reveal, reading plateau, and departure |
| Release | 300–340; overview of anchored rooms, releasing strands, outward dust, fading structure, distant black hole and two closing lines |
| Loop | 340–345; black and silence, then the identical opening starfield |

Every visual state is sampled from progress, including folds and reverse reveals.
The only integrated values are input progress/velocity. A slow idle advance starts
after 2.5 seconds without input, except on a reading plateau: text stays put until
the visitor continues. Camera drift drops to one quarter while content is present.
Audio oscillators continue while reading; their mix follows progress, so scrolling
backward restores the correct stem gains without restarting the music.

## The reference and the redesign

Visual reference: [Hassan Syr's tesseract demo](https://dotpro-project.netlify.app/).
Technique reference: [his making-of article](https://medium.com/@hassan.syr8810/i-spent-4-months-recreating-the-most-impossible-scene-in-interstellar-25dc6d08798a).
Both were inspected for this revision. This implementation uses original procedural
geometry, materials, shaders and music; no commercial source package or reference
assets were copied.

Before: a straight bookshelf corridor, with four-metre slices and canvas-texture
content. After: a plus-based volume surrounding a seeded, turning route; rooms occupy
independent world coordinates and entry faces. Lattice geometry wraps in exact `S=6`
steps; room groups and their content never wrap. A cell-local fold sweeps outward
using a quartic shader rotation. The plus motif and its inlaid strips are symmetric
under a quarter-turn, avoiding a snap when the next fold starts.

A high-tier lattice contains 61,236 structural instances in **one PBR draw call**.
Emissive inlays are part of that material, avoiding duplicated glow geometry. Medium
uses 7³ cells; low/mobile uses 5³. Nothing is spawned during navigation. Outer rings
lose detail in light falloff and fog, with a smooth distance envelope hiding the wrap
boundary. Near rooms clear the surrounding structural cells to frame the interior.

Full rationale and current tradeoffs: `docs/tesseract-redesign.md`.

## Content and room themes

Edit `resources/journey.json`; its schema is `resources/journey.schema.json`.
Fields: `id`, `order`, `title`, `year`, `place`, `theme`, `description`, `metrics`,
`images`, `video`, `techStack`, `links`, `accent`; optional `achievements`, `empty`,
and source provenance. Existing resume-backed facts remain in the manifest.
Identity and original closing text live in `resources/film.json`.

Preserved design direction:

> from the given web: do place the rooms at some random place and each room should
> look different — like for projects use some different UI/UX like a computer lab /
> tech lab or office sort. for publication / patents need to be like a library sort of.
> for skills / info — do use the best recommendation.

| Room | Theme | Reason |
| --- | --- | --- |
| College | `study` | A desk, reading lamp and books suggest the first place of learning. |
| First Hackathon | `workshop` | Shared workstations place the build under pressure in a collaborative setting. |
| Competitions | `arena` | A small display of podium-like objects recalls the competitive milestone. |
| Recognition | `gallery` | Quiet plinths and wall exhibits frame awards without inventing branded trophies. |
| Research | `library` | Ordered shelves and a reading desk support publications and long-form reading. |
| Innovation | `patent-library` | The library gains a mechanical study model for the patent work. |
| Products | `tech-lab` | Workstations and original procedural screen graphics represent shipped software. |
| Systems | `infrastructure` | Recessed rack equipment conveys interconnected software/hardware systems. |
| Professional | `office` | A restrained workspace focuses attention on engineering outcomes. |
| Future | `empty` + `empty:true` | The same architectural shell, with no furniture, books or content overlay. |

For a skills/info room, `study` is the default recommendation: its calm backdrop suits
reading and groups of skills without suggesting an unsubstantiated project or award.
Use one of the existing themes when adding a room; its path and scroll length grow
automatically. Assets belong under `resources/media/<id>/`; the patent-filing image
is a populated local example. External videos are optional, load on room entry, and
seek to progress-derived frames. Failed media is hidden while all text remains usable.

## Developer controls and captures

- `?p=0.67826087&seed=2031` reconstructs and freezes a deterministic progress value.
- `?t=234` remains supported for authored-time captures.
- `?phase=archive&room=06-innovation` selects a room by id; numeric order works too.
- `?debug=1` exposes exact progress/time, scrubber, act/room, FPS, CPU/GPU timings,
  draw calls, instance counts, wrap offset, quality, bounds and context tools.
- Debug only: Space/C toggles idle playback; R restarts; 1–4 jump acts; 5/D toggles
  bounds; P previews a fold from the current progress; H hides controls; M mutes.
- `?quality=high|medium|low` pins quality; `?idle=0` disables idle advance.

Text uses a blurred `#0b0906` backing at 86% opacity. Body text is at least 16px
(22px on the large-screen layout), independently selectable, with clickable external
links. Long content scrolls inside the reading surface; reaching its end passes wheel
input back to the journey. Spatial FXAA replaces history accumulation on folding
geometry, preventing reverse-scroll ghosts. Fog and bloom remain enabled on all tiers.

The entry gesture starts Web Audio. The bottom-right sound glyph is the sole permanent
control. The score contains no film recording, sampled film music, or percussion.
Sub-bass is restricted to the approach and cut at the horizon. All sound, including
tails, is gated at the threshold and ending. Mute and quality preferences persist.

Context loss holds progress and pause state. Restoration rebuilds GL resources at the
same room. Reload recovery also stores the seed and normalized progress. Explicit
capture URLs take precedence over recovery storage. The visible restore tool remains
usable while the context is lost.

## Verification and limits

```sh
npm run test:film     # 15 existing timeline checks + 11 scroll/maze checks
npm run lint
npm run build        # optional Next static export, not required for the film
```

Evidence: `docs/verification/v3.md`. Browser checks cover every room forward/backward,
both quality extremes, readable 1080p/4K/mobile layouts and context restoration.
Physical trackpad/touch feel and the 60 FPS target on a specified mid-tier discrete GPU
still require target-device acceptance; a browser benchmark is not that certification.

The inherited renderer is WebGL 2; this repository has no existing WebGPU backend to
extend. No new WebGPU port is claimed. Interiors use procedural geometry rather than
photogrammetry. The arrival currently transports the four dominant visible arms, not
every distant arm. Lattice detail uses smooth light/radius falloff rather than a full
book-atlas LOD system. These are explicit implementation limits, not hidden fallbacks.
