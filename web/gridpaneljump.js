// Jumps on a Grid panel. Pure. c is a cursor (gridpanelcursor.js), axes is gridAxes, env is envFrom's (panelrules.js).
// A result is { c } (the new cursor), { why, ... } for a note, or null when the key does nothing there.

// g: from a crosspoint or the Destination bar, along the row to the source on the lowest level in the Levels box.
export function sourceJump(c, axes, env, levels) {
  if (c.i < 0) return null;
  if (!levels.length) return { why: 'levels' };
  const dst = axes.dsts[c.i];
  const level = Math.min(...levels);
  const src = env.tally.get(dst)?.get(level);
  if (src === undefined || src < 0) return { why: 'none', dst, level };
  const j = axes.srcs.indexOf(src);
  return j < 0 ? { why: 'other', dst, src } : { c: { i: c.i, j } };
}

// G: down the source's column to the next destination that has it on any level, back to the top after the last.
export function holderJump(c, axes, env) {
  if (c.j < 0) return null;
  const src = axes.srcs[c.j];
  const n = axes.dsts.length;
  for (let k = 1; k <= n; k++) {
    const i = (((c.i + k) % n) + n) % n;
    const row = env.tally.get(axes.dsts[i]);
    if (row && [...row.values()].includes(src)) return { c: { i, j: c.j } };
  }
  return { why: 'unused', src };
}

// levels is GET /tally's, for the level label.
export function jumpText(r, names, levels) {
  switch (r?.why) {
    case 'levels':
      return 'No levels in the Levels box to jump on';
    case 'none':
      return `${names.destination(r.dst)} has no source on level ${levels.find((l) => l.level === r.level)?.label ?? r.level}`;
    case 'other':
      return `${names.source(r.src)} on ${names.destination(r.dst)} is not on this panel`;
    case 'unused':
      return `No destination on this panel has ${names.source(r.src)}`;
    default:
      return '';
  }
}
