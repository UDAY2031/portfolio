import * as T from 'three';
import { clamp, ramp } from './ease.js';
export const LAYER_TEXT=1;
export function anchorFor(node,surface){
 const center=surface.getWorldPosition(new T.Vector3());const q=surface.getWorldQuaternion(new T.Quaternion());if(surface.userData.kind==='monitor')center.add(new T.Vector3(0,-.35,0).applyQuaternion(q));
 return {position:center.clone().add(new T.Vector3(0,0,surface.userData.kind==='monitor'?5.4:4.9).applyQuaternion(q)),quaternion:q,fov:58,surfaceNormalAngle:18,frameCoverage:[.45,.65]};
}
export function checkAnchor(surface,camera,height=innerHeight){
 const center=surface.getWorldPosition(new T.Vector3()),q=surface.getWorldQuaternion(new T.Quaternion());
 const normal=new T.Vector3(0,0,1).applyQuaternion(q),view=camera.position.clone().sub(center).normalize();
 const angle=T.MathUtils.radToDeg(Math.acos(clamp(normal.dot(view),-1,1)));
 const distance=camera.position.distanceTo(center),pixelScale=height/(2*distance*Math.tan(T.MathUtils.degToRad(camera.fov/2)));
 const capHeight=surface.userData.fontSize*.73*pixelScale,coverage=surface.userData.height*pixelScale/height;
 const contrast=(.83+.05)/(.055+.05);
 return {angle,capHeight,contrast,coverage,pass:angle<=18&&capHeight>=(height<600?20:22)*height/(height<600?height:1080)&&coverage>=.45&&coverage<=.65};
}
// Project the surface foot into a compact link, updating after camera look-around.
export function projectLink(element,surface,camera,visible){
 if(!visible){element.hidden=true;return;}
 const w=surface.userData.width,h=surface.userData.height;
 const corners=[[-w/2,-h/2+.12],[w/2,-h/2+.12],[-w/2,-h/2+.42],[w/2,-h/2+.42]].map(([x,y])=>surface.localToWorld(new T.Vector3(x,y,.018)).project(camera));
 if(corners.some(p=>p.z>1||p.z<0)){element.hidden=true;return;}
 const normal=new T.Vector3(0,0,1).applyQuaternion(surface.getWorldQuaternion(new T.Quaternion()));
 if(normal.dot(camera.position.clone().sub(surface.getWorldPosition(new T.Vector3())).normalize())<.95){element.hidden=true;return;}
 const x=(corners[0].x+1)*innerWidth/2,y=(1-corners[2].y)*innerHeight/2;
 const width=(corners[1].x-corners[0].x)*innerWidth/2,height=(corners[2].y-corners[0].y)*innerHeight/2;
 element.hidden=false;element.style.cssText=`position:fixed;left:${x}px;top:${y}px;width:${width}px;height:${height}px;font-size:${Math.max(12,height*.58)}px;line-height:${height}px;transform:rotate(${Math.atan2(corners[0].y-corners[1].y,corners[1].x-corners[0].x)}rad);transform-origin:left bottom`;
}
export function pageCue(pages,rt){const span=24/pages.length,local=Math.max(0,rt-5.8),index=Math.min(pages.length-1,Math.floor(local/span)),p=local-index*span;return {index,p,span,arrival:ramp(rt,4,5.8)};}
