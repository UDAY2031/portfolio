import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ScrollDirector, normalizeWheel } from '../public/film/scroll-director.js';
import { Maze, wrapOffset, roomsOccluded } from '../public/film/maze.js';
import { plusParts } from '../public/film/lattice-geometry.js';
const rooms=JSON.parse(readFileSync(new URL('../resources/journey.json',import.meta.url)));
const make=(query='p=.35&seed=2031')=>new ScrollDirector(rooms,new URLSearchParams(query));
let passed=0;
function check(name,fn){fn();passed++;console.log('✓ '+name);}
check('84 boxes per cell; constant 9³ / 5³ budgets',()=>{
    assert.equal(plusParts().length*7,84);assert.equal(plusParts().length*7*729,61236);
    for(const p of plusParts())assert(p.p.every(Number.isFinite)&&p.scale.every(v=>v>0));
});
check('pixel, line and page deltas normalize equally; extreme input is bounded',()=>{
    assert.equal(normalizeWheel(80),normalizeWheel(5,1));assert.equal(normalizeWheel(80),normalizeWheel(.1,2,800));
    assert.equal(normalizeWheel(100000),240);assert.equal(normalizeWheel(-100000),-240);
});
check('scroll damping is invariant at 30, 60 and 144Hz',()=>{
    const at=hz=>{const d=make('p=.35&idle=0');d.tick(0);d.input(900,0);for(let i=1;i<=hz;i++)d.tick(i*1000/hz);return d.currentProgress;};
    assert(Math.abs(at(30)-at(144))<1e-12);assert(Math.abs(at(60)-at(144))<1e-12);
});
check('reverse input, clamps and explicit progress seeks remain finite',()=>{
    const d=make();d.tick(0);d.input(-1000,0);for(let i=1;i<90;i++)d.tick(i*16);assert(d.currentProgress<.35);
    d.seekProgress(1);assert(d.t<d.duration);d.seekProgress(-20);assert.equal(d.t,0);
    d.seek(Infinity);assert.equal(d.t,0);
});
check('idle drift cancels on input and holds a reading plateau',()=>{
    const d=make('p=.1');d.paused=false;d.tick(0);for(let i=1;i<=240;i++)d.tick(i*16.667);assert(d.currentProgress>.1);
    d.seek(120,5000);d.paused=false;for(let i=1;i<500;i++)d.tick(5000+i*16.667);assert.equal(d.t,120);
    d.input(-120,14000);assert(d.targetProgress<120/d.duration);
});
const maze=new Maze(rooms,2031);
check('seed fixes rooms and changes with a different seed',()=>{
    assert.deepEqual(maze.nodes.map(n=>n.cell),new Maze(rooms,2031).nodes.map(n=>n.cell));
    assert.notDeepEqual(maze.nodes.map(n=>n.cell),new Maze(rooms,42).nodes.map(n=>n.cell));
});
check('maze placement is snapped, separated, multi-axis and occluded',()=>{
    for(let i=0;i<maze.nodes.length;i++){
        const n=maze.nodes[i];assert(n.position.toArray().every(v=>v%6===0));
        for(let j=0;j<i;j++){const p=maze.nodes[j];assert(n.cell.filter((v,k)=>v!==p.cell[k]).length>=2);assert(n.position.distanceTo(p.position)>=18);assert(roomsOccluded(p.position,n.position));}
    }
    assert(maze.nodes.some(n=>Math.abs(n.normal.y)===1));
});
check('full route is deterministic, finite and quaternion normalized in both directions',()=>{
    const d=make(),expected=new Map();
    for(let t=105;t<d.releaseStart+18;t+=.125){const p=maze.sample(d.sample(t));assert(p.position.toArray().every(Number.isFinite));assert(Math.abs(p.q.length()-1)<1e-8);expected.set(t,[...p.position.toArray(),...p.q.toArray()]);}
    for(const [t,pose] of [...expected].reverse())assert.deepEqual([...maze.sample(d.sample(t)).position.toArray(),...maze.sample(d.sample(t)).q.toArray()],pose);
});
check('room-boundary position/orientation continuity and a stationary reading pose',()=>{
    const d=make();for(let room=0;room<rooms.length;room++)for(const rt of [0,4,14,19]){
        const t=110+room*19+rt;if(t>=d.releaseStart)continue;const a=maze.sample(d.sample(t-1e-6)),b=maze.sample(d.sample(t+1e-6));
        assert(a.position.distanceTo(b.position)<.01,`position ${t}`);assert(a.q.angleTo(b.q)<.01,`rotation ${t}`);
    }
    assert(maze.sample(d.sample(118)).position.distanceTo(maze.sample(d.sample(123)).position)<1e-9);
});
check('wrap uses exact cell multiples, without mutating anchored rooms',()=>{
    const anchored=maze.nodes.map(n=>n.position.toArray());
    for(let pass=0;pass<2;pass++)for(const direction of [1,-1])for(let i=0;i<200;i++){
        const t=110+(direction===1?i:199-i)*(rooms.length*19)/200;
        const p=maze.sample(make().sample(t)).position.toArray(),offset=wrapOffset(p);
        assert(offset.every(v=>v%6===0));assert(p.every((v,k)=>v-offset[k]>=-1e-9&&v-offset[k]<6+1e-9));
    }
    assert.deepEqual(maze.nodes.map(n=>n.position.toArray()),anchored);
});
check('adding a room extends duration, scroll length and the route',()=>{
    const extra={...rooms.at(-1),id:'11-next',order:11};const d=new ScrollDirector([...rooms,extra],new URLSearchParams());
    assert.equal(d.duration,make().duration+19);assert.equal(new Maze(d.rooms,2031).transitions.length,10);assert(d.scrollLength>make().scrollLength);
});
console.log(`${passed} scroll/maze checks passed.`);
check('quarter-turn fold ends on the identical structural motif',()=>{
    const key=p=>p.map(v=>Math.round(v*10000)/10000).join(',');
    const parts=plusParts();
    const baseline=new Set(parts.map(p=>key([...p.p,...p.scale])));
    for(const p of parts){const rotated=[p.p[0],-p.p[2],p.p[1],p.scale[0],p.scale[2],p.scale[1]];assert(baseline.has(key(rotated)));}
});
