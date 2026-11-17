// An ordered list's rows: drag to reorder, Move up, Move down, Remove, and the caller's own actions before them. Rules
// are orderedlistrules.js. The caller draws each row's body and holds the list; the editor's Pages bar is one user.
import { el, icon } from './core.js';
import { btn } from './formbits.js';
import { dropTo, canMove } from './orderedlistrules.js';

// opts: rowClass, toolsClass, move(from, to), remove(i), removeTip (the button's name, for example 'Delete Page').
// drop(from, over, after) is opt-in: the drop goes before or after the row under it by the pointer's half, and the
// caller places it. Without it a drop takes the place of the row under it, as the Pages bar needs.
// grip(i) is opt-in too. A drag then starts only from a grip handle at the row's start. The browser's drag image is a
// chip with the text of grip(i), not the row. dragging(i | -1) tells the caller when a drag starts and ends.
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
    const grip = opts.grip ? el('span', 'sode-grip', icon('grip-vertical')) : null;
    if (grip) {
      grip.setAttribute('aria-hidden', 'true');
      grip.dataset.pbTip = 'Drag to move';
    }
    const li = el('li', opts.rowClass, ...(grip ? [grip] : []), ...(r.body || []), tools);
    li.dataset.id = r.id;
    if (!readOnly) dragRow(li, i, grip);
    else if (grip) grip.classList.add('is-off');
    return li;
  }

  // A drop takes the place of the row under it, or with opts.drop goes to the side of it the pointer is on.
  const sideOf = (li, e) => {
    const r = li.getBoundingClientRect();
    return e.clientY > r.top + r.height / 2;
  };
  const unmark = (li) => li.classList.remove('is-drop', 'is-drop-after', 'is-drop-before');
  function dragRow(li, i, grip) {
    const from = grip || li;
    from.draggable = true;
    from.addEventListener('dragstart', (e) => {
      dragFrom = i;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i + 1));
      if (grip) dragImage(e, opts.grip(i));
      opts.dragging?.(i);
    });
    li.addEventListener('dragover', (e) => {
      if (dragFrom < 0) return;
      e.preventDefault();
      if (!opts.drop) return li.classList.add('is-drop');
      const after = sideOf(li, e);
      li.classList.toggle('is-drop-after', after);
      li.classList.toggle('is-drop-before', !after);
    });
    li.addEventListener('dragleave', () => unmark(li));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      unmark(li);
      const from = dragFrom;
      dragFrom = -1;
      if (from < 0) return;
      opts.dragging?.(-1);
      if (opts.drop) opts.drop(from, i, sideOf(li, e));
      else opts.move(from, dropTo(from, i));
    });
    // A row a scroll redraws is a new node, so the drop, not the old row's dragend, can be the last event.
    from.addEventListener('dragend', () => {
      dragFrom = -1;
      opts.dragging?.(-1);
    });
  }

  // The browser draws the drag image from a node in the page at dragstart, so the chip shows for that moment only.
  function dragImage(e, text) {
    const chip = el('span', 'pb-chip sode-drag-chip', icon('grip-vertical'), text);
    document.body.append(chip);
    e.dataTransfer.setDragImage(chip, 12, 12);
    setTimeout(() => chip.remove());
  }

  return { row };
}
