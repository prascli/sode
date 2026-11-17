// The Source bar and Destination bar search boxes in a Grid panel's corner. The rules are in gridpanelfind.js and
// the keys in gridpanelkeys.js (findBoxAction); the run (gridpanelrun.js) joins them.
import { el } from './core.js';

const NOUN = { srcs: 'sources', dsts: 'destinations' };
const KEY = { srcs: 's', dsts: 'd' };
const MODE = { find: 'Find', filter: 'Filter' };

// host is the view's corner (g.head). onText(kind, text) on each edit; onMode() on a mode button press. One mode
// serves both boxes, so one button sits at the end of the Destinations word and the boxes keep their width.
export function findBoxes(host, { onText, onMode }) {
  const make = (kind) => {
    const input = el('input', 'pb-input sode-gridpanel__find-input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = `${MODE.find} ${NOUN[kind]}`;
    input.setAttribute('aria-label', input.placeholder);
    input.setAttribute('aria-keyshortcuts', KEY[kind]);
    const count = el('span', 'sode-gridpanel__find-count', document.createTextNode(''));
    count.setAttribute('aria-live', 'polite');
    const key = el('kbd', 'sode-gridpanel__find-key', KEY[kind]);
    key.setAttribute('aria-hidden', 'true');
    const wrap = el('div', 'sode-gridpanel__find', el('span', 'sode-gridpanel__find-field', input, count, key));
    wrap.dataset.kind = kind;
    wrap.dataset.mode = 'find';
    input.addEventListener('input', () => onText(kind, input.value));
    return { wrap, input, count };
  };
  const boxes = { srcs: make('srcs'), dsts: make('dsts') };
  let last = 'srcs';
  const mode = el('button', 'pb-btn pb-btn--ghost pb-btn--sm sode-gridpanel__find-mode', document.createTextNode(MODE.find));
  mode.type = 'button';
  mode.tabIndex = -1;
  mode.dataset.pbTip = 'Find marks matches. Filter shows only matches. Ctrl+/';
  mode.addEventListener('click', () => {
    onMode();
    boxes[last].input.focus();
  });
  host.prepend(boxes.srcs.wrap, boxes.dsts.wrap, mode);
  return {
    input: (kind) => boxes[kind].input,
    // 'srcs' or 'dsts' when node is in that box, else null.
    kindOf(node) {
      for (const k of ['srcs', 'dsts']) if (node instanceof Node && boxes[k].wrap.contains(node)) return k;
      return null;
    },
    // find is gridpanelfind.js state; counts[kind] is { n: matches, at: the current match's place from 1 }.
    paint(find, counts) {
      last = find.last;
      if (mode.firstChild.data !== MODE[find.mode]) mode.firstChild.data = MODE[find.mode];
      for (const k of ['srcs', 'dsts']) {
        const b = boxes[k];
        const box = find[k];
        if (b.input.value !== box.text) b.input.value = box.text;
        if (b.wrap.dataset.mode !== find.mode) b.wrap.dataset.mode = find.mode;
        const word = `${MODE[find.mode]} ${NOUN[k]}`;
        if (b.input.placeholder !== word) b.input.placeholder = word;
        if (b.input.getAttribute('aria-label') !== word) b.input.setAttribute('aria-label', word);
        const c = counts[k];
        const text = !box.text.trim() ? '' : c.n ? `${c.at} of ${c.n}` : 'No match';
        if (b.count.firstChild.data !== text) b.count.firstChild.data = text;
        b.wrap.toggleAttribute('data-counted', !!text);
      }
    },
  };
}
