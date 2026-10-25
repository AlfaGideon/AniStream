import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog } from './catalog.js';

const response = payload => ({ ok: true, status: 200, json: async () => payload });
const anilistItem = ({ id=1, idMal=77, isAdult=false }={}) => ({
  id, idMal, type: 'ANIME', format: 'TV', siteUrl: `https://anilist.co/anime/${id}`,
  description: '<b>A live catalog description.</b>', episodes: 12, chapters: null, volumes: null,
  averageScore: 88, popularity: 9000, seasonYear: 2024, genres: ['Action'], isAdult,
  bannerImage: null, title: { userPreferred: 'Example title', romaji: 'Example title', english: 'Example' },
  coverImage: { extraLarge: 'https://img.example/cover.jpg', large: null, color: null },
  trailer: null, relations: { edges: [] },
});

test('combines catalogue results and keeps the AniList entry for a shared MAL id', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async url => {
    if (String(url).includes('graphql.anilist.co')) return response({ data: { Page: { pageInfo: { hasNextPage: true }, media: [anilistItem()] } } });
    return response({ data: [{ mal_id: 77, type: 'TV', title: 'Duplicate', title_english: 'Duplicate', year: 2024, score: 8.1, episodes: 12, genres: [], images: { jpg: { image_url: 'https://img.example/mal.jpg' } }, url: 'https://myanimelist.net/anime/77' }], pagination: { has_next_page: true } });
  };
  const result = await searchCatalog({ filter: 'Аниме', page: 1 });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, 'Example title');
  assert.equal(result.items[0].source, 'AniList');
  assert.equal(result.hasNext, true);
  assert.deepEqual(result.sources, ['AniList', 'MyAnimeList / Jikan']);
});

test('adult catalogue is requested only after the adult filter is selected', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    const body = JSON.parse(options.body);
    assert.equal(body.variables.isAdult, true);
    return response({ data: { Page: { pageInfo: { hasNextPage: false }, media: [anilistItem({ id: 3, idMal: null, isAdult: true })] } } });
  };
  const result = await searchCatalog({ filter: '18+', adult: true, page: 1 });
  assert.equal(calls.length, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].isAdult, true);
});

test('returns a useful error if every metadata source is unavailable', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(searchCatalog({ filter: 'Аниме', page: 1 }), /offline/);
});
