import assert from 'node:assert/strict';import fs from 'node:fs';
import {NavigationController,ENTRY_END,SLOT,TRAVEL}from'../public/film/navigation.js';
import {DynamicResolution}from'../public/film/dynamic-resolution.js';
const rooms=JSON.parse(fs.readFileSync('resources/journey.json'));const create=(i=0)=>new NavigationController(rooms,new URLSearchParams(`t=${ENTRY_END+SLOT*i+4}`));
function tickFor(d,start,seconds,hz=60){for(let i=0;i<=seconds*hz;i++)d.tick(start+i*1000/hz);}
for(const delta of [1,120,12000]){const d=create();assert.equal(d.state,'ARRIVED');assert(d.input(delta,1000));tickFor(d,1000,TRAVEL);assert.equal(d.sample(d.t).room,1);assert.equal(d.state,'ARRIVED');assert(d.input(1,6501),'No dwell or cooldown');}
for(const hz of [30,60,144]){const d=create();d.input(1,1000);tickFor(d,1000,TRAVEL,hz);assert.equal(d.segment,null);assert.equal(d.sample(d.t).room,1);}
{const d=create();d.input(1,1000);tickFor(d,1000,2);const u=d.segment.u;d.input(-1,3001);assert.equal(d.segment.u,u,'reversal does not snap');tickFor(d,3002,4);assert.equal(d.state,'ARRIVED');assert.equal(d.sample(d.t).room,0);}
{const d=create();d.input(1,1000);tickFor(d,1000,1);d.skip();tickFor(d,2001,.9);assert.equal(d.state,'ARRIVED');assert.equal(d.sample(d.t).room,1);}
for(let i=1;i<rooms.length;i++){const d=create(i);d.input(-1,1000);tickFor(d,1000,5.5);assert.equal(d.sample(d.t).room,i-1);}
{const d=create();d.paused=false;tickFor(d,1000,100);assert.equal(d.sample(d.t).room,0);assert.equal(d.state,'ARRIVED');}
{const d=new NavigationController(rooms);d.entered=true;let at;for(let frame=0;frame<20*60;frame++){const now=frame*1000/60;if(frame%6===0)d.input(30,now);d.tick(now);if(d.state==='ENTRY'){at=now/1000;break;}}assert(at>=12&&at<=15,`approach ${at}s`);}
{const d=create(5);d.input(1,1000);assert.equal(d.state,'OUTRO');for(let i=0;i<32*60;i++){const s=d.tick(1000+i*1000/60);assert.equal(s.hole,0);assert.equal(d.state,'OUTRO');}tickFor(d,33000,3);assert.equal(d.state,'IDLE');}
{const d=create();d.input(1,1000);d.lock('orientation',true);tickFor(d,1000,3);assert.equal(d.segment.u,0);d.lock('orientation',false);tickFor(d,5000,5.5);assert.equal(d.sample(d.t).room,1);}
assert.equal(new Set(rooms.slice(0,-1).map(r=>JSON.stringify(r.travelToNext.points))).size,5);
for(let i=1;i<5;i++)assert.notEqual(rooms[i].travelToNext.dominantAxis,rooms[i-1].travelToNext.dominantAxis);
{const drs=new DynamicResolution();for(let i=0;i<120;i++)drs.update(40,1/60,false);assert.equal(drs.scale,1);for(let i=0;i<1200;i++)drs.update(40,1/60,true);assert(drs.scale>=.45&&drs.scale<.5);for(let i=0;i<1200;i++)drs.update(8,1/60,true);assert(drs.scale>1);}
console.log('PASS: immediate bidirectional navigation, authored 5.5s travel, reversal, skip, indefinite stay, 12–15s approach, explicit outro, orientation pause, distinct paths, DRS.');
