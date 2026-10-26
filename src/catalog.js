import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { vkEmbed } from './media-links.js';

const ANILIST_URL = 'https://graphql.anilist.co';
const JIKAN_URL = 'https://api.jikan.moe/v4';
const KITSU_URL = 'https://kitsu.io/api/edge';
const PAGE_SIZE = 18;
const VIDEO_CACHE_TTL = 5 * 60 * 1000;
const videoSearchCache = new Map();

export function catalogProxyUrl(provider,url,base=import.meta.env?.VITE_CATALOG_API_URL||'') {
  const apiBase=String(base||'').trim().replace(/\/+$/,'');
  if(!apiBase)return url;
  const parsed=new URL(url);
  let endpoint='';
  if(provider==='anilist'&&parsed.hostname==='graphql.anilist.co')endpoint='/api/anilist';
  else if(provider==='jikan'&&parsed.hostname==='api.jikan.moe')endpoint=`/api/jikan${parsed.pathname.replace(/^\/v4/,'')}${parsed.search}`;
  else if(provider==='kitsu'&&parsed.hostname==='kitsu.io'&&parsed.pathname.startsWith('/api/edge/'))endpoint=`/api/kitsu${parsed.pathname.replace(/^\/api\/edge/,'')}${parsed.search}`;
  return endpoint?`${apiBase}${endpoint}`:url;
}

function catalogFetch(provider,url,options={}) {
  return fetch(catalogProxyUrl(provider,url),options);
}

const MEDIA_QUERY = `query AniStreamCatalog($page:Int!, $search:String, $type:MediaType, $format:MediaFormat, $isAdult:Boolean!) {
  Page(page:$page, perPage:${PAGE_SIZE}) {
    pageInfo { currentPage hasNextPage total }
    media(search:$search, type:$type, format:$format, isAdult:$isAdult, sort:[POPULARITY_DESC]) {
      id idMal type format siteUrl description(asHtml:false) episodes chapters volumes averageScore popularity seasonYear genres isAdult bannerImage
      title { userPreferred romaji english native }
      coverImage { extraLarge large color }
      trailer { id site }
      relations { edges { relationType(version:2) node { id idMal type format isAdult siteUrl title { userPreferred romaji } coverImage { medium } } } }
    }
  }
}`;

function cleanText(value='') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}
function normalizeTitle(value='') { return cleanText(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
async function cachedVideoSearch(key,run) {
  const cached=videoSearchCache.get(key);
  if(cached&&cached.expires>Date.now())return cached.value;
  const value=await run();
  videoSearchCache.set(key,{value,expires:Date.now()+VIDEO_CACHE_TTL});
  return value;
}

function mapAniList(media) {
  const isNovel = media.type === 'MANGA' && ['NOVEL', 'LIGHT_NOVEL'].includes(media.format);
  const kind = media.type === 'ANIME' ? 'Аниме' : isNovel ? 'Ранобэ' : 'Манга';
  const title = media.title?.userPreferred || media.title?.english || media.title?.romaji || 'Без названия';
  const related = (media.relations?.edges || []).filter(edge => edge.node?.siteUrl && !edge.node.isAdult).slice(0, 8).map(edge => ({
    id: `anilist-${edge.node.id}`,
    title: edge.node.title?.userPreferred || edge.node.title?.romaji || 'Связанная история',
    relation: edge.relationType?.replaceAll('_', ' ').toLowerCase() || 'Связано',
    kind: edge.node.type === 'ANIME' ? 'Аниме' : ['NOVEL', 'LIGHT_NOVEL'].includes(edge.node.format) ? 'Ранобэ' : 'Манга',
    url: edge.node.siteUrl, image: edge.node.coverImage?.medium || '',
  }));
  return {
    id: `anilist-${media.id}`, anilistId: media.id, malId: media.idMal || null,
    title, alt: media.title?.english || media.title?.romaji || title,
    type: media.isAdult ? '18+' : kind, mediaType: media.type, format: media.format,
    year: media.seasonYear || '—', rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : '—',
    episodes: media.type === 'ANIME' ? `${media.episodes || '?'} серий` : `${media.volumes || '?'} томов`,
    genres: media.genres || [], label: media.isAdult ? '18+' : media.averageScore >= 85 ? 'ВЫСОКИЙ РЕЙТИНГ' : kind.toUpperCase(),
    cover: media.coverImage?.extraLarge || media.coverImage?.large || '', banner: media.bannerImage || '',
    description: cleanText(media.description || 'Описание пока не добавлено.'),
    url: media.siteUrl, source: 'AniList', isAdult: Boolean(media.isAdult),
    trailer: media.trailer?.id ? { site: media.trailer.site, id: media.trailer.id } : null,
    relations: related, popularity: media.popularity || 0, titleKey: normalizeTitle(title),
  };
}

function mapJikan(item, kind) {
  const isNovel = ['Novel', 'Light Novel'].includes(item.type);
  const mediaType = kind === 'anime' ? 'ANIME' : 'MANGA';
  const title = item.title_english || item.title || item.title_japanese || 'Без названия';
  return {
    id: `jikan-${kind}-${item.mal_id}`, anilistId: null, malId: item.mal_id,
    title, alt: item.title || title,
    type: isNovel ? 'Ранобэ' : kind === 'anime' ? 'Аниме' : 'Манга', mediaType,
    format: item.type || '', year: item.year || item.published?.from?.slice(0, 4) || '—',
    rating: item.score ? Number(item.score).toFixed(1) : '—',
    episodes: kind === 'anime' ? `${item.episodes || '?'} серий` : `${item.volumes || '?'} томов`,
    genres: (item.genres || []).map(g => g.name),
    label: item.score >= 8.5 ? 'ВЫСОКИЙ РЕЙТИНГ' : kind === 'anime' ? 'АНИМЕ' : isNovel ? 'РАНОБЭ' : 'МАНГА',
    cover: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '', banner: '',
    description: cleanText(item.synopsis || 'Описание пока не добавлено.'),
    url: item.url, source: 'MyAnimeList · Jikan', isAdult: false,
    trailer: item.trailer?.youtube_id ? { site: 'YouTube', id: item.trailer.youtube_id } : null,
    relations: [], popularity: item.members || 0, titleKey: normalizeTitle(title),
  };
}

function mapKitsu(resource, included=[]) {
  const a=resource.attributes||{};
  const isAnime=resource.type==='anime';
  const mediaType=isAnime?'ANIME':'MANGA';
  const subtype=String(a.subtype||'').toLowerCase();
  const isNovel=!isAnime&&['novel','lightnovel','light novel'].includes(subtype);
  const title=a.titles?.en||a.titles?.en_jp||a.canonicalTitle||a.titles?.ja_jp||'Без названия';
  const categoryIds=new Set((resource.relationships?.categories?.data||[]).map(x=>x.id));
  const genres=included.filter(x=>x.type==='categories'&&categoryIds.has(x.id)).map(x=>x.attributes?.title).filter(Boolean).slice(0,5);
  const mappings=included.filter(x=>x.type==='mappings'&&x.attributes?.externalSite?.startsWith('myanimelist/'));
  const malMapping=mappings.find(x=>x.attributes.externalSite===`myanimelist/${isAnime?'anime':'manga'}`);
  const rating=Number(a.averageRating||0);
  return {
    id:`kitsu-${resource.type}-${resource.id}`, kitsuId:resource.id, malId:malMapping?Number(malMapping.attributes.externalId)||null:null,
    anilistId:null, title, alt:a.titles?.en_jp||a.titles?.ja_jp||title,
    type:a.nsfw?'18+':isAnime?'Аниме':isNovel?'Ранобэ':'Манга', mediaType, format:a.subtype||'',
    year:a.startDate?.slice(0,4)||'—', rating:rating?(rating/10).toFixed(1):'—',
    episodes:isAnime?`${a.episodeCount||'?'} серий`:`${a.volumeCount||'?'} томов`,
    genres, label:a.nsfw?'18+':isAnime?'ANIME':isNovel?'РАНОБЭ':'MANGA',
    cover:a.posterImage?.large||a.posterImage?.original||a.posterImage?.medium||'',
    banner:a.coverImage?.large||a.coverImage?.original||'',
    description:cleanText(a.synopsis||a.description||'Описание пока не добавлено.'),
    url:`https://kitsu.io/${isAnime?'anime':'manga'}/${encodeURIComponent(a.slug||resource.id)}`,
    source:'Kitsu', isAdult:Boolean(a.nsfw),
    trailer:a.youtubeVideoId?{site:'YouTube',id:a.youtubeVideoId}:null,
    relations:[], popularity:a.userCount||0, titleKey:normalizeTitle(title),
    streamingUrl:resource.relationships?.streamingLinks?.links?.related||`${KITSU_URL}/${resource.type}/${resource.id}/streaming-links?include=streamer`,
  };
}

async function queryAniList({query,filter,adult,page,signal}) {
  const type=filter==='Аниме'?'ANIME':['Манга','Ранобэ'].includes(filter)?'MANGA':null;
  const format=filter==='Ранобэ'?'NOVEL':null;
  const response=await catalogFetch('anilist',ANILIST_URL,{method:'POST',signal,headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query:MEDIA_QUERY,variables:{page,search:query||null,type,format,isAdult:Boolean(adult)}})});
  if(!response.ok)throw new Error(`AniList ответил ${response.status}`);
  const json=await response.json();
  if(json.errors?.length)throw new Error(json.errors[0].message||'Ошибка AniList API');
  const result=json.data?.Page;
  return {items:(result?.media||[]).map(mapAniList),hasNext:Boolean(result?.pageInfo?.hasNextPage)};
}

async function queryJikan({query,filter,page,signal}) {
  if(filter==='18+'||!['Все','Аниме','Манга','Ранобэ'].includes(filter))return {items:[],hasNext:false};
  const kinds=filter==='Аниме'?['anime']:filter==='Манга'||filter==='Ранобэ'?['manga']:['anime','manga'];
  const results=await Promise.all(kinds.map(async kind=>{
    const params=new URLSearchParams({page:String(page),limit:String(PAGE_SIZE),order_by:'members',sort:'desc',sfw:'true'});
    if(query)params.set('q',query);
    if(filter==='Ранобэ'&&kind==='manga')params.set('type','lightnovel');
    const response=await catalogFetch('jikan',`${JIKAN_URL}/${kind}?${params}`,{signal,headers:{Accept:'application/json'}});
    if(response.status===429)throw new Error('MyAnimeList/Jikan временно ограничил запросы. Подождите несколько секунд.');
    if(!response.ok)throw new Error(`Jikan ответил ${response.status}`);
    const json=await response.json();
    return {items:(json.data||[]).map(item=>mapJikan(item,kind)),hasNext:Boolean(json.pagination?.has_next_page)};
  }));
  return {items:results.flatMap(result=>result.items),hasNext:results.some(result=>result.hasNext)};
}

async function queryKitsu({query,filter,page,signal}) {
  if(filter==='18+'||!['Все','Аниме','Манга','Ранобэ'].includes(filter))return {items:[],hasNext:false};
  const kinds=filter==='Аниме'?['anime']:['Манга','Ранобэ'].includes(filter)?['manga']:['anime','manga'];
  const results=await Promise.all(kinds.map(async kind=>{
    const params=new URLSearchParams({'page[limit]':String(PAGE_SIZE),'page[offset]':String((page-1)*PAGE_SIZE),'sort':'-userCount','include':'categories,mappings'});
    if(query)params.set('filter[text]',query);
    if(filter==='Ранобэ'&&kind==='manga')params.set('filter[subtype]','lightnovel');
    const response=await catalogFetch('kitsu',`${KITSU_URL}/${kind}?${params}`,{signal,headers:{Accept:'application/vnd.api+json'}});
    if(response.status===429)throw new Error('Kitsu временно ограничил запросы. Попробуйте ещё раз через несколько секунд.');
    if(!response.ok)throw new Error(`Kitsu ответил ${response.status}`);
    const json=await response.json();
    return {items:(json.data||[]).map(item=>mapKitsu(item,json.included||[])),hasNext:Boolean(json.links?.next)};
  }));
  return {items:results.flatMap(result=>result.items),hasNext:results.some(result=>result.hasNext)};
}

function videoDuration(seconds=0) {
  const value=Number(seconds)||0;
  if(!value)return 'Видео';
  const hours=Math.floor(value/3600),minutes=Math.floor(value%3600/60),remaining=value%60;
  return hours?`${hours}:${String(minutes).padStart(2,'0')}:${String(remaining).padStart(2,'0')}`:`${minutes}:${String(remaining).padStart(2,'0')}`;
}

async function queryYouTubeVideos({query,apiKey,signal}) {
  const params=new URLSearchParams({part:'snippet',q:query,type:'video',maxResults:'12',safeSearch:'strict',key:apiKey});
  const response=await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`,{signal,headers:{Accept:'application/json'}});
  const json=await response.json();
  if(!response.ok)throw new Error(json.error?.message||`YouTube Data API ответил ${response.status}`);
  return {items:(json.items||[]).filter(entry=>entry.id?.videoId).map(entry=>{
    const id=entry.id.videoId,snippet=entry.snippet||{};
    return {id:`youtube-video-${id}`,title:cleanText(snippet.title||'Видео YouTube'),alt:cleanText(snippet.channelTitle||''),type:'Видео',mediaType:'VIDEO',format:'YouTube',year:snippet.publishedAt?.slice(0,4)||'—',rating:'—',episodes:'Видео',genres:[cleanText(snippet.channelTitle||'YouTube')],label:'YOUTUBE',cover:snippet.thumbnails?.high?.url||snippet.thumbnails?.medium?.url||snippet.thumbnails?.default?.url||'',banner:'',description:cleanText(snippet.description||''),url:`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,videoEmbedUrl:`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`,source:'YouTube',sources:['YouTube'],isAdult:false,trailer:null,relations:[],popularity:0,titleKey:normalizeTitle(snippet.title||id)};
  }),hasNext:false};
}

async function queryVkVideos({query,accessToken,signal}) {
  const params={q:query,v:'5.243',count:'12',sort:'2',adult:'0',extended:'1'};
  const headers={Accept:'application/json',Authorization:`Bearer ${accessToken}`};
  let json,status=200;
  if(Capacitor.isNativePlatform()){
    const response=await CapacitorHttp.get({url:'https://api.vk.ru/method/video.search',params,headers,connectTimeout:15000,readTimeout:20000});
    json=response.data;status=response.status;
  }else{
    const response=await fetch(`https://api.vk.ru/method/video.search?${new URLSearchParams(params)}`,{signal,headers});
    json=await response.json();status=response.status;
  }
  if(status<200||status>=300||json.error){
    const message=json.error?.error_msg||`VK API ответил ${status}`;
    if(Number(json.error?.error_code)===1051||/method is not available for this profile type|method is unavailable with current profile type/i.test(message)){
      const error=new Error('VK ID успешно авторизовал пользователя, но VK API отказал в video.search: тип профиля/токена не поддерживает этот метод (1051). Это ограничение типа ключа VK API, а не VPN и не обычная настройка доступа. Повторный вход или обновление токена не исправят его.');
      error.code='VK_METHOD_PROFILE_UNSUPPORTED';
      throw error;
    }
    if(/access[_ ]token.*(another|different|друг).*ip|ip.*(another|different|друг).*access[_ ]token/i.test(message)){
      const error=new Error('VK привязал access token к другому IP-адресу. Оставьте VPN подключённым к одному серверу и используйте одинаковый маршрут для AniStream и VK ID. Нажмите «Переподключить VK» в настройках и повторите поиск.');
      error.code='VK_TOKEN_IP_MISMATCH';
      throw error;
    }
    throw new Error(message);
  }
  const result=json.response||{};
  return {items:(result.items||[]).filter(video=>video.id&&video.owner_id).map(video=>{
    const id=String(video.id),owner=String(video.owner_id);
    const candidate=video.player||`https://vk.com/video_ext.php?oid=${encodeURIComponent(owner)}&id=${encodeURIComponent(id)}${video.access_key?`&hash=${encodeURIComponent(video.access_key)}`:''}`;
    const player=vkEmbed(candidate);
    const images=video.image||video.first_frame||[];
    return {id:`vk-video-${owner}-${id}`,title:cleanText(video.title||'Видео VK'),alt:cleanText(video.owner_name||''),type:'Видео',mediaType:'VIDEO',format:'VK Видео',year:'—',rating:'—',episodes:videoDuration(video.duration),genres:[cleanText(video.owner_name||'VK Видео')],label:'VK ВИДЕО',cover:images.at?.(-1)?.url||images.at?.(-1)?.with_padding||video.photo_320||'',banner:'',description:cleanText(video.description||''),url:`https://vk.com/video${owner}_${id}`,videoEmbedUrl:player,source:'VK Видео',sources:['VK Видео'],isAdult:false,trailer:null,relations:[],popularity:Number(video.views)||0,titleKey:normalizeTitle(video.title||id)};
  }).filter(video=>video.videoEmbedUrl),hasNext:false};
}

export async function searchCatalog({query='',filter='Все',adult=false,page=1,signal,videoCredentials={},sourceFilter='Все источники',videoQuery='',refreshVkAccessToken=null}) {
  const requests=[];
  const skipped=[];
  const allSources=sourceFilter==='Все источники';
  const catalogSources=allSources||sourceFilter==='Каталоги';
  const metadataAllowed=filter!=='Видео'&&sourceFilter!=='VK Видео'&&sourceFilter!=='YouTube'&&sourceFilter!=='RuTube'&&sourceFilter!=='Яндекс Видео';
  const allowAniList=metadataAllowed&&(catalogSources||sourceFilter==='AniList'||(filter==='18+'&&allSources));
  const allowJikan=metadataAllowed&&filter!=='18+'&&(catalogSources||sourceFilter==='Jikan');
  const allowKitsu=metadataAllowed&&filter!=='18+'&&(catalogSources||sourceFilter==='Kitsu');
  if(allowAniList)requests.push({name:'AniList',run:queryAniList({query,filter,adult:filter==='18+'&&adult,page,signal})});
  if(allowJikan)requests.push({name:'MyAnimeList / Jikan',run:queryJikan({query,filter,page,signal})});
  if(allowKitsu)requests.push({name:'Kitsu',run:queryKitsu({query,filter,page,signal})});

  const allowVideo=filter!=='18+'&&(allSources||sourceFilter==='VK Видео'||sourceFilter==='YouTube');
  const defaultVideoQuery=filter==='Манга'?'аниме манга':'аниме';
  const effectiveVideoQuery=String(query||videoQuery||defaultVideoQuery).trim();
  if(allowVideo&&page===1){
    const allowYouTube=allSources||sourceFilter==='YouTube';
    const allowVk=allSources||sourceFilter==='VK Видео';
    if(allowYouTube){
      if(videoCredentials.youtubeApiKey)requests.push({name:'YouTube',run:cachedVideoSearch(`youtube:${normalizeTitle(effectiveVideoQuery)}`,()=>queryYouTubeVideos({query:effectiveVideoQuery,apiKey:videoCredentials.youtubeApiKey,signal}))});
      else skipped.push({name:'YouTube',status:'skipped',message:'Для карточек YouTube нужен API key; настройте его в настройках источника.'});
    }
    if(allowVk){
      if(videoCredentials.vkAccessToken)requests.push({name:'VK Видео',run:(async()=>{
        const cacheKey=`vk:${normalizeTitle(effectiveVideoQuery)}`;
        try{return await cachedVideoSearch(cacheKey,()=>queryVkVideos({query:effectiveVideoQuery,accessToken:videoCredentials.vkAccessToken,signal}));}
        catch(error){
          if(error.code!=='VK_TOKEN_IP_MISMATCH'||typeof refreshVkAccessToken!=='function')throw error;
          let refreshedToken='';
          try{refreshedToken=await refreshVkAccessToken();}
          catch(refreshError){throw new Error(`${error.message} Автообновление не помогло: ${refreshError.message}`);}
          if(!refreshedToken)throw error;
          return cachedVideoSearch(cacheKey,()=>queryVkVideos({query:effectiveVideoQuery,accessToken:refreshedToken,signal}));
        }
      })()});
      else skipped.push({name:'VK Видео',status:'skipped',message:'Подключите VK ID, чтобы искать видео по категории и названию.'});
    }
  }
  if(sourceFilter==='RuTube')skipped.push({name:'RuTube',status:'skipped',message:'В приложении есть только встроенный плеер RuTube; публичного API поиска карточек не подключено.'});
  if(sourceFilter==='Яндекс Видео')skipped.push({name:'Яндекс Видео',status:'skipped',message:'В приложении не подключён официальный API карточек Яндекс Видео.'});

  const settled=await Promise.all(requests.map(async request=>({name:request.name,result:await Promise.allSettled([request.run]).then(x=>x[0])})));
  const successes=settled.filter(x=>x.result.status==='fulfilled');
  const failed=settled.filter(x=>x.result.status==='rejected');
  if(requests.length&&!successes.length&&requests.some(request=>['AniList','MyAnimeList / Jikan','Kitsu'].includes(request.name)))throw failed[0]?.result.reason||new Error('Подключённые каталоги недоступны.');
  const sourceResults=successes.map(x=>x.result.value);
  const items=[];
  const byMalId=new Map();
  const byTitle=new Map();
  for(const item of sourceResults.flatMap(result=>result.items)){
    item.sources=[...new Set([...(item.sources||[]),item.source].filter(Boolean))];
    if(item.isAdult&&!adult&&filter!=='18+')continue;
    if(filter==='18+'&&!item.isAdult)continue;
    if(filter==='Ранобэ'&&item.type!=='Ранобэ')continue;
    if(filter==='Видео'&&item.mediaType!=='VIDEO')continue;
    const match=item.mediaType==='VIDEO'?null:(item.malId&&byMalId.get(item.malId))||byTitle.get(`${item.mediaType}:${item.titleKey}`);
    if(match){
      match.sources=[...new Set([...(match.sources||[]),...(item.sources||[])])];
      match.streamingUrl ||= item.streamingUrl;
      match.kitsuId ||= item.kitsuId;
      if(!match.cover)match.cover=item.cover;
      if(!match.banner)match.banner=item.banner;
      if(!match.trailer)match.trailer=item.trailer;
      if(!match.genres?.length)match.genres=item.genres;
      if(item.malId)byMalId.set(item.malId,match);
      continue;
    }
    items.push(item);
    if(item.malId)byMalId.set(item.malId,item);
    byTitle.set(`${item.mediaType}:${item.titleKey}`,item);
  }
  items.sort((a,b)=>b.popularity-a.popularity);
  const health=[...settled.map(x=>({name:x.name,status:x.result.status==='fulfilled'?'ok':'error',message:x.result.status==='rejected'?String(x.result.reason?.message||x.result.reason):''})),...skipped];
  if(filter==='18+')health.push({name:'MyAnimeList / Jikan',status:'skipped',message:'18+ запрашивается только из AniList после подтверждения возраста.'},{name:'Kitsu',status:'skipped',message:'Публичный API Kitsu не отдаёт NSFW без авторизации.'});
  return {
    items,hasNext:sourceResults.some(result=>result.hasNext),
    sources:successes.map(x=>x.name),health,
    warning:failed.length?`${failed.map(x=>`${x.name}: ${String(x.result.reason?.message||x.result.reason||'ошибка').slice(0,220)}`).join(' · ')}. Показаны результаты ответивших источников.`:'',
  };
}
export async function findKitsuStreaming(item,signal) {
  if(item.isAdult)return [];
  let resourceId=item.kitsuId;
  let resourceType=item.mediaType==='ANIME'?'anime':'manga';
  if(!resourceId){
    const params=new URLSearchParams({'filter[text]':item.title,'page[limit]':'8','include':'mappings'});
    const response=await catalogFetch('kitsu',`${KITSU_URL}/${resourceType}?${params}`,{signal,headers:{Accept:'application/vnd.api+json'}});
    if(!response.ok)throw new Error(`Kitsu поиск провайдера ответил ${response.status}`);
    const json=await response.json();
    const candidates=json.data||[];
    const matched=item.malId?candidates.find(candidate=>{
      const candidateMappingIds=new Set((candidate.relationships?.mappings?.data||[]).map(ref=>ref.id));
      return (json.included||[]).some(mapping=>mapping.type==='mappings'&&candidateMappingIds.has(mapping.id)&&mapping.attributes?.externalSite===`myanimelist/${resourceType}`&&mapping.attributes?.externalId===String(item.malId));
    })?.id:null;
    const fallback=candidates.find(candidate=>normalizeTitle(candidate.attributes?.canonicalTitle)===normalizeTitle(item.title))||candidates[0];
    resourceId=matched||fallback?.id;
  }
  if(!resourceId)return [];
  const url=item.streamingUrl||`${KITSU_URL}/${resourceType}/${resourceId}/streaming-links?include=streamer`;
  const response=await catalogFetch('kitsu',url,{signal,headers:{Accept:'application/vnd.api+json'}});
  if(!response.ok)throw new Error(`Kitsu-ссылки ответили ${response.status}`);
  const json=await response.json();
  const streamers=new Map((json.included||[]).filter(x=>x.type==='streamers').map(x=>[x.id,x.attributes?.siteName||'Официальный сервис']));
  return (json.data||[]).map(link=>{
    const raw=link.attributes?.url||'';
    const httpsUrl=raw.replace(/^http:/i,'https:');
    const streamerId=link.relationships?.streamer?.data?.id;
    let name=streamers.get(streamerId)||'';
    if(!name){try{name=new URL(httpsUrl).hostname.replace(/^www\./,'');}catch{name='Сервис просмотра';}}
    return {name,url:httpsUrl,subs:link.attributes?.subs||[],dubs:link.attributes?.dubs||[]};
  }).filter(link=>/^https:\/\//i.test(link.url));
}

export const SOURCE_DETAILS=[
  {name:'AniList',group:'catalog',description:'Каталог аниме, манги/ранобэ, рейтинги и связи между форматами. Только метаданные.',url:'https://anilist.co',api:ANILIST_URL},
  {name:'MyAnimeList / Jikan',group:'catalog',description:'Дополнительные карточки и поиск каталога MyAnimeList. Не предоставляет эпизоды.',url:'https://myanimelist.net',api:`${JIKAN_URL}/anime`},
  {name:'Kitsu',group:'catalog',description:'Каталог аниме и манги; иногда публикует официальные страницы сервисов просмотра.',url:'https://kitsu.io',api:`${KITSU_URL}/anime`},
  {name:'YouTube',group:'player',statusLabel:'Нужен Data API key',statusClass:'limited',description:'При настроенном YouTube Data API key поиск видео по названию добавляется в каталог; ролики открываются в встроенном YouTube player.',url:'https://www.youtube.com'},
  {name:'VK Видео',group:'player',statusLabel:'VK ID OAuth',statusClass:'limited',description:'После авторизации через VK ID приложение запрашивает официальный video.search; доступ зависит от прав, разрешённых VK этому приложению.',url:'https://vk.com/video'},
  {name:'RuTube',group:'player',statusLabel:'Embed-парсер',statusClass:'supported',description:'Распознаёт публичные ссылки RuTube и открывает встроенный плеер.',url:'https://rutube.ru'},
  {name:'Kodik',group:'player',statusLabel:'Парсер страницы плеера',statusClass:'limited',description:'Встраивает HTTPS-страницу плеера с домена Kodik; автоматическое сканирование каталога и извлечение потоков не выполняются.',url:'https://kodik.info'},
  {name:'Jitsu / Jutsu',group:'player',statusLabel:'Нет адаптера',statusClass:'limited',description:'В этой сборке нет подтверждённого официального API/embed-интерфейса для автопоиска и воспроизведения.',url:''},
  {name:'Amediateka',group:'player',statusLabel:'Официальный плеер',statusClass:'limited',description:'Встраивает только официальный HTTPS URL; может потребоваться подписка, вход и разрешение сервиса на iframe.',url:'https://www.amediateka.ru'},
  {name:'CDN / MP4 / WebM / HLS',group:'player',statusLabel:'Прямой поток',statusClass:'supported',description:'HTML5 video для прямых MP4/WebM и HLS через hls.js. CDN — доставка потока, а не каталог для поиска.',url:''},
  {name:'Яндекс Видео',group:'player',statusLabel:'Агрегатор поиска',statusClass:'limited',description:'Индексирует страницы разных сайтов; сам не предоставляет единый поток или embed-плеер.',url:'https://yandex.ru/video'},
];
