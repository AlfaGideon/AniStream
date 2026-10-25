import { useState } from 'react';
import { useStore } from '../state/Store';
import AgeGateModal from './AgeGateModal';

const ACCENTS = ['#7c5cff', '#ff5c7a', '#22c55e', '#38bdf8', '#f59e0b', '#f43f5e'];
const THEMES = [
  { id: 'dark', label: 'Тёмная' },
  { id: 'dim', label: 'Сумрак' },
  { id: 'light', label: 'Светлая' },
] as const;

/** Выдвижная панель настроек: внешний вид, контент, трейлеры, плеер, данные. */
export default function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const { settings, patchSettings, ageVerified, setAgeVerified, clearProgress, favs, resetAll } = useStore();
  const [askAge, setAskAge] = useState(false);

  const toggleAdult = (on: boolean) => {
    if (on && !ageVerified) {
      setAskAge(true);
      return;
    }
    patchSettings({ showAdult: on });
  };

  return (
    <div className="anim-fade fixed inset-0 z-[110]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <aside
        className="anim-slide-right no-scrollbar absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-edge bg-elev"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-edge px-6 py-5">
          <h2 className="font-display text-lg font-bold">Настройки</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-card" aria-label="Закрыть настройки">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {/* Внешний вид */}
          <Section title="Внешний вид" icon="🎨">
            <Field label="Тема интерфейса">
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    data-active={settings.theme === t.id}
                    onClick={() => patchSettings({ theme: t.id })}
                    className="seg-btn rounded-xl border border-edge bg-card px-3 py-2.5 text-xs font-semibold"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Акцентный цвет">
              <div className="flex gap-2.5">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => patchSettings({ accent: c })}
                    aria-label={`Цвет ${c}`}
                    className={`h-9 w-9 rounded-full transition-transform hover:scale-110 ${
                      settings.accent === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-elev' : ''
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </Field>
            <Field label="Размер карточек в каталоге">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'compact', label: 'Компактные' },
                  { id: 'cozy', label: 'Крупные' },
                ].map((s) => (
                  <button
                    key={s.id}
                    data-active={settings.cardSize === s.id}
                    onClick={() => patchSettings({ cardSize: s.id as 'compact' | 'cozy' })}
                    className="seg-btn rounded-xl border border-edge bg-card px-3 py-2.5 text-xs font-semibold"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          {/* Контент */}
          <Section title="Контент" icon="🔞">
            <Toggle
              label="Показывать раздел 18+"
              hint="Хентай и взрослые тайтлы. Требуется подтверждение возраста."
              checked={settings.showAdult}
              onChange={toggleAdult}
              danger
            />
            <Toggle
              label="Блюрить обложки 18+"
              hint="Откровенные обложки будут размыты до клика."
              checked={settings.blurAdult}
              onChange={(v) => patchSettings({ blurAdult: v })}
              disabled={!settings.showAdult}
            />
          </Section>

          {/* Трейлеры */}
          <Section title="Трейлеры" icon="🎬">
            <Toggle
              label="Автопрокрутка на главной"
              hint="Карусель лучших тайтлов меняется автоматически."
              checked={settings.autoplayTrailers}
              onChange={(v) => patchSettings({ autoplayTrailers: v })}
            />
            <Field label="Предпочитаемый источник">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'youtube', label: 'YouTube' },
                  { id: 'video', label: 'HD-видео' },
                ].map((s) => (
                  <button
                    key={s.id}
                    data-active={settings.preferredTrailer === s.id}
                    onClick={() => patchSettings({ preferredTrailer: s.id as 'youtube' | 'video' })}
                    className="seg-btn rounded-xl border border-edge bg-card px-3 py-2.5 text-xs font-semibold"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          {/* Плеер */}
          <Section title="Плеер" icon="▶️">
            <Field label={`Качество по умолчанию: ${settings.defaultQuality}`}>
              <div className="grid grid-cols-3 gap-2">
                {['1080p', '720p', '480p'].map((q) => (
                  <button
                    key={q}
                    data-active={settings.defaultQuality === q}
                    onClick={() => patchSettings({ defaultQuality: q })}
                    className="seg-btn rounded-xl border border-edge bg-card px-3 py-2.5 text-xs font-semibold"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`Скорость воспроизведения: x${settings.defaultSpeed}`}>
              <input
                type="range" min={0.5} max={2} step={0.25} value={settings.defaultSpeed}
                onChange={(e) => patchSettings({ defaultSpeed: +e.target.value })}
                className="w-full"
              />
            </Field>
            <Field label={`Громкость по умолчанию: ${Math.round(settings.defaultVolume * 100)}%`}>
              <input
                type="range" min={0} max={1} step={0.05} value={settings.defaultVolume}
                onChange={(e) => patchSettings({ defaultVolume: +e.target.value })}
                className="w-full"
              />
            </Field>
            <Toggle
              label="Автоплей следующей серии"
              hint="По окончании серии следующая запустится автоматически."
              checked={settings.autoplayNext}
              onChange={(v) => patchSettings({ autoplayNext: v })}
            />
          </Section>

          {/* Данные */}
          <Section title="Данные и приватность" icon="🗄">
            <div className="space-y-2.5">
              <button
                onClick={clearProgress}
                className="w-full rounded-xl border border-edge bg-card px-4 py-3 text-left text-sm font-medium transition hover:border-accent"
              >
                Очистить историю просмотра
              </button>
              <button
                onClick={() => setAgeVerified(false)}
                className="w-full rounded-xl border border-edge bg-card px-4 py-3 text-left text-sm font-medium transition hover:border-accent"
              >
                Сбросить подтверждение возраста
              </button>
              <button
                onClick={() => {
                  resetAll();
                  onClose();
                }}
                className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-left text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
              >
                Полный сброс (настройки, закладки{favs.length ? `: ${favs.length}` : ''}, прогресс)
              </button>
            </div>
          </Section>

          <p className="pb-4 text-center text-xs text-mute">
            AniStream v0.1 · все настройки хранятся локально в вашем браузере
          </p>
        </div>
      </aside>

      {askAge && (
        <AgeGateModal
          onResult={(ok) => {
            setAskAge(false);
            if (ok) {
              setAgeVerified(true);
              patchSettings({ showAdult: true });
            }
          }}
        />
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-mute">
        <span>{icon}</span> {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{label}</div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
  danger,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 ${disabled ? 'opacity-40' : ''}`}>
      <input
        type="checkbox"
        className={`switch ${danger ? 'danger' : ''}`}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="flex-1">
        <span className={`block text-sm font-medium ${danger ? 'text-red-400' : ''}`}>{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-snug text-mute">{hint}</span>}
      </span>
    </label>
  );
}
