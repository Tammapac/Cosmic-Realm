import type React from "react";

// Copied verbatim from the design handoff
// (design_handoff_hangar_dock_overlay/src/HangarDockOverlay.types.ts).
export interface StatRow {
  label: string;
  value: string;
  hex: string;   // value text color
  glow: string;  // rgba used as text-shadow color
}

export interface ServiceItem {
  icon: string;  // single glyph character (design uses Unicode glyphs, not SVG icons)
  label: string;
}

export interface DockTabItem {
  icon: string;
  label: string;
  sub: string; // used only for aria-label, not shown visually
}

export interface HangarDockOverlayProps {
  /** 3D hangar bay render behind the HUD. Not supplied by the design (image-slot placeholder). */
  bayBackgroundSrc?: string;
  stationName: string;
  stationTag: string;       // e.g. "DOCKED · TRADE"
  stationCode: string;      // e.g. "SYS-04A"
  factionIconSrc: string;   // faction emblem, see assets/icons
  ownerLabel: string;       // e.g. "EARTH CONCORD"
  stationOnline?: boolean;  // drives the green status dot pulse
  stationStats: StatRow[];

  shipName: string;
  shipClassLabel: string;   // e.g. "INTERCEPTOR · KESTREL"
  /** Ship silhouette image. Not supplied by the design (image-slot placeholder). */
  shipSilhouetteSrc?: string;
  /** Live ship view for the Quick Info viewport. The design ships an image slot
   *  only; this project has real GLB hulls, so the host passes a rendered
   *  preview node instead. Takes precedence over shipSilhouetteSrc. */
  shipViewport?: React.ReactNode;
  shipOnline?: boolean;
  shipStats: StatRow[];
  onShipLoadout?: () => void;

  services: ServiceItem[];
  onServiceSelect?: (index: number) => void;

  dockTabs: DockTabItem[];
  activeDockTab: number;
  onDockTabSelect: (index: number) => void;

  onUndock?: () => void;
  undockSubtext?: string; // e.g. "All systems nominal"
}
