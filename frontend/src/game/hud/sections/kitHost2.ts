// kitHost2.ts — trägt die neue, modulare Cosmic-UI (kit2/panels + kit2/components).
// Nutzt den mitgelieferten PanelHost direkt statt einer eigenen Registry.
// Fenster, die noch nicht auf das neue Baustein-Muster portiert sind, fallen
// auf die alten selbstständigen kit2/windows-legacy/*.ts-Module zurück — diese
// haben dieselbe {mount(opts): WindowHandle}-Form, also passt PanelHost.register
// unverändert auf beide.
//
// Mount (eine Zeile in hudManager.mountHud()):
//   sections = [ createLoadoutSection(), createKitHost2() ];
//
// Öffnen aus beliebigem Code:
//   import { kitWindows } from "./sections/kitHost2";
//   kitWindows.open("inventory");   kitWindows.toggle("zonemap");

import * as PIXI from "pixi.js";
import type { HudSection } from "../hudManager";
import type { HudTransform } from "../hudLayout";
import { DESIGN_W, DESIGN_H } from "../hudLayout";
import { PanelHost, type PanelHandle } from "../kit2/panels/PanelHost";
import { loadUiAssets, setAssetRoot } from "../kit2/core/assets";
import { mountInventory } from "../kit2/panels/InventoryPanel";
import { buildInventoryOpts } from "./kitData/inventoryData";
import { buildCargoOpts } from "./kitData/cargoData";
import { buildSkillOpts } from "./kitData/skillMatrixData";
import { buildDossierOpts } from "./kitData/dossierData";
import { buildZoneMapOpts } from "./kitData/zoneMapData";
import { buildGalaxyOpts } from "./kitData/galaxyMapData";

setAssetRoot("/assets/cosmic-ui");

export type WindowKey =
  | "inventory" | "cargo" | "skills" | "dossier"
  | "missionlog" | "briefing" | "galaxymap" | "zonemap"
  | "clan" | "clandir" | "clancreate" | "social" | "settings" | "leaderboard";

type LegacyModule = { mount: (opts: any) => PanelHandle };

/** Fenster, die noch nicht auf kit2/panels portiert sind — dynamischer Import
 *  hält sie aus dem Startbundle raus. */
const LEGACY_LOADERS: Partial<Record<WindowKey, () => Promise<LegacyModule>>> = {
  cargo: () => import("../kit2/windows-legacy/I-06-cargo-hold"),
  skills: () => import("../kit2/windows-legacy/I-07-skill-matrix"),
  dossier: () => import("../kit2/windows-legacy/I-12-pilot-dossier"),
  missionlog: () => import("../kit2/windows-legacy/I-08-mission-log"),
  briefing: () => import("../kit2/windows-legacy/I-09-mission-briefing"),
  galaxymap: () => import("../kit2/windows-legacy/I-03-galaxy-map"),
  zonemap: () => import("../kit2/windows-legacy/I-04-zone-map"),
  clan: () => import("../kit2/windows-legacy/I-14-clan-hall"),
  clandir: () => import("../kit2/windows-legacy/I-15-clan-directory"),
  clancreate: () => import("../kit2/windows-legacy/I-16-create-a-clan"),
  social: () => import("../kit2/windows-legacy/I-10-social"),
  settings: () => import("../kit2/windows-legacy/I-11-settings"),
  leaderboard: () => import("../kit2/windows-legacy/I-13-leaderboard"),
};

const DATA_BUILDERS: Partial<Record<WindowKey, () => Record<string, unknown>>> = {
  inventory: buildInventoryOpts,
  cargo: buildCargoOpts,
  skills: buildSkillOpts,
  dossier: buildDossierOpts,
  zonemap: buildZoneMapOpts,
  galaxymap: buildGalaxyOpts,
};

// All hotkeys are OFF. The current Cosmic Kit port lives in the React panels
// (components/CargoPanel.tsx, ClanHallPanel.tsx, ZoneMapPanel.tsx, ... — all
// added on this branch with PrintPortal animations and ClanTabBar); these
// PixiJS windows are the older generation they replace. While both systems
// bound the same keys, one press opened the new panel AND this old window
// behind it, and the pair also fought over Escape.
//
// Nothing is unregistered: the windows stay reachable via
// window.__kitWindows.open("<key>") for reference/debugging, they just no
// longer grab keyboard input.
const HOTKEYS: Record<WindowKey, string> = {
  inventory: "", cargo: "", skills: "", dossier: "",
  missionlog: "", galaxymap: "", zonemap: "",
  clan: "", social: "", leaderboard: "",
  briefing: "", clandir: "", clancreate: "", settings: "",
};

class KitHost2 implements HudSection {
  container: PIXI.Container;
  private host: PanelHost;
  private assetsReady: Promise<void>;

  constructor() {
    this.container = new PIXI.Container();
    this.host = new PanelHost(this.container, { w: DESIGN_W, h: DESIGN_H });
    this.assetsReady = loadUiAssets().catch((err) => {
      console.error("[kitHost2] loadUiAssets failed:", err);
    });

    this.host.register("inventory", () => mountInventory(buildInventoryOpts()), { key: HOTKEYS.inventory });
    for (const key of Object.keys(LEGACY_LOADERS) as WindowKey[]) {
      const hotkey = HOTKEYS[key];
      // register() needs the factory synchronously, but the module loads async —
      // wrap in a small pending-state factory that PanelHost calls once ready.
      this.host.register(key, () => this.mountLegacy(key), hotkey ? { key: hotkey } : {});
    }
  }

  /** Placeholder root shown while a legacy module's dynamic import resolves;
   *  swapped for the real panel the moment it loads. Uses the legacy module's
   *  own default window size for centering so PanelHost.open() doesn't need
   *  to know the real size up front (it's only known post-import). */
  private mountLegacy(key: WindowKey): PanelHandle {
    const root = new PIXI.Container();
    const size = { w: 1020, h: 592 }; // typical kit window size; real root re-centers itself once loaded
    let real: PanelHandle | null = null;
    let destroyed = false;
    const loader = LEGACY_LOADERS[key];
    if (loader) {
      Promise.all([loader(), this.assetsReady]).then(([mod]) => {
        if (destroyed) return;
        const opts = DATA_BUILDERS[key]?.() ?? {};
        real = mod.mount(opts);
        real.root.x = Math.round((real.size.w - size.w) / 2) * -1;
        real.root.y = Math.round((real.size.h - size.h) / 2) * -1;
        root.addChild(real.root);
      });
    }
    return {
      root,
      size,
      // Mirror the real window's visibility onto the wrapper root: PanelHost
      // checks `live.root.visible` to know a close animation has finished,
      // and `live` here is THIS wrapper, not the window inside it.
      update: (dt: number) => {
        real?.update(dt);
        if (real) root.visible = real.root.visible;
      },
      close: () => real?.close(),
      destroy: () => { destroyed = true; real?.destroy(); root.destroy({ children: true }); },
    };
  }

  update(_t: HudTransform, dt: number): void {
    this.host.update(dt);
  }

  destroy(): void {
    this.host.destroy();
    this.container.destroy({ children: true });
  }
}

let instance: KitHost2 | null = null;

export function createKitHost2(): KitHost2 {
  instance = new KitHost2();
  return instance;
}

// Every caller reads through window.__kitWindows rather than closing over
// the local `instance` var. Vite's dev server appends a fresh `?t=<ts>`
// query to a module's URL on each HMR update; a dynamic import() of this
// file from a DIFFERENT source file (e.g. a React component) can resolve
// to a distinct module instance — with its own `instance` still null —
// from the one pixi-renderer-v2-integrated.ts's own dynamic import
// created via createKitHost2(). The symptom was silent: no error, no
// exception, kitWindows.toggle() just no-op'd because that copy's
// `instance` was never set. A single window-level singleton sidesteps the
// whole module-identity question — there's only ever one real KitHost2.
function publishGlobal(): void {
  (window as any).__kitWindows = kitWindows;
}

export const kitWindows = {
  open: (k: WindowKey) => instance && (instance as any).host.open(k),
  close: (k: WindowKey) => instance && (instance as any).host.close(k),
  toggle: (k: WindowKey) => instance && (instance as any).host.toggle(k),
  closeAll: () => instance && (instance as any).host.closeAll(),
  isOpen: (k: WindowKey) => (instance ? (instance as any).host.isOpen(k) : false),
  hasOpen: () => (instance ? (instance as any).host.hasOpen() : false),
};
publishGlobal();

export type { KitHost2 };
