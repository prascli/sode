// The Grid panel editor's edits of several selected entries at once (editorgridrules.js). Pure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveRows, stepRows, pinItems, removeItems, setItemsArt, edgeRows, edgeListKey, PINS_MAX } from '../editorgridrules.js';
import { namesReply } from './gridpanelfixture.mjs';

const router = namesReply({
  sources: [
    [0, 'CAM 1'],
    [1, 'CAM 2'],
    [2, 'VT 1'],
    [3, 'VT 2'],
    [4, 'GFX'],
    [5, 'SAT'],
  ],
}).sources;
const sel = (...n) => new Set(n);

test('moveRows moves the selection as a block, in list order, to before a row or to the end', () => {
  const e = { members: [0, 1, 2, 3, 4, 5] };
  assert.deepEqual(moveRows(e, router, null, 'sources', sel(4, 1), 0), { members: [1, 4, 0, 2, 3, 5] });
  assert.deepEqual(moveRows(e, router, null, 'sources', sel(0, 2), null), { members: [1, 3, 4, 5, 0, 2] });
  assert.deepEqual(moveRows(e, router, null, 'sources', sel(0, 1), 4), { members: [2, 3, 0, 1, 4, 5] });
});

test('moveRows turns an "all" edge into a list and drops its hide', () => {
  assert.deepEqual(moveRows({ members: 'all', hide: [2] }, router, null, 'sources', sel(5), 0), { members: [5, 0, 1, 3, 4] });
});

test('moveRows with nothing to move, or onto the same place, gives the same edge', () => {
  const e = { members: [0, 1, 2, 3] };
  assert.equal(moveRows(e, router, null, 'sources', sel(), 0), e);
  assert.equal(moveRows(e, router, null, 'sources', sel(1, 2), 3), e);
  // A drop onto a selected row lands before the next row that is not selected.
  assert.equal(moveRows(e, router, null, 'sources', sel(1, 2), 2), e);
});

test('moveRows leaves entries outside the Rights in the list', () => {
  const e = { members: [3, 0, 1, 2] };
  const out = moveRows(e, router, { sources: [0, 1, 2] }, 'sources', sel(2), 0);
  assert.deepEqual(out, { members: [3, 2, 0, 1] });
  assert.deepEqual(
    edgeRows(out, router, { sources: [0, 1, 2] }, 'sources').rows.map((r) => r.n),
    [2, 0, 1],
  );
});

test('stepRows moves the block one row up or down, or to the top or the end', () => {
  const e = { members: [0, 1, 2, 3, 4, 5] };
  assert.deepEqual(stepRows(e, router, null, 'sources', sel(2, 3), 'up'), { members: [0, 2, 3, 1, 4, 5] });
  assert.deepEqual(stepRows(e, router, null, 'sources', sel(2, 3), 'down'), { members: [0, 1, 4, 2, 3, 5] });
  assert.deepEqual(stepRows(e, router, null, 'sources', sel(2, 4), 'top'), { members: [2, 4, 0, 1, 3, 5] });
  assert.deepEqual(stepRows(e, router, null, 'sources', sel(0, 2), 'end'), { members: [1, 3, 4, 5, 0, 2] });
  // Spread rows close up around the first one on a step.
  assert.deepEqual(stepRows(e, router, null, 'sources', sel(1, 4), 'up'), { members: [1, 4, 0, 2, 3, 5] });
});

test('stepRows at the top or the end changes nothing', () => {
  const e = { members: [0, 1, 2, 3] };
  assert.equal(stepRows(e, router, null, 'sources', sel(0, 1), 'up'), e);
  assert.equal(stepRows(e, router, null, 'sources', sel(2, 3), 'down'), e);
  assert.equal(stepRows(e, router, null, 'sources', sel(0, 1), 'top'), e);
});

test('pinItems pins in list order until the pin limit, and unpins all', () => {
  const e = { members: [5, 4, 3, 2, 1, 0], items: { 0: { art: 'icon:mic' } } };
  const one = pinItems(e, router, null, 'sources', sel(0, 3), true);
  assert.deepEqual(one.items, { 3: { pinned: true }, 0: { art: 'icon:mic', pinned: true } });
  assert.deepEqual(pinItems(one, router, null, 'sources', sel(0, 3), false).items, { 0: { art: 'icon:mic' } });
  let full = { members: 'all', items: {} };
  for (let n = 0; n < PINS_MAX - 1; n++) full = { ...full, items: { ...full.items, [100 + n]: { pinned: true } } };
  const last = pinItems(full, router, null, 'sources', sel(4, 2), true);
  assert.equal(last.items[2]?.pinned, true);
  assert.equal(last.items[4], undefined);
});

test('removeItems drops entries from a list, hides them on "all", and unpins them', () => {
  assert.deepEqual(removeItems({ members: [0, 1, 2], items: { 1: { pinned: true, art: 'x' } } }, sel(1, 2)), { members: [0], items: { 1: { art: 'x' } } });
  assert.deepEqual(removeItems({ members: 'all', hide: [5] }, sel(1, 2)), { members: 'all', hide: [5, 1, 2], items: {} });
  const e = { members: [0] };
  assert.equal(removeItems(e, sel()), e);
});

test('setItemsArt sets one artwork key on every entry and keeps the other key and pins', () => {
  const e = { members: 'all', items: { 1: { pinned: true, artB: '2' } } };
  const a = setItemsArt(e, sel(1, 2), { art: 'icon:mic' });
  assert.deepEqual(a.items, { 1: { pinned: true, artB: '2', art: 'icon:mic' }, 2: { art: 'icon:mic' } });
  assert.deepEqual(setItemsArt(a, sel(1, 2), { art: undefined }).items, { 1: { pinned: true, artB: '2' } });
  assert.equal(setItemsArt(a, sel(1, 2), { art: 'icon:mic' }), a);
});

test('edgeListKey names the list keys by chord; other keys are null', () => {
  const k = (key, mods = {}) => edgeListKey({ key, code: '', ...mods });
  assert.deepEqual(k('ArrowDown'), { go: 'down' });
  assert.deepEqual(k('ArrowUp', { shiftKey: true }), { go: 'up', extend: true });
  assert.deepEqual(k('End', { shiftKey: true }), { go: 'end', extend: true });
  assert.deepEqual(k('PageDown'), { go: 'pageDown' });
  assert.deepEqual(k('ArrowUp', { altKey: true }), { move: 'up' });
  assert.deepEqual(k('Home', { altKey: true }), { move: 'top' });
  assert.deepEqual(k('End', { altKey: true }), { move: 'end' });
  assert.deepEqual(edgeListKey({ key: 'a', code: 'KeyA', ctrlKey: true }), { all: true });
  assert.deepEqual(edgeListKey({ key: 'a', code: 'KeyA', metaKey: true }), { all: true });
  assert.deepEqual(k(' '), { toggle: true });
  assert.deepEqual(k('Escape'), { none: true });
  assert.equal(k('x'), null);
  assert.equal(k('ArrowLeft'), null);
});
