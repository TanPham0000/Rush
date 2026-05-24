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
    return this.x < rx+rw && this.x+this.w > rx && this.y < ry+rh && this.y+this.h > ry;
  }

  takeDmg(d: number) { super.takeDmg(d); this._flash = 0.12; }

  update(dt: number, _targets: Entity[], _proj: Projectile[]) {
    if (this._flash > 0) this._flash -= dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const pl = this.team === 'player';
    const base   = this._flash > 0 ? '#FFFFFF' : (pl ? C.allyBase   : C.enemyBase);
    const dark   = pl ? C.allyDark   : C.enemyDark;
    const accent = pl ? C.allyAccent : C.enemyAccent;
    const { x, y, w, h } = this;

    ctx.shadowColor = pl ? 'rgba(68,170,255,0.95)' : 'rgba(220,40,40,0.95)';
    ctx.shadowBlur  = this.selected ? 32 : 16;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x+5,y+5,w,h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = base; ctx.fillRect(x,y,w,h);
    ctx.fillStyle = pl ? C.allyChr : C.enemyLight; ctx.globalAlpha=0.18;
    ctx.fillRect(x,y,w,3); ctx.fillRect(x,y,3,h); ctx.globalAlpha=1;
    ctx.fillStyle = dark; ctx.fillRect(x+4,y+4,w-8,h-8);
    ctx.strokeStyle = pl ? 'rgba(68,170,255,0.35)' : 'rgba(255,85,34,0.35)';
    ctx.lineWidth=1; ctx.strokeRect(x+4,y+4,w-8,h-8);
    ctx.fillStyle = accent;

    if (this.type === 'Construction Yard') {
      ctx.fillRect(x+8,y+8,16,16); ctx.fillRect(x+w-24,y+8,16,16);
      ctx.fillRect(this.cx-1,y+4,2,h-8); ctx.fillRect(x+4,this.cy-1,w-8,2);
      ctx.strokeStyle=C.allyGold; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(this.cx,this.cy-4); ctx.lineTo(this.cx+14,this.cy-14); ctx.lineTo(this.cx+14,this.cy+8); ctx.stroke();
    } else if (this.type === 'Barracks') {
      ctx.fillRect(x+6,y+8,12,12); ctx.fillRect(x+w-18,y+8,12,12);
      ctx.fillStyle='#000'; ctx.fillRect(this.cx-8,y+h-16,16,16);
      ctx.fillStyle=C.allyGold; ctx.font='8px sans-serif'; ctx.textAlign='center';
      ctx.fillText('★',this.cx,this.cy+3); ctx.textAlign='left';
    } else if (this.type === 'Refinery') {
      ctx.beginPath(); ctx.arc(x+14,y+14,9,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+w-14,y+14,9,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=dark; ctx.fillRect(this.cx-2,y+8,4,h-14);
      ctx.fillStyle=C.tibGreen; ctx.beginPath(); ctx.arc(this.cx,y+h-12,9,0,Math.PI*2); ctx.fill();
    } else if (this.type === 'Power Plant') {
      const rings=[12,8,5];
      for(let i=0;i<rings.length;i++){
        ctx.beginPath(); ctx.arc(this.cx,this.cy,rings[i],0,Math.PI*2);
        ctx.strokeStyle=`rgba(255,${200-i*40},0,${0.9-i*0.2})`; ctx.lineWidth=3-i; ctx.stroke();
      }
      ctx.fillStyle='#FFD700'; ctx.beginPath();
      ctx.moveTo(this.cx+4,y+8); ctx.lineTo(this.cx-5,this.cy+2); ctx.lineTo(this.cx+2,this.cy+2);
      ctx.lineTo(this.cx-4,y+h-8); ctx.lineTo(this.cx+5,this.cy-2); ctx.lineTo(this.cx-2,this.cy-2);
      ctx.closePath(); ctx.fill();
    } else if (this.type === 'Tech Lab') {
      ctx.strokeStyle=accent; ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(x+10,y+12); ctx.lineTo(x+w-10,y+12);
      ctx.moveTo(x+10,this.cy); ctx.lineTo(x+w-10,this.cy);
      ctx.moveTo(x+10,y+h-12); ctx.lineTo(x+w-10,y+h-12);
      ctx.moveTo(x+16,y+12); ctx.lineTo(x+16,y+h-12);
      ctx.moveTo(x+w-16,y+12); ctx.lineTo(x+w-16,y+h-12); ctx.stroke();
      ctx.fillStyle=accent; ctx.fillRect(this.cx-8,this.cy-8,16,16);
      ctx.fillStyle=dark; ctx.fillRect(this.cx-5,this.cy-5,10,10);
      ctx.beginPath(); ctx.arc(this.cx,this.cy,3,0,Math.PI*2); ctx.fillStyle=C.allyGold; ctx.fill();
    } else if (this.type === 'War Factory') {
      ctx.fillStyle=accent;
      ctx.fillRect(x+6,y+6,22,22); ctx.fillRect(x+w-28,y+6,22,22); ctx.fillRect(x+8,y+h-22,w-16,16);
      ctx.fillStyle='#FF0000'; ctx.beginPath(); ctx.arc(this.cx,this.cy-6,11,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=dark;
      ctx.beginPath(); ctx.arc(this.cx-4,this.cy-8,3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.cx+4,this.cy-8,3,0,Math.PI*2); ctx.fill();
      ctx.fillRect(this.cx-7,this.cy-1,5,6); ctx.fillRect(this.cx+2,this.cy-1,5,6);
      if (this.hp < this.maxHp) {
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
    ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.font='bold 7px "Courier New"'; ctx.textAlign='center';
    ctx.fillText(this.type.toUpperCase(),this.cx,this.cy+3); ctx.textAlign='left';
    drawHpBar(ctx,this.cx,this.y-12,this.w+4,this.hp,this.maxHp);
  }
}

// ═══════════════════════════════════════════════════════════════
// TURRET
// ═══════════════════════════════════════════════════════════════
export class Turret extends Building {
  atkDmg   = 32;
  atkRange = 175;
  atkRate  = 1.3;
  atkCd    = 0;
  atkTarget: Entity | null = null;
  barrel   = -Math.PI / 2;
  disabled = false;
  projColor: string;

  constructor(cx: number, cy: number, team: Team = 'player') {
    super(cx, cy, 'Turret', team);
    this.projColor = team==='player' ? C.allyLight : C.enemyLight;
  }

  update(dt: number, targets: Entity[], projectiles: Projectile[]) {
    super.update(dt, targets, projectiles);
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
      this.barrel=lerpAngle(this.barrel,targetAng,Math.min(1,dt*5));
      let diff=targetAng-this.barrel;
      while(diff>Math.PI)diff-=Math.PI*2; while(diff<-Math.PI)diff+=Math.PI*2;
      if(this.atkCd<=0 && Math.abs(diff)<0.35){
        const d=hypot(this.cx,this.cy,this.atkTarget.cx,this.atkTarget.cy);
        if(d<=this.atkRange){
          projectiles.push(new Projectile(this.cx,this.cy,this.atkTarget,this.atkDmg,450,this.projColor));
          this.atkCd=1/this.atkRate;
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const {x,y,w,h}=this;
    const pl=this.team==='player';
    const base=this._flash>0?'#FFFFFF':(pl?C.allyDark:C.enemyDark);
    const accent=pl?C.allyAccent:C.enemyAccent;
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x+4,y+4,w,h);
    ctx.fillStyle=base; ctx.fillRect(x,y,w,h);
    ctx.strokeStyle=accent; ctx.lineWidth=1.5; ctx.strokeRect(x,y,w,h);
    ctx.beginPath(); ctx.moveTo(x+4,y+4); ctx.lineTo(x+w-4,y+h-4);
    ctx.moveTo(x+w-4,y+4); ctx.lineTo(x+4,y+h-4);
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1; ctx.stroke();
    if (this.selected) {
      ctx.beginPath(); ctx.arc(this.cx,this.cy,this.atkRange,0,Math.PI*2);
      ctx.strokeStyle='rgba(0,255,80,0.18)'; ctx.lineWidth=1; ctx.setLineDash([5,8]); ctx.stroke(); ctx.setLineDash([]);
      drawBrackets(ctx,x-4,y-4,w+8,h+8,7);
      ctx.strokeStyle=C.uiAccent; ctx.lineWidth=2; ctx.strokeRect(x-4,y-4,w+8,h+8);
    }
    ctx.beginPath(); ctx.arc(this.cx,this.cy,12,0,Math.PI*2);
    ctx.fillStyle=this.disabled?'#333':accent; ctx.fill();
    ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.stroke();
    const blen=22; ctx.save(); ctx.translate(this.cx,this.cy); ctx.rotate(this.barrel);
    ctx.fillStyle=this.disabled?'#555':'#EEE'; ctx.fillRect(0,-2.5,blen,5);
    ctx.fillStyle=this.disabled?'#444':'#AAA'; ctx.fillRect(blen-5,-3,5,6); ctx.restore();
    drawHpBar(ctx,this.cx,this.y-11,this.w+4,this.hp,this.maxHp);
    if(this.disabled){ctx.fillStyle='rgba(255,80,0,0.85)'; ctx.font='bold 7px "Courier New"'; ctx.textAlign='center'; ctx.fillText('NO PWR',this.cx,y-3); ctx.textAlign='left';}
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
  regenRate: number = 2.2;
  private _crystals: Array<{x:number;y:number;h:number;w:number;angle:number}>=[];

  constructor(cx: number, cy: number) {
    this.id=nextId(); this.cx=cx; this.cy=cy;
    this.capacity=rnd(800,1400); this.remaining=this.capacity;
    const n=rndi(12,20);
    for(let i=0;i<n;i++) this._crystals.push({x:cx+rnd(-36,36),y:cy+rnd(-36,36),h:rnd(12,24),w:rnd(4,8.5),angle:rnd(-0.3,0.3)});
  }

  isEmpty()  { return this.remaining<=0; }
  pct()      { return clamp(this.remaining/this.capacity,0,1); }
  harvest(dt:number,rate:number){ const amt=Math.min(rate*dt,this.remaining); this.remaining-=amt; return amt; }
  regen(dt:number){ if(this.remaining<this.capacity) this.remaining=Math.min(this.capacity,this.remaining+this.regenRate*dt); }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    const p=this.pct(); if(p<=0)return;
    const stain=ctx.createRadialGradient(this.cx,this.cy,0,this.cx,this.cy,this.radius*p);
    stain.addColorStop(0,`rgba(0,200,70,${0.13*p})`); stain.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=stain; ctx.beginPath(); ctx.arc(this.cx,this.cy,this.radius*p,0,Math.PI*2); ctx.fill();
    // Animated pulse (shimmer)
    const pulse=0.85+0.15*Math.sin(t*2.2);
    const green=Math.floor(120+p*135);
    for(const c of this._crystals){
      const sh=c.h*p*pulse; ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.angle);
      ctx.fillStyle=`rgb(0,${green},${Math.floor(green*0.28)})`;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-c.w/2,sh); ctx.lineTo(c.w/2,sh); ctx.closePath(); ctx.fill();
      ctx.fillStyle=`rgba(${Math.floor(green*0.3)},${Math.min(255,green+90)},${Math.floor(green*0.5)},0.7)`;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-c.w/4,sh*0.45); ctx.lineTo(c.w/4,sh*0.45); ctx.closePath(); ctx.fill();
      // Inner glow shimmer
      ctx.globalAlpha=0.3+0.2*Math.sin(t*3.1+c.x);
      ctx.fillStyle=`rgba(0,255,120,0.5)`;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-c.w/6,sh*0.3); ctx.lineTo(c.w/6,sh*0.3); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1;
      ctx.restore();
    }
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(this.cx-24,this.cy+this.radius-3,48,4);
    ctx.fillStyle=`rgba(0,${Math.floor(200*p+40)},60,0.9)`; ctx.fillRect(this.cx-24,this.cy+this.radius-3,48*p,4);
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
  holdTimer:    number = 0;
  label:        string;
  blackMarketClaimed: boolean = false;

  constructor(cx:number,cy:number,label:string,income=4,isCenter=false,isBlackMarket=false){
    this.id=nextId(); this.cx=cx; this.cy=cy; this.label=label;
    this.income=income; this.isCenter=isCenter; this.isBlackMarket=isBlackMarket;
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
    ctx.fillText(this.isBlackMarket?'🏴 '+this.label:this.label,this.cx,this.cy+this.radius+14);
    if(this.team!=='neutral'){ctx.fillStyle=col; ctx.fillText(this.team.toUpperCase(),this.cx,this.cy+5);}
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
  speed:   number=65;   // base infantry speed (reduced from 85)
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

  moveTo(tx:number,ty:number){ this.moveTarget={x:tx,y:ty}; this.atkTarget=null; this.guardPos=null; this.retreating=false; }
  attack(t:Entity){ this.atkTarget=t; this.moveTarget=null; }
  stop()  { this.moveTarget=null; this.atkTarget=null; this.retreating=false; }
  guard() { this.guardPos={x:this.x,y:this.y}; this.atkTarget=null; this.moveTarget=null; this.retreating=false; }

  takeDmg(d:number){
    if(this._game?.terrain&&!(this instanceof Tank)&&!(this instanceof HeavyTank)){
      const cover=this._game.terrain.coverMult(this.x,this.y);
      d*=(1-cover);
    }
    super.takeDmg(d);
    this._flash=0.07;
    // Suppression: heavy fire slows you down
    if(d>8) this._suppressTimer=Math.min(2.5,this._suppressTimer+0.6);
  }

  update(dt:number,allUnits:Unit[],projectiles:Projectile[]){
    if(this.atkCd>0) this.atkCd-=dt;
    if(this._flash>0) this._flash-=dt;
    if(this._suppressTimer>0) this._suppressTimer-=dt;

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

  _makeProjectile(target:Entity): Projectile {
    const p=new Projectile(this.x,this.y,target,this.atkDmg,420,this.projColor);
    p.firedBy=this;
    return p;
  }

  _towards(tx:number,ty:number,dt:number){
    const dx=tx-this.x,dy=ty-this.y;
    const d=Math.hypot(dx,dy); if(d<0.1)return;
    this.angle=Math.atan2(dy,dx);
    const sm=this._game?.terrain.speedMult(this.x,this.y)??1;
    const suppress=this._suppressTimer>0?0.5:1;
    const spd=this.speed*sm*this._speedMult*suppress;
    this.x+=(dx/d)*spd*dt; this.y+=(dy/d)*spd*dt;
  }

  _separate(units:Unit[]){
    for(const o of units){
      if(o===this)continue;
      const dx=this.x-o.x,dy=this.y-o.y;
      const d=Math.hypot(dx,dy);
      if(d<0.01)continue;
      const hard=(this.radius+o.radius)*1.05;  // no-overlap zone
      const soft=(this.radius+o.radius)*2.8;   // personal-space zone
      if(d<hard){
        const push=(hard-d)*0.35;
        this.x+=(dx/d)*push; this.y+=(dy/d)*push;
      } else if(d<soft){
        const push=(soft-d)*0.045;
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
    const base=pl?C.allyBase:C.enemyBase; const dark=pl?C.allyDark:C.enemyDark;
    const r=this.radius;
    ctx.beginPath();ctx.arc(this.x+2,this.y+2,r,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fill();
    if(!this._flash){
      ctx.shadowBlur=12;ctx.shadowColor=pl?C.allyAccent:C.enemyAccent;
      ctx.beginPath();ctx.arc(this.x,this.y,r+3,0,Math.PI*2);
      ctx.fillStyle=pl?'rgba(68,170,255,0.22)':'rgba(255,85,34,0.22)';ctx.fill();ctx.shadowBlur=0;
    }
    const inCover=this._game?.terrain.coverMult(this.x,this.y)??0;
    ctx.beginPath();ctx.arc(this.x,this.y,r,0,Math.PI*2);ctx.fillStyle=this._flash>0?'#FFF':base;ctx.fill();
    if(inCover>0&&!this._flash){ctx.globalAlpha=inCover*0.4;ctx.fillStyle='#001A00';ctx.beginPath();ctx.arc(this.x,this.y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    ctx.strokeStyle=pl?C.allyLight:C.enemyLight;ctx.lineWidth=1.5;ctx.stroke();
    ctx.beginPath();ctx.arc(this.x,this.y,r*0.42,0,Math.PI*2);ctx.fillStyle=this._flash>0?'#EEE':dark;ctx.fill();
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.angle);
    ctx.beginPath();ctx.arc(r*0.62,0,3,0,Math.PI*2);ctx.fillStyle=this._flash>0?'#FFF':(pl?C.allyGold:C.enemyAccent);ctx.fill();
    ctx.restore();
    if(this.retreating){ctx.strokeStyle='#FFAA00';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(this.x-8,this.y);ctx.lineTo(this.x,this.y-12);ctx.stroke();}
    // Suppression indicator
    if(this._suppressTimer>0){
      ctx.fillStyle='rgba(255,200,0,0.6)';ctx.font='6px "Courier New"';ctx.textAlign='center';
      ctx.fillText('SUP',this.x,this.y-r-3);ctx.textAlign='left';
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
  splashRadius = 40;

  constructor(x:number,y:number,team:Team='player'){
    super(x,y,team);
    this.hp=this.maxHp=110; this.atkDmg=18; this.atkRange=70; this.atkRate=0.9;
    this.autoAtkRange=150; this.speed=60;
    this.projColor=team==='player'?'#FF8800':'#FF6600';
  }

  _makeProjectile(target:Entity): Projectile {
    const p=new Projectile(this.x,this.y,target,this.atkDmg,380,this.projColor);
    p.splash=this.splashRadius; p.firedBy=this;
    return p;
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,4,0,Math.PI*2);ctx.fillStyle='#FF8800';ctx.fill();return;}
    super.draw(ctx,dotMode);
    // Orange stripe to distinguish from Infantry
    const r=this.radius;
    ctx.beginPath();ctx.arc(this.x,this.y,r*0.42,0,Math.PI*2);
    ctx.fillStyle='#FF8800';ctx.fill();
  }
}

// ═══════════════════════════════════════════════════════════════
// TANK
// ═══════════════════════════════════════════════════════════════
export class Tank extends Unit {
  private _barrelAngle=-Math.PI/2;

  constructor(x:number,y:number,team:Team='player'){
    super(x,y,team);
    this.radius=12; this.speed=32; this.hp=this.maxHp=320;
    this.atkDmg=46; this.atkRange=100; this.atkRate=0.65;
    this.projColor=team==='player'?'#FFDD44':'#FF8800';
    this.autoAtkRange=180;
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
    ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(this.x-r+3,this.y-r+3,r*2,r*2);
    ctx.fillStyle=this._flash>0?'#FFF':base;ctx.fillRect(this.x-r,this.y-r,r*2,r*2);
    ctx.strokeStyle=dark;ctx.lineWidth=2;ctx.strokeRect(this.x-r,this.y-r,r*2,r*2);
    ctx.fillStyle='rgba(0,0,0,0.25)';ctx.fillRect(this.x-r,this.y-r,5,r*2);ctx.fillRect(this.x+r-5,this.y-r,5,r*2);
    ctx.beginPath();ctx.arc(this.x,this.y,r*0.55,0,Math.PI*2);ctx.fillStyle=dark;ctx.fill();
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this._barrelAngle);
    ctx.fillStyle=pl?'#AACCFF':'#FF8866';ctx.fillRect(0,-3,r*1.9,6);
    ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(r*1.2,-3,r*0.7,6);ctx.restore();
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
    this.radius=15; this.speed=26;
    this.hp=this.maxHp=500; this.atkDmg=60; this.atkRate=0.55;
    this.projColor=team==='player'?'#00AAFF':'#FF4400';
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,6,0,Math.PI*2);ctx.fillStyle=this.team==='player'?'#00AAFF':'#FF4400';ctx.fill();return;}
    super.draw(ctx,dotMode);
    // Extra armor stripe
    const r=this.radius;
    ctx.strokeStyle=this.team==='player'?'#00AAFF':'#FF4400';ctx.lineWidth=2;
    ctx.strokeRect(this.x-r,this.y-r,r*2,r*2);
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
    this.radius=14; this.speed=30; this.hp=this.maxHp=180;
    this.atkDmg=85; this.atkRange=280; this.atkRate=0.35;
    this.autoAtkRange=300; this.projColor=team==='player'?'#FFEE00':'#FF6600';
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
    const base=this._flash>0?'#FFF':(pl?'#224488':'#442200');

    ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(this.x-r+3,this.y-r+3,r*2,r*2);
    ctx.fillStyle=base;ctx.fillRect(this.x-r,this.y-r,r*2,r*2);
    ctx.strokeStyle=pl?'#4488FF':'#FF6600';ctx.lineWidth=2;ctx.strokeRect(this.x-r,this.y-r,r*2,r*2);

    if(this.deployed){
      // Deploy legs
      ctx.strokeStyle='rgba(100,100,80,0.8)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(this.x-r,this.y+r*0.4);ctx.lineTo(this.x-r-10,this.y+r+6);ctx.stroke();
      ctx.beginPath();ctx.moveTo(this.x+r,this.y+r*0.4);ctx.lineTo(this.x+r+10,this.y+r+6);ctx.stroke();
    }

    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this._barrelAngle);
    ctx.fillStyle=pl?'#AACCFF':'#FF8844';ctx.fillRect(0,-4,r*2.4,8);
    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(r*1.6,-4,r*0.8,8);ctx.restore();

    // Deploy indicator
    if(!this.deployed&&!this.moveTarget){
      const pct=this._deployTimer;
      ctx.fillStyle='rgba(255,220,0,0.7)';ctx.font='6px "Courier New"';ctx.textAlign='center';
      ctx.fillText('DEPLOYING',this.x,this.y-r-4);
      ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(this.x-16,this.y-r-1,32,4);
      ctx.fillStyle='#FFD700';ctx.fillRect(this.x-16,this.y-r-1,32*pct,4);ctx.textAlign='left';
    }

    this._drawVetPip(ctx,r);
    this._drawSelection(ctx);
    drawHpBar(ctx,this.x,this.y-r-12,30,this.hp,this.maxHp);
  }
}

// ═══════════════════════════════════════════════════════════════
// SCOUT
// ═══════════════════════════════════════════════════════════════
export class Scout extends Unit {
  visionRadius=400;

  constructor(x:number,y:number,team:Team='player'){
    super(x,y,team);
    this.radius=6; this.speed=135; this.hp=this.maxHp=45;
    this.atkDmg=8; this.atkRange=55; this.atkRate=1.8;
    this.autoAtkRange=120;
    this.projColor=team==='player'?'#00FFCC':'#FF8844';
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,3,0,Math.PI*2);ctx.fillStyle='#00FFCC';ctx.fill();return;}
    const pl=this.team==='player'; const r=this.radius;
    // Diamond shape
    const base=this._flash>0?'#FFF':(pl?'#00DDAA':'#FF8844');
    ctx.beginPath();
    ctx.moveTo(this.x,this.y-r*1.5);ctx.lineTo(this.x+r,this.y);
    ctx.lineTo(this.x,this.y+r*1.5);ctx.lineTo(this.x-r,this.y);ctx.closePath();
    ctx.fillStyle=base;ctx.fill();
    ctx.strokeStyle=pl?C.allyLight:C.enemyLight;ctx.lineWidth=1;ctx.stroke();
    if(this.selected){
      ctx.beginPath();ctx.arc(this.x,this.y,this.visionRadius,0,Math.PI*2);
      ctx.strokeStyle='rgba(0,255,200,0.12)';ctx.lineWidth=1;ctx.setLineDash([5,8]);ctx.stroke();ctx.setLineDash([]);
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
    this.radius=10; this.speed=42; this.hp=this.maxHp=140;
    this.atkDmg=72; this.atkRange=120; this.atkRate=0.7;
    this.autoAtkRange=160;
    this.projColor=team==='player'?'#FF4400':'#FF8800';
  }

  _makeProjectile(target:Entity): Projectile {
    // Extra damage vs tanks
    let dmg=this.atkDmg;
    if(target instanceof Tank||target instanceof HeavyTank) dmg*=1.6;
    if(target instanceof Unit&&!(target instanceof Tank)&&!(target instanceof HeavyTank)&&target.radius<=8) dmg*=0.55;
    const p=new Projectile(this.x,this.y,target,dmg,520,this.projColor);
    p.firedBy=this;
    return p;
  }

  update(dt:number,allUnits:Unit[],projectiles:Projectile[]){
    super.update(dt,allUnits,projectiles);
    const target=this.atkTarget??(this.moveTarget?{cx:this.moveTarget.x,cy:this.moveTarget.y}:null);
    if(target){const ang=Math.atan2(target.cy-this.y,target.cx-this.x);this._barrelAngle=lerpAngle(this._barrelAngle,ang,Math.min(1,dt*5));}
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,4,0,Math.PI*2);ctx.fillStyle='#FF4400';ctx.fill();return;}
    const pl=this.team==='player'; const r=this.radius;
    ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(this.x-r+2,this.y-r+2,r*2,r*2);
    ctx.fillStyle=this._flash>0?'#FFF':(pl?'#334422':'#443322');ctx.fillRect(this.x-r,this.y-r,r*2,r*2);
    ctx.strokeStyle='#FF4400';ctx.lineWidth=2;ctx.strokeRect(this.x-r,this.y-r,r*2,r*2);
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this._barrelAngle);
    ctx.fillStyle='#FF6622';ctx.fillRect(0,-3,r*2.2,6);
    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(r*1.5,-3,r*0.7,6);ctx.restore();
    ctx.fillStyle='#FF4400';ctx.font='5px "Courier New"';ctx.textAlign='center';
    ctx.fillText('AT',this.x,this.y+2);ctx.textAlign='left';
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
  maxCargo:    number=140;
  harvestRate: number=24;
  targetField: TiberiumField|null=null;
  private _refinery: Building|null=null;

  constructor(x:number,y:number,game:GameRef){
    super(x,y,'player');
    this._game=game; this.radius=10; this.speed=62;
    this.hp=this.maxHp=200; this.autoAtk=false;
  }

  update(dt:number,allUnits:Unit[],_proj:Projectile[]){
    if(this._flash>0)this._flash-=dt;
    const g=this._game!;
    if(!this._refinery?.isAlive()) this._refinery=g.buildings.find(b=>b.type==='Refinery'&&b.team==='player')??null;
    if(this.state==='idle'){
      if(!this._refinery)return;
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
        if(!this._refinery){this.state='idle';return;}
        this.state='returning'; this.moveTo(this._refinery.cx,this._refinery.cy); return;
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
    const{x,y}=this;const r=this.radius;
    ctx.fillStyle='rgba(0,0,0,0.32)';ctx.fillRect(x-r+2,y-r+2,r*2,r*2);
    ctx.fillStyle=this._flash>0?'#FFF':'#DDAA00';ctx.fillRect(x-r,y-r,r*2,r*2);
    ctx.strokeStyle='#997700';ctx.lineWidth=1.5;ctx.strokeRect(x-r,y-r,r*2,r*2);
    if(this.cargo>0){const cp=this.cargo/this.maxCargo;ctx.fillStyle=hexA(C.tibGreen,cp*0.75);ctx.fillRect(x-r+2,y+r-2-(r*2-4)*cp,r*2-4,(r*2-4)*cp);}
    const labels:Record<HState,string>={idle:'IDL','to-field':'→TIB',harvesting:'HARV',returning:'LOAD'};
    ctx.fillStyle='rgba(0,0,0,0.75)';ctx.font='6px "Courier New"';ctx.textAlign='center';
    ctx.fillText(labels[this.state],x,y+2.5);ctx.textAlign='left';
    if(this.selected){ctx.strokeStyle=C.uiAccent;ctx.lineWidth=2;ctx.strokeRect(x-r-5,y-r-5,r*2+10,r*2+10);}
    drawHpBar(ctx,x,y-r-10,24,this.hp,this.maxHp);
    // Cargo bar below HP bar
    const cw=24,ch=3,cbx=x-cw/2,cby=y-r-6;
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
    this.speed=opts.speed??40; this.atkDmg=opts.dmg??11; this.atkRate=opts.rate??1.0;
    this.atkRange=opts.range??56; this.hp=this.maxHp=opts.hp??100;
    this.radius=opts.radius??8; this.isTank=opts.tank??false; this.isHeavy=opts.heavy??false;
    this.aggroRange=opts.aggro??240; this.projColor=this.isTank?C.enemyLight:C.enemyAccent;
    this.autoAtk=false; this._pauseTimer=rnd(0.5,1.5);
    this._homeX=x; this._homeY=y;
    if(this.isTank){
      this.radius=12; this.speed=32;
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
    return{x:goal.cx,y:goal.cy};
  }

  draw(ctx:CanvasRenderingContext2D,dotMode=false){
    if(this.isTank)this._drawTank(ctx,dotMode);
    else super.draw(ctx,dotMode);
  }

  private _drawTank(ctx:CanvasRenderingContext2D,dotMode=false){
    if(dotMode){ctx.beginPath();ctx.arc(this.x,this.y,this.isHeavy?7:5,0,Math.PI*2);ctx.fillStyle=this.isHeavy?'#FF4400':C.enemyLight;ctx.fill();return;}
    const r=this.radius;
    ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(this.x-r+3,this.y-r+3,r*2,r*2);
    ctx.fillStyle=this._flash>0?'#FFF':C.enemyBase;ctx.fillRect(this.x-r,this.y-r,r*2,r*2);
    ctx.strokeStyle=this.isHeavy?'#FF4400':C.enemyDark;ctx.lineWidth=this.isHeavy?2.5:2;ctx.strokeRect(this.x-r,this.y-r,r*2,r*2);
    ctx.fillStyle='rgba(0,0,0,0.25)';ctx.fillRect(this.x-r,this.y-r,4,r*2);ctx.fillRect(this.x+r-4,this.y-r,4,r*2);
    ctx.beginPath();ctx.arc(this.x,this.y,r*0.55,0,Math.PI*2);ctx.fillStyle=C.enemyDark;ctx.fill();
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this._barrelAngle);
    ctx.fillStyle=this.isHeavy?'#FF4400':C.enemyLight;ctx.fillRect(0,-3,r*1.9,6);ctx.restore();
    this._drawVetPip(ctx,r);
    this._drawSelection(ctx);
    drawHpBar(ctx,this.x,this.y-r-10,26,this.hp,this.maxHp);
  }
}
