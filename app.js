// app.js — application bootstrap: wires TimerEngine + AudioEngine + storage + UI together
import { t, setLang, getLang } from './i18n.js';
import * as storage from './storage.js';
import { AudioEngine } from './audio.js';
import { TimerEngine } from './timer.js';
import * as ui from './ui.js';

const audio = new AudioEngine();
const timer = new TimerEngine();
let currentBuilderCfg = { work: 30, rest: 15, rounds: 5 };
let wakeLock = null;

/* ---------- settings bootstrap ---------- */
const settings = storage.loadSettings();
setLang(settings.lang || 'ar');
audio.musicStyle = settings.musicStyle || 'energy';
audio.speechLang = t().speechLang;
audio.hapticsEnabled = settings.haptics !== false;
if (settings.reducedMotion) document.body.classList.add('reduced-motion');

function persistSettings() {
  storage.saveSettings({
    lang: getLang(),
    musicStyle: audio.musicStyle,
    reducedMotion: document.body.classList.contains('reduced-motion'),
    haptics: audio.hapticsEnabled,
  });
}

/* ---------- wake lock ---------- */
async function requestWakeLock() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }

/* ---------- timer engine event wiring ---------- */
ui.initRing();

timer.on = (name, fn) => timer.addEventListener(name, (e) => fn(e.detail)); // small convenience shim

timer.addEventListener('configChange', (e) => ui.renderConfig(e.detail));

timer.addEventListener('phaseStart', (e) => {
  const { phase, timeLeft, round } = e.detail;
  const total = phase === 'work' ? timer.settings.work : timer.settings.rest;
  ui.renderActiveRing({ phase, timeLeft, round, total, rounds: timer.settings.rounds });
  const s = t();
  if (phase === 'work' && round === 1 && timeLeft === timer.settings.work) {
    // very first work phase of the session
  }
  const cue = phase === 'work' ? s.voiceGo : s.voiceStop;
  audio.speak(cue);
  audio.vibrate(phase === 'work' ? [80, 40, 80] : 60);
  ui.announce(`${phase === 'work' ? s.work : s.rest} — ${ui.formatTime(timeLeft)}`);
});

timer.addEventListener('tick', (e) => {
  const { phase, timeLeft, round, total } = e.detail;
  ui.renderActiveRing({ phase, timeLeft, round, total, rounds: timer.settings.rounds });
});

timer.addEventListener('countdown', (e) => {
  const { timeLeft } = e.detail;
  audio.tickSound(timeLeft % 2 === 0);
  audio.speak(String(timeLeft));
  audio.vibrate(30);
});

timer.addEventListener('running', (e) => {
  ui.setStartButton(e.detail.running ? 'running' : 'paused');
  if (e.detail.running) { requestWakeLock(); if (audio.enabled) audio.initMusic(); }
  else { releaseWakeLock(); }
});

timer.addEventListener('reset', () => {
  ui.setStartButton('idle');
  ui.renderIdleRing(timer.settings.work, timer.settings.rounds);
  releaseWakeLock();
  window.speechSynthesis && window.speechSynthesis.cancel();
});

timer.addEventListener('finish', (e) => {
  const { work, rest, rounds } = e.detail;
  ui.setStartButton('idle');
  ui.renderFinishedRing(rounds);
  releaseWakeLock();
  audio.beep(1200, 300, 0.25);
  audio.vibrate([100, 60, 100, 60, 200]);

  const estCalories = storage.estimateCalories(work, rounds);
  storage.addSession({ date: new Date().toISOString(), work, rest, rounds, estCalories });
  ui.announce(t().done);
});

/* ---------- timer view controls ---------- */
document.querySelectorAll('[data-adjust]').forEach(btn => {
  btn.addEventListener('click', () => {
    timer.adjust(btn.dataset.adjust, parseInt(btn.dataset.delta, 10));
  });
});
document.querySelectorAll('.presets .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    timer.configure(parseInt(chip.dataset.work,10), parseInt(chip.dataset.rest,10), parseInt(chip.dataset.rounds,10));
    ui.renderConfig(timer.settings);
    ui.renderIdleRing(timer.settings.work, timer.settings.rounds);
  });
});
ui.$('startBtn').addEventListener('click', () => {
  audio.getCtx();
  if (timer.state.running) timer.pause(); else timer.start();
});
ui.$('resetBtn').addEventListener('click', () => timer.reset());

/* ---------- tab navigation ---------- */
document.querySelectorAll('.tab-btn').forEach(tab => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    ui.switchView(view);
    if (view === 'history') ui.renderStats(storage.getStats());
    if (view === 'builder') ui.renderBuilderList(storage.getCustomWorkouts());
  });
});

/* ---------- settings sheet ---------- */
ui.$('settingsBtn').addEventListener('click', ui.openSettings);
ui.$('closeSettingsBtn').addEventListener('click', ui.closeSettings);
ui.$('settingsOverlay').addEventListener('click', (e) => { if (e.target.id === 'settingsOverlay') ui.closeSettings(); });

document.querySelectorAll('[data-lang]').forEach(btn => {
  btn.addEventListener('click', () => {
    setLang(btn.dataset.lang);
    audio.speechLang = t().speechLang;
    ui.setChipActive(['langAr','langFr','langEn'], btn.id);
    ui.applyStaticText();
    refreshCurrentTimerLabels();
    persistSettings();
  });
});
document.querySelectorAll('[data-music]').forEach(btn => {
  btn.addEventListener('click', () => {
    audio.setMusicStyle(btn.dataset.music);
    ui.setChipActive(['musicEnergy','musicRock','musicOff'], btn.id);
    persistSettings();
  });
});
document.querySelectorAll('[data-motion]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.body.classList.toggle('reduced-motion', btn.dataset.motion === 'on');
    ui.setChipActive(['motionOn','motionOff'], btn.id);
    persistSettings();
  });
});
document.querySelectorAll('[data-haptics]').forEach(btn => {
  btn.addEventListener('click', () => {
    audio.hapticsEnabled = btn.dataset.haptics === 'on';
    ui.setChipActive(['hapticsOn','hapticsOff'], btn.id);
    persistSettings();
  });
});

ui.$('soundToggle').addEventListener('click', () => {
  audio.setEnabled(!audio.enabled);
  ui.$('soundIconOn').style.display = audio.enabled ? 'block' : 'none';
  ui.$('soundIconOff').style.display = audio.enabled ? 'none' : 'block';
  ui.$('soundToggle').setAttribute('aria-pressed', String(audio.enabled));
});

/* ---------- builder view ---------- */
document.querySelectorAll('[data-badjust]').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.badjust;
    const delta = parseInt(btn.dataset.delta, 10);
    const min = key === 'rounds' ? 1 : 5;
    currentBuilderCfg[key] = Math.max(min, currentBuilderCfg[key] + delta);
    ui.renderBuilderConfig(currentBuilderCfg);
  });
});
ui.$('builderSaveBtn').addEventListener('click', () => {
  const nameInput = ui.$('builderNameInput');
  const name = nameInput.value.trim() || t().sessionOf(currentBuilderCfg.work, currentBuilderCfg.rest, currentBuilderCfg.rounds);
  storage.saveCustomWorkout({ name, ...currentBuilderCfg });
  nameInput.value = '';
  ui.renderBuilderList(storage.getCustomWorkouts());
});
ui.$('builderList').addEventListener('click', (e) => {
  const useId = e.target.dataset.use;
  const delId = e.target.dataset.del;
  if (useId) {
    const w = storage.getCustomWorkouts().find(x => x.id === useId);
    if (w) {
      timer.configure(w.work, w.rest, w.rounds);
      ui.renderConfig(timer.settings);
      ui.renderIdleRing(timer.settings.work, timer.settings.rounds);
      ui.switchView('timer');
    }
  } else if (delId) {
    ui.renderBuilderList(storage.deleteCustomWorkout(delId));
  }
});

/* ---------- initial paint ---------- */
function refreshCurrentTimerLabels() {
  if (!timer.state.running && timer.state.phase === 'idle') {
    ui.renderIdleRing(timer.settings.work, timer.settings.rounds);
  }
}

ui.applyStaticText();
ui.renderConfig(timer.settings);
ui.renderIdleRing(timer.settings.work, timer.settings.rounds);
ui.renderBuilderConfig(currentBuilderCfg);
ui.setChipActive(['langAr','langFr','langEn'], 'lang' + getLang().charAt(0).toUpperCase() + getLang().slice(1));
ui.setChipActive(['musicEnergy','musicRock','musicOff'], 'music' + audio.musicStyle.charAt(0).toUpperCase() + audio.musicStyle.slice(1));
ui.setChipActive(['motionOn','motionOff'], document.body.classList.contains('reduced-motion') ? 'motionOn' : 'motionOff');
ui.setChipActive(['hapticsOn','hapticsOff'], audio.hapticsEnabled ? 'hapticsOn' : 'hapticsOff');

/* ---------- service worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
