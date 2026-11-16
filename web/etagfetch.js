// Wraps a fetcher so repeated GETs send If-None-Match. A 304 comes back as a 200 with the body kept from the last 200,
// so callers (jsonCall) never see it. Tags are per path: one page uses one key and session, so a path has one answer.
export function withEtag(fetcher) {
  const kept = new Map();
  return async (path, init = {}) => {
    const plain = (init.method || 'GET') === 'GET' && !init.headers?.['If-None-Match'];
    if (!plain) return fetcher(path, init);
    const had = kept.get(path);
    const res = await fetcher(path, had ? { ...init, headers: { ...init.headers, 'If-None-Match': had.tag } } : init);
    if (res.status === 304 && had) return new Response(had.body, { status: 200, headers: { 'Content-Type': 'application/json', ETag: had.tag } });
    const tag = res.headers.get('ETag');
    if (res.ok && tag) kept.set(path, { tag, body: await res.clone().text() });
    else kept.delete(path);
    return res;
  };
}
