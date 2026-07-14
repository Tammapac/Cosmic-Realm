# Cosmic Realm — Combat Guide

## The combat model

Combat is **server-authoritative**: the backend simulates every NPC, every
hit and every point of damage; the client renders it and mirrors visuals.
What you see is what the server decided — client tampering can't fake
damage, loot or stats.

### Silhouette hitboxes

Hit detection uses each ship's **actual 2D silhouette** (a convex hull
extracted from its 3D model, shared by server and client). Shots connect
when they cross the visible outline — no invisible circles. Projectile
sweeps are sampled so fast shots can't tunnel through thin hulls. Player
ships and all 16 enemy models each carry their own hull; the same data
drives generous click-targeting so locking an enemy never needs pixel
precision.

Model pivots are centered, so shots visually strike the middle of the
target, and client-side impact bursts render *inside* the hull body rather
than on its rim.

## Weapons

### Lasers (key `1` toggles firing)

- Fire from the ship's authored **muzzle hardpoints**, alternating gun
  pairs on multi-gun hulls, aimed per-muzzle at the locked target's center.
- Firing patterns come from the equipped weapon module: **standard**
  (dual-gun), **sniper** (single heavy beam), **scatter** (3-pellet
  shotgun), **rail** (3-shot burst).
- Laser ammo: rounds are stocked at stations (cost per round), with
  multiple ammo types (damage multipliers, AOE splash, EMP stun variants)
  switchable from the hotbar. Munitions Bay modules raise capacity;
  auto-restock can be enabled at Services.

### Rockets (key `2` toggles firing)

- Launch from weapon hardpoints, aimed at the locked target's center and
  **homing on your locked target** (4.5 rad/s turn), with fiery trails and
  smoke. Rocket ammo types (damage/EMP variants) are bought per round.

### Enemy fire

Every enemy class has a signature bullet pattern — aimed twin shots,
3-way fans, 5-way sprays, spirals (sentinels), heavy charged bolts +
side orbs (destroyers), seeker volleys, and boss rings that rotate volley
by volley. Enemy shots glow with transparent light-traces, and every
volley pops a small muzzle pulse at the shooter's gun. Seeker shots curve
at a deliberately dodgeable rate — weaving matters.

## Defenses

- **Shield** absorbs a fraction of incoming damage (base 50%, modifiable
  by generators up to 95%) and regenerates out of combat; **hull** is
  repaired at stations (or via auto-repair services and consumables).
- **Damage reduction** (armor modules + skills, capped 80%).
- EMP effects can stun.

## Drones

Up to your hull's drone-slot count (1–5+). Bought at the Drones tab; each
drone adds passive damage/shield/hull bonuses and fights alongside you with
three stances — **ORB** (circle the ship), **FWD** (advance toward your
target), **DEF** (hold close, short range). Drones take damage, can be
repaired at Services, and scrap for a 50% refund. Prices double per copy
owned.

## Consumables & hotbar

8 hotbar slots for consumables: repair kits, shield boosters, damage/speed
boosts, rocket salvos, drone pods, EMP bursts and more — bought in the
station Market, right-click to reassign slots.

## Death & respawn

Ship destruction triggers a death overlay and respawn timer; you respawn
at a safe point. Deaths are tracked in your milestones.

## Reading the battlefield

- Enemy names: red, futuristic font, sized by threat; bosses flagged
  ◆ NAME ◆ in amber with the top-screen boss bar within range.
- Target window (mid-left when locked): enemy name + one HP bar.
- Selection ring pulses red around the locked enemy.
- Your own hull/shield bars ride under your ship; incoming fire flashes
  the hit ship white and sparks at the impact point.
- Minimal muzzle pulses, projectile glows and traces make incoming fire
  readable without flooding the screen — combat readability wins over
  spectacle everywhere.
