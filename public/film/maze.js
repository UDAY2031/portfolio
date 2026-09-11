import * as T from 'three';
import { plusParts, MODULES } from './lattice-geometry.js';
import { clamp, cubic, ramp, mix, noise } from './ease.js';
export const CELL = 12;
export const wrapOffset = p => p.map(v => Math.floor(v / CELL) * CELL);
export function random(seed) { let a = seed | 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const faces = [[0,0,1],[1,0,0],[0,-1,0],[-1,0,0],[0,1,0],[0,0,-1]];
// Raycast the repeated solid arms, skipping the cleared room chambers at both ends.
// This is generation-time visibility validation, independent of wrap offset and render LOD.
export function roomsOccluded(a,b) {
    const direction=b.clone().sub(a),length=direction.length();direction.normalize();
    const ray=new T.Ray(a,direction), box=new T.Box3(), hit=new T.Vector3(), checked=new Set();
    for(let d=9;d<length-9;d+=3) {
        const p=a.clone().addScaledVector(direction,d),cell=p.toArray().map(v=>Math.round(v/CELL));
        for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++) {
            const c=new T.Vector3((cell[0]+x)*CELL,(cell[1]+y)*CELL,(cell[2]+z)*CELL),key=c.toArray().join(',');
            if(checked.has(key)||c.distanceTo(a)<8.5||c.distanceTo(b)<8.5)continue;checked.add(key);
            for(const plusOffset of MODULES)for(const part of plusParts()) {
                const center=new T.Vector3(...part.p).add(new T.Vector3(...plusOffset)).add(c);
                box.setFromCenterAndSize(center,new T.Vector3(...part.scale));
                if(ray.intersectBox(box,hit)&&hit.distanceTo(a)<length-6)return true;
            }
        }
    }
    return false;
}
function roundedPath(points) {
    const dense=[points[0].clone()];
    for(let i=1;i<points.length;i++){
        const steps=Math.max(1,Math.ceil(points[i-1].distanceTo(points[i])/1.5));
        for(let j=1;j<=steps;j++)dense.push(points[i-1].clone().lerp(points[i],j/steps));
    }
    return new T.CatmullRomCurve3(dense,false,'centripetal');
}
export class Maze {
    constructor(rooms, seed = 2031) {
        const rng = random(seed);
        this.nodes = [];
        const occupied = new Set();
        for (let i = 0; i < rooms.length; i++) {
            let cell = [0,0,0], attempts = 0;
            if (i && !rooms[i].layout) do {
                const prev = this.nodes[i-1].cell;
                cell = prev.map(v => clamp(v + (rng() < .5 ? -1 : 1) * (3 + Math.floor(rng()*4)), -19, 19));
                if (++attempts > 2000) throw new Error('The maze could not find a clear room placement. Try a different seed.');
            } while (occupied.has(cell.join(',')) || this.nodes.some(n => n.cell.filter((v,k)=>v!==cell[k]).length < 2 || Math.hypot(...cell.map((v,k)=>v-n.cell[k])) < 3 || !roomsOccluded(n.position,new T.Vector3(...cell.map(v=>v*CELL)))));
            if(rooms[i].layout)cell=rooms[i].layout.position.map(v=>v/CELL);
            occupied.add(cell.join(','));
            // Cycling a seeded face permutation guarantees vertical entrances, even for short journeys.
            const face = faces[(i + Math.abs(seed | 0) % 6) % 6];
            const normal = new T.Vector3(...face);
            const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1), normal);
            q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1), Math.floor(rng()*4)*Math.PI/2));
            if(rooms[i].layout?.rotation)q.setFromEuler(new T.Euler(...rooms[i].layout.rotation));
            const position = new T.Vector3(...cell.map(v=>v*CELL));
            const world = v => new T.Vector3(...v).applyQuaternion(q).add(position);
            const node = { cell, position, normal, q, world, held: world([0,.3,3.4]), entry: world([0,.3,6]), staging:world([3,3,6]), corner:world([3,3,9]), exit: world([0,.3,6]), up: new T.Vector3(0,1,0).applyQuaternion(q) };
            this.nodes.push(node);
        }
        const first=this.nodes[0];
        this.arrival=roundedPath([[15,15,27],[9,15,27],[9,9,27],[9,9,21],[3,9,21],[3,3,21],[3,3,9]].map(p=>first.world(p)).concat([first.staging,first.entry,first.held]));
        this.transitions = [];
        for (let i=0;i<this.nodes.length-1;i++) {
            const a=this.nodes[i], b=this.nodes[i+1];
            // Travel the voids at cell corners: two coordinates remain halfway
            // between plus centres while the third moves. Rounded elbows retain clearance.
            const from=a.corner, to=b.corner, rise=from.clone();
            rise.y += (i%2?-1:1)*CELL*2;
            const elbow=new T.Vector3(to.x,rise.y,from.z), turn=new T.Vector3(to.x,rise.y,to.z);
            const points=[a.held,a.exit,a.staging,from,rise,elbow,turn,to,b.staging,b.entry,b.held].filter((p,j,all)=>j===0||p.distanceTo(all[j-1])>.01);
            const authored=rooms[i].travelToNext;this.transitions.push(roundedPath(authored?[a.held,...authored.points.map(p=>new T.Vector3(...p)),b.held]:points));
        }
        this.tracks=rooms.map(r=>r.travelToNext);
        this.center = this.nodes.reduce((v,n)=>v.add(n.position),new T.Vector3()).divideScalar(this.nodes.length);
        this.radius = Math.max(20,...this.nodes.map(n=>n.position.distanceTo(this.center)));
    }
    sample(s) {
        const node=this.nodes[s.room];
        let position=node.held.clone(), q=node.q.clone(), traveling=0, fold=0;
        let transition=-1, u=0;
        if(s.segment){transition=s.segment.index;u=s.segment.originalDirection>0?s.segment.u:1-s.segment.u;}
        else if (s.rt<4 && s.room>0) { transition=s.room-1; u=(s.rt+8)/12; }
        else if(s.rt>32 && s.room<this.nodes.length-1) { transition=s.room; u=(s.rt-32)/12; }
        if(transition>=0) {
            const curve=this.transitions[transition], a=this.nodes[transition], b=this.nodes[transition+1];
            const track=this.tracks[transition];let progress=u;if(track?.name==='fold')progress=u<.35?u/.35*.45:u<.65?.45:.45+(u-.65)/.35*.55;
            const travel=cubic(progress); position=curve.getPointAt(travel);
            const tangent=curve.getTangentAt(clamp(travel, .00001,.99999));
            const up=a.up.clone().lerp(b.up,cubic(u));
            if(up.lengthSq()<.01 || Math.abs(up.clone().normalize().dot(tangent))>.95) up.set(1,.31,.17);
            const rotation=new T.Matrix4().lookAt(position,position.clone().add(tangent),up.normalize());
            q.setFromRotationMatrix(rotation);
            q.slerp(a.q,1-ramp(u,0,.18)); q.slerp(b.q,ramp(u,.80,1));
            q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.sin(u*Math.PI)*T.MathUtils.degToRad(track?.roll||0)));
            traveling=Math.sin(Math.PI*u);
            fold=track?.name==='fold'?ramp(u,.35,.65):0;
        } else if(s.room===0 && s.t<118.4) {
            // Slow descent through the corner void. The room retains its seeded orientation.
            const fall=ramp(s.t,101.9,110.9), arrest=ramp(s.t,110.9,114.4), approach=ramp(s.t,114.4,118.4);
            const top=node.world([3,21,9]),bottom=node.world([3,3,9]);
            position.copy(top).lerp(bottom,fall).lerp(node.entry,arrest).lerp(node.held,approach);
            const look=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(position,node.world([0,-8,0]),node.up));
            q.copy(look).slerp(node.q,ramp(s.t,109,114.4));q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.sin(fall*Math.PI)*.21));
            fold=ramp(s.t,104.15,105.65)+ramp(s.t,107.75,109.25);traveling=1-approach;
        }
        if(s.segment?.startPose){const blend=1-ramp(s.segment.u,0,.18);position.lerp(new T.Vector3(...s.segment.startPose.position),blend);q.slerp(new T.Quaternion(...s.segment.startPose.quaternion),blend);}
        if(s.r>=0) {
            const a=ramp(s.r,0,14);
            position.lerp(this.center.clone().add(new T.Vector3(this.radius*1.2,this.radius*.8,this.radius*1.5)),a);
            const targetQ=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(position,this.center,new T.Vector3(0,1,0)));
            q.slerp(targetQ,a); traveling=a;
        }
        return { position, q, traveling, fold, transition, fov: mix(58,65,traveling) };
    }
    apply(camera,s,reduced=false) {
        const pose=this.sample(s);
        camera.position.copy(pose.position); camera.quaternion.copy(pose.q);
        const amplitude=s.reveal>0?0:1;
        if(!reduced) {
            camera.position.add(new T.Vector3(noise(s.t*.15,4),noise(s.t*.12,61),noise(s.t*.11,7)).multiplyScalar(.015*amplitude));
            camera.rotateZ(noise(s.t*.08,19)*.00436*amplitude);
        }
        camera.fov=pose.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
        return pose;
    }
}
