// Grid panel keys to actions. Pure apart from keys.js. The run does the action and marks the key handled when this
// returns one. Keys are exact chord(e) names, so h/j/k/l are physical keys and a chord with an extra modifier is not
// the grid's. ctx: { staged: staged routes, picks: picked names, inControl: focus on a header button or field,
// bar: barOf(cursor) in gridpanelcursor.js, finding: search text }. A move action is a name in gridpanelcursor.js
// MOVES; 'range:<move>' is a Shift move along a bar, which extends the pick.
import { chord } from './keys.js';

const free = (act) => (c) => (c.inControl ? null : act);
const onBar = (c) => c.bar === 'srcs' || c.bar === 'dsts';
const named = (act) => (c) => (!c.inControl && onBar(c) ? act : null);
const range = (kind, move) => (c) => (!c.inControl && c.bar === kind ? `range:${move}` : null);
const keys = () => 'keys';

const ACTIONS = {
  enter: (c) => (c.staged && !c.inControl ? 'confirm' : null),
  f: free('levels'),
  // Picks go first, then staged routes. With neither, Kiosk mode's own Esc works.
  escape: (c) => (c.picks ? 'unpick' : c.staged ? 'drop' : null),
  ' ': (c) => (c.inControl || c.bar === 'corner' ? null : onBar(c) ? 'pick' : 'press'),
  x: named('add'),
  'shift+left': range('srcs', 'left'),
  'shift+right': range('srcs', 'right'),
  'shift+h': range('srcs', 'left'),
  'shift+l': range('srcs', 'right'),
  'alt+shift+left': range('srcs', 'pageLeft'),
  'alt+shift+right': range('srcs', 'pageRight'),
  'shift+up': range('dsts', 'up'),
  'shift+down': range('dsts', 'down'),
  'shift+k': range('dsts', 'up'),
  'shift+j': range('dsts', 'down'),
  'shift+pageup': range('dsts', 'pageUp'),
  'shift+pagedown': range('dsts', 'pageDown'),
  'alt+shift+up': range('dsts', 'pageUp'),
  'alt+shift+down': range('dsts', 'pageDown'),
  // As on the main page: Ctrl+? from anywhere, also as the / key for browsers that drop Shift's character under Ctrl.
  'shift+?': free('keys'),
  '?': free('keys'),
  'ctrl+shift+?': keys,
  'ctrl+shift+/': keys,
  g: free('jump'),
  'shift+g': free('step'),
  u: free('undo'),
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
