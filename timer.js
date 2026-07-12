// timer.js — interval timer state machine (EventTarget-based, framework-free)
export class TimerEngine extends EventTarget {
  constructor() {
    super();
    this.settings = { work: 30, rest: 15, rounds: 5 };
    this.state = { running: false, phase: 'idle', timeLeft: 0, round: 1 };
    this.intervalId = null;
  }

  emit(name, detail) { this.dispatchEvent(new CustomEvent(name, { detail })); }

  configure(work, rest, rounds) {
    if (this.state.running) return;
    this.settings = { work, rest, rounds };
    this.emit('configChange', { ...this.settings });
  }

  adjust(key, delta) {
    if (this.state.running) return;
    const min = key === 'rounds' ? 1 : 5;
    this.settings[key] = Math.max(min, this.settings[key] + delta);
    this.emit('configChange', { ...this.settings });
  }

  start() {
    if (this.state.running) return;
    if (this.state.phase === 'idle') {
      this.state.phase = 'work';
      this.state.timeLeft = this.settings.work;
      this.state.round = 1;
      this.emit('phaseStart', { phase: 'work', timeLeft: this.state.timeLeft, round: this.state.round });
    }
    this.state.running = true;
    this.emit('running', { running: true });
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  pause() {
    if (!this.state.running) return;
    this.state.running = false;
    clearInterval(this.intervalId);
    this.emit('running', { running: false });
  }

  reset() {
    this.pause();
    this.state.phase = 'idle';
    this.state.round = 1;
    this.state.timeLeft = 0;
    this.emit('reset', {});
  }

  tick() {
    this.state.timeLeft--;
    if (this.state.timeLeft <= 0) {
      if (this.state.phase === 'work') {
        if (this.state.round >= this.settings.rounds) {
          this.finish();
          return;
        }
        this.state.phase = 'rest';
        this.state.timeLeft = this.settings.rest;
        this.emit('phaseStart', { phase: 'rest', timeLeft: this.state.timeLeft, round: this.state.round });
      } else {
        this.state.round++;
        this.state.phase = 'work';
        this.state.timeLeft = this.settings.work;
        this.emit('phaseStart', { phase: 'work', timeLeft: this.state.timeLeft, round: this.state.round });
      }
    } else if (this.state.timeLeft <= 3 && this.state.timeLeft >= 1) {
      this.emit('countdown', { timeLeft: this.state.timeLeft });
    }
    this.emit('tick', { ...this.state, total: this.state.phase === 'work' ? this.settings.work : this.settings.rest });
  }

  finish() {
    this.state.running = false;
    clearInterval(this.intervalId);
    const summary = {
      work: this.settings.work, rest: this.settings.rest, rounds: this.settings.rounds,
      totalSeconds: (this.settings.work + this.settings.rest) * this.settings.rounds,
    };
    this.state.phase = 'idle';
    this.emit('finish', summary);
  }
}
