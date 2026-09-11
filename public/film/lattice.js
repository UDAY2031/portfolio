import * as T from 'three';
import { plusParts, MODULES } from './lattice-geometry.js';
import { CELL, wrapOffset } from './maze.js';
import { ramp } from './ease.js';
const scratch = new T.Object3D();
const rotationGLSL=`vec3 rotateCell(vec3 p,float angle,vec3 axis){return p*cos(angle)+cross(axis,p)*sin(angle)+axis*dot(axis,p)*(1.-cos(angle));}
float quart(float x){x=clamp(x,0.,1.);return x<.5?8.*x*x*x*x:1.-pow(-2.*x+2.,4.)*.5;}`;
function decorate(material, uniforms, count, strip=false) {
    material.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,uniforms);
        shader.vertexShader=`attribute vec3 aCell;uniform float uFold,uRadius,uRelease,uFormation;attribute float aAxis;varying float vAxis;varying vec3 vUnitPosition;uniform vec3 uOffset,uEye,uFoldOrigin;uniform vec3 uRooms[${count}];varying float vCoverage;varying vec3 vLattice;${rotationGLSL}\n`+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('void main() {',`void main() {
            vAxis=aAxis;vUnitPosition=position;vec3 worldCell=aCell+uOffset;
            float axisIndex=mod(abs(worldCell.x/CELL+worldCell.y/CELL*3.+worldCell.z/CELL*7.),3.);
            vec3 foldAxis=axisIndex<1.?vec3(1.,0.,0.):axisIndex<2.?vec3(0.,1.,0.):vec3(0.,0.,1.);
            float delay=min(.32,length(worldCell-uFoldOrigin)*.006);
            float angle=(floor(uFold)+quart((fract(uFold)-delay)/.68))*1.5707963;
        `.replaceAll('CELL',String(CELL)+'.'));
        shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
            #ifdef USE_INSTANCING
            transformedNormal=normalMatrix*rotateCell(mat3(instanceMatrix)*objectNormal,angle,foldAxis);
            #endif`);
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
            vec3 latticePosition=(instanceMatrix*vec4(transformed,1.)).xyz;
            latticePosition=aCell+rotateCell(latticePosition-aCell,angle,foldAxis);
            vLattice=latticePosition+uOffset;
            vec3 distanceCell=abs(worldCell-uEye);
            float radius=max(max(distanceCell.x,distanceCell.y),distanceCell.z);
            vCoverage=(1.-smoothstep(uRadius-8.,uRadius,radius))*uFormation;
            for(int ri=0;ri<${count};ri++){
                if(distance(worldCell,uRooms[ri])<10.5) vCoverage=0.;
            }
            vCoverage*=1.-smoothstep(${strip?'5.,11.':'10.,17.'},uRelease);
            vec4 mvPosition=modelViewMatrix*vec4(latticePosition,1.);
            gl_Position=projectionMatrix*mvPosition;
        `);
        shader.fragmentShader='varying float vCoverage,vAxis;varying vec3 vLattice,vUnitPosition;uniform vec3 uEye,uLitCells[3];uniform float uEmission;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
            float coverage=vCoverage*smoothstep(.55,1.65,length(vLattice-uEye));
            float dither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
            if(coverage<.003)discard; diffuseColor.rgb*=coverage;
        `);
        shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float cellLight=0.;for(int ci=0;ci<3;ci++)cellLight+=1.-smoothstep(5.,8.,distance(vLattice,uLitCells[ci]));
totalEmissiveRadiance+=vec3(1.,.73,.42)*cellLight*16.*coverage;`);
        if(!strip) shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
            // Shelf boards and tightly packed spines on all four long faces.
            // No emissive outlines: the actual area lights must reveal these surfaces.
            vec3 arm=vAxis<.5?vUnitPosition.xyz:vAxis<1.5?vUnitPosition.yzx:vUnitPosition.zxy;
            float across=abs(arm.y)>.49?arm.z:arm.y;
            float row=(arm.x+.5)*5.;
            float spine=(across+.5)*38.;
            float id=floor(spine)+floor(row)*31.;
            float rnd=fract(sin(id*127.1+floor(vLattice.x)*17.)*43758.5453);
            float board=1.-smoothstep(.045,.075,min(fract(row),1.-fract(row)));
            float gap=smoothstep(.018,.10,fract(spine))*(1.-smoothstep(.90,.985,fract(spine)));
            float head=1.-smoothstep(.72+rnd*.15,.8+rnd*.15,fract(row));
            float leather=.30+.55*rnd;
            vec3 book=mix(vec3(.035,.029,.024),vec3(.16,.14,.10),rnd)*leather;
            float spineRidge=pow(max(0.,sin(fract(spine)*3.14159)),.35);
            book*=gap*head*(.45+.55*spineRidge);
            float tooling=(1.-smoothstep(.009,.019,abs(fract(row)-.22)))+(1.-smoothstep(.008,.018,abs(fract(row)-.65)));
            book+=vec3(.09,.064,.030)*tooling*gap*head;
            vec3 oak=vec3(.11,.064,.028)*(.72+.28*sin(across*620.+sin(arm.x*43.)));
            diffuseColor.rgb=mix(book,oak,board);
        `);

    };
    material.customProgramCacheKey=()=>`plus-lattice-${count}-${strip}`;
    return material;
}
export class Lattice {
    constructor(nodes, scene) {
        this.group=new T.Group();this.group.name='lattice'; scene.add(this.group);
        this.uniforms={uLitCells:{value:[new T.Vector3(),new T.Vector3(),new T.Vector3()]},uFold:{value:0},uEmission:{value:0},uOffset:{value:new T.Vector3()},uEye:{value:new T.Vector3()},uFoldOrigin:{value:new T.Vector3()},uRadius:{value:27},uRelease:{value:-1},uFormation:{value:1},uRooms:{value:nodes.map(n=>n.position)}};
        this.structure=decorate(new T.MeshStandardMaterial({color:'#ffffff',roughness:.72,metalness:.15}),this.uniforms,nodes.length);
        const modules=MODULES, parts=plusParts();
        const cells=[];
        for(let x=-6;x<=6;x++) for(let y=-6;y<=6;y++) for(let z=-6;z<=6;z++) cells.push([x*CELL,y*CELL,z*CELL]);
        cells.sort((a,b)=>Math.max(...a.map(Math.abs))-Math.max(...b.map(Math.abs)));
        const count=cells.length*84, centers=new Float32Array(count*3), axes=new Float32Array(count);
        this.beams=new T.InstancedMesh(new T.BoxGeometry(1,1,1),this.structure,count);
        let k=0;
        for(const cell of cells) for(const m of modules) for(const part of parts) {
            scratch.position.set(...part.p.map((v,a)=>(v+m[a])*2+cell[a]));
            scratch.scale.set(...part.scale.map(v=>v*2)); scratch.updateMatrix(); this.beams.setMatrixAt(k,scratch.matrix);
            centers.set(cell,k*3); axes[k]=part.axis; k++;
        }
        for(const mesh of [this.beams]) {
            mesh.geometry.setAttribute('aAxis',new T.InstancedBufferAttribute(axes,1));
            mesh.geometry.setAttribute('aCell',new T.InstancedBufferAttribute(centers,3));
            mesh.instanceMatrix.needsUpdate=true; mesh.frustumCulled=false; this.group.add(mesh); mesh.castShadow=false; mesh.receiveShadow=true;
        }
        this.total=count;
        const superMaterial=new T.MeshStandardMaterial({color:'#211a12',roughness:.7,metalness:.36});
        this.super=new T.InstancedMesh(new T.BoxGeometry(1,1,1),superMaterial,54);let si=0;
        for(let axis=0;axis<3;axis++)for(const a of [-72,-24,24])for(const b of [-24,24,72])for(const c of [-24,24]){scratch.position.set(0,0,0);scratch.position.setComponent(axis,c).setComponent((axis+1)%3,a).setComponent((axis+2)%3,b);scratch.scale.set(2.25,2.25,2.25).setComponent(axis,48);scratch.updateMatrix();this.super.setMatrixAt(si++,scratch.matrix);}
        this.super.frustumCulled=false;this.group.add(this.super);

    }
    armEndpoints(camera) {
        const matrix=new T.Matrix4(), a=new T.Vector3(), b=new T.Vector3(), center=new T.Vector3(), options=[];
        const cells=this.beams.geometry.attributes.aCell;
        for(let i=0;i<Math.min(this.beams.count,125*84);i++) {
            center.fromBufferAttribute(cells,i).add(this.group.position);
            if(this.uniforms.uRooms.value.some(p=>p.distanceTo(center)<8.5))continue;
            this.beams.getMatrixAt(i,matrix);
            const scale=new T.Vector3().setFromMatrixScale(matrix), axis=scale.x>.9?0:scale.y>.9?1:2;
            a.set(0,0,0).setComponent((axis+2)%3,.501).setComponent(axis,-.46).applyMatrix4(matrix).add(this.group.position);
            b.set(0,0,0).setComponent((axis+2)%3,.501).setComponent(axis,.46).applyMatrix4(matrix).add(this.group.position);
            const ca=a.clone().project(camera),cb=b.clone().project(camera);
            if(ca.z<0||ca.z>1||cb.z<0||cb.z>1||Math.abs(ca.x)>1.4||Math.abs(ca.y)>1.4)continue;
            options.push({a:a.clone(),b:b.clone(),score:ca.distanceTo(cb)/(1+Math.abs(ca.x)+Math.abs(ca.y))});
        }
        return options.sort((a,b)=>b.score-a.score).slice(0,4);
    }
    setQuality(q) {
        const rings=6; void q;
        this.beams.count=(2*rings+1)**3*84;
        this.uniforms.uRadius.value=rings*CELL+2;
    }
    update(s,camera,pose) {
        const offset=wrapOffset(camera.position.toArray());
        this.group.position.set(...offset); this.group.visible=s.archive;
        this.super.position.set(...camera.position.toArray().map((v,i)=>Math.floor(v/48)*48-offset[i]));this.super.visible=s.r<12;
        const u=this.uniforms;
        u.uOffset.value.copy(this.group.position); u.uEye.value.copy(camera.position);
        u.uFold.value=pose.fold; u.uFoldOrigin.value.copy(camera.position);
        u.uRelease.value=s.r; u.uFormation.value=1;
        this.uniforms.uEmission.value=(2.6+1.4*Math.sin(pose.fold*Math.PI))*(1-ramp(s.r,5,11));
    }
}
