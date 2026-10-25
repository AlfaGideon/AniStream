import { episodesFor, TITLES } from '../../data/catalog';
import type { Episode, TitleItem } from '../../types';
import type { ContentProvider } from './types';

/**
 * Локальный демо-провайдер: работает офлайн, служит эталоном формата данных
 * и заглушкой, пока сетевые парсеры не подключены.
 */
export const mockProvider: ContentProvider = {
  id: 'mock',
  name: 'AniStream Demo',
  kind: 'mixed',
  adult: true,

  async search(query: string): Promise<TitleItem[]> {
    const q = query.trim().toLowerCase();
    if (!q) return TITLES;
    return TITLES.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.originalTitle?.toLowerCase().includes(q) ||
        t.genres.some((g) => g.toLowerCase().includes(q)),
    );
  },

  async getTitle(id: string): Promise<TitleItem> {
    const item = TITLES.find((t) => t.id === id);
    if (!item) throw new Error(`Тайтл не найден: ${id}`);
    return item;
  },

  async getEpisodes(id: string): Promise<Episode[]> {
    const item = TITLES.find((t) => t.id === id);
    if (!item) return [];
    return episodesFor(item);
  },
};
