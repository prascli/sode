import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centreNudge } from '../compactrules.js';

const view = { left: 100, right: 1180, top: 200, bottom: 520 };

test('nudges the boxes, not the block, to the viewport centre', () => {
  const box = { left: 120, right: 1000, top: 330, bottom: 370 };
  assert.deepEqual(centreNudge(box, view, 1280, 720), { x: 80, y: 10 });
});

test('never pushes the block past a viewport edge', () => {
  const box = { left: 120, right: 1000, top: 210, bottom: 250 };
  assert.deepEqual(centreNudge(box, view, 1280, 720), { x: 80, y: 130 });
  const low = { left: 120, right: 1000, top: 500, bottom: 520 };
  assert.deepEqual(centreNudge(low, view, 1280, 720), { x: 80, y: -150 });
});

test('a block taller than the viewport stays put', () => {
  const tall = { left: 0, right: 1280, top: -50, bottom: 800 };
  assert.deepEqual(centreNudge({ left: 0, right: 1280, top: 300, bottom: 340 }, tall, 1280, 720), { x: 0, y: 0 });
});
