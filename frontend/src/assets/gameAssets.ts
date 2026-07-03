// Central asset path registry for Cosmic Realm.
// Drop replacement PNG/SVG files into the matching public/assets/ subfolder,
// then update the path here — no need to hunt through renderer files.

// ── UI ────────────────────────────────────────────────────────────────────
export const UI_ASSETS = {
  panels: {
    default:      "/assets/ui/panels/panel_default.png",
    dark:         "/assets/ui/panels/panel_dark.png",
    glow:         "/assets/ui/panels/panel_glow.png",
    station:      "/assets/ui/panels/panel_station.png",
  },
  buttons: {
    primary:      "/assets/ui/buttons/btn_primary.png",
    danger:       "/assets/ui/buttons/btn_danger.png",
    amber:        "/assets/ui/buttons/btn_amber.png",
    disabled:     "/assets/ui/buttons/btn_disabled.png",
  },
  frames: {
    ship:         "/assets/ui/frames/frame_ship.png",
    module:       "/assets/ui/frames/frame_module.png",
    drone:        "/assets/ui/frames/frame_drone.png",
    stat:         "/assets/ui/frames/frame_stat.png",
  },
  slots: {
    weapon:       "/assets/ui/slots/slot_weapon.png",
    generator:    "/assets/ui/slots/slot_generator.png",
    module:       "/assets/ui/slots/slot_module.png",
    empty:        "/assets/ui/slots/slot_empty.png",
  },
  icons: {
    credits:      "/assets/ui/icons/icon_credits.png",
    exp:          "/assets/ui/icons/icon_exp.png",
    honor:        "/assets/ui/icons/icon_honor.png",
    hull:         "/assets/ui/icons/icon_hull.png",
    shield:       "/assets/ui/icons/icon_shield.png",
    speed:        "/assets/ui/icons/icon_speed.png",
    damage:       "/assets/ui/icons/icon_damage.png",
    drone:        "/assets/ui/icons/icon_drone.png",
    ammo:         "/assets/ui/icons/icon_ammo.png",
    cargo:        "/assets/ui/icons/icon_cargo.png",
  },
  bars: {
    hull:         "/assets/ui/bars/bar_hull.png",
    shield:       "/assets/ui/bars/bar_shield.png",
    exp:          "/assets/ui/bars/bar_exp.png",
    progress:     "/assets/ui/bars/bar_progress.png",
    barBg:        "/assets/ui/bars/bar_bg.png",
  },
  hud: {
    compass:      "/assets/ui/hud/hud_compass.png",
    crosshair:    "/assets/ui/hud/hud_crosshair.png",
    minimap:      "/assets/ui/hud/hud_minimap.png",
    minimapFrame: "/assets/ui/hud/hud_minimap_frame.png",
    targetLock:   "/assets/ui/hud/hud_target_lock.png",
  },
  tooltips: {
    default:      "/assets/ui/tooltips/tooltip_default.png",
    warning:      "/assets/ui/tooltips/tooltip_warning.png",
  },
} as const;

// ── SHIPS ─────────────────────────────────────────────────────────────────
// Existing runtime paths (public/ships/) are used by the renderers directly.
// Add new custom ship graphics under public/assets/ships/ and reference them here.
export const SHIP_ASSETS = {
  player: {
    skimmer:    "/assets/ships/player/skimmer.png",
    wasp:       "/assets/ships/player/wasp.png",
    vanguard:   "/assets/ships/player/vanguard.png",
    reaver:     "/assets/ships/player/reaver.png",
    obsidian:   "/assets/ships/player/obsidian.png",
    marauder:   "/assets/ships/player/marauder.png",
    phalanx:    "/assets/ships/player/phalanx.png",
    titan:      "/assets/ships/player/titan.png",
    leviathan:  "/assets/ships/player/leviathan.png",
    specter:    "/assets/ships/player/specter.png",
    colossus:   "/assets/ships/player/colossus.png",
    harbinger:  "/assets/ships/player/harbinger.png",
    eclipse:    "/assets/ships/player/eclipse.png",
    sovereign:  "/assets/ships/player/sovereign.png",
    apex:       "/assets/ships/player/apex.png",
  },
  enemies: {
    scout:      "/assets/ships/enemies/scout.png",
    fighter:    "/assets/ships/enemies/fighter.png",
    bomber:     "/assets/ships/enemies/bomber.png",
    elite:      "/assets/ships/enemies/elite.png",
    boss:       "/assets/ships/enemies/boss.png",
  },
} as const;

// ── EFFECTS ───────────────────────────────────────────────────────────────
export const EFFECT_ASSETS = {
  projectiles: {
    laser:          "/assets/effects/projectiles/laser.png",
    rocket:         "/assets/effects/projectiles/rocket.png",
    plasma:         "/assets/effects/projectiles/plasma.png",
    beam:           "/assets/effects/projectiles/beam.png",
  },
  explosions: {
    small:          "/assets/effects/explosions/explosion_small.png",
    medium:         "/assets/effects/explosions/explosion_medium.png",
    large:          "/assets/effects/explosions/explosion_large.png",
    spritesheet:    "/assets/effects/explosions/explosion_sheet.png",
  },
  thrusters: {
    default:        "/assets/effects/thrusters/thruster_default.png",
    boost:          "/assets/effects/thrusters/thruster_boost.png",
    glow:           "/assets/effects/thrusters/thruster_glow.png",
  },
  hits: {
    shield:         "/assets/effects/hits/hit_shield.png",
    hull:           "/assets/effects/hits/hit_hull.png",
    critical:       "/assets/effects/hits/hit_critical.png",
  },
  portals: {
    spritesheet:    "/assets/effects/portals/portal_sheet.png",
    glow:           "/assets/effects/portals/portal_glow.png",
  },
} as const;

// ── WORLD ─────────────────────────────────────────────────────────────────
export const WORLD_ASSETS = {
  backgrounds: {
    earth:          "/assets/world/backgrounds/bg_earth.png",
    mars:           "/assets/world/backgrounds/bg_mars.png",
    venus:          "/assets/world/backgrounds/bg_venus.png",
    deep:           "/assets/world/backgrounds/bg_deep.png",
  },
  parallax: {
    stars_near:     "/assets/world/parallax/parallax_stars_near.png",
    stars_far:      "/assets/world/parallax/parallax_stars_far.png",
    nebula:         "/assets/world/parallax/parallax_nebula.png",
    dust:           "/assets/world/parallax/parallax_dust.png",
  },
  asteroids: {
    small:          "/assets/world/asteroids/asteroid_small.png",
    medium:         "/assets/world/asteroids/asteroid_medium.png",
    large:          "/assets/world/asteroids/asteroid_large.png",
    crystal:        "/assets/world/asteroids/asteroid_crystal.png",
  },
  stations: {
    hub:            "/assets/world/stations/station_hub.png",
    factory:        "/assets/world/stations/station_factory.png",
    outpost:        "/assets/world/stations/station_outpost.png",
  },
  planets: {
    earth:          "/assets/world/planets/planet_earth.png",
    mars:           "/assets/world/planets/planet_mars.png",
    venus:          "/assets/world/planets/planet_venus.png",
    gas:            "/assets/world/planets/planet_gas.png",
    ice:            "/assets/world/planets/planet_ice.png",
  },
} as const;
