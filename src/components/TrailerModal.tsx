import { useMemo, useState } from 'react';
import type { TitleItem } from '../types';
import { useStore } from '../state/Store';

/** Модальное окно трейлера: YouTube-вставка (privacy-enhanced) или прямое видео mp4. */
export default function TrailerModal({ item, onClose }: { item: TitleItem; onClose: () => void }) {
  const { settings } = useStore();
  const initial = useMemo(() => {
    const pref = item.trailers.findIndex((t) => t.kind === settings.preferredTrailer);
    return pref >= 0 ? pref : 0;
  }, [item, settings.preferredTrailer]);
  const [sel, setSel] = useState(initial);
  const [loadErr, setLoadErr] = useState(false);
  const trailer = item.trailers[sel];

  const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${item.originalTitle ?? item.title} trailer`,
  )}`;

  return (
    <div className="anim-fade fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="anim-scale w-full max-w-4xl overflow-hidden rounded-2xl border border-edge bg-elev shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-edge px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold sm:text-base">{item.title} — {trailer?.label ?? 'Трейлер'}</div>
          </div>
          {item.trailers.length > 1 && (
            <div className="flex gap-1.5">
              {item.trailers.map((t, i) => (
                <button
                  key={i}
                  onClick={() => { setSel(i); setLoadErr(false); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    i === sel ? 'bg-accent text-white' : 'bg-card text-mute hover:text-ink'
                  }`}
                >
                  {t.kind === 'youtube' ? 'YouTube' : 'HD-видео'}
                </button>
              ))}
            </div>
          )}
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-card" aria-label="Закрыть">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="relative aspect-video w-full bg-black">
          {trailer?.kind === 'youtube' ? (
            <iframe
              key={trailer.src}
              src={`https://www.youtube-nocookie.com/embed/${trailer.src}?autoplay=1&rel=0`}
              title={`${item.title} — трейлер`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : trailer ? (
            <video
              key={trailer.src}
              src={trailer.src}
              controls
              autoPlay
              className="absolute inset-0 h-full w-full"
              onError={() => setLoadErr(true)}
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-mute">Трейлер не найден</div>
          )}
          {loadErr && (
            <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-sm text-white/80">
              Не удалось загрузить видео. Попробуйте другой источник.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-mute">
          <span>
            Источник: {trailer?.kind === 'youtube' ? 'YouTube (youtube-nocookie)' : 'Прямое видео'}
          </span>
          {trailer?.kind === 'youtube' && (
            <a href={ytSearch} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
              Ролик не грузится? Найти на YouTube →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
