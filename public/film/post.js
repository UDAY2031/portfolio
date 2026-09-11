import * as T from 'three';
import { EffectComposer, FXAAEffect, RenderPass, EffectPass, BloomEffect, ChromaticAberrationEffect, VignetteEffect, ToneMappingEffect, ToneMappingMode, Effect, EffectAttribute, Pass } from 'postprocessing';
// Grading and camera blur share the original HDR chain. Velocity is reconstructed
// from depth and two authored camera samples, so seeking doesn't leave a smear.
class CameraFilmEffect extends Effect {
    constructor() {
        super('CameraFilm', `uniform float uTime,uBlur,uGrain,uAO,uArchive,uBlack;uniform mat4 uInverse,uPrevious;uniform vec2 uPixel;void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){
 if(uBlack>=.99999){outputColor=vec4(0.,0.,0.,1.);return;}
 float depth=1.;if(uArchive>.5)depth=readDepth(uv);
 vec3 color=inputColor.rgb;
 if(uBlur>.001){
  vec4 world=uInverse*vec4(uv*2.-1.,depth*2.-1.,1.);world/=world.w;
  vec4 previous=uPrevious*world;
  vec2 velocity=clamp((uv-(previous.xy/previous.w*.5+.5))*uBlur,vec2(-.03),vec2(.03));
  for(int i=0;i<4;i++){float offset=(float(i)+.5)/4.-.5;color+=texture2D(inputBuffer,clamp(uv+velocity*offset,vec2(.001),vec2(.999))).rgb;}color/=5.;
 }
 float occlusion=0.;if(uAO>.0&&uArchive>.5&&depth<.999){for(int i=0;i<8;i++){float angle=float(i)*.785398;float neighbour=readDepth(uv+vec2(cos(angle),sin(angle))*uPixel*3.);float difference=depth-neighbour;occlusion+=smoothstep(.00012,.0015,difference)*(1.-smoothstep(.003,.016,difference));}}color*=1.-occlusion*.023*uAO;
 float grain=fract(sin(dot(uv*vec2(1920.,1080.),vec2(12.9898,78.233))+floor(uTime*24.)*1.23)*43758.5453)-.5;color+=grain*uGrain*smoothstep(.002,.12,dot(color,vec3(.333)));outputColor=vec4(max(vec3(0.),color)*(1.-uBlack),inputColor.a);
 }`, { attributes: EffectAttribute.DEPTH, uniforms: new Map([['uTime', new T.Uniform(0)], ['uBlur', new T.Uniform(0)], ['uGrain', new T.Uniform(.02)], ['uAO', new T.Uniform(1)], ['uArchive', new T.Uniform(0)], ['uBlack', new T.Uniform(0)], ['uInverse', new T.Uniform(new T.Matrix4())], ['uPrevious', new T.Uniform(new T.Matrix4())], ['uPixel', new T.Uniform(new T.Vector2())]]) });
    }
}
// TAA-lite on held shots only. Neighbourhood clipping rejects disoccluded history.
// The pass is bypassed when scrubbing/frozen; captures never depend on prior frames.
class TemporalPass extends Pass {
    constructor() {
        super('Temporal');
        this.history = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, depthBuffer: false });
        this.valid = false;
        this.weight = 0;
        this.needsDepthTexture = true;
        this.lastTime = null;
        this.lastViewProjection = new T.Matrix4();
        this.fullscreenMaterial = new T.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { uDepth: { value: null }, uInverse: { value: new T.Matrix4() }, uPrevious: { value: new T.Matrix4() }, uCurrent: { value: null }, uHistory: { value: this.history.texture }, uWeight: { value: 0 }, uPixel: { value: new T.Vector2() } }, vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`, fragmentShader: `uniform sampler2D uCurrent,uHistory,uDepth;uniform mat4 uInverse,uPrevious;uniform float uWeight;uniform vec2 uPixel;varying vec2 vUv;void main(){vec3 c=texture2D(uCurrent,vUv).rgb,lo=c,hi=c;for(int i=0;i<4;i++){vec2 o=i==0?vec2(1.,0.):i==1?vec2(-1.,0.):i==2?vec2(0.,1.):vec2(0.,-1.);vec3 n=texture2D(uCurrent,vUv+o*uPixel).rgb;lo=min(lo,n);hi=max(hi,n);}float depth=texture2D(uDepth,vUv).r;vec4 world=uInverse*vec4(vUv*2.-1.,depth*2.-1.,1.);world/=world.w;vec4 previous=uPrevious*world;vec2 oldUv=previous.xy/previous.w*.5+.5;float valid=step(0.,oldUv.x)*step(oldUv.x,1.)*step(0.,oldUv.y)*step(oldUv.y,1.)*step(0.,previous.w);vec3 h=clamp(texture2D(uHistory,clamp(oldUv,vec2(0.),vec2(1.))).rgb,lo,hi);gl_FragColor=vec4(mix(c,h,uWeight*valid),1.);}` });
        this.copyScene = new T.Scene();
        this.copyCamera = new T.Camera();
        this.copyMaterial = new T.ShaderMaterial({ depthWrite: false, depthTest: false, uniforms: { tex: { value: null } }, vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`, fragmentShader: `uniform sampler2D tex;varying vec2 vUv;void main(){gl_FragColor=texture2D(tex,vUv);}` });
        this.copyScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), this.copyMaterial));
    }
    setDepthTexture(texture) { this.fullscreenMaterial.uniforms.uDepth.value = texture; }
    setSize(w, h) { this.history.setSize(w, h); this.fullscreenMaterial.uniforms.uPixel.value.set(1 / w, 1 / h); this.valid = false; }
    render(renderer, input, output) { const u = this.fullscreenMaterial.uniforms; u.uCurrent.value = input.texture; u.uWeight.value = this.valid ? this.weight : 0; renderer.setRenderTarget(output); renderer.render(this.scene, this.camera); this.copyMaterial.uniforms.tex.value = output.texture; renderer.setRenderTarget(this.history); renderer.render(this.copyScene, this.copyCamera); this.valid = true; }
    reset() { this.valid = false; this.lastTime = null; }
    dispose() { this.history.dispose(); this.copyMaterial.dispose(); super.dispose(); }
}
class NativeComposite extends Pass {
 constructor(){super('Native composite');this.needsSwap=false;this.fullscreenMaterial=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tex:{value:null},eye:{value:1},defocus:{value:0},pixel:{value:new T.Vector2()}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`varying vec2 vUv;uniform sampler2D tex;uniform float eye,defocus;uniform vec2 pixel;void main(){vec3 c=texture2D(tex,vUv).rgb;for(int i=0;i<8;i++){float a=float(i)*.785398;c+=texture2D(tex,vUv+vec2(cos(a),sin(a))*pixel*defocus*16.).rgb;}c/=9.;float lid=(abs(vUv.y-.5)+pow(abs(vUv.x-.5),2.)*.18);float aperture=smoothstep(lid-.015,lid+.015,eye*.65);gl_FragColor=vec4(c*aperture,1.);}`});}
 render(renderer,input){this.fullscreenMaterial.uniforms.tex.value=input.texture;renderer.setRenderTarget(null);renderer.render(this.scene,this.camera);}
}
export class PostPipeline {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;this.scene=scene;this.depthMaterial=new T.MeshBasicMaterial({colorWrite:false});
        this.camera = camera;
        this.composer = new EffectComposer(renderer, { frameBufferType: T.HalfFloatType, multisampling: 0 });
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);
        this.temporal = new TemporalPass();
        this.composer.addPass(this.temporal);
        this.bloom = new BloomEffect({ mipmapBlur: true, intensity: .8, luminanceThreshold: 1.1, luminanceSmoothing: .22 });
        this.ca = new ChromaticAberrationEffect({ offset: new T.Vector2(.0004, .00024), radialModulation: true, modulationOffset: .4 });
        this.film = new CameraFilmEffect();
        this.composer.addPass(new EffectPass(camera, this.bloom));
        this.composer.addPass(new EffectPass(camera, new FXAAEffect(), this.film, this.ca, new VignetteEffect({ eskil: false, offset: .18, darkness: .78 }), new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })));
        this.native=new NativeComposite();this.composer.addPass(this.native);this.composer.autoRenderToScreen=false;this.composer.passes.forEach(p=>p.renderToScreen=false);
    }
    setSize(w, h, scale=1) { this.composer.setSize(Math.round(w*scale),Math.round(h*scale),false);this.renderer.setSize(w,h,false);this.native.fullscreenMaterial.uniforms.pixel.value.set(1/w,1/h); this.film.uniforms.get('uPixel').value.set(1 / (w * this.renderer.getPixelRatio()), 1 / (h * this.renderer.getPixelRatio())); }
    setQuality(q) { this.quality = q; this.temporal.enabled = q === 'high'; this.film.uniforms.get('uAO').value = q === 'high' ? 1 : 0; }
    update(s, previousCamera, paused) {
        const temporal = this.temporal;
        temporal.enabled = false; // Folding geometry uses spatial AA: reversing never reuses stale history.
        void paused;
        if (!temporal.enabled || temporal.lastTime === null || s.t <= temporal.lastTime || s.t - temporal.lastTime > .25) temporal.reset();
        if (temporal.enabled) {
            // The authored master time selects the subpixel sample; no extra animation clock.
            const index = Math.floor(s.t * 60) % 8;
            const offsets = [[0,-1/6],[-1/4,1/6],[1/4,-7/18],[-3/8,-1/18],[1/8,5/18],[-1/8,-5/18],[3/8,1/18],[-7/16,7/18]];
            this.camera.projectionMatrix.elements[8] += offsets[index][0] * 2 / temporal.history.width;
            this.camera.projectionMatrix.elements[9] += offsets[index][1] * 2 / temporal.history.height;
            this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
        }
        const u = this.film.uniforms;
        u.get('uTime').value = s.t;
        u.get('uArchive').value = Number(s.archive);
        u.get('uBlack').value = s.archive ? 0 : s.black;
        u.get('uBlur').value = s.archive && (s.move > .01 || s.t < 110 || s.r >= 0) ? 1 : 0;
        u.get('uInverse').value.multiplyMatrices(this.camera.matrixWorld, this.camera.projectionMatrixInverse);
        u.get('uPrevious').value.multiplyMatrices(previousCamera.projectionMatrix, previousCamera.matrixWorldInverse);
        this.ca.offset.set(.0004 + s.warp * .005, .00024 + s.warp * .003);
        temporal.weight = temporal.enabled ? .7 : 0;
        if (temporal.enabled) {
            temporal.fullscreenMaterial.uniforms.uInverse.value.copy(u.get('uInverse').value);
            temporal.fullscreenMaterial.uniforms.uPrevious.value.copy(temporal.lastViewProjection);
            temporal.lastViewProjection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
            temporal.lastTime = s.t;
        }
        // No expensive scene/post work during authored total-black holds. Captions
        // remain DOM typography above the canvas; their fades still follow the Director.
        this.blackHold = s.black >= .99999;this.drawText=s.archive&&s.rt>=5.8&&s.r<0;this.native.fullscreenMaterial.uniforms.eye.value=s.archive?s.eye:1;this.native.fullscreenMaterial.uniforms.defocus.value=s.defocus||0;
    }
    render() {
        if (this.blackHold) {
            this.renderer.setRenderTarget(null);
            this.renderer.setClearColor(0x000000, 1);
            this.renderer.clear(true, true, true);
            this.temporal.reset();
        } else {
            this.camera.layers.set(0);this.composer.render(0);
            if(this.drawText){
                const r=this.renderer,background=this.scene.background,override=this.scene.overrideMaterial,auto=r.autoClear;
                r.setRenderTarget(null);const shadowAuto=r.shadowMap.autoUpdate;r.shadowMap.autoUpdate=false;r.autoClear=false;r.clearDepth();this.scene.background=null;this.scene.overrideMaterial=this.depthMaterial;
                const hidden=[];this.scene.traverse(o=>{if(o.visible&&(o.name==='lattice'||o.material?.transparent)){hidden.push(o);o.visible=false;}});r.render(this.scene,this.camera);hidden.forEach(o=>o.visible=true);this.scene.overrideMaterial=override;
                this.camera.layers.set(1);r.render(this.scene,this.camera);this.camera.layers.set(0);
                this.scene.background=background;r.autoClear=auto;r.shadowMap.autoUpdate=shadowAuto;
            }
        }
    }
}
