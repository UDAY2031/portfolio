import * as T from 'three';
export const GRID=.055;
const snap=v=>Math.round(v/GRID)*GRID;
const height=text=>{const b=text.textRenderInfo?.blockBounds;return b?b[3]-b[1]:0;};
export function layoutSurface(p){
 const {title,body,metric,footer,page}=p;
 title.fontSize=.30;title.lineHeight=1.25;title.position.x=-2.585;title.position.y=page.kind==='monitor'?1.155:1.375;
 body.fontSize=.176;body.lineHeight=1.3;body.maxWidth=5.17;metric.fontSize=.22;metric.lineHeight=1.25;
 if(page.kind==='book'){title.maxWidth=2.42;body.maxWidth=2.42;body.position.set(.22,1.375,.09);metric.position.set(-2.585,-1.1,.09);[title,body,metric,footer].forEach(t=>t.sync());p.layoutReady=true;return;}
 title.sync();body.sync();metric.sync();
 p.layoutReady=false;

 footer.fontSize=.10;footer.position.y=-1.43;footer.sync();
}
export function settleLayout(p){
 if(![p.title,p.body,p.metric].every(t=>t.textRenderInfo))return;
 const {title,body,metric,page}=p;
 if(page.kind!=='book'){
  body.position.y=snap(title.position.y-height(title)-GRID*3);body.position.x=-2.585;
  metric.position.x=-2.585;metric.position.y=snap(body.position.y-height(body)-GRID*3);
  if(page.kind==='skills')metric.position.y=-1.1;
  if(metric.position.y-height(metric)<-1.30&&body.fontSize>.16){body.fontSize=.16;body.sync();}
 }
 p.layoutReady=true;
}
export function auditSurface(page,camera,root){
 const blocks=[];const raycaster=new T.Raycaster();const occluders=[];root.traverseVisible(o=>{if(o.isMesh&&!o.isTroikaText&&!(o.material?.transparent)&&o.layers.mask===1)occluders.push(o);});
 const collisions=[],occlusions=[];
 for(const text of page.texts){if(!text.visible||!text.text||text.fillOpacity<.95)continue;const b=text.textRenderInfo?.blockBounds;if(!b)continue;
  const corners=[[b[0],b[1]],[b[2],b[1]],[b[0],b[3]],[b[2],b[3]]].map(([x,y])=>text.localToWorld(new T.Vector3(x,y,0)));
  const projected=corners.map(p=>p.clone().project(camera));const box=new T.Box2().setFromPoints(projected.map(p=>new T.Vector2(p.x,p.y)));
  blocks.push({text:text.text,box});
  const samples=[...corners,corners[0].clone().lerp(corners[3],.5),corners[0].clone().lerp(corners[3],.25),corners[0].clone().lerp(corners[3],.75)];for(const corner of samples){const vector=corner.clone().sub(camera.position),distance=vector.length();raycaster.set(camera.position,vector.normalize());raycaster.far=distance-.018;
   if(raycaster.intersectObjects(occluders,false).length){occlusions.push(text.text);break;}}
 }
 for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++){const a=blocks[i],b=blocks[j];const width=Math.min(a.box.max.x,b.box.max.x)-Math.max(a.box.min.x,b.box.min.x),height=Math.min(a.box.max.y,b.box.max.y)-Math.max(a.box.min.y,b.box.min.y);if(width>.002&&height>.002)collisions.push([a.text,b.text]);}
 return {ready:!!page.layoutReady,collisions,occlusions,pass:!!page.layoutReady&&!collisions.length&&!occlusions.length};
}
