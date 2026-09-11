# The Archive redesign — before / after

_Preserved so the reasoning survives its authors. See spec §4._

## Before (the tesseract lattice, 2026-08)

The fourth-dimension space was a literal nested-cube construction: a strictly
periodic lattice of striated beam bundles on every grid crossing of all three
axes, wall slabs on shared cell faces, forty-two vertical "time threads", and
eight themed rooms with information mounted on their walls as HTML boards
(`WorldlineStructure.tsx`, `TimeThreads.tsx`, `Rooms.tsx`, `Library.tsx`,
`SkillsConstellation.tsx` — all retired in this pass).

It was technically faithful and it read as **clutter**:

- Every edge competed for attention at once. A hypercube net has no hierarchy,
  so the eye had nothing to rest on and nothing to travel toward.
- Depth was carried by geometry density rather than by light. More lines in
  the distance made the far field *busier*, not deeper.
- Rooms differed by changing the entire wall language (bookshelves, star
  charts, telemetry…), so the sequence read as ten different levels instead of
  one continuous structure.
- Content arrived as boards — cards floating in space — which is website
  chrome wearing a costume.

## After (the Archive, 2026-09)

**Fewer, larger, deliberately composed structural elements with depth
separation and negative space.**

- **3–5 large architectural frames per room** — cathedral ribs / ship-hull
  frames in brushed bronze and aged wood — plus four long stringers running
  the whole structure so ten rooms read as one vessel. `Frames.tsx`.
- **Depth through fog and light falloff, not geometry.** Exponential fog at a
  density that makes the next room a silhouette and the one after it a hint;
  distant frames are lit only along a hairline inner edge. Two LOD levels per
  frame (`Detailed`): joints and edge bead near, silhouette far.
- **One dominant light source per room** — a suspended emissive slab and the
  point light it casts. Everything else falls into shadow. Infinite reads as
  "I can't see the edges", not "there are edges everywhere". `RoomLight.tsx`.
- **Volumetric light-threads (3–6 per room) as the only mechanic.** One
  instanced draw; a slow noise waver; on approach a thread brightens, held it
  slows, straightens and pulls taut toward the camera; bent, it *becomes* the
  delivery mechanism for the room's memory. Released, the waver resumes and
  the memory reverses. `Threads.tsx`, `state.ts`.
- **Rooms differ only by colour temperature and thread density.** Cool muted
  white at the beginning ramping to deep amber at the present; density follows
  how many facets a memory has. Same frames, same materials, one structure.
- **Content assembles along the thread**, on a thin holographic plane drawn by
  a procedural line-draw shader (not a PNG fade), in a fixed order with a
  ≥600 ms stagger: title → description → achievements → metrics (counting up)
  → image / video → tech chips → links. `Reveal.tsx`.
- **The camera never leaves a fixed spline**; wheel, touch-drag and arrow keys
  nudge the drift, the cursor leans the view, an engaged thread holds it.
  `CameraRig.tsx`, `path.ts`.

## What to keep in mind when extending it

- Add mass with light, not with lines. If a room needs more presence, warm its
  temperature or add a thread — never a second light or more frames.
- The plane is not a card. It has no border chrome of its own beyond the
  shader's drawn edges; the DOM inside is typography only.
- Anything a visitor must *click* is a smell. The one exception is the links
  stage of a fully assembled memory.

## Automatic film revision — September 2026

The active film supersedes the interaction details above. Those paragraphs record
the previous design; `public/film/` now implements the sequence.

Before: nested cubes and equal-weight lines flattened depth; later, isolated
cathedral ribs gave the eye rest but did not express a recursive library.

Now: the corridor is wrapped in the same shelf module, rotated onto walls,
ceiling and underside. Books, boards and bronze ribs are separately instanced and
have separate release cues. A 7×7 cross-section continues outside the corridor;
distant detail is suppressed by light falloff, fog and LOD. Dark gaps remain the
compositional anchor. The camera's release shot opens those sightlines by reducing
interior fog, then thickens it as the structure disappears. A camera-area source
makes the nearest materials readable; there is no ambient wash.

The strand is now pulled by a Director cue, not a pointer. Text and media assemble
on a real world-space plane. A 19-second room beat gives four seconds of approach,
three seconds of strand formation, seven seconds of reveal/hold and five seconds
of departure. Reverse reveals finish completely at the room boundary. Position
and look-at splines meet continuously; no wheel, touch or orbit handler can move
the camera. A single master timestamp drives light, camera, dust, counters,
procedural grain, video frames and audio.

The first still-frame review found a central glow caused by an instanced shaft
shader omitting `instanceMatrix`. That was corrected rather than masking it with
more fog. The exterior review found that interior-density fog hid the whole
structure on pullback; a separate authored exterior fog cue now preserves the
wide reveal. Neither adjustment changes quality-dependent fog or bloom.

## v3 — scroll-controlled maze (September 2026)

The current entry now uses `tesseract.js`; `archive.js` and `reveals.js` retain the
prior corridor implementation for reference only. The v3 brief supersedes automatic
playback and the straight spline.

Hassan Syr's demo and article establish the useful construction principle: start
with a plus, surround it by six pluses, repeat a finite volume, and shift that volume
rather than allocating a new world during travel. The new implementation uses that
principle with a seeded world-space route, six possible room entry faces, rolls,
vertical legs and corner turns. Generation raycasts repeated structural arms to reject
room placements with direct sightlines.

`latticeGroup` wraps; room groups never do. Cell-local folds happen entirely in the
vertex shader. Their geometry is quarter-turn symmetric, including emissive channels,
so a completed fold joins the next stable state without a geometry reset. Emissive
channels share the PBR material rather than a duplicate mesh: one structural draw
call at all lattice sizes.

The straight corridor's canvas text was replaced with anchored DOM typography. This
is deliberately outside bloom, grain, chromatic aberration and camera motion blur.
The dark reading plane, a stationary reading plateau and reduced camera noise make
long publications and patent details usable. No content is invented in render code.

Current limits to assess on target hardware: four-arm star transport, procedural
interiors, radius/light falloff instead of a book-atlas LOD, and hardware-specific
performance. The full source and manual acceptance instructions are in the README.
