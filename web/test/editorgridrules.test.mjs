// The Grid panel editor's list tabs (editorgridrules.js). Pure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeRows, pinItem, removeItemFrom, moveRow, clearEdge, followRouter, setItemArt, PINS_MAX } from '../editorgridrules.js';
import { namesReply } from './gridpanelfixture.mjs';

const router = namesReply({
  sources: [
    [0, 'CAM 1'],
    [1, 'CAM 2'],
    [2, 'VT 1'],
    [3, 'VT 2'],
  ],
}).sources;

const ns = (v) => v.rows.map((r) => r.n);

test('an "all" edge lists the router in router order, less hidden items, and a missing edge is "all"', () => {
  assert.deepEqual(ns(edgeRows({ members: 'all', hide: [2] }, router, null, 'sources')), [0, 1, 3]);
  const v = edgeRows(undefined, router, null, 'sources');
  assert.deepEqual(ns(v), [0, 1, 2, 3]);
  assert.equal(v.all, true);
  assert.deepEqual(v.rows[1], { n: 1, name: 'CAM 2', pinned: false, gone: false });
});

test('an explicit list keeps its own order, marks pins, and marks an item the router does not report', () => {
  const v = edgeRows({ members: [3, 9, 0], items: { 0: { pinned: true } } }, router, null, 'sources');
  assert.deepEqual(ns(v), [3, 9, 0]);
  assert.equal(v.all, false);
  assert.equal(v.rows[2].pinned, true);
  assert.equal(v.rows[1].gone, true);
  assert.equal(v.pins, 1);
});

test('entries outside the Rights are left out of the rows and counted', () => {
  const v = edgeRows({ members: [3, 1, 0] }, router, { sources: [0, 1] }, 'sources');
  assert.deepEqual(ns(v), [1, 0]);
  assert.equal(v.outside, 1);
  // "all" is resolved for each viewer, so nothing is held outside the Rights.
  const all = edgeRows({ members: 'all' }, router, { sources: [0] }, 'sources');
  assert.deepEqual(ns(all), [0]);
  assert.equal(all.outside, 0);
});

test('a pin is per item, so an "all" edge stays "all"; the ninth pin changes nothing', () => {
  const e = pinItem({ members: 'all', hide: [2] }, 1, true);
  assert.deepEqual(e, { members: 'all', hide: [2], items: { 1: { pinned: true } } });
  assert.deepEqual(pinItem(e, 1, false), { members: 'all', hide: [2], items: {} });
  const art = pinItem({ members: [1], items: { 1: { art: 'tv', pinned: true } } }, 1, false);
  assert.deepEqual(art.items, { 1: { art: 'tv' } });
  let full = { members: 'all' };
  for (let n = 0; n < PINS_MAX; n++) full = pinItem(full, n, true);
  assert.equal(PINS_MAX, 8);
  assert.equal(pinItem(full, 20, true), full);
});

test('Remove hides an item of an "all" edge and drops it from a list; either way its pin goes and its art stays', () => {
  const all = removeItemFrom({ members: 'all', items: { 1: { pinned: true, art: 'tv' } } }, 1);
  assert.deepEqual(all, { members: 'all', hide: [1], items: { 1: { art: 'tv' } } });
  assert.deepEqual(removeItemFrom({ members: [3, 1, 0], items: { 1: { pinned: true } } }, 1), { members: [3, 0], items: {} });
});

test('a move turns an "all" edge into a list, and places the row where the row it lands on was', () => {
  assert.deepEqual(moveRow({ members: 'all', hide: [2] }, router, null, 'sources', 0, 2), { members: [1, 3, 0] });
  assert.deepEqual(moveRow({ members: [0, 1] }, router, null, 'sources', 1, 0), { members: [1, 0] });
  const e = { members: [0, 1] };
  assert.equal(moveRow(e, router, null, 'sources', 0, 0), e);
});

test('a move steps over entries outside the Rights, which keep their places', () => {
  // Rows shown are 1, 0 (3 is outside); 0 goes up over 1.
  assert.deepEqual(moveRow({ members: [1, 3, 0] }, router, { sources: [0, 1] }, 'sources', 1, 0), { members: [0, 1, 3] });
});

test('Clear empties the list but keeps entries outside the Rights; All goes back to following the router', () => {
  const e = { members: [3, 1, 0], items: { 1: { pinned: true }, 3: { art: 'tv' } } };
  assert.deepEqual(clearEdge(e, { sources: [0, 1] }, 'sources'), { members: [3], items: { 3: { art: 'tv' } } });
  assert.deepEqual(clearEdge({ members: 'all', hide: [1] }, null, 'sources'), { members: [], items: {} });
  assert.deepEqual(followRouter({ members: [3], hide: [], items: { 3: { art: 'tv' } } }), { members: 'all', items: { 3: { art: 'tv' } } });
});

test("setItemArt sets and clears one item's artwork and keeps its pin", () => {
  const e = pinItem({ members: 'all' }, 2, true);
  const a = setItemArt(e, 2, { art: 'icon:mic', artB: '3' });
  assert.deepEqual(a.items[2], { pinned: true, art: 'icon:mic', artB: '3' });
  const b = setItemArt(a, 2, { art: undefined });
  assert.deepEqual(b.items[2], { pinned: true, artB: '3' });
  const c = setItemArt(b, 2, { artB: '' });
  assert.deepEqual(c.items[2], { pinned: true });
  assert.deepEqual(setItemArt(setItemArt({ members: 'all' }, 5, { art: 'icon:mic' }), 5, { art: undefined }).items, {});
});

test('setItemArt with nothing changed gives the same edge', () => {
  const e = { members: 'all', items: { 1: { art: 'icon:mic' } } };
  assert.equal(setItemArt(e, 1, { art: 'icon:mic' }), e);
  assert.equal(setItemArt(e, 4, { art: undefined }), e);
});
