export const MOVEMENT = {
  STOP_DISTANCE: 10,
    ACCELERATION: 1500,
  SNAP_DISTANCE: 3,
  IDLE_SPEED: 3,
  ACCELERATION_MULTIPLIER: 0,
  FRICTION_PER_60FPS_FRAME: 0.93,
  AFTERBURN_MULTIPLIER: 3,
  SERVER_TICK_RATE: 30,
} as const;

export const NETCODE = {
  INTERPOLATION_FACTOR: 0.55,
  SERVER_BUFFER_MS: 100,
} as const;

/** Bebcell cost to reach each pet-drone level. Shared by client (UI display)
 *  and server (backend/src/socket/handler.ts's drone:upgrade validates the
 *  spend against THIS table, never a client-sent cost) so the two can never
 *  drift apart. */
export const PET_DRONE_UPGRADE_COST: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
  1: 30, 2: 80, 3: 180, 4: 350, 5: 650, 6: 1100,
};
