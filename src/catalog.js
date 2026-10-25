const ANILIST_URL = 'https://graphql.anilist.co';
const JIKAN_URL = 'https://api.jikan.moe/v4';
const PAGE_SIZE = 18;

const MEDIA_QUERY = `query AniStreamCatalog($page:Int!, $search:String, $type:MediaType, $format:[MediaFormat], $isAdult:Boolean!) {
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

const JIKAN_QUERY = `anime,manga,novel,lightnovel,manhwa,manhua`;

function text(value='') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
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
    url: edge.node.siteUrl,
    image: edge.node.coverImage?.medium || '',
  }));
  return {
    id: `anilist-${media.id}`, anilistId: media.id, malId: media.idMal || null,
    title, alt: media.title?.english || media.title?.romaji || title,
    type: media.isAdult ? '18+' : kind, mediaType: media.type, format: media.format,
    year: media.seasonYear || '—', rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : '—',
    episodes: media.type === 'ANIME' ? `${media.episodes || '?'} серий` : `${media.volumes || '?'} томов`,
    genres: media.genres || [], label: media.isAdult ? '18+' : media.averageScore >= 85 ? 'ВЫСОКИЙ РЕЙТИНГ' : kind.toUpperCase(),
    cover: media.coverImage?.extraLarge || media.coverImage?.large || '', banner: media.bannerImage || '',
    description: text(media.description || 'Описание пока не добавлено.'),
    url: media.siteUrl, source: 'AniList', isAdult: Boolean(media.isAdult),
    trailer: media.trailer?.id ? { site: media.trailer.site, id: media.trailer.id } : null,
    relations: related, popularity: media.popularity || 0,
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
    description: text(item.synopsis || 'Описание пока не добавлено.'),
    url: item.url, source: 'MyAnimeList · Jikan', isAdult: false,
    trailer: item.trailer?.youtube_id ? { site: 'YouTube', id: item.trailer.youtube_id } : null,
    relations: [], popularity: item.members || 0,
  };
}

async function queryAniList({ query, filter, adult, page, signal }) {
  const type = filter === 'Аниме' ? 'ANIME' : ['Манга', 'Ранобэ'].includes(filter) ? 'MANGA' : null;
  const format = filter === 'Ранобэ' ? ['NOVEL'] : null;
  const variables = { page, search: query || null, type, format, isAdult: Boolean(adult) };
  const response = await fetch(ANILIST_URL, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: MEDIA_QUERY, variables }),
  });
  if (!response.ok) throw new Error(`AniList ответил ${response.status}`);
  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors[0].message || 'Ошибка AniList API');
  const result = json.data?.Page;
  return { items: (result?.media || []).map(mapAniList), hasNext: Boolean(result?.pageInfo?.hasNextPage) };
}

async function queryJikan({ query, filter, page, signal }) {
  if (filter === '18+' || !['Все', 'Аниме', 'Манга', 'Ранобэ'].includes(filter)) return { items: [], hasNext: false };
  const kinds = filter === 'Аниме' ? ['anime'] : filter === 'Манга' || filter === 'Ранобэ' ? ['manga'] : ['anime', 'manga'];
  const results = await Promise.all(kinds.map(async kind => {
    const params = new URLSearchParams({ page: String(page), limit: '18', order_by: 'members', sort: 'desc', sfw: 'true' });
    if (query) params.set('q', query);
    if (filter === 'Ранобэ' && kind === 'manga') params.set('type', 'lightnovel');
    const response = await fetch(`${JIKAN_URL}/${kind}?${params}`, { signal, headers: { Accept: 'application/json' } });
    if (response.status === 429) throw new Error('MyAnimeList/Jikan временно ограничил запросы. Подождите несколько секунд.');
    if (!response.ok) throw new Error(`Jikan ответил ${response.status}`);
    const json = await response.json();
    return { items: (json.data || []).map(item => mapJikan(item, kind)), hasNext: Boolean(json.pagination?.has_next_page) };
  }));
  return { items: results.flatMap(result => result.items), hasNext: results.some(result => result.hasNext) };
}

export async function searchCatalog({ query='', filter='Все', adult=false, page=1, signal }) {
  const tasks = [queryAniList({ query, filter, adult: filter === '18+' ? true : false, page, signal })];
  if (filter !== '18+') tasks.push(queryJikan({ query, filter, page, signal }));
  const results = await Promise.allSettled(tasks);
  const failed = results.filter(result => result.status === 'rejected');
  const successes = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  if (!successes.length) throw failed[0]?.reason || new Error('Источники временно недоступны.');

  const byMalId = new Map();
  const items = [];
  for (const item of successes.flatMap(result => result.items)) {
    if (item.isAdult && !adult && filter !== '18+') continue;
    if (filter === '18+' && !item.isAdult) continue;
    if (filter === 'Ранобэ' && item.type !== 'Ранобэ') continue;
    const existing = item.malId ? byMalId.get(item.malId) : null;
    if (existing) {
      if (item.source === 'AniList') {
        const index = items.indexOf(existing);
        if (index >= 0) items[index] = item;
        byMalId.set(item.malId, item);
      }
      continue;
    }
    items.push(item);
    if (item.malId) byMalId.set(item.malId, item);
  }
  items.sort((a, b) => b.popularity - a.popularity);
  return {
    items,
    hasNext: successes.some(result => result.hasNext),
    sources: successes.length === 2 ? ['AniList', 'MyAnimeList / Jikan'] : [successes[0].items[0]?.source || 'AniList'],
    warning: failed.length ? 'Часть источников сейчас недоступна; показаны результаты подключённых источников.' : '',
  };
}

export const SOURCE_DETAILS = [
  { name: 'AniList', description: 'Аниме, манга, ранобэ, рейтинги и связи между форматами', url: 'https://anilist.co', api: 'https://graphql.anilist.co' },
  { name: 'MyAnimeList через Jikan', description: 'Независимый REST API каталога MyAnimeList; только безопасные для просмотра карточки', url: 'https://myanimelist.net', api: 'https://api.jikan.moe/v4' },
  { name: 'YouTube', description: 'Официальные трейлеры — поиск или встроенный ролик, если источник предоставляет ID', url: 'https://www.youtube.com' },
];
