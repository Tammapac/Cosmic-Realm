import { state, useGame, chooseFaction, bump } from "../game/store";
import { FACTIONS, FactionId } from "../game/types";

export function FactionPicker() {
  const show = useGame((s) => s.showFactionPicker);
  if (!show) return null;
  const factions = Object.values(FACTIONS);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }}>
      <div className="panel p-4" style={{ width: "min(720px, 96vw)", boxShadow: "0 0 30px #4ee2ff44" }}>
        <div className="scanline" />
        <div className="text-center mb-4">
          <div className="text-cyan glow-cyan tracking-[0.3em] text-[14px] font-bold">CHOOSE YOUR FACTION</div>
          <div className="text-mute text-[11px] mt-1">Your faction determines your home sector and bonuses</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {factions.map((f) => (
            <button
              key={f.id}
              className="panel p-3 text-left hover:scale-[1.03] transition-transform"
              style={{ borderColor: f.color, background: `${f.color}11` }}
              onClick={() => chooseFaction(f.id as FactionId)}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-8 h-8 flex items-center justify-center text-[16px] font-bold"
                  style={{ background: `${f.color}33`, border: `1px solid ${f.color}`, color: f.color }}
                >
                  {f.tag[0]}
                </div>
                <div>
                  <div className="font-bold tracking-widest text-[11px]" style={{ color: f.color }}>
                    {f.name.toUpperCase()}
                  </div>
                  <div className="text-mute text-[9px] tracking-widest">[{f.tag}]</div>
                </div>
              </div>
              <div className="text-dim text-[9px] mb-2 leading-tight">{f.description}</div>
              <div className="text-[9px] mb-1" style={{ color: f.color }}>"{f.motto}"</div>
              <div className="space-y-0.5 text-[9px] mt-2 pt-2" style={{ borderTop: `1px solid ${f.color}33` }}>
                {f.bonus.damage      && <div className="text-red">+{Math.round(f.bonus.damage * 100)}% weapon damage</div>}
                {f.bonus.speed       && <div className="text-cyan">+{Math.round(f.bonus.speed * 100)}% ship speed</div>}
                {f.bonus.shieldRegen && <div className="text-cyan">x{f.bonus.shieldRegen.toFixed(1)} shield regen</div>}
                {f.bonus.lootBonus   && <div className="text-green">+{f.bonus.lootBonus} bonus loot per kill</div>}
                {f.bonus.tradeDiscount && <div className="text-amber">-{Math.round(f.bonus.tradeDiscount * 100)}% market prices</div>}
              </div>
              <div className="mt-2 text-center">
                <div className="text-[8px] text-mute">HOME SECTOR</div>
                <div className="text-[10px] font-bold" style={{ color: f.color }}>{f.startZone === "alpha" ? "1-1 Alpha Sector" : f.startZone === "corona" ? "2-1 Mars Frontier" : "3-1 Venus Cloud Gate"}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
