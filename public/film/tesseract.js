import * as T from 'three';
import { Maze } from './maze.js';
import { Atmosphere } from './atmosphere.js';
import { DiegeticRooms } from './diegetic.js';

import { Lattice } from './lattice.js';
import { ramp } from './ease.js';
export class Archive {
    constructor(rooms,scene,quality,seed=2031) {
        this.rooms=rooms; this.scene=scene;
        this.rig=new Maze(rooms,seed);
        this.lattice=new Lattice(this.rig.nodes,scene);
        this.root=new T.Group(); scene.add(this.root);
        this.debugGroup=new T.Group(); this.debugGroup.visible=false; this.root.add(this.debugGroup);
        for(const node of this.rig.nodes) this.debugGroup.add(new T.Box3Helper(new T.Box3().setFromCenterAndSize(node.position,new T.Vector3(6,6,6)),0xb68c4b));
        this.area=new T.RectAreaLight('#ffcd97',9,6,4); scene.add(this.area);
        this.key=new T.SpotLight('#ffe1b0',120,32,.9,.9,1.2); scene.add(this.key,this.key.target);
        this.key.shadow.mapSize.set(2048,2048); this.key.shadow.bias=-.0002; this.key.shadow.normalBias=.04;
        this.interiors=new DiegeticRooms(rooms,this.rig.nodes,this.root);
        this.atmosphere=new Atmosphere(rooms,this.rig.nodes,this.root);
        
        const beacons=new T.MeshBasicMaterial({color:new T.Color('#ffb257').multiplyScalar(2.6),fog:false,transparent:true});
        this.beacons=new T.InstancedMesh(new T.SphereGeometry(.22,8,6),beacons,rooms.length);
        const beaconMatrix=new T.Matrix4();this.rig.nodes.forEach((node,i)=>this.beacons.setMatrixAt(i,beaconMatrix.makeTranslation(...node.position.toArray())));
        this.beacons.computeBoundingSphere();this.root.add(this.beacons);
        this.panels=new T.Group();scene.add(this.panels);
        this.litCells=[[-12,12,-24],[24,-12,-24],[-24,24,12]].map(p=>new T.Vector3(...p));
        this.litCells.forEach(p=>{const light=new T.RectAreaLight('#ffd2a0',24,7,7);light.position.copy(p);light.lookAt(0,0,0);this.panels.add(light);});
        this.setQuality(quality);
    }
    setQuality(q) {this.quality=q;const effective='high';this.lattice.setQuality(effective);this.key.castShadow=effective==='high';this.atmosphere?.setQuality(effective);}
    update(s,camera,director) {
        this.root.visible=s.archive;this.panels.visible=s.archive&&(s.t<114.4||s.rt<4||s.rt>32||s.r>=0);
        
        if(!s.archive){this.lattice.group.visible=false;this.key.intensity=this.area.intensity=0;return;}
        const pose=this.rig.apply(camera,s,this.reducedMotion);
        if(this.foldTime!==undefined){this.foldTime=Math.min(1.5,this.foldTime+(s.dt||0));pose.fold=Math.max(pose.fold,(this.foldCount-1)+ramp(this.foldTime,0,1.5));}if(this.manualFoldAt!==undefined)pose.fold=Math.max(pose.fold,ramp(s.t,this.manualFoldAt,this.manualFoldAt+1.5));
        this.lattice.update(s,camera,pose);this.panels.position.copy(camera.position).divideScalar(48).floor().multiplyScalar(48);this.panels.quaternion.identity();this.litCells.forEach((p,i)=>this.lattice.uniforms.uLitCells.value[i].copy(p).add(this.panels.position));
        this.scene.fog.density=.022;
        this.beacons.visible=s.r>=0; this.beacons.material.opacity=ramp(s.r,1,5)*(1-ramp(s.r,10,17));
        this.key.position.copy(camera.position).add(new T.Vector3(-2,1.4,1).applyQuaternion(camera.quaternion));
        this.key.target.position.copy(camera.position).add(new T.Vector3(0,0,-8).applyQuaternion(camera.quaternion));
        this.area.position.copy(this.key.position);this.area.lookAt(this.key.target.position);
        this.key.castShadow=s.rt<4||s.rt>32;this.key.intensity=48*(1-ramp(s.r,9,17)); this.area.intensity=3.5*(1-ramp(s.r,9,17));
        this.interiors.update(s,camera,director);
        this.atmosphere.update(s,camera,this.rig.nodes[s.room]);
        
        s.move=pose.traveling;
    }
}
