// Keys on a Grid panel (gridpanelkeys.js): which action a key press asks for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gridKeyAction } from '../gridpanelkeys.js';

const key = (k, over = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...over });
const ctx = (over = {}) => ({ staged: 1, inControl: false, ...over });

test('Enter with routes staged opens the confirm', () => {
  assert.equal(gridKeyAction(key('Enter'), ctx()), 'confirm');
});

test('Enter with nothing staged does nothing', () => {
  assert.equal(gridKeyAction(key('Enter'), ctx({ staged: 0 })), null);
});

test('Enter on a focused control is that control’s', () => {
  assert.equal(gridKeyAction(key('Enter'), ctx({ inControl: true })), null);
});

test('Esc drops staged routes, and only while some are staged, so Kiosk mode gets Esc otherwise', () => {
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
