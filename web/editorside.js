// The panel editor's sidebar: Cell, Panel and Access tabs beside the grid. It opens on Panel and switches to Cell
// when the selection moves to a new square. A Grid panel has two tabs: Sources and Destinations, and Panel and Access.
// Each tab shows its two columns side by side where the sidebar is wide enough (panels.css).
// initSidebar(editor) takes what runEditor returns.
import { $, S, on, el } from './core.js';
import { makeTabs } from './tabs.js';
import { rectOf } from './gridmodel.js';
import { createCellTab } from './editorcell.js';
import { createPanelTab } from './editorpanel.js';
import { createAccessTab } from './editoraccess.js';
import { createEdgeTab } from './editorgridlist.js';
import { isGridPanel } from './gridpaneledges.js';

export function initSidebar(ed) {
  const host = $('ed-side');

  const ctx = { offset: () => ed.names().off || 0, levelCount: () => S.levels.length };
  const cell = createCellTab(ed);
  const panel = createPanelTab(ed);
  const access = createAccessTab(ed, ctx);
  const srcs = createEdgeTab(ed, { key: 'sources', rights: 'sources', what: 'source' });
  const dsts = createEdgeTab(ed, { key: 'destinations', rights: 'dsts', what: 'destination' });
  const col = (title, n) => el('section', 'sode-pair__col', el('h2', 'sode-pair__h', title), n);
  const lists = el('div', 'sode-pair sode-pair--lists', col('Sources', srcs.node), col('Destinations', dsts.node));
  const pairPanel = col('Panel', null);
  const pairAccess = col('Access', null);
  const settings = el('div', 'sode-pair', pairPanel, pairAccess);
  // Ids are prefixed because the Share modal's tabs live on this page too.
  const items = {
    buttons: [
      { id: 'ed-cell', text: 'Cell', panel: cell.node },
      { id: 'ed-panel', text: 'Panel', panel: panel.node },
      { id: 'ed-access', text: 'Access', panel: access.node },
    ],
    grid: [
      { id: 'ed-lists', text: 'Sources and Destinations', panel: lists },
      { id: 'ed-settings', text: 'Panel and Access', panel: settings },
    ],
  };
  host.append(cell.node, lists, settings, panel.node, access.node);
  let type = '';
  let tabs = null;
  // The tab strip is made again when the type changes; a panel stays on the tab it had when that tab is still there.
  function layout() {
    const now = isGridPanel(ed.fields()) ? 'grid' : 'buttons';
    if (now === type) return;
    type = now;
    const was = tabs?.current();
    // The Panel and Access tabs' nodes move between the strip and the Grid columns, so the tab state goes first.
    for (const n of [panel.node, access.node]) {
      for (const a of ['id', 'role', 'aria-labelledby', 'hidden']) n.removeAttribute(a);
      n.classList.remove('active', 'pb-tabpanel');
    }
    if (now === 'grid') {
      pairPanel.append(panel.node);
      pairAccess.append(access.node);
    } else host.append(panel.node, access.node);
    const strip = makeTabs(items[now]);
    for (const n of [cell.node, lists, settings]) n.hidden = true;
    const fallback = now === 'grid' ? 'ed-settings' : 'ed-panel';
    strip.select(items[now].some((x) => x.id === was) ? was : fallback);
    if (tabs) tabs.node.replaceWith(strip.node);
    else host.prepend(strip.node);
    tabs = strip;
  }
  layout();

  // Levels come from the hello the page's socket gets (S.levels), which carries each level's label and color.
  let seen = '';
  function readLevels() {
    const now = S.levels.map((l) => `${l.ui}${l.label}${l.color || l.swatch}`).join();
    if (now === seen) return;
    seen = now;
    cell.resetLevels();
    panel.resetLevels();
    paint();
  }

  const paint = () => {
    layout();
    cell.update();
    panel.update();
    access.update();
    srcs.update();
    dsts.update();
  };

  let sel = '';
  ed.onChange((g) => {
    const q = rectOf(g);
    const now = q ? `${q.r1},${q.c1},${q.r2},${q.c2}` : '';
    if (now !== sel && now && type === 'buttons') tabs.select('ed-cell');
    sel = now;
    cell.update();
    panel.update();
  });
  ed.onFields(() => {
    paint();
    readLevels();
  });
  $('ed-name').addEventListener('input', () => panel.update());
  on('hello', readLevels);
  paint();
  readLevels();
}
