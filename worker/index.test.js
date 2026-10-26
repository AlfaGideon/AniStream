import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { __test as workerTest } from './index.js';

const response = payload => new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
const run = (path, init = {}) => worker.fetch(new Request(`https://worker.example${path}`, init), {}, { waitUntil() {} });

test('health endpoint responds without contacting providers and enables CORS', async () => {
  const result = await run('/api/health', { headers: { Origin: 'capacitor://localhost' } });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), '*');
  assert.deepEqual(await result.json(), { ok: true, service: 'AniStream catalog API' });
});

test('Jikan proxy accepts only catalog paths and enforces safe query limits', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let target;
  globalThis.fetch = async request => { target = new URL(request.url); return response({ data: [] }); };
  const result = await run('/api/jikan/anime?page=99999&limit=999&q=Attack&type=movie');
  assert.equal(result.status, 200);
  assert.equal(target.origin, 'https://api.jikan.moe');
  assert.equal(target.pathname, '/v4/anime');
  assert.equal(target.searchParams.get('page'), '1');
  assert.equal(target.searchParams.get('limit'), '18');
  assert.equal(target.searchParams.get('sfw'), 'true');
  assert.equal(target.searchParams.get('q'), 'Attack');
  assert.equal(target.searchParams.has('type'), false);
  assert.equal((await run('/api/jikan/users')).status, 404);
});

test('Kitsu proxy restricts paths and forwards only catalog query parameters', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let target;
  globalThis.fetch = async request => { target = new URL(request.url); return response({ data: [] }); };
  const result = await run('/api/kitsu/manga?page%5Blimit%5D=18&page%5Boffset%5D=36&filter%5Btext%5D=Chainsaw&admin=true');
  assert.equal(result.status, 200);
  assert.equal(target.origin, 'https://kitsu.io');
  assert.equal(target.pathname, '/api/edge/manga');
  assert.equal(target.searchParams.get('page[limit]'), '18');
  assert.equal(target.searchParams.get('page[offset]'), '36');
  assert.equal(target.searchParams.get('filter[text]'), 'Chainsaw');
  assert.equal(target.searchParams.has('admin'), false);
  assert.equal((await run('/api/kitsu/users')).status, 404);
});

test('AniList proxy allows the catalogue query, but rejects arbitrary GraphQL requests', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let target, body;
  globalThis.fetch = async request => { target = new URL(request.url); body = await request.json(); return response({ data: { Page: { media: [] } } }); };
  const result = await run('/api/anilist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'query { Page(page: 1) { media(type: ANIME) { id } } }', variables: { page: 1 } }),
  });
  assert.equal(result.status, 200);
  assert.equal(target.href, 'https://graphql.anilist.co/');
  assert.equal(body.variables.page, 1);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal((await run('/api/anilist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'mutation { deleteSomething }' }) })).status, 400);
});

test('uses same-origin cache keys and still returns provider data if the edge cache fails', async t => {
  const originalFetch = globalThis.fetch;
  const previousCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (previousCaches) Object.defineProperty(globalThis, 'caches', previousCaches);
    else delete globalThis.caches;
  });
  let cacheUrl = '';
  globalThis.caches = { default: {
    match: async key => { cacheUrl = key.url; throw new Error('cache unavailable'); },
    put: async () => { throw new Error('cache unavailable'); },
  } };
  globalThis.fetch = async () => response({ data: [{ mal_id: 7 }] });
  const result = await run('/api/jikan/anime?page=1');
  assert.equal(result.status, 200);
  assert.equal(new URL(cacheUrl).hostname, 'worker.example');
  assert.match(new URL(cacheUrl).pathname, /^\/_anistream_cache\/api\.jikan\.moe\/v4\/anime$/);
  const postKey = workerTest.cacheKey('https://worker.example/api/anilist', 'https://graphql.anilist.co', 'POST', 'deadbeef');
  assert.equal(new URL(postKey.url).hostname, 'worker.example');
  assert.equal(new URL(postKey.url).searchParams.get('body'), 'deadbeef');
});

test('OPTIONS preflight is handled without contacting providers', async () => {
  const result = await run('/api/anilist', { method: 'OPTIONS' });
  assert.equal(result.status, 204);
  assert.equal(result.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');
});
