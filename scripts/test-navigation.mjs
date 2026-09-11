import assert from 'node:assert/strict';import fs from 'node:fs';
import {NavigationController,ENTRY_END,SLOT,HOLD,TRAVEL}from'../public/film/navigation.js';
import {DynamicResolution}from'../public/film/dynamic-resolution.js';
import * as P from '../public/film/primitives.js';
const rooms=JSON.parse(fs.readFileSync('resources/journey.json'));const create=()=>new NavigationController(rooms,new URLSearchParams('phase=archive&room=1'));
for(const magnitude of [1,12,120,12000]){const d=create();assert(d.input(magnitude,1000));for(let t=1000;t<=8000;t+=1000/60)d.tick(t);assert.equal(d.sample(d.t).room,1);assert.equal(d.segment,null);assert(d.t<ENTRY_END+SLOT+6);}
for(const hz of [30,60,144]){const d=create();d.input(10,1000);d.tick(1000);for(let i=1;i<=hz*TRAVEL;i++)d.tick(1000+i*1000/hz);assert(Math.abs(d.t-(ENTRY_END+SLOT+4))<1e-7);}
{const d=create();assert(d.input(120,1000));for(let i=0;i<100;i++)assert(!d.input(9999,1001+i*16));d.tick(1000);d.lock('orientation',true);for(let i=1;i<=600;i++)d.tick(1000+i*16);assert.equal(d.t,ENTRY_END+HOLD);d.lock('orientation',false);d.lock('video',true);assert(!d.input(120,20000));}
{const d=create();d.seek(ENTRY_END+SLOT+HOLD);assert(d.input(-1,1000));for(let t=1000;t<8000;t+=16)d.tick(t);assert.equal(d.sample(d.t).room,0);assert.equal(d.state,'ARRIVED');}
{const d=create();for(const t of [98.5,99,100.49])assert.equal(d.sample(t).black,1);assert.equal(d.sample(99).sound,0);assert.equal(d.sample(100.5).eye,0);assert.equal(d.sample(101.9).eye,1);assert.equal(d.sample(106).archive,true);for(let i=0;i<rooms.length;i++)assert.equal(d.sample(ENTRY_END+i*SLOT+HOLD).room,i);}
{const d=create();const previous=d.duration;rooms.push({...rooms.at(-1),id:'additional',order:7});assert.equal(new NavigationController(rooms).duration,previous+SLOT);rooms.pop();}
{const drs=new DynamicResolution();for(let i=0;i<120;i++)drs.update(40,1/60,false);assert.equal(drs.scale,1);for(let i=0;i<1200;i++)drs.update(40,1/60,true);assert(drs.scale>=.45&&drs.scale<.5);for(let i=0;i<1200;i++)drs.update(8,1/60,true);assert(drs.scale>1);}
for(const name of ['strokeWrite','engrave','screenBoot','spineSlide','pageTurn','stamp','etchGlass'])for(const p of [0,.2,.5,.8,1])assert.equal(P[name](p),P[name](p));
console.log('PASS: fixed-duration gestures at 30/60/144 Hz, burst rejection, reverse, video/orientation locks, entry silence, data-driven runtime, DRS and deterministic primitives.');
