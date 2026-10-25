export type MediaType = 'anime' | 'manga' | 'ranobe';

export type AgeRating = '0+' | '12+' | '16+' | '18+';

export type TitleStatus = 'ongoing' | 'completed' | 'announced';

export type RelationKind =
  | 'source' // первоисточник (у этого тайтла есть первоисточник — id)
  | 'adaptation' // адаптация (id — экранизация этого тайтла)
  | 'sequel'
  | 'prequel'
  | 'spinoff';

export interface Relation {
  id: string;
  kind: RelationKind;
}

export interface Trailer {
  /** youtube — id ролика; video — прямая ссылка на mp4 */
  kind: 'youtube' | 'video';
  src: string;
  label: string;
}

export interface TitleItem {
  id: string;
  franchise: string;
  type: MediaType;
  title: string;
  originalTitle?: string;
  poster?: string;
  backdrop?: string;
  rating: number;
  ratingsCount: number;
  year: number;
  genres: string[];
  description: string;
  status: TitleStatus;
  ageRating: AgeRating;
  isAdult?: boolean;
  /** anime */
  seasons?: number;
  episodesCount?: number;
  /** manga / ranobe */
  chaptersCount?: number;
  studio?: string;
  author?: string;
  relations: Relation[];
  trailers: Trailer[];
}

export interface Episode {
  num: number;
  name: string;
  durationMin: number;
  src: string;
}

export interface Settings {
  theme: 'dark' | 'dim' | 'light';
  accent: string;
  /** показывать раздел 18+ */
  showAdult: boolean;
  /** блюрить обложки 18+ */
  blurAdult: boolean;
  cardSize: 'compact' | 'cozy';
  autoplayTrailers: boolean;
  preferredTrailer: 'youtube' | 'video';
  defaultQuality: string;
  defaultSpeed: number;
  defaultVolume: number;
  autoplayNext: boolean;
}

export interface ProgressRec {
  titleId: string;
  episode: number;
  time: number;
  duration: number;
  updatedAt: number;
}

export interface ReadingRec {
  titleId: string;
  chapter: number;
  page: number;
  updatedAt: number;
}

export const RELATION_LABELS: Record<RelationKind, string> = {
  source: 'Первоисточник',
  adaptation: 'Адаптация',
  sequel: 'Продолжение',
  prequel: 'Приквел',
  spinoff: 'Спин-офф',
};

export const TYPE_LABELS: Record<MediaType, string> = {
  anime: 'Аниме',
  manga: 'Манга',
  ranobe: 'Ранобэ',
};

export const STATUS_LABELS: Record<TitleStatus, string> = {
  ongoing: 'Онгоинг',
  completed: 'Завершён',
  announced: 'Анонсирован',
};
