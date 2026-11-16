// Staging on a Grid panel. Pure: no DOM, no clock, no network. Every function returns a new state.
// A staged entry is { dst, level, src }. Staging is keyed by destination and level, so a breakaway goes in one take
// (video from one source, audio from another). A route (GLOSSARY.md) is one destination and one source with its levels.
// Instant mode holds nothing staged: a press sends its one route at once.

// The server takes 200 routes in one take; the Grid stops well under it.
export const STAGE_MAX = 128;

export const createStage = ({ mode } = {}) => ({ mode: mode === 'instant' ? 'instant' : 'take', staged: [], busy: false, error: null });

// The staged entries as routes for POST /takes, one per destination and source, in the order first staged.
export function routesOf(st) {
  const by = new Map();
  for (const x of st.staged) {
    const k = `${x.dst}:${x.src}`;
    if (!by.has(k)) by.set(k, { src: x.src, dst: x.dst, levels: [] });
    by.get(k).levels.push(x.level);
  }
  return [...by.values()].map((r) => ({ ...r, levels: r.levels.sort((a, b) => a - b) }));
}

export const stagedCount = (st) => routesOf(st).length;

const fail = (st, code, message = '') => ({ ...st, error: { code, message } });

// A press on a crosspoint with the levels to stage. send is the routes to send at once (Instant mode), else null.
export function pressCrosspoint(st, { src, dst }, levels) {
  const base = st.mode === 'instant' ? [] : st.staged;
  const isStaged = base.some((x) => x.dst === dst && x.src === src);
  if (isStaged) return { st: { ...st, staged: base.filter((x) => !(x.dst === dst && x.src === src)), error: null }, send: null };
  if (!levels.length) return { st: fail(st, 'no-levels'), send: null };
  const kept = base.filter((x) => !(x.dst === dst && levels.includes(x.level)));
  const staged = [...kept, ...levels.map((level) => ({ dst, level, src }))];
  const next = { ...st, staged, error: null };
  if (stagedCount(next) > STAGE_MAX) return { st: fail(st, 'cap'), send: null };
  if (st.mode === 'instant') return { st: { ...st, staged: [], error: null }, send: routesOf(next) };
  return { st: next, send: null };
}

// What Enter confirms in Take mode, or null when nothing is staged.
export const confirmRoutes = (st) => (st.mode === 'take' && st.staged.length ? routesOf(st) : null);

export const dropStaged = (st) => ({ ...st, staged: [], error: null });

export function stageText(err) {
  switch (err?.code) {
    case 'cap':
      return `At most ${STAGE_MAX} routes can be staged`;
    case 'no-levels':
      return "No levels to stage: this panel's levels are not on the router or outside its Rights";
    case 'take':
      return err.message;
    default:
      return '';
  }
}

export const startSend = (st) => ({ ...st, busy: true, error: null });

// failed is null for a take Sode answered, else the reason. A failed take keeps the stage so it can be sent again.
export const afterTake = (st, failed) => (failed ? { ...fail(st, 'take', failed), busy: false } : { ...st, staged: [], busy: false, error: null });
