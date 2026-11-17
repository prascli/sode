// Find and Filter on a Grid panel's Source bar and Destination bar (spec #432). Pure.
// Find marks matches in place and steps through them; Filter shows only matches. Each bar has its own box and mode.
// Matching is the main page's fuzzy scoring as a yes or no: matches keep panel order and there is no cut-off.
import { fuzzyScore } from './fuzzy.js';

// at is the router number of the current match, or null for the first one.
const empty = () => ({ text: '', mode: 'find', at: null });

// last is the box that n and N on the grid step.
export const createFind = () => ({ srcs: empty(), dsts: empty(), last: 'srcs' });

// order is router numbers in display order; list is that edge of GET /names ({ n, name }). offset is the reply's
// numberOffset, so a typed number matches the number as shown.
export function findMatches(order, list, text, offset = 0) {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const by = new Map((list || []).map((x) => [x.n, x.name || '']));
  return order.filter((n) => fuzzyScore({ num: String(n + offset), lname: (by.get(n) ?? '').toLowerCase() }, q) >= 0);
}

// kind is 'srcs' or 'dsts'.
export const typed = (f, kind, text) => ({ ...f, [kind]: { ...f[kind], text, at: null }, last: kind });

export const clearFind = (f, kind) => ({ ...f, [kind]: { ...f[kind], text: '', at: null } });

export const switchMode = (f, kind) => ({ ...f, [kind]: { ...f[kind], mode: f[kind].mode === 'find' ? 'filter' : 'find' } });

// matches is findMatches for that box. A current match that went (a live update, a rename) gives the first.
export const currentMatch = (f, kind, matches) => (matches.includes(f[kind].at) ? f[kind].at : (matches[0] ?? null));

// dir 1 is the next match, -1 the one before; both wrap.
export function stepMatch(f, kind, matches, dir) {
  if (!matches.length) return f;
  const i = matches.indexOf(currentMatch(f, kind, matches));
  const next = (i + dir + matches.length) % matches.length;
  return { ...f, [kind]: { ...f[kind], at: matches[next] }, last: kind };
}

// One edge in display order, as the grid shows it. pins is how many lead the order (pinsOf); a Filter never hides
// them, as pinned items stay at the edge with or without a filter.
export function shownOrder(order, pins, box, matches) {
  if (box.mode !== 'filter' || !box.text.trim()) return order;
  const on = new Set(matches);
  return [...order.slice(0, pins), ...order.slice(pins).filter((n) => on.has(n))];
}
