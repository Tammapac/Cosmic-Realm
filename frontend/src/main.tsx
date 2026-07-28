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
} else if (params.has("ui-preview")) {
  // Unified popup/window system verification harness (see UiPreview.tsx).
  import("./demo/UiPreview").then(({ default: UiPreview }) => {
    root.render(<UiPreview />);
  });
} else if (params.has("skills-test")) {
  // Isolated skill-tree harness for the redesigned tree (?newskills UI).
  import("./demo/SkillsTest").then(({ default: SkillsTest }) => {
    root.render(<SkillsTest />);
  });
} else if (params.has("hud-editor")) {
  import("./editor/HudEditor").then(({ default: HudEditor }) => {
    root.render(<HudEditor />);
  });
} else if (params.has("dock-test")) {
  // Isolated docking-approach test harness (M4): open with ?dock-test.
  import("./demo/DockTest").then(({ default: DockTest }) => {
    root.render(<DockTest />);
  });
} else if (params.has("station-test")) {
  // Isolated station-3D-layer + door harness (M9): open with ?station-test.
  import("./demo/StationTest").then(({ default: StationTest }) => {
    root.render(<StationTest />);
  });
} else if (params.has("door-test")) {
  // Isolated HangarDoorController test harness (M3): open with ?door-test.
  import("./demo/DoorTest").then(({ default: DoorTest }) => {
    root.render(<DoorTest />);
  });
} else if (params.has("depth-test")) {
  // Shared-3D-scene depth proof harness: open with ?depth-test.
  import("./demo/DepthTest").then(({ default: DepthTest }) => {
    root.render(<DepthTest />);
  });
} else if (params.has("hangar-test")) {
  // Isolated 3D hangar scene + docking cinematic harness: open with ?hangar-test.
  import("./demo/HangarTest").then(({ default: HangarTest }) => {
    root.render(<HangarTest />);
  });
} else {
  root.render(<App />);
}
