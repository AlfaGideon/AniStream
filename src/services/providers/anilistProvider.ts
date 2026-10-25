import type { ContentProvider } from './types';
import type { Episode, TitleItem } from '../../types';

/**
 * Шаблон реального провайдера — AniList GraphQL API (https://anilist.co).
 * Публичный API, CORS открыт, ключ не нужен: его можно вызывать прямо из браузера.
 *
 * Чтобы включить в продакшене:
 *  1. Реализуйте маппинг ответа в TitleItem (см. mapMedia ниже).
 *  2. Зарегистрируйте провайдера в services/providers/registry.ts рядом с mockProvider.
 *  3. Для манги/ранобэ аналогично подключаются MangaDex / Shikimori GraphQL.
 *
 * Поле `isAdult` в ответе AniList позволяет честно заполнять наш 18+ фильтр.
 */

const QUERY = `
query ($search: String) {
  Page(perPage: 20) {
    media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
      id
      isAdult
      title { romaji english native }
      coverImage { extraLarge }
      averageScore
      seasonYear
      episodes
      genres
      description(asHtml: false)
      trailer { site id }
    }
  }
}`;

function mapMedia(m: Record<string, any>): TitleItem {
  const trailer =
    m.trailer?.site === 'youtube'
      ? [{ kind: 'youtube' as const, src: String(m.trailer.id), label: 'Трейлер (YouTube)' }]
      : [];
  return {
    id: `anilist-${m.id}`,
    franchise: `anilist-${m.id}`,
    type: 'anime',
    title: m.title?.russian ?? m.title?.english ?? m.title?.romaji ?? 'Без названия',
    originalTitle: m.title?.romaji,
    poster: m.coverImage?.extraLarge,
    rating: (m.averageScore ?? 0) / 10,
    ratingsCount: 0,
    year: m.seasonYear ?? 0,
    genres: m.genres ?? [],
    description: (m.description ?? '').replace(/<[^>]+>/g, ''),
    status: 'completed',
    ageRating: m.isAdult ? '18+' : '16+',
    isAdult: !!m.isAdult,
    episodesCount: m.episodes ?? undefined,
    relations: [],
    trailers: trailer,
  };
}

async function gql(search: string): Promise<TitleItem[]> {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { search } }),
  });
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const json = await res.json();
  return (json.data?.Page?.media ?? []).map(mapMedia);
}

/** Готовый к регистрации провайдер (по умолчанию в демо не активен). */
export const anilistProvider: ContentProvider = {
  id: 'anilist',
  name: 'AniList',
  kind: 'anime',
  adult: true,
  search: (query) => gql(query),
  async getTitle(): Promise<TitleItem> {
    throw new Error('AniList: getTitle будет реализован при подключении боевого API');
  },
  async getEpisodes(): Promise<Episode[]> {
    // AniList не отдаёт видео — только метаданные. Источники эпизодов
    // берутся из видео-провайдеров (kodik/anilibria парсеры).
    return [];
  },
};
