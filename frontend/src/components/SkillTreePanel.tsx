import { useState } from "react";
import { useDraggable } from "./useDraggable";
import { useGame, state, bump, buySkillRank, resetSkills } from "../game/store";
import { SKILL_NODES, type SkillBranch, type SkillNode } from "../game/types";

// ── Skill tree window on the skills.png frame art (742×793 native) ─────────
// The window chrome, SKILLS banner, four tab labels (ATTACK/DEFENCE/CYBER/
// HEAL), nine octagon nodes with connector lines, close ⊘ and the
// ACTIVE/PASSIVE plates are all baked into the artwork — this component only
// places content and click zones over them (percent geometry, scales freely).

// Baked tab label → skill branch behind it
const TABS: { key: SkillBranch; left: string; width: string }[] = [
  { key: "offense",     left: "15.5%", width: "17.0%" }, // ATTACK
  { key: "defense",     left: "33.5%", width: "16.5%" }, // DEFENCE
  { key: "utility",     left: "51.5%", width: "15.0%" }, // CYBER
  { key: "engineering", left: "67.5%", width: "15.0%" }, // HEAL
];

const BRANCH_COLOR: Record<SkillBranch, string> = {
  offense: "#ff5c6c",
  defense: "#4ee2ff",
  utility: "#ffd24a",
  engineering: "#aaff5c",
};

// Octagon node centers in the artwork (percent of 742×793)
const NODE_POS: { cx: number; cy: number }[] = [
  { cx: 49.2, cy: 31.9 }, // top
  { cx: 34.8, cy: 42.9 }, { cx: 62.9, cy: 42.9 },
  { cx: 34.8, cy: 57.4 }, { cx: 55.5, cy: 57.4 }, { cx: 71.7, cy: 57.4 },
  { cx: 24.5, cy: 74.4 }, { cx: 42.7, cy: 74.4 },
  { cx: 71.0, cy: 77.8 }, // bottom right (offset lower)
];
const NODE_W = 14.4; // % width of one octagon
const NODE_H = 13.4; // % height

function skillTip(node: SkillNode, rank: number, gateOpen: boolean, sp: number): string {
  const lines = [
    `${node.name.toUpperCase()} · RANK ${rank}/${node.maxRank}`,
    node.description,
    `COST ${node.cost} SP PER RANK · ${sp} SP AVAILABLE`,
  ];
  if (node.requires) {
    const req = SKILL_NODES.find((n) => n.id === node.requires);
    lines.push(gateOpen ? `REQUIRES ${req?.name ?? node.requires} ✓` : `LOCKED — REQUIRES ${req?.name ?? node.requires}`);
  }
  if (rank >= node.maxRank) lines.push("MAX RANK REACHED");
  else if (gateOpen && sp >= node.cost) lines.push("CLICK TO LEARN");
  return lines.join("\n");
}

export function SkillTreePanel() {
  const show = useGame((s) => s.showSkillTree);
  const player = useGame((s) => s.player);
  const [branch, setBranch] = useState<SkillBranch>("offense");
  const [filter, setFilter] = useState<"all" | "learned" | "available">("all");
  // Hooks must run unconditionally — BEFORE the early return, or opening
  // the window changes the hook count and React crashes the whole tree.
  const drag = useDraggable("skilltree");

  if (!show) return null;

  const color = BRANCH_COLOR[branch];
  const nodes = SKILL_NODES
    .filter((n) => n.branch === branch)
    .sort((a, b) => a.pos.row - b.pos.row || a.pos.col - b.pos.col);

  const close = () => { state.showSkillTree = false; bump(); };

  // HUD framed window (reference language) instead of the baked
  // skills-frame.png art: title band, real tab buttons, node board with the
  // same relative layout (positions renormalized from the art's chrome),
  // footer with filters + respec. All skill logic unchanged.
  const cyMap = (cy: number) => (cy - 18) * 1.28; // art % -> chrome-less board %
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.62)", pointerEvents: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="panel"
        style={{ width: "min(560px, 92vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", userSelect: "none", ...drag.style }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="hud-titleband" onPointerDown={drag.handleProps.onPointerDown} style={{ fontSize: 13, letterSpacing: "0.3em", padding: "8px 12px", ...drag.handleProps.style }}>
          <span style={{ flex: 1 }}>Skills</span>
          <span
            className="tabular-nums"
            style={{ color: "var(--hud-gold)", fontSize: 12, textShadow: "0 0 8px rgba(232,185,77,0.5)" }}
            title={`${player.skillPoints} unspent skill points\nEarn 1 per level`}
          >
            {player.skillPoints} SP
          </span>
          <button className="gbtn gbtn-red" style={{ padding: "1px 8px", fontSize: 10, marginLeft: 8 }} onClick={close} title={"Close skill tree\nEsc also closes"}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 6, padding: "8px 10px 0" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className="gbtn"
              onClick={() => setBranch(t.key)}
              style={{
                flex: 1,
                color: branch === t.key ? BRANCH_COLOR[t.key] : undefined,
                borderColor: branch === t.key ? BRANCH_COLOR[t.key] : undefined,
                boxShadow: branch === t.key ? `0 0 10px ${BRANCH_COLOR[t.key]}44, inset 0 0 10px ${BRANCH_COLOR[t.key]}22` : undefined,
              }}
            >
              {t.key.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", width: "100%", aspectRatio: "742 / 620", minHeight: 0 }}>
          {NODE_POS.map((pos, i) => {
            const node = nodes[i];
            if (!node) {
              return (
                <div
                  key={`empty-${i}`}
                  title="No skill in this slot"
                  style={{
                    position: "absolute",
                    left: `${pos.cx - NODE_W / 2}%`, top: `${cyMap(pos.cy) - NODE_H / 2}%`,
                    width: `${NODE_W}%`, height: `${NODE_H}%`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#2a3a54", fontSize: 22,
                  }}
                >
                  ·
                </div>
              );
            }
            const rank = (player.skills as any)[node.id] ?? 0;
            const gateOpen = !node.requires || ((player.skills as any)[node.requires] ?? 0) > 0;
            const maxed = rank >= node.maxRank;
            const canBuy = gateOpen && !maxed && player.skillPoints >= node.cost;
            if (filter === "learned" && rank === 0) return null;
            if (filter === "available" && (!canBuy || maxed)) return null;
            const glow = maxed ? "#5cff8a" : canBuy ? color : gateOpen ? `${color}99` : "#3c5578";
            return (
              <div
                key={node.id}
                title={skillTip(node, rank, gateOpen, player.skillPoints)}
                onClick={() => { if (canBuy) buySkillRank(node.id); }}
                className="skill-node"
                style={{
                  position: "absolute",
                  left: `${pos.cx - NODE_W / 2}%`, top: `${cyMap(pos.cy) - NODE_H / 2}%`,
                  width: `${NODE_W}%`, height: `${NODE_H}%`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 1,
                  cursor: canBuy ? "pointer" : "default",
                  clipPath: "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)",
                  background: canBuy
                    ? `radial-gradient(ellipse at center, ${color}26 0%, transparent 74%)`
                    : "rgba(10, 18, 34, 0.6)",
                  boxShadow: `inset 0 0 0 1px ${gateOpen ? "rgba(90,130,180,0.5)" : "rgba(60,90,130,0.3)"}`,
                  animation: canBuy ? "pulse-glow 1.8s ease-in-out infinite" : "none",
                  opacity: gateOpen ? 1 : 0.45,
                }}
              >
                <span style={{ fontSize: 26, lineHeight: 1, color: glow, textShadow: `0 0 10px ${glow}88` }}>
                  {node.icon}
                </span>
                <span
                  className="font-bold tabular-nums"
                  style={{ fontSize: 11, color: maxed ? "#5cff8a" : rank > 0 ? "#dff6ff" : "#7a92b8", textShadow: "0 1px 2px #000" }}
                >
                  {rank}/{node.maxRank}
                </span>
                {!gateOpen && <span style={{ fontSize: 9, color: "#7a92b8" }}>🔒</span>}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px 10px" }}>
          <button
            className="gbtn"
            onClick={() => setFilter(filter === "learned" ? "all" : "learned")}
            title={"Show only learned skills\nClick again to show all"}
            style={{ fontSize: 10, color: filter === "learned" ? "#5cff8a" : undefined, borderColor: filter === "learned" ? "#5cff8a" : undefined }}
          >
            LEARNED
          </button>
          <button
            className="gbtn"
            onClick={() => setFilter(filter === "available" ? "all" : "available")}
            title={"Show only skills you can learn now\nClick again to show all"}
            style={{ fontSize: 10, color: filter === "available" ? "var(--hud-gold)" : undefined, borderColor: filter === "available" ? "var(--hud-gold)" : undefined }}
          >
            AVAILABLE
          </button>
          <div style={{ flex: 1 }} />
          <div className="font-bold" style={{ fontSize: 11, letterSpacing: "0.2em", color, textShadow: `0 0 8px ${color}66`, fontFamily: "var(--font-display)" }}>
            {branch.toUpperCase()}
          </div>
          <button
            className="gbtn gbtn-red"
            title={"Refund all learned skills\nCosts 2,000 credits"}
            onClick={resetSkills}
            style={{ fontSize: 9 }}
          >
            RESPEC 2000 CR
          </button>
        </div>
      </div>
    </div>
  );
}
