// ─────────────────────────────────────────────────────────────────────────────
// DockingPersistence — remembers WHERE the player is between sessions (M8).
//
// Deliberately its own localStorage key rather than a field in the main save
// payload (store.ts `_buildSavePayload`). Three reasons:
//
//   • `dockedAt` lives on the top-level game state, not on Player, and the save
//     payload is a Partial<Player> that is spread back over the player object
//     on boot. Smuggling a non-Player key through it would work but muddies a
//     type the whole game depends on.
//   • The main payload is also POSTed to /api/player/save, where the server
//     maps a fixed set of columns. An extra key would be silently dropped, so
//     writing it there would look like server persistence without being it.
//   • Isolation: this key is written and read ONLY by the new docking flow. With
//     ENABLE_NEW_DOCKING_FLOW off nothing imports this module, nothing is
//     written, and boot behaves exactly as it always did.
//
// SCOPE — this is per-browser, not per-account. The server has no docked column
// (and adding one means a DB migration, which is out of scope here), so logging
// in from a different device starts you in space. The server IS told about the
// restored dock over the socket, so combat safety is not browser-local.
// ─────────────────────────────────────────────────────────────────────────────

/** Where the player was when the session ended. */
export type LocationType = "SPACE" | "STATION";

export interface PersistedLocation {
  /** Bumped if the shape ever changes; anything else is discarded on read. */
  v: 1;
  type: LocationType;
  /** Station id when type is STATION, null in space. */
  stationId: string | null;
  /** Zone the station was in — used to reject a stale dock after a warp. */
  zone: string;
  /** Diagnostics only; nothing expires. Docking is meant to survive a week. */
  savedAt: number;
}

const KEY = "cosmic-location-v1";

/** Record the current location. Called at every dock/undock commit. */
export function saveLocation(type: LocationType, stationId: string | null, zone: string): void {
  try {
    const payload: PersistedLocation = {
      v: 1,
      type,
      stationId: type === "STATION" ? stationId : null,
      zone,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // A full or blocked localStorage must never break docking itself — the
    // player just starts in space next time.
  }
}

/**
 * Read the stored location back.
 *
 * Returns null for anything unusable — missing, unparseable, wrong version, or
 * a STATION entry with no station id — so callers only ever have to handle
 * "restore" or "don't".
 */
export function loadLocation(): PersistedLocation | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedLocation> | null;
    if (!parsed || parsed.v !== 1) return null;
    if (parsed.type !== "SPACE" && parsed.type !== "STATION") return null;
    if (parsed.type === "STATION" && typeof parsed.stationId !== "string") return null;
    return {
      v: 1,
      type: parsed.type,
      stationId: parsed.stationId ?? null,
      zone: typeof parsed.zone === "string" ? parsed.zone : "",
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

/** Forget the stored location — used when a restore is rejected as invalid. */
export function clearLocation(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
