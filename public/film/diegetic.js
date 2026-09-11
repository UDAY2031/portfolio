import * as T from 'three';
import { Text, configureTextBuilder } from 'troika-three-text';
import { anchorFor, checkAnchor, projectLink, pageCue, LAYER_TEXT } from './read-anchors.js';
import { ramp, clamp, cubic, hash } from './ease.js';
import { pageTurn, unfold, screenBoot, numberRoll, stamp } from './primitives.js';
configureTextBuilder({defaultFontURL:'/film/fonts/sans.ttf'});
const BOX=new T.BoxGeometry(1,1,1);
function box(parent,material,p,size){const mesh=new T.Mesh(BOX,material);mesh.position.set(...p);mesh.scale.set(...size);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
const materials={wood:new T.MeshStandardMaterial({color:'#322116',roughness:.72}),bronze:new T.MeshStandardMaterial({color:'#5e4324',metalness:.74,roughness:.36}),black:new T.MeshStandardMaterial({color:'#11130f',roughness:.62}),paper:new T.MeshStandardMaterial({color:'#403b2e',roughness:.95}),glass:new T.MeshPhysicalMaterial({color:'#19231e',transparent:true,opacity:.32,roughness:.21,metalness:.15}),edge:new T.MeshBasicMaterial({color:'#b08c54'})};
function label(parent,text,x,y,size=.19,font='sans'){
 const mesh=new Text();mesh.font=`/film/fonts/${font}.ttf`;mesh.text=text;mesh.fontSize=size;mesh.maxWidth=5.25;mesh.lineHeight=1.45;mesh.anchorX='left';mesh.anchorY='top';mesh.color='#ece7db';mesh.position.set(x,y,.075);mesh.material=new T.MeshBasicMaterial({color:'#ece7db',toneMapped:false});mesh.layers.set(LAYER_TEXT);mesh.sync();parent.add(mesh);return mesh;
}
function shelf(parent,x,z,books=true){
 const entries=[];for(let r=0;r<6;r++){const y=-2.3+r*.78;box(parent,materials.wood,[x,y,z],[2.1,.09,.5]);if(books)for(let j=0;j<18;j++)entries.push({p:[x-1+j*.113,y+.29,z+.035],scale:[.09,.42+hash(j*19+r)*.24,.36],angle:(hash(j+r*71)-.5)*.035});}
 const mesh=new T.InstancedMesh(BOX,materials.wood,entries.length),dummy=new T.Object3D();entries.forEach((e,i)=>{dummy.position.set(...e.p);dummy.scale.set(...e.scale);dummy.rotation.z=e.angle;dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color().setHSL(.06+hash(i)*.06,.25,.17+hash(i*7)*.18));});mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);
}
export class DiegeticRooms {
 constructor(rooms,nodes,parent){this.rooms=rooms;this.nodes=nodes;this.parent=parent;this.groups=nodes.map(n=>{const root=new T.Group();root.position.copy(n.position);return {root};});this.loaded=new Map();this.link=document.createElement('a');this.link.className='surface-link';this.link.target='_blank';this.link.rel='noopener noreferrer';this.link.hidden=true;document.body.append(this.link);this.contract=null;this.active=null;this.video=null;this.endedVideos=new Set();this.ready=true;}
 load(i){if(i<0||i>=this.rooms.length||this.loaded.has(i))return;const room=this.rooms[i],node=this.nodes[i],root=this.groups[i].root;root.quaternion.copy(node.q);this.parent.add(root);
  box(root,materials.wood,[0,-2.7,-.7],[9,.2,6]);box(root,materials.wood,[0,2.8,-2],[9,.18,4]);
  if(room.theme!=='empty')box(root,materials.black,[0,.05,-3.05],[9,5.6,.18]);
  shelf(root,-3.5,-2.5,room.theme!=='empty');shelf(root,3.5,-2.5,room.theme!=='empty');
  const lamp=new T.RectAreaLight('#ffd2a0',3.5,3,1);lamp.position.set(-2,2.4,1);lamp.lookAt(0,0,-2);root.add(lamp);
  const pages=room.pages.map((page,j)=>{
   const holder=new T.Group();root.add(holder);const x=(j%2?1:-1)*.5;
   holder.position.set(x,.15,-1.65);const physical=new T.Group();holder.add(physical);
   let backing=materials.black;
   if(page.kind==='book'||page.kind==='patent'||page.kind==='report')backing=materials.paper;
   if(page.kind==='plaque')backing=materials.bronze;
   if(page.kind==='glass')backing=materials.glass;
   const surface=box(physical,backing,[0,0,0],[5.8,3.3,.09]);surface.userData={width:5.8,height:3.3,fontSize:.19};
   // Text lives on an unscaled child: dimensions and projected anchor remain in metres.
   physical.userData={width:5.8,height:3.3,fontSize:.19};
   if(page.kind==='monitor'){
    box(holder,materials.black,[0,-1.94,-.10],[.16,.75,.16]);box(holder,materials.bronze,[0,-2.3,0],[1.3,.06,.65]);
    box(root,materials.wood,[x,-2.2,-1.3],[6.8,.13,2]);box(root,materials.black,[x,-2.08,-.52],[1.2,.055,.4]);
    box(root,materials.black,[x+3,-1.75,-1.3],[.55,.85,.85]);box(root,materials.edge,[x+3,-1.45,-.87],[.07,.012,.02]);
    const glow=new T.RectAreaLight('#c9d7c4',1.2,5.6,3.1);glow.position.set(0,0,.11);holder.add(glow);holder.userData.screenLight=glow;
   } else if(page.kind==='slate'||page.kind==='skills'){
    for(const y of [-1.7,1.7])box(physical,materials.wood,[0,y,0],[6,.10,.14]);for(const x of [-2.95,2.95])box(physical,materials.wood,[x,0,0],[.1,3.45,.14]);
    box(root,materials.wood,[x,-2.25,-.6],[6,.12,2]);box(root,materials.bronze,[-2,-1.5,-.6],[.04,1.5,.04]);box(root,materials.bronze,[-2,-.78,-.6],[.5,.15,.3]);
   } else if(page.kind==='book'){
    box(physical,materials.wood,[0,0,-.1],[5.95,3.45,.10]);box(physical,materials.bronze,[0,0,.06],[.025,3.27,.025]);
    for(let k=0;k<14;k++)box(physical,materials.paper,[0,-.006*k,-.009*k],[5.82,3.28,.006]);
    const ink=new T.MeshBasicMaterial({color:'#8f8066'});
    for(let k=0;k<4;k++){box(physical,ink,[-2.2+k*.58,-.53,.06],[.36,.35,.004]);if(k<3)box(physical,ink,[-1.91+k*.58,-.53,.06],[.24,.012,.005]);}
    label(physical,'FIG. 01  /  CONCEPT STUDY',-2.5,-.87,.10,'mono');

   } else if(page.kind==='plaque'){
    box(holder,materials.black,[0,-2.15,-.05],[4.6,1,.7]);
   } else if(page.kind==='glass'){
    for(const x of [-2.93,2.93])box(physical,materials.edge,[x,0,0],[.012,3.35,.012]);
   }
   const title=label(physical,page.title,-2.58,1.34,.33,page.kind==='book'?'serif':'sans');
   const body=label(physical,page.body,-2.58,.48,.19,page.kind==='book'?'serif':page.kind==='monitor'?'mono':'sans');
   if(page.kind==='book'){title.maxWidth=2.45;title.fontSize=.32;title.position.x=-2.58;body.maxWidth=2.45;body.position.set(.22,1.30,.09);title.sync();body.sync();}
   const metric=label(physical,page.metric||page.year||'',-2.58,-1.02,.22);
   const footer=label(physical,`${String(i+1).padStart(2,'0')}  /  ${String(j+1).padStart(2,'0')}` ,2.0,-1.40,.115,'mono');
   let spines=[];
   if(page.kind==='skills'){
    body.visible=false;const skills=page.skills;
    for(let k=0;k<skills.length;k++){
     const px=-2.5+k*5/skills.length,spine=box(physical,materials.wood,[px,-.15,.10],[Math.min(.36,4.7/skills.length),1.7,.14]);
     const text=label(physical,skills[k],px-.1,-.83,.18);text.rotation.z=Math.PI/2;text.position.z=.22;spines.push({spine,text});
    }
   }
   const folds=[];if(page.kind==='patent')for(let k=0;k<3;k++){const hinge=new T.Group();hinge.position.set(-2.9+k*1.93,0,-.02);physical.add(hinge);box(hinge,materials.paper,[.965,0,0],[1.93,3.3,.025]);folds.push(hinge);}
   return {holder,physical,title,body,metric,footer,page,spines,folds,texts:[title,body,metric,footer,...spines.map(s=>s.text)]};
  });
  this.loaded.set(i,{root,pages,lamp});
 }
 disposeRoom(i){const entry=this.loaded.get(i);if(!entry)return;entry.root.traverse(o=>{if(o instanceof Text)o.dispose();});entry.root.removeFromParent();entry.root.clear();this.loaded.delete(i);}
 update(s,camera,director){
  this.director=director;if(this.lastRoom!==s.room){if(s.direction<0)for(const key of this.endedVideos)if(key.startsWith(s.room+':'))this.endedVideos.delete(key);this.lastRoom=s.room;}if(s.paused)this.pauseVideo();if(!s.archive){this.link.hidden=true;this.pauseVideo();return;}
  this.load(s.room);this.load(s.room+1);for(const i of [...this.loaded.keys()])if(Math.abs(i-s.room)>1)this.disposeRoom(i);
  const entry=this.loaded.get(s.room),cue=pageCue(this.rooms[s.room].pages,s.rt),current=entry.pages[cue.index];this.active=current;
  for(const [i,g]of this.loaded){g.root.visible=i===s.room||this.nodes[i].position.distanceTo(camera.position)<24;g.lamp.intensity=i===s.room?3.5:0;for(const [j,p]of g.pages.entries()){p.holder.visible=i===s.room&&j===cue.index;}}
  const {physical,holder,page}=current;
  // Shelf clearance arc and book opening are sampled, never triggered tweens.
  const arrival=ramp(cue.p,0,1.8),baseX=(cue.index%2?1:-1)*.5;
  holder.position.set(baseX+(page.kind==='book'?(1-arrival)*2.5:0),.15+(page.kind==='book'?Math.sin(arrival*Math.PI)*.7:0),-1.65+(page.kind==='book'?(1-arrival)*-1:0));
  physical.rotation.y=page.kind==='book'?pageTurn(arrival)*.28:0;
  current.folds.forEach((f,i)=>{f.rotation.y=unfold(arrival)[i];});
  current.spines.forEach(({spine},i)=>spine.position.z=.1+.04*ramp(cue.p,i*.06,.9+i*.06));
  const atHold=s.rt>=5.8&&cue.p>=1.8;
  const visibility=ramp(cue.p,1.8,2.5);current.title.clipRect=[-10,-10,5.6*ramp(cue.p,1.8,3),10];
  current.texts.forEach((text,j)=>{text.fillOpacity=ramp(cue.p,1.8+j*.18,2.5+j*.18);});
  current.body.visible=page.kind!=='skills';
  entry.root.updateMatrixWorld(true);
  if(s.t>=114.4&&s.r<0&&s.rt>=4&&s.rt<=32){
   const anchor=anchorFor(this.nodes[s.room],physical);const weight=ramp(s.rt,4,5.8);
   const previous=entry.pages[Math.max(0,cue.index-1)];const previousAnchor=anchorFor(this.nodes[s.room],previous.physical);
   if(cue.index>0&&cue.p<1.8){anchor.position.lerpVectors(previousAnchor.position,anchor.position,ramp(cue.p,0,1.8));anchor.quaternion.slerpQuaternions(previousAnchor.quaternion,anchor.quaternion,ramp(cue.p,0,1.8));}
   camera.position.lerp(anchor.position,weight);camera.quaternion.slerp(anchor.quaternion,weight);camera.fov=T.MathUtils.lerp(camera.fov,anchor.fov,weight);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  }
  this.contract=atHold?checkAnchor(physical,camera):null;
  const link=page.link;this.link.textContent=link?.label||'';if(link)this.link.href=link.url;projectLink(this.link,physical,camera,!!link&&atHold&&!director.segment);
  if(page.video&&atHold&&cue.p>=4.8&&!s.paused)this.ensureVideo(current,`${s.room}:${cue.index}`);
  else if(this.video&&this.video.key!==`${s.room}:${cue.index}`)this.stopVideo();
  if(holder.userData.screenLight)holder.userData.screenLight.intensity=screenBoot(visibility)*1.2;
 }
 ensureVideo(current,key){
  if(this.endedVideos.has(key)||this.video?.key===key)return;this.stopVideo();
  const el=document.createElement('video');el.src=current.page.video;el.crossOrigin='anonymous';el.muted=true;el.playsInline=true;el.preload='auto';el.controls=false;
  const texture=new T.VideoTexture(el);texture.colorSpace=T.SRGBColorSpace;
  const screen=new T.Mesh(new T.PlaneGeometry(5.5,2.84),new T.MeshBasicMaterial({map:texture,toneMapped:false}));screen.position.z=.11;screen.layers.set(LAYER_TEXT);current.physical.add(screen);
  const progress=box(current.physical,new T.MeshBasicMaterial({color:'#d6c09a'}),[-2.75,-1.48,.13],[.001,.025,.005]);progress.layers.set(LAYER_TEXT);
  const skip=label(current.physical,'SPACE · skip film',1.1,-1.36,.12,'mono');skip.position.z=.14;
  this.video={el,texture,screen,progress,skip,key};this.director.lock('video',true);
  const finish=()=>{this.endedVideos.add(key);this.stopVideo();};el.addEventListener('ended',finish,{once:true});el.addEventListener('error',finish,{once:true});
  const onFrame=()=>{if(this.video?.el!==el)return;const p=el.duration?el.currentTime/el.duration:0;progress.scale.x=Math.max(.001,p*5.5);progress.position.x=-2.75+p*2.75;this.video.callback=el.requestVideoFrameCallback?.(onFrame);};this.video.callback=el.requestVideoFrameCallback?.(onFrame);
  el.play().catch(finish);
 }
 pauseVideo(){this.video?.el.pause();}
 resumeVideo(){this.video?.el.play().catch(()=>this.skipVideo());}
 skipVideo(){if(this.video){this.endedVideos.add(this.video.key);this.stopVideo();}}
 stopVideo(){if(!this.video)return;const {el,texture,screen,progress,skip,callback}=this.video;el.pause();if(callback)el.cancelVideoFrameCallback?.(callback);el.removeAttribute('src');el.load();texture.dispose();for(const o of [screen,progress,skip]){o.removeFromParent();if(o instanceof Text)o.dispose();else{o.geometry!==BOX&&o.geometry.dispose();o.material.dispose();}}this.video=null;this.director?.lock('video',false);}
}
