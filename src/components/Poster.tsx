import { useState } from 'react';
import type { TitleItem } from '../types';
import { useStore } from '../state/Store';
import ArtPoster from './ArtPoster';

/** Умная обложка: картинка + генеративный фолбэк + блюр для 18+. */
export default function Poster({
  item,
  blurred,
  className = '',
}: {
  item: TitleItem;
  blurred?: boolean;
  className?: string;
}) {
  const { settings } = useStore();
  const [err, setErr] = useState(false);
  const shouldBlur = blurred ?? (item.isAdult && settings.blurAdult);
  const typeLabel = item.type === 'manga' ? 'Манга' : item.type === 'ranobe' ? 'Ранобэ' : 'Аниме';

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {item.poster && !err ? (
        <img
          src={item.poster}
          alt={item.title}
          loading="lazy"
          onError={() => setErr(true)}
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
            shouldBlur ? 'adult-blur' : ''
          }`}
        />
      ) : (
        <div className={shouldBlur ? 'adult-blur h-full w-full' : 'h-full w-full'}>
          <ArtPoster seed={item.id} label={item.title} sub={typeLabel} />
        </div>
      )}
      {shouldBlur && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display rounded-xl border border-white/30 bg-black/50 px-3 py-1.5 text-lg font-bold text-white backdrop-blur-sm">
            18+
          </span>
        </div>
      )}
    </div>
  );
}
