// Money, account and store rules (src/progress.js, src/armory.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewardFor, contractFee, levelOf, levelBonus, loadProgress, migrateProgress } from '../src/progress.js';
import {
  RIFLES, UPGRADES, GEAR, EXTMAG_ROUNDS, BRACE_HOLD, rifleState, buyRifle, equipRifle, buyUpgrade, loadoutFor,
  gearState, buyGear, ownsGear, statBars
} from '../src/armory.js';
import { KESTREL } from '../src/ballistics.js';

const win = { result: 'win', head: false, shots: 2, time: 80, distance: 100 };

test('later contracts pay more', () => {
  assert.equal(contractFee(1), 500);
  assert.ok(contractFee(7) > contractFee(4));
});

test('a replay pays a share, not the full fee again', () => {
  const first = rewardFor(win, { number: 3, firstClear: true, newStars: 1 });
  const replay = rewardFor(win, { number: 3, firstClear: false, newStars: 0 });
  assert.ok(replay.cash < first.cash / 2, `replay ${replay.cash} vs first ${first.cash}`);
  assert.ok(replay.cash > 0);
});

test('a better star result on a replay earns a star bonus', () => {
  const plain = rewardFor(win, { number: 2, firstClear: false, newStars: 0 });
  const better = rewardFor(win, { number: 2, firstClear: false, newStars: 2 });
  assert.equal(better.cash - plain.cash, 200);
});

test('failed contracts pay nothing', () => {
  assert.equal(rewardFor({ ...win, result: 'escaped' }, { number: 5, firstClear: true, newStars: 0 }).cash, 0);
});

test('levels and level bonuses grow', () => {
  assert.equal(levelOf(0).level, 1);
  assert.ok(levelOf(5000).level > 3);
  assert.ok(levelBonus(5) > levelBonus(2));
});

test('a new account owns only the starting rifle', () => {
  const p = loadProgress();
  assert.deepEqual(p.owned, ['harrier']);
  assert.equal(p.rifle, 'harrier');
  assert.equal(p.cash, 0);
});

test('the second rifle needs the level and the cash, then is owned and equipped', () => {
  const p = loadProgress();
  const osprey = RIFLES.find((r) => r.id === 'osprey');
  assert.equal(rifleState(p, osprey, 1).state, 'locked');
  p.cash = 100000;
  assert.equal(rifleState(p, osprey, osprey.unlock.level - 1).state, 'locked');
  assert.equal(rifleState(p, osprey, osprey.unlock.level).state, 'buy');
  assert.ok(buyRifle(p, osprey, osprey.unlock.level));
  assert.equal(p.cash, 100000 - osprey.unlock.price);
  assert.equal(p.stats.spent, osprey.unlock.price);
  assert.equal(p.rifle, 'osprey');
  assert.equal(rifleState(p, osprey, 9).state, 'equipped');
  assert.equal(loadoutFor(p).rifle.velocity, osprey.stats.velocity);
  assert.ok(equipRifle(p, 'harrier'));
  assert.equal(loadoutFor(p).rifle.velocity, undefined);
});

test('upgrades cost cash, apply per rifle and need the rifle', () => {
  const p = loadProgress();
  const scope = UPGRADES.find((u) => u.id === 'scope');
  assert.equal(buyUpgrade(p, 'harrier', scope), false);
  p.cash = scope.prices[0];
  assert.ok(buyUpgrade(p, 'harrier', scope));
  assert.equal(p.cash, 0);
  assert.equal(loadoutFor(p).maxZoom, scope.values[1]);
  p.cash = 100000;
  assert.equal(buyUpgrade(p, 'osprey', scope), false);
});

/** A player rich enough for anything, at a level. */
function rich(level) {
  const p = loadProgress();
  p.cash = 1000000;
  return { p, level };
}

test('five rifles with invented names, rising unlock levels and prices', () => {
  assert.equal(RIFLES.length, 5);
  assert.equal(RIFLES[0].id, 'harrier');
  assert.equal(RIFLES[0].unlock, null);
  const banned = /awp|awm|barrett|remington|accuracy international|dragunov|svd|cheytac|intervention|vsk|m200|m82/i;
  const rest = RIFLES.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const r = rest[i];
    assert.ok(!banned.test(r.name + ' ' + r.description), r.name + ' uses a real gun name');
    assert.ok(r.unlock.level >= 2 && r.unlock.level <= 7, r.id + ' level');
    assert.ok(r.unlock.price >= 2500 && r.unlock.price <= 9000, r.id + ' price');
    if (i > 0) {
      assert.ok(r.unlock.level >= rest[i - 1].unlock.level, r.id + ' level rises');
      assert.ok(r.unlock.price > rest[i - 1].unlock.price, r.id + ' price rises');
    }
  }
  assert.equal(new Set(RIFLES.map((r) => r.id)).size, RIFLES.length);
  assert.equal(new Set(RIFLES.map((r) => r.model)).size, RIFLES.length, 'each rifle has its own model');
  for (const r of RIFLES) {
    assert.ok(r.trait && r.trait.name && r.trait.text, r.id + ' has a trait');
    assert.ok(Object.keys(r.traits).length >= 1, r.id + ' trait has an effect');
  }
});

test('rifle stats make each rifle play differently', () => {
  const by = Object.fromEntries(RIFLES.map((r) => [r.id, { ...KESTREL, ...r.stats }]));
  // Semi-auto marksman: big magazine, fastest follow-up, slower bullet, more sway.
  assert.equal(by.kite.magazine, 10);
  assert.ok(by.kite.boltTime < 0.5);
  assert.ok(by.kite.velocity < by.harrier.velocity);
  assert.ok(by.kite.swayMul > by.harrier.swayMul);
  // Suppressed rifle: slower bullet.
  assert.ok(by.wren.velocity < by.harrier.velocity);
  // Heavy long-range rifle: highest velocity, lowest drag, heaviest sway, slowest bolt.
  for (const id of Object.keys(by)) {
    if (id === 'albatross') continue;
    assert.ok(by.albatross.velocity > by[id].velocity, 'velocity vs ' + id);
    assert.ok(by.albatross.drag < by[id].drag, 'drag vs ' + id);
    assert.ok(by.albatross.swayMul > by[id].swayMul, 'sway vs ' + id);
    assert.ok(by.albatross.boltTime > by[id].boltTime, 'bolt vs ' + id);
  }
  const bars = statBars(RIFLES.find((r) => r.id === 'albatross'));
  const kite = statBars(RIFLES.find((r) => r.id === 'kite'));
  assert.ok(bars.power > kite.power && kite.fireRate > bars.fireRate && kite.rounds === 10);
  for (const r of RIFLES) for (const v of Object.values(statBars(r))) assert.ok(Number.isFinite(v) && v > 0);
});

test('traits reach the loadout', () => {
  const { p, level } = rich(9);
  for (const r of RIFLES.slice(1)) assert.ok(buyRifle(p, r, level), 'buy ' + r.id);
  equipRifle(p, 'wren');
  assert.equal(loadoutFor(p).traits.suppressed, true);
  assert.equal(loadoutFor(p).rifleId, 'wren');
  equipRifle(p, 'albatross');
  const scope = UPGRADES.find((u) => u.id === 'scope');
  assert.equal(loadoutFor(p).maxZoom, scope.values[0] + 4);
  assert.ok(!loadoutFor(p).traits.suppressed);
  equipRifle(p, 'kite');
  assert.equal(loadoutFor(p).rifle.magazine, 10);
  assert.equal(loadoutFor(p).traits.semiAuto, true);
  equipRifle(p, 'osprey');
  assert.equal(loadoutFor(p).traits.pierceCars, true);
  equipRifle(p, 'harrier');
  const breath = UPGRADES.find((u) => u.id === 'breath');
  assert.equal(loadoutFor(p).breathTime, breath.values[0] + 1);
  assert.equal(loadoutFor(p).rifle.magazine, KESTREL.magazine);
});

test('a rifle cannot be bought twice or below its level', () => {
  const { p } = rich(1);
  const kite = RIFLES.find((r) => r.id === 'kite');
  assert.equal(buyRifle(p, kite, 1), false);
  assert.ok(buyRifle(p, kite, 2));
  const cash = p.cash;
  assert.equal(buyRifle(p, kite, 2), false);
  assert.equal(p.cash, cash);
});

test('gear: four one-time items, $1,500 to $5,000, some behind a level', () => {
  assert.deepEqual(GEAR.map((g) => g.id).sort(), ['brace', 'computer', 'extmag', 'windmeter']);
  for (const g of GEAR) assert.ok(g.price >= 1500 && g.price <= 5000, g.id);
  assert.ok(GEAR.some((g) => g.level > 1));
});

test('gear needs the level and the cash, is bought once and counts as spent', () => {
  const p = loadProgress();
  const computer = GEAR.find((g) => g.id === 'computer');
  assert.equal(gearState(p, computer, 1).state, 'locked');
  p.cash = computer.price;
  assert.equal(gearState(p, computer, computer.level - 1).state, 'locked');
  assert.match(gearState(p, computer, computer.level - 1).reason, /level/i);
  assert.equal(buyGear(p, computer, computer.level - 1), false);
  assert.equal(gearState(p, computer, computer.level).state, 'buy');
  assert.ok(buyGear(p, computer, computer.level));
  assert.equal(p.cash, 0);
  assert.equal(p.stats.spent, computer.price);
  assert.ok(ownsGear(p, 'computer'));
  assert.equal(gearState(p, computer, 9).state, 'owned');
  p.cash = 100000;
  assert.equal(buyGear(p, computer, 9), false, 'no second purchase');
  assert.equal(p.cash, 100000);
  const meter = GEAR.find((g) => g.id === 'windmeter');
  p.cash = meter.price - 1;
  assert.equal(gearState(p, meter, 9).state, 'locked');
  assert.match(gearState(p, meter, 9).reason, /\$1 more/);
});

test('gear applies to every rifle', () => {
  const { p, level } = rich(9);
  for (const g of GEAR) assert.ok(buyGear(p, g, level));
  for (const r of RIFLES) {
    if (r.unlock) buyRifle(p, r, level);
    equipRifle(p, r.id);
    const l = loadoutFor(p);
    assert.equal(l.rifle.magazine, (r.stats.magazine ?? KESTREL.magazine) + EXTMAG_ROUNDS, r.id);
    assert.equal(l.holdSwayMul, BRACE_HOLD);
    assert.ok(l.gear.computer && l.gear.windmeter && l.gear.extmag && l.gear.brace);
  }
  const plain = loadoutFor(loadProgress());
  assert.equal(plain.holdSwayMul, 1);
  assert.ok(!plain.gear.computer && !plain.gear.extmag);
});

test('old saves migrate: gear list added, owned rifles repaired', () => {
  const old = migrateProgress({ cash: 1200, xp: 900, rifle: 'osprey', upgrades: { harrier: { scope: 2 } }, stats: { spent: 300 } });
  assert.deepEqual(old.gear, []);
  assert.deepEqual(old.owned, ['harrier']);
  assert.equal(old.rifle, 'harrier', 'an unowned equipped rifle falls back to the starter');
  assert.equal(old.cash, 1200);
  assert.equal(old.stats.spent, 300);
  assert.equal(old.stats.wins, 0);
  assert.equal(old.upgrades.harrier.scope, 2);
  const kept = migrateProgress({ owned: ['harrier', 'osprey'], rifle: 'osprey', gear: ['brace', 'brace', 7] });
  assert.equal(kept.rifle, 'osprey');
  assert.deepEqual(kept.gear, ['brace']);
  assert.equal(migrateProgress(null).cash, 0);
  assert.equal(migrateProgress({ cash: -5 }).cash, 0);
});
