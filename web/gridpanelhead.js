// The words in a Grid panel's header. Pure.

// The grid when it has nothing to show on an axis: a new Grid panel starts with no items (docs/panels-design.md).
export function emptyText({ srcs, dsts, canEdit }) {
  if (srcs && dsts) return null;
  const what = !srcs && !dsts ? 'sources or destinations' : !srcs ? 'sources' : 'destinations';
  return {
    title: `This panel shows no ${what}`,
    msg: canEdit ? 'Add them in the editor.' : 'The owner of the panel adds them in the editor.',
    edit: !!canEdit,
  };
}
