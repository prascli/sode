// Picks and the Diagonal on a Grid panel (gridpanelpick.js). Axes are in display order, which is not router order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPicks, pickName, dropPicks, pickCount, diagonal, extendPick } from '../gridpanelpick.js';

const axes = { srcs: [30, 10, 20, 40, 50], dsts: [7, 3, 5, 9, 1, 2] };
const click = (p, kind, n, mods = {}, shown = axes[kind]) => pickName(p, kind, n, mods, shown);

test('a click picks one name and a second click on it unpicks it', () => {
  let p = click(createPicks(), 'srcs', 10);
  assert.deepEqual(p.srcs, [10]);
  p = click(p, 'srcs', 20);
  assert.deepEqual(p.srcs, [20]);
  p = click(p, 'srcs', 20);
  assert.deepEqual(p.srcs, []);
});

test('Cmd or Ctrl click adds or removes one name and keeps the rest', () => {
  let p = click(createPicks(), 'dsts', 3);
  p = click(p, 'dsts', 9, { toggle: true });
  assert.deepEqual(p.dsts, [3, 9]);
  p = click(p, 'dsts', 3, { toggle: true });
  assert.deepEqual(p.dsts, [9]);
});

test('Shift-click picks the shown range in display order from the last click', () => {
  let p = click(createPicks(), 'dsts', 3);
  p = click(p, 'dsts', 1, { range: true });
  assert.deepEqual(p.dsts, [3, 5, 9, 1]);
  // Backwards from the same start.
  p = click(p, 'dsts', 7, { range: true });
  assert.deepEqual(p.dsts, [7, 3]);
});

test('Shift-click covers only the shown names, and Cmd-Shift adds the range to the picks', () => {
  let p = click(createPicks(), 'dsts', 2);
  p = click(p, 'dsts', 3, {}, [3, 9, 1]);
  p = click(p, 'dsts', 1, { range: true }, [3, 9, 1]);
  assert.deepEqual(p.dsts, [3, 9, 1]);
  p = click(createPicks(), 'dsts', 2);
  p = click(p, 'dsts', 7, { toggle: true });
  p = click(p, 'dsts', 3, { range: true, toggle: true });
  assert.deepEqual(p.dsts.sort(), [2, 3, 7]);
});

test('Shift-click with no start picks one name', () => {
  assert.deepEqual(click(createPicks(), 'srcs', 40, { range: true }).srcs, [40]);
});

test('picks on one bar leave the other bar alone, and dropPicks clears both', () => {
  let p = click(createPicks(), 'srcs', 10);
  p = click(p, 'dsts', 3);
  assert.deepEqual([p.srcs, p.dsts], [[10], [3]]);
  assert.equal(pickCount(p), 2);
  p = dropPicks(p);
  assert.equal(pickCount(p), 0);
});

// Diagonal: pairs are { src, dst }, one per target destination.
const picks = (srcs, dsts) => ({ ...createPicks(), srcs, dsts });
const pairs = (list) => list.map(({ src, dst }) => [src, dst]);

test('nothing picked: the press is that crosspoint', () => {
  assert.deepEqual(pairs(diagonal(createPicks(), { src: 20, dst: 5 }, axes)), [[20, 5]]);
});

test('picked sources and no picked destination run down the shown destinations from the crosspoint', () => {
  assert.deepEqual(pairs(diagonal(picks([10, 20, 40], []), { src: 10, dst: 3 }, axes)), [
    [10, 3],
    [20, 5],
    [40, 9],
  ]);
});

test('picked sources start at the crosspoint column and wrap in display order', () => {
  // Display order of picks is 30, 20, 50; the crosspoint is on 40, so the next picked is 50, then wraps to 30.
  assert.deepEqual(pairs(diagonal(picks([50, 20, 30], []), { src: 40, dst: 7 }, axes)), [
    [50, 7],
    [30, 3],
    [20, 5],
  ]);
});

test('running down past the last shown destination stops there, it does not wrap', () => {
  assert.deepEqual(pairs(diagonal(picks([30, 10, 20], []), { src: 30, dst: 1 }, axes)), [
    [30, 1],
    [10, 2],
  ]);
});

test('one picked destination with picked sources also runs down from the crosspoint', () => {
  assert.deepEqual(pairs(diagonal(picks([10, 20], [9]), { src: 10, dst: 7 }, axes)), [
    [10, 7],
    [20, 3],
  ]);
});

test('one or no picked source fans the crosspoint source to every picked destination, from the crosspoint row wrapping', () => {
  // Display order of picks is 3, 9, 2; the crosspoint is on 5, so 9 first, then 2, then wraps to 3.
  const want = [
    [40, 9],
    [40, 2],
    [40, 3],
  ];
  assert.deepEqual(pairs(diagonal(picks([], [2, 9, 3]), { src: 40, dst: 5 }, axes)), want);
  // The crosspoint's source goes, not the one picked source.
  assert.deepEqual(pairs(diagonal(picks([10], [2, 9, 3]), { src: 40, dst: 5 }, axes)), want);
});

test('one picked source and no destinations is that crosspoint only', () => {
  assert.deepEqual(pairs(diagonal(picks([10], []), { src: 40, dst: 5 }, axes)), [[40, 5]]);
});

test('both sides picked: sources wrap until every picked destination has one, no destination twice', () => {
  // More destinations than sources: the sources wrap.
  assert.deepEqual(pairs(diagonal(picks([10, 20], [3, 5, 9, 1]), { src: 10, dst: 3 }, axes)), [
    [10, 3],
    [20, 5],
    [10, 9],
    [20, 1],
  ]);
  // More sources than destinations: one route per picked destination.
  const got = pairs(diagonal(picks([30, 10, 20, 40], [9, 1]), { src: 20, dst: 9 }, axes));
  assert.deepEqual(got, [
    [20, 9],
    [40, 1],
  ]);
});

test('picks hidden by a filter still count; the run down uses the shown destinations', () => {
  const shown = { ...axes, shownDsts: [7, 9, 2] };
  assert.deepEqual(pairs(diagonal(picks([], [3, 5]), { src: 10, dst: 7 }, shown)), [
    [10, 3],
    [10, 5],
  ]);
  assert.deepEqual(pairs(diagonal(picks([10, 20, 30], []), { src: 10, dst: 7 }, shown)), [
    [10, 7],
    [20, 9],
    [30, 2],
  ]);
});

test('picks no longer on the panel are left out', () => {
  assert.deepEqual(pairs(diagonal(picks([10, 99, 20], []), { src: 10, dst: 7 }, axes)), [
    [10, 7],
    [20, 3],
  ]);
});

test('a Shift move with nothing picked picks from the name the cursor left to the name it is on', () => {
  let p = extendPick(createPicks(), 'srcs', 10, 20, axes.srcs);
  assert.deepEqual(p.srcs, [10, 20]);
  p = extendPick(p, 'srcs', 20, 40, axes.srcs);
  assert.deepEqual(p.srcs, [10, 20, 40]);
  p = extendPick(p, 'srcs', 40, 20, axes.srcs);
  assert.deepEqual(p.srcs, [10, 20], 'moving back makes the range smaller');
});

test('a Shift move after a pick runs the range from that pick', () => {
  let p = click(createPicks(), 'dsts', 3);
  p = extendPick(p, 'dsts', 9, 1, axes.dsts);
  assert.deepEqual(p.dsts, [3, 5, 9, 1]);
  assert.deepEqual(p.srcs, [], 'the other bar keeps its picks');
});
