# GARGANTUA

A visual, interactive archive. The existing Schwarzschild raytracer and HDR post chain lead into a large shelf lattice with six physical memory rooms.

## Run

```sh
npm run prepare:film
npm run film
```

Open `http://127.0.0.1:4173/`. Native ES modules and local Three.js require no bundler. The Next.js wrapper can also be built with `npm run build`; it statically exports the same experience.

## Explore

- Scroll to descend toward the black hole. The velocity is damped and capped; sustained deliberate input covers the approach in roughly 14 seconds. After three quiet seconds a very slow drift continues.
- Scroll or use arrows to request the next/previous room immediately. Stay indefinitely. There are no reading locks or minimum dwell times.
- Each room journey takes 5.5 seconds. Further input in the same direction does not accelerate it. Opposite input decelerates and reverses it. Space skips travel with a 0.8-second ease; during entry it skips to College.
- Move the pointer to look around gently at rest. Click a book/board to advance its contents; `[` and `]` select the previous/next content surface. Click a playing monitor to reveal its project details and click again to return to the demo. Skill spines respond to hover and click.
- Press F to fold the lattice. Sound is optional and begins after a user gesture. The score is original synthesis, not a film recording.
- Touch devices use swipes and a landscape prompt. Orientation and tab visibility preserve journey state.

## Data and authored paths

`resources/journey.json` is the source of truth, copied to `public/resources` by `prepare:film`. Each room has `pages`, a physical `kind` (slate, skills, monitor, report, plaque, book, patent or glass), and optional video, poster, metric and link. Data contains College, Experience, Projects, Recognition, Patents & Publications, and Present. AURIZE uses **23K+ users**. The author confirmed **two publications**.

Room `layout.position` and `layout.rotation` place its interior in world space. `travelToNext` supplies a unique spline, dominant axis, FOV, roll and look-ahead. The five current segments descend, sweep laterally, spiral upward, approach the library, and pause for a fold. Additional rooms extend the timeline automatically; author their layout and travel control points to preserve composed pacing.

Project videos are local, silent H.264 baseline MP4s with fast-start metadata. The local server supports byte ranges. Video elements have muted/playsinline/autoplay attributes, remain attached for decoding, use `VideoTexture`, and loop independently of navigation. Posters cover failed playback. Video does not lock travel.

## Structure

- `public/film/navigation.js`: approach, committed entry, immediate room agency, interruptible segments, explicit terminal OUTRO.
- `maze.js`: authored paths, camera poses and folding beats.
- `lattice.js`: instanced shelf masses, packed-spine shader, lit cells, superstructure and world wrapping. No freestanding emissive light rectangles.
- `diegetic.js`, `layout.js`, `read-anchors.js`, `interaction.js`: physical content, baseline layout, native SDF typography, collision/occlusion checks and interaction.
- `post.js`: retained HDR bloom/ACES/FXAA/grain/aberration pipeline; native-resolution text composite with room depth.
- `dynamic-resolution.js`, `mobile.js`: gradual pixel-count adaptation and orientation/visibility preservation.

The final room enters OUTRO explicitly. The lattice pulls back and dissolves, then silence and the two closing lines. The black-hole scene remains hidden for the entire outro and returns only when it has completed.

## Debug and verification

Use `?debug=1&t=125` or `?debug=1&phase=archive&room=3`. The exact-time field and scrubber are deterministic; progress and room IDs are exposed in the debug readout. `?seed=` retains deterministic procedural detail.

```sh
npm run test:film
npm run build
```

Tests cover immediate room departure, 30/60/144 Hz pacing, wheel magnitudes, reverse, skip, indefinite holds, approach duration, outro isolation, orientation pause, path distinction, dynamic-resolution recovery and atomic counter behavior. `docs/research/reference-study.md` records the visual study and its sources. Browser verification artifacts are in `docs/verification/`.

## Optional visitor service

`workers/visitors/` contains the Cloudflare Worker, D1 migration and transaction tests. It is **not deployed or enabled by default**. Set a real database ID and allowed origin, configure `HASH_SECRET` with Wrangler secrets, apply the migration, and route `/api/visitors*` to the Worker. Set `visitorCounter: true` in `resources/film.json` only after the endpoint works.

The insert trigger atomically counts accepted identities. Browser IDs are hashed; short-lived network hashes provide a backstop. Bot/preview user agents, origin checks, rate limits, DNT and GPC filtering precede counting. The client waits for four seconds of visible rendered frames. Failed requests use a cached total or hide the reading. This is an approximate browser count, not a verified count of people.

When enabled, the counter stores a random first-party browser identifier and a daily salted hash derived from the network address and browser string. Application code does not store or log raw IPs. No advertising or third-party analytics are added. Ephemeral network/rate-limit rows are pruned; hashed browser deduplication tombstones remain so returning browsers are not recounted after 90 days.

## Graphics scope

The established WebGL2 raytracer remains the render core. The environment uses dynamic resolution while content text stays native resolution. Scene detail is held constant. Hosting improves delivery; it does not render on the visitor’s behalf or guarantee universal frame rate.

The broader requested quality ceiling is not all present: there is no WebGPU port, velocity-buffer TAA, GTAO, SSR, PCSS cascade implementation, KTX2/POM asset pipeline or mastered 4K streaming fallback. Current spatial AA, camera blur and VSM travel shadows are the actual implemented features. Device-specific Safari/Firefox and physical mobile thermal testing require those devices; do not infer them from a Chromium viewport simulation.
