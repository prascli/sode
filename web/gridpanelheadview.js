// A Grid panel's header parts: the title and instance name, then the main page's Server and Router status
// (connview.js), Full screen and the Panels link. The Lock chip names the user, as on the main page. On the panel
// page they share one band, the deck, with the Levels box and the search boxes (gridpanel.css lays it out). The run
// (gridpanelrun.js) makes them on the panel page only, and its stop puts the page back.
import { el, on } from './core.js';
import { connBox, paintConn } from './connview.js';

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
  // The status and the header buttons in one group; the Panels link joins it (panelfull.js). Kiosk mode and Full
  // width stay in it for their code, and gridpanel.css hides them.
  const btns = [ui.kiosk, ui.screen, ui.full].filter(Boolean);
  const after = btns.at(-1)?.nextSibling ?? null;
  const tools = el('div', 'sode-gridpanel__tools', conn.root, ...btns);
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
  deck.append(ui.head, ...(box ? [box] : []), rule(1), finds, rule(2));
  return {
    // The run's search boxes go here (gridpanelfindbox.js).
    finds,
    stop() {
      conns.delete(conn);
      delete ui.tools;
      id.replaceWith(ui.title, ui.name);
      ui.screen?.classList.remove('pb-btn--ghost');
      ui.screen?.classList.add(...screenCls);
      tools.replaceWith(...btns);
      if (ui.home?.parentNode === tools) ui.head.append(ui.home);
      deck.replaceWith(ui.head);
      if (box) ui.grid.before(box);
    },
  };
}
