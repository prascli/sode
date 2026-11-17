// Drawn lines on a Grid panel (spec #432). Pure. A point is { x, y } in crosspoint units from the first crosspoint's
// top left, in display order (gridAxes). So a line holds while the grid scrolls under it. A cell is { i, j } as in
// gridpanelcursor.js.
import { fromHere } from './gridpanelpick.js';
import { stageable } from './gridpanelrights.js';
import { stageRoutes } from './gridpanelstage.js';

// Under half a crosspoint a drag stays a click.
export const CLICK = 0.5;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const isLine = (a, b) => Math.hypot(b.x - a.x, b.y - a.y) >= CLICK;

// Content px to units. m is the view's metrics(): xp a crosspoint, w the Destination bar width, h the Source bar height.
export const unitsOf = (x, y, m) => ({ x: (x - m.w) / m.xp, y: (y - m.h) / m.xp });

// One cell per row spanned, start row first, at the column where the line crosses the middle of that row. The end
// rows use the end point when the line does not reach the middle. A line that ends on its start row is no cells.
export function lineCells(a, b, { rows, cols }) {
  const i0 = clamp(Math.floor(a.y), 0, rows - 1);
  const i1 = clamp(Math.floor(b.y), 0, rows - 1);
  if (i0 === i1) return [];
  const lo = Math.min(a.y, b.y);
  const hi = Math.max(a.y, b.y);
  const step = i1 > i0 ? 1 : -1;
  const out = [];
  for (let i = i0; i !== i1 + step; i += step) {
    const y = clamp(i + 0.5, lo, hi);
    const x = a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
    out.push({ i, j: clamp(Math.floor(x), 0, cols - 1) });
  }
  return out;
}

// The routes a line stages, as [{ src, dst }] in drag order. With nothing picked, the crosspoint of each cell.
// With picks, the Diagonal rule from the start crosspoint over the rows spanned. The targets are every row spanned,
// or only the picked ones when more than one destination is picked. Sources are the picked sources wrapping from the
// start, or the start's source when fewer than two are picked.
export function linePairs(p, a, b, axes) {
  const cells = lineCells(a, b, { rows: axes.dsts.length, cols: axes.srcs.length });
  if (!cells.length) return [];
  if (!p.srcs.length && !p.dsts.length) return cells.map(({ i, j }) => ({ src: axes.srcs[j], dst: axes.dsts[i] }));
  const start = { src: axes.srcs[cells[0].j], dst: axes.dsts[cells[0].i] };
  const span = cells.map(({ i }) => axes.dsts[i]);
  const targets = p.dsts.length > 1 ? span.filter((d) => p.dsts.includes(d)) : span;
  const srcs = p.srcs.length > 1 ? fromHere(p.srcs, axes.srcs, start.src) : [start.src];
  return targets.map((dst, k) => ({ src: srcs[k % srcs.length], dst }));
}

// A release: pairs through stageable (protected rows skipped), then stageRoutes. Returns stageRoutes' { st, send,
// confirm } plus skipped (the protected pairs) and over (past the cap, so nothing is staged). A line of more than one
// route always confirms. A line left with one route stages it, and never unstages it as a press would.
export function lineStage(st, pairs, env, levels) {
  if (!pairs.length) return { st, send: null, confirm: false, skipped: [], over: false };
  const { pairs: kept, err } = stageable(pairs, env);
  const skipped = pairs.filter((x) => !kept.includes(x));
  if (err) return { st: { ...st, error: err }, send: null, confirm: false, skipped, over: false };
  let base = st;
  if (kept.length === 1) {
    const [{ src, dst }] = kept;
    base = { ...st, staged: st.staged.filter((x) => !(x.src === src && x.dst === dst)) };
  }
  const r = stageRoutes(base, kept, levels);
  if (r.st.error) return { ...r, st: { ...st, error: r.st.error }, skipped, over: r.st.error.code === 'cap' };
  return { ...r, confirm: kept.length > 1, skipped, over: false };
}
