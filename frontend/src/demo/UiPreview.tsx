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
import { useHudPanel } from "../hooks/useHudPanel";

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

// Demo inventory items — glyph, rarity color, equipped flag, item level.
const INV_DEMO = [
  { g: "⚔", c: "#ffd24a", eq: true,  lvl: 42 },
  { g: "✦", c: "#b866ff", eq: false, lvl: 38 },
  { g: "◈", c: "#4ee2ff", eq: true,  lvl: 40 },
  { g: "⬡", c: "#5cff8a", eq: false, lvl: 31 },
  { g: "☄", c: "#ff8a4e", eq: false, lvl: 28 },
  { g: "◇", c: "#9fb4d4", eq: false, lvl: 22 },
  { g: "✧", c: "#4ee2ff", eq: false, lvl: 19 },
  { g: "⟁", c: "#ff4d5e", eq: false, lvl: 15 },
  { g: "◆", c: "#e8b94d", eq: false, lvl: 12 },
  { g: "▲", c: "#9fb4d4", eq: false, lvl: 8 },
];

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
  const [invSel, setInvSel] = useState(2);

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

      <Section title="Frame scales — window (.panel) vs inner card (.panel-inset)">
        <div className="panel" style={{ width: 260 }}>
          <span className="panel-rim" aria-hidden="true" />
          <div className="hud-titleband" style={{ padding: "7px 12px", letterSpacing: "0.28em" }}>Window · .panel</div>
          <div style={{ padding: "14px 14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ color: "var(--ui-text-primary)", fontSize: 12, lineHeight: 1.6 }}>
              Heavy console frame: crisp cyan edge ring + inner corner brackets. For top-level windows only.
            </div>
            <div className="panel-inset p-3" style={{ ["--edge" as any]: "var(--hud-cyan)" }}>
              <div style={{ color: "var(--ui-text-primary)", fontSize: 11, lineHeight: 1.55 }}>
                Nested <strong>.panel-inset</strong> card — single cyan hairline, no stray inner lines through the text. Reads as machined into the window.
              </div>
            </div>
            <div className="panel-inset panel-inset--gold p-3">
              <div style={{ color: "var(--ui-text-primary)", fontSize: 11, lineHeight: 1.55 }}>
                Gold inset variant for featured / currency rows.
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--hud-text-dim)", maxWidth: 280, lineHeight: 1.7 }}>
          The old problem: the window's inner ring drew two horizontal lines across the body wherever text didn't fill it. Fix: the inner accent is now corner brackets (window) and small nested cards use <strong>.panel-inset</strong> — one hairline, content stays clear.
        </div>
      </Section>

      <Section title="Window motion — open / close choreography (hud-motion.css)">
        <MotionDemo />
      </Section>

      <Section title="Inventory popup — showcase frame + slots (no login needed)">
        <div className="panel" style={{ width: 320, display: "flex", flexDirection: "column" }}>
          <span className="panel-rim" aria-hidden="true" />
          <div className="hud-titleband" style={{ padding: "8px 14px", letterSpacing: "0.3em" }}>
            <span style={{ flex: 1 }}>Inventory · 12</span>
            <button className="gbtn gbtn-red" style={{ padding: "1px 8px", fontSize: 10 }}>✕</button>
          </div>
          {/* category tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--hud-border-dim)" }}>
            {["Alle", "Waffen", "Generatoren", "Module"].map((t, i) => (
              <div key={t} style={{
                flex: 1, padding: "6px 2px", textAlign: "center",
                fontFamily: "var(--font-display)", fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase",
                fontWeight: i === 0 ? 700 : 400,
                color: i === 0 ? "var(--hud-cyan)" : "var(--hud-text-dim)",
                background: i === 0 ? "rgba(78,226,255,0.1)" : "transparent",
                borderBottom: i === 0 ? "2px solid var(--hud-cyan)" : "2px solid transparent",
                textShadow: i === 0 ? "0 0 8px rgba(78,226,255,0.45)" : "none",
              }}>{t}</div>
            ))}
          </div>
          <div style={{ padding: "10px" }}>
            <div className="hud-titleband" style={{ margin: "0 -2px 8px", padding: "3px 8px", fontSize: 10, letterSpacing: "0.24em" }}>
              <span style={{ flex: 1 }}>Waffen</span><span style={{ color: "var(--hud-text-dim)" }}>2 aktiv · 6</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {INV_DEMO.map((it, i) => (
                <div
                  key={i}
                  className={`sw-slot${invSel === i ? " sw-slot--active" : ""}`}
                  onClick={() => setInvSel(invSel === i ? -1 : i)}
                  style={{
                    aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    ["--slot-accent" as any]: invSel === i ? "var(--hud-gold)" : it.eq ? "#5cff8a" : it.c,
                  }}
                >
                  <span style={{ fontSize: 21, color: it.c, textShadow: `0 0 8px ${it.c}66`, lineHeight: 1, position: "relative", zIndex: 2 }}>{it.g}</span>
                  {it.eq && <span style={{ position: "absolute", left: "8%", top: "4%", fontSize: 9, fontWeight: 800, color: "#5cff8a", textShadow: "0 1px 2px #000", zIndex: 2 }}>E</span>}
                  {it.lvl && <span style={{ position: "absolute", right: "8%", bottom: "5%", fontSize: 9, fontWeight: 700, color: "#9fe0ff", textShadow: "0 1px 2px #000", zIndex: 2 }}>{it.lvl}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--hud-text-dim)", maxWidth: 260, lineHeight: 1.7 }}>
          Same console frame + glow rim as the showcase panels, and the slots now use the Hotbar <strong>AbilitySlot</strong> look: sheared cut, brushed-metal border, cyan seam, recessed glass face, corner ticks. Click a slot → gold selected state (like the hotbar). Compare side-by-side with <code>?hud-showcase</code>.
        </div>
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
          <span className="panel-rim" aria-hidden="true" />
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
          <span className="panel-rim" aria-hidden="true" />
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

/**
 * Live demo of the window open/close choreography from hud-motion.css,
 * driven by the same useHudPanel hook the real windows use. Open and close it
 * to see the panel rise, the boot-scan sweep, and the staggered rows.
 */
function MotionDemo() {
  const [open, setOpen] = useState(false);
  const { mounted, className } = useHudPanel(open);

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
      <button className="gbtn gbtn-gold" onClick={() => setOpen((v) => !v)}>
        {open ? "Close window" : "Open window"}
      </button>

      <div style={{ minHeight: 210, minWidth: 300 }}>
        {mounted && (
          <div
            className={`panel ${className}`}
            style={{
              width: 300,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="hud-titleband" style={{ padding: "8px 14px", letterSpacing: "0.3em" }}>
              <span style={{ flex: 1 }}>Cargo manifest</span>
              <button
                className="gbtn gbtn-red"
                style={{ padding: "1px 8px", fontSize: 10 }}
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="hud-stagger" style={{ padding: 12, display: "grid", gap: 6 }}>
              {["Plasma cell ×24", "Titanium plate ×8", "Nav beacon ×1", "Coolant ×12"].map((row) => (
                <div key={row} className="panel-inset" style={{ padding: "7px 10px", fontSize: 12 }}>
                  {row}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 260, fontSize: 12, lineHeight: 1.5, color: "var(--text-dim)" }}>
        One choreography for every window: the panel rises and settles, a bright
        scan line sweeps through once, and rows fan in behind it. Closing plays
        the exit before the window unmounts.
      </div>
    </div>
  );
}
