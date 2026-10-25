export default function Footer() {
  return (
    <footer className="mt-16 border-t border-edge bg-elev/50">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-8 text-sm text-mute sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-ink">
            Ani<span className="text-accent">Stream</span>
          </span>
          <span className="text-xs">· аниме, манга и ранобэ в одной вселенной</span>
        </div>
        <p className="max-w-md text-xs leading-relaxed">
          Демонстрационный проект. Весь контент принадлежит правообладателям; AniStream лишь
          агрегирует открытые источники через провайдеры (см. src/services/providers).
        </p>
      </div>
    </footer>
  );
}
