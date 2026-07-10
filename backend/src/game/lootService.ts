// ── Server-authoritative loot service ──────────────────────────────────────
// All valuable item generation happens HERE, on the server. Every rolled item
// is minted with a server instanceId and recorded in the item_audit table +
// in-memory registry. The /save route later verifies pushed inventories
// against this registry so clients cannot forge, inflate, or duplicate items.
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { ZONES } from "./data.js";
import {
  rollDrop, validateItem, enemyLevelFor,
  type ItemInstance,
} from "../../../lib/loot/loot.js";

// ── Server-minted instance ids ─────────────────────────────────────────────
let mintCounter = 0;
export function mintInstanceId(): string {
  mintCounter = (mintCounter + 1) & 0xfffff;
  const rand = Math.floor(Math.random() * 0xffffffff).toString(36);
  return `srv-${Date.now().toString(36)}-${mintCounter.toString(36)}-${rand}`;
}

// ── Enemy → drop context mapping ───────────────────────────────────────────
const ENEMY_RANK: Record<string, number> = {
  scout: 0, interceptor: 0,
  raider: 1, corvette: 1,
  destroyer: 2, voidling: 2,
  sentinel: 3, wraith: 3,
  specter: 4, phantom: 4,
  dread: 5, titan: 5,
  juggernaut: 6, overlord: 6,
  leviathan: 7,
};

// ── Anti-dup audit registry ────────────────────────────────────────────────
// Canonical JSON of the rolled fields; any mismatch on save = forged item.
function itemFingerprint(item: ItemInstance): string {
  return JSON.stringify({
    d: item.defId, i: item.ilvl ?? null, r: item.rarity ?? null,
    s: item.seed ?? null, l: item.legendaryId ?? null,
    a: (item.affixes ?? []).map((x) => [x.id, x.tier, x.value]),
  });
}

type AuditRecord = { ownerId: number; fingerprint: string };
const auditCache = new Map<string, AuditRecord>();
const missCache = new Set<string>(); // known-bad ids, avoid repeat DB hits

function registerMintedItem(item: ItemInstance, ownerId: number): void {
  const fingerprint = itemFingerprint(item);
  auditCache.set(item.instanceId, { ownerId, fingerprint });
  db.insert(schema.itemAudit)
    .values({
      instanceId: item.instanceId,
      ownerId,
      defId: item.defId,
      ilvl: item.ilvl ?? 1,
      rarity: item.rarity ?? "common",
      fingerprint,
      data: item as any,
    })
    .onConflictDoNothing()
    .catch((e: Error) => console.error("[LOOT] audit insert failed:", e.message));
}

/** Look up an audit record, falling back to the DB once per instanceId. */
async function getAuditRecord(instanceId: string): Promise<AuditRecord | null> {
  const hit = auditCache.get(instanceId);
  if (hit) return hit;
  if (missCache.has(instanceId)) return null;
  try {
    const [row] = await db.select().from(schema.itemAudit)
      .where(eq(schema.itemAudit.instanceId, instanceId)).limit(1);
    if (row) {
      const rec: AuditRecord = { ownerId: row.ownerId, fingerprint: row.fingerprint };
      auditCache.set(instanceId, rec);
      return rec;
    }
  } catch (e) {
    console.error("[LOOT] audit lookup failed:", (e as Error).message);
    return null; // DB down → treat as unverifiable, item gets stripped
  }
  missCache.add(instanceId);
  return null;
}

// ── Kill-time drop roll (called from the engine's death branches) ──────────
export function rollEnemyEquipDrop(
  enemy: { id: string; type: string; isBoss: boolean },
  zoneId: string,
  killerId: number,
  killerLootBonus: number,
): ItemInstance | null {
  const zone = (ZONES as any)[zoneId];
  if (!zone || killerId == null || killerId <= 0) return null;
  const isPirate = enemy.id.startsWith("pir") || enemy.id.startsWith("pboss");
  const enemyLevel = enemyLevelFor(zone.unlockLevel ?? 1, ENEMY_RANK[enemy.type] ?? 0, enemy.isBoss);
  const item = rollDrop({
    enemyType: enemy.type,
    enemyLevel,
    isBoss: enemy.isBoss,
    isPirate,
    zoneTier: zone.enemyTier ?? 1,
    luck: Math.min(0.6, (killerLootBonus ?? 0) * 0.12),
    seed: Math.floor(Math.random() * 0xffffffff),
    instanceId: mintInstanceId(),
  });
  if (item) registerMintedItem(item, killerId);
  return item;
}

// ── Save-time inventory guard ──────────────────────────────────────────────
function isRolledItem(it: any): boolean {
  return it && (it.rarity !== undefined || it.affixes !== undefined || it.legendaryId !== undefined || it.ilvl !== undefined);
}

/**
 * Sanitize a client-pushed inventory. Plain {instanceId, defId} shop items
 * pass untouched (legacy client-authoritative path). Rolled items must
 * (1) pass structural validation, (2) exist in the audit registry with a
 * matching fingerprint, (3) belong to this player, (4) appear only once.
 * Returns the cleaned inventory; forged/duped entries are stripped + logged.
 */
export async function sanitizeInventory(playerId: number, inventory: any[]): Promise<any[]> {
  if (!Array.isArray(inventory)) return [];
  const seen = new Set<string>();
  const out: any[] = [];
  for (const it of inventory) {
    if (!it || typeof it.instanceId !== "string" || typeof it.defId !== "string") continue;
    if (seen.has(it.instanceId)) {
      console.warn(`[LOOT] player ${playerId}: duplicate instanceId ${it.instanceId} stripped`);
      continue;
    }
    seen.add(it.instanceId);
    if (!isRolledItem(it)) { out.push(it); continue; }

    const structural = validateItem(it);
    if (structural) {
      console.warn(`[LOOT] player ${playerId}: invalid item ${it.instanceId} (${structural}) stripped`);
      continue;
    }
    const rec = await getAuditRecord(it.instanceId);
    if (!rec) {
      console.warn(`[LOOT] player ${playerId}: unaudited rolled item ${it.instanceId} stripped`);
      continue;
    }
    if (rec.fingerprint !== itemFingerprint(it)) {
      console.warn(`[LOOT] player ${playerId}: fingerprint mismatch on ${it.instanceId} stripped`);
      continue;
    }
    if (rec.ownerId !== playerId) {
      console.warn(`[LOOT] player ${playerId}: item ${it.instanceId} owned by ${rec.ownerId} stripped`);
      continue;
    }
    out.push(it);
  }
  return out;
}
