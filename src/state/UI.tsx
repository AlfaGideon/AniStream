import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { TitleItem } from '../types';
import { useStore } from './Store';
import PlayerModal from '../components/PlayerModal';
import TrailerModal from '../components/TrailerModal';
import SettingsDrawer from '../components/SettingsDrawer';
import AgeGateModal from '../components/AgeGateModal';

interface PlayerState {
  item: TitleItem;
  episode: number;
}

interface UICtx {
  openPlayer: (item: TitleItem, episode?: number) => void;
  closePlayer: () => void;
  openTrailer: (item: TitleItem) => void;
  openSettings: () => void;
  /** Пропускает к действию, только если разрешён контент 18+ и возраст подтверждён. */
  ensureAdult: (action: () => void) => void;
  toast: (msg: string) => void;
}

const Ctx = createContext<UICtx | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [trailer, setTrailer] = useState<TitleItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ageOpen, setAgeOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);
  const [toastMsg, setToastMsg] = useState<{ id: number; text: string } | null>(null);

  const toast = useCallback((text: string) => setToastMsg({ id: Date.now(), text }), []);

  const openPlayer = useCallback((item: TitleItem, episode = 1) => {
    if (item.isAdult) {
      ensureAdultRef.current(() => setPlayer({ item, episode }));
      return;
    }
    setPlayer({ item, episode });
  }, []);

  const openTrailer = useCallback((item: TitleItem) => setTrailer(item), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);

  const ensureAdult = useCallback(
    (action: () => void) => {
      if (!store.settings.showAdult) {
        toast('Раздел 18+ отключён — включите его в настройках');
        setSettingsOpen(true);
        return;
      }
      if (!store.ageVerified) {
        pendingRef.current = action;
        setAgeOpen(true);
        return;
      }
      action();
    },
    [store.settings.showAdult, store.ageVerified, toast],
  );
  const ensureAdultRef = useRef(ensureAdult);
  ensureAdultRef.current = ensureAdult;

  const ageResult = useCallback(
    (ok: boolean) => {
      setAgeOpen(false);
      if (ok) {
        store.setAgeVerified(true);
        const fn = pendingRef.current;
        pendingRef.current = null;
        fn?.();
      } else {
        pendingRef.current = null;
        store.patchSettings({ showAdult: false });
        toast('Раздел 18+ скрыт');
      }
    },
    [store, toast],
  );

  const value = useMemo<UICtx>(
    () => ({
      openPlayer,
      closePlayer: () => setPlayer(null),
      openTrailer,
      openSettings,
      ensureAdult,
      toast,
    }),
    [openPlayer, openTrailer, openSettings, ensureAdult, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {player && (
        <PlayerModal
          item={player.item}
          episode={player.episode}
          onClose={() => setPlayer(null)}
          onEpisode={(ep) => setPlayer({ item: player.item, episode: ep })}
        />
      )}
      {trailer && <TrailerModal item={trailer} onClose={() => setTrailer(null)} />}
      {settingsOpen && <SettingsDrawer onClose={() => setSettingsOpen(false)} />}
      {ageOpen && <AgeGateModal onResult={ageResult} />}
      {toastMsg && <Toast key={toastMsg.id} text={toastMsg.text} onDone={() => setToastMsg(null)} />}
    </Ctx.Provider>
  );
}

function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="anim-rise fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-xl border border-edge bg-elev px-5 py-3 text-sm font-medium shadow-2xl">
      {text}
    </div>
  );
}

export function useUI(): UICtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUI вне UIProvider');
  return ctx;
}
