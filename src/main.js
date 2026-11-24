// @ts-check
// Entry point: loading screen, menu with the contract dossier, pause, settings and results.
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createGame } from './game.js';
import { renderPortrait } from './people.js';
import { MISSIONS, missionById } from './missions.js';
import { SCENES } from './scenes/index.js';
import { loadSettings, saveSettings, loadBest, saveBest, resetBest } from './settings.js';
import { loadProgress, saveProgress, resetProgress, levelOf, rewardFor, levelBonus } from './progress.js';
import { RIFLES, UPGRADES, upgradeLevel, nextPrice, buyUpgrade, loadoutFor, rifleState, buyRifle, equipRifle, ownsRifle } from './armory.js';
import { createArmoryView } from './armory-view.js';

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const SCREENS = ['loading', 'menu', 'contracts', 'armory', 'profile', 'pause', 'settings', 'credits', 'results'];

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
  if (name === 'armory') armoryView.show();
  else armoryView.hide();
}

const armoryView = createArmoryView(/** @type {HTMLCanvasElement} */ ($('armory-rifle')));

// ---------- Contracts ----------

/** A contract is open when the one before it has been completed at least once. */
function isUnlocked(index) {
  if (!isBuilt(index)) return false;
  return index === 0 || (loadBest(MISSIONS[index - 1].id) || 0) > 0;
}

/** Contracts whose scene is not in the game yet show as "Coming soon". */
function isBuilt(index) {
  return !!SCENES[MISSIONS[index].scene];
}

/** The contract the Play button starts: the first open one not yet completed, else the last open. */
function nextMissionId() {
  let last = MISSIONS[0].id;
  for (let i = 0; i < MISSIONS.length; i++) {
    if (!isUnlocked(i)) break;
    last = MISSIONS[i].id;
    if (!loadBest(MISSIONS[i].id)) return MISSIONS[i].id;
  }
  return last;
}

function renderContracts() {
  const grid = $('contract-grid');
  grid.textContent = '';
  MISSIONS.forEach((m, index) => {
    const open = isUnlocked(index);
    const card = document.createElement('div');
    card.className = 'contract-card' + (open ? '' : ' locked');
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = 'Contract ' + String(m.number).padStart(2, '0');
    const h = document.createElement('h3');
    h.textContent = m.title;
    const where = document.createElement('div');
    where.className = 'where';
    where.textContent = m.district;
    card.append(num, h, where);
    if (open) {
      const best = loadBest(m.id) || 0;
      const stars = document.createElement('div');
      stars.className = 'stars';
      stars.textContent = '\u2605'.repeat(best) + '\u2606'.repeat(3 - best);
      const play = document.createElement('button');
      play.className = 'btn btn-primary';
      play.type = 'button';
      play.textContent = best ? 'Play again' : 'Play';
      play.addEventListener('click', () => startMission(m.id));
      card.append(stars, play);
    } else {
      const lock = document.createElement('div');
      lock.className = 'lock';
      lock.textContent = isBuilt(index) ? 'Locked: complete ' + MISSIONS[index - 1].title : 'Coming soon';
      card.append(lock);
    }
    grid.appendChild(card);
  });
}
$('btn-nav-contracts').addEventListener('click', () => {
  renderContracts();
  showCash();
  show('contracts');
});
$('btn-contracts-back').addEventListener('click', () => show('menu'));

// ---------- Armory ----------

function showCash() {
  for (const el of document.querySelectorAll('.cash-now')) el.textContent = progress.cash.toLocaleString('en-US');
}

/** The rifle shown in the Armory (owned or not); starts on the equipped one. */
let armoryRifle = progress.rifle;

function renderArmory() {
  const level = levelOf(progress.xp).level;
  const tabs = $('rifle-tabs');
  tabs.textContent = '';
  for (const r of RIFLES) {
    const st = rifleState(progress, r, level);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rifle-tab';
    b.setAttribute('aria-pressed', String(armoryRifle === r.id));
    const name = document.createElement('b');
    name.textContent = r.name;
    const sub = document.createElement('span');
    sub.textContent = st.state === 'equipped' ? 'Equipped' : st.state === 'owned' ? 'Owned' : 'Level ' + r.unlock.level + ' · $' + r.unlock.price.toLocaleString('en-US');
    b.append(name, sub);
    b.addEventListener('click', () => {
      armoryRifle = r.id;
      renderArmory();
    });
    tabs.appendChild(b);
  }
  const rifle = RIFLES.find((r) => r.id === armoryRifle) || RIFLES[0];
  const st = rifleState(progress, rifle, level);
  $('rifle-desc').textContent = rifle.calibre + '. ' + rifle.description;
  const action = /** @type {HTMLButtonElement} */ ($('rifle-action'));
  action.disabled = st.state === 'equipped' || st.state === 'locked';
  action.textContent = st.state === 'equipped' ? 'Equipped' : st.state === 'owned' ? 'Equip' :
    st.state === 'buy' ? 'Buy $' + rifle.unlock.price.toLocaleString('en-US') : st.reason;
  action.onclick = () => {
    const ok = st.state === 'buy' ? buyRifle(progress, rifle, level) : st.state === 'owned' ? equipRifle(progress, rifle.id) : false;
    if (!ok) return;
    saveProgress(progress);
    audio.unlock();
    renderArmory();
    showCash();
    showWallet();
  };
  const list = $('upgrade-list');
  list.textContent = '';
  if (!ownsRifle(progress, rifle.id)) {
    const li = document.createElement('li');
    li.className = 'upgrade-note';
    li.textContent = 'Buy the ' + rifle.name + ' to upgrade it. Upgrades belong to each rifle.';
    list.appendChild(li);
    return;
  }
  for (const u of UPGRADES) {
    const lv = upgradeLevel(progress, rifle.id, u.id);
    const price = nextPrice(progress, rifle.id, u);
    const li = document.createElement('li');
    li.className = 'upgrade';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = u.name;
    const value = document.createElement('div');
    value.className = 'value';
    value.textContent = u.format(u.values[lv]);
    if (price !== null) {
      const next = document.createElement('em');
      next.textContent = '  → ' + u.format(u.values[lv + 1]);
      value.appendChild(next);
    }
    const pips = document.createElement('div');
    pips.className = 'pips';
    for (let i = 0; i < u.prices.length; i++) {
      const p = document.createElement('i');
      if (i < lv) p.className = 'on';
      pips.appendChild(p);
    }
    const buy = document.createElement('button');
    buy.type = 'button';
    buy.className = 'btn btn-primary';
    if (price === null) {
      buy.textContent = 'Max';
      buy.disabled = true;
    } else {
      buy.textContent = '$' + price.toLocaleString('en-US');
      buy.disabled = progress.cash < price;
      buy.title = progress.cash < price ? 'Earn $' + (price - progress.cash).toLocaleString('en-US') + ' more' : 'Upgrade ' + u.name;
      buy.addEventListener('click', () => {
        if (!buyUpgrade(progress, rifle.id, u)) return;
        saveProgress(progress);
        audio.unlock();
        renderArmory();
        showCash();
        showWallet();
      });
    }
    li.append(name, buy, value, pips);
    list.appendChild(li);
  }
}
$('btn-nav-armory').addEventListener('click', () => {
  armoryRifle = progress.rifle;
  renderArmory();
  showCash();
  show('armory');
});
$('btn-armory-back').addEventListener('click', () => show('menu'));

// ---------- Profile (the agent's account) ----------

let resetArmed = false;

function renderProfile() {
  const lv = levelOf(progress.xp);
  const st = progress.stats;
  let stars = 0;
  let done = 0;
  for (const m of MISSIONS) {
    const b = loadBest(m.id) || 0;
    stars += b;
    if (b > 0) done++;
  }
  $('profile-level').textContent = String(lv.level);
  $('profile-xp').style.width = Math.round(lv.fraction * 100) + '%';
  $('profile-xp-text').textContent = lv.toNext.toLocaleString('en-US') + ' XP to level ' + (lv.level + 1);
  const rifle = RIFLES.find((r) => r.id === progress.rifle) || RIFLES[0];
  const rows = [
    ['Cash', '$' + progress.cash.toLocaleString('en-US')],
    ['Contracts', done + ' / ' + MISSIONS.length],
    ['Stars', stars + ' / ' + MISSIONS.length * 3],
    ['Wins', String(st.wins)],
    ['Headshots', String(st.heads)],
    ['Shots fired', String(st.shots)],
    ['Longest kill', st.bestDistance ? Math.round(st.bestDistance) + ' m' : '---'],
    ['Earned', '$' + st.earned.toLocaleString('en-US')],
    ['Spent', '$' + st.spent.toLocaleString('en-US')],
    ['Rifle', rifle.name]
  ];
  const grid = $('profile-stats');
  grid.textContent = '';
  for (const [k, v] of rows) {
    const d = document.createElement('div');
    d.className = 'stat';
    const b = document.createElement('b');
    b.textContent = k;
    const sp = document.createElement('span');
    sp.textContent = v;
    d.append(b, sp);
    grid.appendChild(d);
  }
  resetArmed = false;
  $('btn-profile-reset').textContent = 'Reset progress';
}
$('btn-profile').addEventListener('click', () => {
  renderProfile();
  show('profile');
});
$('btn-profile-back').addEventListener('click', () => show('menu'));
$('btn-profile-reset').addEventListener('click', () => {
  // Two taps: the first arms it, the second wipes cash, level, rifles, upgrades and stars.
  if (!resetArmed) {
    resetArmed = true;
    $('btn-profile-reset').textContent = 'Tap again to erase everything';
    return;
  }
  progress = resetProgress();
  resetBest();
  armoryRifle = progress.rifle;
  if (game) game.setLoadout(loadoutFor(progress));
  showWallet();
  renderProfile();
  renderDossier(missionById(nextMissionId()));
});

// ---------- contract card ----------

/** Fills the home screen's dossier card for a contract. */
function renderDossier(m) {
  $('contract-number').textContent = 'Contract ' + String(m.number).padStart(2, '0');
  $('contract-title').textContent = m.title;
  $('contract-district').textContent = m.district;
  $('contract-briefing').textContent = m.briefing;
  $('target-name').textContent = m.target.name;
  $('target-description').textContent = m.target.description;
  const starList = $('contract-stars');
  starList.textContent = '';
  for (const text of m.stars) {
    const li = document.createElement('li');
    li.textContent = text;
    starList.appendChild(li);
  }
  const open = MISSIONS.filter((_, i) => isUnlocked(i)).length;
  $('nav-contracts-sub').textContent = open + ' of ' + MISSIONS.length + ' open';
  showBest();
}

function renderTargetPhoto() {
  const src = game.portraitSource;
  renderPortrait(/** @type {HTMLCanvasElement} */ ($('target-photo')), src.gltf, src.baseHeight, src.look);
}
renderDossier(MISSIONS[0]);
showBest();
showWallet();

function showWallet() {
  const lv = levelOf(progress.xp);
  $('wallet-level').textContent = String(lv.level);
  $('wallet-xp').style.width = Math.round(lv.fraction * 100) + '%';
  $('wallet-cash').textContent = progress.cash.toLocaleString('en-US');
}

function showBest() {
  const best = loadBest(game ? game.mission.id : MISSIONS[0].id);
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
}).then(async (g) => {
  game = g;
  /** @type {any} */ (window).SKY = { game, settings: () => settings };
  // Open on the next contract to play.
  const next = nextMissionId();
  if (next !== game.mission.id) {
    loadingText.textContent = 'Preparing ' + missionById(next).title;
    await game.setMission(next);
  }
  renderDossier(game.mission);
  renderTargetPhoto();
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

$('btn-start').addEventListener('click', () => startMission(game.mission.id));
$('btn-menu-settings').addEventListener('click', () => openSettings('menu'));

/** Starts a contract, switching the city's people, light and vantage first if needed. */
async function startMission(id) {
  audio.unlock();
  enterFullscreen();
  if (settings.gyro !== 'off') input.requestGyroPermission();
  if (id && id !== game.mission.id) {
    loadingText.textContent = 'Preparing ' + missionById(id).title;
    show('loading');
    await game.setMission(id);
    renderDossier(game.mission);
    renderTargetPhoto();
  }
  show(null);
  game.setLoadout(loadoutFor(progress));
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
  else if (!st.onTarget) hud.hint('Drag to put the cross on ' + game.mission.target.name, null);
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
  game.setLoadout(loadoutFor(progress));
  await game.restart();
  show(null);
}

async function backToMenu() {
  loadingText.textContent = 'Resetting the plaza';
  show('loading');
  const next = nextMissionId();
  if (next !== game.mission.id) await game.setMission(next);
  else await game.toMenu();
  renderDossier(game.mission);
  renderTargetPhoto();
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
    else if (open === 'contracts' || open === 'armory' || open === 'profile') show('menu');
    else if (open === 'credits') show('settings');
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
  fps: /** @type {HTMLSelectElement} */ ($('set-fps')),
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
  form.fps.value = String(settings.fps || 30);
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
    fps: parseInt(form.fps.value, 10) || 30,
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
  const m = game.mission;
  const lines = {
    win: r.head ? m.results.winHead : m.results.win,
    escaped: m.results.escaped,
    civilian: m.results.civilian
  };
  $('results-title').textContent = titles[r.result] || 'Contract over';
  $('results-line').textContent = lines[r.result] || '';
  $('results-stars').textContent = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
  $('results-stars').dataset.tone = win ? 'good' : 'bad';
  $('res-time').textContent = Math.floor(r.time / 60) + ':' + String(Math.floor(r.time % 60)).padStart(2, '0');
  $('res-shots').textContent = String(r.shots);
  $('res-distance').textContent = r.distance ? Math.round(r.distance) + ' m' : '---';
  $('res-head').textContent = r.head ? 'Yes' : 'No';
  const best = loadBest(m.id);
  const firstClear = win && !best;
  const newStars = win ? Math.max(0, r.stars - (best || 0)) : 0;
  if (win && (best === null || r.stars > best)) saveBest(m.id, r.stars);
  const pay = rewardFor(r, { number: m.number, firstClear, newStars });
  const levelBefore = levelOf(progress.xp).level;
  progress.xp += pay.xp;
  const levelAfterXp = levelOf(progress.xp).level;
  // A cash bonus for every level reached.
  for (let l = levelBefore + 1; l <= levelAfterXp; l++) pay.lines.push({ label: 'Level ' + l + ' bonus', cash: levelBonus(l) });
  pay.cash = pay.lines.reduce((sum, l) => sum + l.cash, 0);
  progress.cash += pay.cash;
  progress.stats.earned += pay.cash;
  progress.stats.shots += r.shots;
  if (win) {
    progress.contracts++;
    progress.tutorialDone = true;
    progress.stats.wins++;
    if (r.head) progress.stats.heads++;
    progress.stats.bestDistance = Math.max(progress.stats.bestDistance, r.distance || 0);
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
  // Offer the next contract when this win unlocked (or already had) it.
  const index = MISSIONS.findIndex((x) => x.id === m.id);
  const nextBtn = $('btn-next');
  const hasNext = win && index + 1 < MISSIONS.length && isUnlocked(index + 1);
  nextBtn.hidden = !hasNext;
  if (hasNext) nextBtn.textContent = 'Next: ' + MISSIONS[index + 1].title;
  setTimeout(() => show('results'), win ? 300 : 0);
}
$('btn-next').addEventListener('click', () => {
  const index = MISSIONS.findIndex((x) => x.id === game.mission.id);
  if (index + 1 < MISSIONS.length) startMission(MISSIONS[index + 1].id);
});
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
