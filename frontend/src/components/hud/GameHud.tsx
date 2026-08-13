import { PlayerPanelCompact } from "../PlayerPanelCompact";
import { HotbarPanel } from "../HotbarPanel";
import { MinimapPanel } from "../MinimapPanel";
import { ChatPanel } from "../ChatPanel";
import { SideMenu } from "./SideMenu";
import { HexSlotButton } from "./HexSlotButton";
import { useGame, state, bump, toggleClanWindow, toggleExchange, toggleLeaderboard } from "../../game/store";

// Reads the live KitHost2 singleton off window.__kitWindows rather than
// importing kitHost2.ts directly (static OR dynamic). Both import forms
// resolved to a module instance whose module-scope `instance` variable
// was never set by createKitHost2() — that call happens in a SEPARATE
// dynamic import from pixi-renderer-v2-integrated.ts, and Vite dev-server
// HMR query strings (?t=<timestamp>, a fresh one per hot update) can make
// two imports of "the same" file resolve to genuinely distinct module
// instances. The failure was silent: no console error, isOpen() just
// returned false forever. kitHost2.ts now publishes the one real instance
// to window.__kitWindows itself, so every caller reads the same object
// regardless of which URL/query variant loaded them.

/**
 * GameHud — wires the new HUD component set (PlayerPanelCompact, Hotbar,
 * Minimap, ChatPanel, SideMenu) to the real game state, replacing the old
 * TopBar/MiniMap/Hotbar. This is the single integration point between
 * the redesigned HUD and `src/game/store.ts` — every prop below maps a
 * real state field, not demo data.
 *
 * PlayerPanelCompact (top-left) is the Kit's P-01a single-row variant,
 * swapped in for the full two-row P-01 (components/PlayerPanel.tsx, kept
 * in the tree but no longer mounted here) at explicit user direction —
 * same quickslot row, same real data, one line instead of a stacked
 * identity block + separate stat grid. Top-right is the SideMenu: the old
 * boxed MenuPanel's 9 destinations as floating Kit-hexagon slots in a
 * collapsible column (no console casing, icons float on their own
 * shadows and the column opens/closes from a toggle hex).
 */
export function GameHud() {
  const docked = useGame((s) => s.dockedAt);
  // Server-supplied staff flag (welcome event → store.isAdmin). Only decides
  // whether the button is drawn: every admin socket handler re-checks the
  // database on each call and fails closed, so a faked flag opens a console
  // whose actions all come back Unauthorized.
  const isAdmin = useGame((s) => s.isAdmin);

  if (docked) return null;

  const openFlag = (flag: "showInventory" | "showSkillTree" | "showMap" | "showSocial" | "showSettings" | "showCargo" | "showClan") => () => {
    state[flag] = !state[flag];
    bump();
  };
  // No dedicated "missions" flag exists in game state yet — both MenuPanel
  // and PlayerPanel's quickslot wire to the quest tracker toggle as the
  // closest existing equivalent until a real missions panel exists.
  const openMissions = () => {
    state.showQuestTracker = !state.showQuestTracker;
    localStorage.setItem("sf-quest-tracker", state.showQuestTracker ? "on" : "off");
    bump();
  };
  const sideMenu = (
    <SideMenu
      onOpenInventory={openFlag("showInventory")}
      onOpenSkills={openFlag("showSkillTree")}
      onOpenMap={openFlag("showMap")}
      onOpenFriends={openFlag("showSocial")}
      onOpenSettings={openFlag("showSettings")}
      onOpenCargo={openFlag("showCargo")}
      onOpenClan={toggleClanWindow}
      onOpenMissions={openMissions}
      onLogout={() => { state.showLogoutConfirm = true; bump(); }}
    />
  );
  const playerPanel = (
    <PlayerPanelCompact
      onOpenSkills={openFlag("showSkillTree")}
      onOpenExchange={toggleExchange}
      onOpenLeaderboard={toggleLeaderboard}
      onOpenSettings={openFlag("showSettings")}
    />
  );

  // ── Layout ───────────────────────────────────────────────────────
  // PlayerPanel top-left, MenuPanel top-right, Hotbar bottom-center,
  // ChatPanel bottom-left, Minimap bottom-right. pointerEvents:auto
  // per-wrapper (not on the outer container) so empty space between HUD
  // elements still lets clicks reach the game canvas underneath.
  return (
    <>
      <div style={{ position: "fixed", left: 24, top: 48, pointerEvents: "auto" }}>{playerPanel}</div>
      <div style={{ position: "fixed", right: 24, top: 48, pointerEvents: "auto" }}>{sideMenu}</div>
      <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", pointerEvents: "auto" }}><HotbarPanel /></div>
      <div style={{ position: "fixed", left: 24, bottom: 24, pointerEvents: "auto" }}>
        <ChatPanel />
      </div>
      {/* Minimap, with the admin console button sitting to its LEFT. Both live
          in one flex row anchored bottom-right, so the button tracks the
          minimap's edge instead of relying on a hardcoded copy of its width
          (286px * 0.82 scale — a number that has already changed twice).
          alignItems:flex-end keeps the button on the baseline of the minimap
          rather than centred against its 400px-tall console. */}
      <div style={{ position: "fixed", right: 24, bottom: 24, pointerEvents: "auto", display: "flex", alignItems: "flex-end", gap: 10 }}>
        {isAdmin && (
          <HexSlotButton
            glyph="⚙"
            title="Admin console"
            size={44}
            onClick={() => { state.showAdmin = !state.showAdmin; bump(); }}
          />
        )}
        <MinimapPanel />
      </div>
    </>
  );
}
