import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// HUD skin: extends the hud_preview design system to every legacy UI class
// (windows, station/hangar menus, buttons, tooltips, popups). Must load
// AFTER index.css so identical selectors win by order.
import "./styles/hud/hud-skin.css";

// Isolated HUD dev screen: open with ?hud-showcase in the URL. Does not
// touch the normal game boot path.
const params = new URLSearchParams(window.location.search);
const root = createRoot(document.getElementById("root")!);
if (params.has("hud-showcase")) {
  import("./demo/HudShowcase").then(({ default: HudShowcase }) => {
    root.render(<HudShowcase />);
  });
} else if (params.has("hud-editor")) {
  import("./editor/HudEditor").then(({ default: HudEditor }) => {
    root.render(<HudEditor />);
  });
} else {
  root.render(<App />);
}
