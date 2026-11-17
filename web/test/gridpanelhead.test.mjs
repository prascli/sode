// A Grid panel's words (gridpanelhead.js) for a grid with nothing to show.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyText } from '../gridpanelhead.js';

test('a grid with no sources or no destinations says so, and how to add them', () => {
  assert.equal(emptyText({ srcs: 3, dsts: 2, canEdit: true }), null);
  assert.deepEqual(emptyText({ srcs: 0, dsts: 0, canEdit: true }), {
    title: 'This panel shows no sources or destinations',
    msg: 'Add them in the editor.',
    edit: true,
  });
  assert.equal(emptyText({ srcs: 0, dsts: 4, canEdit: false }).title, 'This panel shows no sources');
  assert.equal(emptyText({ srcs: 4, dsts: 0, canEdit: false }).msg, 'The owner of the panel adds them in the editor.');
});
