// The panel editor's sidebar: Cell, Panel and Access tabs beside the grid. It opens on Panel and switches to Cell
// when the selection moves to a new square. A Grid panel has Sources and Destinations tabs in place of Cell.
// initSidebar(editor) takes what runEditor returns.
import { $, S, on } from './core.js';
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
  // Ids are prefixed because the Share modal's tabs live on this page too.
  const items = {
    buttons: [
      { id: 'ed-cell', text: 'Cell', panel: cell.node },
      { id: 'ed-panel', text: 'Panel', panel: panel.node },
      { id: 'ed-access', text: 'Access', panel: access.node },
    ],
    grid: [
      { id: 'ed-sources', text: 'Sources', panel: srcs.node },
      { id: 'ed-destinations', text: 'Destinations', panel: dsts.node },
      { id: 'ed-panel', text: 'Panel', panel: panel.node },
      { id: 'ed-access', text: 'Access', panel: access.node },
    ],
  };
  let type = '';
  let tabs = null;
  // The tab strip is made again when the type changes; a panel stays on the tab it had when that tab is still there.
  function layout() {
    const now = isGridPanel(ed.fields()) ? 'grid' : 'buttons';
    if (now === type) return;
    type = now;
    const was = tabs?.current();
    const strip = makeTabs(items[now]);
    for (const n of [cell.node, srcs.node, dsts.node]) n.hidden = true;
    strip.select(items[now].some((x) => x.id === was) ? was : 'ed-panel');
    if (tabs) tabs.node.replaceWith(strip.node);
    else host.append(strip.node, cell.node, srcs.node, dsts.node, panel.node, access.node);
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
