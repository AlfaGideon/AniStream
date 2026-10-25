import { useMemo } from 'react';

/** Детерминированная генеративная обложка: градиент + геометрия + инициал.
 *  Используется для тайтлов без арта (ранобэ, 18+) и как фолбэк при ошибке загрузки. */
export default function ArtPoster({ seed, label, sub }: { seed: string; label: string; sub?: string }) {
  const { hue1, hue2, angle, initial } = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return {
      hue1: h % 360,
      hue2: (h * 7 + 80) % 360,
      angle: 120 + (h % 12) * 10,
      initial: (label.trim()[0] ?? 'A').toUpperCase(),
    };
  }, [seed, label]);

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(${angle}deg, hsl(${hue1} 55% 16%), hsl(${hue2} 60% 26%))`,
      }}
    >
      <div
        className="absolute -left-1/4 top-1/4 h-4/5 w-4/5 rounded-full opacity-30"
        style={{ background: `radial-gradient(circle, hsl(${hue2} 80% 60%), transparent 70%)` }}
      />
      <div
        className="absolute -right-1/4 -top-1/4 h-2/3 w-2/3 rotate-45 rounded-3xl opacity-20"
        style={{ background: `linear-gradient(135deg, hsl(${hue1} 90% 65%), transparent)` }}
      />
      <span className="font-display select-none text-6xl font-bold text-white/25">{initial}</span>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
        <div className="line-clamp-2 text-xs font-semibold leading-tight text-white/90">{label}</div>
        {sub && <div className="mt-0.5 text-[10px] uppercase tracking-widest text-white/50">{sub}</div>}
      </div>
    </div>
  );
}
