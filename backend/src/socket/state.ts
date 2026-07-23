export type PlayerInput = {
  seq: number;
  targetX: number | null;
  targetY: number | null;
  firing: boolean;
  rocketFiring: boolean;
  attackTargetId: string | null;
  miningTargetId: string | null;
  laserAmmo: string;
  rocketAmmo: string;
};

// Compact drone entry replicated to other clients so they can render remote drones.
// Position is NOT transmitted — the client recomputes formation each frame using
// the remote player's pos/angle (same formation math as the local player).
export type WireDrone = {
  id: string;
  kind: string;
  hp: number;
};

export type OnlinePlayer = {
  socketId: string;
  playerId: number;
  name: string;
  shipClass: string;
  level: number;
  faction: string | null;
  clan: string | null;
  zone: string;
  posX: number;
  posY: number;
  velX: number;
  velY: number;
  angle: number;
  hull: number;
  hullMax: number;
  shield: number;
  shieldMax: number;
  honor: number;
  targetX: number | null;
  targetY: number | null;
  // WASD control scheme: heading (rad) the ship faces regardless of movement
  // direction (cursor aim). null = classic (nose follows movement/target).
  aimAngle: number | null;
  speed: number;
  isLaserFiring: boolean;
  isRocketFiring: boolean;
  attackTargetId: string | null;
  // Player id (as string) this player has explicitly selected as a PvP target.
  // Enables same-faction opt-in duels: same-faction damage only lands when the
  // victim is the attacker's chosen pvpTargetId. Different-faction PvP never
  // needs this. Null when no player is targeted.
  pvpTargetId: string | null;
  miningTargetId: string | null;
  laserAmmoType: string;
  rocketAmmoType: string;
  laserFireCd: number;
  rocketFireCd: number;
  shieldRegen: number;
  afterburnUntil: number;
  lastHitTick: number;
  isDocked: boolean;
  drones: WireDrone[];
  // Cursor into the standard-laser muzzle pair schedule. Advances by 1 per
  // trigger pull; the two shots that pull emits use hardpointIndex
  // (2·nextMuzzlePair) and (2·nextMuzzlePair + 1). Wraps every LASER_PAIR_COUNT
  // fires so ships with more muzzles cycle across all of them.
  nextMuzzlePair: number;
};

const zones = new Map<string, Map<number, OnlinePlayer>>();

export function getZone(zoneId: string): Map<number, OnlinePlayer> {
  if (!zones.has(zoneId)) zones.set(zoneId, new Map());
  return zones.get(zoneId)!;
}

export function addPlayer(p: OnlinePlayer): void {
  getZone(p.zone).set(p.playerId, p);
}

export function removePlayer(playerId: number): string | null {
  for (const [zoneId, players] of zones) {
    if (players.has(playerId)) {
      players.delete(playerId);
      return zoneId;
    }
  }
  return null;
}

export function movePlayerToZone(playerId: number, fromZone: string, toZone: string): void {
  const from = getZone(fromZone);
  const player = from.get(playerId);
  if (!player) return;
  from.delete(playerId);
  player.zone = toZone;
  getZone(toZone).set(playerId, player);
}

export function getPlayersInZone(zoneId: string): OnlinePlayer[] {
  return Array.from(getZone(zoneId).values());
}

export function getPlayer(playerId: number): OnlinePlayer | undefined {
  for (const players of zones.values()) {
    if (players.has(playerId)) return players.get(playerId);
  }
  return undefined;
}

export function getOnlineCount(): number {
  let count = 0;
  for (const players of zones.values()) count += players.size;
  return count;
}

export function getAllZones(): Map<string, Map<number, OnlinePlayer>> {
  return zones;
}
