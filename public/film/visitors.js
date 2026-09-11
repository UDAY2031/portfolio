const KEY='gargantua-observer-id',CACHE='gargantua-observer-total';
export class VisitorCounter {
 constructor(){this.elapsed=0;this.posted=false;this.total=null;this.started=null;this.blocked=navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true||navigator.webdriver===true;
 this.row=document.createElement('div');this.row.className='observer-reading';this.row.innerHTML='<span>OBSERVERS</span><output>— — — —</output>';document.getElementById('telemetry').append(this.row);this.output=this.row.querySelector('output');
 try{const cached=Number(localStorage.getItem(CACHE));if(localStorage.getItem(CACHE)!==null&&Number.isSafeInteger(cached)&&cached>=0)this.show(cached,false);}catch{}
 if(this.blocked){this.row.hidden=true;return;}this.fetch('/api/visitors').then(r=>this.accept(r,true)).catch(()=>this.fail());
 }
 async fetch(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(2000)});if(!r.ok)throw Error('unavailable');return r.json();}
 accept(data,animate){if(Number.isSafeInteger(data.total)&&data.total>=0){this.show(Math.max(data.total,this.total||0),animate);try{localStorage.setItem(CACHE,String(data.total));}catch{}}else this.fail();}
 show(total,animate){this.total=total;this.row.hidden=false;this.started=animate?performance.now():null;this.output.textContent=String(total).padStart(6,'0');}
 fail(){if(this.total===null)this.row.hidden=true;}
 identity(){let id;try{id=localStorage.getItem(KEY);}catch{}const cookie=document.cookie.split('; ').find(v=>v.startsWith(KEY+'='))?.split('=')[1];id=id||cookie||crypto.randomUUID();try{localStorage.setItem(KEY,id);}catch{}document.cookie=`${KEY}=${id}; SameSite=Lax; Secure; Max-Age=63072000; Path=/`;return id;}
 frame(dt,rendered,s){if(this.blocked)return;if(this.started!==null){const age=(performance.now()-this.started)/1000;const digits=String(this.total).padStart(6,'0');this.output.textContent=[...digits].map((d,i)=>{const p=Math.min(1,Math.max(0,(age-(digits.length-1-i)*.04)/.86));return p===1?d:String(Math.floor((1-2**(-10*p))*Number(d)+(1-p)*30)%10);}).join('');if(age>1.2)this.started=null;}
 if(s.r>=0)this.finished=true;if(this.finished){this.row.hidden=true;return;}
 if(this.posted||!rendered||document.hidden)return;this.elapsed+=Math.min(.1,dt);if(this.elapsed<4)return;this.posted=true;
 this.fetch('/api/visitors/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:this.identity(),rendered:true,visible:true,webdriver:false})}).then(r=>this.accept(r,this.started===null)).catch(()=>this.fail());
 }
}
