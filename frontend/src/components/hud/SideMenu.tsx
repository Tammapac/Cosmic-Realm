// SideMenu — replaces the boxed MenuPanel (Formfamily H) at the user's
// request: the same 9 destinations (the existing /assets/ui/icons/ PNG set),
// but as FLOATING Kit hexagon slots (HexSlotButton, the Kit's own quickslot
// frame) in a collapsible vertical column on the right edge — no console
// casing around them, each icon floats on its own drop-shadow.
//
// The toggle hexagon stays fixed; opening staggers the column in with the
// session's standard cubic-bezier(.2,.9,.25,1) entrance (same curve as the
// Kit's cSkNode/cRowIn animations). Open state persists in localStorage.
import { useState } from "react";
import { HexSlotButton } from "./HexSlotButton";

const ICON_SRC = (name: string) => `/assets/ui/icons/${name}.png`;

const SIDEMENU_KEYFRAMES = `
@keyframes cSideIn{0%{opacity:0;transform:translateX(26px) scale(.6)}100%{opacity:1;transform:none}}
`;

export type SideMenuProps = {
  onOpenInventory?: () => void;
  onOpenSkills?: () => void;
  onOpenMap?: () => void;
  onOpenFriends?: () => void;
  onOpenSettings?: () => void;
  onOpenMissions?: () => void;
  onOpenCargo?: () => void;
  onOpenClan?: () => void;
  onLogout?: () => void;
};

// Same buttons, same PNG icons, same order as the removed MenuPanel.
// Exchange (Kit E-01) lives on PlayerPanelCompact's quickslot row instead —
// see ExchangePanel.tsx.
const MENU_BUTTONS = [
  { key: "inventory", img: "inventory", title: "Inventory" },
  { key: "cargo", img: "cargo", title: "Cargo" },
  { key: "skills", img: "skills", title: "Skills" },
  { key: "missions", img: "missions", title: "Missions" },
  { key: "map", img: "galaxy-map", title: "Star Map" },
  { key: "clan", img: "clan", title: "Clan" },
  { key: "friends", img: "friends", title: "Friends" },
  { key: "settings", img: "settings", title: "Settings" },
] as const;

export function SideMenu(props: SideMenuProps) {
  const [open, setOpen] = useState(() => localStorage.getItem("sf-sidemenu") !== "closed");
  const toggle = () => {
    setOpen((o) => {
      localStorage.setItem("sf-sidemenu", o ? "closed" : "open");
      return !o;
    });
  };

  const handlers: Record<string, (() => void) | undefined> = {
    inventory: props.onOpenInventory,
    cargo: props.onOpenCargo,
    skills: props.onOpenSkills,
    missions: props.onOpenMissions,
    map: props.onOpenMap,
    clan: props.onOpenClan,
    friends: props.onOpenFriends,
    settings: props.onOpenSettings,
  };

  // Honeycomb zigzag — ONE unbroken diagonal chain, toggle included: the
  // toggle hex is position 0, each menu icon and the final logout hex just
  // continue the same left/right stagger (index 1..N), so the toggle sits
  // flush against the first icon's corner exactly like every other pair
  // instead of floating centered above a separate block.
  const SIZE = 54;
  const GAP_X = -10; // columns overlap slightly so the hex points interlock
  const STEP = SIZE * 0.62; // vertical step per position — tight diagonal stack
  const colX = (i: number) => (i % 2) * (SIZE + GAP_X);
  const rowY = (i: number) => i * STEP;
  const chainLen = MENU_BUTTONS.length + 2; // toggle + 8 icons + logout
  const blockW = SIZE * 2 + GAP_X;
  const blockH = (chainLen - 1) * STEP + SIZE;

  return (
    <div style={{ position: "relative", filter: "drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 6px 7px rgba(0,0,0,.7))" }}>
      <style>{SIDEMENU_KEYFRAMES}</style>
      <div style={{ position: "relative", width: blockW, height: open ? blockH : SIZE }}>
        <span style={{ position: "absolute", left: colX(0), top: rowY(0) }}>
          <HexSlotButton glyph={open ? "▲" : "▼"} title={open ? "Close menu" : "Open menu"} onClick={toggle} size={SIZE} />
        </span>
        {open && MENU_BUTTONS.map((b, i) => (
          <span key={b.key} style={{ position: "absolute", left: colX(i + 1), top: rowY(i + 1), animation: `cSideIn .32s cubic-bezier(.2,.9,.25,1) ${i * 34}ms both` }}>
            <HexSlotButton img={ICON_SRC(b.img)} title={b.title} onClick={handlers[b.key]} size={SIZE} />
          </span>
        ))}
        {open && (
          // logout in the Kit's red family, continuing the same chain
          <span style={{ position: "absolute", left: colX(chainLen - 1), top: rowY(chainLen - 1), animation: `cSideIn .32s cubic-bezier(.2,.9,.25,1) ${MENU_BUTTONS.length * 34}ms both` }}>
            <HexSlotButton img={ICON_SRC("log-out")} title="Logout" onClick={props.onLogout} tone="red" size={SIZE} />
          </span>
        )}
      </div>
    </div>
  );
}
