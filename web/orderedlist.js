// An ordered list's rows: drag to reorder, Move up, Move down, Remove, and the caller's own actions before them. Rules
// are orderedlistrules.js. The caller draws each row's body and holds the list; the editor's Pages bar is one user.
import { el, icon } from './core.js';
import { btn } from './formbits.js';
import { dropTo, canMove } from './orderedlistrules.js';

// opts: rowClass, toolsClass, move(from, to), remove(i), removeTip (the button's name, for example 'Delete Page').
// Buttons carry data-act (the caller's act, or up, down, delete) and data-i, so a caller can put focus back after a repaint.
export function createOrderedList(opts) {
  let dragFrom = -1;

  const iconBtn = (name, tip, act, fn) => {
    const b = btn('pb-btn--ghost pb-btn--icon pb-btn--sm', '', fn);
    b.append(icon(name));
    b.setAttribute('aria-label', tip);
    b.dataset.pbTip = tip;
    b.dataset.act = act;
    return b;
  };

  // r: i, n (rows in the list), id, readOnly, body (nodes above the buttons), actions ([{ icon, tip, act, run, off }]).
  // removeOff keeps Remove off, for example on a row the list must keep.
  function row(r) {
    const { i, n, readOnly } = r;
    const can = canMove(i, n);
    const own = (r.actions || []).map((a) => [iconBtn(a.icon, a.tip, a.act, () => a.run(i)), a.off]);
    const tools = el(
      'div',
      opts.toolsClass,
      ...[
        ...own,
        [iconBtn('arrow-up', 'Move up', 'up', () => opts.move(i, i - 1)), !can.up],
        [iconBtn('arrow-down', 'Move down', 'down', () => opts.move(i, i + 1)), !can.down],
        [iconBtn('trash-2', opts.removeTip, 'delete', () => opts.remove(i)), r.removeOff],
      ].map(([b, off]) => {
        b.dataset.i = String(i);
        b.disabled = !!(readOnly || off);
        return b;
      }),
    );
    const li = el('li', opts.rowClass, ...(r.body || []), tools);
    li.dataset.id = r.id;
    if (!readOnly) dragRow(li, i);
    return li;
  }

  // A drop takes the place of the row under it.
  function dragRow(li, i) {
    li.draggable = true;
    li.addEventListener('dragstart', (e) => {
      dragFrom = i;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i + 1));
    });
    li.addEventListener('dragover', (e) => {
      if (dragFrom < 0) return;
      e.preventDefault();
      li.classList.add('is-drop');
    });
    li.addEventListener('dragleave', () => li.classList.remove('is-drop'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = dragFrom;
      dragFrom = -1;
      if (from >= 0) opts.move(from, dropTo(from, i));
    });
    li.addEventListener('dragend', () => (dragFrom = -1));
  }

  return { row };
}
