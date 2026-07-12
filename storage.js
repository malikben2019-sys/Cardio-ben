// storage.js — localStorage persistence layer (history, custom workouts, settings)
const KEYS = {
  history: 'malikBenApp.history',
  customWorkouts: 'malikBenApp.customWorkouts',
  settings: 'malikBenApp.settings',
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

/* ---------- settings ---------- */
export function loadSettings() {
  return readJSON(KEYS.settings, { lang: 'ar', musicStyle: 'energy', reducedMotion: false, haptics: true });
}
export function saveSettings(settings) { writeJSON(KEYS.settings, settings); }

/* ---------- session history ---------- */
export function getHistory() {
  return readJSON(KEYS.history, []);
}

export function addSession(session) {
  const history = getHistory();
  history.push(session);
  writeJSON(KEYS.history, history);
  return history;
}

// Rough calorie estimate: ~8 kcal/min of active work time (average HIIT MET), labeled as estimate in UI.
export function estimateCalories(workSeconds, rounds) {
  const activeMinutes = (workSeconds * rounds) / 60;
  return Math.round(activeMinutes * 8);
}

export function getStats() {
  const history = getHistory();
  const totalSessions = history.length;
  const totalCalories = history.reduce((sum, s) => sum + (s.estCalories || 0), 0);

  // unique day strings (YYYY-MM-DD), sorted ascending
  const days = [...new Set(history.map(s => s.date.slice(0, 10)))].sort();

  let bestStreak = 0, currentStreak = 0;
  if (days.length) {
    let run = 1;
    bestStreak = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]);
      const cur = new Date(days[i]);
      const diffDays = Math.round((cur - prev) / 86400000);
      if (diffDays === 1) { run++; } else { run = 1; }
      bestStreak = Math.max(bestStreak, run);
    }
    // current streak: count back from most recent day
    const today = new Date(); today.setHours(0,0,0,0);
    const lastDay = new Date(days[days.length - 1]); lastDay.setHours(0,0,0,0);
    const gapFromToday = Math.round((today - lastDay) / 86400000);
    if (gapFromToday <= 1) {
      currentStreak = 1;
      for (let i = days.length - 1; i > 0; i--) {
        const a = new Date(days[i-1]); const b = new Date(days[i]);
        const diff = Math.round((b - a) / 86400000);
        if (diff === 1) currentStreak++; else break;
      }
    } else {
      currentStreak = 0;
    }
  }

  // sessions in the last 7 days, grouped by weekday index (0=Sun)
  const weekCounts = [0,0,0,0,0,0,0];
  const cutoff = Date.now() - 7 * 86400000;
  history.forEach(s => {
    const d = new Date(s.date);
    if (d.getTime() >= cutoff) weekCounts[d.getDay()]++;
  });

  return { totalSessions, totalCalories, bestStreak, currentStreak, weekCounts, history: [...history].reverse() };
}

/* ---------- custom workouts ---------- */
export function getCustomWorkouts() {
  return readJSON(KEYS.customWorkouts, []);
}
export function saveCustomWorkout(workout) {
  const list = getCustomWorkouts();
  list.push({ id: Date.now().toString(36), ...workout });
  writeJSON(KEYS.customWorkouts, list);
  return list;
}
export function deleteCustomWorkout(id) {
  const list = getCustomWorkouts().filter(w => w.id !== id);
  writeJSON(KEYS.customWorkouts, list);
  return list;
}
