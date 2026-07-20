import { create } from "zustand";
import { nanoid } from "nanoid";
import {
  type HudDocument,
  type HudElement,
  type ElementKind,
  type Vec2,
  createEmptyDocument,
  defaultPolygonPoints,
  defaultHudSilhouette,
} from "./types";

const HUD_COMPONENT_KINDS = new Set<ElementKind>([
  "hud-hotbar",
  "hud-player-status",
  "hud-health-bar",
  "hud-shield-bar",
]);

const HISTORY_LIMIT = 100;
const AUTOSAVE_KEY = "hud-editor-autosave-v1";

type EditorState = {
  doc: HudDocument;
  selectedIds: string[];
  past: HudDocument[];
  future: HudDocument[];

  // Selection
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;

  // Element CRUD
  addElement: (kind: ElementKind, partial?: Partial<HudElement>) => string;
  updateElement: (id: string, patch: Partial<HudElement>) => void;
  updateElements: (patches: Record<string, Partial<HudElement>>) => void;
  removeElements: (ids: string[]) => void;
  duplicateElements: (ids: string[]) => void;

  // Ordering / hierarchy
  reorderWithinParent: (id: string, newIndex: number) => void;
  setZIndex: (id: string, zIndex: number) => void;
  groupElements: (ids: string[]) => void;
  ungroup: (groupId: string) => void;

  // Flags
  toggleLock: (id: string) => void;
  toggleHidden: (id: string) => void;

  // Alignment
  align: (ids: string[], edge: "left" | "right" | "top" | "bottom" | "centerX" | "centerY") => void;

  // Polygon vertex editing (kind === "polygon" only)
  updatePolygonPoint: (id: string, index: number, point: Vec2) => void;
  addPolygonPoint: (id: string, afterIndex: number, point: Vec2) => void;
  removePolygonPoint: (id: string, index: number) => void;

  // History
  undo: () => void;
  redo: () => void;
  commit: () => void;

  // Persistence
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => boolean;
  loadDocument: (doc: HudDocument) => void;
  resetDocument: () => void;
};

/** Snapshot the doc before a mutation, for undo. Called at the START of
 * every mutating action, BEFORE applying changes -- so `past` always holds
 * pre-mutation states. Clears `future` since we've branched history. */
function snapshot(state: EditorState): Pick<EditorState, "past" | "future"> {
  const past = [...state.past, state.doc].slice(-HISTORY_LIMIT);
  return { past, future: [] };
}

function nextOrder(doc: HudDocument, parentId: string | null): number {
  const siblings = Object.values(doc.elements).filter((e) => e.parentId === parentId);
  return siblings.length === 0 ? 0 : Math.max(...siblings.map((e) => e.order)) + 1;
}

function nextZIndex(doc: HudDocument): number {
  const all = Object.values(doc.elements);
  return all.length === 0 ? 1 : Math.max(...all.map((e) => e.zIndex)) + 1;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  doc: createEmptyDocument(),
  selectedIds: [],
  past: [],
  future: [],

  select: (ids) => set({ selectedIds: ids }),
  toggleSelect: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((i) => i !== id)
        : [...s.selectedIds, id],
    })),
  clearSelection: () => set({ selectedIds: [] }),

  addElement: (kind, partial) => {
    const id = nanoid(8);
    const state = get();
    const parentId = partial?.parentId ?? null;
    const el: HudElement = {
      id,
      kind,
      name: partial?.name ?? defaultNameFor(kind),
      parentId,
      order: nextOrder(state.doc, parentId),
      x: partial?.x ?? 100,
      y: partial?.y ?? 100,
      width: partial?.width ?? defaultSizeFor(kind).width,
      height: partial?.height ?? defaultSizeFor(kind).height,
      rotation: partial?.rotation ?? 0,
      pivot: partial?.pivot ?? { x: 0.5, y: 0.5 },
      zIndex: partial?.zIndex ?? nextZIndex(state.doc),
      opacity: partial?.opacity ?? 1,
      locked: partial?.locked ?? false,
      hidden: partial?.hidden ?? false,
      style: partial?.style ?? defaultStyleFor(kind),
      text: partial?.text ?? (kind === "text" ? "Text" : undefined),
      points:
        partial?.points ??
        (kind === "polygon"
          ? defaultPolygonPoints()
          : HUD_COMPONENT_KINDS.has(kind)
            ? defaultHudSilhouette(kind)
            : undefined),
    };
    set((s) => ({
      ...snapshot(s),
      doc: {
        ...s.doc,
        elements: { ...s.doc.elements, [id]: el },
        rootOrder: parentId === null ? [...s.doc.rootOrder, id] : s.doc.rootOrder,
      },
      selectedIds: [id],
    }));
    return id;
  },

  updateElement: (id, patch) =>
    set((s) => {
      const existing = s.doc.elements[id];
      if (!existing) return s;
      return {
        doc: {
          ...s.doc,
          elements: { ...s.doc.elements, [id]: { ...existing, ...patch } },
        },
      };
    }),

  updateElements: (patches) =>
    set((s) => {
      const elements = { ...s.doc.elements };
      for (const [id, patch] of Object.entries(patches)) {
        if (elements[id]) elements[id] = { ...elements[id], ...patch };
      }
      return { doc: { ...s.doc, elements } };
    }),

  removeElements: (ids) =>
    set((s) => {
      const idSet = new Set(ids);
      // Also remove descendants of any removed group.
      let changed = true;
      while (changed) {
        changed = false;
        for (const el of Object.values(s.doc.elements)) {
          if (el.parentId && idSet.has(el.parentId) && !idSet.has(el.id)) {
            idSet.add(el.id);
            changed = true;
          }
        }
      }
      const elements = { ...s.doc.elements };
      for (const id of idSet) delete elements[id];
      return {
        ...snapshot(s),
        doc: {
          ...s.doc,
          elements,
          rootOrder: s.doc.rootOrder.filter((id) => !idSet.has(id)),
        },
        selectedIds: s.selectedIds.filter((id) => !idSet.has(id)),
      };
    }),

  duplicateElements: (ids) =>
    set((s) => {
      const elements = { ...s.doc.elements };
      const rootOrder = [...s.doc.rootOrder];
      const newIds: string[] = [];
      for (const id of ids) {
        const src = elements[id];
        if (!src) continue;
        const newId = nanoid(8);
        elements[newId] = {
          ...src,
          id: newId,
          name: `${src.name} copy`,
          x: src.x + 24,
          y: src.y + 24,
          order: nextOrder({ ...s.doc, elements }, src.parentId),
          zIndex: nextZIndex({ ...s.doc, elements }),
        };
        if (src.parentId === null) rootOrder.push(newId);
        newIds.push(newId);
      }
      return {
        ...snapshot(s),
        doc: { ...s.doc, elements, rootOrder },
        selectedIds: newIds,
      };
    }),

  reorderWithinParent: (id, newIndex) =>
    set((s) => {
      const el = s.doc.elements[id];
      if (!el) return s;
      const siblings = Object.values(s.doc.elements)
        .filter((e) => e.parentId === el.parentId)
        .sort((a, b) => a.order - b.order);
      const withoutSelf = siblings.filter((e) => e.id !== id);
      const clamped = Math.max(0, Math.min(newIndex, withoutSelf.length));
      withoutSelf.splice(clamped, 0, el);
      const elements = { ...s.doc.elements };
      withoutSelf.forEach((e, i) => {
        elements[e.id] = { ...elements[e.id], order: i };
      });
      return { ...snapshot(s), doc: { ...s.doc, elements } };
    }),

  setZIndex: (id, zIndex) =>
    set((s) => {
      const el = s.doc.elements[id];
      if (!el) return s;
      return {
        ...snapshot(s),
        doc: { ...s.doc, elements: { ...s.doc.elements, [id]: { ...el, zIndex } } },
      };
    }),

  groupElements: (ids) =>
    set((s) => {
      if (ids.length < 2) return s;
      const members = ids.map((id) => s.doc.elements[id]).filter(Boolean);
      if (members.length < 2) return s;
      const minX = Math.min(...members.map((m) => m.x));
      const minY = Math.min(...members.map((m) => m.y));
      const maxX = Math.max(...members.map((m) => m.x + m.width));
      const maxY = Math.max(...members.map((m) => m.y + m.height));
      const groupId = nanoid(8);
      const parentId = members[0].parentId;
      const group: HudElement = {
        id: groupId,
        kind: "group",
        name: "Group",
        parentId,
        order: nextOrder(s.doc, parentId),
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        rotation: 0,
        pivot: { x: 0.5, y: 0.5 },
        zIndex: nextZIndex(s.doc),
        opacity: 1,
        locked: false,
        hidden: false,
        style: {},
      };
      const elements = { ...s.doc.elements, [groupId]: group };
      for (const m of members) {
        elements[m.id] = { ...m, parentId: groupId, x: m.x - minX, y: m.y - minY };
      }
      const rootOrder =
        parentId === null
          ? [...s.doc.rootOrder.filter((id) => !ids.includes(id)), groupId]
          : s.doc.rootOrder;
      return {
        ...snapshot(s),
        doc: { ...s.doc, elements, rootOrder },
        selectedIds: [groupId],
      };
    }),

  ungroup: (groupId) =>
    set((s) => {
      const group = s.doc.elements[groupId];
      if (!group || group.kind !== "group") return s;
      const elements = { ...s.doc.elements };
      const children = Object.values(elements).filter((e) => e.parentId === groupId);
      const childIds: string[] = [];
      for (const c of children) {
        elements[c.id] = {
          ...c,
          parentId: group.parentId,
          x: c.x + group.x,
          y: c.y + group.y,
        };
        childIds.push(c.id);
      }
      delete elements[groupId];
      const rootOrder =
        group.parentId === null
          ? [...s.doc.rootOrder.filter((id) => id !== groupId), ...childIds]
          : s.doc.rootOrder;
      return {
        ...snapshot(s),
        doc: { ...s.doc, elements, rootOrder },
        selectedIds: childIds,
      };
    }),

  toggleLock: (id) =>
    set((s) => {
      const el = s.doc.elements[id];
      if (!el) return s;
      return {
        ...snapshot(s),
        doc: { ...s.doc, elements: { ...s.doc.elements, [id]: { ...el, locked: !el.locked } } },
      };
    }),

  toggleHidden: (id) =>
    set((s) => {
      const el = s.doc.elements[id];
      if (!el) return s;
      return {
        ...snapshot(s),
        doc: { ...s.doc, elements: { ...s.doc.elements, [id]: { ...el, hidden: !el.hidden } } },
      };
    }),

  align: (ids, edge) =>
    set((s) => {
      const members = ids.map((id) => s.doc.elements[id]).filter(Boolean);
      if (members.length < 2) return s;
      const elements = { ...s.doc.elements };
      switch (edge) {
        case "left": {
          const min = Math.min(...members.map((m) => m.x));
          members.forEach((m) => (elements[m.id] = { ...m, x: min }));
          break;
        }
        case "right": {
          const max = Math.max(...members.map((m) => m.x + m.width));
          members.forEach((m) => (elements[m.id] = { ...m, x: max - m.width }));
          break;
        }
        case "top": {
          const min = Math.min(...members.map((m) => m.y));
          members.forEach((m) => (elements[m.id] = { ...m, y: min }));
          break;
        }
        case "bottom": {
          const max = Math.max(...members.map((m) => m.y + m.height));
          members.forEach((m) => (elements[m.id] = { ...m, y: max - m.height }));
          break;
        }
        case "centerX": {
          const avg =
            members.reduce((sum, m) => sum + m.x + m.width / 2, 0) / members.length;
          members.forEach((m) => (elements[m.id] = { ...m, x: avg - m.width / 2 }));
          break;
        }
        case "centerY": {
          const avg =
            members.reduce((sum, m) => sum + m.y + m.height / 2, 0) / members.length;
          members.forEach((m) => (elements[m.id] = { ...m, y: avg - m.height / 2 }));
          break;
        }
      }
      return { ...snapshot(s), doc: { ...s.doc, elements } };
    }),

  updatePolygonPoint: (id, index, point) =>
    set((s) => {
      const el = s.doc.elements[id];
      if (!el?.points) return s;
      const points = el.points.map((p, i) => (i === index ? point : p));
      return { doc: { ...s.doc, elements: { ...s.doc.elements, [id]: { ...el, points } } } };
    }),

  addPolygonPoint: (id, afterIndex, point) =>
    set((s) => {
      const el = s.doc.elements[id];
      if (!el?.points) return s;
      const points = [...el.points];
      points.splice(afterIndex + 1, 0, point);
      return {
        ...snapshot(s),
        doc: { ...s.doc, elements: { ...s.doc.elements, [id]: { ...el, points } } },
      };
    }),

  removePolygonPoint: (id, index) =>
    set((s) => {
      const el = s.doc.elements[id];
      if (!el?.points || el.points.length <= 3) return s;
      const points = el.points.filter((_, i) => i !== index);
      return {
        ...snapshot(s),
        doc: { ...s.doc, elements: { ...s.doc.elements, [id]: { ...el, points } } },
      };
    }),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return {
        doc: prev,
        past: s.past.slice(0, -1),
        future: [s.doc, ...s.future].slice(0, HISTORY_LIMIT),
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return {
        doc: next,
        past: [...s.past, s.doc].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
      };
    }),

  /** Explicit history checkpoint for interaction sequences (e.g. drag)
   * that mutate via updateElement on every frame -- call once at
   * drag-start so the whole gesture undoes in one step, not per-frame. */
  commit: () => set((s) => snapshot(s)),

  saveToLocalStorage: () => {
    const { doc } = get();
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(doc));
  },

  loadFromLocalStorage: () => {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return false;
    try {
      const doc = JSON.parse(raw) as HudDocument;
      set({ doc, selectedIds: [], past: [], future: [] });
      return true;
    } catch {
      return false;
    }
  },

  loadDocument: (doc) => set({ doc, selectedIds: [], past: [], future: [] }),

  resetDocument: () => set({ doc: createEmptyDocument(), selectedIds: [], past: [], future: [] }),
}));

function defaultNameFor(kind: ElementKind): string {
  switch (kind) {
    case "panel":
      return "Panel";
    case "box":
      return "Box";
    case "text":
      return "Text";
    case "group":
      return "Group";
    case "hud-hotbar":
      return "Hotbar";
    case "hud-player-status":
      return "Player Status";
    case "hud-health-bar":
      return "Health Bar";
    case "hud-shield-bar":
      return "Shield Bar";
    case "polygon":
      return "Shape";
  }
}

/** Native pixel size of each real HUD component at its default (unscaled)
 * layout -- used both as the initial editor box and as the size the
 * component is actually rendered at before the wrapper's own CSS scale()
 * stretches it to fill whatever width/height the user resizes to. */
function defaultSizeFor(kind: ElementKind): { width: number; height: number } {
  switch (kind) {
    case "panel":
      return { width: 320, height: 200 };
    case "box":
      return { width: 120, height: 80 };
    case "text":
      return { width: 160, height: 32 };
    case "group":
      return { width: 200, height: 200 };
    case "hud-hotbar":
      return { width: 720, height: 150 };
    case "hud-player-status":
      return { width: 340, height: 110 };
    case "hud-health-bar":
    case "hud-shield-bar":
      return { width: 260, height: 48 };
    case "polygon":
      return { width: 200, height: 120 };
  }
}

function defaultStyleFor(kind: ElementKind): Record<string, string> {
  switch (kind) {
    case "panel":
      return {
        background: "rgba(14, 22, 40, 0.88)",
        border: "1px solid rgba(120, 200, 255, 0.5)",
      };
    case "box":
      return {
        background: "rgba(78, 226, 255, 0.15)",
        border: "1px solid rgba(78, 226, 255, 0.6)",
      };
    case "text":
      return { color: "#eaf4ff", fontSize: "16px" };
    case "polygon":
      return {
        background: "linear-gradient(160deg, #2a3650 0%, #0c1220 100%)",
        boxShadow: "inset 0 1px 0 rgba(160,200,230,0.16), inset 0 -2px 3px rgba(0,0,0,0.55)",
      };
    case "group":
    case "hud-hotbar":
    case "hud-player-status":
    case "hud-health-bar":
    case "hud-shield-bar":
      return {};
  }
}
