// The words in a Grid panel's header. Pure; gridpanelheadview.js draws them.
import { plural } from './gridmodel.js';

// link is GET /status's answer, or null for a key without the status scope.
export function routerStat(link) {
  if (!link) return { text: 'Unknown', tone: 'idle' };
  return link.routerUp ? { text: 'Connected', tone: 'ok' } : { text: 'Offline', tone: 'error' };
}

export const modeStat = (mode) => (mode === 'instant' ? 'Instant' : 'Take');

// A page with a key acts as the panel's API client, whoever is signed in to this browser.
export const whoStat = ({ user, keyed }) => (keyed ? 'API client' : user || 'Guest');

// panel is the panel as read; srcs and dsts count what the grid holds; canTake is false when the Rights offer no level.
export function metaOf({ panel, user, keyed, srcs, dsts, canTake }) {
  let badge = 'Shared with you';
  if (panel.acts === 'public') badge = 'Public';
  else if (keyed) badge = 'Link with key';
  else if (user && user === panel.owner) badge = 'Your panel';
  return {
    badge,
    size: `Grid panel, ${plural(srcs, 'source')} by ${plural(dsts, 'destination')}`,
    rights: canTake ? 'Can view and take' : 'Can view only',
  };
}

// The grid when it has nothing to show on an axis: a new Grid panel starts with no items (docs/panels-design.md).
export function emptyText({ srcs, dsts, canEdit }) {
  if (srcs && dsts) return null;
  const what = !srcs && !dsts ? 'sources or destinations' : !srcs ? 'sources' : 'destinations';
  return {
    title: `This panel shows no ${what}`,
    msg: canEdit ? 'Add them in the editor.' : 'The owner of the panel adds them in the editor.',
    edit: !!canEdit,
  };
}
