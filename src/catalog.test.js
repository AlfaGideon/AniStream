import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog, findKitsuStreaming } from './catalog.js';

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
    if (String(url).includes('api.jikan.moe')) return response({ data: [{ mal_id: 77, type: 'TV', title: 'Duplicate', title_english: 'Duplicate', year: 2024, score: 8.1, episodes: 12, genres: [], images: { jpg: { image_url: 'https://img.example/mal.jpg' } }, url: 'https://myanimelist.net/anime/77' }], pagination: { has_next_page: true } });
    return response({ data: [], included: [], links: {} });
  };
  const result = await searchCatalog({ filter: 'Аниме', page: 1 });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, 'Example title');
  assert.equal(result.items[0].source, 'AniList');
  assert.equal(result.hasNext, true);
  assert.deepEqual(result.sources, ['AniList', 'MyAnimeList / Jikan', 'Kitsu']);
  assert.equal(result.health.every(source => source.status === 'ok'), true);
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
  assert.equal(result.health.find(source => source.name === 'Kitsu').status, 'skipped');
});

test('returns a useful error if every metadata source is unavailable', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(searchCatalog({ filter: 'Аниме', page: 1 }), /offline/);
});

test('uses Kitsu public catalog data when it has an entry not returned by the other APIs', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async url => {
    const href=String(url);
    if(href.includes('graphql.anilist.co')) return response({data:{Page:{pageInfo:{hasNextPage:false},media:[]}}});
    if(href.includes('api.jikan.moe')) return response({data:[],pagination:{has_next_page:false}});
    if(href.includes('kitsu.io')) return response({data:[{id:'1555',type:'anime',attributes:{canonicalTitle:'Naruto Shippuden',titles:{en:'Naruto: Shippuden'},posterImage:{large:'https://img.example/kitsu.jpg'},averageRating:'84.07',episodeCount:500,userCount:210000,nsfw:false,youtubeVideoId:'1dy2zPPrKD0',slug:'naruto-shippuden'},relationships:{streamingLinks:{links:{related:'https://kitsu.io/api/edge/anime/1555/streaming-links'}}}}],included:[{id:'44',type:'mappings',attributes:{externalSite:'myanimelist/anime',externalId:'1735'}}],links:{next:null}});
    throw new Error(`Unexpected URL ${href}`);
  };
  const result=await searchCatalog({filter:'Аниме',page:1});
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].source,'Kitsu');
  assert.equal(result.items[0].malId,1735);
  assert.equal(result.items[0].streamingUrl,'https://kitsu.io/api/edge/anime/1555/streaming-links');
});

test('resolves official provider links and normalizes them to HTTPS', async t => {
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async url=>{
    assert.match(String(url),/streaming-links\?include=streamer/);
    return response({data:[{id:'971',attributes:{url:'http://www.crunchyroll.com/naruto',subs:['en'],dubs:['ja']},relationships:{streamer:{data:{id:'3'}}}}],included:[{id:'3',type:'streamers',attributes:{siteName:'Crunchyroll'}}]});
  };
  const links=await findKitsuStreaming({id:'kitsu-anime-1555',kitsuId:'1555',mediaType:'ANIME',streamingUrl:'https://kitsu.io/api/edge/anime/1555/streaming-links?include=streamer'});
  assert.equal(links.length,1);
  assert.equal(links[0].name,'Crunchyroll');
  assert.equal(links[0].url,'https://www.crunchyroll.com/naruto');
  assert.deepEqual(links[0].subs,['en']);
});
