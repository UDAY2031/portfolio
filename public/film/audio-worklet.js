import { scoreEnvelope, ARCHIVE_NOTE } from './timing.js';
// Original oscillator voices run at audio rate; the ScrollDirector alone selects
// the mix and hard-silence gates. Music continues while the visitor reads.
class Score extends AudioWorkletProcessor {
 constructor(){super();this.sync={t:0,at:0,duration:345,release:300,paused:true,muted:false,volume:.7};this.port.onmessage=e=>{this.sync=e.data;};}
 process(inputs,outputs){const out=outputs[0],s=this.sync;
  for(let i=0;i<out[0].length;i++){
   const phase=s.t;
   const t=currentTime+i/sampleRate;
   const envelope=s.envelope ?? scoreEnvelope(phase,s.release);
   const silence=s.paused||s.muted||envelope===0;
   let value=0;
   if(!silence){
    const onset=phase<84?1:0,archive=Math.max(0,Math.min(1,(phase-ARCHIVE_NOTE)/4));
    value=(Math.sin(t*2*Math.PI*36.71)*.055+Math.sin(t*2*Math.PI*41.25)*.025)*onset;
    value+=archive*(Math.sin(t*2*Math.PI*110)*.013+Math.sin(t*2*Math.PI*164.81)*.011+Math.sin(t*2*Math.PI*220.12)*.007);
    if(phase>=ARCHIVE_NOTE){const notes=[220,329.63,293.66,164.81,246.94,196,329.63,146.83],beat=Math.floor(t/2.8);
     for(let j=0;j<3;j++){const n=beat-j;if(n<0)continue;const age=t-n*2.8,hz=notes[n%notes.length],env=(1-Math.exp(-age*9))*Math.exp(-age*.42);
      // A soft hammer plus a long, quiet, original harmonic room response.
      value+=env*(Math.sin(age*hz*2*Math.PI)+.21*Math.sin(age*hz*4.002*Math.PI)+.06*Math.sin(age*hz*6.01*Math.PI))*.055;
      value+=Math.exp(-age*.19)*(1-Math.exp(-age*2))*Math.sin((age-.19)*hz*2.0006*Math.PI)*.008;
     }
    }

   }
   value*=s.volume*envelope;for(let ch=0;ch<out.length;ch++)out[ch][i]=value;
  }return true;
 }
}
registerProcessor('gargantua-score',Score);
