import * as T from 'three';
import { clamp, ramp, mix, hash, noise } from './ease.js';
import { Reveals } from './reveals.js';
import { roomBeat } from './timing.js';
const BOX = new T.BoxGeometry(1, 1, 1), matrix = new T.Matrix4(), dummy = new T.Object3D();
const palette = ['#514234', '#75634a', '#382620', '#8e7958', '#483d36', '#51412d', '#363a3b', '#927e63'];
function batch(specs, material) {
    const mesh = new T.InstancedMesh(BOX, material, specs.length);
    specs.forEach((s, i) => { dummy.position.set(...s.p); dummy.rotation.set(...(s.r || [0, 0, 0])); dummy.scale.set(...s.s); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); if (s.c)
        mesh.setColorAt(i, new T.Color(s.c)); });
    mesh.computeBoundingSphere();
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
}
function woodTexture() {
    const a = new Uint8Array(128 * 128 * 4);
    for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++) {
            const n = (Math.sin(y * .9 + noise(x * .05, 3) * 2) * .5 + .5) * 13 + hash(y * 128 + x) * 10;
            const k = (y * 128 + x) * 4;
            a[k] = 100 + n;
            a[k + 1] = 73 + n * .8;
            a[k + 2] = 48 + n * .5;
            a[k + 3] = 255;
        }
    const map = new T.DataTexture(a, 128, 128);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(2, 1);
    map.needsUpdate = true;
    return map;
}
function bookAtlas() {
    const a = new Uint8Array(512 * 512 * 4);
    const colors = palette.map(c => new T.Color(c));
    for (let y = 0; y < 512; y++)
        for (let x = 0; x < 512; x++) {
            const shelf = Math.floor(y / (512 / 5)), yy = (y % (512 / 5)) / (512 / 5), b = Math.floor(x / 12.8), xx = (x % 12.8) / 12.8;
            const h = .54 + hash(shelf * 40 + b) * .3, c = colors[Math.floor(hash(b + shelf * 100) * colors.length)];
            const v = yy > .12 && yy < h && xx > .09 ? .5 : yy > .91 ? .22 : .025;
            const k = (y * 512 + x) * 4;
            a[k] = 255 * c.r * v;
            a[k + 1] = 255 * c.g * v;
            a[k + 2] = 255 * c.b * v;
            a[k + 3] = 255;
        }
    const tex = new T.DataTexture(a, 512, 512);
    tex.needsUpdate = true;
    return tex;
}
// Opaque geometry keeps early depth rejection. A deterministic coverage mask
// dissolves the books/shelves/ribs and blends near books into their LOD atlas.
function coverageMaterial(material, role, uniforms) {
    material.transparent = false;
    material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = 'varying vec3 vArchiveWorld;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
            vec4 archiveWorld=vec4(transformed,1.);
            #ifdef USE_INSTANCING
                archiveWorld=instanceMatrix*archiveWorld;
            #endif
            vArchiveWorld=(modelMatrix*archiveWorld).xyz;`);
        shader.fragmentShader = `varying vec3 vArchiveWorld;
            uniform float uArchiveRelease, uArchiveRadius;
            ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
            float ring=abs(vArchiveWorld.z-cameraPosition.z)/4.;
            float archiveCoverage=1.;
            if(uArchiveRelease<0.){
                archiveCoverage=1.-smoothstep(uArchiveRadius-1.,uArchiveRadius,ring);
                ${role === 'books' ? 'archiveCoverage*=1.-smoothstep(1.4,2.1,ring);' : ''}
                ${role === 'atlas' ? 'archiveCoverage*=smoothstep(1.4,2.1,ring);' : ''}
            }
            archiveCoverage*=diffuseColor.a;
            if(archiveCoverage<.99999){
                float coverageNoise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
                ${role === 'atlas' ? 'coverageNoise=1.-coverageNoise;' : ''}
                if(coverageNoise>=archiveCoverage)discard;
            }`);
    };
    material.customProgramCacheKey = () => `archive-coverage-${role}`;
    return material;
}
export class CameraRig {
    constructor(count) {
        this.count = count;
        const pts = [];
        for (let i = -1; i <= count; i++)
            pts.push(new T.Vector3(Math.sin(i * .75) * .42, Math.sin(i * .42) * .22, 4 - i * 12));
        this.curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', .2);
        this.lookCurve = new T.CatmullRomCurve3(pts.map(p => p.clone().add(new T.Vector3(0, .08, -9))), false, 'catmullrom', .2);
    }
    apply(camera, s, reduced = false) {
        const path = s.t < 110 ? mix(-17, -5, ramp(s.t, 105, 110)) : s.path;
        const u = clamp((path / 12 + 1) / (this.count + 1));
        this.curve.getPoint(u, camera.position);
        const target = this.lookCurve.getPoint(u);
        if (s.r >= 0) {
            const e = ramp(s.r, 0, 14);
            camera.position.x += e * 80;
            camera.position.y += e * 55;
            camera.position.z += e * 110;
            target.set(0, 0, -(this.count - 1) * 6);
            target.lerp(this.lookCurve.getPoint(u), 1 - e);
        }
        if (!reduced) {
            camera.position.x += noise(s.t * .15, 4) * .02;
            camera.position.y += noise(s.t * .12, 61) * .02;
            target.x += noise(s.t * .11, 8) * .045;
            target.y += noise(s.t * .13, 41) * .045;
        }
        camera.lookAt(target);
        camera.rotateZ(reduced ? 0 : noise(s.t * .08, 19) * .0052);
        camera.fov = camera.aspect < .8 ? 66 : 55;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
    }
}
export class Archive {
    constructor(rooms, scene, quality) {
        this.rooms = rooms;
        this.scene = scene;
        this.root = new T.Group();
        scene.add(this.root);
        this.rig = new CameraRig(rooms.length);
        this.chunks = [];
        this.debugGroup = new T.Group();
        this.debugGroup.visible = false;
        this.root.add(this.debugGroup);
        this.wood = new T.MeshStandardMaterial({ map: woodTexture(), color: '#a28a6a', roughness: .82, metalness: .08, transparent: true });
        this.bronze = new T.MeshStandardMaterial({ color: '#806443', emissive: '#593917', emissiveIntensity: 0, roughness: .34, metalness: .78, transparent: true });
        this.books = new T.MeshStandardMaterial({ color: '#ffffff', roughness: .87, metalness: .02, transparent: true });
        this.strip = new T.MeshBasicMaterial({ color: new T.Color('#ffb257').multiplyScalar(2.4), toneMapped: false });
        this.flatBooks = new T.MeshBasicMaterial({ map: bookAtlas(), color: '#8b7359', side: T.DoubleSide });
        this.coverageUniforms = { uArchiveRelease: { value: -1 }, uArchiveRadius: { value: 6 } };
        coverageMaterial(this.wood, 'shelves', this.coverageUniforms);
        coverageMaterial(this.bronze, 'ribs', this.coverageUniforms);
        coverageMaterial(this.books, 'books', this.coverageUniforms);
        coverageMaterial(this.flatBooks, 'atlas', this.coverageUniforms);
        coverageMaterial(this.strip, 'strips', this.coverageUniforms);
        // Each z slice is a cullable chunk. Four inward orientations, including inverted ceilings;
        // the outer 7×7 cross-section recurs past the corridor without a ground plane.
        for (let iz = -4; iz < rooms.length * 3 + 5; iz++)
            this.makeChunk(iz);
        this.key = new T.SpotLight('#ffd19a', 95, 35, .85, .9, 1.4);
        this.key.castShadow = true;
        this.key.shadow.mapSize.set(1024, 1024);
        this.key.shadow.bias = -.0002;
        this.key.shadow.normalBias = .045;
        this.key.shadow.radius = 4;
        this.key.shadow.autoUpdate = false;
        this.lastShadowKey = '';
        scene.add(this.key, this.key.target);
        // A single soft source accompanies the observer; no ambient or hemisphere light.
        this.area = new T.RectAreaLight('#ffd4a0', 5.8, 5, 3);
        scene.add(this.area);
        this.makeThreads();
        this.makeDust();
        this.makeShafts();
        this.reveals = new Reveals(rooms, this.root);
        this.setQuality(quality);
    }
    makeChunk(iz) {
        const z = -iz * 4, room = clamp(Math.floor(iz / 3), 0, this.rooms.length - 1), maturity = room / Math.max(1, this.rooms.length - 1), gap = 2.75 + maturity * .6;
        const group = new T.Group(), ribs = [], boards = [], books = [], strips = [], mid = [];
        this.root.add(group);
        for (let x = -3; x <= 3; x++)
            for (let y = -3; y <= 3; y++) {
                if (x === 0 && y === 0)
                    continue;
                const cx = x * 4, cy = y * 4;
                // At most four major frame edges dominate the near corridor; outer ribs stay dark.
                for (const dx of [-2, 2])
                    ribs.push({ p: [cx + dx, cy, z], s: [.12, 4, .12] });
                ribs.push({ p: [cx, cy - 2, z], s: [4, .12, .12] });
            }
        for (let face = 0; face < 4; face++) {
            // Rotate the same shelf wall through all four inward-facing corridor surfaces.
            const rotation = face * Math.PI / 2, q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), rotation);
            const transform = (p, s, c, r) => { const v = new T.Vector3(...p).applyQuaternion(q); return { p: [v.x, v.y, z + v.z], s, r: [0, 0, rotation + (r || 0)], c }; };
            for (let lane = -1; lane <= 1; lane++) {
                const side = lane * 4;
                for (let shelf = 0; shelf < 5; shelf++) {
                    const y = -1.92 + shelf * .76;
                    boards.push(transform([gap, y + side, 0], [.38, .085, 3.92]));
                    strips.push(transform([gap + .15, y + side + .10, 0], [.018, .025, 3.78]));
                    if (!this.rooms[room].empty && lane === 0)
                        for (let j = 0; j < 40; j++) {
                            const seed = iz * 1049 + face * 331 + shelf * 67 + j, h = .38 + hash(seed) * .27, w = .057 + hash(seed + 2) * .025;
                            books.push(transform([gap - .012, y + side + .045 + h / 2, -1.90 + j * .097], [.23 + hash(seed + 3) * .09, h, w], palette[Math.floor(hash(seed + 4) * palette.length)], (hash(seed + 5) - .5) * .022));
                        }
                }
                for (const dz of [-1.98, 1.98])
                    ribs.push(transform([gap - .06, side, dz], [.12, 4, .12]));
            }
            const p = new T.Mesh(new T.PlaneGeometry(4, 4), this.flatBooks);
            p.position.set(gap, 0, z);
            p.rotation.y = -Math.PI / 2;
            p.position.applyAxisAngle(new T.Vector3(0, 0, 1), rotation);
            p.quaternion.premultiply(q);
            group.add(p);
            mid.push(p);
        }
        const uniqueRibs = [...new Map(ribs.map(rib => [JSON.stringify(rib), rib])).values()];
        const ribMesh = batch(uniqueRibs, this.bronze), boardMesh = batch(boards, this.wood), bookMesh = batch(books, this.books), stripMesh = batch(strips, this.strip);
        bookMesh.castShadow = true;
        bookMesh.receiveShadow = true;
        boardMesh.receiveShadow = true;
        group.add(ribMesh, boardMesh, bookMesh, stripMesh);
        this.chunks.push({ iz, z, room, group, ribMesh, boardMesh, bookMesh, stripMesh, mid });
        if (iz % 3 === 0) {
            const box = new T.Box3Helper(new T.Box3(new T.Vector3(-gap, -gap, z - 2), new T.Vector3(gap, gap, z + 2)), 0xb68c4b);
            this.debugGroup.add(box);
        }
    }
    makeThreads() {
        this.threadSpecs = [];
        this.rooms.forEach((room, i) => { for (let j = 0; j < 4 + Math.floor(i / 3); j++)
            this.threadSpecs.push({ room: i, j, seed: hash(i * 31 + j), x: j === 0 ? -1.7 : mix(-2.6, 2.6, hash(i * 65 + j * 13)), z: -i * 12 - 1.5 + (j === 0 ? 0 : hash(i * 18 + j * 7) * 8 - 4) }); });
        const g = new T.PlaneGeometry(.18, 12, 1, 40), n = this.threadSpecs.length;
        for (const k of ['aSeed', 'aRoom', 'aTaut', 'aAlive'])
            g.setAttribute(k, new T.InstancedBufferAttribute(new Float32Array(n), 1));
        this.threadMat = new T.ShaderMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, uniforms: { uTime: { value: 0 }, uCam: { value: new T.Vector3() }, uFog: { value: .045 } }, vertexShader: `attribute float aSeed,aRoom,aTaut,aAlive;uniform float uTime;uniform vec3 uCam;varying vec2 vUv;varying float vTaut,vAlive,vDepth;void main(){vUv=uv;vTaut=aTaut;vAlive=aAlive;vec3 o=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;vec3 right=normalize(cross(vec3(0.,1.,0.),normalize(uCam-o)));float w=(sin(position.y*.7+uTime*.32+aSeed*8.)+.4*sin(position.y*1.7-uTime*.23+aSeed*4.))*.12*(1.-aTaut);vec3 p=o+vec3(0.,position.y,0.)+right*(position.x+w);vec4 mv=viewMatrix*vec4(p,1.);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`,
            fragmentShader: `uniform float uFog;varying vec2 vUv;varying float vTaut,vAlive,vDepth;void main(){float x=(vUv.x-.5)*2.;float a=exp(-x*x*65.)+.055*exp(-x*x*3.);a*=smoothstep(0.,.12,vUv.y)*smoothstep(0.,.12,1.-vUv.y)*vAlive*exp(-uFog*uFog*vDepth*vDepth);gl_FragColor=vec4(vec3(1.,.67,.31)*(1.2+vTaut*2.8),a*(.20+vTaut*.8));}` });
        this.threads = new T.InstancedMesh(g, this.threadMat, n);
        this.threadSpecs.forEach((s, i) => { this.threads.setMatrixAt(i, matrix.makeTranslation(s.x, 0, s.z)); g.attributes.aSeed.setX(i, s.seed); g.attributes.aRoom.setX(i, s.room); });
        this.threads.computeBoundingSphere();
        this.root.add(this.threads);
    }
    makeDust() {
        const n = 8000, g = new T.InstancedBufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(new Float32Array([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0]), 3));
        g.setIndex([0, 1, 2, 0, 2, 3]);
        g.setAttribute('uv', new T.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
        const seeds = new Float32Array(n * 3);
        for (let i = 0; i < n * 3; i++)
            seeds[i] = hash(i + 341);
        g.setAttribute('aSeed', new T.InstancedBufferAttribute(seeds, 3));
        g.instanceCount = n;
        this.dustMat = new T.ShaderMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false, uniforms: { uTime: { value: 0 }, uCam: { value: new T.Vector3() }, uRelease: { value: 0 }, uTaut: { value: 0 }, uAnchor: { value: new T.Vector3() }, uFog: { value: .045 } }, vertexShader: `attribute vec3 aSeed;uniform float uTime,uRelease,uTaut,uFog;uniform vec3 uCam,uAnchor;varying vec2 vUv;varying float vLit;void main(){vUv=uv;vec3 p=(aSeed-.5)*vec3(22.,20.,60.);p.z=uCam.z+mod(p.z-uCam.z+30.,60.)-30.;p+=sin(aSeed*71.+uTime*.17)*.09;vec3 a=uAnchor;a.y=p.y;p=mix(p,a,uTaut*.24);p+=(aSeed-.5)*uRelease*65.;float bands=pow(max(0.,cos(p.y*8.26)),14.);vLit=(.06+bands*.94)*smoothstep(4.,1.2,abs(p.x))*(1.-smoothstep(24.,30.,abs(p.z-uCam.z)));vec4 mv=viewMatrix*vec4(p,1.);vLit*=exp(-uFog*uFog*mv.z*mv.z);mv.xy+=position.xy*.025;gl_Position=projectionMatrix*mv;}`,
            fragmentShader: `varying vec2 vUv;varying float vLit;void main(){float a=exp(-dot(vUv-.5,vUv-.5)*18.)*vLit*.55;gl_FragColor=vec4(vec3(1.,.68,.34)*1.6,a);}` });
        this.dust = new T.Mesh(g, this.dustMat);
        this.dust.frustumCulled = false;
        this.root.add(this.dust);
    }
    makeShafts() {
        const g = new T.PlaneGeometry(1, 1), m = new T.ShaderMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, uniforms: { uFade: { value: 1 } }, vertexShader: `varying vec2 vUv;varying float vDepth;void main(){vUv=uv;vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`, fragmentShader: `varying vec2 vUv;varying float vDepth;uniform float uFade;void main(){float a=pow(sin(vUv.x*3.14159),5.)*sin(vUv.y*3.14159)*.007*uFade*exp(-.004*vDepth*vDepth);gl_FragColor=vec4(1.,.58,.24,a);}` });
        this.shaftMat = m;
        this.shafts = new T.InstancedMesh(g, m, this.rooms.length * 3);
        for (let i = 0; i < this.rooms.length * 3; i++) {
            dummy.position.set((i % 3 - 1) * 2, 1, -Math.floor(i / 3) * 12 - 2);
            dummy.rotation.set(0, .2, (i % 3 - 1) * .35);
            dummy.scale.set(.8, 14, 1);
            dummy.updateMatrix();
            this.shafts.setMatrixAt(i, dummy.matrix);
        }
        this.shafts.computeBoundingSphere();
        this.root.add(this.shafts);
    }
    setQuality(q) { this.quality = q; this.key.castShadow = q !== 'low'; this.dust.geometry.instanceCount = q === 'high' ? 8000 : q === 'medium' ? 4500 : 1800; }
    update(s, camera) {
        this.root.visible = s.archive;
        if (!s.archive) {
            this.key.intensity = 0;
            this.area.intensity = 0;
            return;
        }
        this.rig.apply(camera, s, this.reducedMotion);
        const maturity = s.room / Math.max(1, this.rooms.length - 1);
        this.scene.fog.density = mix(mix(.075, .045, maturity), .006, ramp(s.r, 0, 5)) + ramp(s.r, 13, 18) * .13;
        const form = s.formation;
        this.root.scale.set(1, 1, 1);
        this.key.position.copy(camera.position).add(new T.Vector3(-1.1, 2.1, -1));
        this.key.target.position.copy(camera.position).add(new T.Vector3(0, 0, -9));
        // The light follows the authored dolly, excluding the sub-pixel handheld layer.
        // Its shadows can be reused throughout a held shot without freezing the camera.
        if (!this.reducedMotion) {
            const dx = noise(s.t * .15, 4) * .02, dy = noise(s.t * .12, 61) * .02;
            this.key.position.x -= dx; this.key.position.y -= dy;
            this.key.target.position.x -= dx; this.key.target.position.y -= dy;
        }
        this.key.intensity = 65 * form * (1 - ramp(s.r, 7, 15));
        this.area.position.copy(this.key.position);
        this.area.lookAt(this.key.target.position);
        this.area.intensity = 3.2 * form * (1 - ramp(s.r, 7, 15));
        this.area.color.set(this.rooms[s.room].accent || '#ffc670');
        this.books.opacity = 1 - ramp(s.r, 4, 8);
        this.wood.opacity = 1 - ramp(s.r, 7, 12);
        this.bronze.opacity = 1 - ramp(s.r, 11, 17);
        this.bronze.emissiveIntensity = .3 * ramp(s.r, 0, 5);
        const maxRing = this.quality === 'low' ? 4 : 6;
        this.coverageUniforms.uArchiveRelease.value = s.r;
        this.coverageUniforms.uArchiveRadius.value = maxRing;
        this.flatBooks.opacity = this.books.opacity;
        for (const c of this.chunks) {
            const dist = Math.abs(c.z - camera.position.z) / 4;
            c.group.visible = dist < maxRing + .6 || s.r >= 0;
            const books = 1 - ramp(s.r, 4, 8), shelves = 1 - ramp(s.r, 7, 12), ribs = 1 - ramp(s.r, 11, 17);
            c.bookMesh.visible = dist < 2.7 && books > .001;
            c.boardMesh.visible = shelves > .001;
            c.stripMesh.visible = shelves > .001;
            c.ribMesh.visible = ribs > .001;
            c.mid.forEach(p => p.visible = dist >= .8 && dist < maxRing + .6 && !this.rooms[c.room].empty && books > .001);
        }
        const shadowKey = [this.key.position.x.toFixed(6), this.key.position.y.toFixed(6), this.key.position.z.toFixed(6), s.room, this.quality, s.r >= 0, s.formation].join(':');
        if (this.lastShadowKey !== shadowKey) {
            this.key.shadow.needsUpdate = true;
            this.lastShadowKey = shadowKey;
        }
        this.key.castShadow = this.quality !== 'low' && s.r < 0;
        this.strip.color.set(this.rooms[s.room].accent || '#ffb257').multiplyScalar(2.4 * form * (1 - ramp(s.r, 7, 13)));
        const a = this.threads.geometry.attributes;
        this.threadSpecs.forEach((th, i) => { const lt = s.t - (110 + th.room * 19); const taut = roomBeat(lt).tension; a.aTaut.setX(i, th.j === 0 ? taut : taut * .16); a.aAlive.setX(i, form * (1 - ramp(s.r, th.room * .4, th.room * .4 + 2)) * (1 - ramp(s.r, 11, 17))); });
        a.aTaut.needsUpdate = a.aAlive.needsUpdate = true;
        this.threadMat.uniforms.uTime.value = s.t;
        this.threadMat.uniforms.uCam.value.copy(camera.position);
        this.threadMat.uniforms.uFog.value = this.scene.fog.density;
        const u = this.dustMat.uniforms;
        u.uTime.value = s.t;
        u.uCam.value.copy(camera.position);
        u.uRelease.value = ramp(s.r, 8, 18);
        u.uTaut.value = roomBeat(s.rt).tension;
        u.uAnchor.value.set(-1.7, 0, -s.room * 12 - 3);
        u.uFog.value = this.scene.fog.density;
        this.shaftMat.uniforms.uFade.value = form * (1 - ramp(s.r, 7, 15));
        this.reveals.update(s, camera);
    }
}

