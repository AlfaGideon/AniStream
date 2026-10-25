import { useNavigate } from 'react-router-dom';
import type { TitleItem } from '../types';
import { TYPE_LABELS } from '../types';
import { useStore } from '../state/Store';
import { useUI } from '../state/UI';
import Poster from './Poster';

export function ratingColor(r: number): string {
  if (r >= 8.5) return 'bg-emerald-500';
  if (r >= 7.5) return 'bg-lime-600';
  if (r >= 6) return 'bg-amber-500';
  return 'bg-zinc-500';
}

/** Карточка тайтла в духе КиноПоиска: рейтинг, закладка, hover-эффекты, блюр 18+. */
export default function TitleCard({
  item,
  width,
}: {
  item: TitleItem;
  width?: string;
}) {
  const nav = useNavigate();
  const { settings, toggleFav, isFav } = useStore();
  const { ensureAdult, toast } = useUI();

  const open = () => {
    const fn = () => nav(`/title/${item.id}`);
    item.isAdult ? ensureAdult(fn) : fn();
  };

  const w = width ?? (settings.cardSize === 'compact' ? 'w-[140px]' : 'w-[168px]');

  const sub =
    item.type === 'anime'
      ? `${item.year} · ${item.episodesCount ?? '?'} эп.`
      : `${item.year} · ${item.chaptersCount ?? '?'} гл.`;

  return (
    <div className={`group flex-none snap-start ${w}`}>
      <div
        onClick={open}
        className="card-glow relative cursor-pointer overflow-hidden rounded-xl border border-edge bg-card"
      >
        <div className="aspect-[2/3]">
          <Poster item={item} />
        </div>

        {/* Рейтинг */}
        <span
          className={`absolute left-2 top-2 rounded-lg px-1.5 py-0.5 text-xs font-bold text-white shadow-lg ${ratingColor(
            item.rating,
          )}`}
        >
          {item.rating.toFixed(1)}
        </span>

        {/* Закладка */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(item.id);
            toast(isFav(item.id) ? 'Удалено из закладок' : 'Добавлено в закладки');
          }}
          aria-label="В закладки"
          className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg backdrop-blur transition-all ${
            isFav(item.id)
              ? 'bg-accent text-white opacity-100'
              : 'bg-black/45 text-white opacity-0 hover:bg-accent group-hover:opacity-100'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill={isFav(item.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M6 3h12v18l-6-4-6 4Z" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Тип */}
        <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
          {TYPE_LABELS[item.type]}
        </span>
        {item.isAdult && (
          <span className="absolute bottom-2 right-2 rounded-md border border-red-400/50 bg-red-500/30 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            18+
          </span>
        )}

        {/* Hover-панель */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <p className="line-clamp-3 text-[11px] leading-snug text-white/85">{item.description}</p>
        </div>
      </div>

      <div className="mt-2 px-0.5">
        <div
          onClick={open}
          className="line-clamp-2 cursor-pointer text-sm font-semibold leading-tight transition-colors hover:text-accent"
        >
          {item.title}
        </div>
        <div className="mt-0.5 text-xs text-mute">{sub}</div>
      </div>
    </div>
  );
}
