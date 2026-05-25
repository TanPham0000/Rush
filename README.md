# RUSH

A browser-based real-time strategy game built with SvelteKit and HTML5 Canvas. No dependencies beyond the framework — all rendering is raw 2D canvas.

---

## Overview

RUSH is a single-player RTS with a Command & Conquer feel. You build a base, harvest Tiberium for income, train units, and fight through waves of enemy forces. It runs entirely in the browser with no server required.

Six maps are included across two modes. Skirmish and campaign maps task you with destroying the enemy base or holding a key objective. Operation Whale is a 15-minute survival scenario where you hold a beachhead against escalating amphibious waves — including a desperate last-ditch assault at minute 14.

---

## Features

### Base Building
- Place buildings within your power grid. Every Construction Yard and Power Plant projects a build radius — chain Power Plants outward to expand your footprint.
- Buildings take time to construct and are non-functional until complete. A scaffold animation and progress bar show build state.
- Power Plants generate power. Power-hungry structures draw from the grid. If supply runs short, turrets go offline.
- Each Refinery automatically spawns a Harvester on placement.

### Economy
- Harvesters automatically seek Tiberium fields, collect cargo (up to 250¢ per trip), and return to the **nearest** Refinery.
- **Rich Tiberium fields** (30% chance, golden-green glow) carry 3,500–5,500¢. Standard fields carry 1,500–2,800¢.
- Tiberium fields are rendered as glowing rocks that slowly pulse — rich fields pulse warm amber-green, standard fields a cooler green.
- Fields deplete over time and can be exhausted.
- Capture nodes around each map provide passive income per second.

### Units

All units face their movement direction and are rendered as canvas art in local rotated space.

| Unit | Cost | Train | Role |
|---|---|---|---|
| Infantry | 100¢ | 8s | General purpose. Weak against armour. |
| Grenadier | 100¢ | 11s | Splash grenades. Upgraded from Barracks via Tech Lab. |
| Marksman | 175¢ | 14s | Long-range precision. Devastates infantry, weak against armour. Requires Tech Lab. |
| Tank | 400¢ | 20s | Core armour. Strong against infantry. |
| Heavy Tank | 400¢ | 26s | Upgraded tank — +60% HP, +30% dmg. Requires Tech Lab upgrade. |
| Artillery | 550¢ | 28s | Long-range siege. Devastating against buildings and clusters. Slow to reload. Requires Tech Lab. |
| Scout | 80¢ | 5s | Fast harassment. Extends vision radius. Poor against armour. |
| Anti-Tank Gun | 280¢ | 18s | Specialist armour-killer. Weak against infantry. Requires Tech Lab. |
| Harvester | 300¢ | 13s | Economic unit. Collects Tiberium from the nearest available field. |

### Damage System
A soft rock-paper-scissors matrix governs effectiveness. Damage multipliers apply per target class — tanks shred infantry, artillery punishes clusters and buildings, scouts harass artillery, anti-tank guns devastate armour. No unit type is universally dominant.

### Turrets
Turrets can be individually upgraded after a Tech Lab is built:

| Upgrade | Cost | Effect |
|---|---|---|
| Anti-Infantry | 250¢ | Dual autocannons. High fire rate, greatly reduced damage against armour. |
| Anti-Tank | 350¢ | Heavy cannon. Slow fire rate, high damage multiplier against armour. |
| Artillery | 500¢ | Siege cannon. Extreme range and splash, very slow reload. |

Upgrades are permanent and cannot be reversed.

### Armoury
Build an Armoury (requires Barracks) to access infantry-wide upgrade research:

| Upgrade | Cost | Effect |
|---|---|---|
| Reinforced Armour | 350¢ | +20% HP to all infantry |
| Incendiary Rounds | 350¢ | +20% damage to all infantry |
| Quick March | 280¢ | +15% speed to all infantry |
| Entrench | 400¢ | Infantry dig in after 8 seconds idle (+40% damage reduction) |

All researched upgrades apply retroactively to existing infantry and to all future spawns.

### Entrench
Once the Entrench upgrade is researched, infantry automatically dig a trench after standing still for 8 seconds. While entrenched:
- They take 40% less damage from all sources.
- They will **fire in place** at enemies within attack range rather than advancing.
- Enemies out of range are dropped — entrenched units never chase a target.
- Moving, retreating, or receiving a new move order breaks the trench immediately.

### Engineer Depot
Capture nodes marked **ENGINEER DEPOT** project a 150px repair zone. While held by the player, all vehicles in range (Tanks, Heavy Tanks, Artillery, Scout, Anti-Tank Guns, Harvesters) are repaired at 14 HP/s. A pulsing green ring and **REPAIR ZONE** label mark the aura. Green particles animate on vehicles being healed.

### Fog of War
All unexplored terrain is hidden. Explored areas show a dimmer memory state. Scouts extend vision radius. Holding a Radar node reveals the entire map for as long as it is held.

### Capture Nodes
Neutral nodes can be captured by moving infantry onto them. Node types:

| Type | Effect |
|---|---|
| Standard | Passive income per second. |
| Center Node | Counts toward the hold-to-win condition (120 seconds). |
| Black Market | Unlocks three one-time special abilities. |
| Radar Tower | Grants full-map vision while held. |
| Beach Gun | Spawns a powerful long-range defensive turret. |
| Engineer Depot | Repairs nearby vehicles at 14 HP/s while held. |

### Black Market
Capturing a Black Market node unlocks three one-time special abilities usable from the sidebar:

- **Airstrike** — Calls a strafing run on a targeted area.
- **EMP Pulse** — Temporarily disables all enemy units in a radius.
- **Supply Drop** — Delivers bonus credits to your account.

### Campaign and Skirmish
- **Skirmish**: play any single map against the AI.
- **Campaign**: maps played in sequence. Completing a map unlocks the next.
- **Operation Whale**: survival mode — hold 15 minutes against escalating waves.

---

## Maps

### River Crossing
Your base is split by a river. Three bridges control all armour movement. The enemy pushes all three simultaneously — you cannot defend everything. Hold the Control Center for 120 seconds to trigger a collapse, or destroy the War Factory directly.

### Highland Assault
Shattered ridges and dense forest. The enemy digs in on the high ground — push long-range weapons to overlook their compound or flank wide. Marksmen and Artillery excel here. Enemy has active eco. SUMMIT is placed deep in enemy lines.

### Urban Siege
A ruined city where every street corner is a kill zone. Infantry exploit building cover; tanks are exposed in the open. An **Engineer Depot** sits mid-south — fight to hold it and keep your armour alive. Enemy has active eco. Two win conditions: destroy the enemy Construction Yard, or hold City Center for 120 seconds.

### Operation Whale *(Survival — 15 minutes)*
Amphibious assault from the deep blue. Waves land from the sea on a strict schedule, growing through the 15 minutes. At **minute 14** a final all-in assault hits — 60 infantry and 15 tanks in one last-ditch push. Capture income nodes to fund your defence, the Radar Tower for map vision, the Beach Gun for extra firepower, and the **Engineer Depot** in the contested forward zone to keep your vehicles operational. Start credits are limited; every purchase is a decision.

### Dead Man's Pass
A desert canyon splits the battlefield north to south. The only route through is a passage barely four soldiers wide. Capture both Radar Stations to blind the enemy, then hold The Pass for 120 seconds — or take the grinding alternative of destroying their Construction Yard under cover of canyon walls. Highest wave and HP scaling of the campaign.

### Operation Siege *(Final Map)*
Final push. The enemy commands from the northeast district, protected by 10 reinforced turrets, a Barracks, and a War Factory. Enemy HP is +50%. The only win condition is destroying their Construction Yard. Capture City Park for income and cover. Capture the Observation Post at the far southeast for full radar. The Black Market is mid-south. Resource-rich but it ends only one way.

---

## Building Reference

| Building | Cost | Power | Build Time | Notes |
|---|---|---|---|---|
| Construction Yard | — | +5 | — | Starting structure. 320px build radius. |
| Power Plant | 200¢ | +20 | 22s | Expands build grid 360px. |
| Barracks | 300¢ | −5 | 28s | Trains infantry-class units. Required for Armoury. |
| Refinery | 500¢ | −10 | 32s | Converts Tiberium to credits. Spawns a Harvester on completion. |
| Turret | 350¢ | −5 | 7s | Upgradeable to Anti-Infantry, Anti-Tank, or Artillery. |
| War Factory | 700¢ | 0 | 40s | Trains armour-class units. |
| Tech Lab | 600¢ | −8 | 36s | Unlocks Grenadier, Marksman, Artillery, Anti-Tank Gun, Heavy Tank, and turret upgrades. |
| Armoury | 450¢ | −6 | 30s | Infantry upgrades: Armour, Damage, Speed, Entrench. Requires Barracks. |

---

## Controls

| Input | Action |
|---|---|
| Left click | Select unit / building |
| Left drag | Box select units |
| Right click | Move / attack-move |
| Middle wheel | Zoom |
| Arrow keys | Pan camera |
| Mouse edge | Edge scroll |
| `A` | Attack-move mode |
| `S` | Stop selected units |
| `G` | Guard mode |
| `R` | Retreat selected units |
| `Escape` | Cancel build placement |
| `P` | Place Power Plant |
| `B` | Place Barracks |
| `F` | Place Refinery |
| `T` | Place Turret |
| `K` | Place Tech Lab |
| `O` | Place Armoury |

---

## Tech

- **SvelteKit** with static adapter — output is a plain static site
- **Svelte 5** runes mode (`$state`, `$derived`, `$props`)
- **TypeScript** strict mode throughout
- **HTML5 Canvas 2D** — all rendering is manual, no game engine
- World space: 1800×1200. Viewport: 900×600. Camera pan and zoom supported.
- Fog of war: `Uint8Array` grid at 20px cell resolution (unexplored / explored / visible)
- Entity classes: `Building`, `Unit`, `Turret`, `Harvester`, `EnemyUnit`, `CaptureNode`, `Projectile`, `TiberiumField`
- Tiberium rocks rendered as layered ellipses with independent phase offsets and a radial gradient glow, slow pulse (~9–11s cycle)

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

Output goes to `build/` as a static site — deploy to Vercel, Netlify, or GitHub Pages.

---

## Project Structure

```
src/lib/
  game/
    engine.ts      — Game loop, AI, wave spawning, build system, repair logic, black market
    entities.ts    — All entity classes with draw methods (units, buildings, tiberium, nodes)
    terrain.ts     — Map generation and rendering per theme (0=rivers 1=hills 2=city 3=beach 4=desert)
    constants.ts   — BDEF, UPGRADES, ARMOURY_UPGRADES, UNIT_COST, TRAIN_TIME, WAVES, MAPS
    utils.ts       — Canvas helpers, math utilities
  components/
    GameCanvas.svelte — Canvas, input handling, game loop RAF
    Sidebar.svelte    — Build panel, train panel, Tech Lab / Armoury upgrade panels, node HUD
  stores/
    gameStore.ts   — Svelte stores bridging engine state to UI
```

---

## License

MIT
