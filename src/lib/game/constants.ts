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
  'Turret':            { w: 36, h: 36, hp:  400, power: -5, cost: 350, buildRadius:   0, buildTime:  7 },
  'War Factory':       { w: 88, h: 72, hp: 2200, power:  0, cost: 700, buildRadius:   0, buildTime: 40 },
  'Tech Lab':          { w: 72, h: 60, hp:  800, power: -8, cost: 600, buildRadius:   0, buildTime: 36 },
  'Armoury':           { w: 68, h: 58, hp:  650, power: -6, cost: 450, buildRadius:   0, buildTime: 30 },
} as const;

// ── TRAINING TIMES (seconds) ─────────────────────────────────
export const TRAIN_TIME: Record<string, number> = {
  'Infantry':    8,
  'Grenadier':  11,
  'Marksman':   14,
  'Tank':       20,
  'HeavyTank':  26,
  'Artillery':  28,
  'Scout':       5,
  'AntitankGun':18,
  'Harvester':  13,
};

// ── UNIT COSTS ────────────────────────────────────────────────
export const UNIT_COST: Record<string, number> = {
  'Infantry':    100,
  'Grenadier':   100,
  'Marksman':    175,
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

// ── ARMOURY UPGRADES (researched at Armoury) ─────────────────
export const ARMOURY_UPGRADES: UpgradeDef[] = [
  { key:'ArmUnitHp',  label:'Reinforced Armour', desc:'+20% HP to all infantry',              cost: 350 },
  { key:'ArmUnitDmg', label:'Incendiary Rounds',  desc:'+20% damage to all infantry',          cost: 350 },
  { key:'ArmUnitSpd', label:'Quick March',         desc:'+15% speed to all infantry',           cost: 280 },
  { key:'ArmTrench',  label:'Entrench',            desc:'Infantry dig trenches after 8s idle (+40% armour)', cost: 400 },
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
export type MapTheme = 0 | 1 | 2 | 3 | 4;   // 0=rivers, 1=hills, 2=city, 3=beach, 4=desert

export interface CaptureNodeDef {
  cx: number; cy: number; label: string; income: number;
  isCenter: boolean; isBlackMarket?: boolean;
  isRadar?: boolean; isBeachGun?: boolean;
  isPark?: boolean; isEngineer?: boolean;
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
  // ── Mission briefing ─────────────────────────────────────
  objectives?:      string[];                // shown in mission briefing overlay
}

export const MAPS: MapDef[] = [
  // ── MAP 0: RIVER CROSSING ──────────────────────────────────
  {
    id: 0,
    name: 'RIVER CROSSING',
    subtitle: 'CHOKEPOINTS & BRIDGES',
    description: 'Control the bridges. The river splits the battlefield — whoever holds the crossings controls the war. Hold the Control Center long enough and the enemy collapses.',
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
    objectives: [
      'PRIMARY — Hold CONTROL CENTER for 120 seconds',
      'SECONDARY — Destroy the enemy War Factory',
      'Protect your Construction Yard',
    ],
  },

  // ── MAP 1: HIGHLAND ASSAULT ──────────────────────────────
  {
    id: 1,
    name: 'HIGHLAND ASSAULT',
    subtitle: 'HIGH GROUND IS EVERYTHING',
    description: 'Shattered ridges and dense forest. The enemy digs in on the high ground — destroy their base from below or push long-range weapons to overlook their compound. Marksmen and Artillery excel here.',
    theme: 1,
    startCredits: 800,
    waveScale:    1.15,
    enemyHpScale: 1.10,
    enemyEco:     true,
    playerBase:   { cx: 150, cy: 1050 },
    enemyBase:    { cx: 1680, cy: 150 },
    captureNodes: [
      { cx: 380,  cy: 300,  label: 'WEST RIDGE',    income: 5, isCenter: false },
      // Summit moved deep into enemy territory — within their turret coverage
      { cx: 1480, cy: 300,  label: 'SUMMIT',         income: 6, isCenter: true  },
      { cx: 1460, cy: 860,  label: 'EAST RIDGE',    income: 5, isCenter: false },
      { cx: 1150, cy: 200,  label: 'BLACK MARKET',  income: 0, isCenter: false, isBlackMarket: true },
    ],
    tibFields: [
      [240,900],[320,280],[600,780],[900,200],
      [1080,980],[1380,540],[1620,780],[520,480],[1100,1080],
      [700,300],[1260,400],[400,600],
    ].map(([cx,cy]) => ({ cx, cy })),
    objectives: [
      'PRIMARY — Destroy the enemy Construction Yard',
      'SECONDARY — Capture SUMMIT (deep in enemy lines)',
      'Use Artillery & Marksmen to suppress from high ground',
    ],
  },

  // ── MAP 2: URBAN SIEGE ───────────────────────────────────
  {
    id: 2,
    name: 'URBAN SIEGE',
    subtitle: 'BLOCK BY BLOCK',
    description: 'A ruined city. Every street corner is a killzone. Infantry use buildings for cover; tanks are exposed in the open. An Engineer Depot near your base lets you call in rapid repairs.',
    theme: 2,
    startCredits: 600,
    waveScale:    1.30,
    enemyHpScale: 1.20,
    enemyEco:     true,
    playerBase:   { cx: 160, cy: 600 },
    enemyBase:    { cx: 1700, cy: 600 },
    captureNodes: [
      { cx: 500,  cy: 250,  label: 'NORTH PLAZA',    income: 5, isCenter: false },
      { cx: 900,  cy: 600,  label: 'CITY CENTER',    income: 7, isCenter: true  },
      { cx: 1350, cy: 950,  label: 'SOUTH PLAZA',    income: 5, isCenter: false },
      { cx: 920,  cy: 280,  label: 'BLACK MARKET',   income: 0, isCenter: false, isBlackMarket: true },
      // Engineer Depot — near player base, passive income
      { cx: 320,  cy: 900,  label: 'ENGINEER DEPOT', income: 4, isCenter: false, isEngineer: true },
    ],
    tibFields: [
      [260,180],[300,1020],[680,420],[700,800],
      [1120,280],[1140,920],[1450,480],[1560,820],[900,1060],
      [400,500],[1300,350],[1600,400],
    ].map(([cx,cy]) => ({ cx, cy })),
    objectives: [
      'PRIMARY — Destroy the enemy Construction Yard',
      'OR hold City Center for 120 seconds',
      'Capture ENGINEER DEPOT near your base for bonus income',
    ],
  },

  // ── MAP 3: OPERATION WHALE ───────────────────────────────
  {
    id: 3,
    name: 'OPERATION WHALE',
    subtitle: 'HOLD THE SHORELINE',
    description: 'Amphibious assault from the deep blue. Wave after wave crashes against your beachhead. Capture income nodes to fund your defence and hold the shoreline for 15 minutes — or be swept into the sea.',
    theme: 3,
    startCredits: 2500,
    waveScale:    1.0,
    enemyHpScale: 1.0,
    playerBase:   { cx: 200, cy: 600 },
    enemyBase:    { cx: 1760, cy: 600 },
    captureNodes: [
      // Radar + beach gun (existing)
      { cx: 720,  cy: 220,  label: 'RADAR TOWER',    income: 0, isCenter: false, isRadar:    true },
      { cx: 1260, cy: 960,  label: 'BEACH GUN',      income: 0, isCenter: false, isBeachGun: true },
      // Passive income nodes — forward positions to fund defence
      { cx: 560,  cy: 120,  label: 'NORTH SUPPLY',   income: 5, isCenter: false },
      { cx: 680,  cy: 600,  label: 'COMMAND POST',   income: 6, isCenter: false },
      { cx: 560,  cy: 1080, label: 'SOUTH SUPPLY',   income: 5, isCenter: false },
      // Engineer depot near player base
      { cx: 300,  cy: 350,  label: 'ENGINEER DEPOT', income: 3, isCenter: false, isEngineer: true },
    ],
    tibFields: [
      // Original six
      [300, 280], [300, 920], [560, 200], [560, 1000], [820, 420], [820, 780],
      // Extra eco fields — forward of the beach
      [680, 340], [680, 860], [440, 540], [440, 680],
      // Rear area income
      [160, 200], [160, 400], [160, 800], [160, 1000],
    ].map(([cx,cy]) => ({ cx, cy })),
    mode:             'survival',
    survivalDuration: 900,
    preBuilt:         true,
    objectives: [
      'Survive 15 minutes of amphibious assault',
      'Capture income nodes to fund your defence',
      'Defend your Construction Yard at all costs',
    ],
  },

  // ── MAP 4: DEAD MAN'S PASS ───────────────────────────────
  // Desert canyon. Player south, enemy north. A single 120px-wide canyon
  // corridor is the ONLY path between bases. 2 radar stations guard the
  // pass entrances. Control The Pass to win.
  {
    id: 4,
    name: "DEAD MAN'S PASS",
    subtitle: 'HOLD THE CANYON',
    description: "A desert canyon splits the battlefield north to south. The only route through is a passage barely four soldiers wide. Capture both radar stations to blind the enemy — then hold The Pass.",
    theme: 4,
    startCredits: 900,
    waveScale:    1.35,
    enemyHpScale: 1.22,
    enemyEco:     true,
    playerBase:   { cx: 900, cy: 1020 },
    enemyBase:    { cx: 900, cy: 180  },
    captureNodes: [
      { cx: 900, cy: 420,  label: 'NORTH RADAR',  income: 0, isCenter: false, isRadar: true },
      { cx: 900, cy: 600,  label: 'THE PASS',      income: 8, isCenter: true               },
      { cx: 900, cy: 780,  label: 'SOUTH RADAR',  income: 0, isCenter: false, isRadar: true },
      { cx: 700, cy: 1060, label: 'BLACK MARKET', income: 0, isCenter: false, isBlackMarket: true },
    ],
    tibFields: [
      // South (player) base zone — x:500–1300, y:840–1200
      [720, 960], [1080, 960], [900, 1120],
      // North (enemy) base zone — x:500–1300, y:0–360
      [720, 240], [1080, 240], [900, 80],
      // Contested pass resources (inside corridor x:840–960)
      [900, 480], [900, 720],
    ].map(([cx, cy]) => ({ cx, cy })),
    // ── Canyon walls: everything outside the corridor and base zones ──
    impassableZones: [
      // Corridor left wall (y:360 to y:840)
      { x: 0,    y: 360, w: 840, h: 480 },
      // Corridor right wall
      { x: 960,  y: 360, w: 840, h: 480 },
      // NW corner (outside north base zone x:500–1300)
      { x: 0,    y: 0,   w: 500, h: 360 },
      // NE corner
      { x: 1300, y: 0,   w: 500, h: 360 },
      // SW corner (outside south base zone)
      { x: 0,    y: 840, w: 500, h: 360 },
      // SE corner
      { x: 1300, y: 840, w: 500, h: 360 },
    ],
    objectives: [
      'Capture NORTH RADAR to blind enemy scouts',
      'Hold THE PASS for 120 seconds',
      'OR destroy the enemy Construction Yard',
    ],
  },

  // ── MAP 5: OPERATION SIEGE ───────────────────────────────
  // Final push into the heart of the city. Enemy is dug in at top-right.
  // Only win condition: destroy enemy Construction Yard.
  // City Park (isPark) to the north — green cover + income.
  // Observation Post at bottom-right corner — radar.
  // 10 hardened turrets guard the enemy HQ. Enemy eco active.
  {
    id: 5,
    name: 'OPERATION SIEGE',
    subtitle: 'HEART OF THE CITY',
    description: "Final push. The enemy commands from the northeast district behind 10 reinforced turrets. Storm their compound and destroy their Construction Yard — there is no other way out. Capture City Park for cover and the Observation Post for full radar.",
    theme: 2,
    startCredits: 2000,
    waveScale:    1.0,
    enemyHpScale: 1.50,
    enemyEco:     true,
    playerBase:   { cx: 120, cy: 1080 },
    enemyBase:    { cx: 1700, cy: 120 },
    captureNodes: [
      // City Park — north, income + green cover
      { cx:  480, cy: 200, label: 'CITY PARK',        income: 6, isCenter: false, isPark: true },
      // Town Hall — income only (NOT isCenter — no hold-to-win)
      { cx:  900, cy: 600, label: 'TOWN HALL',         income: 5, isCenter: false },
      // Observation Post — complete bottom-right, radar/intel
      { cx: 1700, cy: 1050, label: 'OBSERVATION POST', income: 0, isCenter: false, isRadar: true },
      // Black Market — mid-south
      { cx:  640, cy: 900, label: 'BLACK MARKET',     income: 0, isCenter: false, isBlackMarket: true },
    ],
    tibFields: [
      // Near player (bottom-left)
      [200, 920], [380, 1060], [260, 1160],
      // Mid-south approach
      [560, 820], [700, 650],
      // Center
      [860, 720], [940, 480],
      // Mid-north push
      [1080, 380], [1300, 520],
      // Near enemy (top-right)
      [1480, 240], [1640, 380], [1560, 100],
      // Park area
      [350, 320], [620, 180],
      // East flank
      [1420, 800], [1600, 900],
    ].map(([cx, cy]) => ({ cx, cy })),
    // ── Enemy fortress: 10 hardened turrets + barracks + WF ──
    extraEnemyBuildings: [
      // Military core (active from turn 1)
      { type: 'Barracks',    cx: 1760, cy: 280 },
      { type: 'War Factory', cx: 1580, cy: 260 },
      // Turret perimeter — tighter ring of 10
      // West-facing arc (toward city, primary threat axis):
      { type: 'Turret', cx: 1380, cy: 200 },
      { type: 'Turret', cx: 1420, cy: 320 },
      { type: 'Turret', cx: 1480, cy: 420 },
      { type: 'Turret', cx: 1560, cy: 480 },
      { type: 'Turret', cx: 1650, cy: 460 },
      // Northern arc (rear guard):
      { type: 'Turret', cx: 1780, cy: 180 },
      { type: 'Turret', cx: 1760, cy:  60 },
      { type: 'Turret', cx: 1640, cy:  50 },
      { type: 'Turret', cx: 1520, cy:  80 },
      { type: 'Turret', cx: 1430, cy: 100 },
    ],
    objectives: [
      'DESTROY the enemy Construction Yard — only way to win',
      'Capture CITY PARK for cover and income',
      'Capture OBSERVATION POST for full radar coverage',
    ],
  },
];
