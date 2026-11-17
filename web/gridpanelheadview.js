// A Grid panel's header parts. The title is over a line that says whose panel it is. The Router,
// Mode and Signed in boxes come after it. The run (gridpanelrun.js) makes them on the panel page only and its stop takes
// them out. The words come from gridpanelhead.js.
import { el, icon, on } from './core.js';
import { routerStat, modeStat, whoStat, metaOf } from './gridpanelhead.js';

// The signed-in user (lock.js). Subscribed at import, before connect(), so the first answer is not missed; core.js's
// on() has no unsubscribe, so a run must not subscribe again.
let user = '';
on('access', (a) => (user = a.user || ''));

const setText = (n, t) => {
  if (n.data !== t) n.data = t;
};

function stat(label, ...lead) {
  const text = document.createTextNode('');
  const box = el('div', 'sode-gridpanel__stat', el('span', 'pb-label', label), el('span', 'sode-gridpanel__stat-val', ...lead, text));
  return { box, text };
}

// count is the run's "N staged" badge, which joins the line under the title.
export function gridHead(ui, count) {
  const badge = document.createTextNode('');
  const size = document.createTextNode('');
  const rights = document.createTextNode('');
  const meta = el(
    'div',
    'sode-gridpanel__meta',
    el('span', 'pb-badge pb-badge--info', icon('share-2'), badge),
    el('span', null, icon('grid-3x3'), size),
    el('span', null, rights),
    count,
  );
  const id = el('div', 'sode-gridpanel__id', el('div', 'sode-gridpanel__name', ui.title, ui.name), meta);
  ui.head.prepend(id);
  const dot = el('span', 'pb-dot');
  dot.setAttribute('aria-hidden', 'true');
  const router = stat('Router', dot);
  const mode = stat('Mode');
  const who = stat('Signed in', icon('users'));
  const stats = el('div', 'sode-gridpanel__stats', router.box, mode.box, who.box);
  ui.head.querySelector('.sode-panels__spacer').after(stats);
  return {
    // link is GET /status's answer (null without the status scope); srcs and dsts count the grid's items.
    paint({ link, mode: m, keyed, panel, srcs, dsts, canTake }) {
      const r = routerStat(link);
      setText(router.text, r.text);
      const cls = `pb-dot pb-dot--${r.tone}`;
      if (dot.className !== cls) dot.className = cls;
      setText(mode.text, modeStat(m));
      setText(who.text, whoStat({ user, keyed }));
      const t = metaOf({ panel, user, keyed, srcs, dsts, canTake });
      setText(badge, t.badge);
      setText(size, t.size);
      setText(rights, t.rights);
    },
    stop() {
      id.replaceWith(ui.title, ui.name);
      stats.remove();
    },
  };
}
