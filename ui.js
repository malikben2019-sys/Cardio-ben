// ui.js — DOM rendering and view management (no business logic, no timers)
import { t, getLang } from './i18n.js';

const RADIUS = 120;
export const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function $(id) { return document.getElementById(id); }

export function announce(msg) {
  const el = $('liveRegion');
  if (el) el.textContent = msg;
}

export function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

/* ---------- timer ring ---------- */
export function initRing() {
  const ring = $('progressRing');
  ring.style.strokeDasharray = CIRCUMFERENCE;
  ring.style.strokeDashoffset = 0;
}

export function renderIdleRing(work, rounds) {
  const s = t();
  $('phaseLabel').textContent = s.ready;
  $('phaseLabel').style.color = '';
  $('timeDisplay').textContent = formatTime(work);
  $('roundLabel').textContent = s.round(1, rounds);
  $('progressRing').style.stroke = '#B3A9D6';
  $('progressRing').style.strokeDashoffset = 0;
}

export function renderActiveRing({ phase, timeLeft, round, total, rounds }) {
  const s = t();
  const color = phase === 'work' ? 'var(--pink)' : 'var(--cyan)';
  $('phaseLabel').textContent = phase === 'work' ? s.work : s.rest;
  $('phaseLabel').style.color = color;
  $('progressRing').style.stroke = color;
  $('timeDisplay').textContent = formatTime(timeLeft);
  $('roundLabel').textContent = s.round(round, rounds);
  const offset = CIRCUMFERENCE * (1 - timeLeft / total);
  $('progressRing').style.strokeDashoffset = offset;
}

export function renderFinishedRing(rounds) {
  const s = t();
  $('phaseLabel').textContent = s.done;
  $('phaseLabel').style.color = 'var(--cyan)';
  $('timeDisplay').textContent = '✓';
  $('roundLabel').textContent = s.doneRounds(rounds);
  $('progressRing').style.strokeDashoffset = 0;
}

/* ---------- start button state ---------- */
export function setStartButton(mode) {
  const s = t();
  const btn = $('startBtn');
  if (mode === 'running') { btn.textContent = s.pause; btn.className = 'btn btn-pause'; }
  else if (mode === 'paused') { btn.textContent = s.resume; btn.className = 'btn btn-start'; }
  else { btn.textContent = s.start; btn.className = 'btn btn-start'; }
}

/* ---------- config fields ---------- */
export function renderConfig(settings) {
  $('workVal').textContent = settings.work;
  $('restVal').textContent = settings.rest;
  $('roundsVal').textContent = settings.rounds;
}

/* ---------- views / tabs ---------- */
export function switchView(view) {
  ['timer', 'history', 'builder'].forEach(v => {
    $('view-' + v).hidden = v !== view;
    const tab = $('tab' + v.charAt(0).toUpperCase() + v.slice(1));
    tab.classList.toggle('active', v === view);
    tab.setAttribute('aria-selected', v === view ? 'true' : 'false');
  });
}

/* ---------- settings sheet ---------- */
export function openSettings() { $('settingsOverlay').classList.add('open'); }
export function closeSettings() { $('settingsOverlay').classList.remove('open'); }

export function setChipActive(groupIds, activeId) {
  groupIds.forEach(id => $(id).classList.remove('active'));
  $(activeId).classList.add('active');
}

/* ---------- history view ---------- */
export function renderStats(stats) {
  const s = t();
  $('statTotal').textContent = stats.totalSessions;
  $('statStreak').textContent = stats.currentStreak;
  $('statBest').textContent = stats.bestStreak;
  $('statCalories').textContent = stats.totalCalories;

  const dayNames = { ar: ['أحد','اثن','ثلا','أرب','خمي','جمع','سبت'], fr: ['D','L','M','M','J','V','S'], en: ['S','M','T','W','T','F','S'] };
  const names = dayNames[getLang()] || dayNames.en;
  const max = Math.max(1, ...stats.weekCounts);
  const bars = $('weekBars');
  bars.innerHTML = '';
  stats.weekCounts.forEach((count, i) => {
    const col = document.createElement('div');
    col.className = 'week-bar-col';
    const bar = document.createElement('div');
    bar.className = 'week-bar';
    bar.style.height = Math.max(6, (count / max) * 60) + 'px';
    const label = document.createElement('div');
    label.className = 'week-bar-label';
    label.textContent = names[i];
    col.appendChild(bar);
    col.appendChild(label);
    bars.appendChild(col);
  });

  const list = $('historyList');
  list.innerHTML = '';
  if (!stats.history.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-note';
    empty.textContent = s.noHistory;
    list.appendChild(empty);
    return;
  }
  stats.history.slice(0, 30).forEach(session => {
    const card = document.createElement('div');
    card.className = 'history-card';
    const d = new Date(session.date);
    const dateStr = d.toLocaleDateString(getLang() === 'ar' ? 'ar' : getLang(), { month: 'short', day: 'numeric' });
    card.innerHTML = `
      <div class="hc-left">
        <div class="hc-type">${session.name || s.sessionOf(session.work, session.rest, session.rounds)}</div>
        <div class="hc-date">${dateStr}</div>
      </div>
      <div class="hc-cal">${session.estCalories} kcal</div>
    `;
    list.appendChild(card);
  });
}

/* ---------- builder view ---------- */
export function renderBuilderConfig(cfg) {
  $('bWorkVal').textContent = cfg.work;
  $('bRestVal').textContent = cfg.rest;
  $('bRoundsVal').textContent = cfg.rounds;
}

export function renderBuilderList(workouts, lang) {
  const s = t();
  const list = $('builderList');
  list.innerHTML = '';
  if (!workouts.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-note';
    empty.textContent = s.builderEmpty;
    list.appendChild(empty);
    return;
  }
  workouts.forEach(w => {
    const card = document.createElement('div');
    card.className = 'builder-card';
    card.innerHTML = `
      <div>
        <div class="bc-name">${w.name}</div>
        <div class="bc-detail">${s.sessionOf(w.work, w.rest, w.rounds)}</div>
      </div>
      <div class="bc-actions">
        <button class="bc-btn bc-use" data-use="${w.id}">${s.builderLoad}</button>
        <button class="bc-btn bc-del" data-del="${w.id}">${s.builderDelete}</button>
      </div>
    `;
    list.appendChild(card);
  });
}

/* ---------- full static text pass (on language change) ---------- */
export function applyStaticText() {
  const s = t();
  document.getElementById('htmlRoot').setAttribute('lang', getLang());
  document.getElementById('htmlRoot').setAttribute('dir', s.dir);
  $('titleText').textContent = s.title;
  $('subtitleText').textContent = s.subtitle;
  $('workLabelText').textContent = s.workLabel;
  $('restLabelText').textContent = s.restLabel;
  $('roundsLabelText').textContent = s.roundsLabel;
  $('resetBtn').textContent = s.reset;
  $('presetTabata').textContent = s.presetTabata;
  $('presetStandard').textContent = s.presetStandard;
  $('presetEndurance').textContent = s.presetEndurance;
  $('settingsTitleText').textContent = s.settingsTitle;
  $('languageLabelText').textContent = s.languageLabel;
  $('musicLabelText').textContent = s.musicLabel;
  $('musicEnergy').textContent = s.musicEnergy;
  $('musicRock').textContent = s.musicRock;
  $('musicOff').textContent = s.musicOff;
  $('motionLabelText').textContent = s.motionLabel;
  $('motionOn').textContent = s.motionOn;
  $('motionOff').textContent = s.motionOff;
  $('hapticsLabelText').textContent = s.hapticsLabel;
  $('hapticsOn').textContent = s.hapticsOn;
  $('hapticsOff').textContent = s.hapticsOff;
  $('closeSettingsBtn').textContent = s.closeBtn;
  $('installHintText').textContent = s.installHint;
  $('navTimerText').textContent = s.navTimer;
  $('navHistoryText').textContent = s.navHistory;
  $('navBuilderText').textContent = s.navBuilder;
  $('historyTitleText').textContent = s.historyTitle;
  $('statTotalLabel').textContent = s.totalSessions;
  $('statStreakLabel').textContent = s.currentStreak;
  $('statBestLabel').textContent = s.bestStreak;
  $('statCaloriesLabel').textContent = s.estCalories;
  $('builderTitleText').textContent = s.builderTitle;
  $('builderNameLabel').textContent = s.builderName;
  $('builderNameInput').placeholder = s.builderNamePh;
  $('bWorkLabelText').textContent = s.workLabel;
  $('bRestLabelText').textContent = s.restLabel;
  $('bRoundsLabelText').textContent = s.roundsLabel;
  $('builderSaveBtn').textContent = s.builderSave;
  $('builderSavedTitle').textContent = s.builderSaved;
}
