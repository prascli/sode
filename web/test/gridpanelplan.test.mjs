// What a Grid panel's confirm lists (gridpanelplan.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { planOf } from '../gridpanelplan.js';
import { namesFrom } from '../panelrules.js';
import { namesReply } from './gridpanelfixture.mjs';

const names = namesFrom(namesReply());

test('one item per destination, with each source and its levels, in staged order', () => {
  const plan = planOf(
    [
      { src: 0, dst: 1, levels: [1] },
      { src: 2, dst: 0, levels: [1, 2] },
      { src: 1, dst: 1, levels: [2] },
    ],
    names,
  );
  assert.deepEqual(plan, {
    verb: 'take',
    items: [
      {
        dst: 1,
        dstName: 'MON B',
        groups: [
          { src: 0, srcName: 'CAM 1', levels: [1] },
          { src: 1, srcName: 'CAM 2', levels: [2] },
        ],
      },
      { dst: 0, dstName: 'MON A', groups: [{ src: 2, srcName: 'VT 1', levels: [1, 2] }] },
    ],
  });
});

test('a name the router has not given reads as the number shown', () => {
  const plan = planOf([{ src: 9, dst: 0, levels: [1] }], names);
  assert.equal(plan.items[0].groups[0].srcName, 'Source 10');
});
