import * as T from 'three';
import {projectLink} from './read-anchors.js';
export class Interaction {
 constructor(director,archive,camera){this.director=director;this.archive=archive;this.camera=camera;this.pointer=new T.Vector2();this.look=new T.Vector2();this.ray=new T.Raycaster();this.hover=null;this.expanded=false;this.page=0;this.room=-1;
  addEventListener('pointermove',e=>{if(e.target.closest?.('#debug,button,a,input'))return;this.pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);});
  addEventListener('click',e=>{if(e.target.closest?.('#debug,button,a,input')||director.state!=='ARRIVED')return;const current=archive.interiors.active;if(!current)return;
   const selected=this.hit(current);if(!selected)return;
   if(selected.object.userData.surfaceStep){this.selectPage(selected.object.userData.surfaceStep);return;}
   const spine=current.spines.find(s=>s.spine===selected.object);if(spine){spine.pulled=!spine.pulled;return;}
   if(current.page.kind==='monitor'){this.expanded=!this.expanded;archive.interiors.expanded=this.expanded;}
   else this.selectPage(1);
  });
  addEventListener('keydown',e=>{if(e.target.closest?.('input,select')||director.state!=='ARRIVED')return;if(e.key==='['||e.key===']'){this.selectPage(e.key===']'?1:-1);}});
 }
 selectPage(step){const interiors=this.archive.interiors,count=this.archive.rooms[this.director.sample(this.director.t).room].pages.length;interiors.pageOverride=((interiors.activeIndex||0)+step+count)%count;interiors.expanded=false;this.expanded=false;interiors.stopVideo();}
 hit(current){this.ray.setFromCamera(this.pointer,this.camera);return this.ray.intersectObject(current.physical,true).find(h=>h.object.layers.mask===1);}
 update(s,dt){if(this.room!==s.room){this.room=s.room;this.page=0;this.expanded=false;}
  if(this.director.state!=='ARRIVED'||s.segment)return;
  this.look.lerp(this.pointer,1-Math.exp(-dt*2.4));this.camera.rotateY(-this.look.x*T.MathUtils.degToRad(6));this.camera.rotateX(this.look.y*T.MathUtils.degToRad(4));this.camera.updateMatrixWorld();
  const current=this.archive.interiors.active;if(!current)return;projectLink(this.archive.interiors.link,current.physical,this.camera,!!current.page.link&&s.rt>=5.8&&!s.segment);const hit=this.hit(current);this.hover=hit?.object||null;
  current.spines.forEach(s=>{const active=s.spine===this.hover||s.pulled;s.spine.position.z=.14+(active?.04:0);s.text.position.z=.24+(active?.04:0);});
  document.body.style.cursor=hit?'pointer':'default';
 }
}
