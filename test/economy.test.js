// Money, account and store rules (src/progress.js, src/armory.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewardFor, contractFee, levelOf, levelBonus, loadProgress } from '../src/progress.js';
import { RIFLES, UPGRADES, rifleState, buyRifle, equipRifle, buyUpgrade, loadoutFor } from '../src/armory.js';

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
