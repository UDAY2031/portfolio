// Frame-rate-hot values shared between the DOM world (GSAP timelines) and the
// R3F render loop. Kept as plain mutable refs so per-frame updates never touch
// React state.

// Where the silent approach begins — Gargantua distant — and where the
// crossing takes over (world units from the hole, horizon radius = 1).
export const APPROACH_START = 34.0;
export const APPROACH_END = 26.5;
// After the Return the hole sits a little further away than at the start —
// time has passed; nothing says so.
export const RETURN_DISTANCE = 36.5;

// Smoothed pointer position (-1..1 each axis) — the "weightless float":
// wherever the cursor rests, the view leans gently toward it. Written by the
// active scene, read by the black-hole shader and the real camera alike.
export const look = { x: 0, y: 0 };

export const fall = {
  /** 0 → 1 progress of the silent approach (Phase 01) */
  approach: 0,
  /** 0 → 1 progress of the fall */
  progress: 0,
  /** unified crossing parameter, 0 → 1 across the whole horizon crossing —
   *  drives lens distortion, star streaking, audio and the final dissolve */
  crossing: 0,
  /** black-hole shader camera dolly (world units from the hole) */
  camDist: APPROACH_START,
  /** extra lensing / warp intensity, 0..1 */
  warp: 0,
  /** final engulf-to-black, 0..1 */
  black: 0,
  /** TARS structural shake, 0..1 */
  shake: 0,
};

// Phase 03 — the Threshold — and its mirror in the Return. All of it is
// animated on uniforms the raytracer already owns; nothing is composited.
export const thr = {
  /** iris-close: the lens itself compresses the image into the centre, 0..1 */
  iris: 0,
  /** light-speed star streaking through the same star field, 0..1 */
  streak: 0,
  /** 1 = the mass is in the field; 0 = pure starfield flight */
  hole: 1,
};

// Phase 04 — the Archive. Camera progress along the fixed spline and the
// state of the closing sequence. Lives here (not in React) so a WebGL context
// loss or a re-render never moves the visitor to a different room.
export const arch = {
  /** 0..1 arc-length progress along the room spline */
  u: 0,
  /** current drift velocity along the spline (units of u per second) */
  velocity: 0,
  /** 0..1 — the threads of the last room letting go, one by one */
  release: 0,
  /** 0..1 — dust dispersing outward as the structure recedes */
  disperse: 0,
  /** 0..1 — fog thickening until the architecture is gone */
  recede: 0,
  /** deterministic screenshot mode: waver, drift and twinkle stand still */
  freeze: false,
};

export const post = {
  /** chromatic aberration strength, 0..~0.01 */
  aberration: 0.0004,
  /** film grain */
  grain: 0.05,
};

export function resetFall(startDistance = APPROACH_START) {
  fall.approach = 0;
  fall.progress = 0;
  fall.crossing = 0;
  fall.camDist = startDistance;
  fall.warp = 0;
  fall.black = 0;
  fall.shake = 0;
  thr.iris = 0;
  thr.streak = 0;
  thr.hole = 1;
  post.aberration = 0.0004;
}

export function resetArchive(u = 0) {
  arch.u = u;
  arch.velocity = 0;
  arch.release = 0;
  arch.disperse = 0;
  arch.recede = 0;
}
