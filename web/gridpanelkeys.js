// Grid panel keys to actions. Pure. The run does the action and marks the key handled when this returns one.
// ctx: { staged: count of staged routes, picks: count of picked names, inControl: focus is on a header button or a field }.
// The cursor, picks, Find and jumps add their keys here (spec: Cursor and keyboard).

const ACTIONS = {
  Enter: (c) => (c.staged && !c.inControl ? 'confirm' : null),
  // Picks go first, then staged routes. With neither, Kiosk mode's own Esc works.
  Escape: (c) => (c.picks ? 'unpick' : c.staged ? 'drop' : null),
};

export function gridKeyAction(e, ctx) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  return ACTIONS[e.key]?.(ctx) ?? null;
}
