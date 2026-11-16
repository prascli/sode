// Levels on a Grid panel. Pure; levels and numbering come only from the adapter's GET /tally answer, never from S.
import { parseLevelsIn, levelStyle } from './levels.js';

// What a press stages: the panel's levels setting, else the Default levels, kept to the router's levels and the Rights.
// The Levels box replaces the setting as the source later; the setting only fills it on load.
export function stageLevels(settings, tally, rights) {
  if (!tally?.levels?.length) return [];
  const have = tally.levels.map((l) => l.level);
  const set = Array.isArray(settings?.levels) && settings.levels.length ? settings.levels : null;
  const want = set || parseLevelsIn('', { levels: tally.levels, numbering: tally.levelNumbering, defaultLevels: tally.defaultLevels || '' }) || [];
  const allowed = Array.isArray(rights?.levels) ? rights.levels : null;
  return want.filter((l) => have.includes(l) && (!allowed || allowed.includes(l)));
}

// env is envFrom's (panelrules.js). The levels on which dst has src now.
export function pieOn(env, src, dst) {
  const row = env.tally.get(dst);
  if (!row) return [];
  return [...row]
    .filter(([, s]) => s === src)
    .map(([l]) => l)
    .sort((a, b) => a - b);
}

const turn = (x) => `${Number(x.toFixed(4))}turn`;

// A fixed slice per router level, so a slice's place tells the level and colour is never the only signal.
// '' when no level is on.
export function pieFill(levels, on) {
  if (!on.length) return '';
  const n = levels.length;
  const parts = levels.map((l, i) => `${on.includes(l.level) ? levelStyle(l).color : 'transparent'} ${turn(i / n)} ${turn((i + 1) / n)}`);
  return `conic-gradient(${parts.join(', ')})`;
}
