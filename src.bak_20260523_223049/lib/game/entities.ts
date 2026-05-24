import { CANVAS_W, CANVAS_H, BDEF, C } from './constants';
import type { BType } from './constants';
import { hypot, clamp, rnd, rndi, lerpAngle, nextId,
         drawBrackets, drawHpBar, hexA } from './utils';
import type { TerrainMap } from './terrain';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
export type Team = 'player' | 'enemy';

export interface GameRef {
  terrain:    TerrainMap;
  addCredits: (n: number) => void;
  buildings:  Building[];
  tibFields:  TiberiumField[];
  pUnits:     Unit[];
}

// ═══════════════════════════════════════════════════════════════
// ENTITY – base
// ═══════════════════════════════════════════════════════════════
export abstract class Entity {
  id:       number;
  team:     Team;
  hp:       number;
  maxHp:    number;
  selected: boolean = false;

  constructor(team: Team, hp: number) {
    this.id    = nextId();
    this.team  = team;
    this.hp    = hp;
    this.maxHp = hp;
  }

  abstract get cx(): number;
  abstract get cy(): number;
  abstract contains(px: number, py: number): boolean;
  abstract overlapsRect(rx: number, ry: number, rw: number, rh: number): boolean;

  isAlive()     { return this.hp > 0; }
  takeDmg(d: number) { this.hp = Math.max(0, this.hp - d); }
}

// ═══════════════════════════════════════════════════════════════
// BUILDING
// ═══════════════════════════════════════════════════════════════
export class Building extends Entity {
  x: number; y: number;
  w: number; h: number;
  type: BType;
  _flash: number = 0;   // hit-flash timer

  constructor(cx: number, cy: number, type: BType, team: Team = 'player') {
    const d = BDEF[type];
    super(team, d.hp);
    this.type = type;
    this.w = d.w; this.h = d.h;
    this.x = cx - d.w / 2;
    this.y = cy - d.h / 2;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  contains(px: number, py: number) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }
  overlapsRect(rx: number, ry: number, rw: number, rh: number) {
    return this.x < rx + rw && this.x + this.w > rx && this.y < ry + rh && this.y + this.h > ry;
  }

  takeDmg(d: number) { super.takeDmg(d); this._flash = 0.12; }

  // no-op; Turret overrides
  update(dt: number, _targets: Entity[], _proj: Projectile[]) {
    if (this._flash > 0) this._flash -= dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const pl = this.team === 'player';
    const base   = this._flash > 0 ? '#FFFFFF' : (pl ? C.allyBase   : C.enemyBase);
    const dark   = pl ? C.allyDark   : C.enemyDark;
    const accent = pl ? C.allyAccent : C.enemyAccent;
    const { x, y, w, h } = this;

    // Building glow (RA3-style ambient light)
    ctx.shadowColor = pl ? C.allyAccent : C.enemyAccent;
    ctx.shadowBlur  = this.selected ? 18 : 8;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 5, y + 5, w, h);
    ctx.shadowBlur = 0;
    // Body — base colour + chrome edge highlight
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    // Chrome top-left highlight
    ctx.fillStyle = pl ? C.allyChr : C.enemyLight;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x, y, 3, h);
    ctx.globalAlpha = 1;
    // Dark panel inset
    ctx.fillStyle = dark;
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    // Subtle inner bevel
    ctx.strokeStyle = pl ? 'rgba(68,170,255,0.35)' : 'rgba(255,85,34,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

    // ── Type-specific details ──────────────────────────────
    ctx.fillStyle = accent;

    if (this.type === 'Construction Yard') {
      ctx.fillRect(x + 8, y + 8, 16, 16);
      ctx.fillRect(x + w - 24, y + 8, 16, 16);
      ctx.fillRect(this.cx - 1, y + 4, 2, h - 8);
      ctx.fillRect(x + 4, this.cy - 1, w - 8, 2);
      // Crane arm
      ctx.strokeStyle = C.allyGold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy - 4);
      ctx.lineTo(this.cx + 14, this.cy - 14);
      ctx.lineTo(this.cx + 14, this.cy + 8);
      ctx.stroke();

    } else if (this.type === 'Barracks') {
      ctx.fillRect(x + 6, y + 8, 12, 12);
      ctx.fillRect(x + w - 18, y + 8, 12, 12);
      ctx.fillStyle = '#000';
      ctx.fillRect(this.cx - 8, y + h - 16, 16, 16);
      // Stars / rank badges
      ctx.fillStyle = C.allyGold;
      ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('★', this.cx, this.cy + 3);
      ctx.textAlign = 'left';

    } else if (this.type === 'Refinery') {
      ctx.beginPath(); ctx.arc(x + 14, y + 14, 9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w - 14, y + 14, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark;
      ctx.fillRect(this.cx - 2, y + 8, 4, h - 14);
      ctx.fillStyle = C.tibGreen;
      ctx.beginPath(); ctx.arc(this.cx, y + h - 12, 9, 0, Math.PI * 2); ctx.fill();

    } else if (this.type === 'Power Plant') {
      // Yellow energy rings
      const rings = [12, 8, 5];
      for (let i = 0; i < rings.length; i++) {
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, rings[i], 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,${200 - i*40},0,${0.9 - i*0.2})`;
        ctx.lineWidth = 3 - i;
        ctx.stroke();
      }
      // Lightning bolt
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(this.cx + 4, y + 8);
      ctx.lineTo(this.cx - 5, this.cy + 2);
      ctx.lineTo(this.cx + 2, this.cy + 2);
      ctx.lineTo(this.cx - 4, y + h - 8);
      ctx.lineTo(this.cx + 5, this.cy - 2);
      ctx.lineTo(this.cx - 2, this.cy - 2);
      ctx.closePath(); ctx.fill();

    } else if (this.type === 'War Factory') {
      // Big red factory
      ctx.fillStyle = accent;
      ctx.fillRect(x + 6,     y + 6,  22, 22);
      ctx.fillRect(x + w - 28, y + 6, 22, 22);
      ctx.fillRect(x + 8, y + h - 22, w - 16, 16);
      // Skull
      ctx.fillStyle = '#FF0000';
      ctx.beginPath(); ctx.arc(this.cx, this.cy - 6, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(this.cx - 4, this.cy - 8, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.cx + 4, this.cy - 8, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(this.cx - 7, this.cy - 1, 5, 6);
      ctx.fillRect(this.cx + 2, this.cy - 1, 5, 6);
      // HP bar in building
      if (this.hp < this.maxHp) {
        ctx.fillStyle = '#FF2200';
        const pct = this.hp / this.maxHp;
        const bx = x + 6, bw = w - 12;
        ctx.fillStyle = '#111';
        ctx.fillRect(bx, y + h + 2, bw, 5);
        ctx.fillStyle = pct > 0.5 ? '#FF4400' : '#FF0000';
        ctx.fillRect(bx, y + h + 2, bw * pct, 5);
      }
    }

    // ── Selection indicator ───────────────────────────────
    if (this.selected) {
      ctx.strokeStyle = C.uiAccent;
      ctx.lineWidth = 2;
      const pad = 4;
      ctx.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
      drawBrackets(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2);
    }

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 7px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(this.type.toUpperCase(), this.cx, this.cy + 3);
    ctx.textAlign = 'left';

    drawHpBar(ctx, this.cx, this.y - 12, this.w + 4, this.hp, this.maxHp);
  }
}

// ═══════════════════════════════════════════════════════════════
// TURRET  (extends Building — rotating barrel, auto-attack)
// ═══════════════════════════════════════════════════════════════
export class Turret extends Building {
  atkDmg   = 32;
  atkRange = 158;
  atkRate  = 1.3;
  atkCd    = 0;
  atkTarget: Entity | null = null;
  barrel   = -Math.PI / 2; // angle in radians
  disabled = false;
  projColor: string;

  constructor(cx: number, cy: number, team: Team = 'player') {
    super(cx, cy, 'Turret', team);
    this.projColor = team === 'player' ? C.allyLight : C.enemyLight;
  }

  update(dt: number, targets: Entity[], projectiles: Projectile[]) {
    super.update(dt, targets, projectiles);   // drives hit flash
    if (this.disabled) { this.atkTarget = null; return; }
    if (this.atkCd > 0) this.atkCd -= dt;

    // Acquire target
    if (!this.atkTarget?.isAlive()) {
      this.atkTarget = null;
      let best: Entity | null = null, bestD = this.atkRange;
      for (const t of targets) {
        if (!t.isAlive()) continue;
        const d = hypot(this.cx, this.cy, t.cx, t.cy);
        if (d < bestD) { bestD = d; best = t; }
      }
      this.atkTarget = best;
    }

    if (this.atkTarget) {
      const dx = this.atkTarget.cx - this.cx;
      const dy = this.atkTarget.cy - this.cy;
      const targetAng = Math.atan2(dy, dx);
      this.barrel = lerpAngle(this.barrel, targetAng, Math.min(1, dt * 5));
      let diff = targetAng - this.barrel;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (this.atkCd <= 0 && Math.abs(diff) < 0.35) {
        const d = hypot(this.cx, this.cy, this.atkTarget.cx, this.atkTarget.cy);
        if (d <= this.atkRange) {
          projectiles.push(new Projectile(this.cx, this.cy, this.atkTarget, this.atkDmg, 400, this.projColor));
          this.atkCd = 1 / this.atkRate;
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y, w, h } = this;
    const pl = this.team === 'player';
    const base   = this._flash > 0 ? '#FFFFFF' : (pl ? C.allyDark : C.enemyDark);
    const accent = pl ? C.allyAccent : C.enemyAccent;

    // Platform shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + 4, y + 4, w, h);
    // Platform
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    // Diagonal cross brace
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + w - 4, y + h - 4);
    ctx.moveTo(x + w - 4, y + 4); ctx.lineTo(x + 4, y + h - 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();

    // Range circle when selected
    if (this.selected) {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.atkRange, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,255,80,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 8]); ctx.stroke(); ctx.setLineDash([]);
      drawBrackets(ctx, x - 4, y - 4, w + 8, h + 8, 7);
      ctx.strokeStyle = C.uiAccent; ctx.lineWidth = 2;
      ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
    }

    // Turret head
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = this.disabled ? '#333' : accent; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();

    // Barrel
    const blen = 22;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.barrel);
    ctx.fillStyle = this.disabled ? '#555' : '#EEE';
    ctx.fillRect(0, -2.5, blen, 5);
    ctx.fillStyle = this.disabled ? '#444' : '#AAA';
    ctx.fillRect(blen - 5, -3, 5, 6);
    ctx.restore();

    drawHpBar(ctx, this.cx, this.y - 11, this.w + 4, this.hp, this.maxHp);

    if (this.disabled) {
      ctx.fillStyle = 'rgba(255,80,0,0.85)';
      ctx.font = 'bold 7px "Courier New"'; ctx.textAlign = 'center';
      ctx.fillText('NO PWR', this.cx, y - 3);
      ctx.textAlign = 'left';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// TIBERIUM FIELD
// ═══════════════════════════════════════════════════════════════
export class TiberiumField {
  id:        number;
  cx:        number; cy: number;
  capacity:  number;
  remaining: number;
  radius:    number = 40;
  private _crystals: Array<{ x:number; y:number; h:number; w:number; angle:number }> = [];

  constructor(cx: number, cy: number) {
    this.id       = nextId();
    this.cx       = cx; this.cy = cy;
    this.capacity = rnd(450, 750);
    this.remaining = this.capacity;
    const n = rndi(8, 14);
    for (let i = 0; i < n; i++) {
      this._crystals.push({
        x: cx + rnd(-30, 30), y: cy + rnd(-30, 30),
        h: rnd(10, 20), w: rnd(3.5, 7.5),
        angle: rnd(-0.3, 0.3),
      });
    }
  }

  isEmpty() { return this.remaining <= 0; }
  pct()     { return clamp(this.remaining / this.capacity, 0, 1); }

  harvest(dt: number, rate: number) {
    const amt = Math.min(rate * dt, this.remaining);
    this.remaining -= amt;
    return amt;
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    const p = this.pct();
    if (p <= 0) return;

    // Ground stain
    const stain = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.radius * p);
    stain.addColorStop(0, `rgba(0,200,70,${0.12 * p})`);
    stain.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = stain;
    ctx.beginPath(); ctx.arc(this.cx, this.cy, this.radius * p, 0, Math.PI * 2); ctx.fill();

    // Crystals
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
    const green = Math.floor(120 + p * 135);
    for (const c of this._crystals) {
      const sh = c.h * p * pulse;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      // Crystal body
      ctx.fillStyle = `rgb(0,${green},${Math.floor(green * 0.28)})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-c.w / 2, sh);
      ctx.lineTo(c.w / 2, sh);
      ctx.closePath(); ctx.fill();
      // Inner highlight
      ctx.fillStyle = `rgba(${Math.floor(green*0.3)},${Math.min(255, green + 90)},${Math.floor(green*0.5)},0.7)`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-c.w / 4, sh * 0.45);
      ctx.lineTo(c.w / 4, sh * 0.45);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Capacity bar
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(this.cx - 22, this.cy + this.radius - 3, 44, 4);
    ctx.fillStyle = `rgba(0,${Math.floor(200 * p + 40)},60,0.9)`;
    ctx.fillRect(this.cx - 22, this.cy + this.radius - 3, 44 * p, 4);
  }
}

// ═══════════════════════════════════════════════════════════════
// PROJECTILE
// ═══════════════════════════════════════════════════════════════
export class Projectile {
  x: number; y: number;
  target:  Entity;
  dmg:     number;
  speed:   number;
  color:   string;
  dead:    boolean = false;
  private trail: Array<{ x: number; y: number }> = [];

  constructor(sx: number, sy: number, target: Entity, dmg: number, spd: number, color: string) {
    this.x = sx; this.y = sy;
    this.target = target; this.dmg = dmg;
    this.speed = spd; this.color = color;
  }

  update(dt: number) {
    if (!this.target.isAlive()) { this.dead = true; return; }
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();
    const dx = this.target.cx - this.x, dy = this.target.cy - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) {
      this.target.takeDmg(this.dmg);
      this.dead = true;
    } else {
      this.x += (dx / d) * this.speed * dt;
      this.y += (dy / d) * this.speed * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < this.trail.length; i++) {
      const a = (i / this.trail.length) * 0.55;
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = hexA(this.color, a);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    // Glow
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = hexA(this.color, 0.2);
    ctx.fill();
  }
}

// ═══════════════════════════════════════════════════════════════
// UNIT – base
// ═══════════════════════════════════════════════════════════════
export class Unit extends Entity {
  x: number; y: number;
  radius:  number = 8;
  speed:   number = 85;
  angle:   number = 0;        // facing angle
  _flash:  number = 0;        // flash timer
  _speedMult: number = 1;     // power penalty hook

  moveTarget: { x: number; y: number } | null = null;
  atkTarget:  Entity | null = null;
  atkDmg:  number = 15;
  atkRange:number = 55;
  atkCd:   number = 0;
  atkRate: number = 1.5;
  projColor: string;
  autoAtk: boolean = true;
  autoAtkRange: number = 130;

  // Guard mode
  guardPos: { x: number; y: number } | null = null;
  guardRadius = 80;

  _game: GameRef | null = null;

  constructor(x: number, y: number, team: Team) {
    super(team, 100);
    this.x = x; this.y = y;
    this.projColor = team === 'player' ? C.allyLight : C.enemyLight;
  }

  get cx() { return this.x; }
  get cy() { return this.y; }

  contains(px: number, py: number) {
    return hypot(px, py, this.x, this.y) <= this.radius + 3;
  }
  overlapsRect(rx: number, ry: number, rw: number, rh: number) {
    return this.x >= rx && this.x <= rx + rw && this.y >= ry && this.y <= ry + rh;
  }

  moveTo(tx: number, ty: number) {
    this.moveTarget = { x: tx, y: ty };
    this.atkTarget  = null;
    this.guardPos   = null;
  }
  attack(t: Entity) { this.atkTarget = t; this.moveTarget = null; }
  stop()   { this.moveTarget = null; this.atkTarget = null; }
  guard()  { this.guardPos = { x: this.x, y: this.y }; this.atkTarget = null; this.moveTarget = null; }

  update(dt: number, allUnits: Unit[], projectiles: Projectile[]) {
    if (this.atkCd  > 0) this.atkCd  -= dt;
    if (this._flash > 0) this._flash -= dt;

    // ── Attack logic ──────────────────────────────────────
    if (this.atkTarget) {
      if (!this.atkTarget.isAlive()) { this.atkTarget = null; return; }
      const d   = hypot(this.x, this.y, this.atkTarget.cx, this.atkTarget.cy);
      const rng = this.atkRange * (this._game?.terrain.rangeMult(this.x, this.y) ?? 1);
      if (d > rng) {
        this._towards(this.atkTarget.cx, this.atkTarget.cy, dt);
      } else if (this.atkCd <= 0) {
        const p = new Projectile(this.x, this.y, this.atkTarget, this.atkDmg, 420, this.projColor);
        projectiles.push(p);
        this.atkCd  = 1 / this.atkRate;
        this._flash = 0.07;
      }
    } else if (this.moveTarget) {
      const d = hypot(this.x, this.y, this.moveTarget.x, this.moveTarget.y);
      if (d > 3) this._towards(this.moveTarget.x, this.moveTarget.y, dt);
      else       this.moveTarget = null;
    } else if (this.guardPos) {
      // Return to guard position
      const d = hypot(this.x, this.y, this.guardPos.x, this.guardPos.y);
      if (d > 8) this._towards(this.guardPos.x, this.guardPos.y, dt);
    }

    this._separate(allUnits);
    this.x = clamp(this.x, this.radius, CANVAS_W - this.radius);
    this.y = clamp(this.y, this.radius, CANVAS_H - this.radius);
  }

  _towards(tx: number, ty: number, dt: number) {
    const dx = tx - this.x, dy = ty - this.y;
    const d  = Math.hypot(dx, dy);
    if (d < 0.1) return;
    this.angle = Math.atan2(dy, dx);
    const sm   = this._game?.terrain.speedMult(this.x, this.y) ?? 1;
    const spd  = this.speed * sm * this._speedMult;
    this.x += (dx / d) * spd * dt;
    this.y += (dy / d) * spd * dt;
  }

  _separate(units: Unit[]) {
    for (const o of units) {
      if (o === this) continue;
      const dx = this.x - o.x, dy = this.y - o.y;
      const d  = Math.hypot(dx, dy);
      const mn = (this.radius + o.radius) * 1.1;
      if (d < mn && d > 0.01) {
        const push = (mn - d) * 0.28;
        this.x += (dx / d) * push;
        this.y += (dy / d) * push;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const pl   = this.team === 'player';
    const base = pl ? C.allyBase  : C.enemyBase;
    const dark = pl ? C.allyDark  : C.enemyDark;
    const r    = this.radius;

    // Shadow
    ctx.beginPath(); ctx.arc(this.x + 2, this.y + 2, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();

    // Glow ring (faction colour)
    if (!this._flash) {
      ctx.beginPath(); ctx.arc(this.x, this.y, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = pl ? 'rgba(68,170,255,0.15)' : 'rgba(255,85,34,0.15)';
      ctx.fill();
    }

    // Body
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = this._flash > 0 ? '#FFF' : base; ctx.fill();
    ctx.strokeStyle = pl ? C.allyLight : C.enemyLight;
    ctx.lineWidth = 1.5; ctx.stroke();

    // Helmet/visor
    ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = this._flash > 0 ? '#EEE' : dark; ctx.fill();

    // Facing pip
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.arc(r * 0.62, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = this._flash > 0 ? '#FFF' : (pl ? C.allyGold : C.enemyAccent);
    ctx.fill();
    ctx.restore();

    this._drawSelection(ctx);
    drawHpBar(ctx, this.x, this.y - r - 10, 22, this.hp, this.maxHp);
  }

  _drawSelection(ctx: CanvasRenderingContext2D) {
    if (!this.selected) return;
    const r = this.radius;
    ctx.beginPath(); ctx.arc(this.x, this.y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = C.uiAccent; ctx.lineWidth = 2; ctx.stroke();
    const R1 = r + 5, R2 = r + 11;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(a) * R1, this.y + Math.sin(a) * R1);
      ctx.lineTo(this.x + Math.cos(a) * R2, this.y + Math.sin(a) * R2);
      ctx.stroke();
    }
    // Guard indicator
    if (this.guardPos) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.guardRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,200,0,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// TANK
// ═══════════════════════════════════════════════════════════════
export class Tank extends Unit {
  private _barrelAngle = -Math.PI / 2;

  constructor(x: number, y: number, team: Team = 'player') {
    super(x, y, team);
    this.radius = 12;
    this.speed  = 54;
    this.hp = this.maxHp = 300;
    this.atkDmg  = 44;
    this.atkRange = 90;
    this.atkRate  = 0.65;
    this.projColor = team === 'player' ? '#FFDD44' : '#FF8800';
    this.autoAtkRange = 170;
  }

  update(dt: number, allUnits: Unit[], projectiles: Projectile[]) {
    super.update(dt, allUnits, projectiles);
    // Smooth barrel toward attack target or movement direction
    const target = this.atkTarget ?? (this.moveTarget ? {
      cx: this.moveTarget.x, cy: this.moveTarget.y
    } : null);
    if (target) {
      const ang = Math.atan2(target.cy - this.y, target.cx - this.x);
      this._barrelAngle = lerpAngle(this._barrelAngle, ang, Math.min(1, dt * 4.5));
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const pl   = this.team === 'player';
    const base = pl ? C.allyBase  : C.enemyBase;
    const dark = pl ? C.allyDark  : C.enemyDark;
    const r    = this.radius;
    const { x, y } = this;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - r + 3, y - r + 3, r * 2, r * 2);

    // Hull
    ctx.fillStyle = this._flash > 0 ? '#FFF' : base;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.strokeStyle = dark; ctx.lineWidth = 2;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);

    // Tread marks
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - r, y - r, 5, r * 2);
    ctx.fillRect(x + r - 5, y - r, 5, r * 2);

    // Turret ring
    ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = dark; ctx.fill();

    // Barrel
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this._barrelAngle);
    ctx.fillStyle = pl ? '#AACCFF' : '#FF8866';
    ctx.fillRect(0, -3, r * 1.9, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(r * 1.2, -3, r * 0.7, 6);
    ctx.restore();

    this._drawSelection(ctx);
    drawHpBar(ctx, x, y - r - 10, 26, this.hp, this.maxHp);
  }
}

// ═══════════════════════════════════════════════════════════════
// HARVESTER
// ═══════════════════════════════════════════════════════════════
export type HState = 'idle' | 'to-field' | 'harvesting' | 'returning';

export class Harvester extends Unit {
  state:       HState = 'idle';
  cargo:       number = 0;
  maxCargo:    number = 120;
  harvestRate: number = 22;
  targetField: TiberiumField | null = null;
  private _refinery: Building | null = null;

  constructor(x: number, y: number, game: GameRef) {
    super(x, y, 'player');
    this._game  = game;
    this.radius = 10;
    this.speed  = 60;
    this.hp = this.maxHp = 175;
    this.autoAtk = false;
  }

  update(dt: number, allUnits: Unit[], _proj: Projectile[]) {
    if (this._flash > 0) this._flash -= dt;
    const g = this._game!;

    // Keep refinery ref fresh
    if (!this._refinery?.isAlive()) {
      this._refinery = g.buildings.find(b => b.type === 'Refinery' && b.team === 'player') ?? null;
    }

    if (this.state === 'idle') {
      if (!this._refinery) return;
      const field = g.tibFields
        .filter(f => !f.isEmpty())
        .sort((a, b) => hypot(this.x, this.y, a.cx, a.cy) - hypot(this.x, this.y, b.cx, b.cy))[0];
      if (field) {
        this.targetField = field;
        this.state = 'to-field';
        this.moveTo(field.cx, field.cy);
      }
    }

    if (this.state === 'to-field') {
      if (!this.targetField || this.targetField.isEmpty()) {
        this.state = 'idle'; this.targetField = null; this.moveTarget = null; return;
      }
      if (hypot(this.x, this.y, this.targetField.cx, this.targetField.cy) < this.targetField.radius) {
        this.moveTarget = null; this.state = 'harvesting';
      }
    }

    if (this.state === 'harvesting') {
      if (!this.targetField || this.targetField.isEmpty() || this.cargo >= this.maxCargo) {
        if (!this._refinery) { this.state = 'idle'; return; }
        this.state = 'returning';
        this.moveTo(this._refinery.cx, this._refinery.cy);
        return;
      }
      const spd = this._speedMult; // power penalty
      this.cargo += this.targetField.harvest(dt, this.harvestRate * spd);
    }

    if (this.state === 'returning') {
      if (!this._refinery?.isAlive()) { this.state = 'idle'; return; }
      if (hypot(this.x, this.y, this._refinery.cx, this._refinery.cy) < 44) {
        g.addCredits(this.cargo);
        this.cargo = 0; this.state = 'idle'; this.moveTarget = null;
      }
    }

    // Movement
    if (this.moveTarget) {
      const d = hypot(this.x, this.y, this.moveTarget.x, this.moveTarget.y);
      if (d > 3) this._towards(this.moveTarget.x, this.moveTarget.y, dt);
      else this.moveTarget = null;
    }
    this._separate(allUnits);
    this.x = clamp(this.x, this.radius, CANVAS_W - this.radius);
    this.y = clamp(this.y, this.radius, CANVAS_H - this.radius);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y } = this; const r = this.radius;

    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(x - r + 2, y - r + 2, r * 2, r * 2);
    ctx.fillStyle = this._flash > 0 ? '#FFF' : '#DDAA00';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.strokeStyle = '#997700'; ctx.lineWidth = 1.5;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);

    // Cargo fill (bright green)
    if (this.cargo > 0) {
      const cp = this.cargo / this.maxCargo;
      ctx.fillStyle = hexA(C.tibGreen, cp * 0.75);
      ctx.fillRect(x - r + 2, y + r - 2 - (r * 2 - 4) * cp, r * 2 - 4, (r * 2 - 4) * cp);
    }

    // State label
    const labels: Record<HState, string> = { idle: 'IDL', 'to-field': '→TIB', harvesting: 'HARV', returning: 'LOAD' };
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.font = '6px "Courier New"'; ctx.textAlign = 'center';
    ctx.fillText(labels[this.state], x, y + 2.5);
    ctx.textAlign = 'left';

    if (this.selected) {
      ctx.strokeStyle = C.uiAccent; ctx.lineWidth = 2;
      ctx.strokeRect(x - r - 5, y - r - 5, r * 2 + 10, r * 2 + 10);
    }
    drawHpBar(ctx, x, y - r - 10, 24, this.hp, this.maxHp);
  }
}

// ═══════════════════════════════════════════════════════════════
// ENEMY UNIT – roam / aggro FSM
// ═══════════════════════════════════════════════════════════════
export interface EnemyOpts {
  hp?: number; dmg?: number; rate?: number;
  range?: number; radius?: number; speed?: number;
  aggro?: number; tank?: boolean;
}

export class EnemyUnit extends Unit {
  isTank:     boolean;
  aggroRange: number;
  private _state:       'roam' | 'aggro' = 'roam';
  private _roamTarget:  { x: number; y: number } | null = null;
  private _pauseTimer:  number;
  private _homeX:       number;
  private _homeY:       number;
  private _barrelAngle = -Math.PI / 2;

  constructor(x: number, y: number, opts: EnemyOpts = {}) {
    super(x, y, 'enemy');
    this.speed      = opts.speed  ?? 50;
    this.atkDmg     = opts.dmg    ?? 11;
    this.atkRate    = opts.rate   ?? 1.0;
    this.atkRange   = opts.range  ?? 54;
    this.hp = this.maxHp = opts.hp ?? 100;
    this.radius     = opts.radius ?? 8;
    this.isTank     = opts.tank   ?? false;
    this.aggroRange = opts.aggro  ?? 220;
    this.projColor  = this.isTank ? C.enemyLight : C.enemyAccent;
    this.autoAtk    = false;
    this._pauseTimer = rnd(0.5, 1.5);
    this._homeX = x; this._homeY = y;
    if (this.isTank) {
      this.radius = 12; this.speed = 46;
      this.hp = this.maxHp = 300;
      this.atkDmg = 44; this.atkRange = 90; this.atkRate = 0.65;
      this.autoAtkRange = 170;
    }
  }

  update(dt: number, allUnits: Unit[], projectiles: Projectile[]) {
    // Build pEntities from game ref
    const pEntities: Entity[] = this._game
      ? [...this._game.pUnits, ...this._game.buildings.filter(b => b.team === 'player')]
      : [];

    // ── Aggro scan ─────────────────────────────────────────
    let nearest: Entity | null = null, nearestD = this.aggroRange;
    for (const e of pEntities) {
      if (!e.isAlive()) continue;
      const d = hypot(this.x, this.y, e.cx, e.cy);
      if (d < nearestD) { nearestD = d; nearest = e; }
    }

    if (nearest) {
      // Aggro — chase & attack
      this._state = 'aggro';
      this.atkTarget = nearest;
      this.moveTarget = null;
    } else {
      // March — advance toward player base via bridges
      this._state = 'roam';
      this.atkTarget = null;
      if (this._pauseTimer > 0) {
        this._pauseTimer -= dt;
        this.moveTarget = null;
      } else {
        const mt = this._marchTarget(pEntities);
        if (mt) {
          this.moveTarget = mt;
        } else {
          // No player entities left — idle near spawn
          if (!this._roamTarget ||
              hypot(this.x, this.y, this._roamTarget.x, this._roamTarget.y) < 12) {
            const ang = Math.random() * Math.PI * 2, r = rnd(30, 80);
            this._roamTarget = {
              x: clamp(this._homeX + Math.cos(ang) * r, 16, CANVAS_W - 16),
              y: clamp(this._homeY + Math.sin(ang) * r, 16, CANVAS_H - 16),
            };
          }
          this.moveTarget = this._roamTarget;
        }
      }
    }

    // Barrel smooth rotation (for tanks)
    if (this.isTank) {
      const tgt = this.atkTarget ?? (this.moveTarget ? { cx: this.moveTarget.x, cy: this.moveTarget.y } : null);
      if (tgt) {
        const ang = Math.atan2(tgt.cy - this.y, tgt.cx - this.x);
        this._barrelAngle = lerpAngle(this._barrelAngle, ang, Math.min(1, dt * 4));
      }
    }

    super.update(dt, allUnits, projectiles);
  }

  /** Route via bridges when on the enemy side of the river */
  private _marchTarget(pEntities: Entity[]): { x: number; y: number } | null {
    // Find nearest living player entity as goal
    let goal: Entity | null = null, goalD = Infinity;
    for (const e of pEntities) {
      if (!e.isAlive()) continue;
      const d = hypot(this.x, this.y, e.cx, e.cy);
      if (d < goalD) { goalD = d; goal = e; }
    }
    if (!goal) return null;

    // Bridges: approximate river centre is x≈448; bridges at y≈155 and y≈460
    const RIVER_X = 448;
    if (this.x > RIVER_X + 40) {
      // Still on enemy side — head for nearest bridge
      const b1 = { x: RIVER_X - 10, y: 155 };
      const b2 = { x: RIVER_X - 10, y: 460 };
      // Bias bridge choice toward the row the enemy unit is on
      const d1 = hypot(this.x, this.y, b1.x, b1.y);
      const d2 = hypot(this.x, this.y, b2.x, b2.y);
      // Add small random variation so not all units pile onto one bridge
      const jitter = rnd(-30, 30);
      return d1 + jitter < d2 ? b1 : b2;
    }

    // West of river — advance straight to goal
    return { x: goal.cx, y: goal.cy };
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.isTank) this._drawTank(ctx);
    else super.draw(ctx);
  }

  private _drawTank(ctx: CanvasRenderingContext2D) {
    const r = this.radius; const { x, y } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - r + 3, y - r + 3, r * 2, r * 2);
    ctx.fillStyle = this._flash > 0 ? '#FFF' : C.enemyBase;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.strokeStyle = C.enemyDark; ctx.lineWidth = 2;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    // Tread marks
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - r, y - r, 4, r * 2);
    ctx.fillRect(x + r - 4, y - r, 4, r * 2);
    // Turret
    ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = C.enemyDark; ctx.fill();
    // Barrel
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this._barrelAngle);
    ctx.fillStyle = C.enemyLight;
    ctx.fillRect(0, -3, r * 1.9, 6);
    ctx.restore();

    this._drawSelection(ctx);
    drawHpBar(ctx, x, y - r - 10, 26, this.hp, this.maxHp);
  }
}
