/** Diagnostics only. These timestamps never animate the film or its score. */
export class PerformanceProbe {
    constructor(renderer) {
        this.renderer = renderer;
        this.reset();
    }
    reset() {
        this.gl = this.renderer.getContext();
        this.extension = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
        this.pending = [];
        this.active = null;
        this.cpuStart = 0;
        this.lastFrame = null;
        this.samples = [];
        this.gpuSamples = [];
        this.measurement = null;
        this.result = null;
    }
    start(now, metadata) {
        this.measurement = { start: now + 750, end: now + 5750, metadata, frames: [], cpu: [], gpu: [], draws: [] };
        this.result = null;
    }
    begin(now) {
        const gl = this.gl, ext = this.extension;
        if (ext) {
            const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
            while (this.pending.length && gl.getQueryParameter(this.pending[0].query, gl.QUERY_RESULT_AVAILABLE)) {
                const sample = this.pending.shift();
                if (!disjoint) {
                    const ms = gl.getQueryParameter(sample.query, gl.QUERY_RESULT) / 1e6;
                    this.gpuSamples.push(ms);
                    if (this.gpuSamples.length > 120) this.gpuSamples.shift();
                    const m = this.measurement;
                    if (m && sample.at >= m.start && sample.at <= m.end) m.gpu.push(ms);
                }
                gl.deleteQuery(sample.query);
            }
            if (disjoint) {
                this.pending.forEach(item => gl.deleteQuery(item.query));
                this.pending = [];
            }
            if (this.pending.length < 8) {
                const query = gl.createQuery();
                this.active = { query, at: now };
                gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
            }
        }
        const dt = this.lastFrame === null ? 0 : now - this.lastFrame;
        this.lastFrame = now;
        this.dt = dt;
        this.cpuStart = performance.now();
    }
    end(now) {
        const cpu = performance.now() - this.cpuStart;
        if (this.active) {
            this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
            this.pending.push(this.active);
            this.active = null;
        }
        if (this.dt > 0 && this.dt < 250) {
            this.samples.push({ dt: this.dt, cpu });
            if (this.samples.length > 120) this.samples.shift();
            const m = this.measurement;
            if (m && now >= m.start && now <= m.end) {
                m.frames.push(this.dt);
                m.cpu.push(cpu);
                m.draws.push(this.renderer.info.render.calls);
            }
        }
        if (this.measurement && now > this.measurement.end + 250) {
            const m = this.measurement;
            this.result = { ...m.metadata, samples: m.frames.length, fps: m.frames.length ? 1000 / mean(m.frames) : null,
                cpuMs: summary(m.cpu), gpuMs: summary(m.gpu), averageDraws: mean(m.draws),
                timerQueryAvailable: Boolean(this.extension), note: 'Observed browser timings; hardware identity not assumed.' };
            this.measurement = null;
        }
    }
    readout() {
        const frame = this.samples.map(s => s.dt);
        return { fps: frame.length ? 1000 / mean(frame) : 0, cpu: mean(this.samples.map(s => s.cpu)), gpu: mean(this.gpuSamples) };
    }
    cancel() {
        this.measurement = null;
        this.result = null;
    }
}
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
function summary(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return { mean: mean(values), p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] };
}
