import { clamp, ramp, pulse, mix, cubic } from './ease.js';
import { roomBeat, scoreEnvelope } from './timing.js';
export function validateJourney(data) {
    if (!Array.isArray(data) || !data.length)
        throw new Error('The journey must contain at least one room.');
    const ids = new Set(), orders = new Set();
    for (const r of data) {
        for (const k of ['id', 'title', 'year', 'place', 'description'])
            if (typeof r[k] !== 'string')
                throw new Error(`Room ${r.id}: ${k} must be text.`);
        if (!Number.isFinite(r.order) || ids.has(r.id) || orders.has(r.order))
            throw new Error('Room ids and orders must be unique.');
        ids.add(r.id);
        orders.add(r.order);
        for (const k of ['metrics', 'images', 'techStack', 'links'])
            if (!Array.isArray(r[k]))
                throw new Error(`Room ${r.id}: ${k} must be an array.`);
        if(r.pages){
            if(!Array.isArray(r.pages)||!r.pages.length)throw new Error('A room needs a content surface.');
            for(const p of r.pages){
                if(typeof p.title!=='string'||typeof p.body!=='string'||!['slate','skills','monitor','report','book','patent','plaque','glass'].includes(p.kind))throw new Error('Invalid content surface.');
                if(p.video&&!/^(https:\/\/|\/resources\/media\/)/.test(p.video))throw new Error('Invalid surface video.');
                if(p.link&&!/^https:\/\//.test(p.link.url))throw new Error('Invalid surface link.');
            }
        }
        for (const m of r.metrics)
            if (typeof m.label !== 'string' || !['string', 'number'].includes(typeof m.value))
                throw new Error('Invalid metric.');
        for (const l of r.links)
            if (typeof l.label !== 'string' || !/^(https:\/\/|mailto:)/.test(l.url))
                throw new Error('Links must use https or mailto.');
        for (const src of [...r.images, ...(r.video ? [r.video] : [])])
            if (typeof src !== 'string' || !/^(\/resources\/media\/|https:\/\/)/.test(src))
                throw new Error('Media must use /resources/media/ or https.');
    }
    return [...data].sort((a, b) => a.order - b.order);
}
/** The only clock in the film. Consumers sample absolute t, never integrate dt. */
export class Director {
    constructor(rooms, query = new URLSearchParams(), narrative = {}) {
        this.narrative = narrative;
        this.rooms = validateJourney(rooms);
        this.releaseStart = 110 + 19 * rooms.length;
        this.duration = this.releaseStart + 45;
        this.acts = [['I · APPROACH', 0, 70], ['II · CROSSING', 70, 25], ['III · FALL', 95, 15], ['IV · THE ARCHIVE', 110, 19 * rooms.length], ['V · RELEASE', this.releaseStart, 40], ['VI · LOOP', this.releaseStart + 40, 5]].map(([name, start, duration]) => ({ name, start, duration, onEnter: () => { }, onUpdate: () => { }, onExit: () => { } }));
        this.debug = query.get('debug') === '1';
        this.paused = query.has('t') || query.get('freeze') === '1';
        this.offset = 0;
        this.origin = null;
        this.lastAct = null;
        const t = Number(query.get('t'));
        if (query.has('t') && Number.isFinite(t))
            this.offset = this.normalize(t);
        else if (query.has('phase')) {
            const phase = query.get('phase');
            const i = this.rooms.findIndex(r => r.id === query.get('room') || String(r.order) === query.get('room'));
            this.offset = ({ void: 20, approach: 20, crossing: 77, threshold: 89, fall: 102, archive: 110 + 19 * Math.max(0, i) + (query.get('reveal') === '0' ? 2 : 10), return: this.releaseStart + 22, release: this.releaseStart + 8, loop: this.releaseStart + 42 })[phase] ?? 0;
        }
        this.t = this.offset;
    }
    normalize(t) { return Number.isFinite(t) ? ((t % this.duration) + this.duration) % this.duration : 0; }
    seek(t, now) { this.offset = this.normalize(t); this.t = this.offset; this.origin = now ?? null; return this.sample(this.t); }
    tick(now) { if (this.origin === null)
        this.origin = now; this.t = this.normalize(this.offset + (this.paused ? 0 : (now - this.origin) / 1000)); const s = this.sample(this.t); if (this.lastAct !== s.act) {
        this.lastAct?.onExit();
        s.act.onEnter();
        this.lastAct = s.act;
    } s.act.onUpdate(s.p); return s; }
    setPaused(value, now) { this.seek(this.t, now); this.paused = value; }
    sample(t) {
        t = this.normalize(t);
        const r = t - this.releaseStart;
        const act = this.acts.find(a => t >= a.start && t < a.start + a.duration) || this.acts[0];
        const local = clamp(t - 110, 0, 19 * this.rooms.length - .000001), room = Math.min(this.rooms.length - 1, Math.floor(local / 19)), rt = local - room * 19;
        const motion = rt < 4 ? mix(-5, 0, cubic(rt / 4)) : rt < 14 ? 0 : mix(0, 7, cubic((rt - 14) / 5));
        // Room spacing is 12: prior departure ends at +7, next approach begins at -5.
        const path = room * 12 + motion;
        const s = { t, act, p: clamp((t - act.start) / act.duration), room, rt, path, archive: t >= 105 && r < 18, hud: pulse(t, 1, 5, 60, 68), distance: mix(38, 20, ramp(t, 0, 70)), height: mix(.28, 4.5, ramp(t, 0, 70)), warp: 0, iris: 0, streak: 0, hole: 1, black: 1 - ramp(t, 0, 3), caption: '', captionSub: '', captionAlpha: 0, release: clamp(r / 14), r, reveal: roomBeat(rt).reveal, formation: ramp(t, 105, 110), sound: 0 };
        if (t >= 70 && t < 95) {
            s.distance = mix(20, 1.08, ramp(t, 70, 83));
            s.height = mix(4.5, .05, ramp(t, 70, 83));
            s.warp = ramp(t, 70, 79);
            s.iris = ramp(t, 79, 84);
            s.black = t >= 84 ? 1 : 0;
            s.hud = 0;
            s.caption = this.narrative.title || '';
            s.captionSub = this.narrative.subtitle || '';
            s.captionAlpha = .6 * pulse(t, 85.5, 87, 90, 91.5);
        }
        if (t >= 95 && t < 110) {
            s.distance = 18;
            s.warp = 0;
            s.hole = 0;
            s.iris = 0;
            s.black = 1 - ramp(t, 95, 96);
            s.streak = pulse(t, 95, 101, 105, 108.5);
        }
        if (r >= 0) {
            s.hud = 0;
            s.distance = mix(50, 38, ramp(r, 35, 45));
            s.height = mix(2, .28, ramp(r, 35, 45));
            s.hole = ramp(r, 16, 20);
            s.streak = pulse(r, 15, 17, 18, 21);
            s.iris = 1 - ramp(r, 17, 21);
            s.black = r < 17 ? 1 : 0;
            s.caption = (this.narrative.closing || [])[r < 29 ? 0 : 1] || '';
            s.captionAlpha = .46 * (pulse(r, 22, 23.5, 27, 28.5) + pulse(r, 30, 31.5, 35, 36.5));
            s.black = Math.max(s.black, ramp(r, 20.5, 22));
        }
        // Score including reverb is hard gated after the iris closes and at each ending beat.
        s.sound = scoreEnvelope(t, this.releaseStart);
        s.move = rt < 4 ? Math.sin(Math.PI * rt / 4) : rt > 14 ? Math.sin(Math.PI * (rt - 14) / 5) : 0;
        return s;
    }
}
