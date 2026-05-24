import { writable, derived } from 'svelte/store';
import type { Entity } from '$lib/game/entities';

// ── Economy ──────────────────────────────────────────────────
export const credits    = writable(1000);
export const powerGen   = writable(5);
export const powerUsed  = writable(0);
export const powerOk    = derived([powerGen, powerUsed], ([g, u]) => g >= u);
export const incomeRate = writable(10);   // cr/s estimate

// ── Waves ────────────────────────────────────────────────────
export const wave        = writable(0);     // current wave number
export const nextWaveIn  = writable(15);    // seconds until next wave
export const waveIncoming = writable(false);
export const totalWaves  = writable(7);     // from WAVES.length

// ── Game state ───────────────────────────────────────────────
export type GameStateType = 'playing' | 'won' | 'lost';
export const gameState = writable<GameStateType>('playing');

// ── Selection & commands ─────────────────────────────────────
export const selected  = writable<Entity[]>([]);
export const buildMode = writable<string | null>(null);

// ── Status bar ───────────────────────────────────────────────
export const statusMsg = writable<{ text: string; type: string }>({ text: 'TIBERIUM WARS v3.0', type: '' });

// ── Booleans for sidebar panel visibility ─────────────────────
export const selHasBarracks = writable(false);
export const selHasRefinery = writable(false);
export const selHasUnits    = writable(false);
export const hasBarracks    = writable(false);  // any barracks built
export const hasRefinery    = writable(false);  // any refinery built

// ── War Factory HP (for objective display) ───────────────────
export const warFactoryHp    = writable(1800);
export const warFactoryMaxHp = writable(1800);

// ── Kill stats ────────────────────────────────────────────────
export const enemiesKilled   = writable(0);
export const unitsLost       = writable(0);
