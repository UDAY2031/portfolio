import * as T from 'three';
import { hash, ramp } from './ease.js';
const box=new T.BoxGeometry(1,1,1), dummy=new T.Object3D();
const colors=['#66513d','#766247','#453025','#84735a','#45494a','#362b24'];
function instances(specs, material) {
    const mesh=new T.InstancedMesh(box,material,specs.length);
    specs.forEach((s,i)=>{dummy.position.set(...s.p);dummy.scale.set(...s.s);dummy.rotation.set(0,0,s.r||0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(s.c)mesh.setColorAt(i,new T.Color(s.c));});
    mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
export class Rooms {
    constructor(data,nodes,parent) {
        this.data=data; this.nodes=nodes;
        this.wood=new T.MeshStandardMaterial({color:'#44372a',roughness:.68,metalness:.15});
        this.bronze=new T.MeshStandardMaterial({color:'#655038',roughness:.42,metalness:.85});
        this.dark=new T.MeshStandardMaterial({color:'#100e0b',roughness:.64,metalness:.25});
        this.books=new T.MeshStandardMaterial({color:'white',roughness:.85,metalness:.04});
        this.glow=new T.MeshBasicMaterial({color:new T.Color('#ffca86').multiplyScalar(2.6),toneMapped:false});
        this.screen=new T.MeshBasicMaterial({map:this.screenTexture(),color:'#c9a16e'});
        for(const material of [this.wood,this.bronze,this.dark,this.books,this.glow,this.screen]) material.transparent=true;
        this.groups=data.map((room,i)=>{
            const root=new T.Group(), shell=new T.Group(), furniture=new T.Group(), doors=[];
            root.position.copy(nodes[i].position);root.quaternion.copy(nodes[i].q);parent.add(root);root.add(shell,furniture);
            const wood=[],metal=[],dark=[],lit=[],books=[],screens=[];
            const add=(list,p,s,c,r)=>list.push({p,s,c,r});
            add(wood,[0,-2.8,0],[5.8,.16,5.8]);add(dark,[0,0,-2.88],[5.8,5.6,.14]);
            // A restrained portal, with lit reveals in the jamb rather than a wireframe box.
            for(const x of [-2.9,2.9]) {
                add(metal,[x,0,2.8],[.16,5.7,.24]);add(lit,[x*.99,0,2.65],[.025,5.5,.035]);
                add(dark,[x,0,0],[.12,5.5,5.6]);
            }
            add(metal,[0,2.8,2.8],[5.8,.16,.24]);add(lit,[0,2.72,2.65],[5.5,.025,.035]);
            add(dark,[0,2.88,0],[5.8,.14,5.8]);
            shell.add(instances(wood,this.wood),instances(metal,this.bronze),instances(dark,this.dark),instances(lit,this.glow));
            for(const sign of [-1,1]) {
                const door=new T.Group(); door.position.set(sign*1.46,0,2.85);
                const slats=[]; for(let j=0;j<7;j++) add(slats,[0,-2.4+j*.8,0],[2.84,.065,.1]);
                add(slats,[sign*1.34,0,0],[.12,5.65,.18]);door.add(instances(slats,this.bronze));shell.add(door);doors.push({door,sign});
            }
            if(!room.empty) {
                const theme=room.theme||'study';
                const desk=(x,z,width=2)=>{
                    add(wood,[x,-1.25,z],[width,.13,1.1]);
                    for(const dx of [-width*.4,width*.4]) add(metal,[x+dx,-2.05,z],[.06,1.5,.6]);
                };
                const monitor=(x,z)=>{
                    add(dark,[x,-.5,z],[1.12,.72,.09]);add(screens,[x,-.5,z+.052],[1.04,.64,.012]);
                    add(metal,[x,-1.0,z],[.08,.28,.08]);add(metal,[x,-1.18,z+.05],[.48,.03,.25]);
                    add(dark,[x,-1.15,z+.5],[.65,.04,.22]);
                };
                const shelf=(x,z,width=1.7)=>{
                    for(let j=0;j<6;j++) {
                        const y=-2.5+j*.85;add(wood,[x,y,z],[width,.07,.48]);add(lit,[x,y+.065,z+.06],[width*.93,.012,.015]);
                        for(let b=0;b<18;b++) {const seed=i*1000+j*41+b+x*11;const h=.42+hash(seed)*.24;
                            add(books,[x-width*.46+b*width*.053,y+.04+h/2,z],[width*.042,h,.27+hash(seed+1)*.07],colors[Math.floor(hash(seed+2)*colors.length)],(hash(seed+3)-.5)*.04);
                        }
                    }
                    for(const dx of [-width*.5,width*.5])add(metal,[x+dx,0,z],[.06,5.2,.52]);
                };
                if(['library','patent-library'].includes(theme)) {
                    shelf(-1.83,-2.4,1.65);shelf(0,-2.4,1.65);shelf(1.83,-2.4,1.65);
                    desk(1.1,.65,2.0);
                    add(books,[1.05,-1.1,.7],[.65,.12,.45],'#baa78a');
                    if(theme==='patent-library') {
                        add(dark,[-1.5,-1.8,.5],[1.0,1.8,1.0]);
                        for(let k=0;k<6;k++) {const angle=k*Math.PI/3;add(metal,[-1.5+Math.cos(angle)*.45,-.65,.5+Math.sin(angle)*.45],[.07,.7,.07]);}
                        add(metal,[-1.5,-.45,.5],[.52,.15,.52]);
                    }
                } else if(['tech-lab','workshop','office'].includes(theme)) {
                    for(const x of [-1.5,1.5]){desk(x,-1.4,2.25);monitor(x,-1.65);}
                    if(theme==='office') {shelf(2,-2.4,1.2);add(wood,[-1.5,-2.4,.4],[1.0,.12,1]);add(dark,[-1.5,-1.7,.1],[1.0,1.4,.12]);}
                    else {add(lit,[0,2,-.8],[3.8,.02,.06]);add(metal,[0,2.45,-.8],[.025,.9,.025]);}
                } else if(theme==='infrastructure') {
                    for(const x of [-1.9,0,1.9]) {
                        add(dark,[x,-.1,-1.7],[1.2,4.8,.9]);
                        for(let j=0;j<11;j++){add(metal,[x,-2.2+j*.4,-1.20],[1.05,.29,.04]);add(lit,[x+.39,-2.2+j*.4,-1.17],[.09,.012,.008]);}
                    }
                    desk(1.5,1,1.5);monitor(1.5,.7);
                } else if(['gallery','arena'].includes(theme)) {
                    for(let j=0;j<3;j++) {const x=(j-1)*1.8;
                        add(dark,[x,-1.95,-.65],[.9,1.55,.9]);add(metal,[x,-.9,-.65],[.22,.55,.22]);
                        add(metal,[x,-.56,-.65],[.62,.12,.45]);add(lit,[x,-1.16,-.65],[.95,.015,.95]);
                    }
                    for(let j=0;j<5;j++)add(metal,[-2+j,1,-2.7],[.65,1.3,.06]);
                } else {
                    shelf(1.9,-2.4,1.5);desk(0,-.6,3.4);
                    add(dark,[-1.5,.5,-2.7],[2.2,1.6,.06]);add(books,[.9,-1.08,-.6],[.55,.19,.45],'#a39173');
                    add(metal,[-1,-.65,-.7],[.05,1.05,.05]);add(lit,[-1,-.1,-.7],[.7,.06,.32]);
                }
                // Shell lists were already uploaded; these contain only furnishings added after it.
                furniture.add(instances(wood.slice(1),this.wood),instances(metal.slice(3),this.bronze),instances(dark.slice(4),this.dark),instances(lit.slice(3),this.glow),instances(books,this.books),instances(screens,this.screen));
            }
            return {root,shell,furniture,doors};
        });
    }
    screenTexture() {
        const w=256,h=160,pixels=new Uint8Array(w*h*4);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
            const line=Math.floor(y/10),indent=14+(line%4)*9;
            const lit=y%10<2&&y>16&&y<140&&x>indent&&x<indent+30+hash(line)*145;
            const k=(y*w+x)*4;pixels[k]=lit?147:9;pixels[k+1]=lit?116:11;pixels[k+2]=lit?73:10;pixels[k+3]=255;
        }
        const texture=new T.DataTexture(pixels,w,h);texture.needsUpdate=true;return texture;
    }
    update(s,camera) {
        this.books.opacity=this.screen.opacity=1-ramp(s.r,3,8);
        this.wood.opacity=1-ramp(s.r,7,12);
        this.bronze.opacity=this.dark.opacity=1-ramp(s.r,10,17);
        this.glow.opacity=1-ramp(s.r,5,11);
        this.groups.forEach((g,i)=>{
            const distance=this.nodes[i].position.distanceTo(camera.position);
            g.root.visible=s.archive&&(distance<46||s.r>=0);
            const lt=s.t-(110+i*19), opening=ramp(lt,-1,5)*(1-ramp(lt,15,21));
            g.doors.forEach(({door,sign})=>{door.position.x=sign*(1.46+opening*1.55);door.rotation.y=sign*opening*.18;});
            g.furniture.visible=this.books.opacity>0 || this.wood.opacity>0 || this.dark.opacity>0;
            g.shell.visible=this.dark.opacity>0;
        });
    }
}
