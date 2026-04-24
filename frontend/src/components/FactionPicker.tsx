import { state, useGame, chooseFaction, bump } from "../game/store";
import { FACTIONS, FactionId } from "../game/types";

export function FactionPicker() {
  const show = useGame((s) => s.showFactionPicker);
  if (!show) return null;
  const factions = Object.values(FACTIONS);

  return (
    <div className="absolute left-1/2 -translate-x-1/2 z-[60] pointer-events-auto" style={{ bottom: 100 }}>
      <div className="panel p-2.5" style={{ width: "min(640px, 96vw)", boxShadow: "0 0 18px #4ee2ff44" }}>
        <div className="scanline" />
        <div className="flex items-center justify-between mb-2">
          <div className="text-cyan glow-cyan tracking-[0.25em] text-[11px] font-bold">▶ CHOOSE FACTION</div>
          <button
            className="text-mute text-[10px] hover:text-white"
            onClick={() => { state.showFactionPicker = false; bump(); }}
          >
            DECIDE LATER ✕
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {factions.map((f) => (
            <button
              key={f.id}
              className="panel p-2 text-left hover:scale-[1.02] transition-transform"
              style={{ borderColor: f.color, background: `${f.color}11` }}
              onClick={() => chooseFaction(f.id as FactionId)}
            >
              <div className="font-bold tracking-widest text-[10px] mb-0.5" style={{ color: f.color }}>
                ◆ {f.name.toUpperCase()}
              </div>
              <div className="text-dim text-[8px] mb-1 leading-tight">{f.description}</div>
              <div className="space-y-0.5 text-[8px]">
                {f.bonus.damage      && <div className="text-red">+{Math.round(f.bonus.damage * 100)}% dmg</div>}
                {f.bonus.speed       && <div className="text-cyan">+{Math.round(f.bonus.speed * 100)}% spd</div>}
                {f.bonus.shieldRegen && <div className="text-cyan">×{f.bonus.shieldRegen.toFixed(1)} shd regen</div>}
                {f.bonus.lootBonus   && <div className="text-green">+{f.bonus.lootBonus} loot</div>}
                {f.bonus.tradeDiscount && <div className="text-amber">−{Math.round(f.bonus.tradeDiscount * 100)}% prices</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
