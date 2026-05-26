import { MAP_W, MAP_H, GRID, C } from './constants';
import type { MapTheme, ImpassableZone } from './constants';
import { rnd, rndi } from './utils';

export interface ForestZone  { x: number; y: number; w: number; h: number }
export interface HighGround  { x: number; y: number; w: number; h: number }
export interface RockCluster { cx: number; cy: number; r: number }
export interface Bridge      { yc: number; hy: number }
export interface CityBlock   { x: number; y: number; w: number; h: number }

export class TerrainMap {
  readonly theme: MapTheme;

  // ── Theme 0 (rivers) ─────────────────────────────────────
  readonly riverX = (y: number) => 900 + 60 * Math.sin(y * 0.0045);
  readonly rW = 64;
  readonly bridges: Bridge[]        = [];
  readonly forests: ForestZone[]    = [];
  readonly highGround: HighGround[] = [];
  readonly rocks: RockCluster[]     = [];
  readonly cityBlocks: CityBlock[]  = [];
  cliffZones: ImpassableZone[]      = [];

  private _off:   HTMLCanvasElement;
  private _trees: Array<{ x:number; y:number; r:number; shade:string }> = [];

  constructor(theme: MapTheme = 0, cliffZones: ImpassableZone[] = []) {
    this.theme      = theme;
    this.cliffZones = cliffZones;
    this._off        = document.createElement('canvas');
    this._off.width  = MAP_W;
    this._off.height = MAP_H;
    this._initLayout();
    this._buildTrees();
    this._render();
  }

  private _initLayout() {
    if      (this.theme === 0) this._initRivers();
    else if (this.theme === 1) this._initHills();
    else if (this.theme === 2) this._initCity();
    else if (this.theme === 3) this._initBeach();
    else                       this._initDesert();
  }

  // ── RIVERS layout ──────────────────────────────────────
  private _initRivers() {
    (this.bridges as Bridge[]).push(
      { yc: 310, hy: 50 }, { yc: 620, hy: 50 }, { yc: 930, hy: 50 }
    );
    (this.forests as ForestZone[]).push(
      { x:  370, y:  110, w: 230, h: 180 }, { x:  390, y:  880, w: 220, h: 180 },
      { x:  180, y:  520, w: 145, h: 110 }, { x: 1110, y:  110, w: 210, h: 170 },
      { x: 1090, y:  890, w: 230, h: 180 }, { x: 1420, y:  460, w: 130, h: 100 },
    );
    (this.highGround as HighGround[]).push(
      { x:  190, y:  390, w: 190, h: 150 }, { x:  200, y:   30, w: 160, h: 100 },
      { x: 1370, y:  400, w: 190, h: 150 }, { x: 1450, y: 1080, w: 150, h: 100 },
    );
    (this.rocks as RockCluster[]).push(
      { cx:  650, cy:  430, r: 36 }, { cx:  630, cy:  790, r: 30 },
      { cx: 1120, cy:  530, r: 34 }, { cx: 1190, cy:  810, r: 32 },
      { cx:  840, cy:  615, r: 28 }, { cx:  980, cy:  385, r: 26 },
      { cx:  460, cy:  110, r: 24 }, { cx: 1380, cy:  240, r: 24 },
      { cx:  530, cy: 1090, r: 22 }, { cx: 1300, cy: 1050, r: 22 },
    );
  }

  // ── HILLS layout ──────────────────────────────────────
  // Two cliff ridgelines divide the map into 3 routes (see map impassableZones).
  // High ground zones are clustered at ridge flanks — ideal Artillery/Marksman positions.
  private _initHills() {
    (this.forests as ForestZone[]).push(
      // Player-side cover
      { x:  60,  y:  180, w: 280, h: 220 }, { x:  60,  y:  700, w: 260, h: 230 },
      { x:  300, y:  920, w: 200, h: 180 }, { x:  360, y:   40, w: 180, h: 160 },
      // Between ridge 1 and ridge 2 — contested center
      { x:  650, y:  120, w: 200, h: 160 }, { x:  680, y:  880, w: 200, h: 180 },
      // Enemy-side dense forest
      { x: 1280, y:  480, w: 240, h: 200 }, { x: 1440, y:  820, w: 240, h: 200 },
      { x: 1050, y:   60, w: 220, h: 160 },
    );
    // High ground flanks the ridge passes — put Artillery here to control the routes
    (this.highGround as HighGround[]).push(
      // West of ridge 1, flanking the center pass (y≈410–620)
      { x:  280, y:  380, w: 200, h: 200 },
      // East of ridge 1, center pass overlook
      { x:  620, y:  400, w: 180, h: 200 },
      // West of ridge 2, center pass overlook
      { x:  830, y:  370, w: 200, h: 220 },
      // East of ridge 2, above enemy lines
      { x: 1160, y:  400, w: 200, h: 200 },
      // North corridor flanks — ideal Marksman overwatch
      { x:  300, y:   40, w: 180, h: 140 },
      { x:  740, y:   40, w: 200, h: 160 },
      { x: 1200, y:   40, w: 200, h: 160 },
      // Enemy high-ground stronghold
      { x: 1380, y:  200, w: 260, h: 200 },
    );
    (this.rocks as RockCluster[]).push(
      // Ridge-face rocks — visual cue for impassable zones
      { cx:  490, cy:  290, r: 44 }, { cx:  550, cy:  530, r: 40 },
      { cx:  490, cy:  740, r: 44 }, { cx: 1020, cy:  300, r: 40 },
      { cx: 1080, cy:  500, r: 38 }, { cx: 1020, cy:  720, r: 40 },
      // Scattered rocks
      { cx:  700, cy:  580, r: 32 }, { cx:  860, cy:  220, r: 30 },
      { cx:  950, cy:  900, r: 32 }, { cx: 1300, cy:  680, r: 28 },
      { cx:  420, cy: 1020, r: 28 }, { cx: 1560, cy:  380, r: 26 },
    );
  }

  // ── CITY layout ──────────────────────────────────────
  private _initCity() {
    // City blocks act like large rock clusters for cover
    const blockDefs: [number, number, number, number][] = [
      // West district
      [100,100,120,100],  [100,280,130,110], [100,480,120,100],
      [100,680,130,110],  [100,900,120,100], [100,1050,130,100],
      [280,100,140,110],  [280,280,130,100], [280,480,120,100],
      [280,680,140,110],  [280,900,130,100],
      // Center-west
      [500,80,130,100],   [500,280,120,110], [500,500,130,100],
      [500,700,120,100],  [500,900,130,110], [500,1060,120,100],
      // Center
      [700,180,120,100],  [700,400,130,110], [700,800,120,100],
      [700,1000,130,100],
      // Center-east
      [1150,80,130,100],  [1150,280,120,110],[1150,480,130,100],
      [1150,700,120,100], [1150,900,130,110],[1150,1060,120,100],
      // East district
      [1380,100,140,110], [1380,280,130,100],[1380,480,120,100],
      [1380,680,140,110], [1380,900,130,100],
      [1550,100,120,100], [1550,280,130,110],[1550,480,120,100],
      [1550,680,130,110], [1550,900,120,100],[1550,1050,130,100],
    ];
    for (const [x,y,w,h] of blockDefs) {
      (this.cityBlocks as CityBlock[]).push({ x, y, w, h });
    }
  }

  private _buildTrees() {
    for (const f of this.forests) {
      const n = rndi(18, 28);
      for (let i = 0; i < n; i++) {
        const r = rnd(5, 11);
        const shades = ['#162414','#1A2C16','#1E3418','#243C1C','#122010','#0E1C0E'];
        this._trees.push({
          x: f.x + rnd(r, f.w - r), y: f.y + rnd(r, f.h - r),
          r, shade: shades[rndi(0, shades.length)],
        });
      }
    }
  }

  private _initDesert() {
    // Sparse rock outcroppings in base areas and corridor edges
    (this.rocks as RockCluster[]).push(
      { cx:  680, cy:  180, r: 26 }, { cx: 1120, cy:  220, r: 22 },
      { cx:  730, cy: 1020, r: 24 }, { cx: 1070, cy:  980, r: 22 },
      { cx:  900, cy:  520, r: 18 }, { cx:  900, cy:  680, r: 18 },
      { cx:  760, cy:  100, r: 20 }, { cx: 1040, cy:  100, r: 20 },
      { cx:  760, cy: 1100, r: 20 }, { cx: 1040, cy: 1100, r: 20 },
    );
    // Sand dune mounds in base areas for cover
    (this.highGround as HighGround[]).push(
      { x: 580, y:  60, w: 180, h: 110 }, { x: 1020, y:  80, w: 160, h: 100 },
      { x: 580, y: 980, w: 180, h: 110 }, { x: 1020, y:1000, w: 160, h: 100 },
    );
  }

  private _render() {
    if      (this.theme === 0) this._renderRivers();
    else if (this.theme === 1) this._renderHills();
    else if (this.theme === 2) this._renderCity();
    else if (this.theme === 3) this._renderBeach();
    else                       this._renderDesert();
  }

  // ══════════════════════════════════════════════════════════
  // THEME 0 — RIVERS
  // ══════════════════════════════════════════════════════════
  private _renderRivers() {
    const c = this._off.getContext('2d')!;

    const gGround = c.createRadialGradient(MAP_W*0.45,MAP_H*0.5,0,MAP_W*0.45,MAP_H*0.5,MAP_W*0.65);
    gGround.addColorStop(0, '#354226'); gGround.addColorStop(0.6, C.ground); gGround.addColorStop(1, C.groundAlt);
    c.fillStyle = gGround; c.fillRect(0, 0, MAP_W, MAP_H);

    const patches = [
      [280,160,240,160],[800,400,200,140],[1240,200,180,120],[400,700,220,180],
      [1000,900,260,140],[1400,720,160,120],[160,900,180,120],[1520,300,140,100],
      [600,1050,180,100],[1100,50,160,100],[350,50,140,90],[1600,600,120,100],
    ];
    for (const [px,py,pw,ph] of patches) {
      c.fillStyle = C.groundAlt; c.globalAlpha = 0.45;
      c.beginPath(); c.ellipse(px+pw/2,py+ph/2,pw/2,ph/2,0,0,Math.PI*2); c.fill();
      c.globalAlpha = 1;
    }

    c.strokeStyle = 'rgba(0,200,70,0.07)'; c.lineWidth = 0.5;
    for (let x = 0; x < MAP_W; x += GRID) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,MAP_H); c.stroke(); }
    for (let y = 0; y < MAP_H; y += GRID) { c.beginPath(); c.moveTo(0,y); c.lineTo(MAP_W,y); c.stroke(); }

    const ry = this.riverX(584);
    const drawRoad = (x:number,y:number,w:number,h:number,horiz:boolean) => {
      c.fillStyle = C.road; c.fillRect(x,y,w,h);
      c.fillStyle = 'rgba(100,90,50,0.5)';
      if (horiz) { c.fillRect(x,y,w,1); c.fillRect(x,y+h-1,w,1); }
      else       { c.fillRect(x,y,1,h); c.fillRect(x+w-1,y,1,h); }
      c.strokeStyle = 'rgba(160,140,60,0.4)'; c.lineWidth=1; c.setLineDash([10,12]);
      c.beginPath();
      if (horiz) { c.moveTo(x,y+h/2); c.lineTo(x+w,y+h/2); }
      else       { c.moveTo(x+w/2,y); c.lineTo(x+w/2,y+h); }
      c.stroke(); c.setLineDash([]);
    };
    drawRoad(0,576,ry-this.rW/2-2,18,true);
    drawRoad(ry+this.rW/2+2,576,MAP_W-(ry+this.rW/2+2),18,true);
    drawRoad(268,0,18,MAP_H,false);
    drawRoad(1520,0,16,MAP_H,false);

    for (const h of this.highGround) {
      const hg = c.createLinearGradient(h.x,h.y,h.x,h.y+h.h);
      hg.addColorStop(0,'#485628'); hg.addColorStop(1,C.highGround);
      c.fillStyle=hg; c.fillRect(h.x,h.y,h.w,h.h);
      c.strokeStyle='rgba(100,130,50,0.5)'; c.lineWidth=1;
      for (let i=1;i<4;i++){const p=i*11;c.strokeRect(h.x+p,h.y+p,h.w-p*2,h.h-p*2);}
      const gs=c.createLinearGradient(h.x,h.y+h.h-16,h.x,h.y+h.h+8);
      gs.addColorStop(0,'rgba(0,0,0,0)'); gs.addColorStop(1,'rgba(0,0,0,0.45)');
      c.fillStyle=gs; c.fillRect(h.x,h.y+h.h-16,h.w,24);
      c.fillStyle='rgba(140,180,60,0.35)'; c.font='bold 9px "Courier New"'; c.textAlign='center';
      c.fillText('▲ HIGH',h.x+h.w/2,h.y+h.h/2+4); c.textAlign='left';
    }

    for (const f of this.forests) { c.fillStyle=C.forest; c.fillRect(f.x,f.y,f.w,f.h); }
    for (const t of this._trees) {
      c.beginPath(); c.arc(t.x,t.y,t.r,0,Math.PI*2); c.fillStyle=t.shade; c.fill();
      c.beginPath(); c.arc(t.x-t.r*0.25,t.y-t.r*0.25,t.r*0.42,0,Math.PI*2);
      c.fillStyle='rgba(60,90,30,0.4)'; c.fill();
    }

    this._drawRocks(c);

    // River
    const steps=4;
    const riverGrad=c.createLinearGradient(840,0,960,0);
    riverGrad.addColorStop(0,'#0A3060'); riverGrad.addColorStop(0.3,'#1555A0');
    riverGrad.addColorStop(0.5,'#1A6ABB'); riverGrad.addColorStop(0.7,'#1555A0'); riverGrad.addColorStop(1,'#0A3060');
    c.fillStyle=riverGrad;
    c.beginPath(); c.moveTo(this.riverX(0)-this.rW/2,0);
    for(let y=steps;y<=MAP_H;y+=steps) c.lineTo(this.riverX(y)-this.rW/2,y);
    for(let y=MAP_H;y>=0;y-=steps)    c.lineTo(this.riverX(y)+this.rW/2,y);
    c.closePath(); c.fill();
    for(let i=0;i<5;i++){
      const offset=(i-2)*(this.rW/5);
      c.globalAlpha=0.22+(i%2)*0.1; c.strokeStyle=C.riverShim; c.lineWidth=i%2===0?1.5:0.8;
      c.beginPath(); c.moveTo(this.riverX(0)+offset,0);
      for(let y=steps;y<=MAP_H;y+=steps) c.lineTo(this.riverX(y)+offset,y);
      c.stroke();
    }
    c.globalAlpha=1;
    for(let side=-1;side<=1;side+=2){
      const bank=c.createLinearGradient(0,0,side*18,0);
      bank.addColorStop(0,'rgba(0,0,0,0.3)'); bank.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=bank;
      c.beginPath();
      if(side===-1){
        c.moveTo(this.riverX(0)-this.rW/2,0);
        for(let y=steps;y<=MAP_H;y+=steps) c.lineTo(this.riverX(y)-this.rW/2,y);
        for(let y=MAP_H;y>=0;y-=steps)    c.lineTo(this.riverX(y)-this.rW/2-16,y);
      } else {
        c.moveTo(this.riverX(0)+this.rW/2,0);
        for(let y=steps;y<=MAP_H;y+=steps) c.lineTo(this.riverX(y)+this.rW/2,y);
        for(let y=MAP_H;y>=0;y-=steps)    c.lineTo(this.riverX(y)+this.rW/2+16,y);
      }
      c.closePath(); c.fill();
    }

    for(const b of this.bridges){
      const y1=b.yc-b.hy,y2=b.yc+b.hy;
      for(let y=y1;y<=y2;y+=2){ const rx=this.riverX(y); c.fillStyle=C.bridge; c.fillRect(rx-this.rW/2-3,y,this.rW+6,2); }
      c.fillStyle='#38362A';
      for(let y=y1;y<y2;y+=9){ const rx=this.riverX(y); c.fillRect(rx-this.rW/2,y,this.rW,5); }
      c.strokeStyle='#4A4436'; c.lineWidth=2.5;
      for(const side of[-1,1]){
        c.beginPath(); c.moveTo(this.riverX(y1)+side*(this.rW/2+4),y1);
        for(let y=y1;y<=y2;y+=2) c.lineTo(this.riverX(y)+side*(this.rW/2+4),y); c.stroke();
      }
      c.fillStyle='rgba(120,110,60,0.4)'; c.font='bold 8px "Courier New"'; c.textAlign='center';
      c.fillText('BRIDGE',this.riverX(b.yc),b.yc+3); c.textAlign='left';
    }
  }

  // ══════════════════════════════════════════════════════════
  // THEME 1 — HILLS
  // ══════════════════════════════════════════════════════════
  private _renderHills() {
    const c = this._off.getContext('2d')!;

    // Gradient base — varied elevation feel
    const gBase = c.createLinearGradient(0, 0, MAP_W, MAP_H);
    gBase.addColorStop(0,   '#263818'); gBase.addColorStop(0.3, '#2E4420');
    gBase.addColorStop(0.6, '#364E24'); gBase.addColorStop(1,   '#2A401C');
    c.fillStyle = gBase; c.fillRect(0, 0, MAP_W, MAP_H);

    // Texture patches
    for (let i = 0; i < 18; i++) {
      const px = rnd(0, MAP_W), py = rnd(0, MAP_H), pr = rnd(80, 220);
      const g = c.createRadialGradient(px,py,0,px,py,pr);
      g.addColorStop(0, 'rgba(70,90,30,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(px,py,pr,0,Math.PI*2); c.fill();
    }

    // Grid
    c.strokeStyle = 'rgba(0,200,70,0.06)'; c.lineWidth = 0.5;
    for (let x = 0; x < MAP_W; x += GRID) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,MAP_H); c.stroke(); }
    for (let y = 0; y < MAP_H; y += GRID) { c.beginPath(); c.moveTo(0,y); c.lineTo(MAP_W,y); c.stroke(); }

    // Roads (winding mountain paths)
    const drawHillRoad = (pts: [number,number][]) => {
      c.strokeStyle = '#3A3218'; c.lineWidth = 16;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.stroke();
      c.strokeStyle = 'rgba(120,110,60,0.3)'; c.lineWidth = 1; c.setLineDash([8,10]);
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.stroke(); c.setLineDash([]);
    };
    drawHillRoad([[0,580],[200,540],[450,500],[620,530],[780,580],[900,600],[1020,620],[1200,580],[1450,560],[1600,540],[1800,580]]);
    drawHillRoad([[200,0],[240,200],[280,400],[230,600],[200,800],[200,1200]]);
    drawHillRoad([[1600,0],[1560,250],[1540,500],[1600,750],[1600,1200]]);

    // High ground zones (prominent hills)
    for (const h of this.highGround) {
      const hg = c.createRadialGradient(h.x+h.w/2,h.y+h.h/2,0, h.x+h.w/2,h.y+h.h/2,Math.max(h.w,h.h)*0.65);
      hg.addColorStop(0,'#5A7030'); hg.addColorStop(0.6,C.hillsHigh); hg.addColorStop(1,C.hillsMid);
      c.fillStyle=hg; c.fillRect(h.x,h.y,h.w,h.h);
      // Contour lines
      c.strokeStyle='rgba(120,150,60,0.4)'; c.lineWidth=1;
      for(let i=1;i<4;i++){const p=i*12;c.strokeRect(h.x+p,h.y+p,h.w-p*2,h.h-p*2);}
      c.fillStyle='rgba(160,200,70,0.4)'; c.font='bold 8px "Courier New"'; c.textAlign='center';
      c.fillText('▲ RIDGE',h.x+h.w/2,h.y+h.h/2+4); c.textAlign='left';
    }

    // Forests
    for (const f of this.forests) { c.fillStyle=C.forest; c.fillRect(f.x,f.y,f.w,f.h); }
    for (const t of this._trees) {
      c.beginPath(); c.arc(t.x,t.y,t.r,0,Math.PI*2); c.fillStyle=t.shade; c.fill();
      c.beginPath(); c.arc(t.x-t.r*0.25,t.y-t.r*0.25,t.r*0.42,0,Math.PI*2);
      c.fillStyle='rgba(60,90,30,0.4)'; c.fill();
    }

    this._drawRocks(c);
    this._renderCliffs(c);  // cliffs drawn last — solid and impassable
  }

  // ══════════════════════════════════════════════════════════
  // THEME 2 — CITY
  // ══════════════════════════════════════════════════════════
  private _renderCity() {
    const c = this._off.getContext('2d')!;

    // Asphalt base
    c.fillStyle = '#1A1E18'; c.fillRect(0, 0, MAP_W, MAP_H);

    // City grid roads
    const roadW = 36;
    const gridStep = 190;
    c.fillStyle = C.cityRoad;
    for (let x = 0; x < MAP_W; x += gridStep) c.fillRect(x - roadW/2, 0, roadW, MAP_H);
    for (let y = 0; y < MAP_H; y += gridStep) c.fillRect(0, y - roadW/2, MAP_W, roadW);

    // Road center lines
    c.strokeStyle = 'rgba(100,100,60,0.25)'; c.lineWidth = 1; c.setLineDash([14, 18]);
    for (let x = 0; x < MAP_W; x += gridStep) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,MAP_H); c.stroke(); }
    for (let y = 0; y < MAP_H; y += gridStep) { c.beginPath(); c.moveTo(0,y); c.lineTo(MAP_W,y); c.stroke(); }
    c.setLineDash([]);

    // Road edge lines
    c.strokeStyle = 'rgba(80,80,50,0.3)'; c.lineWidth = 1.5;
    for (let x = 0; x < MAP_W; x += gridStep) {
      c.beginPath(); c.moveTo(x-roadW/2,0); c.lineTo(x-roadW/2,MAP_H); c.stroke();
      c.beginPath(); c.moveTo(x+roadW/2,0); c.lineTo(x+roadW/2,MAP_H); c.stroke();
    }
    for (let y = 0; y < MAP_H; y += gridStep) {
      c.beginPath(); c.moveTo(0,y-roadW/2); c.lineTo(MAP_W,y-roadW/2); c.stroke();
      c.beginPath(); c.moveTo(0,y+roadW/2); c.lineTo(MAP_W,y+roadW/2); c.stroke();
    }

    // City blocks (destroyed/rubble buildings)
    for (const b of this.cityBlocks) {
      // Shadow
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(b.x+6,b.y+6,b.w,b.h);
      // Base
      c.fillStyle = C.cityBlock; c.fillRect(b.x,b.y,b.w,b.h);
      // Wall detail
      c.fillStyle = C.cityWall;
      c.fillRect(b.x,b.y,b.w,4); c.fillRect(b.x,b.y,4,b.h);
      c.fillRect(b.x,b.y+b.h-4,b.w,4); c.fillRect(b.x+b.w-4,b.y,4,b.h);
      // Interior detail
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(b.x+8,b.y+8,b.w-16,b.h-16);
      // Crack lines
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1;
      c.beginPath();
      c.moveTo(b.x+b.w*0.3, b.y); c.lineTo(b.x+b.w*0.2, b.y+b.h*0.4);
      c.lineTo(b.x+b.w*0.35,b.y+b.h); c.stroke();
      // "COVER" label
      c.fillStyle = 'rgba(80,90,70,0.5)'; c.font='bold 7px "Courier New"'; c.textAlign='center';
      c.fillText('COVER', b.x+b.w/2, b.y+b.h/2+3); c.textAlign='left';
    }

    // Tactical grid overlay
    c.strokeStyle = 'rgba(0,180,60,0.05)'; c.lineWidth = 0.5;
    for (let x = 0; x < MAP_W; x += GRID) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,MAP_H); c.stroke(); }
    for (let y = 0; y < MAP_H; y += GRID) { c.beginPath(); c.moveTo(0,y); c.lineTo(MAP_W,y); c.stroke(); }
  }

  // ══════════════════════════════════════════════════════════
  // THEME 3 — BEACH DEFENCE
  // ══════════════════════════════════════════════════════════
  // Layout (left=player HQ, right=ocean):
  //   x 0–350    : HQ / clear ground
  //   x 350–700  : forest belt (cover)
  //   x 700–1100 : open plains (defense line)
  //   x 1100–1380: approach zone
  //   x 1380–1460: seawall / embankment (high ground)
  //   x 1460–1700: beach sand
  //   x 1700–1800: waterline
  private _initBeach() {
    // Forest belt — infantry cover left of defense line
    (this.forests as ForestZone[]).push(
      { x:  340, y:    0, w: 350, h: 280 },
      { x:  340, y:  400, w: 300, h: 250 },
      { x:  340, y:  720, w: 320, h: 260 },
      { x:  340, y: 1060, w: 340, h: 140 },
      { x:  650, y:  200, w: 180, h: 160 },
      { x:  640, y:  840, w: 200, h: 180 },
    );
    // Seawall / embankment — full-height ridge, gives range bonus
    // Sand dunes — elevation patches in the approach zone, provide cover
    (this.highGround as HighGround[]).push(
      { x: 1380, y:    0, w: 80, h: MAP_H  },  // seawall (full height)
      // dunes — scattered mounds in the contested approach
      { x: 1100, y:   60, w: 110, h:  90   },
      { x: 1210, y:  260, w: 120, h: 100   },
      { x: 1080, y:  480, w: 105, h:  85   },
      { x: 1190, y:  700, w: 115, h:  95   },
      { x: 1095, y:  920, w: 108, h:  88   },
      { x: 1220, y: 1090, w: 110, h:  90   },
    );
    // Sandbag positions — cover clusters in the defense line and approach
    (this.rocks as RockCluster[]).push(
      // Main defense line (~x=950)
      { cx:  950, cy:  200, r: 28 }, { cx:  975, cy:  450, r: 32 },
      { cx:  960, cy:  600, r: 30 }, { cx:  975, cy:  760, r: 32 },
      { cx:  950, cy: 1000, r: 28 },
      // Forward positions (~x=1150)
      { cx: 1160, cy:  320, r: 24 }, { cx: 1140, cy:  600, r: 26 },
      { cx: 1160, cy:  880, r: 24 },
      // Beach wreckage
      { cx: 1560, cy:  300, r: 20 }, { cx: 1580, cy:  600, r: 22 },
      { cx: 1560, cy:  900, r: 20 },
    );
  }

  private _renderBeach() {
    const c = this._off.getContext('2d')!;

    // Base: grassy ground on the left, sandy beach on the right
    const bgGrad = c.createLinearGradient(0, 0, MAP_W, 0);
    bgGrad.addColorStop(0,    '#263818');  // dark forest left
    bgGrad.addColorStop(0.35, C.ground);  // grassy center-left
    bgGrad.addColorStop(0.62, '#8A9A60'); // transitional scrub
    bgGrad.addColorStop(0.78, C.beachSand);
    bgGrad.addColorStop(0.94, C.beachShore);
    bgGrad.addColorStop(1.0,  '#B8A868');
    c.fillStyle = bgGrad; c.fillRect(0, 0, MAP_W, MAP_H);

    // Waterline gradient (right ~200px)
    const waterGrad = c.createLinearGradient(1650, 0, MAP_W, 0);
    waterGrad.addColorStop(0, 'rgba(26,90,154,0)');
    waterGrad.addColorStop(0.3, 'rgba(26,90,154,0.7)');
    waterGrad.addColorStop(1.0, C.beachWater);
    c.fillStyle = waterGrad; c.fillRect(1650, 0, MAP_W - 1650, MAP_H);

    // Grid
    c.strokeStyle = 'rgba(0,200,70,0.05)'; c.lineWidth = 0.5;
    for (let x = 0; x < MAP_W; x += GRID) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,MAP_H); c.stroke(); }
    for (let y = 0; y < MAP_H; y += GRID) { c.beginPath(); c.moveTo(0,y); c.lineTo(MAP_W,y); c.stroke(); }

    // Horizontal coastal road running behind defense line
    c.fillStyle = C.road;
    c.fillRect(0, 576, 1380, 18);
    c.strokeStyle = 'rgba(160,140,60,0.3)'; c.lineWidth=1; c.setLineDash([10,14]);
    c.beginPath(); c.moveTo(0,585); c.lineTo(1380,585); c.stroke(); c.setLineDash([]);

    // Seawall / embankment + approach sand dunes
    for (const h of this.highGround) {
      if (h.h === MAP_H) {
        // ── Full-height seawall ──────────────────────────────
        const sg = c.createLinearGradient(h.x,0,h.x+h.w,0);
        sg.addColorStop(0,  C.seawall);
        sg.addColorStop(0.4,'#6A5E48');
        sg.addColorStop(1,  '#4A4030');
        c.fillStyle = sg; c.fillRect(h.x, h.y, h.w, h.h);
        // Wall texture lines
        c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1;
        for (let y = 0; y < MAP_H; y += 28) c.strokeRect(h.x+4, y+4, h.w-8, 20);
        c.fillStyle = 'rgba(200,180,100,0.45)'; c.font='bold 8px "Courier New"'; c.textAlign='center';
        c.fillText('SEAWALL', h.x+h.w/2, MAP_H/2+4); c.textAlign='left';
      } else {
        // ── Sand dune — rounded sandy mound ─────────────────
        const dcx=h.x+h.w/2, dcy=h.y+h.h/2;
        // Soft sand base
        const dg = c.createRadialGradient(dcx,dcy,0, dcx,dcy, Math.max(h.w,h.h)*0.72);
        dg.addColorStop(0,   '#D8CA7A');  // bright crest
        dg.addColorStop(0.45, C.beachSand);
        dg.addColorStop(0.80, '#B8A460');
        dg.addColorStop(1,   'rgba(184,164,96,0)');
        c.fillStyle = dg;
        c.beginPath();
        c.ellipse(dcx, dcy, h.w*0.62, h.h*0.58, 0, 0, Math.PI*2);
        c.fill();
        // Shadow at base of dune (gives 3-D feel)
        c.strokeStyle = 'rgba(100,80,40,0.28)'; c.lineWidth = 2;
        c.beginPath();
        c.ellipse(dcx, dcy+h.h*0.18, h.w*0.56, h.h*0.22, 0, 0, Math.PI*2);
        c.stroke();
        // Ripple lines across crest
        c.strokeStyle = 'rgba(200,180,90,0.25)'; c.lineWidth = 1;
        for(let i=0;i<3;i++){
          const s=0.25+i*0.15;
          c.beginPath();
          c.ellipse(dcx, dcy-h.h*0.05, h.w*s, h.h*s*0.45, 0, 0, Math.PI*2);
          c.stroke();
        }
        // Label
        c.fillStyle = 'rgba(150,120,50,0.65)'; c.font='bold 7px "Courier New"'; c.textAlign='center';
        c.fillText('DUNE', dcx, dcy+3); c.textAlign='left';
      }
    }

    // Forest patches
    for (const f of this.forests) { c.fillStyle=C.forest; c.fillRect(f.x,f.y,f.w,f.h); }
    for (const t of this._trees) {
      c.beginPath(); c.arc(t.x,t.y,t.r,0,Math.PI*2); c.fillStyle=t.shade; c.fill();
      c.beginPath(); c.arc(t.x-t.r*0.25,t.y-t.r*0.25,t.r*0.42,0,Math.PI*2);
      c.fillStyle='rgba(60,90,30,0.4)'; c.fill();
    }

    // Sandbag / debris positions
    for (const r of this.rocks) {
      c.beginPath(); c.ellipse(r.cx+3,r.cy+3,r.r*1.3,r.r*0.7,0,0,Math.PI*2);
      c.fillStyle='rgba(0,0,0,0.25)'; c.fill();
      // Sandbag color (brown/tan stacks)
      c.beginPath(); c.ellipse(r.cx,r.cy,r.r*1.3,r.r*0.7,0,0,Math.PI*2);
      c.fillStyle=C.sandbag; c.fill();
      c.beginPath(); c.ellipse(r.cx,r.cy-r.r*0.22,r.r*0.9,r.r*0.45,0,0,Math.PI*2);
      c.fillStyle='#9A8A60'; c.fill();
      c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=1; c.stroke();
      // Seams
      for(let i=-1;i<=1;i+=2){
        c.beginPath(); c.ellipse(r.cx+i*r.r*0.38,r.cy,r.r*0.35,r.r*0.55,0,0,Math.PI*2);
        c.strokeStyle='rgba(0,0,0,0.2)'; c.lineWidth=1; c.stroke();
      }
      c.fillStyle='rgba(180,160,80,0.55)'; c.font='bold 7px "Courier New"'; c.textAlign='center';
      c.fillText('COVER',r.cx,r.cy+r.r*0.5+7); c.textAlign='left';
    }

    // Sand ripple texture in beach zone
    c.strokeStyle='rgba(160,140,80,0.18)'; c.lineWidth=1;
    for(let y=0;y<MAP_H;y+=18){
      c.beginPath();
      c.moveTo(1460,y);
      for(let x=1460;x<1700;x+=30) c.quadraticCurveTo(x+15,y+(x%60===0?4:-4),x+30,y);
      c.stroke();
    }

    // "OCEAN" label
    c.fillStyle='rgba(100,160,220,0.45)'; c.font='bold 22px "Courier New"'; c.textAlign='center';
    c.fillText('OCEAN', MAP_W-75, MAP_H/2+8); c.textAlign='left';
  }

  // ══════════════════════════════════════════════════════════
  // THEME 4 — DESERT CANYON
  // ══════════════════════════════════════════════════════════
  private _renderDesert() {
    const c = this._off.getContext('2d')!;

    // Sandy desert floor — warm golden gradient
    const bgGrad = c.createLinearGradient(0, 0, MAP_W, MAP_H);
    bgGrad.addColorStop(0,    '#D8C870');
    bgGrad.addColorStop(0.25, '#CCB860');
    bgGrad.addColorStop(0.55, '#C4AE58');
    bgGrad.addColorStop(0.8,  '#CCBA62');
    bgGrad.addColorStop(1,    '#D4C468');
    c.fillStyle = bgGrad; c.fillRect(0, 0, MAP_W, MAP_H);

    // Sand ripple texture across entire floor
    c.strokeStyle = 'rgba(180,160,60,0.14)'; c.lineWidth = 1;
    for (let y = 0; y < MAP_H; y += 14) {
      c.beginPath(); c.moveTo(0, y);
      for (let x = 0; x < MAP_W; x += 32) {
        c.quadraticCurveTo(x+16, y + Math.sin(x*0.025+y*0.012)*5, x+32, y);
      }
      c.stroke();
    }

    // Grid (very subtle on sand)
    c.strokeStyle = 'rgba(180,150,50,0.07)'; c.lineWidth = 0.5;
    for (let x = 0; x < MAP_W; x += GRID) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,MAP_H); c.stroke(); }
    for (let y = 0; y < MAP_H; y += GRID) { c.beginPath(); c.moveTo(0,y); c.lineTo(MAP_W,y); c.stroke(); }

    // Sand dune mounds (high ground cover)
    for (const h of this.highGround) {
      const dcx = h.x+h.w/2, dcy = h.y+h.h/2;
      const dg = c.createRadialGradient(dcx, dcy-8, 0, dcx, dcy, Math.max(h.w,h.h)*0.72);
      dg.addColorStop(0,   '#E8D878'); dg.addColorStop(0.45, C.beachSand);
      dg.addColorStop(0.8, '#B8A458'); dg.addColorStop(1, 'rgba(180,160,70,0)');
      c.fillStyle = dg;
      c.beginPath(); c.ellipse(dcx, dcy, h.w*0.6, h.h*0.55, 0, 0, Math.PI*2); c.fill();
      c.strokeStyle='rgba(160,130,50,0.25)'; c.lineWidth=1.5;
      c.beginPath(); c.ellipse(dcx, dcy+h.h*0.15, h.w*0.52, h.h*0.2, 0, 0, Math.PI*2); c.stroke();
      c.fillStyle='rgba(140,110,50,0.5)'; c.font='bold 7px "Courier New"'; c.textAlign='center';
      c.fillText('DUNE', dcx, dcy+3); c.textAlign='left';
    }

    // Sandstone rock clusters
    for (const r of this.rocks) {
      c.beginPath(); c.ellipse(r.cx+3, r.cy+3, r.r, r.r*0.76, 0, 0, Math.PI*2);
      c.fillStyle='rgba(0,0,0,0.18)'; c.fill();
      c.beginPath(); c.arc(r.cx, r.cy, r.r, 0, Math.PI*2);
      c.fillStyle='#9A7E4A'; c.fill();
      c.beginPath(); c.arc(r.cx-r.r*0.25, r.cy-r.r*0.25, r.r*0.5, 0, Math.PI*2);
      c.fillStyle='rgba(160,130,70,0.55)'; c.fill();
      if (r.r >= 18) {
        c.fillStyle='rgba(130,100,50,0.65)'; c.font='bold 7px "Courier New"'; c.textAlign='center';
        c.fillText('COVER', r.cx, r.cy+3); c.textAlign='left';
      }
    }

    // Canyon walls (cliffs rendered last, on top)
    this._renderCliffs(c);
  }

  // ── Cliff zone renderer (theme-aware) ────────────────────
  private _renderCliffs(c: CanvasRenderingContext2D) {
    const isDesert = this.theme === 4;
    for (const cz of this.cliffZones) {
      if (isDesert) {
        // ── Sandstone canyon walls ─────────────────────────
        c.fillStyle = '#7A6030'; c.fillRect(cz.x, cz.y, cz.w, cz.h);
        const cg = c.createLinearGradient(cz.x, cz.y, cz.x + cz.w*0.55, cz.y + cz.h);
        cg.addColorStop(0,   '#AA8E50'); cg.addColorStop(0.3, '#8E7238');
        cg.addColorStop(0.7, '#7A6028'); cg.addColorStop(1,   '#9A8040');
        c.fillStyle = cg; c.fillRect(cz.x, cz.y, cz.w, cz.h);
        // Sandstone strata
        c.strokeStyle = 'rgba(180,150,60,0.3)'; c.lineWidth = 1;
        const step = 18;
        for (let yi = cz.y + step/2; yi < cz.y + cz.h; yi += step) {
          c.beginPath(); c.moveTo(cz.x, yi);
          for (let xi = cz.x; xi <= cz.x+cz.w; xi += 18)
            c.lineTo(xi, yi + Math.sin(xi*0.065+yi*0.035)*2.5);
          c.stroke();
        }
        // Cracks (sand-coloured)
        c.strokeStyle = 'rgba(80,60,20,0.38)'; c.lineWidth = 1;
        const cc = Math.floor(cz.w / 80);
        for (let i = 0; i < cc; i++) {
          const cx2 = cz.x + (i+0.5)*(cz.w/cc) + rnd(-30,30);
          const cy0 = cz.y + rnd(0, cz.h*0.3);
          c.beginPath(); c.moveTo(cx2, cy0);
          c.lineTo(cx2+rnd(-8,8), cy0+rnd(12,28));
          c.lineTo(cx2+rnd(-12,12), cy0+rnd(35,60)); c.stroke();
        }
        c.strokeStyle='rgba(200,170,80,0.4)'; c.lineWidth=2;
        c.strokeRect(cz.x, cz.y, cz.w, cz.h);
        if (cz.w > 120 && cz.h > 80) {
          c.fillStyle='rgba(200,170,80,0.55)'; c.font='bold 8px "Courier New"'; c.textAlign='center';
          c.fillText('✕ CANYON', cz.x+cz.w/2, cz.y+cz.h/2+4); c.textAlign='left';
        }
      } else {
        // ── Organic rocky ridge (rounded, hill-themed) ────────
        const rx = cz.x, ry = cz.y, rw = cz.w, rh = cz.h;
        const rad = Math.min(rw, rh) * 0.42;  // large corner radius = pill shape

        // Drop shadow
        c.save();
        c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 14; c.shadowOffsetX = 6; c.shadowOffsetY = 6;
        c.beginPath(); (c as any).roundRect(rx, ry, rw, rh, rad);
        c.fillStyle = '#0E100A'; c.fill();
        c.restore();

        // Base rock fill — dark mossy stone
        c.beginPath(); (c as any).roundRect(rx, ry, rw, rh, rad);
        const cg = c.createLinearGradient(rx, ry, rx + rw*0.6, ry + rh);
        cg.addColorStop(0,   '#1C2010'); cg.addColorStop(0.35, '#141808');
        cg.addColorStop(0.7, '#1E221A'); cg.addColorStop(1,   '#111408');
        c.fillStyle = cg; c.fill();

        // Clip subsequent detail to the rounded shape
        c.save();
        c.beginPath(); (c as any).roundRect(rx, ry, rw, rh, rad); c.clip();

        // Rock strata lines
        c.strokeStyle = 'rgba(80,90,40,0.35)'; c.lineWidth = 1;
        for (let yi = ry + 18; yi < ry + rh; yi += 22) {
          c.beginPath(); c.moveTo(rx, yi);
          for (let xi = rx; xi <= rx+rw; xi += 14)
            c.lineTo(xi, yi + Math.sin(xi*0.08+yi*0.045)*2.5);
          c.stroke();
        }
        // Lichen patches (mossy green spots)
        for (let i = 0; i < Math.floor(rw/45); i++) {
          const lx = rx + rnd(10, rw-10), ly = ry + rnd(10, rh-10);
          const lr = rnd(6, 14);
          c.beginPath(); c.ellipse(lx, ly, lr, lr*0.65, rnd(-1,1), 0, Math.PI*2);
          c.fillStyle = 'rgba(50,70,25,0.45)'; c.fill();
        }
        c.restore();

        // Rounded border — mossy outline
        c.beginPath(); (c as any).roundRect(rx, ry, rw, rh, rad);
        c.strokeStyle = 'rgba(60,80,30,0.7)'; c.lineWidth = 2.5; c.stroke();

        // RIDGE label centred
        if (rh > 100) {
          c.fillStyle = 'rgba(100,120,50,0.6)'; c.font = 'bold 8px "Courier New"'; c.textAlign = 'center';
          c.fillText('▲ RIDGE', rx+rw/2, ry+rh/2+4); c.textAlign = 'left';
        }
      }
    }
  }

  // ── Shared rock drawer ───────────────────────────────────
  private _drawRocks(c: CanvasRenderingContext2D) {
    for (const r of this.rocks) {
      c.beginPath(); c.ellipse(r.cx+4,r.cy+4,r.r,r.r*0.7,0,0,Math.PI*2); c.fillStyle='rgba(0,0,0,0.3)'; c.fill();
      c.beginPath(); c.arc(r.cx,r.cy,r.r,0,Math.PI*2); c.fillStyle=C.rocks; c.fill();
      c.beginPath(); c.arc(r.cx-r.r*0.25,r.cy-r.r*0.25,r.r*0.5,0,Math.PI*2); c.fillStyle='rgba(90,85,70,0.6)'; c.fill();
      c.beginPath();
      c.moveTo(r.cx-r.r*0.3,r.cy-r.r*0.1); c.lineTo(r.cx+r.r*0.1,r.cy+r.r*0.3);
      c.strokeStyle='rgba(0,0,0,0.5)'; c.lineWidth=1.5; c.stroke();
      if (r.r >= 26) {
        c.fillStyle='rgba(120,110,80,0.5)'; c.font='bold 8px "Courier New"'; c.textAlign='center';
        c.fillText('COVER',r.cx,r.cy+3); c.textAlign='left';
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // QUERY METHODS
  // ══════════════════════════════════════════════════════════
  onBeachSand(x: number, _y: number): boolean {
    return this.theme === 3 && x > 1460;
  }

  onBridge(x: number, y: number): boolean {
    if (this.theme !== 0) return false;
    const rx = this.riverX(y);
    if (Math.abs(x - rx) > this.rW/2 + 5) return false;
    return this.bridges.some(b => Math.abs(y - b.yc) < b.hy);
  }

  inRiver(x: number, y: number): boolean {
    if (this.theme !== 0) return false;
    return !this.onBridge(x, y) && Math.abs(x - this.riverX(y)) < this.rW/2;
  }

  inForest(x: number, y: number): boolean {
    return this.forests.some(f => x>=f.x && x<=f.x+f.w && y>=f.y && y<=f.y+f.h);
  }

  onHighGround(x: number, y: number): boolean {
    return this.highGround.some(h => x>=h.x && x<=h.x+h.w && y>=h.y && y<=h.y+h.h);
  }

  onRoad(x: number, y: number): boolean {
    if (this.inRiver(x, y)) return false;
    if (this.theme === 0) return Math.abs(y-585)<9 || Math.abs(x-277)<9 || Math.abs(x-1529)<8;
    if (this.theme === 1) return Math.abs(y-580)<9 || Math.abs(x-230)<9 || Math.abs(x-1570)<9;
    if (this.theme === 2) {
      const gs = 190;
      const nx = ((x % gs) + gs) % gs;
      const ny = ((y % gs) + gs) % gs;
      return nx < 18 || nx > gs-18 || ny < 18 || ny > gs-18;
    }
    if (this.theme === 3) return Math.abs(y-585)<9 && x < 1380;  // coastal road
    if (this.theme === 4) return false;  // no roads in the canyon
    return false;
  }

  onRock(x: number, y: number): boolean {
    if (this.theme === 3) {
      // Beach sandbags use an ellipse (wider than tall)
      return this.rocks.some(r => {
        const dx=(x-r.cx)/(r.r*1.3), dy=(y-r.cy)/(r.r*0.7);
        return dx*dx+dy*dy < 1;
      });
    }
    return this.rocks.some(r => Math.hypot(x-r.cx, y-r.cy) < r.r);
  }

  inCityBlock(x: number, y: number): boolean {
    return this.theme === 2 && this.cityBlocks.some(b => x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h);
  }

  isImpassable(x: number, y: number): boolean {
    return this.cliffZones.some(cz => x >= cz.x && x <= cz.x + cz.w && y >= cz.y && y <= cz.y + cz.h);
  }

  speedMult(x: number, y: number): number {
    if (this.isImpassable(x, y)) return 0.0;  // full stop in cliffs / canyon walls
    if (this.onRock(x, y) || this.inCityBlock(x, y)) return 0.28;
    if (this.inRiver(x, y))    return 0.12;
    if (this.onBeachSand(x,y)) return 0.78;  // soft sand
    if (this.onHighGround(x,y) && (this.theme===3||this.theme===4)) return 0.72; // dunes / seawall
    if (this.onRoad(x, y))     return 1.28;
    if (this.inForest(x, y))   return 0.65;
    if (this.theme === 4)       return 0.88;  // desert sand is slower than grass
    return 1.0;
  }

  rangeMult(x: number, y: number): number {
    return this.onHighGround(x, y) ? 1.28 : 1.0;
  }

  coverMult(x: number, y: number): number {
    if (this.onRock(x, y))      return 0.50;
    if (this.inCityBlock(x, y)) return 0.45;
    if (this.inForest(x, y))    return 0.35;
    return 0;
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    ctx.drawImage(this._off, 0, 0);
    if (this.theme === 0) {
      // Animated river ripples
      ctx.save();
      ctx.globalAlpha = 0.11 + 0.04 * Math.sin(t * 1.8);
      ctx.strokeStyle = '#5599CC'; ctx.lineWidth = 1.2;
      for (let y = 0; y < MAP_H; y += 34) {
        const yOff = (y + t * 22) % MAP_H;
        const rx = this.riverX(yOff);
        ctx.beginPath(); ctx.moveTo(rx-this.rW*0.3,yOff); ctx.lineTo(rx+this.rW*0.3,yOff); ctx.stroke();
      }
      ctx.restore();
    } else if (this.theme === 3) {
      // Animated ocean waves scrolling left from right edge
      ctx.save();
      const waveOffset = (t * 28) % 80;
      ctx.globalAlpha = 0.22 + 0.10 * Math.sin(t * 2.1);
      ctx.strokeStyle = C.beachFoam; ctx.lineWidth = 1.5;
      for (let y = 0; y < MAP_H; y += 20) {
        const baseX = 1700 + waveOffset;
        ctx.beginPath();
        for (let wx = baseX; wx < MAP_W + 60; wx += 80) {
          ctx.moveTo(wx, y);
          ctx.quadraticCurveTo(wx+20, y + 5 * Math.sin(t*3+y*0.05), wx+40, y);
        }
        ctx.stroke();
      }
      // Foam line at waterline
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 1.6);
      ctx.strokeStyle = C.beachFoam; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let y = 0; y < MAP_H; y += 4) {
        const wx = 1698 + 12 * Math.sin(t * 1.4 + y * 0.04);
        if (y === 0) ctx.moveTo(wx, y); else ctx.lineTo(wx, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}
