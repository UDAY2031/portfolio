import * as T from 'three';
import { RectAreaLightUniformsLib } from './vendor/RectAreaLightUniformsLib.js';
import { NavigationController as Director } from './navigation.js';
import { Archive } from './tesseract.js';
import { PostPipeline } from './post.js';
import { AudioCues } from './audio.js';
import { Interaction } from './interaction.js';
import { VisitorCounter } from './visitors.js';
import { DynamicResolution } from './dynamic-resolution.js';
import { LandscapeGuard } from './mobile.js';
import { PerformanceProbe } from './performance.js';
import { vertex, fragment } from './shaders/black-hole.js';
const query = new URLSearchParams(location.search), $ = id => document.getElementById(id);
let profiler, director, renderer, archive, post, scene, camera, audio, sky, quality = 'high', lost = false, recoveryPaused = false, qualityLocked = false, started = null, bench = [], lastStamp = 0, lastStats = 0;
const previousCamera = new T.PerspectiveCamera(55, 1, .08, 350);
const resolution=new DynamicResolution(matchMedia('(pointer: coarse)').matches);let landscape,visitors,interaction;
const status = $('status');
function resize() {if(!renderer)return;renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer: coarse)').matches?1.75:2));camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);post.setSize(innerWidth,innerHeight,resolution.applied);sky.material.uniforms.uRes.value.set(innerWidth,innerHeight);post.temporal.reset();}
function setQuality(){quality='high';renderer.shadowMap.enabled=true;archive.setQuality('high');post.setQuality('high');$('quality').value='high';resize();}

function snapshot(s) { return { skyVisible:sky.visible, segment:director.segment?{u:director.segment.u,path:director.rooms[director.segment.index].travelToNext?.name}:null, progress: director.currentProgress, seed: director.seed, wrap: archive.lattice.group.position.toArray(), t: s.t, act: s.act.name, room: director.rooms[s.room].id, reveal: s.reveal, caption: s.captionAlpha > 0 ? s.caption : '', captionAlpha: s.captionAlpha, silence: s.sound === 0, quality, renderScale:resolution.applied, frameMedian:resolution.median, orientation:landscape?.gated?'portrait':'landscape', wakeLock:!!landscape?.wake, paused: director.paused, contextLost: lost, duration: director.duration, camera: camera.position.toArray(), rotation:camera.quaternion.toArray(), navState:director.locked?'LOCKED':director.state, anchor:archive.interiors.active?.page.title, video:archive.interiors.video?{time:archive.interiors.video.el.currentTime,duration:archive.interiors.video.el.duration,paused:archive.interiors.video.el.paused,ready:archive.interiors.video.el.readyState,error:archive.interiors.video.el.error?.code}:null, contract:archive.interiors.contract, layout:archive.interiors.audit, roomAnchor:archive.interiors.groups[s.room].root.position.toArray(), drawCalls: renderer.info.render.calls, instances: scene.userData.instances }; }
function update(s) {
    camera.position.set(0, 0, 4);
    camera.quaternion.identity();
    camera.updateMatrixWorld();
    scene.fog.density = .045;
    archive.update(s, camera, director);interaction?.update(s,s.dt||.016);if(director.debug&&director.state==='OUTRO'&&sky?.visible)sky.visible=false;
    sky.visible = s.t < 100.5 && s.r < 0;
    const u = sky.material.uniforms;
    u.uTime.value = s.t;
    u.uCamDist.value = s.distance;
    u.uCamY.value = s.height;
    u.uWarp.value = s.warp;
    u.uBlack.value = s.black;
    u.uSteps.value = quality === 'high' ? 130 : quality === 'medium' ? 96 : 64;
    u.uIris.value = s.iris;
    u.uStreak.value = s.streak;
    u.uHole.value = s.hole;
    u.uFormation.value = 0;
    if (u.uFormation.value > 0) {
        if (!archive.formationArms) archive.formationArms = archive.lattice.armEndpoints(camera);
        for (let j = 0; j < 4; j++) {
            const arm = archive.formationArms[j];
            if (!arm) { u.uRibs.value[j].set(4,4,4,5); continue; }
            const a=arm.a.clone().project(camera),b=arm.b.clone().project(camera);
            u.uRibs.value[j].set(a.x,a.y,b.x,b.y);
        }
    }
    const previous = director.sample(s.t - (director.velocity || 0) * director.duration / 60);
    previousCamera.aspect = camera.aspect;
    if (s.archive)
        archive.rig.apply(previousCamera, previous, archive.reducedMotion);
    else {
        previousCamera.position.copy(camera.position);
        previousCamera.quaternion.copy(camera.quaternion);
        previousCamera.updateProjectionMatrix();
        previousCamera.updateMatrixWorld();
    }
    post.update(s, previousCamera, director.paused);
    $('entry').hidden=director.entered;$('scroll-hint').firstChild.textContent=director.state==='ARRIVED'?'SCROLL · NEXT / PREVIOUS':director.state==='TRAVELLING'?'SPACE · SKIP':'SCROLL TO DESCEND';$('scroll-hint').style.opacity=['ARRIVED','TRAVELLING','IDLE'].includes(director.state)&&performance.now()-(started||0)>2000?'.35':'0';
    $('telemetry').style.opacity = String(s.hud * .55);
    $('distance').textContent = s.distance.toFixed(3) + ' rₛ';
    $('proper').textContent = s.t.toFixed(2) + ' s';
    $('caption').style.opacity = String(s.captionAlpha);
    $('caption-main').textContent = s.captionAlpha > 0 ? s.caption : '';
    $('caption-sub').textContent = s.captionAlpha > 0 ? s.captionSub : '';
    audio.update(s, director);
    if (director.debug) {
        $('scrub').value = String(s.t);
        $('readout').textContent = `${s.act.name} · ${s.t.toFixed(2)} / ${director.duration}s · p ${director.currentProgress.toFixed(4)} · ${director.rooms[s.room].title} · ${director.state} · layout ${archive.interiors.audit?.pass?'PASS':'…'} · text ${archive.interiors.contract?.capHeight.toFixed(1)||'—'}px`;
        $('play').textContent = director.paused ? 'Play' : 'Pause';
        document.body.dataset.film = JSON.stringify(snapshot(s));
        if (document.activeElement !== $('progress')) $('progress').value = director.currentProgress.toFixed(6);
    }
}
function frame(now) {
    requestAnimationFrame(frame);
    if (lost || document.hidden || landscape?.gated){director.lastNow=null;return;}
    if (started === null)
        started = now;
    try {
        profiler.begin(now);
        const s = director.entered ? director.tick(now) : director.sample(3);
        update(s);
        renderer.info.reset();
        post.render();visitors?.frame(lastStamp?(now-lastStamp)/1000:0,true,s);
        if(lastStamp&&resolution.update(now-lastStamp,(now-lastStamp)/1000,director.state==='ARRIVED'||(s.archive&&archive.foldTime<2)))resize();
        profiler.end(now);
        if (lastStamp && now - started < 1200)
            bench.push(now - lastStamp);
        if (false && !qualityLocked && now - started >= 1200 && bench.length) {
            const mean = bench.reduce((a, b) => a + b, 0) / bench.length;
            setQuality(mean < 19 ? 'high' : mean < 32 ? 'medium' : 'low');
            bench = [];
        }
        if (director.debug && now - lastStats > 500) {
            const stats = profiler.readout();
            $('stats').textContent = `${stats.fps.toFixed(1)} FPS avg · CPU ${stats.cpu?.toFixed(1) ?? '—'} ms · GPU ${stats.gpu?.toFixed(1) ?? 'unavailable'} ms · ${renderer.info.render.calls} draws · ${(archive.lattice.beams.count + archive.atmosphere.dust.geometry.instanceCount).toLocaleString()} lattice/dust instances · wrap ${archive.lattice.group.position.toArray().join(',')} · ${audio.context?.state === 'running' ? 'audio running' : 'audio suspended'}`;
            if (profiler.measurement) $('benchmark-result').textContent = 'Measuring…';
            if (profiler.result) {
                $('benchmark-result').textContent = `Measured: ${profiler.result.fps?.toFixed(1)} FPS · GPU ${profiler.result.gpuMs?.mean.toFixed(2) ?? 'unavailable'} ms · CPU ${profiler.result.cpuMs?.mean.toFixed(2)} ms`;
                $('benchmark-result').dataset.report = JSON.stringify(profiler.result);
            }
            lastStats = now;
        }
        lastStamp = now;
    }
    catch (error) {
        status.hidden = false;
        status.textContent = 'The archive is holding. Reload to resume this moment.';
        console.error(error);
        lost = true;
        try {
            sessionStorage.setItem('gargantua-archive-resume', JSON.stringify({progress:director.currentProgress,seed:director.seed}));
        }
        catch { /* Optional. */ }
    }
}
async function boot() {
    const response = await fetch('/resources/journey.json');
    if (!response.ok)
        throw new Error('Journey manifest could not be loaded.');
    const rooms = await response.json();
    const narrativeResponse = await fetch('/resources/film.json');
    if (!narrativeResponse.ok)
        throw new Error('Film captions could not be loaded.');
    director = new Director(rooms, query, await narrativeResponse.json());
    if (!query.has('p') && !query.has('t') && !query.has('phase'))
        try {
            const raw = sessionStorage.getItem('gargantua-archive-resume');
            const saved=raw ? JSON.parse(raw) : null;
            if (saved && Number.isFinite(saved.progress)) { director.seekProgress(saved.progress); director.seed=saved.seed; director.entered=true; }
            sessionStorage.removeItem('gargantua-archive-resume');
        }
        catch { /* Storage disabled. */ }
    renderer = new T.WebGLRenderer({ canvas: $('film'), antialias: false, powerPreference: 'high-performance', alpha: false });
    renderer.setClearColor('#000000', 1);
    renderer.toneMapping = T.NoToneMapping;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.type = T.VSMShadowMap;
    renderer.info.autoReset = false;
    RectAreaLightUniformsLib.init();
    scene = new T.Scene();
    scene.background = new T.Color('#000000');
    scene.fog = new T.FogExp2('#0a0705', .045);
    camera = new T.PerspectiveCamera(55, innerWidth / innerHeight, .08, 350);
    const uniforms = { uRes: { value: new T.Vector2(innerWidth, innerHeight) }, uTime: { value: 0 }, uCamDist: { value: 38 }, uCamY: { value: .28 }, uWarp: { value: 0 }, uBlack: { value: 0 }, uSteps: { value: 130 }, uLook: { value: new T.Vector2() }, uIris: { value: 0 }, uStreak: { value: 0 }, uHole: { value: 1 }, uFormation: { value: 0 }, uRibs: { value: Array.from({ length: 4 }, () => new T.Vector4()) } };
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    sky = new T.Mesh(g, new T.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, depthWrite: false, depthTest: false }));
    sky.frustumCulled = false;
    sky.renderOrder = -100;
    scene.add(sky);
    archive = new Archive(director.rooms, scene, quality, director.seed);
    /* const formationCamera = camera.clone();
    archive.rig.apply(formationCamera, director.sample(107), true);
    archive.lattice.update(director.sample(107), formationCamera, archive.rig.sample(director.sample(107)));
    archive.formationArms = archive.lattice.armEndpoints(formationCamera); */
    archive.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    scene.userData.instances = 0;
    scene.traverse(o => { if (o.isInstancedMesh)
        scene.userData.instances += o.count; });
    post = new PostPipeline(renderer, scene, camera);
    profiler = new PerformanceProbe(renderer);interaction=new Interaction(director,archive,camera);
    audio = new AudioCues();
    director.onTravelStart=segment=>{segment.startPose={position:camera.position.toArray(),quaternion:camera.quaternion.toArray()};archive.interiors.stopVideo();};director.attach();landscape=new LandscapeGuard(director,archive.interiors,audio,resize);
    let saved;
    try {
        saved = localStorage.getItem('gargantua-film-quality');
    }
    catch { /* Optional. */ }
    qualityLocked = query.has('quality') || ['high', 'medium', 'low'].includes(saved);
    setQuality(['high', 'medium', 'low'].includes(query.get('quality')) ? query.get('quality') : ['high', 'medium', 'low'].includes(saved) ? saved : 'high');
    addEventListener('resize', resize);
    $('entry').hidden = director.entered;
    $('enter').onclick = async () => { director.entered = true; director.seek(3, performance.now()); director.paused = false; director.lastInput = performance.now(); $('entry').hidden = true; landscape.requestLandscape();await audio.init(); };
    $('sound-toggle').onclick = async () => { if (!audio.context) await audio.init(); audio.setMuted(!audio.muted); $('sound-toggle').setAttribute('aria-pressed', String(audio.muted)); $('sound-toggle').setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound'); $('sound-toggle').textContent = audio.muted ? '♩' : '♫'; };
    $('sound-toggle').setAttribute('aria-pressed', String(audio.muted));
    $('sound-toggle').setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
    addEventListener('keydown', e => {if(e.key.toLowerCase()==='f'){archive.foldTime=0;archive.foldCount=(archive.foldCount||0)+1;}audio.resume();});
    const canvas = renderer.domElement;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; director.contextLost=true; recoveryPaused = director.paused; director.setPaused(true, performance.now()); audio.update(director.sample(director.t), director); post.temporal.reset(); status.textContent = 'Holding this moment. Restoring the light…'; status.hidden = false; try {
        sessionStorage.setItem('gargantua-archive-resume', JSON.stringify({progress:director.currentProgress,seed:director.seed}));
    }
    catch { /* Optional. */ } });
    canvas.addEventListener('webglcontextrestored', () => { profiler.reset(); archive.lastShadowKey = ''; lost = false; director.contextLost=false; director.setPaused(recoveryPaused, performance.now()); post.temporal.reset(); resize(); status.hidden = true; try {
        sessionStorage.removeItem('gargantua-archive-resume');
    }
    catch { /* Optional. */ } });
    if (director.debug) {
        $('debug').hidden = false;
        $('benchmark').onclick = () => {
            const size = new T.Vector2(); renderer.getDrawingBufferSize(size);
            profiler.start(performance.now(), { time: director.t, quality, width: size.x, height: size.y, paused: director.paused });
        };
        $('scrub').max = String(director.duration - .001);
        $('scrub').addEventListener('input', e => { director.paused = true; director.seek(Number(e.target.value), performance.now()); post.temporal.reset(); });
        $('progress').oninput = e => { director.paused = true; director.seekProgress(Number(e.target.value), performance.now()); post.temporal.reset(); };
        $('time').value = String(director.t);
        $('time').oninput = e => { director.paused = true; director.seek(Number(e.target.value), performance.now()); post.temporal.reset(); };
        $('play').onclick = () => director.setPaused(!director.paused, performance.now());
        $('quality').disabled=true;
        $('bounds').onchange = e => archive.debugGroup.visible = e.target.checked;
        $('mute').checked = audio.muted;
        $('mute').onchange = e => audio.setMuted(e.target.checked);
        let ext = renderer.getContext().getExtension('WEBGL_lose_context');
        $('lose').onclick = () => ext?.loseContext();
        $('restore').onclick = () => ext?.restoreContext();
        addEventListener('keydown', e => { if (/INPUT|SELECT/.test(e.target.tagName))
            return; const k = e.key.toLowerCase(); if ([' ', 'c', 'r', '1', '2', '3', '4', '5', 'd', 'm', 'p', 'h'].includes(k))
            e.preventDefault(); if (k === 'c')
            director.setPaused(!director.paused, performance.now()); if (k === 'r')
            director.seek(0, performance.now()); if (['1', '2', '3', '4'].includes(k))
            director.seek([20, 77, 102, 120][Number(k) - 1], performance.now()); if (k === '5' || k === 'd') {
            $('bounds').checked = !$('bounds').checked;
            archive.debugGroup.visible = $('bounds').checked;
        } if (k === 'm') {
            audio.setMuted(!audio.muted);
            $('mute').checked = audio.muted;
        } if (k === 'p') { archive.manualFoldAt=director.t; director.paused=false; director.targetProgress=Math.min(1,(director.t+2)/director.duration); director.lastInput=performance.now(); } if (k === 'h')
            $('debug').hidden = !$('debug').hidden; post.temporal.reset(); });
    }
    status.hidden = true;visitors=director.narrative.visitorCounter?new VisitorCounter():null;
    requestAnimationFrame(frame);
}
boot().catch(error => { console.error(error); status.hidden = false; status.textContent='The archive could not start. Enable graphics acceleration, or try another browser.'; });
