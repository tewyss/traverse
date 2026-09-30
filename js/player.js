export class Player {
  constructor({ apply, onProgress, onStateChange }) {
    this.apply = apply;
    this.onProgress = onProgress;
    this.onStateChange = onStateChange;
    this.sps = 350;
    this.phases = [];
    this.phase = 0;
    this.pos = 0;
    this.done = 0;
    this.total = 0;
    this.playing = false;
    this.tick = this.tick.bind(this);
  }

  get active() {
    return this.phase < this.phases.length;
  }

  load(phases, onDone) {
    this.cancel();
    this.phases = phases.filter((p) => p.ops.length);
    this.phase = 0;
    this.pos = 0;
    this.done = 0;
    this.total = this.phases.reduce((sum, p) => sum + p.ops.length / 2, 0);
    this.wait = this.phases[0]?.delay ?? 0;
    this.onDone = onDone;
    this.onProgress?.(0, this.total);
    if (!this.active) this.complete();
  }

  play() {
    if (!this.active || this.playing) return;
    this.playing = true;
    this.acc = 0;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
    this.onStateChange?.();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.onStateChange?.();
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  step() {
    this.pause();
    this.advance(1, false);
  }

  finish() {
    this.pause();
    this.advance(Infinity, true);
  }

  cancel() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.phases = [];
    this.phase = 0;
    this.onDone = null;
    this.onStateChange?.();
  }

  tick(now) {
    const dt = Math.min(now - this.last, 64);
    this.last = now;
    if (this.wait > 0) {
      this.wait -= dt;
    } else {
      const rate = this.phases[this.phase].rate ?? this.sps;
      this.acc += (dt * rate) / 1000;
      const n = Math.floor(this.acc);
      if (n > 0) {
        this.acc -= n;
        this.advance(n, false);
      }
    }
    if (this.playing) this.raf = requestAnimationFrame(this.tick);
  }

  advance(n, instant) {
    while (n > 0 && this.active) {
      const ops = this.phases[this.phase].ops;
      this.apply(ops[this.pos], ops[this.pos + 1], instant);
      this.pos += 2;
      this.done++;
      n--;
      if (this.pos >= ops.length) {
        this.phase++;
        this.pos = 0;
        this.acc = 0;
        this.wait = this.phases[this.phase]?.delay ?? 0;
        if (!instant) break;
      }
    }
    this.onProgress?.(this.done, this.total);
    if (!this.active) this.complete();
  }

  complete() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    const done = this.onDone;
    this.onDone = null;
    this.phases = [];
    this.phase = 0;
    this.onStateChange?.();
    done?.();
  }
}
