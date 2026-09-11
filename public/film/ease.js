export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const cubic = x => (x = clamp(x)) < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
export const expo = x => (x = clamp(x)) === 1 ? 1 : 1 - 2 ** (-10 * x);
export const ramp = (t, a, b) => cubic((t - a) / (b - a));
export const mix = (a, b, t) => a + (b - a) * t;
export const pulse = (t, a, b, c, d) => ramp(t, a, b) * (1 - ramp(t, c, d));
export const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// Smooth deterministic gradient noise; no mutable RNG or per-object clock.
export function noise(t, seed = 0) {
    const i = Math.floor(t), f = t - i, u = f * f * f * (f * (f * 6 - 15) + 10);
    return mix((hash(i + seed) * 2 - 1) * f, (hash(i + seed + 1) * 2 - 1) * (f - 1), u) * 2;
}
