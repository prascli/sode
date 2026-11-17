// The words in a Grid panel's header. Pure; gridpanelheadview.js draws them.

// link is GET /status's answer, or null for a key without the status scope.
export function routerStat(link) {
  if (!link) return { text: 'Unknown', tone: 'idle' };
  return link.routerUp ? { text: 'Connected', tone: 'ok' } : { text: 'Offline', tone: 'error' };
}

export const modeStat = (mode) => (mode === 'instant' ? 'Instant' : 'Take');

// A page with a key acts as the panel's API client, whoever is signed in to this browser.
export const whoStat = ({ user, keyed }) => (keyed ? 'API client' : user || 'Guest');

const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

// panel is the panel as read; srcs and dsts count what the grid holds; canTake is false when the Rights offer no level.
export function metaOf({ panel, user, keyed, srcs, dsts, canTake }) {
  let badge = 'Shared with you';
  if (panel.acts === 'public') badge = 'Public';
  else if (keyed) badge = 'Link with key';
  else if (user && user === panel.owner) badge = 'Your panel';
  return {
    badge,
    size: `Grid panel, ${count(srcs, 'source')} by ${count(dsts, 'destination')}`,
    rights: canTake ? 'Can view and take' : 'Can view only',
  };
}
