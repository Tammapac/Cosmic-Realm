// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, I-06 ·
// ZONE MAP section, lines ~2804-3008). This is "the minimap at full size" —
// a LOCAL contact map for the CURRENT zone (sites, asteroid belt, players,
// enemies, cargo, as blips around your ship) — NOT the zone-to-zone travel
// picker (that's GalaxyMapPanel.tsx / state.showMap, opened by the minimap's
// MAP button). The two were previously conflated into one component built
// from the wrong Kit section (N-01's sector-chart popup); this is the
// correct, separate I-06 build. Opened with the M key.
//
// Same scope language as the minimap (N-01), scaled up: sweep-free static
// range rings, scanlines, vignette, boot-scan line. Sites (stations) sit on
// hexagon plates, ships/asteroids/cargo are bare blips. Range switches ring
// spacing and rescales every contact around the player — anything outside
// the selected range falls off the edge, exactly like the Kit's own
// description ("Range switches the ring spacing and rescales every contact
// around your ship — anything outside the ring falls off the edge").
import { useEffect, useMemo, useState } from "react";
import { useGame, useGameSlow, state as gameState, bump } from "../game/store";
import { ZONES, RESOURCES, STATIONS, PORTALS, FACTIONS, SHIP_CLASSES, type ZoneId } from "../game/types";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { usePressable } from "./hud/usePressable";

const metalRim = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";
const metalRimStyle = { backgroundSize: "cover, 400% 400%", backgroundPosition: "center, 100% 0%" } as const;

// Every keyframe this panel uses, injected locally — keyframes aren't
// defined in any shared/global stylesheet, and relying on another mounted
// panel to happen to provide them was the exact bug fixed repeatedly this
// session for Hotbar/Minimap/GalaxyMap.
const ZONE_MAP_KEYFRAMES = `
@keyframes cPulse{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes cPing{0%{opacity:.75;transform:translate(-50%,-50%) scale(.3)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.4)}}
@keyframes cBlip{0%,100%{opacity:.45;transform:rotate(45deg) scale(1)}50%{opacity:1;transform:rotate(45deg) scale(1.4)}}
/* translateY, not top. Animating top is a LAYOUT property, so the browser
   re-lays-out and repaints the whole map every frame for the full 6.5s cycle —
   with dozens of contact markers inside, that is the most expensive thing on
   this panel. transform is composited on the GPU and touches nothing else.
   Percentages here are relative to the element's own 26% height. */
@keyframes cBootScan{0%{transform:translateY(-38%);opacity:0}12%{opacity:1}100%{transform:translateY(415%);opacity:0}}
@keyframes cGmHere{0%,100%{opacity:.55;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
`;

// Continuous mouse-wheel zoom instead of 3 discrete range steps — range is
// the world-space half-width shown on the scope, clamped to a sane min/max.
const RANGE_MIN = 300;
const RANGE_MAX = 6000;
const RANGE_DEFAULT = 1600;
// Scope height. The Kit's I-06 scope is 834px, but the Kit renders on an
// unbounded catalogue page while this is an overlay on top of the game:
// 834 + header + frame + margins lands at ~1016px and fills a 1080p screen
// edge to edge. Use the Kit value as an UPPER BOUND, clamped to what fits.
// The 300px budget covers header, frame, padding, outer margins AND leaves
// visible game around the window — an overlay should not fill the screen.
// Lower bound 420px: the sidebar's fixed blocks (zone header, detail card,
// distance/bearing tiles, CONTACTS header, action slot) need ~404px. Below
// that the sidebar clips; the contact list scrolls for anything beyond.
const SCOPE_H = "clamp(420px, 66vh, 834px)";

const RING_PCTS = [16, 26, 36]; // fixed ring positions; the grid/contacts rescale around them instead

type ContactKind = "site" | "portal" | "player" | "enemy" | "resource" | "loot";
type Contact = {
  id: string;
  kind: ContactKind;
  name: string;
  tag: string;
  hex: string;
  x: number; // world
  y: number; // world
  pick: () => void;
};

const KIND_HEX: Record<ContactKind, string> = {
  site: "#9fe0ff",
  portal: "#b866ff",
  player: "#5cff8a",
  enemy: "#ff4d5e",
  resource: "#e8b94d",
  loot: "#4ee2ff",
};
const KIND_GLYPH: Record<ContactKind, string> = { site: "◆", portal: "◈", player: "▲", enemy: "✦", resource: "◆", loot: "◆" };

function FilterButton({ label, hex, active, onClick }: { label: string; hex: string; active: boolean; onClick: () => void }) {
  const { hover, active: pressed, handlers } = usePressable();
  const wash = active ? `${hex}33` : hover ? `${hex}1a` : "transparent";
  const railGlow = active ? `0 0 8px ${hex}` : "none";
  return (
    <button
      onClick={onClick} aria-label={label} {...handlers}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 7, padding: "7px 13px 8px", border: "none", cursor: "pointer", overflow: "hidden",
        background: active ? `linear-gradient(180deg,${hex}22,rgba(8,10,16,.9))` : "rgba(8,10,16,.7)",
        boxShadow: active ? `inset 0 0 0 1px ${hex}88` : "inset 0 0 0 1px rgba(255,255,255,.06)",
        clipPath: "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))",
        transform: pressed ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        filter: pressed ? "brightness(1.34)" : hover ? "brightness(1.18)" : "none",
        transition: "transform .15s cubic-bezier(.2,.9,.25,1),background .24s ease,box-shadow .24s ease",
      }}
    >
      <i style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2, background: hex, boxShadow: railGlow }} />
      <i style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 50% 0%,${wash},transparent 72%)`, pointerEvents: "none" }} />
      <i style={{ width: 7, height: 7, flex: "0 0 auto", background: hex, boxShadow: `0 0 9px ${hex}`, opacity: active ? 1 : 0.4, transform: "rotate(45deg)" }} />
      <small style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: 12.4, letterSpacing: "0.2em", color: active ? "#eaf4ff" : "rgba(190,214,236,.6)" }}>{label}</small>
    </button>
  );
}

function ContactRow({ c, isSelected, onPick }: { c: Contact; isSelected: boolean; onPick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const dist = Math.round(Math.hypot(c.x, c.y));
  return (
    <button
      onClick={onPick} aria-label={c.name} {...handlers}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", border: "none", textAlign: "left", cursor: "pointer",
        background: isSelected ? `${c.hex}22` : "rgba(255,255,255,.02)",
        boxShadow: "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.6),inset 0 2px 4px rgba(0,0,0,.42)",
        clipPath: "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))",
        transform: active ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        filter: active ? "brightness(1.4)" : hover ? "brightness(1.22)" : "none",
        transition: "transform .14s cubic-bezier(.2,.9,.25,1),background .2s ease",
      }}
    >
      <i style={{ width: 5, height: 5, flex: "0 0 auto", background: c.hex, boxShadow: `0 0 7px ${c.hex}`, transform: "rotate(45deg)" }} />
      <small style={{ flex: 1, minWidth: 0, fontSize: 11.8, color: "#eaf3ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</small>
      <small style={{ flex: "0 0 auto", fontFamily: "var(--font-mono)", fontSize: 12.4, fontVariantNumeric: "tabular-nums", color: c.hex }}>{dist}m</small>
    </button>
  );
}

export function ZoneMapPanel() {
  const show = useGame((s) => s.showZoneMap);
  const player = useGame((s) => s.player);
  const selectedWorldTarget = useGame((s) => s.selectedWorldTarget);
  const enemies = useGameSlow((s) => s.enemies);
  const others = useGameSlow((s) => s.others);
  const asteroids = useGameSlow((s) => s.asteroids);
  const cargoBoxes = useGameSlow((s) => s.cargoBoxes);

  const [playToken] = useState(0);
  const [mounted, setMounted] = useState(show);
  const [closing, setClosing] = useState(false);
  const [range, setRange] = useState(RANGE_DEFAULT);
  const [filters, setFilters] = useState<Record<ContactKind, boolean>>({ site: true, portal: true, player: true, enemy: true, resource: true, loot: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (show) { setMounted(true); setClosing(false); }
    else if (mounted) { setClosing(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const zoneDef = ZONES[player.zone as ZoneId];
  const rings = RING_PCTS;

  const contacts: Contact[] = useMemo(() => {
    const list: Contact[] = [];
    for (const s of STATIONS) {
      if (s.zone !== player.zone) continue;
      list.push({
        id: `station:${s.id}`, kind: "site", name: s.name, tag: s.kind.toUpperCase(),
        hex: KIND_HEX.site, x: s.pos.x - player.pos.x, y: s.pos.y - player.pos.y,
        pick: () => { gameState.cameraTarget = { x: s.pos.x, y: s.pos.y }; bump(); window.dispatchEvent(new Event("cr-input-flush")); },
      });
    }
    for (const p of PORTALS) {
      if (p.fromZone !== player.zone) continue;
      const dest = ZONES[p.toZone];
      list.push({
        id: `portal:${p.id}`, kind: "portal", name: `PORTAL → ${dest?.name.toUpperCase() ?? p.toZone.toUpperCase()}`, tag: "PORTAL",
        hex: KIND_HEX.portal, x: p.pos.x - player.pos.x, y: p.pos.y - player.pos.y,
        pick: () => { gameState.cameraTarget = { x: p.pos.x, y: p.pos.y }; bump(); window.dispatchEvent(new Event("cr-input-flush")); },
      });
    }
    for (const e of enemies) {
      if (e.hull <= 0) continue;
      list.push({
        id: `enemy:${e.id}`, kind: "enemy", name: e.name ?? e.type.toUpperCase(), tag: e.type.toUpperCase(),
        hex: KIND_HEX.enemy, x: e.pos.x - player.pos.x, y: e.pos.y - player.pos.y,
        pick: () => {
          gameState.selectedWorldTarget = { kind: "enemy", id: e.id, name: e.name ?? e.type.toUpperCase(), detail: `${e.type.toUpperCase()} · ${Math.max(0, Math.round(e.hull))}/${Math.round(e.hullMax)} HP` };
          gameState.attackTargetId = e.id; gameState.miningTargetId = null; gameState.selectedPlayerId = null;
          setSelectedId(`enemy:${e.id}`); bump();
        },
      });
    }
    for (const o of others) {
      list.push({
        id: `player:${o.id}`, kind: "player", name: o.name, tag: (SHIP_CLASSES[o.shipClass]?.name ?? o.shipClass).toUpperCase(),
        hex: (o.faction && FACTIONS[o.faction as keyof typeof FACTIONS]?.color) || KIND_HEX.player,
        x: o.pos.x - player.pos.x, y: o.pos.y - player.pos.y,
        pick: () => {
          gameState.selectedPlayerId = o.id;
          gameState.selectedWorldTarget = { kind: "player", id: o.id, name: o.name, detail: `${(SHIP_CLASSES[o.shipClass]?.name ?? o.shipClass).toUpperCase()} · LV ${o.level}` };
          setSelectedId(`player:${o.id}`); bump();
        },
      });
    }
    for (const a of asteroids) {
      if (a.zone !== player.zone) continue;
      const r = RESOURCES[a.yields];
      list.push({
        id: `asteroid:${a.id}`, kind: "resource", name: (r?.name ?? "Ore").toUpperCase() + " ROCK", tag: "ASTEROID",
        hex: KIND_HEX.resource, x: a.pos.x - player.pos.x, y: a.pos.y - player.pos.y,
        pick: () => {
          gameState.selectedWorldTarget = { kind: "asteroid", id: a.id, name: (r?.name ?? "Ore").toUpperCase() + " ROCK", detail: `${Math.round(a.hp)}/${Math.round(a.hpMax)} HP` };
          gameState.miningTargetId = a.id;
          setSelectedId(`asteroid:${a.id}`); bump();
        },
      });
    }
    for (const cb of cargoBoxes) {
      list.push({
        id: `cargo:${cb.id}`, kind: "loot", name: (RESOURCES[cb.resourceId]?.name ?? "Cargo").toUpperCase(), tag: "CARGO",
        hex: KIND_HEX.loot, x: cb.pos.x - player.pos.x, y: cb.pos.y - player.pos.y,
        pick: () => { gameState.cameraTarget = { x: cb.pos.x, y: cb.pos.y }; bump(); window.dispatchEvent(new Event("cr-input-flush")); },
      });
    }
    return list.filter((c) => filters[c.kind]);
  }, [player.zone, player.pos.x, player.pos.y, enemies, others, asteroids, cargoBoxes, filters]);

  const inRange = contacts.filter((c) => Math.hypot(c.x, c.y) <= range);
  const selected = inRange.find((c) => c.id === selectedId) ?? null;

  if (!mounted) return null;

  const close = () => { gameState.showZoneMap = false; bump(); };
  const onPortalClosed = () => { setMounted(false); setClosing(false); };

  const targetName = selectedWorldTarget?.kind === "enemy" || selectedWorldTarget?.kind === "asteroid" ? selectedWorldTarget.name : null;
  const lockedIsSelected = selected && selectedWorldTarget && (
    (selected.kind === "enemy" && selectedWorldTarget.kind === "enemy" && selectedWorldTarget.id === selected.id.slice(6)) ||
    (selected.kind === "resource" && selectedWorldTarget.kind === "asteroid" && selectedWorldTarget.id === selected.id.slice(9)) ||
    (selected.kind === "player" && selectedWorldTarget.kind === "player" && selectedWorldTarget.id === selected.id.slice(7))
  );

  const toWorld = (localX: number, localY: number, w: number, h: number) => {
    const dx = ((localX - w / 2) / (w / 2)) * range;
    const dy = ((localY - h / 2) / (h / 2)) * range;
    return { x: player.pos.x + dx, y: player.pos.y + dy };
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "grid", placeItems: "center", background: "rgba(2,4,12,.7)" }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <style>{ZONE_MAP_KEYFRAMES}</style>
      <PrintPortal
        playToken={playToken}
        accent="#4ee2ff"
        duration={1300}
        chamfer={34}
        closing={closing}
        onClosed={closing ? onPortalClosed : undefined}
        style={{ width: "min(94vw, 1180px)" }}
      >
        <div style={{ position: "relative", padding: 18, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px rgba(78,226,255,.18))" }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: "#05070d", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 0, display: "block", background: "rgba(78,226,255,.5)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "rgba(234,252,255,.65)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "rgba(5,3,10,.7)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "rgba(157,233,255,.45)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "rgba(5,3,10,.65)", clipPath: "polygon(0 0,calc(100% - 29.32px) 0,100% 29.32px,100% 100%,29.32px 100%,0 calc(100% - 29.32px))" }} />
          <i style={{ position: "absolute", inset: 10, display: "block", background: "rgba(63,168,196,.3)", clipPath: "polygon(0 0,calc(100% - 28.15px) 0,100% 28.15px,100% 100%,28.15px 100%,0 calc(100% - 28.15px))" }} />
          <i style={{ position: "absolute", inset: 12, display: "block", background: "rgba(5,3,10,.6)", clipPath: "polygon(0 0,calc(100% - 26.98px) 0,100% 26.98px,100% 100%,26.98px 100%,0 calc(100% - 26.98px))" }} />
          <i style={{ position: "absolute", inset: 14, display: "block", background: "rgba(22,74,92,.25)", clipPath: "polygon(0 0,calc(100% - 25.81px) 0,100% 25.81px,100% 100%,25.81px 100%,0 calc(100% - 25.81px))" }} />
          <i style={{ position: "absolute", inset: 16, display: "block", background: "rgba(5,3,10,.55)", clipPath: "polygon(0 0,calc(100% - 24.64px) 0,100% 24.64px,100% 100%,24.64px 100%,0 calc(100% - 24.64px))" }} />

          <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 12, padding: "14px 15px 15px", overflow: "hidden", background: "linear-gradient(150deg,#233047,#0a0e16)", boxShadow: "inset 0 5px 12px rgba(0,0,0,.6),inset 0 0 0 1px rgba(5,3,10,.6),inset 0 -2px 0 rgba(157,233,255,.2)", clipPath: "polygon(0 0,calc(100% - 23.47px) 0,100% 23.47px,100% 100%,23.47px 100%,0 calc(100% - 23.47px))" }}>
            <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.04) 11px 12px,transparent 12px 23px)", pointerEvents: "none" }} />

            {/* header */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "0 1px 10px", borderBottom: "1px solid rgba(0,0,0,.55)", boxShadow: "0 1px 0 rgba(157,233,255,.14)" }}>
              <i style={{ width: 7, height: 7, flex: "0 0 auto", background: "#ff4d5e", boxShadow: "0 0 10px #ff4d5e", transform: "rotate(45deg)", animation: "cPulse 1.9s ease-in-out infinite" }} />
              <b style={{ fontFamily: "var(--font-display)", fontSize: 14.2, letterSpacing: "0.24em", color: "#dff3ff" }}>ZONE MAP</b>
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 12.4, letterSpacing: "0.1em", color: "rgba(190,218,242,.72)" }}>{zoneDef?.name.toUpperCase() ?? player.zone.toUpperCase()} · {zoneDef?.label ?? ""}</small>
              <span style={{ padding: "3px 8px", fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.16em", color: "#ffd0d5", background: "rgba(255,77,94,.16)", boxShadow: "inset 0 0 0 1px rgba(255,77,94,.45)" }}>CONTESTED</span>
              <span style={{ flex: 1 }} />
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 10.6, letterSpacing: "0.08em", color: "rgba(157,242,255,.75)" }}>{inRange.length} CONTACTS</small>
              <CloseButton onClick={close} title="Close" size={24} fontSize={10} />
            </div>

            {/* The panel must not resize as its content changes. The sidebar
                holds two conditional blocks (the selected-contact card and the
                DISTANCE/BEARING tiles) plus a contact list that varies with
                what is in range, so with `alignItems:"start"` the column — and
                with it the whole window — grew and shrank on every click.
                Fixing the row height to the scope's own height (520px, set on
                the map below) and letting the sidebar scroll internally keeps
                the outer frame constant. */}
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "290px 1fr", gap: 14, alignItems: "stretch", gridAutoRows: SCOPE_H }}>

              {/* sidebar */}
              <div style={{ position: "relative", display: "grid", gap: 9, gridTemplateRows: "auto auto auto minmax(0,1fr) auto", padding: "24px 22px", boxSizing: "border-box", height: "100%", overflow: "hidden", border: "2px solid rgba(78,226,255,.5)", background: "linear-gradient(150deg,#233047,#0a0e16)", boxShadow: "inset 0 0 0 2px rgba(234,252,255,.65),inset 0 0 0 4px rgba(5,3,10,.7),inset 0 0 0 6px rgba(157,233,255,.45),inset 0 0 0 8px rgba(5,3,10,.65),inset 0 0 0 10px rgba(63,168,196,.3),inset 0 0 0 12px rgba(5,3,10,.6),inset 0 0 0 14px rgba(22,74,92,.25),inset 0 0 0 16px rgba(5,3,10,.55)" }}>
                <div style={{ position: "relative", display: "grid", gap: 5, padding: "11px 12px 12px", overflow: "hidden", background: "radial-gradient(130% 100% at 50% 0%,rgba(78,226,255,.16),transparent 74%),linear-gradient(180deg,#0e1522,#05080e)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 rgba(157,233,255,.2)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                  <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(140,190,220,.05) 0 1px,transparent 1px 3px)", pointerEvents: "none" }} />
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
                    <small style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 12.4, letterSpacing: "0.26em", color: "rgba(196,222,246,.72)" }}>CURRENT ZONE</small>
                    <small style={{ padding: "2px 7px", fontFamily: "var(--font-display)", fontSize: 12.4, letterSpacing: "0.16em", color: "#ffd0d5", background: "rgba(255,77,94,.16)", boxShadow: "inset 0 0 0 1px rgba(255,77,94,.45)" }}>CONTESTED</small>
                  </div>
                  <b style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: 17.7, letterSpacing: "0.12em", color: "#9fe0ff", textShadow: "0 0 12px rgba(78,226,255,.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{zoneDef?.name.toUpperCase() ?? player.zone.toUpperCase()}</b>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 7 }}>
                    <small style={{ padding: "2px 7px", fontFamily: "var(--font-display)", fontSize: 12.4, letterSpacing: "0.16em", color: "#4ea3ff", background: "rgba(78,163,255,.16)", boxShadow: "inset 0 0 0 1px rgba(78,163,255,.42)" }}>{zoneDef?.faction ? FACTIONS[zoneDef.faction]?.tag : "—"}</small>
                    <small style={{ fontFamily: "var(--font-mono)", fontSize: 12.4, letterSpacing: "0.06em", color: "rgba(196,222,246,.72)" }}>{zoneDef?.label ?? ""} · T{zoneDef?.enemyTier ?? 0}</small>
                  </div>
                </div>

                {selected ? (
                  <div style={{ position: "relative", display: "grid", gap: 7, alignContent: "start", height: 72, boxSizing: "border-box", padding: "11px 12px 12px", overflow: "hidden", background: `radial-gradient(120% 100% at 50% 0%,${selected.hex}22,transparent 72%),linear-gradient(180deg,#0c1019,#05080e)`, boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <i style={{ width: 6, height: 6, flex: "0 0 auto", background: selected.hex, boxShadow: `0 0 9px ${selected.hex}`, transform: "rotate(45deg)" }} />
                      <b style={{ flex: 1, fontSize: 15.3, fontWeight: 700, color: "#f0f6ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.name}</b>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <small style={{ padding: "3px 7px", fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.18em", color: selected.hex, background: `${selected.hex}22`, boxShadow: `inset 0 0 0 1px ${selected.hex}55` }}>{selected.kind.toUpperCase()}</small>
                      <small style={{ fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(196,222,246,.78)" }}>{selected.tag}</small>
                    </div>
                  </div>
                ) : (
                  <div style={{ position: "relative", display: "grid", gap: 5, alignContent: "center", height: 72, boxSizing: "border-box", padding: "11px 12px 12px", background: "linear-gradient(180deg,#0c1019,#05080e)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                    <small style={{ fontSize: 11.8, color: "rgba(190,214,236,.5)" }}>No contact selected — pick one below or on the scope.</small>
                  </div>
                )}

                {/* Always rendered: these tiles used to appear only with a
                    selection, so picking a contact pushed everything below them
                    down. Values fall back to em dashes instead. */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div style={{ display: "grid", gap: 2, padding: "7px 9px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
                      <small style={{ fontFamily: "var(--font-display)", fontSize: 12.4, letterSpacing: "0.2em", color: "rgba(196,222,246,.78)" }}>DISTANCE</small>
                      <b style={{ fontFamily: "var(--font-mono)", fontSize: 14.2, fontVariantNumeric: "tabular-nums", color: "#9df2ff" }}>{selected ? `${Math.round(Math.hypot(selected.x, selected.y))}m` : "—"}</b>
                    </div>
                    <div style={{ display: "grid", gap: 2, padding: "7px 9px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
                      <small style={{ fontFamily: "var(--font-display)", fontSize: 12.4, letterSpacing: "0.2em", color: "rgba(196,222,246,.78)" }}>BEARING</small>
                      <b style={{ fontFamily: "var(--font-mono)", fontSize: 14.2, fontVariantNumeric: "tabular-nums", color: "#f2f8ff" }}>{selected ? `${Math.round(((Math.atan2(selected.x, -selected.y) * 180) / Math.PI + 360) % 360)}°` : "—"}</b>
                    </div>
                </div>

                <div style={{ display: "grid", gap: 5, gridTemplateRows: "auto minmax(0,1fr)", minHeight: 0 }}>
                  <small style={{ padding: "0 1px", fontFamily: "var(--font-display)", fontSize: 12.4, letterSpacing: "0.22em", color: "rgba(196,222,246,.78)" }}>CONTACTS</small>
                  <div style={{ display: "grid", gap: 3, alignContent: "start", minHeight: 0, overflowY: "auto" }}>
                    {inRange.length === 0 && <small style={{ fontSize: 10.6, color: "rgba(190,214,236,.4)", padding: "4px 2px" }}>No contacts in range.</small>}
                    {inRange.map((c) => (
                      <ContactRow key={c.id} c={c} isSelected={selectedId === c.id} onPick={() => { c.pick(); setSelectedId(c.id); }} />
                    ))}
                  </div>
                </div>

                {/* Fixed-height action slot. Both buttons are conditional, so
                    without a reserved area the contact list above them shifted
                    every time a contact was selected or cleared.
                    38px + 9px gap + 38px = 85px. */}
                <div style={{ display: "grid", gap: 9, alignContent: "start", height: 85 }}>
                {selected && (
                  <button
                    onClick={() => { gameState.cameraTarget = { x: player.pos.x + selected.x, y: player.pos.y + selected.y }; bump(); window.dispatchEvent(new Event("cr-input-flush")); }}
                    aria-label={`Fly to ${selected.name}`}
                    style={{ position: "relative", display: "grid", placeItems: "center", height: 38, marginTop: 1, padding: 0, border: "none", cursor: "pointer", background: "linear-gradient(150deg,#e6eefa,#8e9aab 42%,#39424f 72%,#1a212c)", clipPath: "polygon(0 0,calc(100% - 11px) 0,100% 11px,100% 100%,11px 100%,0 calc(100% - 11px))", filter: `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 6px 7px rgba(0,0,0,.7)) drop-shadow(0 0 16px ${selected.hex}88)` }}
                  >
                    <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#5c6878,#161b22)", clipPath: "polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))" }} />
                    <i style={{ position: "absolute", inset: 3, display: "block", background: `linear-gradient(180deg,${selected.hex}33,rgba(8,10,16,.96))`, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,236,190,.16)", clipPath: "polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,9px 100%,0 calc(100% - 9px))" }} />
                    <i style={{ position: "absolute", left: 8, right: 8, top: 3.5, height: 1, display: "block", background: "linear-gradient(90deg,transparent,rgba(255,244,214,.75),transparent)" }} />
                    <i style={{ position: "absolute", left: 8, right: 8, bottom: 3.5, height: 2, display: "block", background: `linear-gradient(90deg,transparent,${selected.hex},transparent)` }} />
                    <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
                      <i style={{ fontStyle: "normal", fontSize: 11.8, color: selected.hex }}>▸</i>
                      <b style={{ fontFamily: "var(--font-display)", fontSize: 12.4, letterSpacing: "0.2em", color: "#eaf4ff", textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>FLY TO</b>
                    </span>
                  </button>
                )}

                {selected && (selected.kind === "enemy" || selected.kind === "resource" || selected.kind === "player") && (
                  <button
                    onClick={() => selected.pick()}
                    aria-label={`Lock ${selected.name}`}
                    disabled={!!lockedIsSelected}
                    style={{
                      position: "relative", display: "grid", placeItems: "center", height: 34, padding: 0, border: "none", cursor: lockedIsSelected ? "default" : "pointer",
                      background: "linear-gradient(150deg,#e6eefa,#8e9aab 42%,#39424f 72%,#1a212c)",
                      clipPath: "polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,9px 100%,0 calc(100% - 9px))",
                      filter: `drop-shadow(0 2px 0 rgba(3,5,10,.9)) drop-shadow(0 5px 6px rgba(0,0,0,.65)) drop-shadow(0 0 ${lockedIsSelected ? 16 : 6}px ${lockedIsSelected ? "rgba(255,77,94,.7)" : "rgba(157,233,255,.3)"})`,
                    }}
                  >
                    <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#5c6878,#161b22)", clipPath: "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))" }} />
                    <i style={{ position: "absolute", inset: 3, display: "block", background: lockedIsSelected ? "linear-gradient(180deg,rgba(255,77,94,.32),rgba(8,10,16,.96))" : "linear-gradient(180deg,rgba(78,226,255,.16),rgba(8,10,16,.96))", boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(220,238,255,.14)", clipPath: "polygon(0 0,calc(100% - 7px) 0,100% 7px,100% 100%,7px 100%,0 calc(100% - 7px))" }} />
                    <i style={{ position: "absolute", left: 7, right: 7, top: 3.5, height: 1, display: "block", background: "linear-gradient(90deg,transparent,rgba(235,245,255,.55),transparent)" }} />
                    <i style={{ position: "absolute", left: 7, right: 7, bottom: 3.5, height: 2, display: "block", background: lockedIsSelected ? "linear-gradient(90deg,transparent,#ff4d5e,transparent)" : "linear-gradient(90deg,transparent,rgba(157,233,255,.4),transparent)" }} />
                    <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 7 }}>
                      <i style={{ fontStyle: "normal", fontSize: 11.8, color: lockedIsSelected ? "#ffd0d5" : "#9fe0ff" }}>{lockedIsSelected ? "◉" : "◎"}</i>
                      <b style={{ fontFamily: "var(--font-display)", fontSize: 11.8, letterSpacing: "0.2em", color: lockedIsSelected ? "#ffd0d5" : "#eaf4ff", textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>{lockedIsSelected ? "LOCKED" : "LOCK"}</b>
                    </span>
                  </button>
                )}
                </div>
              </div>

              {/* scope */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const wp = toWorld(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
                  gameState.cameraTarget = wp; bump(); window.dispatchEvent(new Event("cr-input-flush"));
                }}
                onWheel={(e) => {
                  e.preventDefault();
                  // Continuous zoom: wheel down = zoom out (bigger range),
                  // wheel up = zoom in (smaller range) — matches every
                  // other scroll-to-zoom control (maps, editors).
                  setRange((r) => Math.max(RANGE_MIN, Math.min(RANGE_MAX, r * (e.deltaY > 0 ? 1.15 : 1 / 1.15))));
                }}
                style={{ position: "relative", cursor: "crosshair", height: SCOPE_H, overflow: "hidden", background: "radial-gradient(circle at 50% 50%,#0b1a29,#05080f 62%,#02040a)", boxShadow: "inset 0 6px 14px rgba(0,0,0,.8),inset 0 0 0 1px rgba(0,0,0,.7),inset 0 0 40px rgba(78,226,255,.1),inset 0 -2px 0 rgba(157,233,255,.16)" }}
              >
                <i style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg,rgba(78,226,255,.07) 0 1px,transparent 1px 32px),repeating-linear-gradient(90deg,rgba(78,226,255,.07) 0 1px,transparent 1px 32px)", pointerEvents: "none" }} />
                {rings.map((pct, i) => (
                  <i key={i} style={{ position: "absolute", left: "50%", top: "50%", width: `${pct * 2}%`, height: `${pct * 2}%`, border: `1px solid rgba(78,226,255,${0.16 - i * 0.02})`, borderRadius: "50%", transform: "translate(-50%,-50%)", transition: "width .3s cubic-bezier(.2,.9,.25,1),height .3s cubic-bezier(.2,.9,.25,1)", pointerEvents: "none" }} />
                ))}

                {inRange.map((c) => {
                  const leftPct = 50 + (c.x / range) * 50;
                  const topPct = 50 + (c.y / range) * 50;
                  const isSel = selectedId === c.id;
                  const size = c.kind === "site" ? 24 : 14;
                  return (
                    <div
                      key={c.id}
                      style={{ position: "absolute", left: `${leftPct}%`, top: `${topPct}%`, width: size, height: size, zIndex: isSel ? 10 : 2, transform: "translate(-50%,-50%)" }}
                    >
                      {isSel && <i style={{ position: "absolute", inset: -10, border: `1px solid ${c.hex}`, borderRadius: "50%", animation: "cPing 2.4s ease-out infinite", pointerEvents: "none" }} />}
                      <button
                        onClick={(e) => { e.stopPropagation(); c.pick(); setSelectedId(c.id); }}
                        aria-label={c.name} title={c.name}
                        style={{ position: "relative", display: "block", width: "100%", height: "100%", padding: 0, border: "none", background: "none", cursor: "pointer", filter: `drop-shadow(0 2px 0 rgba(3,5,10,.85)) drop-shadow(0 0 8px ${c.hex}88)` }}
                      >
                        {c.kind === "site" ? (
                          <>
                            <i style={{ position: "absolute", inset: 0, background: "linear-gradient(150deg,#e6eefa,#8e9aab 42%,#39424f 72%,#1a212c)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                            <i style={{ position: "absolute", inset: "14%", background: `linear-gradient(180deg,${c.hex}44,rgba(8,10,16,.96))`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                          </>
                        ) : (
                          // Intentionally NOT animated. This renders once PER
                          // CONTACT and a busy zone puts 40+ on screen; an
                          // infinite opacity+scale animation on each gives every
                          // marker its own composited layer and repaints the map
                          // continuously for no informational gain. The selected
                          // contact still pings and the player marker still
                          // pulses — single elements that carry real meaning.
                          <i style={{ position: "absolute", inset: 0, background: c.hex, boxShadow: `0 0 9px ${c.hex},0 0 18px ${c.hex}55`, transform: "rotate(45deg)", opacity: 0.92 }} />
                        )}
                      </button>
                      <span style={{ position: "absolute", left: "50%", top: "calc(100% + 4px)", display: "grid", gap: 1, justifyItems: "center", transform: "translateX(-50%)", whiteSpace: "nowrap", pointerEvents: "none" }}>
                        <b style={{ fontFamily: "var(--font-mono)", fontSize: 11.2, fontWeight: 700, color: "#eaf3ff", textShadow: "0 1px 3px rgba(0,0,0,.95)" }}>{c.name}</b>
                      </span>
                    </div>
                  );
                })}

                {/* player ship, centered */}
                <i style={{ position: "absolute", left: "50%", top: "50%", width: 32, height: 32, border: "1px solid rgba(157,242,255,.4)", borderRadius: "50%", transform: "translate(-50%,-50%)", animation: "cPulse 2.4s ease-in-out infinite", pointerEvents: "none" }} />
                {/* Same +90 deg convention as MinimapPanel/the Pixi world
                    renderer (rotation = angle + PI/2) — angle=0 is
                    math-convention east, the up-drawn triangle needs the
                    extra quarter turn to point the right way. */}
                <i style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, zIndex: 9, margin: "-11px 0 0 -7px", borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderBottom: "18px solid #9fe0ff", transform: `rotate(${((player.angle ?? 0) * 180) / Math.PI + 90}deg)`, transformOrigin: "50% 61%", filter: "drop-shadow(0 0 9px rgba(78,226,255,.95))", pointerEvents: "none" }} />
                <b style={{ position: "absolute", left: "50%", top: "calc(50% + 14px)", transform: "translateX(-50%)", fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.2em", color: "#9fe0ff", textShadow: "0 0 8px rgba(78,226,255,.8)", pointerEvents: "none" }}>YOU</b>

                {/* filters */}
                <div style={{ position: "absolute", left: "50%", top: 12, display: "flex", alignItems: "stretch", gap: 7, padding: "6px 7px", transform: "translateX(-50%)", zIndex: 12, background: "linear-gradient(180deg,rgba(9,14,22,.88),rgba(4,7,12,.82))", boxShadow: "inset 0 1px 0 rgba(220,238,255,.09),inset 0 -1px 0 rgba(0,0,0,.7),0 6px 16px rgba(0,0,0,.55)", clipPath: "polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))" }} onClick={(e) => e.stopPropagation()}>
                  <FilterButton label="SITES" hex={KIND_HEX.site} active={filters.site} onClick={() => setFilters((f) => ({ ...f, site: !f.site }))} />
                  <FilterButton label="PORTALS" hex={KIND_HEX.portal} active={filters.portal} onClick={() => setFilters((f) => ({ ...f, portal: !f.portal }))} />
                  <FilterButton label="PLAYERS" hex={KIND_HEX.player} active={filters.player} onClick={() => setFilters((f) => ({ ...f, player: !f.player }))} />
                  <FilterButton label="HOSTILES" hex={KIND_HEX.enemy} active={filters.enemy} onClick={() => setFilters((f) => ({ ...f, enemy: !f.enemy }))} />
                  <FilterButton label="RESOURCES" hex={KIND_HEX.resource} active={filters.resource} onClick={() => setFilters((f) => ({ ...f, resource: !f.resource }))} />
                </div>

                {/* range readout — zoom is continuous via mouse wheel now,
                    so this is a display only, not a set of step buttons.
                    Sized up from the Kit's original 7-9px for legibility. */}
                <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", zIndex: 12, background: "linear-gradient(180deg,rgba(9,14,22,.9),rgba(4,7,12,.86))", boxShadow: "inset 0 1px 0 rgba(220,238,255,.09),inset 0 -1px 0 rgba(0,0,0,.7),0 6px 16px rgba(0,0,0,.55)", clipPath: "polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))" }} onClick={(e) => e.stopPropagation()}>
                  <small style={{ fontFamily: "var(--font-display)", fontSize: 11.8, letterSpacing: "0.16em", color: "rgba(210,230,250,.85)" }}>RANGE</small>
                  <b style={{ fontFamily: "var(--font-mono)", fontSize: 14.2, fontVariantNumeric: "tabular-nums", color: "#9fe0ff", textShadow: "0 0 6px rgba(78,226,255,.5)" }}>{Math.round(range)}</b>
                  <small style={{ fontSize: 11.8, color: "rgba(190,214,236,.6)" }}>· scroll to zoom</small>
                </div>

                {/* legend — sized up from the Kit's original 6-8px, which
                    read as illegible in-game per user feedback */}
                <div style={{ position: "absolute", left: 12, bottom: 12, display: "flex", flexWrap: "wrap", gap: 12, maxWidth: 340, padding: "8px 12px", zIndex: 12, background: "rgba(4,7,13,.8)", boxShadow: "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.6)", clipPath: "polygon(0 0,calc(100% - 7px) 0,100% 7px,100% 100%,7px 100%,0 calc(100% - 7px))" }} onClick={(e) => e.stopPropagation()}>
                  {(["site", "portal", "player", "enemy", "resource", "loot"] as ContactKind[]).map((k) => (
                    <span key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <i style={{ width: 8, height: 8, background: KIND_HEX[k], boxShadow: `0 0 8px ${KIND_HEX[k]}`, transform: "rotate(45deg)" }} />
                      <small style={{ fontFamily: "var(--font-mono)", fontSize: 12.4, letterSpacing: "0.08em", color: "rgba(210,230,250,.9)" }}>{k.toUpperCase()}</small>
                    </span>
                  ))}
                </div>

                <span style={{ position: "absolute", left: 14, top: 14, display: "grid", gap: 3, fontFamily: "var(--font-mono)", fontSize: 12.4, lineHeight: 1.5, color: "rgba(180,225,245,.75)", pointerEvents: "none" }}>
                  <i style={{ fontStyle: "normal" }}>SCAN 87%</i>
                  <i style={{ fontStyle: "normal" }}>CTS {inRange.length}</i>
                  <i style={{ fontStyle: "normal" }}>RNG {Math.round(range)}</i>
                </span>
                <b style={{ position: "absolute", left: "50%", top: 66, transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(157,242,255,.75)", pointerEvents: "none" }}>N</b>
                <b style={{ position: "absolute", left: "50%", bottom: 52, transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(157,242,255,.4)", pointerEvents: "none" }}>S</b>
                <b style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(157,242,255,.4)", pointerEvents: "none" }}>W</b>
                <b style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(157,242,255,.4)", pointerEvents: "none" }}>E</b>
                <i style={{ position: "absolute", left: 0, right: 0, top: 0, height: "26%", background: "linear-gradient(180deg,transparent,rgba(182,240,255,.07) 62%,rgba(182,240,255,.2))", animation: "cBootScan 6.5s linear infinite", willChange: "transform", pointerEvents: "none" }} />
                <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0 1px,transparent 1px 3px)", pointerEvents: "none" }} />
                <i style={{ position: "absolute", inset: 0, background: "linear-gradient(168deg,rgba(210,240,255,.12) 0%,rgba(210,240,255,.03) 26%,transparent 46%)", pointerEvents: "none" }} />
                <i style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 95% at 50% 46%,transparent 44%,rgba(0,0,0,.6) 100%)", pointerEvents: "none" }} />
              </div>
            </div>
          </div>
        </div>
      </PrintPortal>
    </div>
  );
}
