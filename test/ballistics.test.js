import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KESTREL, shotAt, zeroAngle, silhouetteHit, personHit, segmentBox, BODY } from '../src/ballistics.js';

const angle = zeroAngle(KESTREL);

test('the rifle hits the line of sight at its zero range', () => {
  assert.ok(Math.abs(shotAt(KESTREL, angle, KESTREL.zero, 0).drop) < 0.002);
});

test('drop grows with range like a real .308 zeroed at 100 m', () => {
  const d200 = shotAt(KESTREL, angle, 200, 0).drop;
  const d400 = shotAt(KESTREL, angle, 400, 0).drop;
  assert.ok(d200 > 0.08 && d200 < 0.3, `drop at 200 m was ${d200}`);
  assert.ok(d400 > 0.8 && d400 < 1.6, `drop at 400 m was ${d400}`);
});

test('the bullet slows down and takes about half a second to 400 m', () => {
  const t = shotAt(KESTREL, angle, 400, 0).time;
  assert.ok(t > 0.5 && t < 0.65, `time to 400 m was ${t}`);
});

test('a light crosswind drifts the shot a few centimetres downwind at 400 m', () => {
  const drift = shotAt(KESTREL, angle, 400, 1).drift;
  assert.ok(drift > 0.02 && drift < 0.15, `drift was ${drift}`);
  assert.ok(shotAt(KESTREL, angle, 400, -1).drift < 0);
});

test('silhouette zones follow the 2D body geometry', () => {
  const h = BODY.HEIGHT;
  assert.equal(silhouetteHit(0, 0.935 * h, h, 1), 'head');
  assert.equal(silhouetteHit(0, 0.7 * h, h, 1), 'body');
  assert.equal(silhouetteHit(0, 0.2 * h, h, 1), 'body');
  assert.equal(silhouetteHit(0.2 * h, 0.95 * h, h, 1), null);
  assert.equal(silhouetteHit(0.3 * h, 0.7 * h, h, 1), null);
});

test('a shot through a standing person reports the first part it meets', () => {
  const h = BODY.HEIGHT;
  const head = personHit({ x: 0, y: 0.935 * h, z: 5 }, { x: 0, y: 0.935 * h, z: -5 }, h);
  assert.equal(head && head.part, 'head');
  const chest = personHit({ x: 0, y: 1.2, z: 5 }, { x: 0, y: 1.2, z: -5 }, h);
  assert.equal(chest && chest.part, 'body');
  assert.equal(personHit({ x: 1, y: 1.2, z: 5 }, { x: 1, y: 1.2, z: -5 }, h), null);
});

test('segmentBox finds the entry point', () => {
  const t = segmentBox({ x: -2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, [-1, -1, -1, 1, 1, 1]);
  assert.equal(t, 0.25);
});
