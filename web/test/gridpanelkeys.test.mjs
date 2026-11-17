// Keys on a Grid panel (gridpanelkeys.js): which action a key press asks for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gridKeyAction } from '../gridpanelkeys.js';

const key = (k, over = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...over });
const ctx = (over = {}) => ({ staged: 1, picks: 0, inControl: false, ...over });

test('Enter with routes staged opens the confirm', () => {
  assert.equal(gridKeyAction(key('Enter'), ctx()), 'confirm');
});

test('Enter with nothing staged does nothing', () => {
  assert.equal(gridKeyAction(key('Enter'), ctx({ staged: 0 })), null);
});

test('Enter on a focused control is that control’s', () => {
  assert.equal(gridKeyAction(key('Enter'), ctx({ inControl: true })), null);
});

test('Esc drops picks first, then staged routes, and only while either exists, so Kiosk mode gets Esc otherwise', () => {
  assert.equal(gridKeyAction(key('Escape'), ctx({ picks: 2 })), 'unpick');
  assert.equal(gridKeyAction(key('Escape'), ctx({ picks: 2, staged: 0 })), 'unpick');
  assert.equal(gridKeyAction(key('Escape'), ctx()), 'drop');
  assert.equal(gridKeyAction(key('Escape'), ctx({ staged: 0 })), null);
});

test('a key with Ctrl, Cmd or Alt held is not the grid’s', () => {
  for (const mod of ['ctrlKey', 'metaKey', 'altKey']) assert.equal(gridKeyAction(key('Enter', { [mod]: true }), ctx()), null);
});

test('f focuses the Levels box, unless a field already has focus', () => {
  assert.equal(gridKeyAction(key('f'), ctx()), 'levels');
  assert.equal(gridKeyAction(key('f'), ctx({ inControl: true })), null);
  assert.equal(gridKeyAction(key('f', { ctrlKey: true }), ctx()), null);
});

test('other keys do nothing yet', () => {
  assert.equal(gridKeyAction(key('q', { code: 'KeyQ' }), ctx()), null);
});

const code = (c, over = {}) => key(c.startsWith('Key') ? c.slice(3).toLowerCase() : c, { code: c, ...over });

test('arrows and h/j/k/l move the cursor; h/j/k/l are physical keys', () => {
  const want = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyK: 'up', KeyJ: 'down', KeyH: 'left', KeyL: 'right' };
  for (const [c, m] of Object.entries(want)) assert.equal(gridKeyAction(code(c), ctx()), m, c);
  // Dvorak: the key in the J place types h but moves down.
  assert.equal(gridKeyAction(key('h', { code: 'KeyJ' }), ctx()), 'down');
});

test('PageUp, PageDown and Alt+arrows move one screen', () => {
  assert.equal(gridKeyAction(code('PageUp'), ctx()), 'pageUp');
  assert.equal(gridKeyAction(code('PageDown'), ctx()), 'pageDown');
  assert.equal(gridKeyAction(code('ArrowUp', { altKey: true }), ctx()), 'pageUp');
  assert.equal(gridKeyAction(code('ArrowDown', { altKey: true }), ctx()), 'pageDown');
  assert.equal(gridKeyAction(code('ArrowLeft', { altKey: true }), ctx()), 'pageLeft');
  assert.equal(gridKeyAction(code('ArrowRight', { altKey: true }), ctx()), 'pageRight');
});

test('Home goes to the corner, Ctrl or Cmd+Home and End to the row edges, End to the column end', () => {
  assert.equal(gridKeyAction(code('Home'), ctx()), 'corner');
  assert.equal(gridKeyAction(code('End'), ctx()), 'colEnd');
  for (const mod of ['ctrlKey', 'metaKey']) {
    assert.equal(gridKeyAction(code('Home', { [mod]: true }), ctx()), 'rowStart', mod);
    assert.equal(gridKeyAction(code('End', { [mod]: true }), ctx()), 'rowEnd', mod);
  }
});

test('Space presses at the cursor', () => {
  assert.equal(gridKeyAction(key(' ', { code: 'Space' }), ctx({ staged: 0 })), 'press');
});

test('Shift with a move does nothing in the grid', () => {
  assert.equal(gridKeyAction(code('ArrowDown', { shiftKey: true }), ctx()), null);
  assert.equal(gridKeyAction(code('KeyJ', { shiftKey: true }), ctx()), null);
});

test('moves and Space leave a focused field or header button its own keys', () => {
  for (const c of ['ArrowUp', 'KeyJ', 'PageDown', 'Home', 'End']) assert.equal(gridKeyAction(code(c), ctx({ inControl: true })), null, c);
  assert.equal(gridKeyAction(key(' ', { code: 'Space' }), ctx({ inControl: true })), null);
});

test('browser chords such as Cmd+R and Ctrl+L are not the grid’s', () => {
  assert.equal(gridKeyAction(code('KeyR', { metaKey: true }), ctx()), null);
  assert.equal(gridKeyAction(code('KeyL', { ctrlKey: true }), ctx()), null);
  assert.equal(gridKeyAction(code('KeyJ', { altKey: true }), ctx()), null);
});

const bar = (b, over = {}) => ctx({ staged: 0, bar: b, ...over });
const shift = (c) => code(c, { shiftKey: true });

test('Space on a bar picks the name; on a crosspoint it presses; on the corner it does nothing', () => {
  assert.equal(gridKeyAction(key(' ', { code: 'Space' }), bar('srcs')), 'pick');
  assert.equal(gridKeyAction(key(' ', { code: 'Space' }), bar('dsts')), 'pick');
  assert.equal(gridKeyAction(key(' ', { code: 'Space' }), bar(null)), 'press');
  assert.equal(gridKeyAction(key(' ', { code: 'Space' }), bar('corner')), null);
});

test('x on a bar adds one name; in the grid it does nothing', () => {
  assert.equal(gridKeyAction(code('KeyX'), bar('srcs')), 'add');
  assert.equal(gridKeyAction(code('KeyX'), bar('dsts')), 'add');
  assert.equal(gridKeyAction(code('KeyX'), bar(null)), null);
  assert.equal(gridKeyAction(code('KeyX'), bar('corner')), null);
});

test('Shift with a move along the Source bar extends the pick', () => {
  const want = { ArrowLeft: 'left', ArrowRight: 'right', KeyH: 'left', KeyL: 'right' };
  for (const [c, m] of Object.entries(want)) assert.equal(gridKeyAction(shift(c), bar('srcs')), `range:${m}`, c);
  assert.equal(gridKeyAction(code('ArrowLeft', { shiftKey: true, altKey: true }), bar('srcs')), 'range:pageLeft');
  assert.equal(gridKeyAction(code('ArrowRight', { shiftKey: true, altKey: true }), bar('srcs')), 'range:pageRight');
  for (const c of ['ArrowUp', 'ArrowDown', 'KeyJ', 'KeyK', 'PageDown']) assert.equal(gridKeyAction(shift(c), bar('srcs')), null, c);
});

test('Shift with a move along the Destination bar extends the pick', () => {
  const want = { ArrowUp: 'up', ArrowDown: 'down', KeyK: 'up', KeyJ: 'down', PageUp: 'pageUp', PageDown: 'pageDown' };
  for (const [c, m] of Object.entries(want)) assert.equal(gridKeyAction(shift(c), bar('dsts')), `range:${m}`, c);
  assert.equal(gridKeyAction(code('ArrowDown', { shiftKey: true, altKey: true }), bar('dsts')), 'range:pageDown');
  for (const c of ['ArrowLeft', 'ArrowRight', 'KeyH', 'KeyL']) assert.equal(gridKeyAction(shift(c), bar('dsts')), null, c);
});

test('Shift with a move does nothing on the corner', () => {
  for (const c of ['ArrowDown', 'ArrowRight']) assert.equal(gridKeyAction(shift(c), bar('corner')), null, c);
});

test('picks leave a focused field or header button its own keys', () => {
  for (const b of ['srcs', 'dsts']) {
    assert.equal(gridKeyAction(key(' ', { code: 'Space' }), bar(b, { inControl: true })), null);
    assert.equal(gridKeyAction(code('KeyX'), bar(b, { inControl: true })), null);
    assert.equal(gridKeyAction(shift(b === 'srcs' ? 'ArrowRight' : 'ArrowDown'), bar(b, { inControl: true })), null);
  }
});

test('? opens the key list, but not from a field; Ctrl+? opens it from anywhere', () => {
  const q = (over = {}) => key('?', { code: 'Slash', shiftKey: true, ...over });
  assert.equal(gridKeyAction(q(), ctx()), 'keys');
  assert.equal(gridKeyAction(q(), ctx({ inControl: true })), null);
  assert.equal(gridKeyAction(q({ ctrlKey: true }), ctx({ inControl: true })), 'keys');
  // Some browsers report the / key without Shift's character under Ctrl.
  assert.equal(gridKeyAction(key('/', { code: 'Slash', shiftKey: true, ctrlKey: true }), ctx({ inControl: true })), 'keys');
  assert.equal(gridKeyAction(q({ metaKey: true }), ctx()), null);
});
