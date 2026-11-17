// Keys on a Grid panel (gridpanelkeys.js): which action a key press asks for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gridKeyAction, findBoxAction } from '../gridpanelkeys.js';

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
  assert.equal(gridKeyAction(key('x'), ctx()), null);
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

test('s and d go to the Source bar and Destination bar boxes, unless a field has focus', () => {
  assert.equal(gridKeyAction(code('KeyS'), ctx()), 'findSrcs');
  assert.equal(gridKeyAction(code('KeyD'), ctx()), 'findDsts');
  assert.equal(gridKeyAction(code('KeyS', { metaKey: true }), ctx()), null);
  assert.equal(gridKeyAction(code('KeyD', { inControl: true }), ctx({ inControl: true })), null);
});

test('n and N step the matches only while a box has text, so the keys are otherwise free', () => {
  assert.equal(gridKeyAction(code('KeyN'), ctx({ finding: true })), 'nextMatch');
  assert.equal(gridKeyAction(code('KeyN', { shiftKey: true }), ctx({ finding: true })), 'prevMatch');
  assert.equal(gridKeyAction(code('KeyN'), ctx()), null);
  assert.equal(gridKeyAction(code('KeyN'), ctx({ finding: true, inControl: true })), null);
});

test('in a search box: Enter and Shift+Enter step, Esc clears, Tab and Shift+Tab go to the other box, Ctrl+/ switches the mode', () => {
  assert.equal(findBoxAction(key('Enter')), 'nextMatch');
  assert.equal(findBoxAction(key('Enter', { shiftKey: true })), 'prevMatch');
  assert.equal(findBoxAction(key('Escape')), 'clear');
  assert.equal(findBoxAction(key('Tab')), 'swap');
  assert.equal(findBoxAction(key('Tab', { shiftKey: true })), 'swap');
  assert.equal(findBoxAction(key('/', { code: 'Slash', ctrlKey: true })), 'mode');
});

test('other keys in a search box are typing', () => {
  for (const c of ['KeyS', 'KeyJ', 'KeyN', 'ArrowLeft', 'Space']) assert.equal(findBoxAction(code(c)), null, c);
  assert.equal(findBoxAction(key('/', { code: 'Slash' })), null);
});
