// A Grid panel's header parts. The title has a line that says whose panel it is. The Router, Mode and Signed in
// boxes go with the header buttons. On the panel page they share one band, the deck, with the Levels box and the search
// boxes (gridpanel.css lays it out). The run (gridpanelrun.js) makes them on the panel page only, and its stop puts
// the page back. The words come from gridpanelhead.js.
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
  // A part too long for the deck ends in an ellipsis on its own span, and tooltip.js shows it whole on hover.
  const cut = (text) => el('span', 'sode-gridpanel__cut', text);
  const meta = el(
    'div',
    'sode-gridpanel__meta',
    el('span', 'pb-badge pb-badge--info', icon('share-2'), badge),
    el('span', null, icon('grid-3x3'), cut(size)),
    el('span', null, cut(rights)),
    count,
  );
  const dot = el('span', 'pb-dot');
  dot.setAttribute('aria-hidden', 'true');
  const router = stat('Router', dot);
  const mode = stat('Mode');
  const who = stat('Signed in', icon('users'));
  const stats = el('div', 'sode-gridpanel__stats', router.box, mode.box, who.box);
  const id = el('div', 'sode-gridpanel__id', el('div', 'sode-gridpanel__name', ui.title, ui.name), meta);
  ui.head.prepend(id);
  // The status boxes and the header buttons in one group; the Panels link joins it (panelfull.js).
  const btns = [ui.kiosk, ui.screen, ui.full].filter(Boolean);
  const after = btns.at(-1)?.nextSibling ?? null;
  const tools = el('div', 'sode-gridpanel__tools', stats, ...btns);
  ui.head.insertBefore(tools, after);
  if (ui.home && ui.head.contains(ui.home)) tools.append(ui.home);
  ui.tools = tools;
  // The deck: the header and the Levels box are display: contents in it, so their parts are cells of one grid.
  const box = ui.levels;
  const finds = el('div', 'sode-gridpanel__finds');
  const rule = (n) => {
    const r = el('div', `pb-divider pb-divider--vertical sode-gridpanel__rule sode-gridpanel__rule--${n}`);
    r.setAttribute('aria-hidden', 'true');
    return r;
  };
  const deck = el('div', 'sode-gridpanel__deck');
  ui.head.before(deck);
  deck.append(ui.head, rule(1), ...(box ? [box] : []), rule(2), finds, rule(3));
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
    // The run's search boxes go here (gridpanelfindbox.js).
    finds,
    stop() {
      delete ui.tools;
      id.replaceWith(ui.title, ui.name);
      tools.replaceWith(...btns);
      if (ui.home?.parentNode === tools) ui.head.append(ui.home);
      deck.replaceWith(ui.head);
      if (box) ui.grid.before(box);
    },
  };
}
