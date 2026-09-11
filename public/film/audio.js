export class AudioCues {
    constructor() { this.context = null; this.node = null; this.muted = false; this.volume = .7; try {
        this.muted = localStorage.getItem('gargantua-film-muted') === '1';
    }
    catch { /* Storage is optional. */ } }
    async init() { if (this.context) { this.resume(); return; } try {
        this.context = new AudioContext();
        await this.context.audioWorklet.addModule(new URL('./audio-worklet.js', import.meta.url));
        this.node = new AudioWorkletNode(this.context, 'gargantua-score', { outputChannelCount: [2] });
        this.node.connect(this.context.destination);
        void this.context.resume().catch(() => { });
    }
    catch {
        this.node = null;
    } }
    resume() { if (this.context?.state === 'suspended')
        void this.context.resume().catch(() => { }); }
    setMuted(m) { this.muted = m; try {
        localStorage.setItem('gargantua-film-muted', m ? '1' : '0');
    }
    catch { /* Private browsing. */ } this.resume(); }
    update(s, director) { if (this.node)
        this.node.port.postMessage({ t: s.t, at: this.context.currentTime, duration: director.duration, release: director.releaseStart, envelope:s.sound, paused: !director.entered || !!director.contextLost || director.lockReasons?.has('orientation') || document.hidden, frozen: director.paused, progress: director.currentProgress, muted: this.muted, volume: this.volume }); }
}
