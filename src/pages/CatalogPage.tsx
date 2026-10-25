import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TitleCard from '../components/TitleCard';
import { ALL_GENRES, TITLES } from '../data/catalog';
import { useStore } from '../state/Store';
import { TYPE_LABELS } from '../types';
import type { MediaType } from '../types';

type Sort = 'rating' | 'year' | 'name';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'rating', label: 'По рейтингу' },
  { id: 'year', label: 'По новизне' },
  { id: 'name', label: 'По алфавиту' },
];

export default function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const { settings, favs } = useStore();
  const [genres, setGenres] = useState<string[]>(() => {
    const g = params.get('genre');
    return g ? [g] : [];
  });

  const type = (params.get('type') ?? 'all') as MediaType | 'all';
  const q = params.get('q') ?? '';
  const favOnly = params.get('fav') === '1';
  const adultOnly = params.get('adult') === '1';
  const sort = (params.get('sort') ?? 'rating') as Sort;

  const patchParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === '' || v === 'all') next.delete(k);
      else next.set(k, v);
    });
    setParams(next, { replace: true });
  };

  const items = useMemo(() => {
    let list = TITLES.filter((t) => (settings.showAdult ? true : !t.isAdult));
    if (favOnly) list = list.filter((t) => favs.includes(t.id));
    if (adultOnly) list = list.filter((t) => t.isAdult);
    if (type !== 'all') list = list.filter((t) => t.type === type);
    if (genres.length) list = list.filter((t) => genres.every((g) => t.genres.includes(g)));
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(s) || t.originalTitle?.toLowerCase().includes(s),
      );
    }
    return [...list].sort((a, b) =>
      sort === 'rating' ? b.rating - a.rating : sort === 'year' ? b.year - a.year : a.title.localeCompare(b.title, 'ru'),
    );
  }, [type, genres, q, favOnly, adultOnly, sort, settings.showAdult, favs]);

  const toggleGenre = (g: string) =>
    setGenres((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  const gridClass =
    settings.cardSize === 'compact'
      ? 'grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4'
      : 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5';

  return (
    <div className="anim-rise pb-6">
      {/* Шапка каталога */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          {favOnly ? 'Мои закладки' : adultOnly ? 'Раздел 18+' : 'Каталог'}
        </h1>
        <span className="rounded-lg bg-elev px-2.5 py-1 text-sm font-semibold text-mute">
          {items.length}
        </span>
        {q && (
          <span className="rounded-lg bg-accent/15 px-3 py-1 text-sm font-medium text-accent">
            «{q}»
            <button onClick={() => patchParams({ q: null })} className="ml-2 opacity-70 hover:opacity-100">✕</button>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {SORTS.map((s) => (
            <button
              key={s.id}
              data-active={sort === s.id}
              onClick={() => patchParams({ sort: s.id })}
              className="seg-btn rounded-lg border border-edge bg-elev px-3 py-2 text-xs font-semibold"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Типы */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(['all', 'anime', 'manga', 'ranobe'] as const).map((tp) => (
          <button
            key={tp}
            data-active={type === tp}
            onClick={() => patchParams({ type: tp })}
            className="seg-btn rounded-xl border border-edge bg-elev px-4 py-2 text-sm font-semibold"
          >
            {tp === 'all' ? 'Все типы' : TYPE_LABELS[tp]}
          </button>
        ))}
        {settings.showAdult && (
          <button
            data-active={adultOnly}
            onClick={() => patchParams({ adult: adultOnly ? null : '1' })}
            className="seg-btn rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400"
          >
            18+
          </button>
        )}
      </div>

      {/* Жанры */}
      <div className="mb-8 flex flex-wrap gap-2">
        {ALL_GENRES.map((g) => (
          <button
            key={g}
            data-active={genres.includes(g)}
            onClick={() => toggleGenre(g)}
            className="seg-btn rounded-full border border-edge bg-elev px-3 py-1.5 text-xs font-medium"
          >
            {g}
          </button>
        ))}
        {genres.length > 0 && (
          <button onClick={() => setGenres([])} className="rounded-full px-3 py-1.5 text-xs font-semibold text-mute transition hover:text-accent">
            Сбросить
          </button>
        )}
      </div>

      {/* Сетка */}
      {items.length ? (
        <div className={`grid ${gridClass}`}>
          {items.map((t) => (
            <TitleCard key={t.id} item={t} width="w-full" />
          ))}
        </div>
      ) : (
        <div className="grid place-items-center rounded-2xl border border-dashed border-edge py-24 text-center">
          <div>
            <div className="font-display mb-2 text-4xl">(╥﹏╥)</div>
            <div className="text-lg font-semibold">Ничего не найдено</div>
            <p className="mt-1 text-sm text-mute">Попробуйте ослабить фильтры или изменить запрос</p>
            <button
              onClick={() => {
                setGenres([]);
                setParams({}, { replace: true });
              }}
              className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
            >
              Сбросить все фильтры
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
