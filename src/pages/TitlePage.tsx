import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Poster from '../components/Poster';
import TitleCard, { ratingColor } from '../components/TitleCard';
import { byId, episodesFor, franchiseTitles } from '../data/catalog';
import { useStore } from '../state/Store';
import { useUI } from '../state/UI';
import { RELATION_LABELS, STATUS_LABELS, TYPE_LABELS } from '../types';

type Tab = 'overview' | 'episodes' | 'relations' | 'trailers';

const ratingWord = (r: number) => (r >= 9 ? 'Шедевр' : r >= 8 ? 'Отлично' : r >= 7 ? 'Хорошо' : r >= 6 ? 'Неплохо' : 'Спорно');
const fmtNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} тыс.` : String(n));

export default function TitlePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const item = id ? byId(id) : undefined;
  const { settings, isFav, toggleFav, progress, reading } = useStore();
  const ui = useUI();
  const [tab, setTab] = useState<Tab>('overview');

  const episodes = useMemo(() => (item?.type === 'anime' ? episodesFor(item) : []), [item]);
  const franchise = useMemo(() => (item ? franchiseTitles(item.franchise).filter((x) => x.id !== item.id) : []), [item]);

  if (!item) {
    return (
      <div className="grid place-items-center py-32 text-center">
        <div>
          <div className="font-display mb-3 text-5xl">404</div>
          <p className="text-mute">Тайтл не найден</p>
          <Link to="/" className="mt-4 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white">
            На главную
          </Link>
        </div>
      </div>
    );
  }

  // Взрослый тайтл, но раздел выключен — уводим в настройки
  if (item.isAdult && !settings.showAdult) {
    return (
      <div className="grid place-items-center py-32 text-center">
        <div>
          <div className="font-display mb-3 text-4xl text-red-400">18+</div>
          <p className="max-w-sm text-mute">Этот тайтл относится ко взрослому разделу. Включите его в настройках и подтвердите возраст.</p>
          <button onClick={ui.openSettings} className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white">
            Открыть настройки
          </button>
        </div>
      </div>
    );
  }

  const rec = progress[item.id];
  const read = reading[item.id];
  const isAnime = item.type === 'anime';
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Обзор' },
    isAnime
      ? { id: 'episodes', label: `Серии (${episodes.length}+)` }
      : { id: 'episodes', label: `Главы (${item.chaptersCount ?? 0})` },
    { id: 'relations', label: `Связи (${item.relations.length + franchise.length})` },
    { id: 'trailers', label: `Трейлеры (${item.trailers.length})` },
  ];

  return (
    <div className="anim-rise pb-6">
      {/* Баннер */}
      <div className="relative -mx-4 -mt-4 sm:-mx-6">
        <div className="h-[320px] w-full overflow-hidden sm:h-[420px]">
          {(item.backdrop ?? item.poster) ? (
            <img
              src={item.backdrop ?? item.poster}
              alt=""
              className={`h-full w-full object-cover ${!item.backdrop ? 'scale-125 blur-2xl' : ''} ${
                item.isAdult && settings.blurAdult ? 'adult-blur' : ''
              }`}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-card to-elev" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/40 to-transparent" />
        </div>
      </div>

      {/* Основной блок */}
      <div className="relative -mt-40 flex flex-col gap-6 sm:-mt-48 md:flex-row">
        {/* Постер */}
        <div className="mx-auto w-48 flex-none md:mx-0 md:w-64">
          <div className="card-glow overflow-hidden rounded-2xl border border-edge shadow-2xl">
            <div className="aspect-[2/3]">
              <Poster item={item} />
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {isAnime ? (
              <button
                onClick={() => ui.openPlayer(item, rec?.episode ?? 1)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7Z" /></svg>
                {rec ? `Продолжить: серия ${rec.episode}` : 'Смотреть'}
              </button>
            ) : (
              <button
                onClick={() => nav(`/read/${item.id}?ch=${read?.chapter ?? 1}`)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Zm0 0v14" strokeLinejoin="round" /></svg>
                {read ? `Продолжить: глава ${read.chapter}` : 'Читать'}
              </button>
            )}
            {item.trailers.length > 0 && (
              <button
                onClick={() => ui.openTrailer(item)}
                className="w-full rounded-xl border border-edge bg-elev px-5 py-3 text-sm font-semibold transition hover:border-accent"
              >
                Смотреть трейлер
              </button>
            )}
            <button
              onClick={() => {
                toggleFav(item.id);
                ui.toast(isFav(item.id) ? 'Удалено из закладок' : 'Добавлено в закладки');
              }}
              className={`w-full rounded-xl border px-5 py-3 text-sm font-semibold transition ${
                isFav(item.id)
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-edge bg-elev hover:border-accent'
              }`}
            >
              {isFav(item.id) ? '✓ В закладках' : '+ В закладки'}
            </button>
          </div>
        </div>

        {/* Информация */}
        <div className="min-w-0 flex-1 pt-2 md:pt-40">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mute">
            {TYPE_LABELS[item.type]}
            {item.originalTitle && <span className="normal-case tracking-normal">· {item.originalTitle}</span>}
            {item.isAdult && <span className="rounded-md bg-red-500/20 px-2 py-0.5 font-bold text-red-400">18+</span>}
          </div>
          <h1 className="font-display text-balance mt-2 text-2xl font-bold leading-tight sm:text-4xl">{item.title}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {item.genres.map((g) => (
              <Link
                key={g}
                to={`/catalog?genre=${encodeURIComponent(g)}`}
                className="rounded-full border border-edge bg-elev px-3 py-1.5 text-xs font-medium transition hover:border-accent hover:text-accent"
              >
                {g}
              </Link>
            ))}
          </div>

          {/* Рейтинг */}
          <div className="mt-6 flex flex-wrap items-center gap-5 rounded-2xl border border-edge bg-elev/80 p-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl text-xl font-black text-white ${ratingColor(item.rating)}`}>
                {item.rating.toFixed(1)}
              </span>
              <div>
                <div className="font-display text-sm font-bold">{ratingWord(item.rating)}</div>
                <div className="text-xs text-mute">{fmtNum(item.ratingsCount)} оценок</div>
              </div>
            </div>
            <div className="hidden h-10 w-px bg-edge sm:block" />
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:flex sm:gap-8">
              <Meta label="Год" value={String(item.year)} />
              <Meta label="Статус" value={STATUS_LABELS[item.status]} />
              {isAnime ? (
                <Meta label="Эпизоды" value={`${item.seasons ? `${item.seasons} сез. · ` : ''}${item.episodesCount}`} />
              ) : (
                <Meta label="Главы" value={String(item.chaptersCount)} />
              )}
              <Meta label="Возраст" value={item.ageRating} />
              {item.studio && <Meta label="Студия" value={item.studio} />}
              {item.author && <Meta label="Автор" value={item.author} />}
            </div>
          </div>

          {/* Табы */}
          <div className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b border-edge">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex-none px-4 py-3 text-sm font-semibold transition ${
                  tab === t.id ? 'text-ink' : 'text-mute hover:text-ink'
                }`}
              >
                {t.label}
                {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
              </button>
            ))}
          </div>

          <div className="anim-fade mt-6" key={tab}>
            {tab === 'overview' && (
              <div className="space-y-6">
                <p className="max-w-3xl leading-relaxed text-ink/90">{item.description}</p>
                {franchise.length > 0 && (
                  <div>
                    <h3 className="font-display mb-3 text-base font-bold">В этой вселенной</h3>
                    <div className="flex flex-wrap gap-2">
                      {franchise.map((f) => (
                        <Link
                          key={f.id}
                          to={`/title/${f.id}`}
                          className="flex items-center gap-2 rounded-xl border border-edge bg-elev px-3 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
                        >
                          <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] font-bold uppercase text-mute">
                            {TYPE_LABELS[f.type]}
                          </span>
                          {f.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'episodes' &&
              (isAnime ? (
                <div>
                  <p className="mb-4 text-sm text-mute">
                    Демо-источник: показаны первые {episodes.length} серий. Полные сезоны подключатся
                    через видео-провайдеры (Kodik, AniLiberty) — см. README.
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {episodes.map((e) => {
                      const active = rec?.episode === e.num;
                      return (
                        <button
                          key={e.num}
                          onClick={() => ui.openPlayer(item, e.num)}
                          className={`group flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                            active ? 'border-accent bg-accent/10' : 'border-edge bg-elev hover:border-accent/60'
                          }`}
                        >
                          <span className={`grid h-9 w-9 flex-none place-items-center rounded-lg text-xs font-bold transition ${
                            active ? 'bg-accent text-white' : 'bg-card group-hover:bg-accent group-hover:text-white'
                          }`}>
                            ▶
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{e.name}</span>
                            <span className="text-xs text-mute">{e.durationMin} мин {active && '· смотрите'}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-4 text-sm text-mute">
                    Выберите главу, чтобы начать чтение во встроенной ридере.
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
                    {Array.from({ length: Math.min(item.chaptersCount ?? 0, 60) }, (_, i) => i + 1).map((ch) => {
                      const done = (read?.chapter ?? 0) >= ch;
                      return (
                        <button
                          key={ch}
                          onClick={() => nav(`/read/${item.id}?ch=${ch}`)}
                          className={`rounded-xl border py-3 text-sm font-semibold transition ${
                            read?.chapter === ch
                              ? 'border-accent bg-accent/15 text-accent'
                              : done
                                ? 'border-edge bg-card text-mute hover:border-accent/60 hover:text-ink'
                                : 'border-edge bg-elev hover:border-accent/60'
                          }`}
                          title={`Глава ${ch}${done ? ' — прочитана' : ''}`}
                        >
                          {ch}
                        </button>
                      );
                    })}
                  </div>
                  {(item.chaptersCount ?? 0) > 60 && (
                    <p className="mt-3 text-xs text-mute">Показаны первые 60 глав — остальные доступны при прокрутке в ридере.</p>
                  )}
                </div>
              ))}

            {tab === 'relations' && (
              <div className="space-y-8">
                {item.relations.length > 0 && (
                  <div>
                    <h3 className="font-display mb-4 text-base font-bold">Граф связей</h3>
                    <div className="space-y-3">
                      {item.relations.map((r) => {
                        const rel = byId(r.id);
                        if (!rel) return null;
                        return (
                          <Link
                            key={r.id + r.kind}
                            to={`/title/${rel.id}`}
                            className="group flex items-center gap-4 rounded-2xl border border-edge bg-elev p-3 transition hover:border-accent"
                          >
                            <div className="h-20 w-14 flex-none overflow-hidden rounded-lg">
                              <Poster item={rel} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold uppercase tracking-wider text-accent">
                                {RELATION_LABELS[r.kind]}
                              </div>
                              <div className="mt-0.5 truncate font-semibold group-hover:text-accent">{rel.title}</div>
                              <div className="text-xs text-mute">
                                {TYPE_LABELS[rel.type]} · {rel.year} · ★ {rel.rating.toFixed(1)}
                              </div>
                            </div>
                            <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5 flex-none text-mute transition group-hover:translate-x-1 group-hover:text-accent" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
                {franchise.length > 0 && (
                  <div>
                    <h3 className="font-display mb-4 text-base font-bold">Все версии франшизы</h3>
                    <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
                      {franchise.map((f) => (
                        <TitleCard key={f.id} item={f} width="w-[150px]" />
                      ))}
                    </div>
                  </div>
                )}
                {item.relations.length === 0 && franchise.length === 0 && (
                  <p className="text-sm text-mute">У этого тайтла пока нет связанных работ.</p>
                )}
              </div>
            )}

            {tab === 'trailers' && (
              <div className="grid gap-4 sm:grid-cols-2">
                {item.trailers.length === 0 && <p className="text-sm text-mute">Трейлеров пока нет.</p>}
                {item.trailers.map((tr, i) => (
                  <button
                    key={i}
                    onClick={() => ui.openTrailer(item)}
                    className="group relative overflow-hidden rounded-2xl border border-edge text-left"
                  >
                    <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-card to-elev">
                      {tr.kind === 'youtube' ? (
                        <img
                          src={`https://img.youtube.com/vi/${tr.src}/hqdefault.jpg`}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:scale-105 group-hover:opacity-90"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,var(--accent),transparent_60%)] opacity-25" />
                      )}
                      <span className="relative grid h-14 w-14 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition group-hover:scale-110 group-hover:bg-accent">
                        <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6" fill="currentColor"><path d="M8 5v14l11-7Z" /></svg>
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 to-transparent p-3 pt-8">
                      <span className="text-sm font-semibold text-white">{tr.label}</span>
                      <span className="rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
                        {tr.kind === 'youtube' ? 'YouTube' : 'HD'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-mute">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
