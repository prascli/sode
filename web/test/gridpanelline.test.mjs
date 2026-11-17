// Drawn lines on a Grid panel (gridpanelline.js). Points are in crosspoint units from the first crosspoint's top
// left, display order: { x: 2.5, y: 0.5 } is the middle of column 2, row 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lineCells, isLine, unitsOf, linePairs, lineStage } from '../gridpanelline.js';
import { createPicks } from '../gridpanelpick.js';
import { createStage, STAGE_MAX } from '../gridpanelstage.js';

const dims = { rows: 20, cols: 30 };
const at = (x, y) => ({ x, y });

test('a move under half a crosspoint is a click, at or past it a line', () => {
  assert.equal(isLine(at(1.5, 1.5), at(1.9, 1.7)), false);
  assert.equal(isLine(at(1.5, 1.5), at(1.5, 2.0)), true);
  assert.equal(isLine(at(1.5, 1.5), at(1.2, 1.1)), true);
});

test('content px become crosspoint units past the Destination bar and the Source bar', () => {
  assert.deepEqual(unitsOf(200 + 2.5 * 40, 80 + 0.25 * 40, { xp: 40, w: 200, h: 80 }), at(2.5, 0.25));
});

test('a vertical line is one cell per row it spans, all in its column', () => {
  assert.deepEqual(lineCells(at(3.5, 1.5), at(3.5, 4.2), dims), [
    { i: 1, j: 3 },
    { i: 2, j: 3 },
    { i: 3, j: 3 },
    { i: 4, j: 3 },
  ]);
});

test('a steep line takes the column where it crosses the middle of each row', () => {
  // From (0.5, 0.5) to (2.5, 8.5): x moves a quarter column per row.
  assert.deepEqual(
    lineCells(at(0.5, 0.5), at(2.5, 8.5), dims).map((c) => c.j),
    [0, 0, 1, 1, 1, 1, 2, 2, 2],
  );
});

test('a shallow line skips columns: one cell per row, never a row twice', () => {
  assert.deepEqual(lineCells(at(0.5, 0.5), at(10.5, 2.5), dims), [
    { i: 0, j: 0 },
    { i: 1, j: 5 },
    { i: 2, j: 10 },
  ]);
});

test('the start and end rows use the end points when the line does not reach the middle of the row', () => {
  // Starts low in row 1 and ends high in row 3.
  assert.deepEqual(lineCells(at(1.5, 1.9), at(5.5, 3.1), dims), [
    { i: 1, j: 1 },
    { i: 2, j: 3 },
    { i: 3, j: 5 },
  ]);
});

test('a reversed line keeps the order of the drag: its start row is first', () => {
  assert.deepEqual(lineCells(at(6.5, 3.5), at(0.5, 0.5), dims), [
    { i: 3, j: 6 },
    { i: 2, j: 4 },
    { i: 1, j: 2 },
    { i: 0, j: 0 },
  ]);
});

test('a horizontal line, or any line that ends on its start row, is no cells', () => {
  assert.deepEqual(lineCells(at(0.5, 2.5), at(9.5, 2.5), dims), []);
  assert.deepEqual(lineCells(at(0.5, 2.1), at(9.5, 2.9), dims), []);
});

test('a line past the last row or column stops at the edge', () => {
  const cells = lineCells(at(28.5, 17.5), at(40, 25), dims);
  assert.deepEqual(cells.at(-1), { i: 19, j: 29 });
  assert.equal(cells.length, 3);
});

const axes = { srcs: [30, 10, 20, 40, 50, 60], dsts: [7, 3, 5, 9, 1, 2] };

test('with nothing picked, a line stages the crosspoint of each cell in router numbers', () => {
  assert.deepEqual(linePairs(createPicks(), at(0.5, 0.5), at(2.5, 2.5), axes), [
    { src: 30, dst: 7 },
    { src: 10, dst: 3 },
    { src: 20, dst: 5 },
  ]);
});

test('with sources picked, every row spanned gets the next picked source from the start crosspoint, wrapping', () => {
  const p = { ...createPicks(), srcs: [40, 10] };
  // Starts on source 10 (column 1), so 10 comes first, then 40, then 10 again. The drawn slope does not matter.
  assert.deepEqual(linePairs(p, at(1.5, 0.5), at(5.5, 4.5), axes), [
    { src: 10, dst: 7 },
    { src: 40, dst: 3 },
    { src: 10, dst: 5 },
    { src: 40, dst: 9 },
    { src: 10, dst: 1 },
  ]);
});

test('with one source picked, the start crosspoint source goes to every row spanned', () => {
  const p = { ...createPicks(), srcs: [50] };
  assert.deepEqual(linePairs(p, at(2.5, 1.5), at(0.5, 3.5), axes), [
    { src: 20, dst: 3 },
    { src: 20, dst: 5 },
    { src: 20, dst: 9 },
  ]);
});

test('with destinations picked, only the picked rows the line spans are targets, in drag order', () => {
  const p = { ...createPicks(), dsts: [9, 3, 2], srcs: [10, 20] };
  // Upward from row 4 to row 0: rows 1 (3) and 3 (9) are picked; row 5 (2) is not spanned.
  assert.deepEqual(linePairs(p, at(1.5, 4.5), at(1.5, 0.5), axes), [
    { src: 10, dst: 9 },
    { src: 20, dst: 3 },
  ]);
});

test('a line on its start row stages nothing, with or without picks', () => {
  assert.deepEqual(linePairs(createPicks(), at(0.5, 1.5), at(4.5, 1.5), axes), []);
  assert.deepEqual(linePairs({ ...createPicks(), srcs: [10, 20] }, at(0.5, 1.5), at(4.5, 1.5), axes), []);
});

const env = (prot = []) => ({ protectedDsts: new Set(prot) });

test('a line skips protected rows and says which', () => {
  const r = lineStage(
    createStage(),
    [
      { src: 1, dst: 7 },
      { src: 1, dst: 3 },
      { src: 1, dst: 5 },
    ],
    env([3]),
    [1],
  );
  assert.deepEqual(r.skipped, [{ src: 1, dst: 3 }]);
  assert.deepEqual(
    r.st.staged.map((x) => x.dst),
    [7, 5],
  );
  assert.equal(r.confirm, true);
});

test('a line of more than one route confirms in Take mode as well as Instant mode', () => {
  const pairs = [
    { src: 1, dst: 7 },
    { src: 1, dst: 3 },
  ];
  assert.equal(lineStage(createStage(), pairs, env(), [1]).confirm, true);
  const inst = lineStage(createStage({ mode: 'instant' }), pairs, env(), [1]);
  assert.equal(inst.confirm, true);
  assert.equal(inst.send, null);
});

test('a line left with one route stages it like a press, but never unstages a staged one', () => {
  const pairs = [
    { src: 1, dst: 7 },
    { src: 1, dst: 3 },
  ];
  let r = lineStage(createStage(), pairs, env([3]), [1]);
  assert.equal(r.confirm, false);
  assert.deepEqual(r.st.staged, [{ dst: 7, level: 1, src: 1 }]);
  r = lineStage(r.st, pairs, env([3]), [1]);
  assert.deepEqual(r.st.staged, [{ dst: 7, level: 1, src: 1 }]);
});

test('a line on only protected rows stages nothing and says why', () => {
  const r = lineStage(
    createStage(),
    [
      { src: 1, dst: 7 },
      { src: 1, dst: 3 },
    ],
    env([7, 3]),
    [1],
  );
  assert.equal(r.st.error.code, 'protected');
  assert.deepEqual(r.st.staged, []);
});

test('a line that would pass the cap stages nothing and is marked over', () => {
  const full = { ...createStage(), staged: Array.from({ length: STAGE_MAX - 1 }, (_, k) => ({ dst: 1000 + k, level: 1, src: 0 })) };
  const r = lineStage(
    full,
    [
      { src: 1, dst: 7 },
      { src: 1, dst: 3 },
    ],
    env(),
    [1],
  );
  assert.equal(r.over, true);
  assert.equal(r.st.error.code, 'cap');
  assert.equal(r.st.staged.length, STAGE_MAX - 1);
  assert.equal(r.confirm, false);
});

test('an empty line changes nothing', () => {
  const st = createStage();
  const r = lineStage(st, [], env(), [1]);
  assert.equal(r.st, st);
  assert.equal(r.confirm, false);
});
