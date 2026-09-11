import { clamp, ramp } from './ease.js';

export const APPROACH_END = 70;
export const CROSSING_END = 95;
export const ARCHIVE_START = 110;
export const ROOM_DURATION = 19;
export const RELEASE_DURATION = 45;
export const HORIZON_CUT = 84;
export const ARCHIVE_NOTE = 109;

export function roomBeat(t) {
    return {
        tension: ramp(t, 2, 7) * (1 - ramp(t, 14, 17.5)),
        reveal: t < 14 ? clamp(t - 4, 0, 8) : clamp(8 - (t - 14) * 1.6, 0, 8),
    };
}

/** Shared by the Director and AudioWorklet, including every reverb return. */
export function scoreEnvelope(t, releaseStart) {
    if (t >= HORIZON_CUT && t < ARCHIVE_NOTE || t >= releaseStart + 21) return 0;
    if (t < HORIZON_CUT) return ramp(t, 0, 3);
    return ramp(t, ARCHIVE_NOTE, ARCHIVE_NOTE + 4) * (1 - ramp(t - releaseStart, 12, 21));
}

// The same world-space field on either side of a camera-cell boundary.
// A particle only wraps at +/-30m, where its edge fade is already zero.
export function dustZ(seedZ, cameraZ) {
    return cameraZ + (((seedZ - cameraZ + 30) % 60) + 60) % 60 - 30;
}
