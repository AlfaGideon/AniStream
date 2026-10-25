import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ProgressRec, ReadingRec, Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accent: '#7c5cff',
  showAdult: false,
  blurAdult: true,
  cardSize: 'cozy',
  autoplayTrailers: true,
  preferredTrailer: 'youtube',
  defaultQuality: '1080p',
  defaultSpeed: 1,
  defaultVolume: 0.8,
  autoplayNext: true,
};

const LS = {
  settings: 'anistream-settings-v1',
  favs: 'anistream-favs-v1',
  progress: 'anistream-progress-v1',
  reading: 'anistream-reading-v1',
  age: 'anistream-age-v1',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function loadRaw<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* приватный режим — молча пропускаем */
  }
}

interface StoreCtx {
  settings: Settings;
  patchSettings: (patch: Partial<Settings>) => void;
  favs: string[];
  toggleFav: (id: string) => void;
  isFav: (id: string) => boolean;
  progress: Record<string, ProgressRec>;
  saveProgress: (rec: ProgressRec) => void;
  clearProgress: () => void;
  reading: Record<string, ReadingRec>;
  saveReading: (rec: ReadingRec) => void;
  ageVerified: boolean;
  setAgeVerified: (v: boolean) => void;
  resetAll: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => load(LS.settings, DEFAULT_SETTINGS));
  const [favs, setFavs] = useState<string[]>(() => loadRaw<string[]>(LS.favs, []));
  const [progress, setProgress] = useState<Record<string, ProgressRec>>(() =>
    loadRaw(LS.progress, {}),
  );
  const [reading, setReading] = useState<Record<string, ReadingRec>>(() => loadRaw(LS.reading, {}));
  const [ageVerified, setAgeVerifiedState] = useState<boolean>(() =>
    loadRaw<boolean>(LS.age, false),
  );

  // Применяем тему и акцентный цвет к документу
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.style.setProperty('--accent', settings.accent);
  }, [settings.theme, settings.accent]);

  useEffect(() => save(LS.settings, settings), [settings]);
  useEffect(() => save(LS.favs, favs), [favs]);
  useEffect(() => save(LS.progress, progress), [progress]);
  useEffect(() => save(LS.reading, reading), [reading]);
  useEffect(() => save(LS.age, ageVerified), [ageVerified]);

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const toggleFav = useCallback((id: string) => {
    setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  }, []);

  const isFav = useCallback((id: string) => favs.includes(id), [favs]);

  const saveProgress = useCallback((rec: ProgressRec) => {
    setProgress((p) => ({ ...p, [rec.titleId]: rec }));
  }, []);

  const clearProgress = useCallback(() => setProgress({}), []);

  const saveReading = useCallback((rec: ReadingRec) => {
    setReading((r) => ({ ...r, [rec.titleId]: rec }));
  }, []);

  const setAgeVerified = useCallback((v: boolean) => setAgeVerifiedState(v), []);

  const resetAll = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setFavs([]);
    setProgress({});
    setReading({});
    setAgeVerifiedState(false);
  }, []);

  const value = useMemo<StoreCtx>(
    () => ({
      settings,
      patchSettings,
      favs,
      toggleFav,
      isFav,
      progress,
      saveProgress,
      clearProgress,
      reading,
      saveReading,
      ageVerified,
      setAgeVerified,
      resetAll,
    }),
    [settings, patchSettings, favs, toggleFav, isFav, progress, saveProgress, clearProgress, reading, saveReading, ageVerified, setAgeVerified, resetAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore вне StoreProvider');
  return ctx;
}
