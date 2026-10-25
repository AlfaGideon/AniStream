import { useCallback, useEffect, useRef, useState } from 'react';
import type { TitleItem } from '../types';
import { episodesFor } from '../data/catalog';
import { useStore } from '../state/Store';

const fmt = (s: number) => {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const QUALITIES = ['1080p', '720p', '480p'];

/** Собственный видеоплеер AniStream: перемотка, скорость, качество, PiP,
 *  полноэкранный режим, клавиатурное управление, автоплей следующей серии. */
export default function PlayerModal({
  item,
  episode,
  onClose,
  onEpisode,
}: {
  item: TitleItem;
  episode: number;
  onClose: () => void;
  onEpisode: (ep: number) => void;
}) {
  const { settings, saveProgress, progress } = useStore();
  const episodes = episodesFor(item);
  const current = episodes.find((e) => e.num === episode) ?? episodes[0];

  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastSave = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(settings.defaultVolume);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(settings.defaultSpeed);
  const [quality, setQuality] = useState(settings.defaultQuality);
  const [controls, setControls] = useState(true);
  const [panel, setPanel] = useState(false);
  const [menu, setMenu] = useState<'speed' | 'quality' | null>(null);
  const [fs, setFs] = useState(false);
  const [loading, setLoading] = useState(true);

  const wake = useCallback(() => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) { setControls(false); setMenu(null); }
    }, 2800);
  }, []);

  // Инициализация источника при смене серии
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !current) return;
    setLoading(true);
    v.src = current.src;
    v.volume = volume;
    v.muted = muted;
    v.playbackRate = rate;
    // Возобновление с сохранённой позиции
    const rec = progress[item.id];
    v.onloadedmetadata = () => {
      if (rec && rec.episode === current.num && rec.time > 10 && rec.time < rec.duration - 30) {
        v.currentTime = rec.time;
      }
      setLoading(false);
      v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };
    wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.num, item.id]);

  // Полноэкранный режим: отслеживание
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Клавиатура
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k': e.preventDefault(); togglePlay(); break;
        case 'arrowright': v.currentTime += 10; wake(); break;
        case 'arrowleft': v.currentTime -= 10; wake(); break;
        case 'arrowup': e.preventDefault(); setVolume((x) => Math.min(1, +(x + 0.1).toFixed(2))); break;
        case 'arrowdown': e.preventDefault(); setVolume((x) => Math.max(0, +(x - 0.1).toFixed(2))); break;
        case 'f': toggleFs(); break;
        case 'm': setMuted((m) => !m); break;
        case 'escape': if (!document.fullscreenElement) onClose(); break;
      }
      wake();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.volume = volume;
  }, [volume]);
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted]);
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
  }, [rate]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else boxRef.current?.requestFullscreen?.();
  };

  const togglePip = async () => {
    const v = videoRef.current as any;
    try {
      if (document.pictureInPictureElement) await (document as any).exitPictureInPicture();
      else await v?.requestPictureInPicture?.();
    } catch { /* не поддерживается */ }
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setTime(v.currentTime);
    try {
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    } catch { /* noop */ }
    const now = Date.now();
    if (now - lastSave.current > 4000) {
      lastSave.current = now;
      saveProgress({
        titleId: item.id,
        episode: current.num,
        time: v.currentTime,
        duration: v.duration || 0,
        updatedAt: now,
      });
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const onEnded = () => {
    saveProgress({ titleId: item.id, episode: current.num, time: duration, duration, updatedAt: Date.now() });
    if (settings.autoplayNext && current.num < episodes.length) onEpisode(current.num + 1);
    else setPlaying(false);
  };

  if (!current) return null;
  const pct = duration ? (time / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div className="anim-fade fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm" onMouseMove={wake}>
      <div
        ref={boxRef}
        className="relative mx-auto flex h-full max-h-full w-full max-w-[1100px] flex-col justify-center bg-black sm:my-0"
        onClick={wake}
      >
        {/* Шапка */}
        <div
          className={`absolute inset-x-0 top-0 z-20 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity duration-300 ${
            controls ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/25" aria-label="Закрыть">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white">{item.title}</div>
            <div className="text-xs text-white/60">Серия {current.num} из {item.episodesCount} · {quality} · x{rate}</div>
          </div>
          <button
            onClick={() => setPanel((p) => !p)}
            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
          >
            Серии
          </button>
        </div>

        {/* Видео */}
        <div className="relative w-full bg-black" onDoubleClick={toggleFs}>
          <video
            ref={videoRef}
            className="mx-auto max-h-[86vh] w-full cursor-pointer"
            onClick={togglePlay}
            onTimeUpdate={onTimeUpdate}
            onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
            onEnded={onEnded}
            onWaiting={() => setLoading(true)}
            onCanPlay={() => setLoading(false)}
            playsInline
          />
          {loading && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="anim-spin h-12 w-12 rounded-full border-4 border-white/20 border-t-accent" />
            </div>
          )}
          {!playing && !loading && (
            <button onClick={togglePlay} className="anim-scale absolute inset-0 m-auto grid h-20 w-20 place-items-center rounded-full bg-accent/90 text-white shadow-2xl transition hover:scale-110" aria-label="Играть">
              <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9" fill="currentColor"><path d="M8 5v14l11-7Z" /></svg>
            </button>
          )}
        </div>

        {/* Нижняя панель */}
        <div
          className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-10 transition-opacity duration-300 ${
            controls ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {/* Прогресс */}
          <div className="group/bar relative mb-3 h-4 cursor-pointer" onClick={seek}>
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
              <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${bufPct}%` }} />
              <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0 shadow transition group-hover/bar:opacity-100"
              style={{ left: `${pct}%` }}
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={togglePlay} className="grid h-10 w-10 place-items-center rounded-lg text-white transition hover:bg-white/15" aria-label="Плей/пауза">
              {playing ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7Z" /></svg>
              )}
            </button>
            <button
              onClick={() => current.num > 1 && onEpisode(current.num - 1)}
              disabled={current.num <= 1}
              className="hidden h-10 w-10 place-items-center rounded-lg text-white transition hover:bg-white/15 disabled:opacity-30 sm:grid" aria-label="Предыдущая серия"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9.5 12z" /></svg>
            </button>
            <button
              onClick={() => current.num < episodes.length && onEpisode(current.num + 1)}
              disabled={current.num >= episodes.length}
              className="hidden h-10 w-10 place-items-center rounded-lg text-white transition hover:bg-white/15 disabled:opacity-30 sm:grid" aria-label="Следующая серия"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l10.5-7z" /></svg>
            </button>

            {/* Громкость */}
            <div className="group/vol flex items-center gap-1.5">
              <button onClick={() => setMuted((m) => !m)} className="grid h-10 w-10 place-items-center rounded-lg text-white transition hover:bg-white/15" aria-label="Звук">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3z" />
                  {!muted && volume > 0 && <path d="M16 8a5 5 0 0 1 0 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />}
                  {muted && <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
                </svg>
              </button>
              <input
                type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={(e) => { setVolume(+e.target.value); setMuted(false); }}
                className="h-1 w-0 cursor-pointer opacity-0 transition-all duration-300 group-hover/vol:w-20 group-hover/vol:opacity-100"
              />
            </div>

            <span className="font-mono2 text-xs text-white/80">{fmt(time)} / {fmt(duration)}</span>
            <div className="flex-1" />

            {/* Скорость */}
            <div className="relative">
              <button
                onClick={() => setMenu(menu === 'speed' ? null : 'speed')}
                className="rounded-lg px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15"
              >
                x{rate}
              </button>
              {menu === 'speed' && (
                <div className="anim-scale absolute bottom-full right-0 mb-2 overflow-hidden rounded-xl border border-edge bg-elev shadow-2xl">
                  {SPEEDS.map((s) => (
                    <button key={s} onClick={() => { setRate(s); setMenu(null); }}
                      className={`block w-full px-5 py-2 text-left text-xs font-medium transition hover:bg-card ${s === rate ? 'text-accent' : ''}`}>
                      x{s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Качество */}
            <div className="relative">
              <button
                onClick={() => setMenu(menu === 'quality' ? null : 'quality')}
                className="rounded-lg border border-white/25 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/15"
              >
                {quality}
              </button>
              {menu === 'quality' && (
                <div className="anim-scale absolute bottom-full right-0 mb-2 overflow-hidden rounded-xl border border-edge bg-elev shadow-2xl">
                  {QUALITIES.map((q) => (
                    <button key={q} onClick={() => { setQuality(q); setMenu(null); }}
                      className={`block w-full px-5 py-2 text-left text-xs font-medium transition hover:bg-card ${q === quality ? 'text-accent' : ''}`}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={togglePip} className="hidden h-10 w-10 place-items-center rounded-lg text-white transition hover:bg-white/15 sm:grid" aria-label="Картинка в картинке">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor" stroke="none" /></svg>
            </button>
            <button onClick={toggleFs} className="grid h-10 w-10 place-items-center rounded-lg text-white transition hover:bg-white/15" aria-label="Во весь экран">
              {fs ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" strokeLinecap="round" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Панель серий */}
        {panel && (
          <div className="anim-slide-right absolute right-0 top-0 z-30 flex h-full w-72 flex-col border-l border-edge bg-elev/95 backdrop-blur">
            <div className="flex items-center justify-between border-b border-edge p-4">
              <span className="text-sm font-bold">Серии</span>
              <button onClick={() => setPanel(false)} className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-card" aria-label="Закрыть список">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {episodes.map((e) => (
                <button
                  key={e.num}
                  onClick={() => onEpisode(e.num)}
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-card ${
                    e.num === current.num ? 'bg-card ring-1 ring-accent' : ''
                  }`}
                >
                  <span className={`grid h-9 w-9 flex-none place-items-center rounded-lg text-xs font-bold ${
                    e.num === current.num ? 'bg-accent text-white' : 'bg-edge/60'
                  }`}>
                    {e.num}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.name}</span>
                    <span className="text-xs text-mute">{e.durationMin} мин</span>
                  </span>
                  {e.num === current.num && (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
