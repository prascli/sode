// Which sources and destinations a Grid panel shows, in display order (gridpaneledges.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { isGridPanel, gridAxes } from '../gridpaneledges.js';
import { namesReply, gridPanel } from './gridpanelfixture.mjs';

test('only a panel of type grid is a Grid panel; no type is a Buttons panel', () => {
  assert.equal(isGridPanel(gridPanel()), true);
  assert.equal(isGridPanel({ type: 'buttons' }), false);
  assert.equal(isGridPanel({ name: 'old file' }), false);
});

test('an "all" edge shows every router item in router order', () => {
  const names = namesReply({
    sources: [
      [2, 'VT 1'],
      [0, 'CAM 1'],
      [1, 'CAM 2'],
    ],
    destinations: [
      [1, 'MON B'],
      [0, 'MON A'],
    ],
  });
  assert.deepEqual(gridAxes(gridPanel(), names), { srcs: [0, 1, 2], dsts: [0, 1] });
});

test('a missing edge reads as "all"', () => {
  const p = gridPanel();
  delete p.sources;
  assert.deepEqual(gridAxes(p, namesReply()).srcs, [0, 1, 2]);
});

test('an "all" edge follows the router: an item the router adds shows, one it drops goes', () => {
  const p = gridPanel();
  assert.deepEqual(
    gridAxes(
      p,
      namesReply({
        sources: [
          [0, 'CAM 1'],
          [5, 'NEW'],
        ],
      }),
    ).srcs,
    [0, 5],
  );
});

test('no names yet shows no items', () => {
  assert.deepEqual(gridAxes(gridPanel(), {}), { srcs: [], dsts: [] });
});
