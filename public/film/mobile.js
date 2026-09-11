export class LandscapeGuard {
 constructor(director,rooms,audio,onResize){this.director=director;this.rooms=rooms;this.audio=audio;this.onResize=onResize;this.mobile=matchMedia('(pointer: coarse)').matches;this.wake=null;this.gated=false;
  this.overlay=document.createElement('section');this.overlay.id='rotate-prompt';this.overlay.innerHTML='<svg viewBox="0 0 80 100" aria-hidden="true"><rect x="20" y="8" width="40" height="76" rx="6"/><path d="M34 76h12"/></svg><p>ROTATE YOUR DEVICE</p><span>this archive is best experienced in landscape</span>';document.body.append(this.overlay);
  let timer;const change=()=>{clearTimeout(timer);timer=setTimeout(()=>this.update(),300);};addEventListener('resize',change);visualViewport?.addEventListener('resize',change);matchMedia('(orientation: portrait)').addEventListener('change',change);
  document.addEventListener('visibilitychange',()=>{const hidden=document.hidden;director.lock('hidden',hidden);director.lastNow=null;if(hidden){rooms.pauseVideo();this.releaseWake();}else{if(!this.gated)rooms.resumeVideo();this.requestWake();}});this.update();
 }
 update(){const bad=this.mobile&&(!matchMedia('(min-aspect-ratio: 3/2)').matches||matchMedia('(orientation: portrait)').matches);const changed=bad!==this.gated;this.gated=bad;this.overlay.hidden=!bad;this.director.lock('orientation',bad);this.director.lastNow=null;
 if(bad){this.rooms.pauseVideo();this.releaseWake();}else if(changed){this.rooms.resumeVideo();this.requestWake();}this.onResize();}
 async requestLandscape(){if(!this.mobile)return;try{await document.documentElement.requestFullscreen({navigationUI:'hide'});await screen.orientation.lock('landscape');}catch{/* iPhone uses the rotate prompt normally. */}this.update();this.requestWake();}
 async requestWake(){if(document.hidden||this.gated||!navigator.wakeLock||this.wake)return;try{this.wake=await navigator.wakeLock.request('screen');this.wake.addEventListener('release',()=>this.wake=null);}catch{/* Optional browser capability. */}}
 releaseWake(){this.wake?.release().catch(()=>{});this.wake=null;}
}
