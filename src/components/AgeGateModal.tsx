/** Возрастной гейт для раздела 18+. */
export default function AgeGateModal({ onResult }: { onResult: (ok: boolean) => void }) {
  return (
    <div className="anim-fade fixed inset-0 z-[130] grid place-items-center bg-black/90 p-4 backdrop-blur-md">
      <div className="anim-scale w-full max-w-sm overflow-hidden rounded-2xl border border-red-500/30 bg-elev text-center shadow-2xl">
        <div className="bg-gradient-to-b from-red-500/20 to-transparent px-6 pb-4 pt-8">
          <div className="font-display mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-red-500/50 bg-red-500/15 text-2xl font-bold text-red-400">
            18+
          </div>
          <h3 className="font-display text-lg font-bold">Взрослый контент</h3>
          <p className="mt-2 text-sm leading-relaxed text-mute">
            Раздел содержит материалы, предназначенные только для совершеннолетних.
            Подтвердите, что вам исполнилось 18 лет.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 px-6 pb-6">
          <button
            onClick={() => onResult(false)}
            className="rounded-xl border border-edge bg-card px-4 py-3 text-sm font-semibold transition hover:bg-edge/60"
          >
            Мне нет 18
          </button>
          <button
            onClick={() => onResult(true)}
            className="rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/30 transition hover:brightness-110 active:scale-95"
          >
            Мне есть 18
          </button>
        </div>
        <p className="border-t border-edge px-6 py-3 text-[11px] leading-relaxed text-mute">
          Нажимая «Мне есть 18», вы подтверждаете совершеннолетие по законодательству вашей страны.
        </p>
      </div>
    </div>
  );
}
