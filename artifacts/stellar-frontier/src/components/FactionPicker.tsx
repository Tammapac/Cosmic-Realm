import { state, useGame, chooseFaction, bump } from "../game/store";
import { FACTIONS, FactionId } from "../game/types";

export function FactionPicker() {
  const show = useGame((s) => s.showFactionPicker);
  if (!show) return null;
  const factions = Object.values(FACTIONS);

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(2,4,12,0.92)" }}>
      <div className="panel p-5" style={{ width: "min(900px, 96vw)" }}>
        <div className="scanline" />
        <div className="text-center mb-4">
          <div className="text-cyan glow-cyan tracking-[0.3em] text-xl font-bold">CHOOSE YOUR FACTION</div>
          <div className="text-mute text-[11px] mt-1">
            Pledge loyalty to gain combat & trade bonuses, faction-tinted stations, and access to faction missions.
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {factions.map((f) => (
            <button
              key={f.id}
              className="panel p-4 text-left hover:scale-[1.02] transition-transform"
              style={{ borderColor: f.color, background: `${f.color}11` }}
              onClick={() => chooseFaction(f.id as FactionId)}
            >
              <div className="font-bold tracking-widest text-sm mb-1" style={{ color: f.color }}>
                ◆ {f.name.toUpperCase()}
              </div>
              <div className="text-dim text-[10px] mb-3">{f.description}</div>
              <div className="space-y-1 text-[10px]">
                {f.bonus.damage      && <div className="text-red">+{Math.round(f.bonus.damage * 100)}% damage</div>}
                {f.bonus.speed       && <div className="text-cyan">+{Math.round(f.bonus.speed * 100)}% speed</div>}
                {f.bonus.shieldRegen && <div className="text-cyan">×{f.bonus.shieldRegen.toFixed(1)} shield regen</div>}
                {f.bonus.lootBonus   && <div className="text-green">+{f.bonus.lootBonus} loot per kill</div>}
                {f.bonus.tradeDiscount && <div className="text-amber">−{Math.round(f.bonus.tradeDiscount * 100)}% trade prices at allied stations</div>}
              </div>
            </button>
          ))}
        </div>
        <div className="text-center mt-4">
          <button
            className="btn"
            style={{ fontSize: 10 }}
            onClick={() => { state.showFactionPicker = false; bump(); }}
          >
            DECIDE LATER
          </button>
        </div>
      </div>
    </div>
  );
}
