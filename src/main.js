// @ts-check
// Entry point: loading screen, menu with the contract dossier, pause, settings and results.
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createGame } from './game.js';
import { renderPortrait } from './people.js';
import { HARBOR } from './missions.js';
import { loadSettings, saveSettings, loadBest, saveBest } from './settings.js';
import { loadProgress, saveProgress, levelOf, rewardFor } from './progress.js';

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const SCREENS = ['loading', 'menu', 'pause', 'settings', 'credits', 'results'];

let settings = loadSettings();
let settingsReturn = 'menu';
let progress = loadProgress();

const audio = createAudio();
audio.setEnabled(settings.sound);
const hud = createHud();
const viewCanvas = /** @type {HTMLCanvasElement} */ ($('view'));
const scopeCanvas = /** @type {HTMLCanvasElement} */ ($('scope'));

/** @type {any} */
let game = null;

const input = createInput(viewCanvas, {
  fire: () => game && game.fire(),
  scope: () => game && game.toggleScope(),
  breath: (on) => game && game.setBreath(on),
  reload: () => game && game.reload(),
  zoom: (n) => game && game.zoomStep(n),
  pause: () => pauseGame()
});
// Any touch unlocks audio (browsers need a gesture) and skips the bullet cam.
window.addEventListener('pointerdown', () => {
  audio.unlock();
  if (game) game.skipCinematic();
});

function show(name) {
  for (const s of SCREENS) $('screen-' + s).hidden = s !== name;
  hud.show(name === null);
}

// ---------- contract card ----------

$('contract-number').textContent = 'Contract ' + String(HARBOR.number).padStart(2, '0');
$('contract-title').textContent = HARBOR.title;
$('contract-district').textContent = HARBOR.district;
$('contract-briefing').textContent = HARBOR.briefing;
$('target-name').textContent = HARBOR.target.name;
$('target-description').textContent = HARBOR.target.description;
const starList = $('contract-stars');
for (const text of HARBOR.stars) {
  const li = document.createElement('li');
  li.textContent = text;
  starList.appendChild(li);
}
showBest();
showWallet();

function showWallet() {
  const lv = levelOf(progress.xp);
  $('wallet-level').textContent = String(lv.level);
  $('wallet-xp').style.width = Math.round(lv.fraction * 100) + '%';
  $('wallet-cash').textContent = progress.cash.toLocaleString('en-US');
}

function showBest() {
  const best = loadBest(HARBOR.id);
  $('contract-best').textContent = best === null ? 'Not completed yet' : 'Best: ' + '★'.repeat(best) + '☆'.repeat(3 - best);
}

// ---------- loading ----------

show('loading');
const loadingText = $('loading-text');
createGame({
  canvas: viewCanvas,
  scopeCanvas,
  hud,
  audio,
  input,
  settings,
  onEnd: showResults,
  onProgress: (text) => {
    loadingText.textContent = text;
  }
}).then((g) => {
  game = g;
  /** @type {any} */ (window).SKY = { game, settings: () => settings };
  const src = game.portraitSource;
  renderPortrait(/** @type {HTMLCanvasElement} */ ($('target-photo')), src.gltf, src.baseHeight, src.look);
  let autostart = false;
  try {
    autostart = sessionStorage.getItem('skyline.autostart') === '1';
    sessionStorage.removeItem('skyline.autostart');
  } catch (err) {
    /* storage blocked */
  }
  if (autostart) startMission();
  else show('menu');
  maybeSelfTest();
  window.addEventListener('hashchange', maybeSelfTest);
}).catch((err) => {
  console.error(err);
  loadingText.textContent = 'The city did not load. Check your connection and reload.';
});

$('btn-start').addEventListener('click', () => startMission());
$('btn-menu-settings').addEventListener('click', () => openSettings('menu'));

function startMission() {
  audio.unlock();
  enterFullscreen();
  if (settings.gyro !== 'off') input.requestGyroPermission();
  show(null);
  game.begin();
}

// First contract only: hints that walk the player through scope, aim and fire.
setInterval(() => {
  if (!game || progress.tutorialDone || location.hash === '#selftest') return;
  const st = game.debug.state();
  if (st.mode !== 'playing' || st.shots > 0 || st.result !== null) {
    hud.hint(null);
    return;
  }
  if (!st.scoped) hud.hint('Tap SCOPE to look through the scope', 'btn-scope');
  else if (!st.onTarget) hud.hint('Drag to put the cross on Victor Hale', null);
  else hud.hint('Hold your breath, then press FIRE', 'btn-fire');
}, 200);

// ---------- in-game buttons ----------

function press(id, fn) {
  $(id).addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  });
}
press('btn-fire', () => game.fire());
press('btn-scope', () => game.toggleScope());
press('btn-reload', () => game.reload());
press('btn-pause', () => pauseGame());

const breathBtn = $('btn-breath');
breathBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try {
    breathBtn.setPointerCapture(e.pointerId);
  } catch (err) {
    /* optional */
  }
  game.setBreath(true);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  breathBtn.addEventListener(type, () => game && game.setBreath(false));
}
const zoom = /** @type {HTMLInputElement} */ ($('zoom'));
zoom.addEventListener('input', () => game.setZoom(parseFloat(zoom.value)));

// ---------- pause ----------

function pauseGame() {
  if (game && game.pause()) show('pause');
}
$('btn-resume').addEventListener('click', () => {
  show(null);
  game.resume();
});
$('btn-restart').addEventListener('click', () => restartContract());
$('btn-quit').addEventListener('click', () => backToMenu());

/** Shows a short loading screen while the people are rebuilt, then plays again. */
async function restartContract() {
  loadingText.textContent = 'Resetting the plaza';
  show('loading');
  await game.restart();
  show(null);
}

async function backToMenu() {
  loadingText.textContent = 'Resetting the plaza';
  show('loading');
  await game.toMenu();
  showBest();
  showWallet();
  show('menu');
}
$('btn-pause-settings').addEventListener('click', () => openSettings('pause'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

// ---------- Android back button (only inside the Capacitor app) ----------

const cap = /** @type {any} */ (window).Capacitor;
if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.App) {
  cap.Plugins.App.addListener('backButton', () => {
    const open = SCREENS.find((s) => !$('screen-' + s).hidden);
    if (!open) pauseGame();
    else if (open === 'pause') {
      show(null);
      game.resume();
    } else if (open === 'settings') $('btn-settings-done').click();
    else if (open === 'results') backToMenu();
    else cap.Plugins.App.exitApp();
  });
}

// ---------- settings ----------

const form = {
  quality: /** @type {HTMLSelectElement} */ ($('set-quality')),
  sensitivity: /** @type {HTMLInputElement} */ ($('set-sensitivity')),
  sensitivityOut: $('set-sensitivity-out'),
  gyro: /** @type {HTMLSelectElement} */ ($('set-gyro')),
  markers: /** @type {HTMLInputElement} */ ($('set-markers')),
  bulletCam: /** @type {HTMLInputElement} */ ($('set-bulletcam')),
  sound: /** @type {HTMLInputElement} */ ($('set-sound')),
  trail: /** @type {HTMLInputElement} */ ($('set-trail'))
};

function openSettings(from) {
  settingsReturn = from;
  form.quality.value = settings.quality;
  form.sensitivity.value = String(settings.sensitivity);
  form.sensitivityOut.textContent = settings.sensitivity.toFixed(1) + '×';
  form.gyro.value = settings.gyro;
  form.markers.checked = settings.markers;
  form.bulletCam.checked = settings.bulletCam;
  form.sound.checked = settings.sound;
  form.trail.checked = settings.trail;
  show('settings');
}
form.sensitivity.addEventListener('input', () => {
  form.sensitivityOut.textContent = parseFloat(form.sensitivity.value).toFixed(1) + '×';
});
$('btn-credits').addEventListener('click', () => show('credits'));
$('btn-credits-back').addEventListener('click', () => show('settings'));
$('btn-settings-done').addEventListener('click', async () => {
  const wantsGyro = form.gyro.value !== 'off' && settings.gyro === 'off';
  settings = {
    quality: /** @type {any} */ (form.quality.value),
    sensitivity: parseFloat(form.sensitivity.value),
    gyro: /** @type {any} */ (form.gyro.value),
    markers: form.markers.checked,
    bulletCam: form.bulletCam.checked,
    sound: form.sound.checked,
    trail: form.trail.checked
  };
  if (wantsGyro) await input.requestGyroPermission();
  saveSettings(settings);
  if (game) game.applySettings(settings);
  show(settingsReturn);
});

// ---------- results ----------

function showResults(r) {
  const win = r.result === 'win';
  const titles = {
    win: 'Contract complete',
    escaped: 'Target escaped',
    civilian: 'Contract terminated'
  };
  const lines = {
    win: r.head ? 'One shot to the head. Hale never reached his car.' : 'Hale is down. The harbour has one less banker.',
    escaped: 'Hale reached his car and is gone. He will be twice as careful next time.',
    civilian: 'A civilian is dead. The client cancels the contract and the police seal the district.'
  };
  $('results-title').textContent = titles[r.result] || 'Contract over';
  $('results-line').textContent = lines[r.result] || '';
  $('results-stars').textContent = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
  $('results-stars').dataset.tone = win ? 'good' : 'bad';
  $('res-time').textContent = Math.floor(r.time / 60) + ':' + String(Math.floor(r.time % 60)).padStart(2, '0');
  $('res-shots').textContent = String(r.shots);
  $('res-distance').textContent = r.distance ? Math.round(r.distance) + ' m' : '---';
  $('res-head').textContent = r.head ? 'Yes' : 'No';
  if (win) {
    const best = loadBest(HARBOR.id);
    if (best === null || r.stars > best) saveBest(HARBOR.id, r.stars);
  }
  const pay = rewardFor(r);
  const levelBefore = levelOf(progress.xp).level;
  progress.cash += pay.cash;
  progress.xp += pay.xp;
  if (win) {
    progress.contracts++;
    progress.tutorialDone = true;
  }
  saveProgress(progress);
  showWallet();
  const list = $('results-rewards');
  list.textContent = '';
  const row = (label, value, cls) => {
    const li = document.createElement('li');
    if (cls) li.className = cls;
    const a = document.createElement('span');
    a.textContent = label;
    const b = document.createElement('span');
    b.textContent = value;
    li.append(a, b);
    list.appendChild(li);
  };
  for (const l of pay.lines) row(l.label, '$' + l.cash, '');
  const levelAfter = levelOf(progress.xp).level;
  row(win ? 'Paid' : 'No payment', '$' + pay.cash + '  \u00b7  +' + pay.xp + ' XP' + (levelAfter > levelBefore ? '  \u00b7  Level ' + levelAfter + '!' : ''), 'total');
  setTimeout(() => show('results'), win ? 300 : 0);
}
$('btn-retry').addEventListener('click', () => restartContract());
$('btn-results-menu').addEventListener('click', () => backToMenu());

// ---------- helpers ----------

function enterFullscreen() {
  try {
    const el = /** @type {any} */ (document.documentElement);
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => {
        const so = /** @type {any} */ (screen).orientation;
        if (so && so.lock) return so.lock('landscape');
        return undefined;
      })
      .catch(() => {});
  } catch (err) {
    /* optional */
  }
}

let selfTestStarted = false;
/** Open the page with #selftest: one solved shot at the target, result printed on screen. */
async function maybeSelfTest() {
  if (selfTestStarted || location.hash !== '#selftest' || !game) return;
  selfTestStarted = true;
  const out = document.createElement('pre');
  out.style.cssText = 'position:fixed;left:8px;top:64px;z-index:100;margin:0;padding:8px 10px;'
    + 'background:rgba(0,0,0,.8);color:#fff;font:12px/1.4 monospace;pointer-events:none';
  document.body.appendChild(out);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  show(null);
  game.begin();
  game.debug.steady(true);
  game.toggleScope();
  out.textContent = 'SELFTEST: waiting for Hale to walk out';
  await wait(7000);
  game.debug.solveTarget('body');
  await wait(150);
  game.debug.solveTarget('body');
  game.fire();
  out.textContent = 'SELFTEST: shot fired, mode ' + game.mode;
  for (let i = 0; i < 40 && game.mode !== 'over'; i++) await wait(250);
  const st = game.debug.state();
  out.textContent = 'SELFTEST ' + (st.result === 'win' ? 'PASS' : 'FAIL') + '\nresult: ' + st.result + '\nshots: ' + st.shots + '\nmode: ' + game.mode;
}
