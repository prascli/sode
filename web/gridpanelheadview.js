// A Grid panel's header parts, laid out as on the main page: the Lock chip, the title and the icon buttons (Settings,
// Full screen, the Panels link) on the left, and the Server and Router status (connview.js) top right. Beside the
// status is the status slot: the result line and the "This panel was changed" banner. On the panel page they share
// one band, the deck, with the Levels box and the search boxes (gridpanel.css lays it out). The run (gridpanelrun.js)
// makes them on the panel page only, and its stop puts the page back.
import { el, icon, on } from './core.js';
import { connBox, paintConn } from './connview.js';
import { layout, onLayout } from './layout.js';

// core.js's on() has no unsubscribe, so one subscription at import paints every head a run has made.
const conns = new Set();
on('conn', () => {
  for (const c of conns) paintConn(c);
});

// count is the run's "N staged" badge; the note beside Take shows the count, so the deck hides this one.
export function gridHead(ui, count) {
  const id = el('div', 'sode-gridpanel__id', el('div', 'sode-gridpanel__name', ui.title, ui.name), count);
  ui.head.prepend(id);
  const conn = connBox();
  conns.add(conn);
  paintConn(conn);
  // Full screen is a ghost icon button, as the Panels link beside it is.
  const screenCls = ['pb-btn--outline', 'pb-btn--sm'].filter((c) => ui.screen?.classList.contains(c));
  ui.screen?.classList.remove(...screenCls);
  ui.screen?.classList.add('pb-btn--ghost');
  // The main page's Settings button (index.html #settings-open), as a link: settings.js opens the view at #settings.
  const settings = el('a', 'pb-btn pb-btn--ghost pb-btn--icon sode-gridpanel__settings', icon('settings', false));
  settings.href = './#settings';
  settings.setAttribute('aria-label', 'Settings');
  settings.dataset.pbTip = 'Settings';
  // The header buttons in one group; the Panels link joins it (panelfull.js). Kiosk mode and Full width stay in it
  // for their code, and gridpanel.css hides them.
  const btns = [ui.kiosk, ui.screen, ui.full].filter(Boolean);
  const after = btns.at(-1)?.nextSibling ?? null;
  const tools = el('div', 'sode-gridpanel__tools', settings, ...btns);
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
  // The status slot is outside the header, since kiosk mode and the Title bar setting hide the header. Its height is
  // fixed (gridpanel.css), so a line or the banner that shows or goes never moves the grid.
  const slot = el('div', 'sode-gridpanel__slot');
  const top = el('div', 'sode-gridpanel__headrow');
  ui.head.before(deck);
  top.append(ui.head, slot, conn.root);
  deck.append(top, ...(box ? [box] : []), rule(1), finds, rule(2));
  // The phone's band (gridpanel.css): More and the levels in words open the rest of the deck under it.
  const more = el('button', 'pb-btn pb-btn--ghost pb-btn--icon sode-gridpanel__more', icon('menu', false));
  more.type = 'button';
  more.id = 'panel-more';
  more.setAttribute('aria-label', 'More');
  more.setAttribute('aria-expanded', 'false');
  const lvText = document.createTextNode('');
  const lv = el('button', 'pb-btn pb-btn--outline pb-btn--sm sode-gridpanel__lv', el('span', 'sode-gridpanel__lv-word', 'Levels'), lvText);
  lv.type = 'button';
  const open = (on) => {
    deck.toggleAttribute('data-open', on);
    more.setAttribute('aria-expanded', String(on));
  };
  const toggle = () => open(!deck.hasAttribute('data-open'));
  more.addEventListener('click', toggle);
  lv.addEventListener('click', toggle);
  // text is the levels a press stages, in words; the band is the only place they show while the rest is closed.
  const paintLevels = (text) => {
    const t = text || 'none';
    if (lvText.data !== t) lvText.data = t;
  };
  box?.prepend(more, lv);
  // The desktop layout moves the status line and the banner into the slot. The phone keeps them where the page has
  // them.
  const moved = [ui.status, ui.update].filter(Boolean).map((n) => [n, n.parentNode, n.nextSibling]);
  // Back in reverse order, since the status line's next sibling is the banner.
  const placeStatus = (l) => {
    if (l !== 'phone') slot.append(...moved.map(([n]) => n));
    else for (const [n, home, next] of [...moved].reverse()) if (n.parentNode === slot) home.insertBefore(n, next);
  };
  placeStatus(layout());
  const offLayout = onLayout(placeStatus);
  return {
    // The run's search boxes go here (gridpanelfindbox.js).
    finds,
    // The run calls this on each render and on each Levels box change.
    paintLevels,
    stop() {
      more.remove();
      lv.remove();
      conns.delete(conn);
      delete ui.tools;
      id.replaceWith(ui.title, ui.name);
      ui.screen?.classList.remove('pb-btn--ghost');
      ui.screen?.classList.add(...screenCls);
      tools.replaceWith(...btns);
      if (ui.home?.parentNode === tools) ui.head.append(ui.home);
      offLayout();
      placeStatus('phone');
      deck.replaceWith(ui.head);
      if (box) ui.grid.before(box);
    },
  };
}
