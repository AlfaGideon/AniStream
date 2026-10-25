import type { Episode, TitleItem } from '../../types';

/**
 * Контракт источника контента.
 * Каждый парсер (AniLiberty, Shikimori, ReManga, MangaDex и т.д.)
 * реализует этот интерфейс, а агрегатор (AniStream) объединяет результаты
 * в единую модель TitleItem и граф франшиз.
 */
export interface ContentProvider {
  readonly id: string;
  readonly name: string;
  readonly kind: 'anime' | 'manga' | 'mixed';
  readonly adult: boolean;
  /** Поиск тайтлов по строке запроса */
  search(query: string): Promise<TitleItem[]>;
  /** Полная карточка тайтла */
  getTitle(providerId: string): Promise<TitleItem>;
  /** Ссылки на серии/источники воспроизведения */
  getEpisodes(providerId: string): Promise<Episode[]>;
}

export interface ProviderResult {
  provider: string;
  items: TitleItem[];
}
