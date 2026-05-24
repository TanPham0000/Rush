import { CANVAS_W, CANVAS_H, BDEF, WAVES, ENDLESS_INTERVAL, C } from './constants';
import type { BType, WaveConfig } from './constants';
import { rnd, rndi, hypot, clamp, resetIds, nextId } from './utils';
import { TerrainMap } from './terrain';
import {
  Building, Turret, TiberiumField, Projectile,
  Unit, Tank, Harvester, EnemyUnit,
  type GameRef, type Entity,
} from './entities';
import {
  credits, powerGen, powerUsed, incomeRate,
  wave, nextWaveIn, waveIncoming, totalWaves,
  gameState, selected, buildMode,
  statusMsg, selHasBarracks, selHasRefinery, selHasUnits,
  hasBarracks, hasRefinery,
  warFactoryHp, warFactoryMaxHp,
  enemiesKilled, unitsLost,
} from '$lib/stores/gameStore';
import { get } from 'svelte/store';

// ═══════════════════════════════════════════════════════════════
// PARTICLE
// ═══════════════════════════════════════════════════════════════
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; r: number;
}

interface FlashMsg {
  text: string; x: number; y: number;
  t: number; maxT: number; color: string;
}

// ═══════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════
export class Engine {
  canvas:   HTMLCanvasElement;
  ctx:      CanvasRenderingContext2D;
  terrain:  TerrainMap;

  // Entity lists
  buildings:   Building[]     = [];
  pUnits:      Unit[]         = [];
  eUnits:      Unit[]         = [];
  tibFields:   TiberiumField[] = [];
  projectiles: Projectile[]   = [];
  _selected:   Entity[]       = [];

  // State
  _credits:  number = 1000;
  _totalIncome: number = 0;
  _powerGen: number = 5;
  _powerUsed: number = 0;
  _powerOk:  boolean = true;
  _buildMode: BType | null = null;

  // Wave system
  _gameTime:    number = 0;
  _waveIndex:   number = 0;        // index into WAVES array
  _wavesPassed: number = 0;
  _spawnTimer:  number = WAVES[0].at;  // seconds until first wave
  _wavePending: boolean = false;
  _waveLabel:   number = 0;

  // FX
  _particles:  Particle[]  = [];
  _flashMsgs:  FlashMsg[]  = [];
  _moveInd:    { x: number; y: number; t: number } | null = null;
  _commandMode: 'attack-move' | null = null;

  // Stats
  _enemiesKilled: number = 0;
  _unitsLost:     number = 0;

  private _raf:      number = 0;
  private _lastTime: number = 0;
  private _stTimer:  ReturnType<typeof setTimeout> | null = null;

  // GameRef passed into entities
  private _ref: GameRef;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d')!;
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;
    this.terrain  = new TerrainMap();
    this._ref = {
      terrain:    this.terrain,
      addCredits: (n) => this._addCredits(n),
      buildings:  this.buildings,
      tibFields:  this.tibFields,
      pUnits:     this.pUnits,
    };
    this._init();
  }

  // ── INIT ─────────────────────────────────────────────────
  _init() {
    resetIds();
    this._credits = 1000; this._totalIncome = 0;
    this.buildings = []; this.pUnits = []; this.eUnits = [];
    this.tibFields = []; this.projectiles = []; this._selected = [];
    this._particles = []; this._flashMsgs = []; this._moveInd = null;
    this._buildMode = null; this._commandMode = null;
    this._enemiesKilled = 0; this._unitsLost = 0;
    this._gameTime = 0; this._waveIndex = 0; this._wavesPassed = 0;
    this._spawnTimer = WAVES[0].at; this._wavePending = false;
    this._ref.buildings = this.buildings;
    this._ref.tibFields = this.tibFields;
    this._ref.pUnits    = this.pUnits;

    // Player base
    this.buildings.push(new Building(130, 300, 'Construction Yard', 'player'));
    this.buildings.push(new Building(200, 385, 'Power Plant',       'player'));
    this.buildings.push(new Building(200, 215, 'Refinery',          'player'));

    // Enemy base — War Factory + flanking turrets
    this.buildings.push(new Building(838, 295, 'War Factory', 'enemy'));
    const et1 = new Turret(790, 230, 'enemy'); et1.disabled = false;
    const et2 = new Turret(790, 360, 'enemy'); et2.disabled = false;
    this.buildings.push(et1, et2);

    // Tiberium fields — balanced on both sides of river
    const fieldPos: [number, number][] = [
      [220, 190], [215, 410],        // player safe side
      [410, 160], [415, 450],        // near bridges (contested)
      [575, 200], [615, 420],        // enemy side
    ];
    for (const [cx, cy] of fieldPos) {
      this.tibFields.push(new TiberiumField(cx, cy));
    }

    // Starting harvester — gets the economy rolling immediately
    const startHarv = new Harvester(240, 300, this._ref);
    this.pUnits.push(startHarv);
    this._ref.pUnits = this.pUnits;

    this._recalcPower();
    this._syncStores();
  }

  // ── POWER ─────────────────────────────────────────────────
  _recalcPower() {
    let gen = 0, used = 0;
    for (const b of this.buildings) {
      if (b.team !== 'player') continue;
      const p = BDEF[b.type].power;
      if (p > 0) gen += p; else used += Math.abs(p);
    }
    this._powerGen = gen; this._powerUsed = used;
    this._powerOk  = gen >= used;
    // Apply to turrets and harvesters
    for (const b of this.buildings) {
      if (b instanceof Turret && b.team === 'player') b.disabled = !this._powerOk;
    }
    for (const u of this.pUnits) {
      if (u instanceof Harvester) u._speedMult = this._powerOk ? 1.0 : 0.6;
    }
  }

  // ── CREDITS ───────────────────────────────────────────────
  _addCredits(amt: number) {
    this._credits += amt;
    this._totalIncome += amt;
    const ref = this.buildings.find(b => b.type === 'Refinery' && b.team === 'player');
    if (ref) {
      this._flashMsgs.push({
        text: `+${Math.floor(amt)}`, x: ref.cx + rnd(-14, 14), y: ref.y - 8,
        t: 1.1, maxT: 1.1, color: C.tibGreen,
      });
    }
  }

  // ── BUILD ─────────────────────────────────────────────────
  enterBuild(type: BType) {
    const cost = BDEF[type].cost;
    if (this._credits < cost) return this.setStatus('Not enough credits!', 'error');
    if (!this.buildings.some(b => b.team === 'player' && b.type === 'Construction Yard'))
      return this.setStatus('Construction Yard required!', 'error');
    this._buildMode = type;
    this._deselect();
    this.setStatus(`Click to place ${type}  ·  ESC = cancel`, 'warn');
    this._syncStores();
  }

  cancelBuild() {
    this._buildMode = null;
    this._commandMode = null;
    this.setStatus('Cancelled');
    this._syncStores();
  }

  placeBuild(cx: number, cy: number) {
    if (!this._buildMode) return;
    const type = this._buildMode;
    const cost = BDEF[type].cost;
    if (this._credits < cost) { this.cancelBuild(); return this.setStatus('Not enough credits!', 'error'); }
    this._credits -= cost;
    const b = type === 'Turret'
      ? new Turret(cx, cy, 'player')
      : new Building(cx, cy, type, 'player');
    this.buildings.push(b);
    this._buildMode = null;
    this._recalcPower();
    this.setStatus(`${type} placed!`, 'success');
    this._syncStores();
  }

  // ── TRAIN (convenience) ───────────────────────────────────
  trainInfantry()  { this.trainFrom('Barracks', (x,y) => new Unit(x,y,'player'),          100, 'Infantry');  }
  trainTank()      { this.trainFrom('Barracks', (x,y) => new Tank(x,y,'player'),           400, 'Tank');      }
  trainHarvester() { this.trainFrom('Refinery', (x,y) => new Harvester(x,y,this._ref),    300, 'Harvester'); }

  // ── TRAIN (generic) ───────────────────────────────────────
  trainFrom(bType: BType, unitFactory: (x: number, y: number) => Unit, cost: number, label: string) {
    if (this._credits < cost) return this.setStatus('Not enough credits!', 'error');
    const brk = this._selected.find(e => e instanceof Building && e.type === bType && e.team === 'player') as Building | undefined;
    if (!brk) return this.setStatus(`Select a ${bType} first!`, 'warn');
    this._credits -= cost;
    const ang = Math.random() * Math.PI * 2, r = rnd(44, 64);
    const u = unitFactory(brk.cx + Math.cos(ang) * r, brk.cy + Math.sin(ang) * r);
    u._game = this._ref;
    this.pUnits.push(u);
    if (u instanceof Harvester) u._speedMult = this._powerOk ? 1.0 : 0.6;
    this.setStatus(`${label} deployed!`, 'success');
    this._syncStores();
  }

  // ── SELECTION ─────────────────────────────────────────────
  _deselect() {
    for (const e of this._selected) e.selected = false;
    this._selected = [];
  }

  onLeftClick(pos: { x: number; y: number }) {
    if (this._buildMode) { this.placeBuild(pos.x, pos.y); return; }
    this._deselect();
    for (const u of [...this.pUnits, ...this.eUnits] as Entity[]) {
      if (u.contains(pos.x, pos.y)) { u.selected = true; this._selected = [u]; this._syncStores(); return; }
    }
    for (const b of this.buildings) {
      if (b.contains(pos.x, pos.y)) { b.selected = true; this._selected = [b]; this._syncStores(); return; }
    }
    this._syncStores();
  }

  onDragSelect(start: { x: number; y: number }, end: { x: number; y: number }) {
    if (this._buildMode) return;
    this._deselect();
    const rx = Math.min(start.x, end.x), ry = Math.min(start.y, end.y);
    const rw = Math.abs(end.x - start.x), rh = Math.abs(end.y - start.y);
    for (const u of this.pUnits) {
      if (u.overlapsRect(rx, ry, rw, rh)) { u.selected = true; this._selected.push(u); }
    }
    if (!this._selected.length) {
      for (const b of this.buildings.filter(b => b.team === 'player')) {
        if (b.overlapsRect(rx, ry, rw, rh)) { b.selected = true; this._selected.push(b); }
      }
    }
    this._syncStores();
  }

  onRightClick(pos: { x: number; y: number }) {
    if (this._buildMode) { this.cancelBuild(); return; }
    if (this._commandMode === 'attack-move') { this.commandAttackMove(pos); return; }
    const movers = this._selected.filter(e => e instanceof Unit && e.team === 'player') as Unit[];
    if (!movers.length) return;

    // Check for enemy target
    let target: Entity | null = null;
    for (const e of [...this.eUnits, this.buildings.filter(b => b.team === 'enemy')].flat()) {
      if ((e as Entity).contains(pos.x, pos.y)) { target = e as Entity; break; }
    }

    if (target) {
      movers.forEach(u => u.attack(target!));
      this.setStatus('Attack order!', 'warn');
    } else {
      const cols = Math.ceil(Math.sqrt(movers.length)), spacing = 22;
      movers.forEach((u, i) => {
        const col = (i % cols) - Math.floor(cols / 2), row = Math.floor(i / cols);
        u.moveTo(pos.x + col * spacing, pos.y + row * spacing);
      });
      this._moveInd = { x: pos.x, y: pos.y, t: 0.7 };
    }
  }

  // ── COMMANDS ──────────────────────────────────────────────
  commandStop() {
    const units = this._selected.filter(e => e instanceof Unit && e.team === 'player') as Unit[];
    units.forEach(u => u.stop());
    if (units.length) this.setStatus('Stop!');
  }

  commandGuard() {
    const units = this._selected.filter(e => e instanceof Unit && e.team === 'player') as Unit[];
    units.forEach(u => u.guard());
    if (units.length) this.setStatus('Guard position set');
  }

  /** Enter attack-move mode — next right-click sends units to position attacking on the way */
  enterAttackMove() {
    const units = this._selected.filter(e => e instanceof Unit && e.team === 'player');
    if (!units.length) return;
    this._commandMode = 'attack-move';
    this.setStatus('ATTACK MOVE — right-click destination', 'warn');
    this._syncStores();
  }

  commandAttackMove(pos: { x: number; y: number }) {
    const movers = this._selected.filter(e => e instanceof Unit && e.team === 'player') as Unit[];
    const cols = Math.ceil(Math.sqrt(movers.length)), spacing = 22;
    movers.forEach((u, i) => {
      const col = (i % cols) - Math.floor(cols / 2), row = Math.floor(i / cols);
      u.moveTo(pos.x + col * spacing, pos.y + row * spacing);
      u.autoAtk = true;  // will auto-attack any enemy in range while moving
    });
    this._commandMode = null;
    this._moveInd = { x: pos.x, y: pos.y, t: 0.7 };
    this.setStatus('Attack move!', 'warn');
  }

  // ── WAVE SPAWNING ─────────────────────────────────────────
  _spawnWave(cfg: WaveConfig | { infantry: number; tanks: number }) {
    const wf = this.buildings.find(b => b.type === 'War Factory' && b.team === 'enemy');
    if (!wf) return;
    const ox = wf.cx, oy = wf.cy;

    for (let i = 0; i < cfg.infantry; i++) {
      const e = new EnemyUnit(ox + rnd(-55, 55), oy + rnd(-55, 55));
      e._game = this._ref;
      this.eUnits.push(e);
    }
    for (let i = 0; i < cfg.tanks; i++) {
      const e = new EnemyUnit(ox + rnd(-55, 55), oy + rnd(-55, 55), { tank: true });
      e._game = this._ref;
      this.eUnits.push(e);
    }
  }

  // ── UPDATE ────────────────────────────────────────────────
  update(dt: number) {
    if (get(gameState) !== 'playing') return;
    this._gameTime += dt;

    // Passive income trickle
    this._credits += 10 * dt;

    // FX timers
    this._particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    this._particles = this._particles.filter(p => p.life > 0);
    this._flashMsgs.forEach(m => m.t -= dt);
    this._flashMsgs = this._flashMsgs.filter(m => m.t > 0);
    if (this._moveInd) { this._moveInd.t -= dt; if (this._moveInd.t <= 0) this._moveInd = null; }

    // Projectiles
    this.projectiles.forEach(p => p.update(dt));
    this.projectiles = this.projectiles.filter(p => !p.dead);

    const allUnits = [...this.pUnits, ...this.eUnits];

    // Auto-attack for idle player units
    for (const u of this.pUnits) {
      if (u.autoAtk && !u.atkTarget && !u.moveTarget && !u.guardPos) {
        let best: Unit | null = null, bestD = u.autoAtkRange;
        for (const e of this.eUnits) {
          if (!e.isAlive()) continue;
          const d = hypot(u.x, u.y, e.cx, e.cy);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) u.atkTarget = best;
      }
      // Guard mode: auto-attack in guard radius, don't chase outside it
      if (u.guardPos && !u.atkTarget) {
        let best: Unit | null = null, bestD = u.guardRadius + u.autoAtkRange;
        for (const e of this.eUnits) {
          if (!e.isAlive()) continue;
          const d = hypot(u.x, u.y, e.cx, e.cy);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) u.atkTarget = best;
      }
      u.update(dt, allUnits, this.projectiles);
    }

    // Buildings (Turrets combat-update; all buildings drive hit-flash)
    const eTgts: Entity[] = [...this.eUnits, ...this.buildings.filter(b => b.team === 'enemy')];
    const pTgts: Entity[] = [...this.pUnits, ...this.buildings.filter(b => b.team === 'player')];
    for (const b of this.buildings) {
      b.update(dt, b.team === 'player' ? eTgts : pTgts, this.projectiles);
    }

    // Enemy units (pEntities resolved internally via GameRef)
    for (const e of this.eUnits) {
      e.update(dt, allUnits, this.projectiles);
    }

    // Reap dead
    this.pUnits    = this._reap(this.pUnits);
    this._ref.pUnits = this.pUnits;        // keep ref in sync after reap
    this.eUnits    = this._reap(this.eUnits);
    this.buildings = this._reap(this.buildings) as Building[];
    this._selected = this._selected.filter(e => e.isAlive());
    this.tibFields = this.tibFields.filter(f => !f.isEmpty());
    this._recalcPower();

    // ── WAVE TIMER ────────────────────────────────────────
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      if (this._waveIndex < WAVES.length) {
        const w = WAVES[this._waveIndex];
        this._spawnWave(w);
        this._waveLabel = this._waveIndex + 1;
        this._waveIndex++;
        const nextW = WAVES[this._waveIndex];
        this._spawnTimer = nextW ? nextW.at - w.at : ENDLESS_INTERVAL;
        waveIncoming.set(true);
        this.setStatus(`WAVE ${this._waveLabel} INCOMING!`, 'error');
        setTimeout(() => waveIncoming.set(false), 3000);
      } else {
        // Endless mode: escalating groups
        const t = this._gameTime;
        const extra = Math.floor((t - WAVES[WAVES.length - 1].at) / 60);
        this._spawnWave({ infantry: Math.min(8, 4 + extra), tanks: Math.min(6, 2 + extra) });
        this._spawnTimer = Math.max(20, ENDLESS_INTERVAL - extra * 3);
        this._waveLabel++;
        waveIncoming.set(true);
        this.setStatus(`ENDLESS ASSAULT ${this._waveLabel - WAVES.length}`, 'error');
        setTimeout(() => waveIncoming.set(false), 3000);
      }
    }

    // ── WIN/LOSE ──────────────────────────────────────────
    const wf = this.buildings.find(b => b.type === 'War Factory' && b.team === 'enemy');
    if (!wf) {
      gameState.set('won'); return;
    }
    warFactoryHp.set(wf.hp);

    const pAlive = this.pUnits.length > 0 || this.buildings.some(b => b.team === 'player');
    if (!pAlive) { gameState.set('lost'); return; }

    this._syncStores();
  }

  private _reap<T extends Entity>(arr: T[]): T[] {
    return arr.filter(e => {
      if (!e.isAlive()) {
        this._boom(e.cx, e.cy, e.team);
        if (e.team === 'enemy') this._enemiesKilled++;
        else                   this._unitsLost++;
        return false;
      }
      return true;
    });
  }

  _boom(cx: number, cy: number, team: string) {
    const color = team === 'player' ? C.allyAccent : C.enemyAccent;
    for (let i = 0; i < 12; i++) {
      const ang = Math.random() * Math.PI * 2, spd = rnd(40, 110);
      this._particles.push({
        x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: rnd(0.3, 0.9), maxLife: 0.9, color, r: rnd(2, 6),
      });
    }
    // Secondary flash ring
    this._flashMsgs.push({ text: '', x: cx, y: cy, t: 0.25, maxT: 0.25, color });
  }

  // ── DRAW ─────────────────────────────────────────────────
  draw(t: number, dragRect: { x:number;y:number;w:number;h:number } | null, mousePos: {x:number;y:number}) {
    const ctx = this.ctx;

    // Terrain
    this.terrain.draw(ctx, t);

    // Tiberium fields
    for (const f of this.tibFields) f.draw(ctx, t);

    // Harvester route lines
    for (const u of this.pUnits) {
      if (u instanceof Harvester && u.moveTarget) {
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(u.moveTarget.x, u.moveTarget.y);
        ctx.strokeStyle = 'rgba(220,180,0,0.16)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 7]); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    // Buildings
    for (const b of this.buildings) b.draw(ctx);

    // Units
    for (const u of [...this.pUnits, ...this.eUnits]) u.draw(ctx);

    // Projectiles
    for (const p of this.projectiles) p.draw(ctx);

    // Particles
    for (const p of this._particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.round(a * 255).toString(16).padStart(2, '0');
      ctx.fill();
    }

    // Flash messages (floating credits)
    for (const m of this._flashMsgs) {
      if (!m.text) continue;
      const a = clamp(m.t / m.maxT, 0, 1);
      ctx.fillStyle = m.color + Math.round(a * 255).toString(16).padStart(2, '0');
      ctx.font = 'bold 12px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(m.text, m.x, m.y - (1 - a) * 22);
      ctx.textAlign = 'left';
    }

    // Move indicator
    if (this._moveInd) {
      const { x, y, t: mt } = this._moveInd;
      const a = clamp(mt / 0.7, 0, 1);
      const r = 14 * (0.5 + a * 0.5);
      ctx.strokeStyle = `rgba(0,255,100,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9);
      ctx.stroke();
    }

    // Attack-move cursor (red crosshair)
    if (this._commandMode === 'attack-move') {
      const { x, y } = mousePos;
      ctx.strokeStyle = 'rgba(255,50,50,0.85)';
      ctx.lineWidth = 1.5;
      const cr = 12;
      ctx.beginPath();
      ctx.arc(x, y, cr, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - cr - 4, y); ctx.lineTo(x + cr + 4, y);
      ctx.moveTo(x, y - cr - 4); ctx.lineTo(x, y + cr + 4);
      ctx.stroke();
    }

    // Drag select box
    if (dragRect) {
      ctx.fillStyle = 'rgba(0,255,80,0.05)';
      ctx.fillRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h);
      ctx.strokeStyle = C.uiAccent;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h);
      ctx.setLineDash([]);
    }

    // Build ghost
    if (this._buildMode) {
      const d = BDEF[this._buildMode];
      const mx = mousePos.x - d.w / 2, my = mousePos.y - d.h / 2;
      ctx.fillStyle = 'rgba(80,150,255,0.25)';
      ctx.fillRect(mx, my, d.w, d.h);
      ctx.strokeStyle = C.allyLight;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(mx, my, d.w, d.h);
      ctx.setLineDash([]);
      ctx.fillStyle = '#CCDDFF';
      ctx.font = '9px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(this._buildMode, mousePos.x, mousePos.y + 3);
      ctx.textAlign = 'left';
    }
  }

  // ── MINIMAP ───────────────────────────────────────────────
  drawMinimap(mc: HTMLCanvasElement) {
    const mctx = mc.getContext('2d')!;
    const mw = mc.width, mh = mc.height;
    const sx = mw / CANVAS_W, sy = mh / CANVAS_H;

    // Terrain thumbnail
    mctx.drawImage(this.terrain['_off'], 0, 0, mw, mh);

    // Tiberium
    for (const f of this.tibFields) {
      const p = f.pct();
      mctx.beginPath();
      mctx.arc(f.cx * sx, f.cy * sy, 4 * p, 0, Math.PI * 2);
      mctx.fillStyle = C.tibGreen;
      mctx.fill();
    }

    // Buildings
    for (const b of this.buildings) {
      mctx.fillStyle = b.team === 'player' ? C.allyAccent : (b.type === 'War Factory' ? '#FF0000' : C.enemyAccent);
      mctx.fillRect(b.cx * sx - 3, b.cy * sy - 3, 6, 6);
    }

    // Player units
    for (const u of this.pUnits) {
      mctx.beginPath();
      mctx.arc(u.x * sx, u.y * sy, 2.5, 0, Math.PI * 2);
      mctx.fillStyle = C.allyLight;
      mctx.fill();
    }

    // Enemy units
    for (const u of this.eUnits) {
      mctx.beginPath();
      mctx.arc(u.x * sx, u.y * sy, 2.5, 0, Math.PI * 2);
      mctx.fillStyle = C.enemyLight;
      mctx.fill();
    }

    // Viewport border
    mctx.strokeStyle = 'rgba(0,255,80,0.5)';
    mctx.lineWidth = 1;
    mctx.strokeRect(0, 0, mw, mh);
  }

  // ── STATUS ────────────────────────────────────────────────
  setStatus(text: string, type = '') {
    statusMsg.set({ text, type });
    if (this._stTimer) clearTimeout(this._stTimer);
    if (type === 'success' || type === 'error' || type === 'warn') {
      this._stTimer = setTimeout(() => statusMsg.set({ text: 'TIBERIUM WARS v3.0', type: '' }), 3000);
    }
  }

  // ── STORE SYNC ───────────────────────────────────────────
  _syncStores() {
    credits.set(Math.floor(this._credits));
    powerGen.set(this._powerGen);
    powerUsed.set(this._powerUsed);
    buildMode.set(this._buildMode);
    selected.set([...this._selected]);

    const harvs = this.pUnits.filter(u => u instanceof Harvester).length;
    incomeRate.set(harvs * 22 + 10);

    wave.set(this._waveLabel);
    totalWaves.set(WAVES.length);
    nextWaveIn.set(Math.ceil(Math.max(0, this._spawnTimer)));

    const hasBrk = this.buildings.some(b => b.team === 'player' && b.type === 'Barracks');
    const hasRef = this.buildings.some(b => b.team === 'player' && b.type === 'Refinery');
    hasBarracks.set(hasBrk);
    hasRefinery.set(hasRef);
    selHasBarracks.set(this._selected.some(e => e instanceof Building && e.type === 'Barracks' && e.team === 'player'));
    selHasRefinery.set(this._selected.some(e => e instanceof Building && e.type === 'Refinery' && e.team === 'player'));
    selHasUnits.set(this._selected.some(e => e instanceof Unit && e.team === 'player'));

    const wf = this.buildings.find(b => b.type === 'War Factory' && b.team === 'enemy');
    if (wf) warFactoryHp.set(wf.hp);

    enemiesKilled.set(this._enemiesKilled);
    unitsLost.set(this._unitsLost);

    selected.set([...this._selected]);
  }

  // ── START / STOP ──────────────────────────────────────────
  start() {
    this._lastTime = performance.now();
    const loop = (ts: number) => {
      const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
      this._lastTime = ts;
      this.update(dt);
      // draw is called by GameCanvas via requestAnimationFrame too
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this._raf);
    if (this._stTimer) clearTimeout(this._stTimer);
  }

  restart() {
    this._init();
    gameState.set('playing');
    this.setStatus('New game started', 'success');
    this._syncStores();
  }
}
