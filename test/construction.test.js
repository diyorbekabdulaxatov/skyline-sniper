import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentBox, BODY } from '../src/ballistics.js';
import {
  EYE, TALK, TOP, GROUND_Y, HOIST, HOIST_GROUND_DOOR, SUV_DOOR, CRANE, RAIL, siteColliders
} from '../src/scenes/construction-layout.js';

const H = 1.84;
const boxes = siteColliders();

/** The first collider between the eye and a point, or null when the line is clear. */
function blocker(p) {
  for (const box of boxes) {
    if (segmentBox(EYE, p, box) !== null) return box;
  }
  return null;
}

/** Head, chest and knees of someone standing at (x, z) on floor y. */
function body(x, y, z) {
  return [
    { x, y: y + BODY.HEAD_Y * H, z },
    { x, y: y + 0.7 * H, z },
    { x, y: y + 0.3 * H, z }
  ];
}

test('the eye stands on the crane deck, clear of every collider, with the rail below it', () => {
  assert.ok(Math.abs(EYE.y - CRANE.deck - 1.6) < 1e-9);
  for (const b of boxes) {
    const inside = EYE.x > b[0] && EYE.x < b[3] && EYE.y > b[1] && EYE.y < b[4] && EYE.z > b[2] && EYE.z < b[5];
    assert.ok(!inside, 'eye inside ' + b.join(','));
  }
  assert.ok(RAIL.top < EYE.y - 0.5);
  // The rail still lets the shooter aim down at the near side of the site.
  const depression = Math.atan2(EYE.y - RAIL.top, RAIL.x - EYE.x);
  const nearest = Math.atan2(EYE.y, -18 - EYE.x);
  assert.ok(depression > nearest, 'rail blocks the near yard');
});

test('the talk on the open floor is a clear shot: head, chest and legs', () => {
  for (const p of body(TALK.x, TOP, TALK.z)) assert.equal(blocker(p), null, JSON.stringify(p));
  const range = Math.hypot(TALK.x - EYE.x, TOP - EYE.y, TALK.z - EYE.z);
  assert.ok(range > 90 && range < 160, 'range ' + range);
});

test('the hoist ride is visible at the bottom and the top', () => {
  for (const y of [GROUND_Y, TOP]) {
    const [head, chest] = body(HOIST.x, y, HOIST.z + 0.4);
    assert.equal(blocker(head), null, 'head at ' + y);
    assert.equal(blocker(chest), null, 'chest at ' + y);
  }
  for (const p of body(HOIST_GROUND_DOOR.x, GROUND_Y, HOIST_GROUND_DOOR.z)) assert.equal(blocker(p), null);
});

test('the last steps to the SUV can be shot', () => {
  const [head, chest] = body(SUV_DOOR.x, GROUND_Y, SUV_DOOR.z);
  assert.equal(blocker(head), null);
  assert.equal(blocker(chest), null);
});
