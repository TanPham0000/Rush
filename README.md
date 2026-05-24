# RUSH

A browser-based real-time strategy game built with SvelteKit and HTML5 Canvas. No dependencies beyond the framework — all rendering is raw 2D canvas.

---

## Overview

RUSH is a single-player RTS with a Command and Conquer feel. You build a base, harvest Tiberium for income, train units, and fight through waves of enemy forces. It runs entirely in the browser with no server required.

Three standard skirmish maps and one survival map are included. Skirmish maps task you with destroying the enemy War Factory. The Beach Defence map is a 15-minute survival scenario where you hold a coastal position against escalating landing waves.

---

## Features

### Base Building
- Place buildings within the power grid: every Construction Yard and Power Plant projects a build radius. You must chain Power Plants outward to expand your base footprint.
- Buildings take time to construct and are non-functional until complete. A scaffold animation and progress bar show the build state.
- Power Plants generate power. Power-hungry buildings (Barracks, Refinery, Turrets, Tech Lab) draw from the grid. If supply falls short, turrets go offline.
- Each Refinery automatically spawns a Harvester on placement.

### Economy
- Harvesters automatically seek Tiberium fields, collect cargo, and return to the Refinery.
- Tiberium fields deplete over time and can be exhausted.
- Income rate scales with how many Refineries you have operational.
- Capture nodes around the map provide bonus income per second when held.

### Units
All units are drawn as canvas art in local rotated space so they face their movement direction.

| Unit | Role |
|---|---|
| Infantry | General purpose. Weak against armour. |
| Grenadier | Infantry with splash grenades. Upgraded from Barracks via Tech Lab. |
| Tank | Core armour unit. Strong against infantry and artillery. |
| Heavy Tank | Upgraded tank. Dominates infantry, holds against other armour. Requires Tech Lab upgrade. |
| Artillery | Long-range siege unit. Must deploy before firing. Devastating against buildings and clusters. |
| Scout | Fast harassment unit. Excellent against artillery, near-useless against armour. Provides vision radius. |
| Anti-Tank Gun | Specialist armour-killer. Weak against infantry. Requires Tech Lab upgrade. |
| Harvester | Economic unit. Collects Tiberium. Respects manual move commands. |

### Damage System
A soft rock-paper-scissors matrix governs unit effectiveness. Damage multipliers are applied per target type — tanks shred infantry, artillery siege buildings, scouts harass artillery, anti-tank guns devastate armour. No unit type is universally dominant.

### Turrets
Standard turrets can be individually upgraded after a Tech Lab is built:
- Anti-Infantry: dual autocannons, high fire rate, greatly reduced damage against armour.
- Anti-Tank: heavy cannon, slow rate of fire, high damage multiplier against armour.

Upgrading costs 250 or 350 credits respectively and cannot be reversed.

### Fog of War
All unexplored terrain is hidden. Explored areas show a dimmer memory state. Scouts extend the vision radius of your forces. Capturing the Radar Tower (Beach Defence map) reveals the entire map for as long as you hold it.

### Capture Nodes
Neutral nodes around each map can be captured by moving infantry onto them. Nodes provide income, and some have special effects:

- Standard node: passive income.
- Center node (skirmish): counts toward the hold-to-win condition.
- Black Market node: unlocks three one-time special abilities.
- Radar Tower (Beach Defence): grants full-map vision while held.
- Beach Gun (Beach Defence): spawns a powerful long-range defensive turret.

### Campaign and Skirmish
- Skirmish: play any single map against the AI.
- Campaign: three maps played in sequence. Winning unlocks the next.
- Beach Defence: survival mode. Hold for 15 minutes against escalating waves.

---

## Maps

**River Crossing** — Your base is split by a river. Three bridges control all armour movement. The enemy will push all three; you cannot defend everything.

**Highland** — Open terrain with high ground that slows movement. Flanking is viable in all directions.

**City** — Dense urban blocks break line of sight and channel movement. Building footprints are tighter. A fifth enemy turret guards the city centre.

**Beach Defence** (survival) — You wake up to an invasion. Two turrets, scattered infantry, no time to prepare. Waves land from the sea every 30 seconds and grow through the 15 minutes. Capture the Radar Tower for vision and the Beach Gun for extra firepower.

---

## Building Reference

| Building | Cost | Power | Build Time | Notes |
|---|---|---|---|---|
| Construction Yard | — | +5 | — | Starting structure. 320px build radius. |
| Power Plant | 200 | +20 | 22s | Expands build grid by 360px. |
| Barracks | 300 | -5 | 28s | Trains infantry-class units. |
| Refinery | 500 | -10 | 32s | Converts Tiberium to credits. Spawns a Harvester. |
| Turret | 350 | -5 | 16s | Upgradeable to Anti-Infantry or Anti-Tank. |
| War Factory | 700 | 0 | 40s | Trains armour-class units. |
| Tech Lab | 600 | -8 | 36s | Unlocks advanced units and turret upgrades. |

---

## Tech

- **SvelteKit** with static adapter (output is a plain static site)
- **Svelte 5** runes mode (`$state`, `$derived`, `$props`)
- **TypeScript** strict mode throughout
- **HTML5 Canvas 2D** — all rendering is done manually, no game engine
- World space: 1800x1200. Viewport: 900x600. Camera pan and zoom supported.
- Fog of war implemented as a Uint8Array grid (unexplored / explored / visible)
- Entity-component pattern: Building, Unit, Turret, Harvester, EnemyUnit, CaptureNode, Projectile

---

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

To build for production:

```bash
npm run build
```

Output goes to `build/` as a static site. Drop it on any static host (Vercel, Netlify, GitHub Pages).

---

## Project Structure

```
src/lib/
  game/
    engine.ts      — Game loop, input, AI, wave spawning, build system
    entities.ts    — All entity classes with draw methods
    terrain.ts     — Map generation and rendering per theme
    constants.ts   — BDEF, WAVES, UNIT_COST, UPGRADES, map definitions
    utils.ts       — Canvas helpers, math utilities
  components/
    Sidebar.svelte — Build panel, train panel, upgrade panel, node HUD
  stores/
    gameStore.ts   — Svelte stores bridging engine state to UI
```

---

## License

MIT
