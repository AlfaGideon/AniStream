import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Hero from '../components/Hero';
import Rail from '../components/Rail';
import TitleCard from '../components/TitleCard';
import Poster from '../components/Poster';
import { byId, TITLES } from '../data/catalog';
import { useStore } from '../state/Store';
import { useUI } from '../state/UI';

const fmtRemain = (rec: { time: number; duration: number }) => {
  const left = Math.max(0, (rec.duration || 0) - rec.time);
  const m = Math.round(left / 60);
  return m > 0 ? `осталось ~${m} мин` : 'почти закончено';
};

export default function HomePage() {
  const nav = useNavigate();
  const { settings, progress } = useStore();
  const { openPlayer } = useUI();

  const anime = useMemo(
    () => TITLES.filter((t) => t.type === 'anime' && !t.isAdult).sort((a, b) => b.rating - a.rating),
    [],
  );
  const manga = useMemo(
    () => TITLES.filter((t) => t.type === 'manga' && !t.isAdult).sort((a, b) => b.rating - a.rating),
    [],
  );
  const fresh = useMemo(
    () => TITLES.filter((t) => !t.isAdult && t.year >= 2022).sort((a, b) => b.year - a.year || b.rating - a.rating),
    [],
  );
  const novels = useMemo(() => TITLES.filter((t) => t.type === 'ranobe'), []);
  const adult = useMemo(
    () => (settings.showAdult ? TITLES.filter((t) => t.isAdult).sort((a, b) => b.rating - a.rating) : []),
    [settings.showAdult],
  );

  const continueItems = useMemo(
    () =>
      Object.values(progress)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((rec) => ({ rec, item: byId(rec.titleId) }))
        .filter((x) => x.item),
    [progress],
  );

  return (
    <div className="space-y-10 pb-6">
      <Hero />

      {continueItems.length > 0 && (
        <Rail title="Продолжить просмотр">
          {continueItems.map(({ rec, item }) => (
            <div
              key={rec.titleId}
              onClick={() => openPlayer(item!, rec.episode)}
              className="group w-72 flex-none cursor-pointer snap-start"
            >
              <div className="relative overflow-hidden rounded-xl border border-edge">
                <div className="flex gap-3 bg-card p-3">
                  <div className="h-20 w-14 flex-none overflow-hidden rounded-lg">
                    <Poster item={item!} blurred={false} className={item!.isAdult && settings.blurAdult ? 'adult-blur' : ''} />
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="line-clamp-1 text-sm font-semibold group-hover:text-accent">{item!.title}</div>
                    <div className="mt-1 text-xs text-mute">Серия {rec.episode} · {fmtRemain(rec)}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-edge">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${rec.duration ? Math.min(100, (rec.time / rec.duration) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid h-9 w-9 flex-none place-items-center self-center rounded-full bg-accent/15 text-accent transition group-hover:bg-accent group-hover:text-white">
                    <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7Z" /></svg>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Rail>
      )}

      <Rail title="Сейчас в тренде" accent="🔥" linkTo="/catalog?type=anime">
        {anime.map((t) => (
          <TitleCard key={t.id} item={t} />
        ))}
      </Rail>

      {/* Промо-баннер объединения вселенной */}
      <section
        onClick={() => nav('/title/rezero-anime')}
        className="anim-rise group relative cursor-pointer overflow-hidden rounded-2xl border border-edge bg-gradient-to-r from-[var(--accent)] via-fuchsia-600 to-rose-500 p-8 sm:p-10"
      >
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl transition-transform duration-700 group-hover:scale-150" />
        <div className="relative max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/70">Единая вселенная</div>
          <h2 className="font-display mt-2 text-2xl font-bold text-white sm:text-3xl">
            Аниме + манга + ранобэ — в одной карточке франшизы
          </h2>
          <p className="mt-2 text-sm text-white/80">
            Например, у Re:Zero есть сериал, новелла и манга — все связи собраны на странице тайтла.
          </p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition group-hover:bg-white/25">
            Смотреть пример
            <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </section>

      <Rail title="Топ манги" linkTo="/catalog?type=manga">
        {manga.map((t) => (
          <TitleCard key={t.id} item={t} />
        ))}
      </Rail>

      <Rail title="Новинки" linkTo="/catalog?sort=year">
        {fresh.map((t) => (
          <TitleCard key={t.id} item={t} />
        ))}
      </Rail>

      <Rail title="Ранобэ и новеллы" linkTo="/catalog?type=ranobe">
        {novels.map((t) => (
          <TitleCard key={t.id} item={t} />
        ))}
      </Rail>

      {settings.showAdult && adult.length > 0 && (
        <Rail title="Для взрослых" accent="18+">
          {adult.map((t) => (
            <TitleCard key={t.id} item={t} />
          ))}
        </Rail>
      )}
    </div>
  );
}
