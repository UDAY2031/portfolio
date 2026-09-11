import * as T from 'three';
import { hash, ramp } from './ease.js';
export class Atmosphere {
    constructor(rooms,nodes,parent) {
        this.uniforms={uTime:{value:0},uRelease:{value:-1},uFormation:{value:1},uEye:{value:new T.Vector3()},uAnchor:{value:new T.Vector3()},uTaut:{value:0}};
        const count=rooms.reduce((n,r,i)=>n+4+i%4,0),geometry=new T.PlaneGeometry(.14,8,1,32),indices=new Float32Array(count);
        const material=new T.ShaderMaterial({uniforms:this.uniforms,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,
            vertexShader:`attribute float aRoom;uniform float uTime,uRelease,uFormation;uniform vec3 uEye;varying vec2 vUv;varying float vGlow;void main(){vUv=uv;float lt=uTime-110.-aRoom*19.;float taut=smoothstep(2.,7.,lt)*(1.-smoothstep(14.,19.,lt));vec3 center=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;vec3 up=normalize(mat3(instanceMatrix)*vec3(0.,1.,0.));vec3 right=normalize(cross(up,normalize(uEye-center)));vec3 p=center+up*position.y+right*(position.x+sin(position.y*.9+uTime*.3+aRoom)*.10*(1.-taut));vec4 mv=viewMatrix*vec4(p,1.);vGlow=(.25+taut*.75)*uFormation*(1.-smoothstep(aRoom*.4,aRoom*.4+2.,uRelease))*exp(-.002*mv.z*mv.z);gl_Position=projectionMatrix*mv;}`,
            fragmentShader:`varying vec2 vUv;varying float vGlow;void main(){float a=exp(-pow((vUv.x-.5)*2.,2.)*55.)*sin(vUv.y*3.14159);gl_FragColor=vec4(vec3(1.,.69,.35)*2.6,a*vGlow);}`});
        this.threads=new T.InstancedMesh(geometry,material,count);const dummy=new T.Object3D();let n=0;
        rooms.forEach((room,i)=>{for(let j=0;j<4+i%4;j++){dummy.position.copy(nodes[i].world([j===0?-2.55:(hash(i*13+j)-.5)*7,0,(hash(i*37+j)-.5)*5]));dummy.quaternion.copy(nodes[i].q);dummy.scale.set(1,1,1);dummy.updateMatrix();this.threads.setMatrixAt(n,dummy.matrix);indices[n++]=i;}});
        geometry.setAttribute('aRoom',new T.InstancedBufferAttribute(indices,1));this.threads.computeBoundingSphere();this.threads.name='time strands';parent.add(this.threads);
        const dustGeo=new T.InstancedBufferGeometry(),quad=new T.PlaneGeometry(1,1);dustGeo.index=quad.index;dustGeo.attributes.position=quad.attributes.position;dustGeo.attributes.uv=quad.attributes.uv;
        const seeds=new Float32Array(40000*3);for(let i=0;i<seeds.length;i++)seeds[i]=hash(i+341);dustGeo.setAttribute('aSeed',new T.InstancedBufferAttribute(seeds,3));dustGeo.instanceCount=40000;
        const dustMat=new T.ShaderMaterial({uniforms:this.uniforms,transparent:true,blending:T.AdditiveBlending,depthWrite:false,
            vertexShader:`attribute vec3 aSeed;uniform float uTime,uRelease,uFormation,uTaut;uniform vec3 uEye,uAnchor;varying vec2 vUv;varying float vLight;void main(){vUv=uv;vec3 p=(aSeed-.5)*48.;p=uEye+mod(p-uEye+24.,48.)-24.;p+=sin(aSeed*51.+uTime*.17)*.09;float near=1.-smoothstep(2.,9.,distance(p,uAnchor));p=mix(p,uAnchor,uTaut*near*.35);p+=(aSeed-.5)*smoothstep(0.,12.,uRelease)*100.;vec3 bands=pow(max(vec3(0.),cos(p*3.14159/3.)),vec3(30.));vLight=max(bands.x,max(bands.y,bands.z))*uFormation*(1.-smoothstep(16.,24.,length(p-uEye)));vec4 mv=viewMatrix*vec4(p,1.);vLight*=exp(-.002*mv.z*mv.z);mv.xy+=position.xy*.02;gl_Position=projectionMatrix*mv;}`,
            fragmentShader:`varying vec2 vUv;varying float vLight;void main(){float a=exp(-dot(vUv-.5,vUv-.5)*22.)*vLight*.28;gl_FragColor=vec4(1.,.66,.3,a);}`});
        this.dust=new T.Mesh(dustGeo,dustMat);this.dust.frustumCulled=false;parent.add(this.dust);
        const shaftsGeo=new T.PlaneGeometry(1,1),shaftsMat=new T.ShaderMaterial({uniforms:this.uniforms,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,vertexShader:`varying vec2 vUv;varying float vDepth;void main(){vUv=uv;vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying vec2 vUv;varying float vDepth;uniform float uFormation,uRelease;void main(){float a=pow(sin(vUv.x*3.14159),5.)*sin(vUv.y*3.14159)*.014*uFormation*(1.-smoothstep(5.,15.,uRelease))*exp(-.004*vDepth*vDepth);gl_FragColor=vec4(1.,.6,.28,a);}`});
        this.shafts=new T.InstancedMesh(shaftsGeo,shaftsMat,nodes.length*3);
        nodes.forEach((node,i)=>{for(let j=0;j<3;j++){dummy.position.copy(node.world([(j-1)*2,0,-1]));dummy.quaternion.copy(node.q);dummy.rotateZ((j-1)*.3);dummy.scale.set(.8,8,1);dummy.updateMatrix();this.shafts.setMatrixAt(i*3+j,dummy.matrix);}});this.shafts.computeBoundingSphere();parent.add(this.shafts);
    }
    setQuality(q){this.dust.geometry.instanceCount=40000;this.shafts.visible=true;void q;}
    update(s,camera,node){const u=this.uniforms;this.threads.visible=s.rt<5.8||s.rt>32;this.dust.visible=s.rt<5.8||s.rt>32;this.shafts.visible=s.rt<5.8||s.rt>32;u.uTime.value=s.t;u.uRelease.value=s.r;u.uFormation.value=ramp(s.t,100.5,102);u.uEye.value.copy(camera.position);u.uAnchor.value.copy(node.world([-2.55,0,0]));u.uTaut.value=ramp(s.rt,2,7)*(1-ramp(s.rt,14,19));}
}
