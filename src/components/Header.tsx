import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { TITLES } from '../data/catalog';
import { useStore } from '../state/Store';
import { useUI } from '../state/UI';
import { TYPE_LABELS } from '../types';

export default function Header() {
  const nav = useNavigate();
  const { favs, settings } = useStore();
  const { openSettings, ensureAdult } = useUI();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return TITLES.filter(
      (t) =>
        (t.isAdult ? settings.showAdult : true) &&
        (t.title.toLowerCase().includes(s) || t.originalTitle?.toLowerCase().includes(s)),
    ).slice(0, 6);
  }, [q, settings.showAdult]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (id: string, adult?: boolean) => {
    setOpen(false);
    setQ('');
    const fn = () => nav(`/title/${id}`);
    adult ? ensureAdult(fn) : fn();
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-edge/70 bg-base/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        {/* Логотип */}
        <Link to="/" className="group flex flex-none items-center gap-2.5">
          <span className="anim-glow grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-fuchsia-600 transition-transform group-hover:rotate-6">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor">
              <path d="M7.5 18.5 12 4l4.5 14.5h-2.1L12 11.6l-2.4 6.9Z" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold tracking-wide">
            Ani<span className="text-accent">Stream</span>
          </span>
        </Link>

        {/* Навигация */}
        <nav className="hidden items-center gap-1 md:flex">
          {[
            { to: '/', label: 'Главная', end: true },
            { to: '/catalog?type=anime', label: 'Аниме' },
            { to: '/catalog?type=manga', label: 'Манга' },
            { to: '/catalog?type=ranobe', label: 'Ранобэ' },
          ].map((l) => (
            <NavLink
              key={l.label}
              to={l.to}
              end={l.end as boolean | undefined}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-elev ${
                  isActive && l.end ? 'text-ink' : 'text-mute hover:text-ink'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          {settings.showAdult && (
            <button
              onClick={() => ensureAdult(() => nav('/catalog?adult=1'))}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-bold tracking-wider text-red-400 transition hover:bg-red-500/20"
            >
              18+
            </button>
          )}
        </nav>

        {/* Поиск */}
        <div ref={rootRef} className="relative ml-auto w-full max-w-xs sm:max-w-sm">
          <div className="flex items-center gap-2 rounded-xl border border-edge bg-elev px-3 py-2 transition focus-within:border-accent">
            <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-mute" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && q.trim()) {
                  setOpen(false);
                  nav(`/catalog?q=${encodeURIComponent(q.trim())}`);
                  setQ('');
                }
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder="Аниме, манга, ранобэ…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-mute/70"
            />
          </div>
          {open && results.length > 0 && (
            <div className="anim-scale absolute inset-x-0 top-full mt-2 overflow-hidden rounded-xl border border-edge bg-elev shadow-2xl">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => go(r.id, r.isAdult)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-card"
                >
                  <img
                    src={r.poster}
                    alt=""
                    onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
                    className={`h-11 w-8 flex-none rounded object-cover ${r.isAdult && settings.blurAdult ? 'adult-blur' : ''}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="text-xs text-mute">
                      {TYPE_LABELS[r.type]} · {r.year} · ★ {r.rating.toFixed(1)}
                    </span>
                  </span>
                  {r.isAdult && <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">18+</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Закладки */}
        <button
          onClick={() => nav('/catalog?fav=1')}
          title="Мои закладки"
          className="relative grid h-10 w-10 flex-none place-items-center rounded-xl border border-edge bg-elev transition hover:border-accent"
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3h12v18l-6-4-6 4Z" strokeLinejoin="round" />
          </svg>
          {favs.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
              {favs.length}
            </span>
          )}
        </button>

        {/* Настройки */}
        <button
          onClick={openSettings}
          title="Настройки"
          className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-edge bg-elev transition hover:rotate-45 hover:border-accent"
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08Z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
