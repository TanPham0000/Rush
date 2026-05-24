// ── CANVAS ───────────────────────────────────────────────────
export const CANVAS_W = 900;
export const CANVAS_H = 600;
export const GRID     = 32;

// ── RA3-INSPIRED PALETTE ─────────────────────────────────────
export const C = {
  // ── Allied / Player (bright RA3 blue + chrome gold) ──────
  allyBase:   '#0D55EE',   // vivid electric blue
  allyDark:   '#072288',   // deep navy
  allyAccent: '#44AAFF',   // sky blue accent
  allyLight:  '#AADDFF',   // pale sky highlight
  allyGold:   '#FFD700',   // chrome gold detail
  allyChr:    '#C8D8E8',   // chrome silver

  // ── Soviet / Enemy (saturated RA3 red + orange) ──────────
  enemyBase:   '#DD1111',  // vivid crimson
  enemyDark:   '#880808',  // deep red
  enemyAccent: '#FF5522',  // orange-red accent
  enemyLight:  '#FF9966',  // warm highlight
  enemySteel:  '#555560',  // dark steel plate

  // ── Tiberium (neon green) ─────────────────────────────────
  tibGreen:  '#00FF66',
  tibMid:    '#00DD44',
  tibDark:   '#009933',
  tibGlow:   'rgba(0,255,90,0.30)',

  // ── Terrain ───────────────────────────────────────────────
  ground:     '#2C3E20',   // rich dark olive-green
  groundAlt:  '#243418',   // darker variation
  road:       '#3E3620',   // warm tan road
  forest:     '#1A2812',   // deep forest shadow
  forestTree: '#243A1A',   // tree canopy
  river:      '#104A80',   // vivid deep blue
  riverShim:  '#2277CC',   // bright shimmer
  highGround: '#3C4A22',   // elevated ridge
  rocks:      '#38342E',   // grey-brown rock
  bridge:     '#4A4436',   // weathered wood

  // ── UI ───────────────────────────────────────────────────
  uiBg:     '#07090A',
  uiPanel:  '#0D1210',
  uiBorder: '#1E3A1E',
  uiDim:    '#182818',
  uiAccent: '#00EE55',
  uiText:   '#88CC88',
  uiDimText:'#3A6A3A',
  credits:  '#FFD700',
  warn:     '#FFAA00',
  error:    '#FF3333',
  success:  '#33FF88',
} as const;

// ── BUILDING DEFINITIONS ─────────────────────────────────────
export type BType = keyof typeof BDEF;

export const BDEF = {
  'Construction Yard': { w: 80, h: 68, hp: 1200, power:  5, cost:   0 },
  'Barracks':          { w: 64, h: 56, hp:  600, power: -5, cost: 300 },
  'Refinery':          { w: 72, h: 62, hp:  700, power:-10, cost: 500 },
  'Power Plant':       { w: 60, h: 52, hp:  500, power: 20, cost: 200 },
  'Turret':            { w: 36, h: 36, hp:  400, power: -5, cost: 350 },
  'War Factory':       { w: 88, h: 72, hp: 1800, power:  0, cost:   0 },
} as const;

// ── WAVE CONFIGS ─────────────────────────────────────────────
export interface WaveConfig {
  at: number; // seconds from game start
  infantry: number;
  tanks: number;
}

export const WAVES: WaveConfig[] = [
  { at:  15, infantry: 3, tanks: 0 },
  { at:  40, infantry: 4, tanks: 1 },
  { at:  70, infantry: 5, tanks: 2 },
  { at: 105, infantry: 5, tanks: 3 },
  { at: 145, infantry: 6, tanks: 4 },
  { at: 190, infantry: 7, tanks: 5 },
  { at: 240, infantry: 8, tanks: 6 },
];
// After last scripted wave, spawn one group every N seconds
export const ENDLESS_INTERVAL = 35;
