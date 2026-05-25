import { writable, derived } from 'svelte/store';
import type { Entity } from '$lib/game/entities';

// ── Economy ──────────────────────────────────────────────────
export const credits    = writable(1000);
export const powerGen   = writable(5);
export const powerUsed  = writable(0);
export const powerOk    = derived([powerGen, powerUsed], ([g, u]) => g >= u);
export const incomeRate = writable(10);

// ── Waves ────────────────────────────────────────────────────
export const wave         = writable(0);
export const nextWaveIn   = writable(20);
export const waveIncoming = writable(false);
export const totalWaves   = writable(7);

// ── Game state ───────────────────────────────────────────────
export type GameStateType = 'menu' | 'playing' | 'won' | 'lost';
export const gameState    = writable<GameStateType>('menu');

// Campaign
export const campaignMap    = writable(0);         // which map (0|1|2)
export const campaignWins   = writable(0);         // maps completed
export const campaignMode   = writable(false);     // skirmish vs campaign

// ── Selection & commands ─────────────────────────────────────
export const selected  = writable<Entity[]>([]);
export const buildMode = writable<string | null>(null);

// ── Status bar ───────────────────────────────────────────────
export const statusMsg = writable<{ text: string; type: string }>({ text: 'RUSH v1.0', type: '' });

// ── Sidebar panel visibility ──────────────────────────────────
export const selHasBarracks   = writable(false);
export const selHasRefinery   = writable(false);
export const selHasWarFactory = writable(false);
export const selHasUnits      = writable(false);
export const hasBarracks      = writable(false);
export const hasRefinery      = writable(false);
export const hasTechLab       = writable(false);
export const hasWarFactory    = writable(false);
export const selHasTechLab    = writable(false);
export const selHasTurret     = writable(false);
export const selTurretVariant = writable<string>('standard'); // 'standard'|'anti-infantry'|'anti-tank'
export const hasArmoury       = writable(false);
export const selHasArmoury    = writable(false);

// ── Pause ─────────────────────────────────────────────────────
export const paused = writable(false);

// ── War Factory HP ───────────────────────────────────────────
export const warFactoryHp    = writable(2200);
export const warFactoryMaxHp = writable(2200);

// ── Kill stats ────────────────────────────────────────────────
export const enemiesKilled = writable(0);
export const unitsLost     = writable(0);
export const unitsProduced = writable(0);

// ── Build queue (selected building) ──────────────────────────
export interface QueueState {
  head: { type: string; pct: number } | null;
  rest: string[];
}
export const selBuildingQueue = writable<QueueState>({ head: null, rest: [] });

// ── Capture nodes ─────────────────────────────────────────────
export interface NodeState {
  label: string;
  team: 'player' | 'enemy' | 'neutral';
  progress: number;
  isCenter: boolean;
  isBlackMarket: boolean;
  isRadar: boolean;
  isBeachGun: boolean;
  isPark: boolean;
  isEngineer: boolean;
  holdTimer: number;
}
export const captureNodesState = writable<NodeState[]>([]);
export const holdProgress      = writable(0);

// ── Upgrades ─────────────────────────────────────────────────
export const upgrades        = writable<string[]>([]);   // list of researched upgrade keys
export const researchingKeys = writable<string[]>([]);   // keys currently in a research queue

// ── Black market abilities ───────────────────────────────────
export const blackMarketCaptured  = writable(false);
export const blackMarketAbilities = writable<string[]>([]);

// ── Game stats (for end-screen graph) ────────────────────────
export interface StatSnap { t: number; kills: number; produced: number; credits: number }
export const statsHistory  = writable<StatSnap[]>([]);
export const gameTimeElapsed = writable(0);

// ── Survival mode ─────────────────────────────────────────────
export const survivalMode     = writable(false);
export const survivalTimeLeft = writable(0);    // seconds remaining
export const survivalTotal    = writable(900);  // duration in seconds
