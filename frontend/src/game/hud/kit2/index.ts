// Cosmic Realm UI — Einstiegspunkt.
//
//   import { loadUiAssets, PanelHost, mountInventory } from "cosmic-ui";
//
//   await loadUiAssets();
//   const host = new PanelHost(app.stage, { w: 1920, h: 1080 });
//   host.register("inventory", () => mountInventory({}), { key: "i" });
//   app.ticker.add((t) => host.update(t.deltaMS / 1000));

export * from "./core";
export * from "./components";
export * from "./panels/PanelHost";
export * from "./panels/types";
export { mountInventory, type InventoryOpts } from "./panels/InventoryPanel";
export * as data from "./data";
