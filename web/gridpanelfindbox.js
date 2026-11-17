// The Source bar and Destination bar search boxes in a Grid panel's corner. The rules are in gridpanelfind.js and
// the keys in gridpanelkeys.js (findBoxAction); the run (gridpanelrun.js) joins them.
import { el } from './core.js';

const LABEL = { srcs: 'Find sources', dsts: 'Find destinations' };
const KEY = { srcs: 's', dsts: 'd' };
const MODE = { find: 'Find', filter: 'Filter' };

// host is the view's corner (g.head). onText(kind, text) on each edit; onMode(kind) on a mode button press.
export function findBoxes(host, { onText, onMode }) {
  const make = (kind) => {
    const input = el('input', 'pb-input sode-gridpanel__find-input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = kind === 'srcs' ? 'Sources' : 'Destinations';
    input.setAttribute('aria-label', LABEL[kind]);
    input.setAttribute('aria-keyshortcuts', KEY[kind]);
    const count = el('span', 'sode-gridpanel__find-count', document.createTextNode(''));
    count.setAttribute('aria-live', 'polite');
    const mode = el('button', 'pb-btn pb-btn--ghost pb-btn--sm sode-gridpanel__find-mode', document.createTextNode(MODE.find));
    mode.type = 'button';
    mode.tabIndex = -1;
    mode.dataset.pbTip = 'Find marks matches. Filter shows only matches. Ctrl+/';
    const wrap = el('div', 'sode-gridpanel__find', el('span', 'sode-gridpanel__find-field', input, count), mode);
    wrap.dataset.kind = kind;
    wrap.dataset.mode = 'find';
    input.addEventListener('input', () => onText(kind, input.value));
    mode.addEventListener('click', () => {
      onMode(kind);
      input.focus();
    });
    return { wrap, input, count, mode };
  };
  const boxes = { srcs: make('srcs'), dsts: make('dsts') };
  host.prepend(boxes.srcs.wrap, boxes.dsts.wrap);
  return {
    input: (kind) => boxes[kind].input,
    // 'srcs' or 'dsts' when node is in that box, else null.
    kindOf(node) {
      for (const k of ['srcs', 'dsts']) if (node instanceof Node && boxes[k].wrap.contains(node)) return k;
      return null;
    },
    // find is gridpanelfind.js state; counts[kind] is { n: matches, at: the current match's place from 1 }.
    paint(find, counts) {
      for (const k of ['srcs', 'dsts']) {
        const b = boxes[k];
        const box = find[k];
        if (b.input.value !== box.text) b.input.value = box.text;
        if (b.wrap.dataset.mode !== find.mode) b.wrap.dataset.mode = find.mode;
        if (b.mode.firstChild.data !== MODE[find.mode]) b.mode.firstChild.data = MODE[find.mode];
        const c = counts[k];
        const text = !box.text.trim() ? '' : c.n ? `${c.at} of ${c.n}` : 'No match';
        if (b.count.firstChild.data !== text) b.count.firstChild.data = text;
        b.wrap.toggleAttribute('data-counted', !!text);
      }
    },
  };
}
