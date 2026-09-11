import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Director, validateJourney } from '../public/film/director.js';
import { CameraRig } from '../public/film/archive.js';
import * as T from 'three';
const rooms = JSON.parse(readFileSync(new URL('../resources/journey.json', import.meta.url)));
const narrative = JSON.parse(readFileSync(new URL('../resources/film.json', import.meta.url)));
const d = new Director(rooms, new URLSearchParams(), narrative);
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }
check('Runtime grows with content, including one room', () => { assert.equal(d.duration, 345); assert.equal(new Director(rooms.slice(0, 1)).duration, 174); assert.equal(new Director([...rooms, { ...rooms[0], id: 'test-added', order: 11 }]).duration, 364); });
check('One contiguous timeline with no uncovered interval', () => { let end = 0; for (const a of d.acts) {
    assert.equal(a.start, end);
    end += a.duration;
} assert.equal(end, d.duration); });
check('Every frame is finite and scrubs without history', () => { for (let t = 0; t < d.duration; t += 1 / 30) {
    const a = d.sample(t);
    for (const v of Object.values(a))
        if (typeof v === 'number')
            assert.ok(Number.isFinite(v));
    d.sample(d.duration - t);
    assert.deepEqual(a, d.sample(t));
} });
check('All room cameras join continuously', () => { const rig = new CameraRig(rooms.length); for (let i = 1; i < rooms.length; i++) {
    const a = new T.PerspectiveCamera(), b = new T.PerspectiveCamera(), t = 110 + i * 19;
    rig.apply(a, d.sample(t - .0001));
    rig.apply(b, d.sample(t + .0001));
    assert.ok(a.position.distanceTo(b.position) < .001);
    assert.ok(a.quaternion.angleTo(b.quaternion) < .001);
} });
check('Every room has a full reveal and reverses completely before departure', () => { for (let i = 0; i < rooms.length; i++) {
    assert.ok(d.sample(110 + i * 19 + 12).reveal >= 7);
    assert.ok(d.sample(110 + i * 19 + 18.999).reveal < .002);
} });
check('Blackout is absolute for at least 1.5 seconds before the title', () => { for (let t = 84; t < 85.5; t += 1 / 60) {
    const s = d.sample(t);
    assert.equal(s.black, 1);
    assert.equal(s.sound, 0);
    assert.equal(s.captionAlpha, 0);
} assert.equal(d.sample(88).caption, narrative.title); assert.equal(d.sample(88).captionAlpha, .6); });
check('HUD never returns after the horizon', () => { for (let t = 68; t < 345; t += .1)
    assert.equal(d.sample(t).hud, 0); });
check('Caption holds, ending silence, and invisible black loop boundary', () => { assert.equal(d.sample(325).caption, narrative.closing[0]); assert.equal(d.sample(333).caption, narrative.closing[1]); for (const t of [321, 329, 338, 344.999, 0]) {
    assert.equal(d.sample(t).sound, 0);
} assert.equal(d.sample(344.999).black, 1); assert.equal(d.sample(0).black, 1); assert.deepEqual(d.sample(345), d.sample(0)); });
check('Timestamp parsing, pause/play, and modulo seek', () => { const f = new Director(rooms, new URLSearchParams('t=143')); assert.equal(f.tick(100).t, 143); assert.equal(f.tick(10100).t, 143); f.setPaused(false, 10100); assert.equal(f.tick(11100).t, 144); f.seek(-1, 11100); assert.equal(f.tick(11100).t, 344); assert.equal(new Director(rooms, new URLSearchParams('t=garbage')).t, 0); });
check('Phase and room URLs resolve by id and order', () => { assert.equal(new Director(rooms, new URLSearchParams('phase=archive&room=06-innovation')).t, 215); assert.equal(new Director(rooms, new URLSearchParams('phase=archive&room=6')).t, 215); });
check('Invalid content fails with an actionable error', () => { assert.throws(() => validateJourney([]), /at least one/); assert.throws(() => validateJourney([...rooms, rooms[0]]), /unique/); assert.throws(() => validateJourney([{ ...rooms[0], links: [{ label: 'bad', url: 'javascript:alert(1)' }] }]), /https/); });
console.log(`${checks} Director integration checks passed.`);

check('Reveal holds until the departure and reverses at exactly 1.6×', () => {
    for (const i of [0,4,9]) {
        const start=110+i*19;
        assert.equal(d.sample(start+12).reveal,8);
        assert.equal(d.sample(start+13.999).reveal,8);
        assert.ok(Math.abs(d.sample(start+15).reveal-6.4)<1e-9);
        assert.ok(Math.abs(d.sample(start+16).reveal-4.8)<1e-9);
    }
});
check('Non-finite programmatic seeks recover to a finite start', () => {
    for (const t of [NaN, Infinity, -Infinity]) assert.equal(d.seek(t).t,0);
});
const { scoreEnvelope, dustZ } = await import('../public/film/timing.js');
check('Audio and Director use identical gates at sample-rate silence boundaries', () => {
    for (const boundary of [84,109,321,345]) {
        for (let i=-32;i<32;i++) {
            const t=d.normalize(boundary+i/48000);
            assert.equal(d.sample(t).sound,scoreEnvelope(t,d.releaseStart));
        }
    }
});
check('Dust does not jump as the camera crosses its old cell boundaries', () => {
    for (const camera of [-120,-60,0,60]) {
        for (const seed of [-20,-3,9,22]) {
            const before=dustZ(seed,camera-.0001),after=dustZ(seed,camera+.0001);
            assert.ok(Math.abs(before-after)<1e-8);
        }
    }
});
console.log(`${checks} total checks passed after continuity extensions.`);
