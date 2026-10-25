import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { byId } from '../data/catalog';
import { useStore } from '../state/Store';
import { useUI } from '../state/UI';

const pagesFor = (ch: number) => 12 + ((ch * 5) % 7);

/** Демо-страница манги: генеративные «кадры» с компоновкой панелей. */
function PageArt({ seed, page, total, mode }: { seed: string; page: number; total: number; mode: 'webtoon' | 'paged' }) {
  const { hue, layout } = useMemo(() => {
    let h = 0;
    const s = `${seed}-${page}`;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return { hue: h % 360, layout: h % 4 };
  }, [seed, page]);

  const panels = useMemo(() => {
    const base = [
      { l: '4%', t: '4%', w: '56%', h: '28%' },
      { l: '64%', t: '4%', w: '32%', h: '28%' },
      { l: '4%', t: '36%', w: '92%', h: '26%' },
      { l: '4%', t: '66%', w: '44%', h: '30%' },
      { l: '52%', t: '66%', w: '44%', h: '30%' },
    ];
    return base.slice(0, 3 + layout);
  }, [layout]);

  return (
    <div
      className={`relative mx-auto w-full overflow-hidden border border-edge ${
        mode === 'webtoon' ? 'aspect-[3/4] max-w-2xl' : 'aspect-[3/4.2] max-w-xl'
      } rounded-xl`}
      style={{ background: `linear-gradient(160deg, hsl(${hue} 30% 10%), hsl(${(hue + 60) % 360} 35% 18%))` }}
    >
      {panels.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-md border border-white/15"
          style={{
            left: p.l, top: p.t, width: p.w, height: p.h,
            background: `linear-gradient(${120 + i * 60}deg, hsl(${(hue + i * 40) % 360} 45% ${16 + i * 4}%), hsl(${hue} 55% 30%))`,
            boxShadow: 'inset 0 0 40px rgba(0,0,0,.35)',
          }}
        >
          <span className="absolute bottom-1 right-1.5 font-mono2 text-[10px] text-white/30">Кадр {page}-{i + 1}</span>
        </div>
      ))}
      <span className="absolute bottom-2 left-3 font-mono2 text-xs text-white/40">
        AniStream Reader · стр. {page}/{total}
      </span>
    </div>
  );
}

export default function ReaderPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { settings, saveReading } = useStore();
  const ui = useUI();
  const item = id ? byId(id) : undefined;

  const maxCh = item?.chaptersCount ?? 1;
  const chapter = Math.min(Math.max(1, Number(params.get('ch') ?? '1') || 1), maxCh);
  const total = pagesFor(chapter);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<'webtoon' | 'paged'>('webtoon');

  // Сохраняем прогресс чтения
  useEffect(() => {
    if (item) saveReading({ titleId: item.id, chapter, page, updatedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, item?.id]);

  useEffect(() => setPage(1), [chapter]);

  if (!item || item.type === 'anime') {
    return (
      <div className="grid place-items-center py-32 text-center">
        <p className="text-mute">Этот тайтл недоступен для чтения</p>
        <Link to="/" className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white">На главную</Link>
      </div>
    );
  }

  if (item.isAdult && !settings.showAdult) {
    return (
      <div className="grid place-items-center py-32 text-center">
        <div className="font-display mb-3 text-4xl text-red-400">18+</div>
        <p className="text-mute">Включите взрослый раздел в настройках</p>
        <button onClick={ui.openSettings} className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white">
          Открыть настройки
        </button>
      </div>
    );
  }

  const goChapter = (ch: number) => {
    const c = Math.min(Math.max(1, ch), maxCh);
    setParams({ ch: String(c) }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="anim-rise pb-10">
      {/* Верхняя панель ридера */}
      <div className="sticky top-16 z-40 -mx-4 mb-6 border-b border-edge bg-base/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 sm:gap-3">
          <button onClick={() => nav(`/title/${item.id}`)} className="grid h-9 w-9 place-items-center rounded-lg border border-edge bg-elev transition hover:border-accent" aria-label="К тайтлу">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{item.title}</div>
            <div className="text-xs text-mute">Глава {chapter} из {maxCh}</div>
          </div>
          <div className="hidden items-center gap-1 rounded-lg border border-edge bg-elev p-1 sm:flex">
            {(['webtoon', 'paged'] as const).map((m) => (
              <button
                key={m}
                data-active={mode === m}
                onClick={() => setMode(m)}
                className="seg-btn rounded-md px-2.5 py-1 text-xs font-semibold"
              >
                {m === 'webtoon' ? 'Лента' : 'Постранично'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goChapter(chapter - 1)}
              disabled={chapter <= 1}
              className="rounded-lg border border-edge bg-elev px-3 py-2 text-xs font-bold transition hover:border-accent disabled:opacity-30"
            >
              ← Глава
            </button>
            <select
              value={chapter}
              onChange={(e) => goChapter(+e.target.value)}
              className="rounded-lg border border-edge bg-elev px-2 py-2 text-xs font-bold outline-none"
            >
              {Array.from({ length: maxCh }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>Гл. {c}</option>
              ))}
            </select>
            <button
              onClick={() => goChapter(chapter + 1)}
              disabled={chapter >= maxCh}
              className="rounded-lg border border-edge bg-elev px-3 py-2 text-xs font-bold transition hover:border-accent disabled:opacity-30"
            >
              Глава →
            </button>
          </div>
        </div>
        {/* Прогресс чтения */}
        <div className="mx-auto mt-2 h-0.5 max-w-3xl overflow-hidden rounded-full bg-edge">
          <div className="h-full bg-accent transition-all" style={{ width: `${(chapter / maxCh) * 100}%` }} />
        </div>
      </div>

      {/* Страницы */}
      {mode === 'webtoon' ? (
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
            <PageArt key={p} seed={`${item.id}-ch${chapter}`} page={p} total={total} mode={mode} />
          ))}
          <button
            onClick={() => goChapter(chapter + 1)}
            disabled={chapter >= maxCh}
            className="mt-2 rounded-xl bg-accent px-6 py-4 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
          >
            Следующая глава →
          </button>
        </div>
      ) : (
        <div className="relative mx-auto max-w-xl">
          <PageArt seed={`${item.id}-ch${chapter}`} page={page} total={total} mode={mode} />
          {/* Зоны клика */}
          <button
            onClick={() => (page > 1 ? setPage(page - 1) : goChapter(chapter - 1))}
            className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize"
            aria-label="Назад"
          />
          <button
            onClick={() => (page < total ? setPage(page + 1) : goChapter(chapter + 1))}
            className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize"
            aria-label="Вперёд"
          />
          <div className="mt-3 flex items-center justify-center gap-3">
            <input
              type="range" min={1} max={total} value={page}
              onChange={(e) => setPage(+e.target.value)}
              className="w-full"
            />
            <span className="font-mono2 flex-none text-xs text-mute">{page}/{total}</span>
          </div>
        </div>
      )}
    </div>
  );
}
