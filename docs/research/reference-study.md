# Tesseract reference study — 11 September 2026

## Finding

The main mismatch was a material and lighting problem, not a lack of recursive edges. The old archive illuminated almost every edge equally. The reference hides most edges and shows tightly packed, striated shelf surfaces only where directional light reaches them. Its large, nearly white apertures are spatial landmarks. Repetition is readable because the spaces between them remain dark.

## Evidence and provenance

- **Live visual inspection:** [Dotpro tesseract](https://dotpro-project.netlify.app/). Inspected the entry view and its exposed controls: WASD, vertical movement, and P to fold. The initial view is a dark frontal corridor, with densely lined shelf masses on the sides and ceiling and warm pools along lower horizontal members. The five user-supplied images provide additional upward and oblique viewpoints. Images 1, 2, 4 and 5 are reference evidence; image 3 is the rejected previous build. This is visual observation, not access to the reference’s shaders or scene graph.
- **Author’s account:** [Hassan Syr, “I spent 4 months recreating the most impossible scene in Interstellar”](https://medium.com/@hassan.syr8810/i-spent-4-months-recreating-the-most-impossible-scene-in-interstellar-25dc6d08798a). The author describes a plus-shaped starting module, repetition along the six axis directions, and replacing repeated spawning with a fixed grid that follows the observer. Much of the remaining work concerned shaders and textures. These statements support the module and wrapping strategy. They do not establish the exact light intensities, shader implementation, or dimensions of the reference.
- The source is sold separately by its author. No commercial source, textures, music, or film assets were copied. Geometry, procedural shelf shading, camera path, and score in this repository remain original.

## Translation into this build

| Observed property | Implementation decision | Verification criterion |
| --- | --- | --- |
| Dense shelf surfaces, fine vertical striation | Packed procedural spines, shelf-board bands, leather colour variation and wood grain on the solid arms | Slabs should read as filled architecture, not luminous outlines |
| White light entering from a few directions | Sparse emissive apertures, area lights, camera-offset key | Light direction should remain apparent, with most of the frame dark |
| Repetition obscured by darkness | Exponential distance fog and a camera-centred 13³ instance pool | No visible outer boundary |
| Impossible orientation | Seeded room orientations and rounded paths through different axes; two entry folds | No straight tunnel joining all rooms |
| Motion reveals more than a still | Authored descent and fixed-duration inter-room travel | A large wheel event must not accelerate the shot |
| Reference has no portfolio text | A separate reading grammar is required | Settle at a physical surface, stop environmental motion, keep type out of bloom |

The shelf shader is an original procedural approximation, not a recovered version of the reference. The reference’s apparent depth could come from geometry, parallax, textures, or a combination. That cannot be established from screenshots alone. Claims of exact shader equivalence would be unsupported.

## Readability and rendering sources

[Troika’s official text documentation](https://protectwise.github.io/troika/troika-three-text/) describes signed-distance-field text integrated with Three.js materials and explicitly requires synchronizing changed text properties. The implementation vendors Troika and its dependencies locally, shares local fonts, synchronizes changed text, and disposes text when a room is unloaded. It does not load a remote font service.

Text is composited at the drawing buffer’s native resolution after the lower-resolution environment’s bloom, grain, aberration and tonemapping. A depth-only pass of the opaque room objects preserves occlusion. Transparent shafts must not enter that depth pass: treating them as opaque was a verified source of missing letters during implementation.

[Three.js RectAreaLight documentation](https://threejs.org/docs/#api/en/lights/RectAreaLight) is the basis for physical screen/aperture lighting. Area lights are not represented as a promise of shadow-casting area lights: the separate key uses the renderer’s VSM shadow path.

## Navigation and state

Wheel delta is reduced to its sign. One accepted gesture creates a 6.5-second segment. Events during the segment are discarded, not queued. A 400 ms quiet period and 600 ms post-arrival cooldown prevent trackpad inertia from creating a second trip. Page-local content animation runs after arrival; videos use their own media playback clock and lock navigation without tying playback to wheel input.

The post-warp blackout is a real renderer clear. Eyelids are a shader aperture; the subsequent descent, folds, camera arrest, and approach are deterministic timeline functions. The loop preserves the original star seed.

## Quality limits and uncertainty

Hosting delivers assets; the browser GPU renders the experience. Dynamic resolution cannot fix every CPU or geometry bottleneck and cannot guarantee 60 FPS on every phone. The current maximum scene has 13³ cells and 40,000 dust instances; text remains native resolution. The existing WebGL2 raytracer is preserved. A WebGPU renderer, GTAO, SSR, full motion-vector TAA, PCSS cascades, KTX2/POM textures and a mastered 4K HLS fallback must not be advertised as implemented merely because they appear in the requested quality ceiling.

## Counter research

[Cloudflare’s D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) documents transactional batch execution. The counter uses a single batch and a SQLite insert trigger: an accepted, unique visitor row causes exactly one atomic increment. UUID deduplication and the network backstop are checked in the same database operation. The implementation does not use eventually consistent KV.

The requested 90-day deletion of browser identities conflicts with indefinite deduplication: deleting an identity allows that browser to count again later. This implementation retains hashed browser deduplication tombstones while pruning ephemeral network and rate-limit records. The total is never decremented. Shared networks, storage clearing, and spoofed browser identity still prevent an exact count of people; the résumé describes the metric as approximate.

## Content decisions

The author explicitly confirmed that two publications are sufficient. All current counts use two. The supplied second patent status is preserved as “In preparation, 2026”; it is not promoted to a grant. The existing publisher-linked VisuWeave record uses publication year 2026, which differs from the user’s 2025 conference-era date. Exact project repository URLs were not supplied; the available GitHub profile is labelled as a profile instead of inventing repository links.
