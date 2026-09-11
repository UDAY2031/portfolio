import { Director } from './director.js';
import { clamp, ramp, cubic, pulse } from './ease.js';
export const ENTRY_END=114.4, SLOT=40, HOLD=32, TRAVEL=6.5;
export class NavigationController extends Director {
 constructor(rooms,query=new URLSearchParams(),narrative={}) {
  super(rooms,new URLSearchParams(),narrative);
  this.releaseStart=ENTRY_END+SLOT*rooms.length;this.duration=this.releaseStart+45;
  this.seed=Number(query.get('seed')||2031);this.debug=query.get('debug')==='1';
  this.paused=query.has('t')||query.has('p')||query.has('phase')||query.get('freeze')==='1';this.entered=this.paused||this.debug;
  this.state='INTRO';this.lastNow=null;this.lastGesture=-Infinity;this.cooldown=-Infinity;this.lockReasons=new Set();this.segment=null;this.direction=1;
  let t=Number(query.get('t')||0);if(query.has('p'))t=Number(query.get('p'))*this.duration;
  if(query.has('phase')){const i=Math.max(0,rooms.findIndex(r=>r.id===query.get('room')||String(r.order)===query.get('room')));t=({archive:ENTRY_END+i*SLOT+HOLD,fall:106,threshold:89,crossing:77,approach:20,release:this.releaseStart+8,return:this.releaseStart+25,loop:this.duration-2})[query.get('phase')]??t;}
  this.seek(t);this.paused=query.has('t')||query.has('p')||query.has('phase')||query.get('freeze')==='1';
 }
 seek(t,now){this.t=clamp(Number(t)||0,0,this.duration-.00001);this.currentProgress=this.targetProgress=this.t/this.duration;this.lastNow=now??null;this.segment=null;this.state=this.t<ENTRY_END?'INTRO':this.t>=this.releaseStart?'ENDING':this.sample(this.t).rt>=HOLD?'ARRIVED':'PRESENTING';return this.sample(this.t);}
 seekProgress(p,now){return this.seek(clamp(p)*this.duration,now);}
 lock(reason,value){value?this.lockReasons.add(reason):this.lockReasons.delete(reason);}
 get locked(){return this.lockReasons.size>0;}
 input(delta,now){
  if(!delta)return false;const burst=now-this.lastGesture<400;this.lastGesture=now;
  if(!this.entered||this.locked||this.segment||this.state!=='ARRIVED'||now<this.cooldown||burst)return false;
  const s=this.sample(this.t),direction=Math.sign(delta),next=s.room+direction;
  if(next<0)return false;
  this.paused=false;this.direction=direction;
  const target=next>=this.rooms.length?this.releaseStart:ENTRY_END+next*SLOT+(direction>0?4:HOLD);
  this.segment={from:this.t,to:target,elapsed:0};this.state='TRAVELLING';return true;
 }
 tick(now){
  const dt=this.lastNow===null?0:clamp((now-this.lastNow)/1000,0,.1);this.lastNow=now;const prev=this.t;
  if(this.entered&&!this.paused&&!this.locked){
   if(this.segment){this.segment.elapsed+=dt;const p=clamp(this.segment.elapsed/TRAVEL);this.t=this.segment.from+(this.segment.to-this.segment.from)*p;
    if(p===1){this.segment=null;this.cooldown=now+600;this.state=this.t>=this.releaseStart?'ENDING':this.direction<0?'ARRIVED':'PRESENTING';}
   }else if(this.state!=='ARRIVED'){
    this.t+=dt;
    if(this.t>=this.duration){this.t=0;this.state='INTRO';}
    if(this.t>=ENTRY_END&&this.t<this.releaseStart){this.state='PRESENTING';const stop=ENTRY_END+Math.floor((this.t-ENTRY_END)/SLOT)*SLOT+HOLD;if(this.t>=stop){this.t=stop;this.state='ARRIVED';this.cooldown=now+600;}}
   }
  }
  this.velocity=dt?(this.t-prev)/this.duration/dt:0;this.currentProgress=this.targetProgress=this.t/this.duration;
  const s=this.sample(this.t);s.navState=this.locked?'LOCKED':this.state;s.direction=this.direction;s.paused=this.paused;s.travelProgress=this.segment?clamp(this.segment.elapsed/TRAVEL):null;return s;
 }
 setPaused(value,now){this.paused=value;this.lastNow=now;}
 sample(t){
  t=clamp(t,0,this.duration-.00001);const inRoom=t>=ENTRY_END&&t<this.releaseStart;
  const local=clamp(t-ENTRY_END,0,SLOT*this.rooms.length-.00001),room=Math.floor(local/SLOT),rt=local-room*SLOT;
  // Preserve the established black-hole physics and closing cues in their own time domain.
  const oldRelease=110+19*this.rooms.length,oldT=t<95?t:t<ENTRY_END?95+clamp((t-95)/3.5)*10:inRoom?110+room*19+10:oldRelease+t-this.releaseStart;
  const save=this.releaseStart, duration=this.duration;this.releaseStart=oldRelease;this.duration=oldRelease+45;
  const s=super.sample(oldT);this.releaseStart=save;this.duration=duration;
  s.t=t;s.room=room;s.rt=rt;s.r=t-this.releaseStart;s.archive=t>=100.5&&s.r<18;s.reveal=inRoom?clamp(rt-5.8,0,8):0;s.hud=t<70?s.hud:0;
  s.act={name:t<70?'I · APPROACH':t<95?'II · CROSSING':t<ENTRY_END?'III · AWAKENING':inRoom?'IV · THE ARCHIVE':s.r<40?'V · RELEASE':'VI · LOOP'};
  s.black=t>=98.5&&t<100.5?1:t>=100.5&&t<ENTRY_END?0:s.black;
  s.streak=t>=95&&t<98.5?pulse(t,95,96,98.2,98.5):s.r<0?0:s.streak;s.formation=0;
  s.eye=t<100.5?0:ramp(t,100.5,101.9)*(1-.3*pulse(t,100.85,100.95,101.03,101.15));
  s.defocus=t>=100.5&&t<103.7?1-ramp(t,101.9,103.7):0;
  s.sound=t>=98.5&&t<101.9?0:s.archive?1:s.sound;
  s.navState=this?.locked?'LOCKED':this?.state||'INTRO';s.paused=this?.paused;s.direction=this?.direction||1;
  return s;
 }
 attach(element=window){
  const interactive=e=>e.target.closest?.('input,select,button,a,video');
  element.addEventListener('wheel',e=>{if(interactive(e)||e.ctrlKey)return;e.preventDefault();this.input(e.deltaY,performance.now());},{passive:false});
  element.addEventListener('keydown',e=>{if(interactive(e)||e.repeat)return;const d={ArrowDown:1,PageDown:1,ArrowUp:-1,PageUp:-1}[e.key];if(d){e.preventDefault();this.input(d,performance.now());}});
  let touch=null;element.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!interactive(e))touch={id:e.pointerId,y:e.clientY};});
  element.addEventListener('pointerup',e=>{if(!touch||touch.id!==e.pointerId)return;const d=touch.y-e.clientY;touch=null;if(Math.abs(d)>12)this.input(d,performance.now());});
  element.addEventListener('pointercancel',()=>touch=null);
 }
}
