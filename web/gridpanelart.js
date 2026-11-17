// The artwork on a Grid panel's names. Pure. An item shows its own artwork, else its Default artwork (panellook.js
// withDefault). Hide text is never read: a name always shows as text.
import { artOf, artBOf, withDefault } from './panellook.js';

// kind is 'source' or 'destination', n a router number, edge the panel's edge and defaults a defaultsBy Map.
// { a, b } is Icon A as artOf gives it (or null) and Icon B (or ''); null when the name has neither.
export function nameArt(edge, kind, n, defaults) {
  const own = edge?.items?.[n] || {};
  const drawn = withDefault({ kind, n, art: own.art, artB: own.artB }, defaults);
  const a = artOf(drawn);
  const b = artBOf(drawn);
  return a || b ? { a, b } : null;
}

// Equal for equal artwork, so a paint changes the node only when it must.
export const nameArtKey = (art) => (art ? `${art.a ? (art.a.icon ? `i:${art.a.icon}` : art.a.id) : ''}|${art.b}` : '');
