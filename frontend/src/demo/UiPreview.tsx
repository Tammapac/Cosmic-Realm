/**
 * UI Unification Preview — open with ?ui-preview in the URL.
 *
 * A verification harness for the unified popup/window system. It renders the
 * SAME primitives the live game uses (.panel / .hud-titleband / .gbtn* /
 * .j-row / .gtip / reward cards) driven by the SAME stylesheets the game
 * loads (index.css + hud-skin.css + hud-tokens.css), so a designer can confirm
 * that every popup speaks the main HUD's visual language: identical navy
 * material, cyan ring, gold accents, corner cuts, shadows and typography.
 *
 * This screen is intentionally self-contained — it uses no game store and no
 * network, so it can be opened at any time to eyeball the design system.
 */
import { useState } from "react";
import { HudWindow, HudDialog, HudButton, HudDivider } from "../components/hud-ui";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: 28 }}>
    <h2
      style={{
        fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.28em",
        textTransform: "uppercase", color: "var(--hud-cyan)",
        textShadow: "0 0 8px rgba(78,226,255,0.35)", margin: "0 0 12px",
      }}
    >
      {title}
    </h2>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>{children}</div>
  </section>
);

const Swatch = ({ name, varName }: { name: string; varName: string }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 96 }}>
    <div style={{ height: 44, background: `var(${varName})`, border: "1px solid var(--hud-border)", borderRadius: 0 }} />
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--hud-text-dim)" }}>{name}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--hud-text-mute)" }}>{varName}</div>
  </div>
);

export default function UiPreview() {
  const [showDialog, setShowDialog] = useState(false);
  const [sel, setSel] = useState("q2");

  const rows = [
    { id: "q1", label: "Patrol the Alpha Gate", state: "" },
    { id: "q2", label: "Destroy 8 Raider Scouts", state: "" },
    { id: "q3", label: "Salvage the Derelict Freighter", state: "done" },
    { id: "q4", label: "Reach Reputation Rank: Veteran", state: "locked" },
    { id: "q5", label: "", state: "" }, // tests the "Unbenannte Mission" fallback path visually
  ];

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "auto", background: "var(--hud-bg-void)", padding: "28px 32px" }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--hud-text-bright)" }}>
          UI System — Unified Popup Kit
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--hud-text-dim)", marginTop: 4 }}>
          Every element below is a live game primitive on the real skin (index.css + hud-skin.css). Single source of truth: the main HUD.
        </div>
      </header>

      <Section title="Design tokens (aliases onto the main HUD palette)">
        <Swatch name="bg primary" varName="--ui-bg-primary" />
        <Swatch name="bg raised" varName="--ui-bg-raised" />
        <Swatch name="cyan (accent)" varName="--ui-cyan" />
        <Swatch name="gold (rewards)" varName="--ui-gold" />
        <Swatch name="success" varName="--ui-success" />
        <Swatch name="danger" varName="--ui-danger" />
        <Swatch name="warning" varName="--ui-warning" />
        <Swatch name="text primary" varName="--ui-text-primary" />
        <Swatch name="text secondary" varName="--ui-text-secondary" />
        <Swatch name="text muted" varName="--ui-text-muted" />
      </Section>

      <Section title="Windows (HudWindow — standard & gold)">
        <HudWindow title="Standard Window" width={280} onClose={() => {}}>
          <div style={{ padding: "12px 14px", color: "var(--ui-text-primary)", fontSize: 12, lineHeight: 1.6 }}>
            Navy material, cyan ring, cut corners, title band, close button. Identical fill and shadow to the hotbar / minimap plates.
          </div>
        </HudWindow>
        <HudWindow title="Featured / Confirm" width={280} gold onClose={() => {}} footer={<>
          <HudButton variant="secondary">Cancel</HudButton>
          <HudButton variant="primary">Confirm</HudButton>
        </>}>
          <div style={{ padding: "12px 14px", color: "var(--ui-text-primary)", fontSize: 12, lineHeight: 1.6 }}>
            Same window, gold ring for currency / confirmation flows. Footer uses the unified button variants.
          </div>
        </HudWindow>
      </Section>

      <Section title="Buttons (.gbtn family — the only button system)">
        <HudButton variant="secondary">Secondary</HudButton>
        <HudButton variant="primary">Primary / Confirm</HudButton>
        <HudButton variant="danger">Danger</HudButton>
        <HudButton variant="secondary" disabled>Disabled</HudButton>
        <button className="gbtn gbtn-red" style={{ padding: "1px 8px", fontSize: 10 }}>✕</button>
      </Section>

      <Section title="Mission list rows (.j-row — all states)">
        <div style={{ width: 300 }} className="panel">
          <div className="hud-titleband" style={{ padding: "7px 12px", letterSpacing: "0.28em" }}>Journal</div>
          <div style={{ padding: "8px 8px 10px" }}>
            {rows.map((r) => {
              const cls = [
                "j-row",
                sel === r.id ? "j-row--sel" : "",
                r.state === "done" ? "j-row--done" : "",
                r.state === "locked" ? "j-row--locked" : "",
              ].filter(Boolean).join(" ");
              const label = r.label || "Unbenannte Mission";
              return (
                <button
                  key={r.id}
                  className={cls}
                  onClick={() => setSel(r.id)}
                  style={{ position: "relative", display: "block", width: "100%", minHeight: 26, marginBottom: 4, textAlign: "left", padding: "4px 8px" }}
                >
                  <span className="truncate" style={{ display: "block", maxWidth: "100%" }}>
                    {r.state === "done" ? "✓ " : ""}{label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--hud-text-dim)", maxWidth: 260, lineHeight: 1.7 }}>
          normal = light text on navy fill · hover = cyan brighten · selected = cyan ring + glow · completed = green (not glaring) · locked = dimmed but readable. Empty title falls back to <em>Unbenannte Mission</em>.
        </div>
      </Section>

      <Section title="Reward cards & divider">
        <div className="panel" style={{ padding: 14, width: 320 }}>
          <div style={{ textAlign: "center", fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, letterSpacing: "0.3em", color: "var(--hud-cyan)", textShadow: "0 0 8px rgba(78,226,255,0.6)", marginBottom: 8 }}>REWARD</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["CREDITS", "12.4K"], ["HONOR", "180"], ["TIER", "3"], ["XP", "3.2K"]].map(([l, v]) => (
              <div key={l} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(78,226,255,0.73)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{l}</div>
                <div style={{ fontSize: 14, color: "var(--hud-cyan)", fontFamily: "var(--font-display)", fontWeight: 700, textShadow: "0 0 9px rgba(78,226,255,0.6)" }}>{v}</div>
              </div>
            ))}
          </div>
          <HudDivider />
          <div style={{ color: "var(--ui-text-secondary)", fontSize: 11, fontFamily: "var(--font-display)", letterSpacing: "0.05em", lineHeight: 1.7, textTransform: "uppercase" }}>
            SECTOR [Bounty] Alpha Sector — TARGET: Raider Scout × 8 · PROGRESS 5/8
          </div>
          <div className="overflow-hidden" style={{ height: 5, background: "rgba(78,226,255,0.12)", margin: "8px 0 0" }}>
            <div style={{ height: "100%", width: "62%", background: "var(--hud-cyan)", boxShadow: "0 0 6px rgba(78,226,255,0.53)" }} />
          </div>
        </div>
      </Section>

      <Section title="Tooltip (.gtip — cyan, no orange leak)">
        <div className="gtip" style={{ position: "relative", width: 240, whiteSpace: "pre-line" }}>
          {"Plasma Repeater Mk III\nRapid-fire energy weapon.\nDamage +42 · Rate ×1.30\nEquip a Munitions Bay for +capacity."}
        </div>
      </Section>

      <Section title="Modal">
        <HudButton variant="primary" onClick={() => setShowDialog(true)}>Open modal dialog</HudButton>
      </Section>

      {showDialog && (
        <HudDialog
          title="Confirm Entry"
          onClose={() => setShowDialog(false)}
          gold
          footer={<>
            <HudButton variant="secondary" onClick={() => setShowDialog(false)}>Cancel</HudButton>
            <HudButton variant="primary" onClick={() => setShowDialog(false)}>Enter Rift</HudButton>
          </>}
        >
          <div style={{ padding: "14px 16px", color: "var(--ui-text-primary)", fontSize: 12, lineHeight: 1.6 }}>
            This modal, its backdrop, frame, title band and buttons are all unified primitives — nothing hand-rolled, no off-theme blue or grey.
          </div>
        </HudDialog>
      )}
    </div>
  );
}
