import { Director } from './director.js';
import { clamp, ramp, cubic, pulse } from './ease.js';
export const ENTRY_END=114.4, SLOT=40, HOLD=32, TRAVEL=5.5;
export class NavigationController extends Director {
 constructor(rooms,query=new URLSearchParams(),narrative={}) {
  super(rooms,new URLSearchParams(),narrative);
  this.releaseStart=ENTRY_END+SLOT*rooms.length;this.duration=this.releaseStart+33;
  this.seed=Number(query.get('seed')||2031);this.debug=query.get('debug')==='1';
  this.paused=query.has('t')||query.has('p')||query.has('phase')||query.get('freeze')==='1';this.entered=this.paused||this.debug;
  this.state='IDLE';this.lastNow=null;this.lastGesture=-Infinity;this.cooldown=-Infinity;this.lockReasons=new Set();this.segment=null;this.direction=1;
  let t=Number(query.get('t')||0);if(query.has('p'))t=Number(query.get('p'))*this.duration;
  if(query.has('phase')){const i=Math.max(0,rooms.findIndex(r=>r.id===query.get('room')||String(r.order)===query.get('room')));t=({archive:ENTRY_END+i*SLOT+HOLD,fall:106,threshold:89,crossing:77,approach:20,release:this.releaseStart+8,return:this.releaseStart+25,loop:this.duration-2})[query.get('phase')]??t;}
  this.seek(t);this.paused=query.has('t')||query.has('p')||query.has('phase')||query.get('freeze')==='1';
 }
 seek(t,now){this.t=clamp(Number(t)||0,0,this.duration-.00001);this.currentProgress=this.targetProgress=this.t/this.duration;this.lastNow=now??null;this.segment=null;this.approachVelocity=0;this.state=this.t<83?'IDLE':this.t<ENTRY_END?'ENTRY':this.t>=this.releaseStart?'OUTRO':'ARRIVED';return this.sample(this.t);}
 seekProgress(p,now){return this.seek(clamp(p)*this.duration,now);}
 lock(reason,value){if(value)this.lockReasons.add(reason);else this.lockReasons.delete(reason);}
 get locked(){return this.lockReasons.size>0;}
 input(delta,now){
  if(!delta||this.locked)return false;this.entered=true;this.paused=false;this.lastGesture=now;
  const direction=Math.sign(delta);
  if(this.state==='IDLE') {this.approachVelocity=clamp((this.approachVelocity||0)+direction*1.8,-6.2,6.2);return true;}
  if(this.state==='ENTRY'||this.state==='OUTRO')return false;
  if(this.segment){
   if(direction!==this.segment.direction){this.segment.direction=direction;this.segment.reverse={elapsed:0,from:this.segment.rate,to:direction*this.segment.originalDirection/TRAVEL};}return true;
  }
  const room=this.sample(this.t).room,next=room+direction;
  if(next<0){this.state='IDLE';this.t=70;this.approachVelocity=-2;return true;}
  if(next>=this.rooms.length){this.state='OUTRO';this.t=this.releaseStart;this.direction=1;return true;}
  this.direction=direction;
  this.segment={fromRoom:room,toRoom:next,index:Math.min(room,next),u:0,rate:1/TRAVEL,direction,originalDirection:direction,elapsed:0,fromTime:this.t,from:ENTRY_END+room*SLOT+32,to:ENTRY_END+next*SLOT+4};
  this.state='TRAVELLING';this.onTravelStart?.(this.segment);return true;
 }
 skip(){
  if(this.locked)return;this.entered=true;this.paused=false;
  if(this.state==='IDLE'||this.state==='ENTRY'){this.seek(ENTRY_END+4);this.state='ARRIVED';return;}
  if(this.segment&&!this.segment.skip){const seg=this.segment;seg.skip={elapsed:0,from:seg.u,to:seg.direction===seg.originalDirection?1:0};}
 }
 tick(now){
  const dt=this.lastNow===null?0:clamp((now-this.lastNow)/1000,0,.1);this.lastNow=now;const prev=this.t;
  if(this.entered&&!this.paused&&!this.locked){
   if(this.segment){const seg=this.segment;
    if(seg.skip){seg.skip.elapsed+=dt;seg.u=seg.skip.from+(seg.skip.to-seg.skip.from)*cubic(seg.skip.elapsed/.8);}
    else if(seg.reverse){const r=seg.reverse;r.elapsed+=dt;const rate=r.from+(r.to-r.from)*cubic(r.elapsed/.4);seg.u+=(seg.rate+rate)*.5*dt;seg.rate=rate;if(r.elapsed>=.4)seg.reverse=null;}
    else seg.u+=seg.rate*dt;
    seg.u=clamp(seg.u);seg.elapsed+=dt;
    // Canonical time is only for deterministic cues; the rig samples segment.u directly.
    this.t=seg.originalDirection>0?ENTRY_END+seg.index*SLOT+32+seg.u*12:ENTRY_END+seg.index*SLOT+44-seg.u*12;
    const complete=(seg.u>=1-1e-9&&seg.rate>=0)||(seg.u<=1e-9&&seg.rate<0)||(seg.skip&&seg.skip.elapsed>=.8);
    if(complete){const room=seg.u>.5?seg.toRoom:seg.fromRoom;this.segment=null;this.t=ENTRY_END+room*SLOT+4;this.state='ARRIVED';}
   }else if(this.state==='IDLE'){
    const idle=now-(this.lastGesture||0)>3000;this.approachVelocity=(this.approachVelocity||0)*Math.exp(-dt*.6);
    this.t=clamp(this.t+((idle?.35:0)+(this.approachVelocity||0))*dt,0,83);
    if(this.t>=83)this.state='ENTRY';
   }else if(this.state==='ENTRY') {this.t+=dt;if(this.t>=ENTRY_END+4){this.t=ENTRY_END+4;this.state='ARRIVED';}}
   else if(this.state==='ARRIVED'){const start=ENTRY_END+Math.floor((this.t-ENTRY_END)/SLOT)*SLOT;this.t=Math.min(start+HOLD,this.t+dt);}
   else if(this.state==='OUTRO'){this.t+=dt;if(this.t>=this.duration){this.seek(0,now);this.state='IDLE';}}
  }
  this.velocity=dt?(this.t-prev)/this.duration/dt:0;this.currentProgress=this.targetProgress=this.t/this.duration;
  const s=this.sample(this.t);s.navState=this.state;s.direction=this.direction;s.paused=this.paused;s.segment=this.segment;s.dt=dt;return s;
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
  s.act={name:t<70?'I · APPROACH':t<95?'II · CROSSING':t<ENTRY_END?'III · AWAKENING':inRoom?'IV · THE ARCHIVE':s.r<31?'V · RELEASE':'VI · LOOP'};
  s.black=t>=98.5&&t<100.5?1:t>=100.5&&t<ENTRY_END?0:s.black;
  s.streak=t>=95&&t<98.5?pulse(t,95,96,98.2,98.5):s.r<0?0:s.streak;s.formation=0;
  s.eye=t<100.5?0:ramp(t,100.5,101.9)*(1-.3*pulse(t,100.85,100.95,101.03,101.15));
  s.defocus=t>=100.5&&t<103.7?1-ramp(t,101.9,103.7):0;
  s.sound=t>=98.5&&t<101.9?0:s.archive?1:s.sound;
  if(s.r>=0){s.archive=s.r<16;s.black=s.r>=16?1:0;s.hole=0;s.streak=0;s.sound=s.r>=16?0:1;
   s.caption=s.r<25?"this time hasn't happened yet":"and it's still being written";
   s.captionAlpha=.58*(pulse(s.r,18,19,22.5,24)+pulse(s.r,25,26,29.5,31));}

  s.navState=this?.locked?'LOCKED':this?.state||'INTRO';s.paused=this?.paused;s.direction=this?.direction||1;
  return s;
 }
 attach(element=window){
  const interactive=e=>e.target.closest?.('input,select,button,a,video');
  element.addEventListener('wheel',e=>{if(interactive(e)||e.ctrlKey)return;e.preventDefault();this.input(e.deltaY,performance.now());},{passive:false});
  element.addEventListener('keydown',e=>{if(interactive(e)||e.repeat)return;if(e.code==='Space'){e.preventDefault();if(this.state==='ARRIVED')this.input(1,performance.now());else this.skip();return;}const d={ArrowDown:1,ArrowRight:1,PageDown:1,ArrowUp:-1,ArrowLeft:-1,PageUp:-1}[e.key];if(d){e.preventDefault();this.input(d,performance.now());}});
  let touch=null;element.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!interactive(e))touch={id:e.pointerId,y:e.clientY};});
  element.addEventListener('pointerup',e=>{if(!touch||touch.id!==e.pointerId)return;const d=touch.y-e.clientY;touch=null;if(Math.abs(d)>12)this.input(d,performance.now());});
  element.addEventListener('pointercancel',()=>touch=null);
 }
}
