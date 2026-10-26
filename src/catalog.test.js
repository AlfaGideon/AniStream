import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog, findKitsuStreaming, SOURCE_DETAILS } from './catalog.js';

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
  assert.deepEqual(result.items[0].sources, ['AniList', 'MyAnimeList · Jikan']);
  assert.equal(result.hasNext, true);
  assert.deepEqual(result.sources, ['AniList', 'MyAnimeList / Jikan', 'Kitsu']);
  assert.equal(result.health.filter(source => ['AniList','MyAnimeList / Jikan','Kitsu'].includes(source.name)).every(source => source.status === 'ok'), true);
  assert.equal(result.health.find(source => source.name === 'YouTube').status, 'skipped');
  assert.equal(result.health.find(source => source.name === 'VK Видео').status, 'skipped');
});

test('adds YouTube and VK video cards to the shared catalog when local credentials are configured', async t => {
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  const calls=[];
  globalThis.fetch=async (url,options={})=>{
    const href=String(url);calls.push({href,headers:options.headers||{}});
    if(href.includes('graphql.anilist.co'))return response({data:{Page:{pageInfo:{hasNextPage:false},media:[]}}});
    if(href.includes('api.jikan.moe'))return response({data:[],pagination:{has_next_page:false}});
    if(href.includes('kitsu.io'))return response({data:[],included:[],links:{}});
    if(href.includes('youtube/v3/search'))return response({items:[{id:{videoId:'abcdefghijk'},snippet:{title:'Example episode',channelTitle:'Studio',publishedAt:'2024-01-01T00:00:00Z',thumbnails:{high:{url:'https://img.example/video.jpg'}}}}]});
    if(href.includes('api.vk.ru/method/video.search')){assert.equal(options.headers.Authorization,'Bearer test-token');return response({response:{count:1,items:[{id:12,owner_id:-34,title:'Another episode',owner_name:'Channel',duration:125,player:'https://vk.com/video_ext.php?oid=-34&id=12',image:[{url:'https://img.example/vk.jpg'}]}]}});}
    throw new Error(`Unexpected URL ${href}`);
  };
  const result=await searchCatalog({query:'Example title',filter:'Все',page:1,videoCredentials:{youtubeApiKey:'test-key',vkAccessToken:'test-token'}});
  const videos=result.items.filter(item=>item.mediaType==='VIDEO');
  assert.equal(videos.length,2);
  assert.deepEqual(new Set(videos.map(item=>item.source)),new Set(['YouTube','VK Видео']));
  assert.equal(videos.find(item=>item.source==='YouTube').videoEmbedUrl,'https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&rel=0');
  assert.equal(videos.find(item=>item.source==='VK Видео').videoEmbedUrl,'https://vk.com/video_ext.php?oid=-34&id=12');
  assert.ok(calls.some(call=>call.href.includes('key=test-key')));
  const vkCall=calls.find(call=>call.href.includes('api.vk.ru/method/video.search'));
  assert.equal(vkCall.headers.Authorization,'Bearer test-token');
  assert.equal(vkCall.href.includes('test-token'),false);
  assert.equal(result.health.find(source=>source.name==='YouTube').status,'ok');
  assert.equal(result.health.find(source=>source.name==='VK Видео').status,'ok');
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
  assert.deepEqual(result.items[0].sources,['Kitsu']);
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

test('normalizes supported player URLs and rejects deceptive hosts', async () => {
  const { youtubeEmbed, vkEmbed, rutubeEmbed, kodikEmbed, amediaEmbed } = await import('./media-links.js');
  assert.equal(youtubeEmbed('https://youtu.be/1dy2zPPrKD0?t=3'), 'https://www.youtube-nocookie.com/embed/1dy2zPPrKD0?autoplay=1&rel=0');
  assert.equal(youtubeEmbed('https://www.youtube.com/watch?v=1dy2zPPrKD0'), 'https://www.youtube-nocookie.com/embed/1dy2zPPrKD0?autoplay=1&rel=0');
  assert.equal(youtubeEmbed('https://youtube.com.evil.example/watch?v=1dy2zPPrKD0'), '');
  assert.equal(vkEmbed('https://vk.com/video-123_456'), 'https://vk.com/video_ext.php?oid=-123&id=456');
  assert.equal(vkEmbed('https://evil.example/video-123_456'), '');
  assert.equal(rutubeEmbed('https://rutube.ru/video/1a2b3c4d5e6f77889900112233445566/'), 'https://rutube.ru/play/embed/1a2b3c4d5e6f77889900112233445566');
  assert.equal(rutubeEmbed('https://rutube.ru/play/embed/1a2b3c4d5e6f77889900112233445566'), 'https://rutube.ru/play/embed/1a2b3c4d5e6f77889900112233445566');
  assert.equal(rutubeEmbed('https://rutube.ru.evil.example/video/1a2b3c4d5e6f77889900112233445566'), '');
  assert.equal(kodikEmbed('https://kodik.info/serial/123'), 'https://kodik.info/serial/123');
  assert.equal(kodikEmbed('https://player.kodik.biz/embed/123'), 'https://player.kodik.biz/embed/123');
  assert.equal(kodikEmbed('https://kodik.info.evil.example/serial/123'), '');
  assert.equal(amediaEmbed('https://www.amediateka.ru/watch/123'), 'https://www.amediateka.ru/watch/123');
  assert.equal(amediaEmbed('http://amediateka.ru/watch/123'), '');
  assert.equal(amediaEmbed('https://amediateka.ru.evil.example/watch/123'), '');
});

test('builds an in-app VK Video search from a title without requiring a pasted link', async () => {
  const { vkVideoSearchUrl } = await import('./video-search.js');
  const url = new URL(vkVideoSearchUrl('Атака титанов'));
  assert.equal(url.origin, 'https://vk.com');
  assert.equal(url.pathname, '/video');
  assert.equal(url.searchParams.get('q'), 'Атака титанов');
  assert.equal(vkVideoSearchUrl('  '), '');
});

test('shows requested video adapters in the sources list separately from metadata APIs', () => {
  const players = new Map(SOURCE_DETAILS.filter(source => source.group === 'player').map(source => [source.name, source.statusLabel]));
  assert.ok(players.has('VK Видео'));
  assert.ok(players.has('Kodik'));
  assert.ok(players.has('Amediateka'));
  assert.ok(players.has('CDN / MP4 / WebM / HLS'));
  assert.equal(players.has('AniList'), false);
});

test('searches VK by the default anime category without requiring a title query', async t => {
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  let requestUrl='';
  globalThis.fetch=async (url,options={})=>{
    requestUrl=String(url);
    assert.equal(options.headers.Authorization,'Bearer vk-user-token');
    return response({response:{count:1,items:[{id:91,owner_id:-240,title:'Anime from a community',owner_name:'Anime group',duration:80,player:'https://vk.com/video_ext.php?oid=-240&id=91',image:[{url:'https://img.example/anime.jpg'}]}]}});
  };
  const result=await searchCatalog({filter:'Видео',sourceFilter:'VK Видео',videoCredentials:{vkAccessToken:'vk-user-token'}});
  assert.match(requestUrl,/video\.search\?/);
  assert.equal(new URL(requestUrl).searchParams.get('q'),'аниме');
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].source,'VK Видео');
  assert.equal(result.items[0].alt,'Anime group');
  assert.deepEqual(result.sources,['VK Видео']);
  assert.equal(result.health.find(source=>source.name==='VK Видео').status,'ok');
});

test('keeps unsupported video platforms explicit instead of falling back to another source', async t => {
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async()=>{throw new Error('should not fetch an unintegrated platform');};
  const result=await searchCatalog({filter:'Видео',sourceFilter:'Яндекс Видео'});
  assert.deepEqual(result.items,[]);
  assert.deepEqual(result.sources,[]);
  assert.match(result.health.find(source=>source.name==='Яндекс Видео').message,/официальный API/);
});

test('reports VK permission failures as a video-source status instead of “not used” or a catalog crash', async t => {
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async()=>response({error:{error_code:15,error_msg:'Access denied: no video.search permission'}});
  const result=await searchCatalog({filter:'Видео',sourceFilter:'VK Видео',videoQuery:'аниме разрешение api',videoCredentials:{vkAccessToken:'vk-user-token'}});
  assert.equal(result.items.length,0);
  assert.equal(result.health.find(source=>source.name==='VK Видео').status,'error');
  assert.match(result.health.find(source=>source.name==='VK Видео').message,/video\.search permission/);
  assert.match(result.warning,/VK Видео сейчас недоступен/);
});
