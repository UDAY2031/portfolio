import { Director } from './director.js';
import { clamp } from './ease.js';

export function normalizeWheel(delta, mode = 0, height = 900) {
    return clamp(delta * (mode === 1 ? 16 : mode === 2 ? height : 1), -240, 240);
}
/** Progress is the only scene clock. Input integration never owns scene animation. */
export class ScrollDirector extends Director {
    constructor(rooms, query, narrative) {
        super(rooms, query, narrative);
        this.seed = Number.isFinite(Number(query.get('seed'))) ? Number(query.get('seed') || 2031) : 2031;
        this.currentProgress = this.targetProgress = query.has('p') ? clamp(Number(query.get('p')) || 0) : this.t / this.duration;
        this.t = this.currentProgress * this.duration;
        this.paused = query.has('p') || query.has('t') || query.has('phase') || query.get('freeze') === '1';
        this.entered = this.paused || this.debug;
        this.velocity = 0;
        this.lastNow = null;
        this.lastInput = null;
        this.scrollLength = this.duration * 110;
        this.idle = query.get('idle') !== '0';
    }
    seek(t, now) {
        const p = clamp((Number.isFinite(t) ? t : 0) / this.duration, 0, 1 - 1e-9);
        this.currentProgress = this.targetProgress = p;
        this.t = p * this.duration;
        this.lastNow = now ?? null;
        this.lastInput = now ?? null;
        this.velocity = 0;
        return this.sample(this.t);
    }
    seekProgress(p, now) { return this.seek(clamp(p) * this.duration, now); }
    input(pixels, now) {
        if (!this.entered) return;
        this.paused = false;
        this.lastInput = now;
        this.targetProgress = clamp(this.targetProgress + pixels / this.scrollLength, 0, 1);
    }
    tick(now) {
        const dt = this.lastNow === null ? 0 : clamp((now - this.lastNow) / 1000, 0, .1);
        this.lastNow = now;
        if (this.lastInput === null) this.lastInput = now;
        const previous = this.currentProgress;
        if (!this.paused && this.entered) {
            // The quiet reading plateau never nudges someone past a paragraph.
            const reading = this.t >= 110 && this.t < this.releaseStart && this.sample(this.t).rt >= 7 && this.sample(this.t).rt < 14;
            if (this.idle && !reading && now - this.lastInput > 2500) this.targetProgress = clamp(this.targetProgress + .004 * dt);
            this.currentProgress += (this.targetProgress - this.currentProgress) * (1 - Math.exp(-8 * dt));
            if (this.targetProgress === 1 && this.currentProgress > 1 - 1e-6) this.currentProgress = this.targetProgress = 0;
        }
        this.velocity = dt ? (this.currentProgress - previous) / dt : 0;
        this.t = Math.min(this.currentProgress * this.duration, this.duration - 1e-7);
        const s = this.sample(this.t);
        s.progress = this.currentProgress;
        s.velocity = this.velocity;
        return s;
    }
    setPaused(value, now) { this.lastNow = now; this.lastInput = now; this.paused = value; }
    attach(element = window) {
        const interactive = e => e.target.closest?.('input,select,button,a');
        element.addEventListener('wheel', e => {
            if (interactive(e) || e.ctrlKey) return;
            const memory=e.target.closest?.('#memory');
            if(memory && ((e.deltaY>0 && memory.scrollTop+memory.clientHeight<memory.scrollHeight-2)||(e.deltaY<0 && memory.scrollTop>1)))return;
            e.preventDefault(); this.input(normalizeWheel(e.deltaY, e.deltaMode, innerHeight), performance.now());
        }, { passive: false });
        element.addEventListener('keydown', e => {
            if (interactive(e)) return;
            const delta = { ArrowDown: 100, ArrowUp: -100, PageDown: 700, PageUp: -700 }[e.key];
            if (delta === undefined) return;
            e.preventDefault(); this.input(delta, performance.now());
        });
        let touch = null;
        element.addEventListener('pointerdown', e => {
            if (e.pointerType !== 'touch' || interactive(e) || e.target.closest?.('#memory')) return;
            touch = { id: e.pointerId, y: e.clientY, at: e.timeStamp, speed: 0 };
            e.target.setPointerCapture?.(e.pointerId);
        });
        element.addEventListener('pointermove', e => {
            if (!touch || touch.id !== e.pointerId) return;
            const delta = touch.y - e.clientY, dt = Math.max(8, e.timeStamp - touch.at);
            touch.speed = clamp(delta / dt, -2, 2);
            touch.y = e.clientY; touch.at = e.timeStamp;
            this.input(clamp(delta * 2, -240, 240), performance.now());
        });
        const end = e => { if (!touch || touch.id !== e.pointerId) return; this.input(touch.speed * 140, performance.now()); touch = null; };
        element.addEventListener('pointerup', end);
        element.addEventListener('pointercancel', () => { touch = null; });
    }
}
