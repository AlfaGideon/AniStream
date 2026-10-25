import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Горизонтальная лента с карточками и стрелками прокрутки. */
export default function Rail({
  title,
  linkTo,
  children,
  accent,
}: {
  title: string;
  linkTo?: string;
  children: ReactNode;
  accent?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section className="anim-rise">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-display text-xl font-bold sm:text-2xl">
          {title}
          {accent && <span className="text-accent"> {accent}</span>}
        </h2>
        <div className="flex items-center gap-2">
          {linkTo && (
            <Link to={linkTo} className="mr-1 text-sm font-medium text-mute transition hover:text-accent">
              Все →
            </Link>
          )}
          <button
            onClick={() => scroll(-1)}
            className="hidden h-9 w-9 place-items-center rounded-lg border border-edge bg-elev transition hover:border-accent sm:grid"
            aria-label="Назад"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button
            onClick={() => scroll(1)}
            className="hidden h-9 w-9 place-items-center rounded-lg border border-edge bg-elev transition hover:border-accent sm:grid"
            aria-label="Вперёд"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m10 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 pt-1"
      >
        {children}
      </div>
    </section>
  );
}
