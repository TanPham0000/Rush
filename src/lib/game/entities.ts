import { MAP_W, MAP_H, BDEF, C, HOLD_WIN_TIME } from './constants';
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
  onKill?:    (killer: Unit, victim: Unit) => void;
  onExplosion?:(x:number,y:number,r:number) => void;
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

  isAlive()       { return this.hp > 0; }
  takeDmg(d: number) { this.hp = Math.max(0, this.hp - d); }
}

// ═══════════════════════════════════════════════════════════════
// BUILDING
// ═══════════════════════════════════════════════════════════════
export class Building extends Entity {
  x: number; y: number;
  w: number; h: number;
  type: BType;
  _flash: number = 0;
  rallyPoint: { x: number; y: number } | null = null;
  /** 0 = just placed, 1 = fully built. Starts at 1 for prebuilt map buildings. */
  buildPct: number = 0;
  private _buildNotified = false;

  get isReady() { return this.buildPct >= 1; }

  constructor(cx: number, cy: number, type: BType, team: Team = 'player', prebuilt = false) {
    const d = BDEF[type];
    super(team, d.hp);
    this.type = type;
    this.w = d.w; this.h = d.h;
    this.x = cx - d.w / 2;
    this.y = cy - d.h / 2;
    if (prebuilt || d.buildTime === 0) this.buildPct = 1;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  contains(px: number, py: number) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }
  overlapsRect(rx: number, ry: number, rw: number, rh: number) {
    return this.x < rx+rw && this.x+this.w > rx && this.y < ry+rh && this.y+this.h > ry;
  }

  takeDmg(d: number) { super.takeDmg(d); this._flash = 0.12; }

  update(dt: number, _targets: Entity[], _proj: Projectile[]) {
    if (this._flash > 0) this._flash -= dt;
    if (this.buildPct < 1) {
      const bt = BDEF[this.type].buildTime;
      if (bt > 0) this.buildPct = Math.min(1, this.buildPct + dt / bt);
      if (this.buildPct >= 1 && !this._buildNotified) {
        this._buildNotified = true;
        // Engine listens for this flag and plays sound + recalcs power
        (this as any)._justCompleted = true;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const pl = this.team === 'player';
    const base   = this._flash > 0 ? '#FFFFFF' : (pl ? C.allyBase   : C.enemyBase);
    const dark   = pl ? C.allyDark   : C.enemyDark;
    const accent = pl ? C.allyAccent : C.enemyAccent;
    const { x, y, w, h } = this;

    // Selection glow
    ctx.shadowColor = pl ? 'rgba(68,170,255,0.9)' : 'rgba(220,40,40,0.9)';
    ctx.shadowBlur  = this.selected ? 28 : 14;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x+5,y+5,w,h);
    ctx.shadowBlur = 0;

    // Main body
    ctx.fillStyle = base; ctx.fillRect(x,y,w,h);
    // Bevel highlight (top-left)
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x,y,w,3); ctx.fillRect(x,y,3,h);
    // Inner panel
    ctx.fillStyle = dark; ctx.fillRect(x+4,y+4,w-8,h-8);
    ctx.strokeStyle = pl?'rgba(68,170,255,0.3)':'rgba(255,85,34,0.3)';
    ctx.lineWidth=1; ctx.strokeRect(x+4,y+4,w-8,h-8);
    ctx.fillStyle = accent;

    if (this.type === 'Construction Yard') {
      // Radar dish + command arrays
      ctx.fillStyle=accent;
      ctx.fillRect(x+7,y+7,14,14); ctx.fillRect(x+w-21,y+7,14,14); // corner towers
      // Crosshair lines
      ctx.strokeStyle=accent; ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(this.cx,y+5); ctx.lineTo(this.cx,y+h-5);
      ctx.moveTo(x+5,this.cy); ctx.lineTo(x+w-5,this.cy);
      ctx.stroke();
      // Rotating radar dish arm (static representation)
      ctx.strokeStyle=C.allyGold; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(this.cx,this.cy-4);
      ctx.lineTo(this.cx+16,this.cy-16); ctx.lineTo(this.cx+16,this.cy+6); ctx.stroke();
      // Dish circle
      ctx.beginPath(); ctx.arc(this.cx+16,this.cy-5,5,0,Math.PI*2);
      ctx.strokeStyle=C.allyGold; ctx.lineWidth=1.5; ctx.stroke();
      // Control centre windows
      ctx.fillStyle='rgba(100,200,255,0.45)';
      ctx.fillRect(x+8,y+h-18,18,10); ctx.fillRect(x+w-26,y+h-18,18,10);

    } else if (this.type === 'Barracks') {
      // Military barracks — rows of bunks / windows
      ctx.fillStyle='rgba(100,200,255,0.35)';
      // Windows row
      for(let i=0;i<3;i++) ctx.fillRect(x+7+i*14,y+8,10,8);
      // Entrance door
      ctx.fillStyle=dark; ctx.fillRect(this.cx-7,y+h-16,14,16);
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(this.cx-5,y+h-14,10,14);
      // Flagpole
      ctx.strokeStyle=accent; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(x+w-10,y+h-4); ctx.lineTo(x+w-10,y+2); ctx.stroke();
      // Flag
      ctx.fillStyle=C.allyGold;
      ctx.beginPath(); ctx.moveTo(x+w-10,y+3); ctx.lineTo(x+w-10,y+11);
      ctx.lineTo(x+w-2,y+7); ctx.closePath(); ctx.fill();
      // Star emblem
      ctx.fillStyle=C.allyGold; ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
      ctx.fillText('★',this.cx,this.cy+3); ctx.textAlign='left';

    } else if (this.type === 'Refinery') {
      // Processing dome + inlet pipes
      ctx.fillStyle=accent;
      ctx.beginPath(); ctx.arc(x+13,y+13,8,0,Math.PI*2); ctx.fill(); // corner silos
      ctx.beginPath(); ctx.arc(x+w-13,y+13,8,0,Math.PI*2); ctx.fill();
      // Main processing tube (vertical)
      ctx.fillStyle=dark; ctx.fillRect(this.cx-3,y+6,6,h-10);
      ctx.strokeStyle=accent; ctx.lineWidth=1; ctx.strokeRect(this.cx-3,y+6,6,h-10);
      // Tiberium inlet dome (glowing green)
      const tib=ctx.createRadialGradient(this.cx,y+h-10,0,this.cx,y+h-10,10);
      tib.addColorStop(0,C.tibGreen); tib.addColorStop(1,'rgba(0,200,60,0)');
      ctx.fillStyle=tib; ctx.beginPath(); ctx.arc(this.cx,y+h-10,10,0,Math.PI*2); ctx.fill();
      // Pipe connections
      ctx.strokeStyle=dark; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(x+13,y+h-13); ctx.lineTo(this.cx-3,y+h-13); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+w-13,y+h-13); ctx.lineTo(this.cx+3,y+h-13); ctx.stroke();

    } else if (this.type === 'Power Plant') {
      // Cooling fins on sides
      ctx.fillStyle=dark;
      for(let i=0;i<3;i++){
        ctx.fillRect(x-4,y+8+i*13,4,9);   // left fins
        ctx.fillRect(x+w,y+8+i*13,4,9);   // right fins
      }
      // Reactor core rings (concentric animated-looking circles)
      const rCol=['rgba(255,200,0,0.9)','rgba(255,150,0,0.65)','rgba(255,80,0,0.35)'];
      for(let i=0;i<3;i++){
        ctx.beginPath(); ctx.arc(this.cx,this.cy,[12,9,6][i],0,Math.PI*2);
        ctx.strokeStyle=rCol[i]; ctx.lineWidth=3-i; ctx.stroke();
      }
      // Lightning bolt
      ctx.fillStyle='#FFD700';
      ctx.beginPath();
      ctx.moveTo(this.cx+3,y+8); ctx.lineTo(this.cx-6,this.cy+3);
      ctx.lineTo(this.cx+1,this.cy+3); ctx.lineTo(this.cx-3,y+h-8);
      ctx.lineTo(this.cx+6,this.cy-3); ctx.lineTo(this.cx-1,this.cy-3);
      ctx.closePath(); ctx.fill();
      // Vent grills
      ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1;
      for(let i=0;i<4;i++){ ctx.beginPath(); ctx.moveTo(x+5,y+h-16+i*3); ctx.lineTo(x+w-5,y+h-16+i*3); ctx.stroke(); }

    } else if (this.type === 'Tech Lab') {
      // Antenna array + science windows
      ctx.strokeStyle=accent; ctx.lineWidth=1.5;
      // Panel grid (scan lines)
      for(let gy=y+10;gy<y+h-8;gy+=8){ ctx.beginPath(); ctx.moveTo(x+6,gy); ctx.lineTo(x+w-6,gy); ctx.stroke(); }
      for(let gx=x+12;gx<x+w-10;gx+=12){ ctx.beginPath(); ctx.moveTo(gx,y+6); ctx.lineTo(gx,y+h-6); ctx.stroke(); }
      // Antenna tower
      ctx.strokeStyle=accent; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(x+w-8,y+h-4); ctx.lineTo(x+w-8,y-12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+w-18,y-8); ctx.lineTo(x+w+2,y-8); ctx.stroke(); // crossbar
      // Central computer terminal
      ctx.fillStyle=accent; ctx.fillRect(this.cx-10,this.cy-10,20,20);
      ctx.fillStyle=dark; ctx.fillRect(this.cx-7,this.cy-7,14,14);
      // Scan dot
      ctx.beginPath(); ctx.arc(this.cx,this.cy,3.5,0,Math.PI*2);
      ctx.fillStyle=C.allyGold; ctx.fill();
      // Dish at corner
      ctx.strokeStyle=accent; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(x+9,y+9,7,-Math.PI*0.8,Math.PI*0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+9,y+9); ctx.lineTo(x+13,y+6); ctx.stroke();

    } else if (this.type === 'Armoury') {
      // Armoury — shield emblem + weapon racks
      // Shield outline (main feature)
      const shX=this.cx, shY=this.cy-2, shW=22, shH=24;
      ctx.fillStyle=pl?'#0A1A40':'#400A0A';
      ctx.beginPath();
      ctx.moveTo(shX-shW/2,shY-shH/2); ctx.lineTo(shX+shW/2,shY-shH/2);
      ctx.lineTo(shX+shW/2,shY+shH*0.2); ctx.lineTo(shX,shY+shH/2);
      ctx.lineTo(shX-shW/2,shY+shH*0.2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=pl?C.allyAccent:'#FF8888'; ctx.lineWidth=1.5; ctx.stroke();
      // Shield boss (center circle)
      ctx.fillStyle=pl?C.allyGold:'#FFAAAA';
      ctx.beginPath(); ctx.arc(shX,shY-1,4,0,Math.PI*2); ctx.fill();
      // Rifle racks — two horizontal bars on left side
      ctx.strokeStyle=pl?C.allyDark:C.enemyDark; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(x+4,y+h-20); ctx.lineTo(x+4,y+8); ctx.stroke();
      // Diagonal rifle shapes
      ctx.strokeStyle=pl?C.allyChr:C.enemyLight; ctx.lineWidth=1;
      for(let i=0;i<3;i++){
        ctx.beginPath(); ctx.moveTo(x+6,y+10+i*9); ctx.lineTo(x+16,y+7+i*9); ctx.stroke();
      }
      // Stars/pips on right side
      ctx.fillStyle=pl?C.allyAccent:C.enemyAccent;
      for(let i=0;i<3;i++){
        ctx.beginPath(); ctx.arc(x+w-8,y+8+i*10,2.5,0,Math.PI*2); ctx.fill();
      }

    } else if (this.type === 'War Factory') {
      // Large industrial complex — factory floor + gantry crane
      ctx.fillStyle=accent;
      // Corner towers / smokestacks
      ctx.fillRect(x+4,y+4,16,18); ctx.fillRect(x+w-20,y+4,16,18);
      // Factory floor entrance (big horizontal door)
      ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(x+6,y+h-22,w-12,18);
      ctx.strokeStyle=dark; ctx.lineWidth=1; ctx.strokeRect(x+6,y+h-22,w-12,18);
      // Gantry crane arm
      ctx.strokeStyle=accent; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(x+8,y+h-22); ctx.lineTo(x+w-8,y+h-22); ctx.stroke(); // crane rail
      ctx.beginPath(); ctx.moveTo(this.cx+6,y+h-22); ctx.lineTo(this.cx+6,y+h-10); ctx.stroke(); // hoist
      // Smokestack emissions (small circles)
      ctx.fillStyle='rgba(100,100,100,0.3)';
      ctx.beginPath(); ctx.arc(x+12,y-2,4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+w-12,y-2,5,0,Math.PI*2); ctx.fill();
      // Factory badge
      ctx.fillStyle='#FF0000'; ctx.beginPath(); ctx.arc(this.cx,this.cy-5,9,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=dark;
      ctx.beginPath(); ctx.arc(this.cx-3,this.cy-7,2.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.cx+3,this.cy-7,2.5,0,Math.PI*2); ctx.fill();
      ctx.fillRect(this.cx-6,this.cy-1,4,5); ctx.fillRect(this.cx+2,this.cy-1,4,5);
      // HP bar for enemy war factory
      if (this.team==='enemy'&&this.hp < this.maxHp) {
        const pct=this.hp/this.maxHp, bx=x+6, bw=w-12;
        ctx.fillStyle='#111'; ctx.fillRect(bx,y+h+2,bw,5);
        ctx.fillStyle=pct>0.5?'#FF4400':'#FF0000'; ctx.fillRect(bx,y+h+2,bw*pct,5);
      }
    }

    if (this.selected) {
      ctx.strokeStyle=C.uiAccent; ctx.lineWidth=2;
      const pad=4; ctx.strokeRect(x-pad,y-pad,w+pad*2,h+pad*2);
      drawBrackets(ctx,x-pad,y-pad,w+pad*2,h+pad*2);
      if (this.rallyPoint && this.team==='player') {
        ctx.setLineDash([5,8]); ctx.strokeStyle='rgba(0,200,255,0.6)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(this.cx,this.cy); ctx.lineTo(this.rallyPoint.x,this.rallyPoint.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle='rgba(0,200,255,0.9)';
        ctx.fillRect(this.rallyPoint.x-2,this.rallyPoint.y-12,2,12);
        ctx.beginPath(); ctx.moveTo(this.rallyPoint.x,this.rallyPoint.y-12);
        ctx.lineTo(this.rallyPoint.x+10,this.rallyPoint.y-8); ctx.lineTo(this.rallyPoint.x,this.rallyPoint.y-4); ctx.fill();
      }
    }
    // Type label
    ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.font='bold 7px "Courier New"'; ctx.textAlign='center';
    ctx.fillText(this.type.toUpperCase(),this.cx,this.cy+3); ctx.textAlign='left';

    // ── Under-construction scaffold overlay ──────────────────
    if (this.buildPct < 1) {
      // Semi-transparent dark veil (reveals partial structure beneath)
      ctx.fillStyle=`rgba(0,0,0,${0.55 - this.buildPct*0.45})`;
      ctx.fillRect(x, y, w, h);
      // Diagonal scaffold stripes
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.strokeStyle='rgba(255,200,40,0.35)'; ctx.lineWidth=4;
      for (let i = -(w+h); i < (w+h); i += 14) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + h, y + h);
        ctx.stroke();
      }
      ctx.restore();
      // Scaffold poles (corners + midpoints)
      ctx.fillStyle='rgba(200,160,40,0.7)';
      ctx.fillRect(x-2,    y-2,    4, h+4);  // left
      ctx.fillRect(x+w-2,  y-2,    4, h+4);  // right
      ctx.fillRect(x-2,    y-2,    w+4, 4);  // top
      ctx.fillRect(x-2,    y+h-2,  w+4, 4);  // bottom
      // Progress bar (yellow fill inside black track)
      const bw = w + 4, bh = 6, bx = x - 2, by = y - 14;
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle='#FFD700';           ctx.fillRect(bx, by, bw * this.buildPct, bh);
      ctx.strokeStyle='rgba(255,200,0,0.5)'; ctx.lineWidth=1; ctx.strokeRect(bx, by, bw, bh);
      // "BUILDING..." label
      ctx.fillStyle='#FFD700'; ctx.font='bold 6px "Courier New"'; ctx.textAlign='center';
      ctx.fillText('BUILDING…', this.cx, by - 2);
      ctx.textAlign = 'left';
    }

    drawHpBar(ctx,this.cx,this.y-12,this.w+4,this.hp,this.maxHp);
  }
}

// ═══════════════════════════════════════════════════════════════
// TURRET
// ═══════════════════════════════════════════════════════════════
export type TurretVariant = 'standard' | 'anti-infantry' | 'anti-tank' | 'artillery';

export class Turret extends Building {
  atkDmg   = 32;
  atkRange = 175;
  atkRate  = 1.3;
  atkCd    = 0;
  atkTarget: Entity | null = null;
  barrel   = -Math.PI / 2;
  barrel2  = -Math.PI / 2;   // second barrel offset for AI variant
  disabled = false;
  projColor: string;
  variant:  TurretVariant = 'standard';

  constructor(cx: number, cy: number, team: Team = 'player') {
    super(cx, cy, 'Turret', team);
    this.projColor = team==='player' ? C.allyLight : C.enemyLight;
  }

  // ── Upgrade to a specialised variant ─────────────────────
  upgrade(v: TurretVariant) {
    this.variant = v;
    if (v === 'anti-infantry') {
      // Dual autocannons — rapid fire, ineffective vs armour
      this.atkDmg   = 14;   this.atkRange = 158;  this.atkRate  = 3.4;
      this.maxHp    = 420;  this.hp = Math.min(this.hp, 420);
      this.projColor = '#66FF99';
    } else if (v === 'anti-tank') {
      // Heavy AT cannon — slow, hard-hitting, punches armour
      this.atkDmg   = 90;   this.atkRange = 215;  this.atkRate  = 0.62;
      this.maxHp    = 560;  this.hp = Math.min(this.hp, 560);
      this.projColor = '#FF8800';
    } else if (v === 'artillery') {
      // Long-range howitzer — massive splash, devastates buildings and clusters
      this.atkDmg   = 140;  this.atkRange = 340;  this.atkRate  = 0.22;
      this.maxHp    = 480;  this.hp = Math.min(this.hp, 480);
      this.projColor = '#FFEE00';
    }
  }

  _variantDmg(target: Entity): number {
    const isArmored = target instanceof Tank || target instanceof HeavyTank ||
                      (target instanceof EnemyUnit && (target as EnemyUnit).isTank);
    if (this.variant === 'anti-infantry') return isArmored ? 0.28 : 1.0;
    if (this.variant === 'anti-tank')     return isArmored ? 1.65 : 0.42;
    if (this.variant === 'artillery')     return target instanceof Building ? 2.5 : 1.0;
    return 1.0;
  }

  update(dt: number, targets: Entity[], projectiles: Projectile[]) {
    super.update(dt, targets, projectiles);
    // Don't fire while still under construction
    if (this.buildPct < 1) { this.atkTarget=null; return; }
    if (this.disabled) { this.atkTarget=null; return; }
    if (this.atkCd>0) this.atkCd -= dt;
    if (!this.atkTarget?.isAlive()) {
      this.atkTarget=null;
      let best:Entity|null=null,bestD=this.atkRange;
      for(const t of targets){if(!t.isAlive())continue;const d=hypot(this.cx,this.cy,t.cx,t.cy);if(d<bestD){bestD=d;best=t;}}
      this.atkTarget=best;
    }
    if (this.atkTarget) {
      const dx=this.atkTarget.cx-this.cx, dy=this.atkTarget.cy-this.cy;
      const targetAng=Math.atan2(dy,dx);
      const lerpSpeed=this.variant==='anti-tank'?3.5:this.variant==='artillery'?2.5:5;
      this.barrel=lerpAngle(this.barrel,targetAng,Math.min(1,dt*lerpSpeed));
      this.barrel2=lerpAngle(this.barrel2,targetAng+0.18,Math.min(1,dt*lerpSpeed));
      let diff=targetAng-this.barrel;
      while(diff>Math.PI)diff-=Math.PI*2; while(diff<-Math.PI)diff+=Math.PI*2;
      if(this.atkCd<=0 && Math.abs(diff)<0.4){
        const d=hypot(this.cx,this.cy,this.atkTarget.cx,this.atkTarget.cy);
        if(d<=this.atkRange){
          const dmg=this.atkDmg*this._variantDmg(this.atkTarget);
          const proj=new Projectile(this.cx,this.cy,this.atkTarget,dmg,
            this.variant==='artillery'?260:480,this.projColor);
          if(this.variant==='artillery') proj.splash=75;
          proj.shooterTeam=this.team;
          projectiles.push(proj);
          this.atkCd=1/this.atkRate;
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const {x,y,w,h}=this;
    const pl=this.team==='player';
    const accent=pl?C.allyAccent:C.enemyAccent;

    // ── Sandbag / platform base ────────────────────────────
    const baseColor = this._flash>0?'#FFF'
      : this.variant==='anti-infantry' ? (pl?'#163A1A':'#3A1414')
      : this.variant==='anti-tank'     ? (pl?'#102030':'#301010')
      : this.variant==='artillery'     ? (pl?'#2A2000':'#2A1800')
      : (pl?C.allyDark:C.enemyDark);

    // Drop shadow
    ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(x+5,y+5,w,h);

    // Platform base (octagonal-ish: cut corners)
    ctx.fillStyle=baseColor;
    ctx.beginPath();
    const cut=5;
    ctx.moveTo(x+cut,y); ctx.lineTo(x+w-cut,y); ctx.lineTo(x+w,y+cut);
    ctx.lineTo(x+w,y+h-cut); ctx.lineTo(x+w-cut,y+h); ctx.lineTo(x+cut,y+h);
    ctx.lineTo(x,y+h-cut); ctx.lineTo(x,y+cut); ctx.closePath(); ctx.fill();

    // Sandbag ring (only for standard — AI/AT get reinforced concrete look)
    if (this.variant==='standard') {
      const sbColor='#7A6A48';
      for(let i=0;i<8;i++){
        const a=i/8*Math.PI*2, bx=this.cx+Math.cos(a)*13, by=this.cy+Math.sin(a)*13;
        ctx.beginPath(); ctx.ellipse(bx,by,4.5,3,a,0,Math.PI*2);
        ctx.fillStyle=sbColor; ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=0.7; ctx.stroke();
      }
    } else if (this.variant==='artillery') {
      // Wide blast-shield ring (larger than standard)
      ctx.beginPath(); ctx.arc(this.cx,this.cy,15,0,Math.PI*2);
      ctx.strokeStyle='#664400'; ctx.lineWidth=4; ctx.stroke();
      ctx.strokeStyle='rgba(255,200,0,0.12)'; ctx.lineWidth=1.5; ctx.stroke();
    } else {
      // Reinforced concrete ring
      const ringColor=this.variant==='anti-tank'?'#1A2A3A':'#1A3A20';
      ctx.beginPath(); ctx.arc(this.cx,this.cy,13,0,Math.PI*2);
      ctx.strokeStyle=ringColor; ctx.lineWidth=3.5; ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1; ctx.stroke();
    }

    // Range ring when selected
    if (this.selected) {
      const ringCol=this.variant==='anti-infantry'?'rgba(100,255,150,0.15)'
        :this.variant==='anti-tank'?'rgba(255,130,0,0.15)'
        :this.variant==='artillery'?'rgba(255,220,0,0.12)'
        :'rgba(0,255,80,0.15)';
      ctx.beginPath(); ctx.arc(this.cx,this.cy,this.atkRange,0,Math.PI*2);
      ctx.strokeStyle=ringCol; ctx.lineWidth=1; ctx.setLineDash([5,8]); ctx.stroke(); ctx.setLineDash([]);
      drawBrackets(ctx,x-4,y-4,w+8,h+8,7);
      ctx.strokeStyle=C.uiAccent; ctx.lineWidth=2; ctx.strokeRect(x-4,y-4,w+8,h+8);
    }

    // ── Turret head ────────────────────────────────────────
    const headColor=this.disabled?'#333'
      : this.variant==='anti-infantry'?(pl?'#22AA44':'#AA2222')
      : this.variant==='anti-tank'    ?(pl?'#1A3A6A':'#6A1A1A')
      : this.variant==='artillery'    ?(pl?'#886600':'#664400')
      : accent;

    ctx.beginPath(); ctx.arc(this.cx,this.cy,10,0,Math.PI*2);
    ctx.fillStyle=headColor; ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=1.5; ctx.stroke();
    // Head highlight
    ctx.beginPath(); ctx.arc(this.cx-2,this.cy-2,4,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fill();

    // ── Barrels ────────────────────────────────────────────
    ctx.save(); ctx.translate(this.cx,this.cy);

    if (this.variant==='anti-infantry') {
      // Dual autocannon barrels (parallel, offset)
      for(const off of [-3,3]){
        ctx.rotate(this.barrel - (this.barrel2 - this.barrel)*0.5 + off*0.001);
        ctx.save();
        ctx.rotate(off * 0.001); // tiny spread
        const bCol=this.disabled?'#555':'#CCEECC';
        ctx.fillStyle=bCol; ctx.fillRect(0, off-1.5, 24, 3);
        ctx.fillStyle=this.disabled?'#444':'#AACCAA';
        ctx.fillRect(20, off-2, 4, 4); // muzzle block
        ctx.restore();
        ctx.rotate(-(this.barrel - (this.barrel2 - this.barrel)*0.5 + off*0.001));
      }
      // Re-draw aimed
      ctx.rotate(this.barrel);
      ctx.fillStyle=this.disabled?'#555':'#CCEECC';
      ctx.fillRect(1,-4,23,3.5); ctx.fillRect(1,0.5,23,3.5);
      ctx.fillStyle=this.disabled?'#444':'#99CC99';
      ctx.fillRect(22,-4.5,3,8.5);

    } else if (this.variant==='anti-tank') {
      // Long heavy AT cannon, thick barrel with muzzle brake
      ctx.rotate(this.barrel);
      ctx.fillStyle=this.disabled?'#555':'#AABBCC';
      ctx.fillRect(0,-4.5,34,9); // thick barrel
      ctx.fillStyle=this.disabled?'#444':'#8899AA';
      ctx.fillRect(28,-6,6,12); // muzzle brake
      ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(0,-1,34,2); // seam
      ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(2,-4.5,30,2.5);

    } else if (this.variant==='artillery') {
      // Massive howitzer — wide elevated barrel with distinctive muzzle bell
      ctx.rotate(this.barrel);
      ctx.fillStyle=this.disabled?'#444':'#CCAA44';
      ctx.fillRect(0,-6,38,12);    // thick barrel
      ctx.fillStyle=this.disabled?'#333':'#AA8830';
      ctx.fillRect(32,-8,8,16);    // muzzle bell
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,-1.5,38,3);  // centre seam
      ctx.fillStyle='rgba(255,220,0,0.25)'; ctx.fillRect(2,-5,34,3);  // highlight
      // Recoil shield behind barrel
      ctx.fillStyle=this.disabled?'#333':'#886622';
      ctx.fillRect(-10,-9,12,18);

    } else {
      // Standard single barrel
      ctx.rotate(this.barrel);
      ctx.fillStyle=this.disabled?'#555':'#DDDDDD'; ctx.fillRect(0,-2.5,24,5);
      ctx.fillStyle=this.disabled?'#444':'#AAAAAA'; ctx.fillRect(20,-3,5,6);
    }
    ctx.restore();

    // Variant badge
    if (this.variant!=='standard' && this.team==='player') {
      const badge=this.variant==='anti-infantry'?'AI':this.variant==='anti-tank'?'AT':'ART';
      const bCol=this.variant==='anti-infantry'?'#22FF66':this.variant==='anti-tank'?'#FF8800':'#FFEE00';
      ctx.fillStyle=bCol; ctx.font='bold 6px "Courier New"'; ctx.textAlign='center';
      ctx.fillText(badge,this.cx,y+h+10); ctx.textAlign='left';
    }

    // ── Under-construction scaffold (same as Building) ───────────
    if (this.buildPct < 1) {
      ctx.fillStyle=`rgba(0,0,0,${0.55 - this.buildPct*0.45})`; ctx.fillRect(x,y,w,h);
      ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
      ctx.strokeStyle='rgba(255,200,40,0.35)'; ctx.lineWidth=4;
      for(let i=-(w+h);i<(w+h);i+=14){ctx.beginPath();ctx.moveTo(x+i,y);ctx.lineTo(x+i+h,y+h);ctx.stroke();}
      ctx.restore();
      ctx.fillStyle='rgba(200,160,40,0.7)';
      ctx.fillRect(x-2,y-2,4,h+4); ctx.fillRect(x+w-2,y-2,4,h+4);
      ctx.fillRect(x-2,y-2,w+4,4); ctx.fillRect(x-2,y+h-2,w+4,4);
      const bw=w+4,bh=6,bx=x-2,by=y-16;
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle='#FFD700'; ctx.fillRect(bx,by,bw*this.buildPct,bh);
      ctx.strokeStyle='rgba(255,200,0,0.5)'; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh);
      ctx.fillStyle='#FFD700'; ctx.font='bold 6px "Courier New"'; ctx.textAlign='center';
      ctx.fillText('BUILDING…',this.cx,by-2); ctx.textAlign='left';
    }

    drawHpBar(ctx,this.cx,this.y-13,this.w+6,this.hp,this.maxHp);
    if(this.disabled){
      ctx.fillStyle='rgba(255,80,0,0.9)'; ctx.font='bold 7px "Courier New"'; ctx.textAlign='center';
      ctx.fillText('NO PWR',this.cx,y-4); ctx.textAlign='left';
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
  radius:    number = 52;
  regenRate: number = 2.8;
  isRich:    boolean = false;
  private _crystals: Array<{x:number;y:number;h:number;w:number;angle:number}>=[];

  constructor(cx: number, cy: number) {
    this.id=nextId(); this.cx=cx; this.cy=cy;
    // 30% chance of a rich (high-yield) field
    this.isRich = Math.random() < 0.30;
    if (this.isRich) {
      this.capacity = rnd(3500, 5500);
      this.radius   = 64;
    } else {
      this.capacity = rnd(1500, 2800);
    }
    this.remaining=this.capacity;
    const n = this.isRich ? rndi(18,26) : rndi(12,20);
    const spread = this.isRich ? 44 : 36;
    for(let i=0;i<n;i++) this._crystals.push({x:cx+rnd(-spread,spread),y:cy+rnd(-spread,spread),h:rnd(this.isRich?18:12,this.isRich?32:24),w:rnd(4,9),angle:rnd(-0.3,0.3)});
  }

  isEmpty()  { return this.remaining<=0; }
  pct()      { return clamp(this.remaining/this.capacity,0,1); }
  harvest(dt:number,rate:number){ const amt=Math.min(rate*dt,this.remaining); this.remaining-=amt; return amt; }
  regen(dt:number){ if(this.remaining<this.capacity) this.remaining=Math.min(this.capacity,this.remaining+this.regenRate*dt); }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    const p=this.pct(); if(p<=0)return;
    // Rich fields get a warm golden-green aura
    const stainAlpha = this.isRich ? 0.22*p : 0.13*p;
    const stainColor = this.isRich ? `rgba(120,220,0,${stainAlpha})` : `rgba(0,200,70,${stainAlpha})`;
    const stain=ctx.createRadialGradient(this.cx,this.cy,0,this.cx,this.cy,this.radius*p);
    stain.addColorStop(0,stainColor); stain.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=stain; ctx.beginPath(); ctx.arc(this.cx,this.cy,this.radius*p,0,Math.PI*2); ctx.fill();
    // Animated pulse (shimmer) — rich fields pulse faster
    const pulse = this.isRich ? 0.80+0.20*Math.sin(t*3.0) : 0.85+0.15*Math.sin(t*2.2);
    const green = this.isRich ? Math.floor(160+p*95) : Math.floor(120+p*135);
    const rChannel = this.isRich ? Math.floor(80+p*80) : 0;  // yellow-gold tinge for rich
    for(const c of this._crystals){
      const sh=c.h*p*pulse; ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.angle);
      ctx.fillStyle=`rgb(${rChannel},${green},${Math.floor(green*0.28)})`;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-c.w/2,sh); ctx.lineTo(c.w/2,sh); ctx.closePath(); ctx.fill();
      const r2=this.isRich?Math.min(255,rChannel+40):Math.floor(green*0.3);
      ctx.fillStyle=`rgba(${r2},${Math.min(255,green+90)},${Math.floor(green*0.5)},0.7)`;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-c.w/4,sh*0.45); ctx.lineTo(c.w/4,sh*0.45); ctx.closePath(); ctx.fill();
      // Inner glow shimmer
      ctx.globalAlpha=0.3+0.2*Math.sin(t*3.1+c.x);
      ctx.fillStyle=this.isRich?`rgba(180,255,60,0.6)`:`rgba(0,255,120,0.5)`;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-c.w/6,sh*0.3); ctx.lineTo(c.w/6,sh*0.3); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1;
      ctx.restore();
    }
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(this.cx-24,this.cy+this.radius-3,48,4);
    const barColor = this.isRich ? `rgba(180,${Math.floor(200*p+40)},0,0.9)` : `rgba(0,${Math.floor(200*p+40)},60,0.9)`;
    ctx.fillStyle=barColor; ctx.fillRect(this.cx-24,this.cy+this.radius-3,48*p,4);
    // Rich field label
    if (this.isRich) {
      ctx.fillStyle='rgba(200,220,0,0.85)'; ctx.font='bold 7px "Courier New"'; ctx.textAlign='center';
      ctx.fillText('★RICH', this.cx, this.cy+this.radius+10); ctx.textAlign='left';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// CAPTURE NODE
// ═══════════════════════════════════════════════════════════════
export class CaptureNode {
  id:           number;
  cx:           number; cy: number;
  radius:       number = 50;
  team:         'player'|'enemy'|'neutral' = 'neutral';
  progress:     number = 0;
  income:       number;
  isCenter:     boolean;
  isBlackMarket:boolean;
  isRadar:      boolean;
  isBeachGun:   boolean;
  isPark:       boolean;
  isEngineer:   boolean;
  holdTimer:    number = 0;
  label:        string;
  blackMarketClaimed: boolean = false;
  beachGunSpawned:    boolean = false;
  radarActivated:     boolean = false;

  constructor(cx:number,cy:number,label:string,income=4,isCenter=false,isBlackMarket=false,isRadar=false,isBeachGun=false,isPark=false,isEngineer=false){
    this.id=nextId(); this.cx=cx; this.cy=cy; this.label=label;
    this.income=income; this.isCenter=isCenter; this.isBlackMarket=isBlackMarket;
    this.isRadar=isRadar; this.isBeachGun=isBeachGun;
    this.isPark=isPark; this.isEngineer=isEngineer;
  }

  update(dt:number,pUnits:Unit[],eUnits:Unit[]){
    const pCount=pUnits.filter(u=>hypot(u.x,u.y,this.cx,this.cy)<this.radius&&u.isAlive()).length;
    const eCount=eUnits.filter(u=>hypot(u.x,u.y,this.cx,this.cy)<this.radius&&u.isAlive()).length;
    const RATE=0.14;
    if(pCount>eCount) this.progress=clamp(this.progress+RATE*(pCount-eCount)*dt,-1,1);
    else if(eCount>pCount) this.progress=clamp(this.progress-RATE*(eCount-pCount)*dt,-1,1);
    this.team=this.progress>=1?'player':this.progress<=-1?'enemy':'neutral';
    if(this.isCenter){
      if(this.team==='player') this.holdTimer=Math.min(HOLD_WIN_TIME,this.holdTimer+dt);
      else                      this.holdTimer=Math.max(0,this.holdTimer-dt*0.5);
    }
  }

  draw(ctx:CanvasRenderingContext2D,t:number){
    const col=this.isBlackMarket&&this.team==='player'?C.blackMarket
             :this.team==='player'?C.capturePlayer
             :this.team==='enemy' ?C.captureEnemy
             :this.isBlackMarket  ?'#AA8800'
             :C.captureNeutral;

    // ── City Park — green grass terrain under the node ─────
    if (this.isPark) {
      // Grass base
      const grassGrad=ctx.createRadialGradient(this.cx,this.cy,0,this.cx,this.cy,this.radius*1.3);
      grassGrad.addColorStop(0,'rgba(20,90,20,0.92)');
      grassGrad.addColorStop(0.6,'rgba(14,70,14,0.80)');
      grassGrad.addColorStop(1,'rgba(8,40,8,0.0)');
      ctx.beginPath(); ctx.arc(this.cx,this.cy,this.radius*1.3,0,Math.PI*2);
      ctx.fillStyle=grassGrad; ctx.fill();
      // Animated grass blades (short radiating lines)
      const bladeAnim=Math.sin(t*1.2)*0.06;
      ctx.strokeStyle='rgba(50,160,50,0.5)'; ctx.lineWidth=1;
      for(let i=0;i<12;i++){
        const ang=i/12*Math.PI*2+bladeAnim;
        const r1=this.radius*0.25, r2=this.radius*0.85;
        ctx.beginPath();
        ctx.moveTo(this.cx+Math.cos(ang)*r1,this.cy+Math.sin(ang)*r1);
        ctx.lineTo(this.cx+Math.cos(ang)*r2,this.cy+Math.sin(ang)*r2);
        ctx.stroke();
      }
      // Scattered tree dots
      const treePos=[[0.55,0.2],[0.7,0.6],[0.5,0.78],[0.2,0.65],[0.3,0.25],[0.65,0.45]];
      for(const[fr,fa] of treePos){
        const ang=fa*Math.PI*2, r=fr*this.radius*0.8;
        const tx=this.cx+Math.cos(ang)*r, ty=this.cy+Math.sin(ang)*r;
        ctx.beginPath(); ctx.arc(tx,ty,5,0,Math.PI*2);
        ctx.fillStyle='rgba(10,80,10,0.85)'; ctx.fill();
        ctx.beginPath(); ctx.arc(tx,ty,3.5,0,Math.PI*2);
        ctx.fillStyle='rgba(30,140,30,0.6)'; ctx.fill();
      }
    }

    const pulse=0.55+0.2*Math.sin(t*2.5+this.id);
    ctx.beginPath(); ctx.arc(this.cx,this.cy,this.radius,0,Math.PI*2);
    ctx.fillStyle=col+Math.round(pulse*28).toString(16).padStart(2,'0'); ctx.fill();
    ctx.strokeStyle=col+'AA'; ctx.lineWidth=2; ctx.setLineDash([8,6]); ctx.stroke(); ctx.setLineDash([]);

    if(Math.abs(this.progress)>0.02){
      const pCol=this.progress>0?C.capturePlayer:C.captureEnemy;
      ctx.beginPath(); ctx.arc(this.cx,this.cy,this.radius+8,-Math.PI/2,-Math.PI/2+Math.abs(this.progress)*Math.PI*2);
      ctx.strokeStyle=pCol; ctx.lineWidth=4; ctx.stroke();
    }

    ctx.fillStyle=col; ctx.shadowBlur=14; ctx.shadowColor=col;
    ctx.fillRect(this.cx-3,this.cy-22,6,22);
    ctx.beginPath(); ctx.moveTo(this.cx,this.cy-34); ctx.lineTo(this.cx-7,this.cy-22); ctx.lineTo(this.cx+7,this.cy-22); ctx.fill();
    ctx.shadowBlur=0;

    if(this.isCenter&&this.holdTimer>0){
      ctx.beginPath(); ctx.arc(this.cx,this.cy,this.radius+16,-Math.PI/2,-Math.PI/2+(this.holdTimer/HOLD_WIN_TIME)*Math.PI*2);
      ctx.strokeStyle='#FFD700'; ctx.lineWidth=3; ctx.stroke();
    }

    ctx.fillStyle='#FFFFFF'; ctx.font='bold 7px "Courier New"'; ctx.textAlign='center';
    const nodeLabel = this.isBlackMarket?'🏴 '+this.label
                    : this.isRadar   ?'📡 '+this.label
                    : this.isBeachGun?'🔫 '+this.label
                    : this.isPark    ?'🌳 '+this.label
                    : this.isEngineer?'🔧 '+this.label
                    : this.label;
    ctx.fillText(nodeLabel,this.cx,this.cy+this.radius+14);
    if(this.team!=='neutral'){ctx.fillStyle=col; ctx.fillText(this.team.toUpperCase(),this.cx,this.cy+5);}
    // Special node icons
    if(this.isRadar){
      ctx.fillStyle=this.team==='player'?'#00FFCC':'#888'; ctx.font='bold 10px "Courier New"'; ctx.textAlign='center';
      ctx.fillText('📡',this.cx,this.cy+4); ctx.textAlign='left';
    }
    if(this.isBeachGun&&!this.beachGunSpawned){
      ctx.fillStyle=this.team==='player'?'#FF6600':'#888'; ctx.font='bold 10px "Courier New"'; ctx.textAlign='center';
      ctx.fillText('🔫',this.cx,this.cy+4); ctx.textAlign='left';
    }
    if(this.isPark){
      ctx.fillStyle=this.team==='player'?'#44FF44':'#226622'; ctx.font='bold 10px "Courier New"'; ctx.textAlign='center';
      ctx.fillText('🌳',this.cx,this.cy+4); ctx.textAlign='left';
    }
    if(this.isEngineer){
      ctx.fillStyle=this.team==='player'?'#FFCC44':'#887700'; ctx.font='bold 10px "Courier New"'; ctx.textAlign='center';
      ctx.fillText('🔧',this.cx,this.cy+4); ctx.textAlign='left';
    }
    ctx.textAlign='left';
  }
}

// ═══════════════════════════════════════════════════════════════
// PROJECTILE
// ═══════════════════════════════════════════════════════════════
export class Projectile {
  x:number;y:number;
  target:   Entity;
  dmg:      number;
  speed:    number;
  color:    string;
  dead:     boolean=false;
  splash:   number=0;   // >0 = AOE radius
  firedBy:  Unit|null=null;
  shooterTeam: Team|null=null;  // for turret splash (no circular Unit ref needed)
  private trail:Array<{x:number;y:number}>=[];

  constructor(sx:number,sy:number,target:Entity,dmg:number,spd:number,color:string){
    this.x=sx;this.y=sy;this.target=target;this.dmg=dmg;this.speed=spd;this.color=color;
  }

  update(dt:number){
    if(!this.target.isAlive()){this.dead=true;return;}
    this.trail.push({x:this.x,y:this.y});
    if(this.trail.length>6)this.trail.shift();
    const dx=this.target.cx-this.x,dy=this.target.cy-this.y;
    const d=Math.hypot(dx,dy);
    if(d<8){
      const prevHp=this.target.hp;
      const vetBonus=this.firedBy?this.firedBy.veteranBonus:1;
      // ── Flanking multiplier ──────────────────────────────────
      // Armored vehicles take extra damage from side (+25%) or rear (+40%).
      // Attack direction = vector FROM the target TOWARD where the shot came from.
      let flankMult=1.0;
      if(this.target instanceof Unit){
        const isArmored=(this.target instanceof Tank||this.target instanceof HeavyTank||
                         (this.target instanceof EnemyUnit&&(this.target as EnemyUnit).isTank));
        if(isArmored){
          const atkDir=Math.atan2(this.y-this.target.cy,this.x-this.target.cx);
          let diff=atkDir-this.target.angle;
          while(diff>Math.PI)diff-=Math.PI*2;
          while(diff<-Math.PI)diff+=Math.PI*2;
          const absD=Math.abs(diff);
          if(absD>2.7)      flankMult=1.40;  // rear  hit +40%
          else if(absD>1.85)flankMult=1.25;  // side  hit +25%
        }
      }
      this.target.takeDmg(this.dmg*vetBonus*flankMult);
      // Veteran kill tracking
      if(prevHp>0&&!this.target.isAlive()&&this.firedBy){
        this.firedBy.kills++;
      }
      this.dead=true;
    } else {
      this.x+=(dx/d)*this.speed*dt;
      this.y+=(dy/d)*this.speed*dt;
    }
  }

  draw(ctx:CanvasRenderingContext2D){
    for(let i=0;i<this.trail.length;i++){
      const a=(i/this.trail.length)*0.55;
      ctx.beginPath(); ctx.arc(this.trail[i].x,this.trail[i].y,2.5,0,Math.PI*2);
      ctx.fillStyle=hexA(this.color,a); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(this.x,this.y,3.5,0,Math.PI*2); ctx.fillStyle=this.color; ctx.fill();
    ctx.beginPath(); ctx.arc(this.x,this.y,6,0,Math.PI*2); ctx.fillStyle=hexA(this.color,0.2); ctx.fill();
    if(this.splash>0){
      // Grenadier shell looks bigger
      ctx.beginPath(); ctx.arc(this.x,this.y,5,0,Math.PI*2); ctx.fillStyle='#FF8800'; ctx.fill();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// UNIT – base
// ═══════════════════════════════════════════════════════════════
export class Unit extends Entity {
  x:number;y:number;
  radius:  number=8;
  speed:   number=42;   // base infantry speed
  angle:   number=0;
  _flash:  number=0;
  _speedMult: number=1;  // power / suppress modifier

  moveTarget: {x:number;y:number}|null=null;
  atkTarget:  Entity|null=null;
  atkDmg:  number=15;
  atkRange:number=55;
  atkCd:   number=0;
  atkRate: number=1.5;
  projColor: string;
  autoAtk: boolean=true;
  autoAtkRange: number=140;

  guardPos:   {x:number;y:number}|null=null;
  guardRadius = 90;
  retreating: boolean=false;

  // ── Veterancy ─────────────────────────────────────────────
  kills: number=0;
  get veteranBonus(): number { return this.kills>=5?1.2:this.kills>=2?1.08:1; }
  get isVeteran(): boolean   { return this.kills>=5; }
  get isCombatHardened(): boolean { return this.kills>=2; }

  // ── Suppression ───────────────────────────────────────────
  _suppressTimer: number=0;
  get suppressed(): boolean { return this._suppressTimer>0; }

  // ── Entrench ──────────────────────────────────────────────
  _stillTimer:  number=0;
  entrenched:   boolean=false;
  canEntrench:  boolean=false;  // enabled by Armoury upgrade
  readonly ENTRENCH_TIME = 8;   // seconds to dig in

  _game: GameRef|null=null;

  constructor(x:number,y:number,team:Team){
    super(team,100);
    this.x=x;this.y=y;
    this.projColor=team==='player'?C.allyLight:C.enemyLight;
  }

  get cx(){return this.x;}
  get cy(){return this.y;}

  contains(px:number,py:number){ return hypot(px,py,this.x,this.y)<=this.radius+3; }
  overlapsRect(rx:number,ry:number,rw:number,rh:number){
    return this.x>=rx&&this.x<=rx+rw&&this.y>=ry&&this.y<=ry+rh;
  }

  moveTo(tx:number,ty:number){ this.moveTarget={x:tx,y:ty}; this.atkTarget=null; this.guardPos=null; this.retreating=false; this._stillTimer=0; this.entrenched=false; }
  attack(t:Entity){ this.atkTarget=t; this.moveTarget=null; this._stillTimer=0; this.entrenched=false; }
  stop()  { this.moveTarget=null; this.atkTarget=null; this.retreating=false; }
  guard() { this.guardPos={x:this.x,y:this.y}; this.atkTarget=null; this.moveTarget=null; this.retreating=false; }

  takeDmg(d:number){
    if(this._game?.terrain&&!(this instanceof Tank)&&!(this instanceof HeavyTank)){
      const cover=this._game.terrain.coverMult(this.x,this.y);
      d*=(1-cover);
    }
    // Entrench: 40% damage reduction while dug in
    if(this.entrenched) d*=0.60;
    super.takeDmg(d);
    this._flash=0.07;
    // Suppression: heavy fire slows you down
    if(d>8) this._suppressTimer=Math.min(2.5,this._suppressTimer+0.6);
  }

  update(dt:number,allUnits:Unit[],projectiles:Projectile[]){
    if(this.atkCd>0) this.atkCd-=dt;
    if(this._flash>0) this._flash-=dt;
    if(this._suppressTimer>0) this._suppressTimer-=dt;

    // Entrench: accumulate still-timer when fully idle (no orders, not retreating)
    if(this.canEntrench){
      const isIdle=!this.moveTarget&&!this.atkTarget&&!this.retreating;
      if(isIdle){
        this._stillTimer+=dt;
        if(this._stillTimer>=this.ENTRENCH_TIME) this.entrenched=true;
      } else {
        if(this.entrenched){ this.entrenched=false; }
        this._stillTimer=0;
      }
    }

    if(this.retreating&&!this.moveTarget){ this.retreating=false; this.autoAtk=true; }

    if(this.atkTarget){
      if(!this.atkTarget.isAlive()){this.atkTarget=null;return;}
      const d=hypot(this.x,this.y,this.atkTarget.cx,this.atkTarget.cy);
      const rng=this.atkRange*(this._game?.terrain.rangeMult(this.x,this.y)??1);
      if(d>rng){ this._towards(this.atkTarget.cx,this.atkTarget.cy,dt); }
      else if(this.atkCd<=0){
        const p=this._makeProjectile(this.atkTarget);
        projectiles.push(p);
        this.atkCd=1/this.atkRate; this._flash=0.07;
      }
    } else if(this.moveTarget){
      const d=hypot(this.x,this.y,this.moveTarget.x,this.moveTarget.y);
      if(d>3) this._towards(this.moveTarget.x,this.moveTarget.y,dt);
      else    {this.moveTarget=null;this.retreating=false;}
    } else if(this.guardPos){
      const d=hypot(this.x,this.y,this.guardPos.x,this.guardPos.y);
      if(d>8) this._towards(this.guardPos.x,this.guardPos.y,dt);
    }

    this._separate(allUnits);
    this.x=clamp(this.x,this.radius,MAP_W-this.radius);
    this.y=clamp(this.y,this.radius,MAP_H-this.radius);
  }

  // ── Rock-Paper-Scissors damage multiplier ─────────────────
  // Infantry: weak vs armour, fine vs infantry.
  targetMult(t: Entity): number {
    if (t instanceof Tank || t instanceof HeavyTank) return 0.50;
    // EnemyUnit tanks checked by isTank flag (avoid circular refs at class level)
    if (t instanceof EnemyUnit && (t as EnemyUnit).isTank) return 0.50;
    return 1.0;
  }

  _makeProjectile(target:Entity): Projectile {
    const dmg = this.atkDmg * this.targetMult(target);
    const p=new Projectile(this.x,this.y,target,dmg,420,this.projColor);
    p.firedBy=this;
    return p;
  }

  _towards(tx:number,ty:number,dt:number){
    const dx=tx-this.x,dy=ty-this.y;
    const d=Math.hypot(dx,dy); if(d<0.1)return;
    this.angle=Math.atan2(dy,dx);
    const terr=this._game?.terrain;
    const sm=terr?.speedMult(this.x,this.y)??1;
    const suppress=this._suppressTimer>0?0.5:1;
    const spd=this.speed*sm*this._speedMult*suppress;
    const nx=this.x+(dx/d)*spd*dt;
    const ny=this.y+(dy/d)*spd*dt;
    // Impassable cliff collision — axis-aligned slide
    if(terr?.isImpassable(nx,ny)){
      if(!terr.isImpassable(nx,this.y)) this.x=nx;
      else if(!terr.isImpassable(this.x,ny)) this.y=ny;
      // both axes blocked — unit stays put
    } else {
      this.x=nx; this.y=ny;
    }
  }

  _separate(units:Unit[]){
    for(const o of units){
      if(o===this)continue;
      const dx=this.x-o.x,dy=this.y-o.y;
      const d=Math.hypot(dx,dy);
      if(d<0.01)continue;
      const hard=(this.radius+o.radius)*1.02;  // no-overlap zone (tight)
      const soft=(this.radius+o.radius)*1.7;   // personal-space zone (reduced from 2.8)
      if(d<hard){
        const push=(hard-d)*0.30;
        this.x+=(dx/d)*push; this.y+=(dy/d)*push;
      } else if(d<soft){
        const push=(soft-d)*0.018;              // gentler drift (was 0.045)
        this.x+=(dx/d)*push; this.y+=(dy/d)*push;
      }
    }
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){
      ctx.beginPath();ctx.arc(this.x,this.y,4,0,Math.PI*2);
      ctx.fillStyle=this.team==='player'?C.allyAccent:C.enemyAccent; ctx.fill(); return;
    }
    const pl=this.team==='player';
    const r=this.radius;
    const inCover=this._game?.terrain.coverMult(this.x,this.y)??0;

    // Ambient glow
    if(!this._flash){
      ctx.shadowBlur=8; ctx.shadowColor=pl?C.allyAccent:C.enemyAccent;
      ctx.beginPath(); ctx.arc(this.x,this.y,r+2,0,Math.PI*2);
      ctx.fillStyle=pl?'rgba(68,170,255,0.14)':'rgba(255,85,34,0.14)'; ctx.fill();
      ctx.shadowBlur=0;
    }

    // Draw soldier in local (rotated) space
    ctx.save();
    ctx.translate(this.x,this.y);
    ctx.rotate(this.angle);

    // Drop shadow
    ctx.beginPath(); ctx.ellipse(1.5,1.5,r*0.8,r*0.65,0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fill();

    // Body (upright oval — slightly taller than wide)
    const bodyCol=this._flash>0?'#FFF':(pl?C.allyBase:C.enemyBase);
    ctx.beginPath(); ctx.ellipse(0,0,r*0.65,r*0.85,0,0,Math.PI*2);
    ctx.fillStyle=bodyCol; ctx.fill();
    // Webbing / vest detail
    ctx.fillStyle=pl?C.allyDark:C.enemyDark; ctx.globalAlpha=0.55;
    ctx.beginPath(); ctx.ellipse(-r*0.05,r*0.1,r*0.38,r*0.52,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    // Outline
    ctx.strokeStyle=pl?C.allyLight:C.enemyLight; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.ellipse(0,0,r*0.65,r*0.85,0,0,Math.PI*2); ctx.stroke();

    // Helmet (dome on forward side — +X in local space)
    const helmCol=this._flash>0?'#EEE':(pl?'#1A4088':'#701010');
    ctx.fillStyle=helmCol;
    ctx.beginPath(); ctx.arc(r*0.28,-r*0.50,r*0.46,Math.PI*0.15,Math.PI*1.15); ctx.closePath(); ctx.fill();
    // Helmet brim
    ctx.strokeStyle=pl?'#1A3060':'#501010'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(r*0.28,-r*0.50,r*0.46,Math.PI*0.15,Math.PI*1.15); ctx.stroke();

    // Rifle (thin bar extending forward = +X)
    ctx.fillStyle=this._flash>0?'#FFF':'#4A4A3A';
    ctx.fillRect(r*0.38,-r*0.12,r*1.3,r*0.24);
    // Barrel tip
    ctx.fillStyle=this._flash>0?'#FFF':'#2A2A22';
    ctx.fillRect(r*1.50,-r*0.09,r*0.18,r*0.18);

    // Cover camouflage overlay
    if(inCover>0&&!this._flash){
      ctx.globalAlpha=inCover*0.45; ctx.fillStyle='#001A00';
      ctx.beginPath(); ctx.ellipse(0,0,r*0.65,r*0.85,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
    ctx.restore();

    // Retreat arrow
    if(this.retreating){
      ctx.strokeStyle='#FFAA00';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(this.x-8,this.y);ctx.lineTo(this.x,this.y-12);ctx.stroke();
    }
    // Suppression
    if(this._suppressTimer>0){
      ctx.fillStyle='rgba(255,200,0,0.7)';ctx.font='6px "Courier New"';ctx.textAlign='center';
      ctx.fillText('SUP',this.x,this.y-r-3);ctx.textAlign='left';
    }
    // Entrench indicator: growing arc → full ring when entrenched
    if(this.canEntrench&&this._stillTimer>0){
      const pct=Math.min(this._stillTimer/this.ENTRENCH_TIME,1);
      ctx.globalAlpha=0.80;
      ctx.strokeStyle=this.entrenched?'#A0601A':'rgba(160,96,26,0.6)';
      ctx.lineWidth=this.entrenched?2.5:1.5;
      ctx.beginPath();
      if(this.entrenched){ ctx.arc(this.x,this.y,r+5,0,Math.PI*2); }
      else { ctx.arc(this.x,this.y,r+5,-Math.PI/2,-Math.PI/2+pct*Math.PI*2); }
      ctx.stroke();
      ctx.globalAlpha=1;
      if(this.entrenched){
        // Subtle dirt fill
        ctx.globalAlpha=0.22; ctx.fillStyle='#6B4010';
        ctx.beginPath(); ctx.arc(this.x,this.y,r+5,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1;
        ctx.fillStyle='#C08030'; ctx.font='bold 5px "Courier New"'; ctx.textAlign='center';
        ctx.fillText('ENTR',this.x,this.y+r+9); ctx.textAlign='left';
      }
    }
    this._drawVetPip(ctx,r);
    this._drawSelection(ctx);
    drawHpBar(ctx,this.x,this.y-r-10,22,this.hp,this.maxHp);
  }

  _drawVetPip(ctx:CanvasRenderingContext2D,r:number){
    if(this.kills<2)return;
    const n=this.isVeteran?3:this.isCombatHardened?2:1;
    for(let i=0;i<n;i++){
      ctx.beginPath();ctx.arc(this.x-6+i*5,this.y-r-2,2,0,Math.PI*2);
      ctx.fillStyle=this.isVeteran?'#FFD700':'#AACCFF';ctx.fill();
    }
  }

  _drawSelection(ctx:CanvasRenderingContext2D){
    if(!this.selected)return;
    const r=this.radius;
    ctx.beginPath();ctx.arc(this.x,this.y,r+5,0,Math.PI*2);ctx.strokeStyle=C.uiAccent;ctx.lineWidth=2;ctx.stroke();
    const R1=r+5,R2=r+11;
    for(let a=0;a<Math.PI*2;a+=Math.PI/2){
      ctx.beginPath();
      ctx.moveTo(this.x+Math.cos(a)*R1,this.y+Math.sin(a)*R1);
      ctx.lineTo(this.x+Math.cos(a)*R2,this.y+Math.sin(a)*R2); ctx.stroke();
    }
    if(this.guardPos){
      ctx.beginPath();ctx.arc(this.x,this.y,this.guardRadius,0,Math.PI*2);
      ctx.strokeStyle='rgba(255,200,0,0.18)';ctx.lineWidth=1;ctx.setLineDash([4,8]);ctx.stroke();ctx.setLineDash([]);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// GRENADIER — splash Infantry
// ═══════════════════════════════════════════════════════════════
export class Grenadier extends Unit {
  splashRadius = 65;

  constructor(x:number,y:number,team:Team='player'){
    super(x,y,team);
    this.hp=this.maxHp=110; this.atkDmg=28; this.atkRange=70; this.atkRate=0.9;
    this.autoAtkRange=150; this.speed=38;
    this.projColor=team==='player'?'#FF8800':'#FF6600';
  }

  // Grenades: weaker vs armour (glancing hit), splash punishes infantry clusters
  targetMult(t: Entity): number {
    if (t instanceof Tank || t instanceof HeavyTank) return 0.65;
    if (t instanceof EnemyUnit && (t as EnemyUnit).isTank) return 0.65;
    return 1.0;
  }

  _makeProjectile(target:Entity): Projectile {
    const p=new Projectile(this.x,this.y,target,this.atkDmg*this.targetMult(target),380,this.projColor);
    p.splash=this.splashRadius; p.firedBy=this;
    return p;
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,4,0,Math.PI*2);ctx.fillStyle='#FF8800';ctx.fill();return;}
    // Call parent for base soldier silhouette then overlay grenadier details
    super.draw(ctx,dotMode);
    const r=this.radius;
    // Grenade belt — small orange arc around body
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle);
    ctx.strokeStyle='#FF7700'; ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.arc(-r*0.1,0,r*0.52,-Math.PI*0.55,Math.PI*0.55); ctx.stroke();
    // Grenade indicators (small bumps on belt)
    for(const a of [-0.28,0,0.28]){
      const gx=-r*0.1+Math.cos(a)*r*0.52, gy=Math.sin(a)*r*0.52;
      ctx.beginPath(); ctx.arc(gx,gy,r*0.18,0,Math.PI*2);
      ctx.fillStyle='#FF8800'; ctx.fill();
    }
    // Orange helmet (distinguishes from infantry)
    ctx.fillStyle='#CC5500';
    ctx.beginPath(); ctx.arc(r*0.28,-r*0.50,r*0.44,Math.PI*0.15,Math.PI*1.15); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════
// MARKSMAN — long-range infantry sniper
// ═══════════════════════════════════════════════════════════════
export class Marksman extends Unit {
  visionRadius = 350;

  constructor(x:number,y:number,team:Team='player'){
    super(x,y,team);
    this.hp=this.maxHp=90; this.atkDmg=42; this.atkRange=190; this.atkRate=0.35;
    this.autoAtkRange=280; this.speed=36;
    this.projColor=team==='player'?'#CCFFCC':'#FFBBAA';
  }

  // Marksman: highly effective vs infantry, mediocre vs armour
  targetMult(t: Entity): number {
    if (t instanceof Tank || t instanceof HeavyTank) return 0.30;
    if (t instanceof EnemyUnit && (t as EnemyUnit).isTank) return 0.30;
    return 1.0;
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,4,0,Math.PI*2);ctx.fillStyle='#CCFFCC';ctx.fill();return;}
    super.draw(ctx,dotMode);
    const r=this.radius;
    // Sniper scope glint on helmet
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle);
    // Long rifle barrel (sniper rifle — extends further)
    ctx.fillStyle=this._flash>0?'#FFF':'#2A3A2A';
    ctx.fillRect(r*0.38,-r*0.08,r*2.0,r*0.16);
    // Scope (small green rectangle on top of barrel)
    ctx.fillStyle=this._flash>0?'#EEE':'#225522';
    ctx.fillRect(r*0.9,-r*0.22,r*0.55,r*0.22);
    // Scope lens glint
    ctx.fillStyle='rgba(100,255,100,0.7)';
    ctx.beginPath(); ctx.arc(r*1.15,-r*0.11,r*0.1,0,Math.PI*2); ctx.fill();
    // Ghillie camouflage (dark green overlay with low opacity)
    ctx.globalAlpha=0.38;
    ctx.fillStyle='#1A3A0A';
    ctx.beginPath(); ctx.ellipse(0,0,r*0.65,r*0.85,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════
// TANK
// ═══════════════════════════════════════════════════════════════
export class Tank extends Unit {
  protected _barrelAngle=-Math.PI/2;

  constructor(x:number,y:number,team:Team='player'){
    super(x,y,team);
    this.radius=12; this.speed=22; this.hp=this.maxHp=320;
    this.atkDmg=46; this.atkRange=100; this.atkRate=0.65;
    this.projColor=team==='player'?'#FFDD44':'#FF8800';
    this.autoAtkRange=180;
  }

  // Tank: strong vs infantry/artillery, mirror matchup vs other tanks
  targetMult(t: Entity): number {
    if (t instanceof Artillery) return 1.40;
    if (t instanceof HeavyTank) return 0.85;
    if (t instanceof Tank)      return 0.90;
    if (t instanceof EnemyUnit && (t as EnemyUnit).isTank) return 0.90;
    if (t instanceof Unit)      return 1.50;  // light infantry crushed
    return 1.0;
  }

  update(dt:number,allUnits:Unit[],projectiles:Projectile[]){
    super.update(dt,allUnits,projectiles);
    const target=this.atkTarget??(this.moveTarget?{cx:this.moveTarget.x,cy:this.moveTarget.y}:null);
    if(target){const ang=Math.atan2(target.cy-this.y,target.cx-this.x);this._barrelAngle=lerpAngle(this._barrelAngle,ang,Math.min(1,dt*4.5));}
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,5,0,Math.PI*2);ctx.fillStyle=this.team==='player'?C.allyGold:C.enemyLight;ctx.fill();return;}
    const pl=this.team==='player';
    const base=pl?C.allyBase:C.enemyBase; const dark=pl?C.allyDark:C.enemyDark; const r=this.radius;

    // Drop shadow
    ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(this.x-r+4,this.y-r+4,r*2,r*2);

    // Hull
    ctx.fillStyle=this._flash>0?'#FFF':base; ctx.fillRect(this.x-r,this.y-r,r*2,r*2);
    // Armour plate highlights
    ctx.fillStyle='rgba(255,255,255,0.07)'; ctx.fillRect(this.x-r,this.y-r,r*2,4);

    // Track links (left & right side strips with segments)
    const trackCol=this._flash>0?'#FFF':'rgba(0,0,0,0.55)';
    ctx.fillStyle=trackCol;
    ctx.fillRect(this.x-r,this.y-r,6,r*2); ctx.fillRect(this.x+r-6,this.y-r,6,r*2);
    // Track segment lines
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
    for(let i=0;i<5;i++){
      const ty=this.y-r+i*(r*2/5);
      ctx.beginPath(); ctx.moveTo(this.x-r,ty); ctx.lineTo(this.x-r+6,ty); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.x+r-6,ty); ctx.lineTo(this.x+r,ty); ctx.stroke();
    }
    // Hull panel lines
    ctx.strokeStyle=dark; ctx.lineWidth=1.5; ctx.strokeRect(this.x-r,this.y-r,r*2,r*2);
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(this.x-r+7,this.y-r); ctx.lineTo(this.x-r+7,this.y+r); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.x+r-7,this.y-r); ctx.lineTo(this.x+r-7,this.y+r); ctx.stroke();

    // Turret ring
    ctx.beginPath(); ctx.arc(this.x,this.y,r*0.62,0,Math.PI*2);
    ctx.fillStyle=dark; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1; ctx.stroke();

    // Barrel with muzzle brake
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this._barrelAngle);
    const bCol=pl?'#AACCFF':'#FF8866';
    ctx.fillStyle=bCol; ctx.fillRect(0,-3.5,r*2.0,7);
    // Muzzle brake
    ctx.fillStyle=pl?'#8AAACE':'#CC6644';
    ctx.fillRect(r*1.7,-5,r*0.35,10);
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(r*1.7,-0.5,r*0.35,1);
    ctx.restore();

    // Hatch / vision port on turret
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this._barrelAngle);
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(-r*0.2,-1.5,r*0.5,3);
    ctx.restore();

    this._drawVetPip(ctx,r);
    this._drawSelection(ctx);
    drawHpBar(ctx,this.x,this.y-r-10,26,this.hp,this.maxHp);
  }
}

// ═══════════════════════════════════════════════════════════════
// HEAVY TANK
// ═══════════════════════════════════════════════════════════════
export class HeavyTank extends Tank {
  constructor(x:number,y:number,team:Team='player'){
    super(x,y,team);
    this.radius=15; this.speed=18;
    this.hp=this.maxHp=500; this.atkDmg=60; this.atkRate=0.55;
    this.projColor=team==='player'?'#00AAFF':'#FF4400';
  }

  // Heavy Tank: dominates infantry, respectable vs other armour
  targetMult(t: Entity): number {
    if (t instanceof Artillery) return 1.60;
    if (t instanceof Tank)      return 1.10;
    if (t instanceof HeavyTank) return 0.90;
    if (t instanceof EnemyUnit && (t as EnemyUnit).isTank) return 1.00;
    if (t instanceof Unit)      return 1.90;  // infantry are roadkill
    return 1.0;
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,6,0,Math.PI*2);ctx.fillStyle=this.team==='player'?'#00AAFF':'#FF4400';ctx.fill();return;}
    const pl=this.team==='player';
    const r=this.radius; // 15
    const base=pl?'#1A2A44':'#3A0C0C';
    const dark=pl?'#0A1830':'#280808';
    const accent=pl?'#00AAFF':'#FF4400';

    // Drop shadow — heavier than light tank
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(this.x-r+5,this.y-r+5,r*2,r*2);

    // Outer armour skirts (wider than hull)
    ctx.fillStyle=pl?'#152035':'#2A0808';
    ctx.fillRect(this.x-r-3,this.y-r+2,r*2+6,r*2-4);

    // Main hull
    ctx.fillStyle=this._flash>0?'#FFF':base; ctx.fillRect(this.x-r,this.y-r,r*2,r*2);
    // Armour top highlight
    ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(this.x-r,this.y-r,r*2,5);

    // Heavy track links (wider — 8px each side)
    ctx.fillStyle=this._flash>0?'#FFF':'rgba(0,0,0,0.6)';
    ctx.fillRect(this.x-r,this.y-r,8,r*2); ctx.fillRect(this.x+r-8,this.y-r,8,r*2);
    ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=1.2;
    for(let i=0;i<6;i++){
      const ty=this.y-r+i*(r*2/6);
      ctx.beginPath(); ctx.moveTo(this.x-r,ty); ctx.lineTo(this.x-r+8,ty); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.x+r-8,ty); ctx.lineTo(this.x+r,ty); ctx.stroke();
    }

    // Hull panel lines — double stripe for heavy armour
    ctx.strokeStyle=dark; ctx.lineWidth=2; ctx.strokeRect(this.x-r,this.y-r,r*2,r*2);
    ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=0.9;
    ctx.beginPath(); ctx.moveTo(this.x-r+9,this.y-r); ctx.lineTo(this.x-r+9,this.y+r); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.x+r-9,this.y-r); ctx.lineTo(this.x+r-9,this.y+r); ctx.stroke();
    // Centre hull divider
    ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.7;
    ctx.beginPath(); ctx.moveTo(this.x-r+9,this.y); ctx.lineTo(this.x+r-9,this.y); ctx.stroke();

    // Accent border (coloured outer rim)
    ctx.strokeStyle=accent; ctx.lineWidth=1.5; ctx.strokeRect(this.x-r-3,this.y-r+2,r*2+6,r*2-4);

    // Large turret ring
    ctx.beginPath(); ctx.arc(this.x,this.y,r*0.68,0,Math.PI*2);
    ctx.fillStyle=dark; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1.5; ctx.stroke();

    // Barrel (wider + longer than regular tank)
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this._barrelAngle);
    const bCol=pl?'#88CCFF':'#FF6644';
    ctx.fillStyle=bCol; ctx.fillRect(0,-4.5,r*2.3,9);
    // Muzzle brake (chunky double-slot)
    ctx.fillStyle=pl?'#6699CC':'#CC4422';
    ctx.fillRect(r*1.95,-6,r*0.38,12);
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.fillRect(r*1.95,-0.8,r*0.38,1.6);
    ctx.fillRect(r*1.95,-3.5,r*0.38,1.0);
    ctx.fillRect(r*1.95, r*0.14,r*0.38,1.0);
    // Hatch
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(-r*0.25,-2,r*0.55,4);
    ctx.restore();

    this._drawVetPip(ctx,r);
    this._drawSelection(ctx);
    drawHpBar(ctx,this.x,this.y-r-12,28,this.hp,this.maxHp);
  }
}

// ═══════════════════════════════════════════════════════════════
// ARTILLERY
// ═══════════════════════════════════════════════════════════════
export class Artillery extends Unit {
  private _barrelAngle=-Math.PI/2;
  private _deployTimer=0;
  deployed=false;

  constructor(x:number,y:number,team:Team='player'){
    super(x,y,team);
    this.radius=14; this.speed=18; this.hp=this.maxHp=180;
    this.atkDmg=85; this.atkRange=280; this.atkRate=0.35;
    this.autoAtkRange=300; this.projColor=team==='player'?'#FFEE00':'#FF6600';
  }

  // Artillery: best vs static/clustered targets; struggles vs mobile armour
  targetMult(t: Entity): number {
    if (t instanceof Building)  return 2.00;  // siege weapon
    if (t instanceof Tank || t instanceof HeavyTank) return 0.60;
    if (t instanceof EnemyUnit && (t as EnemyUnit).isTank) return 0.60;
    return 1.0;
  }

  takeDmg(d:number){
    // Artillery gets no cover benefit — it's in the open
    super.takeDmg(d*1.2);
  }

  update(dt:number,allUnits:Unit[],projectiles:Projectile[]){
    if(this.atkCd>0)this.atkCd-=dt;
    if(this._flash>0)this._flash-=dt;
    if(this._suppressTimer>0)this._suppressTimer-=dt;

    // Must be stationary to fire — deploy mechanism
    const isMoving=!!this.moveTarget;
    if(isMoving){this.deployed=false;this._deployTimer=0;}
    else{this._deployTimer=Math.min(1,this._deployTimer+dt);}
    this.deployed=this._deployTimer>=0.8;

    const target=this.atkTarget??(this.autoAtk?this._findNearest(allUnits):null);
    if(target){
      if(!target.isAlive()){this.atkTarget=null;return;}
      const ang=Math.atan2(target.cy-this.y,target.cx-this.x);
      this._barrelAngle=lerpAngle(this._barrelAngle,ang,Math.min(1,dt*2));
      const d=hypot(this.x,this.y,target.cx,target.cy);
      if(d<=this.atkRange&&this.atkCd<=0&&this.deployed){
        const p=this._makeProjectile(target);
        p.splash=50;
        projectiles.push(p);
        this.atkCd=1/this.atkRate; this._flash=0.06;
      }
    }

    if(this.moveTarget){
      const d=hypot(this.x,this.y,this.moveTarget.x,this.moveTarget.y);
      if(d>3)this._towards(this.moveTarget.x,this.moveTarget.y,dt);
      else{this.moveTarget=null;this.retreating=false;}
    }
    this._separate(allUnits);
    this.x=clamp(this.x,this.radius,MAP_W-this.radius);
    this.y=clamp(this.y,this.radius,MAP_H-this.radius);
  }

  _findNearest(all:Unit[]):Unit|null{
    let best:Unit|null=null,bd=this.autoAtkRange;
    for(const u of all){if(u.team===this.team||!u.isAlive())continue;const d=hypot(this.x,this.y,u.x,u.y);if(d<bd){bd=d;best=u;}}
    return best;
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,5,0,Math.PI*2);ctx.fillStyle='#FFEE00';ctx.fill();return;}
    const pl=this.team==='player'; const r=this.radius;
    const baseCol=this._flash>0?'#FFF':(pl?'#1E3050':'#442200');
    const accentCol=pl?'#4488FF':'#FF6600';
    const barrelCol=pl?'#AACCFF':'#FF8844';

    // ── Deploy stabiliser legs (drawn behind hull) ──────────────
    if(this.deployed){
      ctx.strokeStyle=pl?'rgba(80,120,180,0.8)':'rgba(140,80,40,0.8)'; ctx.lineWidth=2.5;
      // front legs
      ctx.beginPath(); ctx.moveTo(this.x+r*0.5,this.y+r*0.6); ctx.lineTo(this.x+r*0.5+9,this.y+r+10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.x-r*0.5,this.y+r*0.6); ctx.lineTo(this.x-r*0.5-9,this.y+r+10); ctx.stroke();
      // rear jack
      ctx.beginPath(); ctx.moveTo(this.x,this.y+r*0.8); ctx.lineTo(this.x,this.y+r+12); ctx.stroke();
      // foot plates
      ctx.fillStyle=pl?'#2244AA':'#884422';
      ctx.fillRect(this.x+r*0.5+5,this.y+r+8,8,3);
      ctx.fillRect(this.x-r*0.5-13,this.y+r+8,8,3);
      ctx.fillRect(this.x-4,this.y+r+10,8,3);
    }

    // ── Drop shadow ─────────────────────────────────────────────
    ctx.fillStyle='rgba(0,0,0,0.38)'; ctx.fillRect(this.x-r+4,this.y-r+4,r*2,r*2);

    // ── Gun carriage body ────────────────────────────────────────
    ctx.fillStyle=baseCol; ctx.fillRect(this.x-r,this.y-r,r*2,r*2);
    // top highlight strip
    ctx.fillStyle='rgba(255,255,255,0.07)'; ctx.fillRect(this.x-r,this.y-r,r*2,5);
    // side panels (slightly recessed tone)
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.fillRect(this.x-r,this.y-r,5,r*2); ctx.fillRect(this.x+r-5,this.y-r,5,r*2);
    // centre divider
    ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(this.x-r+5,this.y); ctx.lineTo(this.x+r-5,this.y); ctx.stroke();
    // border
    ctx.strokeStyle=accentCol; ctx.lineWidth=1.8; ctx.strokeRect(this.x-r,this.y-r,r*2,r*2);

    // Carriage detail — elevation wheel (left side)
    ctx.beginPath(); ctx.arc(this.x-r*0.4,this.y,r*0.34,0,Math.PI*2);
    ctx.fillStyle=pl?'#2A5080':'#664020'; ctx.fill();
    ctx.strokeStyle=accentCol; ctx.lineWidth=1; ctx.stroke();
    // spokes
    ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=0.7;
    for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.beginPath();ctx.moveTo(this.x-r*0.4+Math.cos(a)*r*0.12,this.y+Math.sin(a)*r*0.12);ctx.lineTo(this.x-r*0.4+Math.cos(a)*r*0.32,this.y+Math.sin(a)*r*0.32);ctx.stroke();}

    // ── Rotating barrel (long + muzzle cap) ─────────────────────
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this._barrelAngle);
    // barrel body
    ctx.fillStyle=barrelCol; ctx.fillRect(0,-4,r*2.8,8);
    // barrel highlight
    ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(0,-4,r*2.7,3);
    // muzzle cap (slightly wider)
    ctx.fillStyle=pl?'#8AAACE':'#CC6633';
    ctx.fillRect(r*2.4,-5.5,r*0.45,11);
    // muzzle slot
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(r*2.4,-0.6,r*0.45,1.2);
    ctx.restore();

    // ── Deploy state indicator bar ───────────────────────────────
    if(!this.deployed&&!this.moveTarget){
      const pct=this._deployTimer;
      ctx.fillStyle='rgba(255,220,0,0.75)'; ctx.font='bold 6px "Courier New"'; ctx.textAlign='center';
      ctx.fillText('DEPLOYING',this.x,this.y-r-5);
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(this.x-18,this.y-r-1,36,4);
      ctx.fillStyle='#FFD700'; ctx.fillRect(this.x-18,this.y-r-1,36*pct,4);
      ctx.textAlign='left';
    }

    this._drawVetPip(ctx,r);
    this._drawSelection(ctx);
    drawHpBar(ctx,this.x,this.y-r-13,30,this.hp,this.maxHp);
  }
}

// ═══════════════════════════════════════════════════════════════
// SCOUT
// ═══════════════════════════════════════════════════════════════
export class Scout extends Unit {
  visionRadius=400;

  constructor(x:number,y:number,team:Team='player'){
    super(x,y,team);
    this.radius=6; this.speed=88; this.hp=this.maxHp=45;
    this.atkDmg=8; this.atkRange=55; this.atkRate=1.8;
    this.autoAtkRange=120;
    this.projColor=team==='player'?'#00FFCC':'#FF8844';
  }

  // Scout: excellent vs artillery (harassment), useless vs armour
  targetMult(t: Entity): number {
    if (t instanceof Artillery) return 1.60;
    if (t instanceof Tank || t instanceof HeavyTank) return 0.20;
    if (t instanceof EnemyUnit && (t as EnemyUnit).isTank) return 0.20;
    if (t instanceof Building)  return 0.35;
    return 1.0;
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,3,0,Math.PI*2);ctx.fillStyle='#00FFCC';ctx.fill();return;}
    const pl=this.team==='player'; const r=this.radius;
    const bodyCol=this._flash>0?'#FFF':(pl?'#1A8866':'#993322');
    const accentCol=pl?'#00FFCC':'#FF8844';

    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle);

    // Drop shadow
    ctx.fillStyle='rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(2,2,r*1.6,r*0.7,0,0,Math.PI*2); ctx.fill();

    // Low-profile wedge body — wider at back, tapers to front (+X)
    ctx.fillStyle=bodyCol;
    ctx.beginPath();
    ctx.moveTo( r*1.4,  0);           // nose point
    ctx.lineTo( r*0.4, -r*0.65);      // front shoulder
    ctx.lineTo(-r*1.1, -r*0.8);       // rear left
    ctx.lineTo(-r*1.4, -r*0.55);      // rear-left corner
    ctx.lineTo(-r*1.4,  r*0.55);      // rear-right corner
    ctx.lineTo(-r*1.1,  r*0.8);       // rear right
    ctx.lineTo( r*0.4,  r*0.65);      // front shoulder
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle=accentCol; ctx.lineWidth=1; ctx.stroke();

    // Cockpit / windshield strip
    ctx.fillStyle='rgba(80,200,220,0.5)';
    ctx.beginPath();
    ctx.moveTo(r*1.0,0); ctx.lineTo(r*0.5,-r*0.45); ctx.lineTo(-r*0.1,-r*0.42);
    ctx.lineTo(-r*0.1, r*0.42); ctx.lineTo(r*0.5, r*0.45); ctx.closePath(); ctx.fill();

    // Roof panel line
    ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(-r*0.1,-r*0.42); ctx.lineTo(-r*1.1,-r*0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r*0.1, r*0.42); ctx.lineTo(-r*1.1, r*0.7); ctx.stroke();

    // Antenna mast at back
    ctx.strokeStyle=accentCol; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(-r*1.2,0); ctx.lineTo(-r*1.2,-r*1.5); ctx.stroke();
    // Antenna tip blip
    ctx.fillStyle=accentCol;
    ctx.beginPath(); ctx.arc(-r*1.2,-r*1.5,1.5,0,Math.PI*2); ctx.fill();

    // Exhaust port (rear)
    ctx.fillStyle='rgba(0,0,0,0.4)';
    ctx.fillRect(-r*1.4,-r*0.18,r*0.25,r*0.36);

    ctx.restore();

    // Vision radius ring when selected
    if(this.selected){
      ctx.beginPath(); ctx.arc(this.x,this.y,this.visionRadius,0,Math.PI*2);
      ctx.strokeStyle='rgba(0,255,200,0.10)'; ctx.lineWidth=1; ctx.setLineDash([5,9]); ctx.stroke(); ctx.setLineDash([]);
    }
    this._drawVetPip(ctx,r);
    this._drawSelection(ctx);
    drawHpBar(ctx,this.x,this.y-r-10,18,this.hp,this.maxHp);
  }
}

// ═══════════════════════════════════════════════════════════════
// ANTI-TANK GUN
// ═══════════════════════════════════════════════════════════════
export class AntitankGun extends Unit {
  private _barrelAngle=-Math.PI/2;

  constructor(x:number,y:number,team:Team='player'){
    super(x,y,team);
    this.radius=10; this.speed=28; this.hp=this.maxHp=140;
    this.atkDmg=72; this.atkRange=120; this.atkRate=0.7;
    this.autoAtkRange=160;
    this.projColor=team==='player'?'#FF4400':'#FF8800';
  }

  // Anti-tank gun: specialist armour-killer, hopeless vs light infantry
  targetMult(t: Entity): number {
    if (t instanceof Tank || t instanceof HeavyTank) return 1.60;
    if (t instanceof EnemyUnit && (t as EnemyUnit).isTank) return 1.60;
    if (t instanceof Unit && t.radius <= 8) return 0.45; // tiny infantry target
    return 0.85;
  }

  update(dt:number,allUnits:Unit[],projectiles:Projectile[]){
    super.update(dt,allUnits,projectiles);
    const target=this.atkTarget??(this.moveTarget?{cx:this.moveTarget.x,cy:this.moveTarget.y}:null);
    if(target){const ang=Math.atan2(target.cy-this.y,target.cx-this.x);this._barrelAngle=lerpAngle(this._barrelAngle,ang,Math.min(1,dt*5));}
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,4,0,Math.PI*2);ctx.fillStyle='#FF4400';ctx.fill();return;}
    const pl=this.team==='player'; const r=this.radius;

    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this._barrelAngle);

    // Drop shadow
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(-r*0.8+2,-r*0.8+2,r*1.6,r*1.6);

    // Gun carriage (low, compact body)
    ctx.fillStyle=this._flash>0?'#FFF':(pl?'#2A3820':'#3A2010');
    ctx.fillRect(-r*0.8,-r*0.7,r*1.6,r*1.4);
    ctx.strokeStyle=pl?'#44AA22':'#CC4400'; ctx.lineWidth=1.5;
    ctx.strokeRect(-r*0.8,-r*0.7,r*1.6,r*1.4);

    // Shield plate (angled forward face — trapezoidal)
    const shieldCol=this._flash>0?'#EEE':(pl?'#3A5A28':'#5A3018');
    ctx.fillStyle=shieldCol;
    ctx.beginPath();
    ctx.moveTo(r*0.25,-r*0.95); ctx.lineTo(r*0.25,r*0.95);
    ctx.lineTo(r*1.0, r*0.62); ctx.lineTo(r*1.0,-r*0.62);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1; ctx.stroke();
    // Vision slit in shield
    ctx.fillStyle='rgba(0,0,0,0.7)';
    ctx.fillRect(r*0.28,-r*0.11,r*0.68,r*0.22);

    // Very long barrel (2.8× radius = 28px for AT gun)
    ctx.fillStyle=pl?'#556644':'#774422';
    ctx.fillRect(r*0.95,-r*0.18,r*2.8,r*0.36);
    // Barrel seam highlight
    ctx.fillStyle='rgba(255,255,255,0.14)';
    ctx.fillRect(r*0.95,-r*0.18,r*2.7,r*0.09);
    // Muzzle cone
    ctx.fillStyle=pl?'#667755':'#885533';
    ctx.beginPath();
    ctx.moveTo(r*3.65,-r*0.24); ctx.lineTo(r*3.65,r*0.24);
    ctx.lineTo(r*3.85,r*0.12); ctx.lineTo(r*3.85,-r*0.12);
    ctx.closePath(); ctx.fill();

    // Gunner (small circle behind shield)
    ctx.fillStyle=this._flash>0?'#FFF':(pl?C.allyBase:C.enemyBase);
    ctx.beginPath(); ctx.arc(-r*0.25,0,r*0.4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=pl?C.allyLight:C.enemyLight; ctx.lineWidth=1; ctx.stroke();
    // Helmet on gunner
    ctx.fillStyle=pl?'#1A4088':'#701010';
    ctx.beginPath(); ctx.arc(-r*0.25,-r*0.22,r*0.28,Math.PI,Math.PI*2); ctx.closePath(); ctx.fill();

    ctx.restore();

    // Deployment wheels (small circles at back)
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this._barrelAngle);
    ctx.fillStyle='#3A3A3A';
    ctx.beginPath(); ctx.arc(-r*0.7,-r*0.78,r*0.22,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-r*0.7, r*0.78,r*0.22,0,Math.PI*2); ctx.fill();
    ctx.restore();

    this._drawVetPip(ctx,r);
    this._drawSelection(ctx);
    drawHpBar(ctx,this.x,this.y-r-10,24,this.hp,this.maxHp);
  }
}

// ═══════════════════════════════════════════════════════════════
// HARVESTER
// ═══════════════════════════════════════════════════════════════
export type HState='idle'|'to-field'|'harvesting'|'returning';

export class Harvester extends Unit {
  state:       HState='idle';
  cargo:       number=0;
  maxCargo:    number=250;
  harvestRate: number=28;
  targetField: TiberiumField|null=null;
  private _refinery: Building|null=null;

  constructor(x:number,y:number,game:GameRef,team:Team='player'){
    super(x,y,team);
    this._game=game; this.radius=10; this.speed=42;
    this.hp=this.maxHp=200; this.autoAtk=false;
  }

  update(dt:number,allUnits:Unit[],_proj:Projectile[]){
    if(this._flash>0)this._flash-=dt;
    const g=this._game!;
    // Always track the CLOSEST ready refinery so harvesters route efficiently
    const refs=g.buildings.filter(b=>b.type==='Refinery'&&b.team===this.team&&b.isAlive());
    if(refs.length) this._refinery=refs.reduce((best,b)=>hypot(this.x,this.y,b.cx,b.cy)<hypot(this.x,this.y,best.cx,best.cy)?b:best);
    else this._refinery=null;
    if(this.state==='idle'){
      if(!this._refinery)return;
      if(this.moveTarget)return; // respect player move command — wait until we arrive
      const field=g.tibFields.filter(f=>f.remaining>=20).sort((a,b)=>{
        const sA=a.remaining/Math.max(1,hypot(this.x,this.y,a.cx,a.cy));
        const sB=b.remaining/Math.max(1,hypot(this.x,this.y,b.cx,b.cy));
        return sB-sA;
      })[0];
      if(field){this.targetField=field;this.state='to-field';this.moveTo(field.cx,field.cy);}
    }
    if(this.state==='to-field'){
      if(!this.targetField||this.targetField.remaining<5){this.state='idle';this.targetField=null;this.moveTarget=null;return;}
      if(hypot(this.x,this.y,this.targetField.cx,this.targetField.cy)<this.targetField.radius){this.moveTarget=null;this.state='harvesting';}
    }
    if(this.state==='harvesting'){
      if(!this.targetField||this.targetField.remaining<2||this.cargo>=this.maxCargo){
        // Re-evaluate closest refinery before heading back
        const refs2=g.buildings.filter(b=>b.type==='Refinery'&&b.team===this.team&&b.isAlive());
        if(refs2.length) this._refinery=refs2.reduce((best,b)=>hypot(this.x,this.y,b.cx,b.cy)<hypot(this.x,this.y,best.cx,best.cy)?b:best);
        if(!this._refinery){this.state='idle';return;}
        this.state='returning'; this.moveTarget={x:this._refinery.cx,y:this._refinery.cy}; return;
      }
      this.cargo+=this.targetField.harvest(dt,this.harvestRate*this._speedMult);
    }
    if(this.state==='returning'){
      if(!this._refinery?.isAlive()){this.state='idle';return;}
      if(hypot(this.x,this.y,this._refinery.cx,this._refinery.cy)<50){
        g.addCredits(this.cargo); this.cargo=0; this.state='idle'; this.moveTarget=null;
      }
    }
    if(this.moveTarget){const d=hypot(this.x,this.y,this.moveTarget.x,this.moveTarget.y);if(d>3)this._towards(this.moveTarget.x,this.moveTarget.y,dt);else this.moveTarget=null;}
    this._separate(allUnits);
    this.x=clamp(this.x,this.radius,MAP_W-this.radius);
    this.y=clamp(this.y,this.radius,MAP_H-this.radius);
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,4,0,Math.PI*2);ctx.fillStyle=C.tibGreen;ctx.fill();return;}
    const r=this.radius;
    const mov=this.moveTarget||this.state==='to-field'||this.state==='returning';

    ctx.save(); ctx.translate(this.x,this.y);
    // Point in movement/harvest direction based on state
    const facingAngle = this.angle;
    ctx.rotate(facingAngle);

    // Drop shadow
    ctx.fillStyle='rgba(0,0,0,0.38)'; ctx.fillRect(-r+3,-r+3,r*2,r*2);

    // Main hull (boxy, heavy vehicle)
    ctx.fillStyle=this._flash>0?'#FFF':'#DDAA00'; ctx.fillRect(-r,-r,r*2,r*2);
    // Armour stripes
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.fillRect(-r,-r,r*2,5); ctx.fillRect(-r,r-5,r*2,5);
    ctx.strokeStyle='#997700'; ctx.lineWidth=1.8; ctx.strokeRect(-r,-r,r*2,r*2);
    // Cab window
    ctx.fillStyle='rgba(80,160,220,0.55)';
    ctx.fillRect(-r*0.35,-r*0.68,r*0.7,r*0.44);
    ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=0.8;
    ctx.strokeRect(-r*0.35,-r*0.68,r*0.7,r*0.44);

    // Tiberium cargo fill (from bottom up, green)
    if(this.cargo>0){
      const cp=this.cargo/this.maxCargo;
      const ch=(r*2-4)*cp;
      ctx.fillStyle=hexA(C.tibGreen,cp*0.72);
      ctx.fillRect(-r+2,r-2-ch,r*2-4,ch);
    }

    // Collection scoop/arm (front = +X in local space)
    const scoopCol=this._flash>0?'#EEE':'#BB8800';
    ctx.fillStyle=scoopCol;
    // Arm extends forward
    ctx.fillRect(r*0.85,-r*0.28,r*0.6,r*0.56);
    // Scoop bucket tip
    ctx.beginPath();
    ctx.moveTo(r*1.35,-r*0.38); ctx.lineTo(r*1.35,r*0.38);
    ctx.lineTo(r*1.65,r*0.22); ctx.lineTo(r*1.65,-r*0.22);
    ctx.closePath();
    ctx.fillStyle=this.state==='harvesting'?C.tibGreen:scoopCol; ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1; ctx.stroke();

    // Tracks
    ctx.fillStyle='rgba(0,0,0,0.5)';
    ctx.fillRect(-r,-r,4,r*2); ctx.fillRect(r-4,-r,4,r*2);
    ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=0.7;
    for(let i=0;i<5;i++){const ty=-r+i*(r*2/5);ctx.beginPath();ctx.moveTo(-r,ty);ctx.lineTo(-r+4,ty);ctx.moveTo(r-4,ty);ctx.lineTo(r,ty);ctx.stroke();}

    ctx.restore();

    // State label
    const labels:Record<HState,string>={idle:'IDL','to-field':'TIB',harvesting:'HARV',returning:'RTN'};
    ctx.fillStyle=this.state==='harvesting'?C.tibGreen:'rgba(255,200,0,0.85)';
    ctx.font='bold 6px "Courier New"'; ctx.textAlign='center';
    ctx.fillText(labels[this.state],this.x,this.y+r+11); ctx.textAlign='left';

    if(this.selected){ctx.strokeStyle=C.uiAccent;ctx.lineWidth=2;ctx.strokeRect(this.x-r-5,this.y-r-5,r*2+10,r*2+10);}
    drawHpBar(ctx,this.x,this.y-r-10,24,this.hp,this.maxHp);
    const cw=24,ch=3,cbx=this.x-cw/2,cby=this.y-r-6;
    ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(cbx,cby,cw,ch);
    ctx.fillStyle=C.tibGreen;ctx.fillRect(cbx,cby,cw*(this.cargo/this.maxCargo),ch);
  }
}

// ═══════════════════════════════════════════════════════════════
// ENEMY UNIT
// ═══════════════════════════════════════════════════════════════
export interface EnemyOpts { hp?:number;dmg?:number;rate?:number;range?:number;radius?:number;speed?:number;aggro?:number;tank?:boolean;heavy?:boolean }

export class EnemyUnit extends Unit {
  isTank:     boolean;
  isHeavy:    boolean;
  aggroRange: number;
  mapTheme:   number = 0;   // set by engine when spawning
  private _state:      'roam'|'aggro'='roam';
  private _roamTarget: {x:number;y:number}|null=null;
  private _pauseTimer: number;
  private _homeX:      number;
  private _homeY:      number;
  private _barrelAngle=-Math.PI/2;

  constructor(x:number,y:number,opts:EnemyOpts={}){
    super(x,y,'enemy');
    this.speed=opts.speed??26; this.atkDmg=opts.dmg??11; this.atkRate=opts.rate??1.0;
    this.atkRange=opts.range??56; this.hp=this.maxHp=opts.hp??100;
    this.radius=opts.radius??8; this.isTank=opts.tank??false; this.isHeavy=opts.heavy??false;
    this.aggroRange=opts.aggro??240; this.projColor=this.isTank?C.enemyLight:C.enemyAccent;
    this.autoAtk=false; this._pauseTimer=rnd(0.5,1.5);
    this._homeX=x; this._homeY=y;
    if(this.isTank){
      this.radius=12; this.speed=20;
      this.hp=this.maxHp=this.isHeavy?500:320;
      this.atkDmg=this.isHeavy?60:46; this.atkRange=100; this.atkRate=this.isHeavy?0.55:0.65;
      this.autoAtkRange=180;
    }
  }

  update(dt:number,allUnits:Unit[],projectiles:Projectile[]){
    const pEntities:Entity[]=this._game?[...this._game.pUnits,...this._game.buildings.filter(b=>b.team==='player')]:[];
    let nearest:Entity|null=null,nearestD=this.aggroRange;
    for(const e of pEntities){if(!e.isAlive())continue;const d=hypot(this.x,this.y,e.cx,e.cy);if(d<nearestD){nearestD=d;nearest=e;}}
    if(nearest){this._state='aggro';this.atkTarget=nearest;this.moveTarget=null;}
    else{
      this._state='roam'; this.atkTarget=null;
      if(this._pauseTimer>0){this._pauseTimer-=dt;this.moveTarget=null;}
      else{
        const mt=this._marchTarget(pEntities);
        if(mt)this.moveTarget=mt;
        else{
          if(!this._roamTarget||hypot(this.x,this.y,this._roamTarget.x,this._roamTarget.y)<12){
            const ang=Math.random()*Math.PI*2,r=rnd(30,90);
            this._roamTarget={x:clamp(this._homeX+Math.cos(ang)*r,16,MAP_W-16),y:clamp(this._homeY+Math.sin(ang)*r,16,MAP_H-16)};
          }
          this.moveTarget=this._roamTarget;
        }
      }
    }
    if(this.isTank){const tgt=this.atkTarget??(this.moveTarget?{cx:this.moveTarget.x,cy:this.moveTarget.y}:null);if(tgt){const ang=Math.atan2(tgt.cy-this.y,tgt.cx-this.x);this._barrelAngle=lerpAngle(this._barrelAngle,ang,Math.min(1,dt*4));}}
    super.update(dt,allUnits,projectiles);
  }

  private _marchTarget(pEntities:Entity[]):{x:number;y:number}|null{
    let goal:Entity|null=null,goalD=Infinity;
    for(const e of pEntities){if(!e.isAlive())continue;const d=hypot(this.x,this.y,e.cx,e.cy);if(d<goalD){goalD=d;goal=e;}}
    if(!goal)return null;
    // River navigation only on theme 0 (river map)
    if(this.mapTheme===0){
      const RIVER_X=900;
      if(this.x>RIVER_X+80){
        const bridges=[{x:RIVER_X-20,y:310},{x:RIVER_X-20,y:620},{x:RIVER_X-20,y:930}];
        let best=bridges[0],bestD=Infinity;
        for(const b of bridges){const d=hypot(this.x,this.y,b.x,b.y)+rnd(-40,40);if(d<bestD){bestD=d;best=b;}}
        return best;
      }
    }
    // Desert canyon navigation (theme 4 — Dead Man's Pass)
    // Units outside the corridor must route through the canyon entrance first
    if(this.mapTheme===4){
      const CORRIDOR_Y_N=375, CORRIDOR_Y_S=825; // corridor north/south thresholds
      if(this.y<CORRIDOR_Y_N){
        // North of corridor entrance — route to canyon mouth
        return{x:900+rnd(-20,20),y:CORRIDOR_Y_N};
      }
      if(this.y>CORRIDOR_Y_S){
        // South of corridor entrance — route to canyon mouth (for player units going north)
        return{x:900+rnd(-20,20),y:CORRIDOR_Y_S};
      }
    }
    return{x:goal.cx,y:goal.cy};
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(this.isTank)this._drawTank(ctx,dotMode);
    else super.draw(ctx,dotMode);
  }

  private _drawTank(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,this.isHeavy?7:5,0,Math.PI*2);ctx.fillStyle=this.isHeavy?'#FF4400':C.enemyLight;ctx.fill();return;}
    const r=this.radius;
    const base=C.enemyBase; const dark=C.enemyDark;
    const accent=this.isHeavy?'#FF4400':C.enemyLight;  // heavy = bright red, regular = orange

    if(this.isHeavy){
      // ── HEAVY ENEMY TANK ───────────────────────────────────────
      // Drop shadow
      ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(this.x-r+5,this.y-r+5,r*2,r*2);
      // Armour skirts
      ctx.fillStyle='#2A0808'; ctx.fillRect(this.x-r-3,this.y-r+2,r*2+6,r*2-4);
      // Hull
      ctx.fillStyle=this._flash>0?'#FFF':'#3A0C0C'; ctx.fillRect(this.x-r,this.y-r,r*2,r*2);
      ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(this.x-r,this.y-r,r*2,5);
      // Heavy tracks
      ctx.fillStyle='rgba(0,0,0,0.6)';
      ctx.fillRect(this.x-r,this.y-r,8,r*2); ctx.fillRect(this.x+r-8,this.y-r,8,r*2);
      ctx.strokeStyle='rgba(255,255,255,0.09)'; ctx.lineWidth=1.2;
      for(let i=0;i<6;i++){const ty=this.y-r+i*(r*2/6);ctx.beginPath();ctx.moveTo(this.x-r,ty);ctx.lineTo(this.x-r+8,ty);ctx.stroke();ctx.beginPath();ctx.moveTo(this.x+r-8,ty);ctx.lineTo(this.x+r,ty);ctx.stroke();}
      // Hull lines
      ctx.strokeStyle='#280808'; ctx.lineWidth=2; ctx.strokeRect(this.x-r,this.y-r,r*2,r*2);
      ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.9;
      ctx.beginPath();ctx.moveTo(this.x-r+9,this.y-r);ctx.lineTo(this.x-r+9,this.y+r);ctx.stroke();
      ctx.beginPath();ctx.moveTo(this.x+r-9,this.y-r);ctx.lineTo(this.x+r-9,this.y+r);ctx.stroke();
      // Red accent border
      ctx.strokeStyle='#FF4400'; ctx.lineWidth=1.5; ctx.strokeRect(this.x-r-3,this.y-r+2,r*2+6,r*2-4);
      // Large turret ring
      ctx.beginPath(); ctx.arc(this.x,this.y,r*0.68,0,Math.PI*2);
      ctx.fillStyle='#280808'; ctx.fill();
      ctx.strokeStyle='rgba(255,100,80,0.2)'; ctx.lineWidth=1.5; ctx.stroke();
      // Wide barrel
      ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this._barrelAngle);
      ctx.fillStyle='#CC5533'; ctx.fillRect(0,-4.5,r*2.3,9);
      ctx.fillStyle='#882211'; ctx.fillRect(r*1.95,-6,r*0.38,12);
      ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(r*1.95,-0.8,r*0.38,1.6); ctx.fillRect(r*1.95,-3.5,r*0.38,1.0); ctx.fillRect(r*1.95,r*0.14,r*0.38,1.0);
      ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(-r*0.25,-2,r*0.55,4);
      ctx.restore();
      drawHpBar(ctx,this.x,this.y-r-12,28,this.hp,this.maxHp);
    } else {
      // ── REGULAR ENEMY TANK ─────────────────────────────────────
      // Drop shadow
      ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(this.x-r+4,this.y-r+4,r*2,r*2);
      // Hull
      ctx.fillStyle=this._flash>0?'#FFF':base; ctx.fillRect(this.x-r,this.y-r,r*2,r*2);
      ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(this.x-r,this.y-r,r*2,4);
      // Track links
      ctx.fillStyle='rgba(0,0,0,0.55)';
      ctx.fillRect(this.x-r,this.y-r,6,r*2); ctx.fillRect(this.x+r-6,this.y-r,6,r*2);
      ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=1;
      for(let i=0;i<5;i++){const ty=this.y-r+i*(r*2/5);ctx.beginPath();ctx.moveTo(this.x-r,ty);ctx.lineTo(this.x-r+6,ty);ctx.stroke();ctx.beginPath();ctx.moveTo(this.x+r-6,ty);ctx.lineTo(this.x+r,ty);ctx.stroke();}
      // Hull panel lines
      ctx.strokeStyle=dark; ctx.lineWidth=1.5; ctx.strokeRect(this.x-r,this.y-r,r*2,r*2);
      ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=0.8;
      ctx.beginPath();ctx.moveTo(this.x-r+7,this.y-r);ctx.lineTo(this.x-r+7,this.y+r);ctx.stroke();
      ctx.beginPath();ctx.moveTo(this.x+r-7,this.y-r);ctx.lineTo(this.x+r-7,this.y+r);ctx.stroke();
      // Turret ring
      ctx.beginPath(); ctx.arc(this.x,this.y,r*0.60,0,Math.PI*2);
      ctx.fillStyle=dark; ctx.fill();
      ctx.strokeStyle='rgba(255,150,100,0.2)'; ctx.lineWidth=1; ctx.stroke();
      // Barrel + muzzle brake
      ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this._barrelAngle);
      ctx.fillStyle='#CC7744'; ctx.fillRect(0,-3.5,r*2.0,7);
      ctx.fillStyle='#AA5522'; ctx.fillRect(r*1.7,-5,r*0.35,10);
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(r*1.7,-0.5,r*0.35,1);
      ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(-r*0.2,-1.5,r*0.5,3);
      ctx.restore();
      drawHpBar(ctx,this.x,this.y-r-10,26,this.hp,this.maxHp);
    }

    this._drawVetPip(ctx,r);
    this._drawSelection(ctx);
  }
}
