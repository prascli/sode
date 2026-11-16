// Grid panel keys to actions. Pure. The run does the action and marks the key handled when this returns one.
// ctx: { staged: count of staged routes, inControl: focus is on a header button or a field }.
// The cursor, picks, Find and jumps add their keys here (spec: Cursor and keyboard).

const ACTIONS = {
  Enter: (c) => (c.staged && !c.inControl ? 'confirm' : null),
  // Only while routes are staged, so Kiosk mode's own Esc works otherwise.
  f: (c) => (c.inControl ? null : 'levels'),
  Escape: (c) => (c.staged ? 'drop' : null),
};

export function gridKeyAction(e, ctx) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  return ACTIONS[e.key]?.(ctx) ?? null;
}
