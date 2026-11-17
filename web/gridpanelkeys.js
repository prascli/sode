// Grid panel keys to actions. Pure apart from keys.js. The run does the action and marks the key handled when this
// returns one. Keys are exact chord(e) names, so h/j/k/l are physical keys and a chord with an extra modifier is not
// the grid's. ctx is { staged, picks, inControl, line }. staged counts staged routes and picks counts picked names.
// inControl is true when focus is on a header button or a field. line is true while a Drawn line shows.
// A move action is a name in gridpanelcursor.js MOVES.
import { chord } from './keys.js';
import { MOVES } from './gridpanelcursor.js';

const free = (act) => (c) => (c.inControl ? null : act);

const ACTIONS = {
  enter: (c) => (c.staged && !c.inControl ? 'confirm' : null),
  f: free('levels'),
  // The line goes first, then picks, then staged routes. With none, Kiosk mode's own Esc works.
  escape: (c) => (c.line ? 'unline' : c.picks ? 'unpick' : c.staged ? 'drop' : null),
  v: free('line'),
  ' ': free('press'),
  up: free('up'),
  down: free('down'),
  left: free('left'),
  right: free('right'),
  k: free('up'),
  j: free('down'),
  h: free('left'),
  l: free('right'),
  pageup: free('pageUp'),
  pagedown: free('pageDown'),
  'alt+up': free('pageUp'),
  'alt+down': free('pageDown'),
  'alt+left': free('pageLeft'),
  'alt+right': free('pageRight'),
  home: free('corner'),
  end: free('colEnd'),
  'ctrl+home': free('rowStart'),
  'meta+home': free('rowStart'),
  'ctrl+end': free('rowEnd'),
  'meta+end': free('rowEnd'),
};

// While a line is drawn, Space stages it and only moves and Esc work besides.
const LINE_KEEPS = new Set(['press', 'unline']);

export function gridKeyAction(e, ctx) {
  const act = ACTIONS[chord(e)]?.(ctx) ?? null;
  return ctx.line && act && !MOVES.has(act) && !LINE_KEEPS.has(act) ? null : act;
}
