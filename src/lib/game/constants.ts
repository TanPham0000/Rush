// ── CANVAS / MAP ─────────────────────────────────────────────
export const MAP_W   = 1800;
export const MAP_H   = 1200;
export const VIEW_W  = 900;
export const VIEW_H  = 600;
export const CANVAS_W = VIEW_W;
export const CANVAS_H = VIEW_H;
export const GRID    = 32;

// ── FOG OF WAR ───────────────────────────────────────────────
export const FOG_CELL  = 20;
export const FOG_COLS  = Math.ceil(MAP_W / FOG_CELL);  // 90
export const FOG_ROWS  = Math.ceil(MAP_H / FOG_CELL);  // 60

// ── PALETTE ──────────────────────────────────────────────────
export const C = {
  allyBase:   '#0D55EE', allyDark:   '#072288', allyAccent: '#44AAFF',
  allyLight:  '#AADDFF', allyGold:   '#FFD700', allyChr:    '#C8D8E8',
  enemyBase:  '#DD1111', enemyDark:  '#880808', enemyAccent:'#FF5522',
  enemyLight: '#FF9966', enemySteel: '#555560',
  tibGreen:   '#00FF66', tibMid:     '#00DD44', tibDark:    '#009933', tibGlow:'rgba(0,255,90,0.30)',
  ground:     '#2C3E20', groundAlt:  '#243418', road:       '#3E3620',
  forest:     '#1A2812', forestTree: '#243A1A', river:      '#104A80',
  riverShim:  '#2277CC', highGround: '#3C4A22', rocks:      '#38342E', bridge:'#4A4436',
  cityBlock:  '#2A2E2A', cityRoad:   '#1E201A', cityWall:   '#353830',
  hillsLow:   '#2A3A18', hillsHigh:  '#4A5C28', hillsMid:   '#384A20',
  beachSand:  '#C8B97A', beachShore: '#A89A58', beachWater: '#1A5A9A',
  beachFoam:  '#DDEEFF', seawall:    '#5A5040', sandbag:    '#8A7A50',
  captureNeutral: '#888888', capturePlayer: '#3399FF', captureEnemy: '#FF4422',
  blackMarket:    '#FFD700',
  uiBg:     '#07090A', uiPanel:  '#0D1210', uiBorder: '#1E3A1E',
  uiDim:    '#182818', uiAccent: '#00EE55', uiText:   '#88CC88',
  uiDimText:'#3A6A3A', credits:  '#FFD700', warn:     '#FFAA00',
  error:    '#FF3333', success:  '#33FF88',
} as const;

// ── BUILDING DEFINITIONS ─────────────────────────────────────
export type BType = keyof typeof BDEF;

export const BDEF = {
  //                                                                     buildRadius = grid anchor range (0 = must be near an anchor)
  //                                                                     buildTime   = seconds to construct
  'Construction Yard': { w: 80, h: 68, hp: 1200, power:  5, cost:   0, buildRadius: 320, buildTime:  0 },
  'Power Plant':       { w: 60, h: 52, hp:  500, power: 20, cost: 200, buildRadius: 360, buildTime: 22 },
  'Barracks':          { w: 64, h: 56, hp:  600, power: -5, cost: 300, buildRadius:   0, buildTime: 28 },
  'Refinery':          { w: 72, h: 62, hp:  700, power:-10, cost: 500, buildRadius:   0, buildTime: 32 },
  'Turret':            { w: 36, h: 36, hp:  400, power: -5, cost: 350, buildRadius:   0, buildTime: 16 },
  'War Factory':       { w: 88, h: 72, hp: 2200, power:  0, cost: 700, buildRadius:   0, buildTime: 40 },
  'Tech Lab':          { w: 72, h: 60, hp:  800, power: -8, cost: 600, buildRadius:   0, buildTime: 36 },
} as const;

// ── TRAINING TIMES (seconds) ─────────────────────────────────
export const TRAIN_TIME: Record<string, number> = {
  'Infantry':   8,
  'Grenadier': 11,
  'Tank':      20,
  'HeavyTank': 26,
  'Artillery': 28,
  'Scout':      5,
  'AntitankGun': 18,
  'Harvester': 13,
};

// ── UNIT COSTS ────────────────────────────────────────────────
export const UNIT_COST: Record<string, number> = {
  'Infantry':    100,
  'Grenadier':   100,
  'Tank':        400,
  'HeavyTank':   400,
  'Artillery':   550,
  'Scout':        80,
  'AntitankGun': 280,
  'Harvester':   300,
};

// ── UPGRADES (researched at Tech Lab) ────────────────────────
export interface UpgradeDef { label: string; desc: string; cost: number; key: string }
export const UPGRADES: UpgradeDef[] = [
  { key:'Grenadier',   label:'Grenadier',      desc:'Infantry → splash damage',    cost: 400 },
  { key:'HeavyTank',   label:'Heavy Tank',      desc:'Tanks → +60% HP, +30% dmg',  cost: 500 },
  { key:'AntitankGun', label:'Anti-Tank Gun',   desc:'New unit: armor-piercing gun', cost: 350 },
  { key:'ArtilleryUnit',label:'Artillery',      desc:'New unit: long-range cannon',  cost: 600 },
];

// ── WAVE CONFIGS ─────────────────────────────────────────────
export interface WaveConfig { at: number; infantry: number; tanks: number }

export const WAVES: WaveConfig[] = [
  { at:  30, infantry: 3, tanks: 0 },   // wave 1  — 3 inf, no armour
  { at:  70, infantry: 4, tanks: 0 },   // wave 2  — 4 inf, still no armour
  { at: 120, infantry: 5, tanks: 1 },   // wave 3  — first tank
  { at: 175, infantry: 5, tanks: 2 },   // wave 4
  { at: 235, infantry: 6, tanks: 2 },   // wave 5
  { at: 300, infantry: 7, tanks: 3 },   // wave 6
  { at: 370, infantry: 7, tanks: 4 },   // wave 7
];
export const ENDLESS_INTERVAL = 38;

// ── CAPTURE NODE HOLD TIME TO WIN ────────────────────────────
export const HOLD_WIN_TIME = 120;

// ── CAMPAIGN MAP DEFINITIONS ─────────────────────────────────
export type MapTheme = 0 | 1 | 2 | 3;   // 0=rivers, 1=hills, 2=city, 3=beach

export interface CaptureNodeDef {
  cx: number; cy: number; label: string; income: number;
  isCenter: boolean; isBlackMarket?: boolean;
  isRadar?: boolean; isBeachGun?: boolean;
}

export interface ImpassableZone { x: number; y: number; w: number; h: number }

export interface MapDef {
  id:               number;
  name:             string;
  subtitle:         string;
  description:      string;
  theme:            MapTheme;
  startCredits:     number;
  waveScale:        number;
  enemyHpScale:     number;
  playerBase:       { cx: number; cy: number };
  enemyBase:        { cx: number; cy: number };
  captureNodes:     CaptureNodeDef[];
  tibFields:        { cx: number; cy: number }[];
  // ── Survival / Beach Defence fields ─────────────────────
  mode?:            'standard' | 'survival'; // default 'standard'
  survivalDuration?:number;                  // seconds to survive
  preBuilt?:        boolean;                 // engine places opening base
  // ── Enemy eco AI ─────────────────────────────────────────
  enemyEco?:        boolean;                 // enemy builds own base & trains from it
  extraEnemyBuildings?: { type: BType; cx: number; cy: number }[]; // pre-placed enemy structures beyond CY
  // ── Terrain ──────────────────────────────────────────────
  impassableZones?: ImpassableZone[];        // hard terrain blocking unit movement
}

export const MAPS: MapDef[] = [
  // ── MAP 0: RIVER CROSSING ──────────────────────────────────
  {
    id: 0,
    name: 'RIVER CROSSING',
    subtitle: 'CHOKEPOINTS & BRIDGES',
    description: 'Control the bridges. The river splits the battlefield — whoever holds the crossings controls the war.',
    theme: 0,
    startCredits: 1000,
    waveScale:    1.0,
    enemyHpScale: 1.0,
    playerBase:  { cx: 260, cy: 600 },
    enemyBase:   { cx: 1676, cy: 590 },
    captureNodes: [
      { cx: 500,  cy: 190,  label: 'NORTH DEPOT',    income: 4, isCenter: false },
      { cx: 900,  cy: 600,  label: 'CONTROL CENTER', income: 6, isCenter: true  },
      { cx: 1340, cy: 990,  label: 'SOUTH DEPOT',    income: 4, isCenter: false },
      { cx: 660,  cy: 900,  label: 'BLACK MARKET',   income: 0, isCenter: false, isBlackMarket: true },
    ],
    tibFields: [
      [440,380],[430,820],[820,320],[830,900],
      [1150,400],[1230,840],[310,600],[1600,600],[560,200],
    ].map(([cx,cy]) => ({ cx, cy })),
  },

  // ── MAP 1: HIGHLAND ASSAULT ──────────────────────────────
  {
    id: 1,
    name: 'HIGHLAND ASSAULT',
    subtitle: 'HIGH GROUND IS EVERYTHING',
    description: 'Shattered ridges and dense forest. Secure the hilltops — they grant range bonuses that change every engagement.',
    theme: 1,
    startCredits: 800,
    waveScale:    1.15,
    enemyHpScale: 1.10,
    enemyEco:     true,
    playerBase:   { cx: 230, cy: 900 },
    enemyBase:    { cx: 1600, cy: 300 },
    captureNodes: [
      { cx: 450,  cy: 400,  label: 'WEST RIDGE',    income: 5, isCenter: false },
      { cx: 900,  cy: 580,  label: 'SUMMIT',         income: 6, isCenter: true  },
      { cx: 1380, cy: 820,  label: 'EAST RIDGE',    income: 5, isCenter: false },
      { cx: 1100, cy: 220,  label: 'BLACK MARKET',  income: 0, isCenter: false, isBlackMarket: true },
    ],
    tibFields: [
      [340,780],[380,300],[700,700],[880,200],
      [1050,900],[1300,560],[1550,700],[550,500],[1100,1050],
    ].map(([cx,cy]) => ({ cx, cy })),
  },

  // ── MAP 2: URBAN SIEGE ───────────────────────────────────
  {
    id: 2,
    name: 'URBAN SIEGE',
    subtitle: 'BLOCK BY BLOCK',
    description: 'A ruined city. Every street corner is a killzone. Infantry use buildings for cover; tanks are exposed in the open.',
    theme: 2,
    startCredits: 600,
    waveScale:    1.30,
    enemyHpScale: 1.20,
    enemyEco:     true,
    playerBase:   { cx: 200, cy: 600 },
    enemyBase:    { cx: 1650, cy: 600 },
    captureNodes: [
      { cx: 550,  cy: 300,  label: 'NORTH PLAZA',   income: 5, isCenter: false },
      { cx: 900,  cy: 600,  label: 'CITY CENTER',   income: 7, isCenter: true  },
      { cx: 1300, cy: 900,  label: 'SOUTH PLAZA',   income: 5, isCenter: false },
      { cx: 900,  cy: 300,  label: 'BLACK MARKET',  income: 0, isCenter: false, isBlackMarket: true },
    ],
    tibFields: [
      [300,200],[350,1000],[700,450],[700,750],
      [1100,300],[1100,900],[1400,500],[1500,800],[900,1050],
    ].map(([cx,cy]) => ({ cx, cy })),
  },

  // ── MAP 3: BEACH DEFENCE ─────────────────────────────────
  {
    id: 3,
    name: 'BEACH DEFENCE',
    subtitle: 'HOLD THE LINE',
    description: 'Amphibious assault from the ocean. Endless waves break against your seawall. Dig in and survive 15 minutes.',
    theme: 3,
    startCredits: 2500,
    waveScale:    1.0,
    enemyHpScale: 1.0,
    playerBase:   { cx: 200, cy: 600 },
    enemyBase:    { cx: 1760, cy: 600 },
    captureNodes: [
      { cx: 720,  cy: 220, label: 'RADAR TOWER', income: 0, isCenter: false, isRadar:    true },
      { cx: 1260, cy: 960, label: 'BEACH GUN',   income: 0, isCenter: false, isBeachGun: true },
    ],
    tibFields: [
      [300, 280], [300, 920], [560, 200], [560, 1000], [820, 420], [820, 780],
    ].map(([cx,cy]) => ({ cx, cy })),
    mode:             'survival',
    survivalDuration: 900,
    preBuilt:         true,
  },

  // ── MAP 4: DEAD MAN'S PASS ───────────────────────────────
  // Diagonal layout — player bottom-left, enemy top-right.
  // Impassable cliff walls funnel both armies through a narrow central valley.
  {
    id: 4,
    name: "DEAD MAN'S PASS",
    subtitle: 'HOLD THE VALLEY',
    description: "Two forces converge on a mountain pass. Sheer cliff walls on each flank leave only one route through. The first to hold The Pass controls the war.",
    theme: 1,
    startCredits: 750,
    waveScale:    1.35,
    enemyHpScale: 1.22,
    enemyEco:     true,
    playerBase:   { cx: 230, cy: 980 },
    enemyBase:    { cx: 1570, cy: 220 },
    captureNodes: [
      { cx:  500, cy: 760, label: 'SOUTH RIDGE',  income: 5, isCenter: false },
      { cx:  900, cy: 600, label: 'THE PASS',      income: 8, isCenter: true  },
      { cx: 1300, cy: 430, label: 'NORTH RIDGE',   income: 5, isCenter: false },
      { cx:  680, cy: 290, label: 'BLACK MARKET',  income: 0, isCenter: false, isBlackMarket: true },
    ],
    tibFields: [
      [350, 840], [430, 620], [660, 480], [900, 590],
      [1060, 700], [1180, 440], [1440, 560], [1480, 330], [760, 215],
    ].map(([cx, cy]) => ({ cx, cy })),
    // ── Impassable cliff walls: funnel units into diagonal valley ──
    impassableZones: [
      // Northwest cliff mass — blocks upper-left corner
      { x: 0,    y: 0,    w: 550, h: 320 },
      { x: 0,    y: 300,  w: 280, h: 380 },
      // North cliff wall — caps top of map (leaves enemy base clear top-right)
      { x: 580,  y: 0,    w: 660, h: 180 },
      // Central left cliff — squeezes valley near south approach
      { x: 100,  y: 440,  w: 290, h: 200 },
      // Southeast cliff mass — blocks lower-right corner
      { x: 1260, y: 860,  w: 540, h: 340 },
      { x: 1520, y: 560,  w: 280, h: 320 },
      // South cliff wall
      { x: 380,  y: 1020, w: 820, h: 180 },
      // Central right cliff — squeezes valley near north approach
      { x: 1410, y: 580,  w: 290, h: 200 },
    ],
  },

  // ── MAP 5: OPERATION SIEGE ───────────────────────────────
  // Enemy is deeply fortified in a city center with a ring of turrets
  // and pre-built infrastructure. Player must crack the defensive line
  // before the enemy economy overwhelms them.
  {
    id: 5,
    name: 'OPERATION SIEGE',
    subtitle: 'BREAK THE FORTRESS',
    description: "Enemy forces have fortified the city center with turrets and walls. Crack their defensive line before their economy overwhelms you. Hardest map in the campaign.",
    theme: 2,
    startCredits: 1200,
    waveScale:    1.0,
    enemyHpScale: 1.30,
    enemyEco:     true,
    playerBase:   { cx: 200, cy: 600 },
    enemyBase:    { cx: 1480, cy: 600 },
    captureNodes: [
      { cx:  580, cy: 280,  label: 'NORTH DEPOT',  income: 5, isCenter: false },
      { cx:  900, cy: 600,  label: 'CITY HALL',     income: 8, isCenter: true  },
      { cx:  580, cy: 920,  label: 'SOUTH DEPOT',   income: 5, isCenter: false },
      { cx: 1160, cy: 300,  label: 'BLACK MARKET',  income: 0, isCenter: false, isBlackMarket: true },
    ],
    tibFields: [
      [360, 240], [360, 960], [600, 480], [600, 720],
      [900, 240], [900, 960], [1100, 460], [1100, 740],
      [1360, 340], [1360, 860],
    ].map(([cx, cy]) => ({ cx, cy })),
    // ── Pre-built enemy fortification ring ────────────────────────
    extraEnemyBuildings: [
      // Power supply
      { type: 'Power Plant', cx: 1650, cy: 450 },
      { type: 'Power Plant', cx: 1650, cy: 750 },
      // Outer turret ring — arc facing the player
      { type: 'Turret', cx: 1280, cy: 390 },
      { type: 'Turret', cx: 1360, cy: 320 },
      { type: 'Turret', cx: 1460, cy: 300 },
      { type: 'Turret', cx: 1560, cy: 330 },
      { type: 'Turret', cx: 1630, cy: 420 },
      // Right-flank turrets
      { type: 'Turret', cx: 1680, cy: 600 },
      // Lower arc
      { type: 'Turret', cx: 1630, cy: 780 },
      { type: 'Turret', cx: 1560, cy: 870 },
      { type: 'Turret', cx: 1460, cy: 900 },
      { type: 'Turret', cx: 1360, cy: 880 },
      { type: 'Turret', cx: 1280, cy: 810 },
      // Close guard — immediately around CY
      { type: 'Turret', cx: 1350, cy: 520 },
      { type: 'Turret', cx: 1350, cy: 680 },
    ],
  },
];
