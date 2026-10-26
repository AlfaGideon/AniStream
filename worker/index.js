const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const CACHE_SECONDS = 600;
const MAX_BODY_BYTES = 64 * 1024;

function responseJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function cacheKey(url, method = 'GET', body = '') {
  const normalized = new URL(url);
  normalized.hostname = 'anistream-catalog-cache.invalid';
  normalized.protocol = 'https:';
  if (method === 'POST') normalized.pathname = `/anilist/${body}`;
  return new Request(normalized.toString(), { method: 'GET' });
}

async function digest(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function cachedFetch(request, ctx, key, ttl = CACHE_SECONDS) {
  const cache = globalThis.caches?.default;
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  const upstream = await fetch(request);
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=86400`);
  headers.delete('Set-Cookie');
  const response = new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
  if (cache && response.ok) {
    const copy = response.clone();
    if (ctx?.waitUntil) ctx.waitUntil(cache.put(key, copy));
    else await cache.put(key, copy);
  }
  return response;
}

function proxyError(error) {
  return responseJson({ error: 'upstream_unavailable', message: String(error?.message || 'Catalog provider unavailable').slice(0, 240) }, 502);
}

function safePage(value) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page >= 1 && page <= 500 ? String(page) : '1';
}

function safeText(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

function jikanRequest(url) {
  const match = url.pathname.match(/^\/api\/jikan\/(anime|manga)$/);
  if (!match) return null;
  const query = new URLSearchParams();
  query.set('page', safePage(url.searchParams.get('page')));
  query.set('limit', String(Math.min(18, Math.max(1, Number(url.searchParams.get('limit')) || 18))));
  query.set('order_by', 'members');
  query.set('sort', 'desc');
  query.set('sfw', 'true');
  const q = safeText(url.searchParams.get('q'));
  if (q) query.set('q', q);
  if (match[1] === 'manga' && url.searchParams.get('type') === 'lightnovel') query.set('type', 'lightnovel');
  return new Request(`https://api.jikan.moe/v4/${match[1]}?${query}`, { headers: { Accept: 'application/json' } });
}

function kitsuRequest(url) {
  const match = url.pathname.match(/^\/api\/kitsu\/(anime|manga)(?:\/(\d+)\/streaming-links)?$/);
  if (!match) return null;
  const resource = match[2]
    ? `/${match[1]}/${match[2]}/streaming-links`
    : `/${match[1]}`;
  const query = new URLSearchParams();
  if (match[2]) {
    query.set('include', 'streamer');
  } else {
    query.set('page[limit]', String(Math.min(18, Math.max(1, Number(url.searchParams.get('page[limit]')) || 18))));
    const offset = Number(url.searchParams.get('page[offset]')) || 0;
    query.set('page[offset]', String(Math.min(9000, Math.max(0, Math.floor(offset / 18) * 18))));
    query.set('sort', '-userCount');
    query.set('include', 'categories,mappings');
    const text = safeText(url.searchParams.get('filter[text]'));
    if (text) query.set('filter[text]', text);
    if (match[1] === 'manga' && url.searchParams.get('filter[subtype]') === 'lightnovel') query.set('filter[subtype]', 'lightnovel');
  }
  return new Request(`https://kitsu.io/api/edge${resource}?${query}`, { headers: { Accept: 'application/vnd.api+json' } });
}

async function handleAnilist(request, ctx) {
  if (request.method !== 'POST') return responseJson({ error: 'method_not_allowed' }, 405);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) return responseJson({ error: 'request_too_large' }, 413);
  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return responseJson({ error: 'request_too_large' }, 413);
  let payload;
  try { payload = JSON.parse(body); } catch { return responseJson({ error: 'invalid_json' }, 400); }
  if (typeof payload.query !== 'string' || !payload.query.includes('Page(') || !payload.query.includes('media(')) {
    return responseJson({ error: 'unsupported_query' }, 400);
  }
  if (Number(payload.variables?.page || 1) > 500) return responseJson({ error: 'invalid_page' }, 400);
  const key = cacheKey('https://anilist.co/api', 'POST', await digest(body));
  try {
    const upstream = new Request('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    });
    return await cachedFetch(upstream, ctx, key, 600);
  } catch (error) {
    return proxyError(error);
  }
}

async function handleProvider(request, ctx, upstreamRequest, url) {
  if (request.method !== 'GET') return responseJson({ error: 'method_not_allowed' }, 405);
  const key = cacheKey(upstreamRequest.url);
  try {
    return await cachedFetch(upstreamRequest, ctx, key);
  } catch (error) {
    return proxyError(error);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));
    if (url.pathname === '/api/health') return withCors(responseJson({ ok: true, service: 'AniStream catalog API' }));
    if (url.pathname === '/api/anilist') return withCors(await handleAnilist(request, ctx));
    if (request.method !== 'GET') return withCors(responseJson({ error: 'method_not_allowed' }, 405));
    const jikan = jikanRequest(url);
    if (jikan) return withCors(await handleProvider(request, ctx, jikan, url));
    const kitsu = kitsuRequest(url);
    if (kitsu) return withCors(await handleProvider(request, ctx, kitsu, url));
    return withCors(responseJson({ error: 'not_found' }, 404));
  },
};

export const __test = { jikanRequest, kitsuRequest, safePage, withCors };
