import * as T from 'three';
import { clamp, expo, ramp } from './ease.js';
const W = 1440, H = 1000;
function lines(ctx, text, x, y, width, lineHeight, max = 4) { let line = '', row = 0; for (const word of text.split(/\s+/)) {
    if (ctx.measureText(line + word).width > width && line) {
        ctx.fillText(line.trim(), x, y + row * lineHeight);
        line = '';
        if (++row >= max)
            return;
    }
    line += word + ' ';
} ctx.fillText(line.trim(), x, y + row * lineHeight); }
export class Reveals {
    constructor(rooms, root) {
        this.rooms = rooms;
        this.root = root;
        this.cache = new Map();
        this.active = -1;
        this.material = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, uniforms: { uMap: { value: null }, uDraw: { value: 0 }, uOpacity: { value: 0 }, uTime: { value: 0 } }, vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`, fragmentShader: `uniform sampler2D uMap;uniform float uDraw,uOpacity,uTime;varying vec2 vUv;void main(){vec4 c=texture2D(uMap,vUv);float drawn=smoothstep(uDraw+.025,uDraw,vUv.x);float edge=(smoothstep(.003,0.,vUv.y)+smoothstep(.003,0.,1.-vUv.y))*drawn;float lead=exp(-pow((vUv.x-uDraw)*160.,2.))*(1.-step(.999,uDraw));float scan=.96+.04*sin(vUv.y*500.+uTime*.3);gl_FragColor=vec4(c.rgb*scan+vec3(1.,.62,.28)*(edge*.25+lead*.4),max(c.a,edge*.2+lead*.3)*uOpacity*drawn);}` });
        this.mesh = new T.Mesh(new T.PlaneGeometry(4.4, 3.055), this.material);
        this.mesh.position.set(.7, 0, -3);
        root.add(this.mesh);
    }
    load(i) {
        if (this.cache.has(i))
            return this.cache.get(i);
        const room = this.rooms[i], canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const texture = new T.CanvasTexture(canvas);
        texture.colorSpace = T.SRGBColorSpace;
        texture.minFilter = T.LinearFilter;
        texture.generateMipmaps = false;
        const state = { canvas, texture, ctx: canvas.getContext('2d'), image: null, video: null, dirty: true, key: '' };
        this.cache.set(i, state);
        if (room.images[0]) {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => { state.image = image; state.dirty = true; };
            image.onerror = () => { state.image = null; state.dirty = true; };
            image.src = room.images[0];
        }
        if (room.video) {
            const v = document.createElement('video');
            v.muted = true;
            v.playsInline = true;
            v.preload = 'metadata';
            v.crossOrigin = 'anonymous';
            v.src = room.video;
            v.addEventListener('error', () => { state.video = null; state.dirty = true; });
            v.addEventListener('seeked', () => { state.dirty = true; });
            state.video = v;
        }
        return state;
    }
    update(s, camera) {
        const i = s.room, room = this.rooms[i], elapsed = s.reveal;
        this.mesh.visible = s.t >= 110 && s.r < 0 && elapsed > .001 && !room.empty;
        if (!this.mesh.visible)
            return;
        const mobile = camera.aspect < .8;
        const width = mobile ? 900 : W, height = mobile ? 1400 : H;
        const item = this.load(i);
        if (item.canvas.width !== width) {
            item.canvas.width = width;
            item.canvas.height = height;
            item.dirty = true;
        }
        if (i + 1 < this.rooms.length)
            this.load(i + 1);
        // Bound decoded media and textures to current + neighbouring rooms.
        for (const [k, c] of this.cache)
            if (Math.abs(k - i) > 1) {
                c.texture.dispose();
                if (c.video) {
                    c.video.pause();
                    c.video.removeAttribute('src');
                    c.video.load();
                }
                this.cache.delete(k);
            }
        const planeWidth = mobile ? Math.min(4.4, 11 * Math.tan(camera.fov * Math.PI / 360) * camera.aspect * .88) : 4.4;
        this.mesh.scale.set(planeWidth / 4.4, (planeWidth * height / width) / 3.055, 1);
        this.mesh.position.set(mobile ? 0 : .5, .12, -i * 12 - 1.5);
        this.material.uniforms.uMap.value = item.texture;
        this.material.uniforms.uDraw.value = expo(elapsed / 2.1);
        this.material.uniforms.uOpacity.value = ramp(elapsed, 0, .65);
        this.material.uniforms.uTime.value = s.t;
        const key = Math.round(elapsed * 60);
        if (item.video && Number.isFinite(item.video.duration) && item.video.duration > 0) {
            const t = clamp(elapsed - 3, 0, 1000) % item.video.duration;
            if (Math.abs(item.video.currentTime - t) > .08 && !item.video.seeking)
                item.video.currentTime = t;
        }
        if (key === item.key && !item.dirty)
            return;
        item.key = key;
        item.dirty = false;
        const c = item.ctx;
        c.clearRect(0, 0, width, height);
        c.textBaseline = 'top';
        const stage = (start, fn, duration = .65) => { c.globalAlpha = expo((elapsed - start) / duration); if (c.globalAlpha > 0)
            fn(); };
        stage(0, () => { c.fillStyle = '#a58a63'; c.font = '20px monospace'; c.fillText(String(room.order).padStart(2, '0') + '  /  ' + String(this.rooms.length).padStart(2, '0'), 75, 64); c.fillStyle = '#ece1cc'; c.font = '84px Georgia'; c.fillText(room.title.slice(0, Math.max(0, Math.floor(elapsed / .03))), 72, 120); });
        stage(.8, () => { c.fillStyle = '#ac997b'; c.font = '22px monospace'; lines(c, `${room.year}   ${room.place ? ' /  ' + room.place : ''}`, 76, 222, width - 150, 33, 2); });
        stage(1.4, () => { c.fillStyle = '#c2b5a0'; c.font = '35px sans-serif'; lines(c, room.description, 76, 320, width - 150, 48, mobile ? 5 : 3); });
        const media = item.video?.readyState >= 2 ? item.video : item.image;
        stage(2.2, () => { room.metrics.slice(0, 3).forEach((m, j) => { const numeric = typeof m.value === 'number', v = numeric ? m.value * expo((elapsed - 2.2) / 1.3) : m.value; const text = numeric ? (Number.isInteger(m.value) ? Math.round(v) : v.toFixed(2)) + m.suffix : String(v) + m.suffix; c.fillStyle = '#dcc59c'; c.font = mobile ? '54px Georgia' : media ? '40px Georgia' : '52px Georgia'; c.fillText(text, 76 + (media || mobile ? 0 : j * 410), (mobile ? 615 : 510) + (media || mobile ? j * 100 : 0)); c.font = '17px monospace'; c.fillStyle = '#8b7e68'; c.fillText(m.label.toUpperCase(), 78 + (media || mobile ? 0 : j * 410), (mobile ? 677 : 572) + (media || mobile ? j * 100 : 0)); }); });
        stage(3, () => { if (media) {
            const iw = media.videoWidth || media.width, ih = media.videoHeight || media.height, scale = Math.min(650 / iw, 260 / ih);
            c.drawImage(media, width - 75 - iw * scale, mobile ? 910 : 505, iw * scale, ih * scale);
        } }, 1.2);
        room.techStack.slice(0, 9).forEach((tech, j) => stage(4 + j * .08, () => { c.font = '20px monospace'; c.fillStyle = '#af9c7c'; const cols = mobile ? 3 : 5, col = j % cols, row = Math.floor(j / cols); c.fillText(tech, 76 + col * 255, (mobile ? 1200 : 824) + row * 39); }));
        stage(4.8, () => { c.fillStyle = '#988267'; c.font = '19px monospace'; c.fillText(room.links.map(l => l.label + ' ↗').join('    '), 76, mobile ? 1350 : 940); });
        c.globalAlpha = 1;
        item.texture.needsUpdate = true;
    }
}
