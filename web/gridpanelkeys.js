// Grid panel keys to actions. Pure apart from keys.js. The run does the action and marks the key handled when this
// returns one. Keys are exact chord(e) names, so h/j/k/l are physical keys and a chord with an extra modifier is not
// the grid's. ctx: { staged: staged routes, picks: picked names, inControl: focus on a header button or field,
// finding: search text }. A move action is a name in gridpanelcursor.js MOVES.
import { chord } from './keys.js';

const free = (act) => (c) => (c.inControl ? null : act);

const ACTIONS = {
  enter: (c) => (c.staged && !c.inControl ? 'confirm' : null),
  f: free('levels'),
  // Picks go first, then staged routes. With neither, Kiosk mode's own Esc works.
  escape: (c) => (c.picks ? 'unpick' : c.staged ? 'drop' : null),
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
  // Find and Filter (gridpanelfind.js). n and N stay free while no box has text.
  s: free('findSrcs'),
  d: free('findDsts'),
  n: (c) => (c.finding ? free('nextMatch')(c) : null),
  'shift+n': (c) => (c.finding ? free('prevMatch')(c) : null),
};

export function gridKeyAction(e, ctx) {
  return ACTIONS[chord(e)]?.(ctx) ?? null;
}

// Keys in a Source bar or Destination bar search box. Any other key is typing. Ctrl+Tab cannot be used: browsers
// keep it, so Ctrl+/ switches the mode.
const BOX = {
  enter: 'nextMatch',
  'shift+enter': 'prevMatch',
  escape: 'clear',
  tab: 'swap',
  'shift+tab': 'swap',
  'ctrl+/': 'mode',
};

export const findBoxAction = (e) => BOX[chord(e)] ?? null;
