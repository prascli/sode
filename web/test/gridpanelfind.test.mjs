// Find and Filter on a Grid panel's bars (gridpanelfind.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFind, findMatches, typed, currentMatch, stepMatch, switchMode, clearFind, shownOrder } from '../gridpanelfind.js';
import { namesReply } from './gridpanelfixture.mjs';

const names = namesReply({
  sources: [
    [0, 'Black'],
    [1, 'CAM 1'],
    [2, 'VT 1'],
    [3, 'CAM 2'],
    [4, 'CAM 12'],
  ],
  numberOffset: 1,
});

test('a new search is empty and in Find mode on both bars', () => {
  const f = createFind();
  for (const k of ['srcs', 'dsts']) assert.deepEqual(f[k], { text: '', mode: 'find', at: null });
});

test('matches keep panel order, not score order, with no cut-off', () => {
  // "cam 12" scores best on an exact name, but panel order puts 3 first.
  assert.deepEqual(findMatches([3, 4, 1, 0, 2], names.sources, 'cam 1', 1), [4, 1]);
  assert.deepEqual(findMatches([4, 3, 1], names.sources, 'cam', 1), [4, 3, 1]);
});

test('numbers match as shown, with the number offset', () => {
  // Router number 2 shows as 3.
  assert.deepEqual(findMatches([0, 1, 2, 3, 4], names.sources, '3', 1), [2]);
});

test('an empty or blank search matches nothing', () => {
  assert.deepEqual(findMatches([0, 1], names.sources, '  ', 1), []);
});

test('the letters of a name in order match, as on the main page', () => {
  assert.deepEqual(findMatches([0, 1, 2, 3, 4], names.sources, 'vt', 1), [2]);
  assert.deepEqual(findMatches([0, 1, 2, 3, 4], names.sources, 'bk', 1), [0]);
});

test('typing starts at the first match and makes that box the one n and N step', () => {
  let f = createFind();
  f = { ...f, srcs: { ...f.srcs, at: 3 } };
  f = typed(f, 'dsts', 'mon');
  assert.equal(f.last, 'dsts');
  assert.deepEqual(f.dsts, { text: 'mon', mode: 'find', at: null });
  assert.equal(currentMatch(f, 'dsts', [5, 7]), 5);
  assert.equal(f.srcs.at, 3);
});

test('steps go forward and back through the matches and wrap at each end', () => {
  let f = typed(createFind(), 'srcs', 'cam');
  const m = [4, 3, 1];
  f = stepMatch(f, 'srcs', m, 1);
  assert.equal(currentMatch(f, 'srcs', m), 3);
  f = stepMatch(stepMatch(f, 'srcs', m, 1), 'srcs', m, 1);
  assert.equal(currentMatch(f, 'srcs', m), 4);
  f = stepMatch(f, 'srcs', m, -1);
  assert.equal(currentMatch(f, 'srcs', m), 1);
});

test('a current match that is gone gives the first match, and a step goes on from there', () => {
  const f = { ...createFind(), srcs: { text: 'cam', mode: 'find', at: 9 } };
  const m = [4, 3, 1];
  assert.equal(currentMatch(f, 'srcs', m), 4);
  assert.equal(currentMatch(stepMatch(f, 'srcs', m, 1), 'srcs', m), 3);
  assert.equal(currentMatch(stepMatch(f, 'srcs', m, -1), 'srcs', m), 1);
});

test('no matches: no current match and a step does nothing', () => {
  const f = typed(createFind(), 'srcs', 'zz');
  assert.equal(currentMatch(f, 'srcs', []), null);
  assert.deepEqual(stepMatch(f, 'srcs', [], 1), f);
});

test('the mode switches per box and stays when the box is cleared', () => {
  let f = switchMode(typed(createFind(), 'srcs', 'cam'), 'srcs');
  assert.equal(f.srcs.mode, 'filter');
  assert.equal(f.dsts.mode, 'find');
  f = clearFind(f, 'srcs');
  assert.deepEqual(f.srcs, { text: '', mode: 'filter', at: null });
  assert.equal(switchMode(f, 'srcs').srcs.mode, 'find');
});

test('Find shows every item; Filter shows the pinned items and the matches, in panel order', () => {
  const order = [9, 8, 0, 1, 2, 3, 4]; // 9 and 8 pinned
  let f = typed(createFind(), 'srcs', 'cam');
  const m = findMatches(order, names.sources, 'cam', 1);
  assert.deepEqual(shownOrder(order, 2, f.srcs, m), order);
  f = switchMode(f, 'srcs');
  assert.deepEqual(shownOrder(order, 2, f.srcs, m), [9, 8, 1, 3, 4]);
  assert.deepEqual(shownOrder(order, 2, clearFind(f, 'srcs').srcs, []), order);
});

test('Filter with no match shows only the pinned items', () => {
  const f = switchMode(typed(createFind(), 'srcs', 'zz'), 'srcs');
  assert.deepEqual(shownOrder([9, 0, 1], 1, f.srcs, []), [9]);
});
