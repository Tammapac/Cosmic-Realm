import { state, useGame, chooseFaction, bump } from "../game/store";
import { FACTIONS, FactionId } from "../game/types";

export function FactionPicker() {
  const show = useGame((s) => s.showFactionPicker);
  if (!show) return null;
  const factions = Object.values(FACTIONS);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.88)" }}
    >
      <div
        className="panel panel-framed"
        style={{
          width: "min(740px, 96vw)",
          padding: "20px 20px 24px",
          boxShadow: "0 0 40px rgba(78,226,255,0.1), 0 0 80px rgba(0,0,0,0.8)",
        }}
      >
        <div className="scanline" />

        {/* Header */}
        <div className="text-center mb-5">
          <div
            className="font-bold tracking-widest glow-cyan"
            style={{ color: "var(--accent-cyan)", fontSize: 15.3, letterSpacing: "0.3em" }}
          >
            CHOOSE YOUR FACTION
          </div>
          <div style={{ color: "var(--text-mute)", fontSize: 13, marginTop: 4 }}>
            Your faction determines your home sector and passive bonuses
          </div>
        </div>

        {/* Faction cards */}
        <div className="grid grid-cols-3 gap-3">
          {factions.map((f) => (
            <button
              key={f.id}
              className="panel text-left transition-shadow duration-150"
              style={{
                borderColor: f.color + "88",
                background: `${f.color}0c`,
                padding: "14px 12px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${f.color}33`;
                (e.currentTarget as HTMLElement).style.borderColor = f.color;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
                (e.currentTarget as HTMLElement).style.borderColor = f.color + "88";
              }}
              onClick={() => chooseFaction(f.id as FactionId)}
            >
              {/* Faction identity */}
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="flex items-center justify-center font-bold shrink-0"
                  style={{
                    width: 34, height: 34,
                    background: `${f.color}22`,
                    border: `1px solid ${f.color}`,
                    color: f.color,
                    fontSize: 17.7,
                    boxShadow: `inset 0 0 8px ${f.color}22`,
                  }}
                >
                  {f.tag[0]}
                </div>
                <div className="min-w-0">
                  <div
                    className="font-bold tracking-widest truncate"
                    style={{ color: f.color, fontSize: 13 }}
                  >
                    {f.name.toUpperCase()}
                  </div>
                  <div style={{ color: "var(--text-mute)", fontSize: 10.6, letterSpacing: "0.15em" }}>
                    [{f.tag}]
                  </div>
                </div>
              </div>

              {/* Description */}
              <div
                style={{ color: "var(--text-dim)", fontSize: 11.8, marginBottom: 6, lineHeight: 1.4 }}
              >
                {f.description}
              </div>

              {/* Motto */}
              <div
                className="italic"
                style={{ color: f.color + "cc", fontSize: 10.6, marginBottom: 8 }}
              >
                "{f.motto}"
              </div>

              {/* Bonuses */}
              <div
                className="space-y-0.5"
                style={{
                  borderTop: `1px solid ${f.color}22`,
                  paddingTop: 7,
                  marginBottom: 7,
                }}
              >
                {f.bonus.damage      && (
                  <div style={{ color: "var(--accent-red)", fontSize: 11.8 }}>
                    +{Math.round(f.bonus.damage * 100)}% weapon damage
                  </div>
                )}
                {f.bonus.speed       && (
                  <div style={{ color: "var(--accent-cyan)", fontSize: 11.8 }}>
                    +{Math.round(f.bonus.speed * 100)}% ship speed
                  </div>
                )}
                {f.bonus.shieldRegen && (
                  <div style={{ color: "var(--accent-cyan)", fontSize: 11.8 }}>
                    ×{f.bonus.shieldRegen.toFixed(1)} shield regen
                  </div>
                )}
                {f.bonus.lootBonus   && (
                  <div style={{ color: "var(--accent-green)", fontSize: 11.8 }}>
                    +{f.bonus.lootBonus} bonus loot / kill
                  </div>
                )}
                {f.bonus.tradeDiscount && (
                  <div style={{ color: "var(--accent-amber)", fontSize: 11.8 }}>
                    −{Math.round(f.bonus.tradeDiscount * 100)}% market prices
                  </div>
                )}
              </div>

              {/* Home sector */}
              <div
                style={{
                  borderTop: `1px solid ${f.color}18`,
                  paddingTop: 6,
                  textAlign: "center",
                }}
              >
                <div
                  className="hud-label"
                  style={{ marginBottom: 2 }}
                >
                  HOME SECTOR
                </div>
                <div
                  className="font-bold truncate"
                  style={{ color: f.color, fontSize: 11.8 }}
                >
                  {f.startZone === "alpha"
                    ? "1-1 Alpha Sector"
                    : f.startZone === "corona"
                    ? "2-1 Mars Frontier"
                    : "3-1 Venus Cloud Gate"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
