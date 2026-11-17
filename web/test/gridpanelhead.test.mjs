// A Grid panel's header (gridpanelhead.js): the Router, Mode and Signed in boxes and the line under the title.
import test from 'node:test';
import assert from 'node:assert/strict';
import { routerStat, modeStat, whoStat, metaOf } from '../gridpanelhead.js';

test('the Router box says what GET /status said, and Unknown when the key cannot read it', () => {
  assert.deepEqual(routerStat({ routerUp: true }), { text: 'Connected', tone: 'ok' });
  assert.deepEqual(routerStat({ routerUp: false }), { text: 'Offline', tone: 'error' });
  assert.deepEqual(routerStat(null), { text: 'Unknown', tone: 'idle' });
});

test('the Mode box names Take mode or Instant mode', () => {
  assert.equal(modeStat('take'), 'Take');
  assert.equal(modeStat('instant'), 'Instant');
  assert.equal(modeStat(undefined), 'Take');
});

test('a page with a key acts as the API client, else as the signed-in user or a Guest', () => {
  assert.equal(whoStat({ user: 'Ana', keyed: false }), 'Ana');
  assert.equal(whoStat({ user: '', keyed: false }), 'Guest');
  assert.equal(whoStat({ user: 'Ana', keyed: true }), 'API client');
});

test('the line under the title says whose panel it is, its size and what the Rights let the page do', () => {
  const panel = { owner: 'Ana', acts: 'session' };
  assert.deepEqual(metaOf({ panel, user: 'Ana', keyed: false, srcs: 56, dsts: 46, canTake: true }), {
    badge: 'Your panel',
    size: 'Grid panel, 56 sources by 46 destinations',
    rights: 'Can view and take',
  });
  assert.equal(metaOf({ panel, user: 'Ben', keyed: false, srcs: 1, dsts: 1, canTake: false }).badge, 'Shared with you');
  assert.equal(metaOf({ panel, user: 'Ben', keyed: false, srcs: 1, dsts: 1, canTake: false }).size, 'Grid panel, 1 source by 1 destination');
  assert.equal(metaOf({ panel, user: 'Ben', keyed: false, srcs: 1, dsts: 1, canTake: false }).rights, 'Can view only');
  assert.equal(metaOf({ panel, user: '', keyed: true, srcs: 1, dsts: 1, canTake: true }).badge, 'Link with key');
  assert.equal(metaOf({ panel: { owner: 'Ana', acts: 'public' }, user: 'Ana', keyed: true, srcs: 1, dsts: 1, canTake: true }).badge, 'Public');
});
