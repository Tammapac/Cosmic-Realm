// ── Silhouette hitboxes ────────────────────────────────────────────────────
// Shared server+client hit testing against the ships' actual 2D silhouettes
// (convex hulls extracted from the GLBs — see scripts in the repo). The test
// mirrors the renderer's transform exactly: model nose = -X, yaw
// yRot = -angle + PI about Y, wrapper tilt compresses screen-Y by cos(0.85).
import { SHIP_HULLS } from "./ship-hulls.js";
export const HULL_COS_TILT = Math.cos(0.85); // ≈ 0.6600, keep in sync with SHIP_WRAPPER_TILT_X
// EnemyType → model/hull key (single source of truth — the renderer's model
// pick and the hitbox pick must never drift apart).
export const ENEMY_MODEL_KEY = {
    scout: "enemy_scout",
    interceptor: "enemy_interceptor",
    raider: "enemy_raider",
    corvette: "enemy_corvette",
    destroyer: "enemy_destroyer",
    sentinel: "enemy_sentinel",
    specter: "enemy_specter",
    phantom: "enemy_phantom",
    wraith: "enemy_wraith",
    voidling: "enemy_voidling",
    dread: "enemy_dread",
    titan: "enemy_titan",
    juggernaut: "enemy_juggernaut",
    overlord: "enemy_overlord",
    leviathan: "enemy_leviathan",
    erix: "enemy_erix",
};
// Beginner player hulls pirates fly; bounty bosses get the Marauder.
export const PIRATE_SHIP_MODELS = ["skimmer", "wasp", "vanguard", "reaver"];
// Player ship render scales — MUST match SHIP_SIZE_SCALE in
// frontend/src/game/types.ts (copied here so the server can size player
// silhouettes without importing frontend code).
export const PLAYER_SIZE_SCALE = {
    skimmer: 0.7, wasp: 0.75, vanguard: 0.85, reaver: 0.9, obsidian: 0.95,
    marauder: 1.05, phalanx: 1.15, titan: 1.3, leviathan: 1.45, specter: 1.1,
    colossus: 1.6, harbinger: 1.5, eclipse: 1.7, sovereign: 1.85, apex: 2.0,
};
/** Model/hull key for an enemy — pirates resolve to player hulls by id hash. */
export function enemyModelKey(type, id) {
    if (id.startsWith("pboss"))
        return "marauder";
    if (id.startsWith("pir")) {
        let h = 0;
        for (let ci = 4; ci < id.length; ci++)
            h = (h + id.charCodeAt(ci)) | 0;
        return PIRATE_SHIP_MODELS[h % PIRATE_SHIP_MODELS.length];
    }
    return ENEMY_MODEL_KEY[type];
}
/** Enemy render size scale — matches the updateShip3D call (e.size / 15.2). */
export function enemySizeScale(size) {
    return size / 15.2;
}
function pointInHull(pts, x, z) {
    // even-odd ray cast
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, zi] = pts[i];
        const [xj, zj] = pts[j];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}
/**
 * Point-vs-ship-silhouette test in world coordinates.
 * - hullKey: SHIP_HULLS key (ship class or enemy_* key)
 * - ex/ey, angle: ship position + heading (game convention, 0 = east)
 * - sizeScale: render size scale (enemySizeScale(e.size) or SHIP_SIZE_SCALE)
 * - px/py: the point (projectile position)
 * - inflate: >1 makes the target slightly generous, <1 stricter
 */
export function shipHitTest(hullKey, ex, ey, angle, sizeScale, px, py, inflate = 1) {
    const hull = SHIP_HULLS[hullKey];
    if (!hull)
        return false;
    const scale = hull.pxPerUnit * sizeScale * inflate;
    const dx = px - ex;
    const dy = py - ey;
    // broad phase in world units (screen-y compressed extent <= uncompressed)
    const rw = hull.r * scale;
    if (dx * dx + dy * dy > rw * rw)
        return false;
    // undo tilt compression, then undo yaw
    const wx = dx / scale;
    const wz = dy / (scale * HULL_COS_TILT);
    const psi = -angle + Math.PI;
    const c = Math.cos(psi), s = Math.sin(psi);
    const lx = wx * c - wz * s;
    const lz = wx * s + wz * c;
    return pointInHull(hull.pts, lx, lz);
}
/**
 * Segment-vs-silhouette: samples along the projectile's travel this tick so
 * fast shots can't tunnel through a thin hull between two ticks.
 */
export function shipHitTestSwept(hullKey, ex, ey, angle, sizeScale, x0, y0, x1, y1, inflate = 1) {
    const hull = SHIP_HULLS[hullKey];
    if (!hull)
        return false;
    // broad phase: distance from ship center to the travel segment
    const rw = hull.r * hull.pxPerUnit * sizeScale * inflate;
    const sx = x1 - x0, sy = y1 - y0;
    const segLenSq = sx * sx + sy * sy;
    let t = segLenSq > 0 ? ((ex - x0) * sx + (ey - y0) * sy) / segLenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = x0 + sx * t - ex, cy = y0 + sy * t - ey;
    if (cx * cx + cy * cy > rw * rw)
        return false;
    // narrow phase: sample along the segment
    const segLen = Math.sqrt(segLenSq);
    const steps = Math.max(1, Math.min(6, Math.ceil(segLen / 10)));
    for (let i = 0; i <= steps; i++) {
        const tt = i / steps;
        if (shipHitTest(hullKey, ex, ey, angle, sizeScale, x0 + sx * tt, y0 + sy * tt, inflate)) {
            return true;
        }
    }
    return false;
}
/** World-unit broad radius of a ship's silhouette (for external prechecks). */
export function shipHullRadius(hullKey, sizeScale) {
    const hull = SHIP_HULLS[hullKey];
    return hull ? hull.r * hull.pxPerUnit * sizeScale : 0;
}
export { SHIP_HULLS };
