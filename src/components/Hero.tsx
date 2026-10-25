import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEATURED_IDS, byId } from '../data/catalog';
import { useStore } from '../state/Store';
import { useUI } from '../state/UI';
import { TYPE_LABELS } from '../types';

/** Большая карусель на главной с кен-бёрнс эффектом, трейлерами и автопрокруткой. */
export default function Hero() {
  const nav = useNavigate();
  const { settings } = useStore();
  const { openPlayer, openTrailer } = useUI();
  const slides = FEATURED_IDS.map(byId).filter(Boolean);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setIdx((i) => (i + 1) % slides.length), [slides.length]);

  useEffect(() => {
    if (!settings.autoplayTrailers || paused) return;
    const t = setInterval(next, 9000);
    return () => clearInterval(t);
  }, [next, settings.autoplayTrailers, paused]);

  const item = slides[idx];
  if (!item) return null;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-edge"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Фон */}
      <div className="relative aspect-[16/9] max-h-[560px] w-full sm:aspect-[21/9]">
        {slides.map((s, i) => (
          <div
            key={s!.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
          >
            {s!.backdrop ? (
              <img src={s!.backdrop} alt="" className={`h-full w-full object-cover ${i === idx ? 'anim-kenburns' : ''}`} />
            ) : (
              <img src={s!.poster} alt="" className="h-full w-full scale-110 object-cover blur-2xl" />
            )}
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Контент */}
      <div key={item.id} className="anim-rise absolute inset-0 flex flex-col justify-end p-5 sm:p-10">
        <div className="max-w-2xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
              {TYPE_LABELS[item.type]}
            </span>
            {item.genres.slice(0, 3).map((g) => (
              <span key={g} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 backdrop-blur">
                {g}
              </span>
            ))}
          </div>
          <h1 className="font-display text-balance text-2xl font-bold leading-tight text-white drop-shadow-xl sm:text-4xl lg:text-5xl">
            {item.title}
          </h1>
          <div className="mt-3 flex items-center gap-3 text-sm text-white/80">
            <span className="flex items-center gap-1 font-semibold text-amber-300">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="m12 2 3 6.5 7 .8-5.2 4.7 1.4 6.9L12 17.5 5.8 20.9l1.4-6.9L2 9.3l7-.8Z" /></svg>
              {item.rating.toFixed(1)}
            </span>
            <span>{item.year}</span>
            {item.episodesCount && <span>{item.seasons ? `${item.seasons} сез. · ` : ''}{item.episodesCount} эп.</span>}
            <span className="rounded border border-white/30 px-1.5 py-0.5 text-xs">{item.ageRating}</span>
          </div>
          <p className="mt-3 hidden max-w-xl text-sm leading-relaxed text-white/75 sm:line-clamp-3">
            {item.description}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => openPlayer(item)}
              className="flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7Z" /></svg>
              Смотреть
            </button>
            {item.trailers.length > 0 && (
              <button
                onClick={() => openTrailer(item)}
                className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none" /></svg>
                Трейлер
              </button>
            )}
            <button
              onClick={() => nav(`/title/${item.id}`)}
              className="rounded-xl px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Подробнее
            </button>
          </div>
        </div>
      </div>

      {/* Индикаторы и стрелки */}
      <div className="absolute bottom-5 right-6 flex items-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s!.id}
            onClick={() => setIdx(i)}
            aria-label={`Слайд ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === idx ? 'w-8 bg-accent' : 'w-2.5 bg-white/30 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
      <button
        onClick={() => setIdx((idx - 1 + slides.length) % slides.length)}
        aria-label="Предыдущий"
        className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-accent sm:grid"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        onClick={next}
        aria-label="Следующий"
        className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-accent sm:grid"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m10 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </section>
  );
}
