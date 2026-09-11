import { clamp } from './ease.js';
export class DynamicResolution {
 constructor(mobile=false){this.scale=mobile?.65:1;this.applied=this.scale;this.goal=this.scale;this.min=.45;this.max=2;this.samples=[];this.median=16.6;this.target=16.6;this.lowTime=0;this.offered=false;this.frames=0;}
 update(ms,dt,safe){if(ms>0&&ms<250){this.samples.push(ms);if(this.samples.length>30)this.samples.shift();}this.frames++;
 if(this.samples.length<30)return false;
 this.median=[...this.samples].sort((a,b)=>a-b)[15];
 if(safe&&this.frames%30===0){if(this.median>this.target*1.1)this.goal=clamp(this.goal-.08,this.min,this.max);else if(this.median<this.target*.85)this.goal=clamp(this.goal+.06,this.min,this.max);}
 if(safe)this.scale+=(this.goal-this.scale)*(1-Math.exp(-dt/ .5));
 this.lowTime=this.scale<this.min+.015?this.lowTime+dt:0;
 if(safe&&Math.abs(this.scale-this.applied)>.05){this.applied=this.scale;return true;}return false;
 }
}
