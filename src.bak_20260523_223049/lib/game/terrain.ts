import { CANVAS_W, CANVAS_H, GRID, C } from './constants';
import { rnd, rndi } from './utils';

export interface ForestZone  { x: number; y: number; w: number; h: number }
export interface HighGround  { x: number; y: number; w: number; h: number }
export interface RockCluster { cx: number; cy: number; r: number }
export interface Bridge      { yc: number; hy: number }

export class TerrainMap {
  readonly riverX = (y: number) => 448 + 30 * Math.sin(y * 0.009);
  readonly rW = 32;

  readonly bridges: Bridge[]      = [{ yc: 155, hy: 34 }, { yc: 460, hy: 34 }];
  readonly forests: ForestZone[]  = [
    { x: 185, y:  55, w: 115, h: 90 },
    { x: 195, y: 440, w: 110, h: 90 },
    { x: 555, y:  55, w: 105, h: 85 },
    { x: 545, y: 445, w: 115, h: 90 },
  ];
  readonly highGround: HighGround[] = [
    { x:  95, y: 195, w: 95, h: 75 },
    { x: 685, y: 200, w: 95, h: 75 },
  ];
  readonly rocks: RockCluster[] = [
    { cx: 325, cy: 215, r: 20 },
    { cx: 315, cy: 395, r: 17 },
    { cx: 560, cy: 265, r: 19 },
    { cx: 595, cy: 405, r: 18 },
    { cx: 415, cy: 305, r: 16 },
    { cx: 490, cy: 190, r: 14 },
  ];

  private _off: HTMLCanvasElement;
  private _trees: Array<{ x: number; y: number; r: number; shade: string }> = [];

  constructor() {
    this._off = document.createElement('canvas');
    this._off.width  = CANVAS_W;
    this._off.height = CANVAS_H;
    this._buildTrees();
    this._render();
  }

  private _buildTrees() {
    for (const f of this.forests) {
      const n = rndi(14, 22);
      for (let i = 0; i < n; i++) {
        const r = rnd(4, 9);
        const shades = ['#162414', '#1A2C16', '#1E3418', '#243C1C', '#122010'];
        this._trees.push({
          x: f.x + rnd(r, f.w - r),
          y: f.y + rnd(r, f.h - r),
          r,
          shade: shades[rndi(0, shades.length)],
        });
      }
    }
  }

  private _render() {
    const c = this._off.getContext('2d')!;

    // ── BASE GROUND ──────────────────────────────────────────
    // Radial gradient for richer ground — darker at edges, lighter center
    const gGround = c.createRadialGradient(CANVAS_W*0.45, CANVAS_H*0.5, 0, CANVAS_W*0.45, CANVAS_H*0.5, CANVAS_W*0.65);
    gGround.addColorStop(0, '#354226');   // centre — warm mid-green
    gGround.addColorStop(0.6, C.ground);
    gGround.addColorStop(1, C.groundAlt);
    c.fillStyle = gGround;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Ground texture variation patches
    const patches = [[140,80,120,80],[400,200,100,70],[620,100,90,60],
                     [200,350,110,90],[500,450,130,70],[700,360,80,60],
                     [80,450,90,60],[760,150,70,50]];
    for (const [px,py,pw,ph] of patches) {
      c.fillStyle = C.groundAlt;
      c.globalAlpha = 0.5;
      c.beginPath();
      c.ellipse(px+pw/2, py+ph/2, pw/2, ph/2, 0, 0, Math.PI*2);
      c.fill();
      c.globalAlpha = 1;
    }

    // ── GRID ─────────────────────────────────────────────────
    c.strokeStyle = 'rgba(255,255,255,0.03)';
    c.lineWidth = 0.5;
    for (let x = 0; x < CANVAS_W; x += GRID) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, CANVAS_H); c.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += GRID) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(CANVAS_W, y); c.stroke();
    }

    // ── ROADS ────────────────────────────────────────────────
    const ry = this.riverX(292);
    const drawRoad = (x: number, y: number, w: number, h: number, horiz: boolean) => {
      // Tarmac body
      c.fillStyle = C.road;
      c.fillRect(x, y, w, h);
      // Subtle edge lines
      c.fillStyle = 'rgba(100,90,50,0.5)';
      if (horiz) { c.fillRect(x, y, w, 1); c.fillRect(x, y+h-1, w, 1); }
      else        { c.fillRect(x, y, 1, h); c.fillRect(x+w-1, y, 1, h); }
      // Centre dashes
      c.strokeStyle = 'rgba(160,140,60,0.45)';
      c.lineWidth = 1; c.setLineDash([8, 10]);
      c.beginPath();
      if (horiz) { c.moveTo(x, y+h/2); c.lineTo(x+w, y+h/2); }
      else        { c.moveTo(x+w/2, y); c.lineTo(x+w/2, y+h); }
      c.stroke(); c.setLineDash([]);
    };
    // Horizontal road (player side + enemy side)
    drawRoad(0, 284, ry - this.rW/2 - 2, 16, true);
    drawRoad(ry + this.rW/2 + 2, 284, CANVAS_W - (ry + this.rW/2 + 2), 16, true);
    // Vertical player road
    drawRoad(134, 0, 16, CANVAS_H, false);

    // ── HIGH GROUND ──────────────────────────────────────────
    for (const h of this.highGround) {
      // Gradient elevation effect — lighter at top
      const hg = c.createLinearGradient(h.x, h.y, h.x, h.y + h.h);
      hg.addColorStop(0, '#485628');  // bright peak
      hg.addColorStop(1, C.highGround);
      c.fillStyle = hg;
      c.fillRect(h.x, h.y, h.w, h.h);
      // Contour lines (topo map style)
      c.strokeStyle = 'rgba(100,130,50,0.55)';
      c.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const p = i * 9;
        c.strokeRect(h.x + p, h.y + p, h.w - p * 2, h.h - p * 2);
      }
      // Drop shadow on bottom + right (elevation cue)
      const gs = c.createLinearGradient(h.x, h.y + h.h - 14, h.x, h.y + h.h + 6);
      gs.addColorStop(0, 'rgba(0,0,0,0)');
      gs.addColorStop(1, 'rgba(0,0,0,0.45)');
      c.fillStyle = gs;
      c.fillRect(h.x, h.y + h.h - 14, h.w, 20);
      // "High ground" indicator text
      c.fillStyle = 'rgba(140,180,60,0.4)';
      c.font = 'bold 8px "Courier New"';
      c.textAlign = 'center';
      c.fillText('▲ HIGH', h.x + h.w/2, h.y + h.h/2 + 3);
      c.textAlign = 'left';
    }

    // ── FORESTS ──────────────────────────────────────────────
    for (const f of this.forests) {
      c.fillStyle = C.forest;
      c.fillRect(f.x, f.y, f.w, f.h);
    }
    for (const t of this._trees) {
      c.beginPath();
      c.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      c.fillStyle = t.shade;
      c.fill();
      // Highlight on top-left
      c.beginPath();
      c.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.45, 0, Math.PI * 2);
      c.fillStyle = 'rgba(60,90,30,0.4)';
      c.fill();
    }

    // ── ROCKS ────────────────────────────────────────────────
    for (const r of this.rocks) {
      // Shadow
      c.beginPath();
      c.ellipse(r.cx + 3, r.cy + 3, r.r, r.r * 0.7, 0, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fill();
      // Main rock
      c.beginPath();
      c.arc(r.cx, r.cy, r.r, 0, Math.PI * 2);
      c.fillStyle = C.rocks;
      c.fill();
      // Highlight facet
      c.beginPath();
      c.arc(r.cx - r.r * 0.25, r.cy - r.r * 0.25, r.r * 0.5, 0, Math.PI * 2);
      c.fillStyle = 'rgba(90,85,70,0.6)';
      c.fill();
      // Dark crack
      c.beginPath();
      c.moveTo(r.cx - r.r * 0.3, r.cy - r.r * 0.1);
      c.lineTo(r.cx + r.r * 0.1, r.cy + r.r * 0.3);
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = 1.5;
      c.stroke();
    }

    // ── RIVER ────────────────────────────────────────────────
    const steps = 4;
    // River body — horizontal gradient for depth
    const riverGrad = c.createLinearGradient(420, 0, 480, 0);
    riverGrad.addColorStop(0,   '#0A3060');  // edge darker
    riverGrad.addColorStop(0.3, '#1555A0');  // vivid mid-blue
    riverGrad.addColorStop(0.5, '#1A6ABB');  // bright centre
    riverGrad.addColorStop(0.7, '#1555A0');
    riverGrad.addColorStop(1,   '#0A3060');
    c.fillStyle = riverGrad;
    c.beginPath();
    c.moveTo(this.riverX(0) - this.rW / 2, 0);
    for (let y = steps; y <= CANVAS_H; y += steps) c.lineTo(this.riverX(y) - this.rW / 2, y);
    for (let y = CANVAS_H; y >= 0; y -= steps) c.lineTo(this.riverX(y) + this.rW / 2, y);
    c.closePath();
    c.fill();

    // Shimmer lines — bright RA3-blue
    for (let i = 0; i < 4; i++) {
      const offset = (i - 1.5) * (this.rW / 4);
      c.globalAlpha = 0.25 + (i % 2) * 0.12;
      c.strokeStyle = C.riverShim;
      c.lineWidth = i % 2 === 0 ? 1.5 : 0.8;
      c.beginPath();
      c.moveTo(this.riverX(0) + offset, 0);
      for (let y = steps; y <= CANVAS_H; y += steps) c.lineTo(this.riverX(y) + offset, y);
      c.stroke();
    }
    c.globalAlpha = 1;

    // River banks (darkened edges)
    for (let side = -1; side <= 1; side += 2) {
      const bank = c.createLinearGradient(0, 0, side * 14, 0);
      bank.addColorStop(0, 'rgba(0,0,0,0.3)');
      bank.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = bank;
      c.beginPath();
      if (side === -1) {
        c.moveTo(this.riverX(0) - this.rW / 2, 0);
        for (let y = steps; y <= CANVAS_H; y += steps) c.lineTo(this.riverX(y) - this.rW / 2, y);
        for (let y = CANVAS_H; y >= 0; y -= steps) c.lineTo(this.riverX(y) - this.rW / 2 - 12, y);
      } else {
        c.moveTo(this.riverX(0) + this.rW / 2, 0);
        for (let y = steps; y <= CANVAS_H; y += steps) c.lineTo(this.riverX(y) + this.rW / 2, y);
        for (let y = CANVAS_H; y >= 0; y -= steps) c.lineTo(this.riverX(y) + this.rW / 2 + 12, y);
      }
      c.closePath();
      c.fill();
    }

    // ── BRIDGES ──────────────────────────────────────────────
    for (const b of this.bridges) {
      const y1 = b.yc - b.hy, y2 = b.yc + b.hy;
      // Bridge deck fill
      for (let y = y1; y <= y2; y += 2) {
        const rx = this.riverX(y);
        c.fillStyle = C.bridge;
        c.fillRect(rx - this.rW / 2 - 2, y, this.rW + 4, 2);
      }
      // Bridge planks
      c.fillStyle = '#38362A';
      for (let y = y1; y < y2; y += 7) {
        const rx = this.riverX(y);
        c.fillRect(rx - this.rW / 2, y, this.rW, 4);
      }
      // Railing lines
      c.strokeStyle = '#4A4436';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(this.riverX(y1) - this.rW / 2 - 3, y1);
      for (let y = y1; y <= y2; y += 2) c.lineTo(this.riverX(y) - this.rW / 2 - 3, y);
      c.stroke();
      c.beginPath();
      c.moveTo(this.riverX(y1) + this.rW / 2 + 3, y1);
      for (let y = y1; y <= y2; y += 2) c.lineTo(this.riverX(y) + this.rW / 2 + 3, y);
      c.stroke();
    }
  }

  // ── QUERY METHODS ────────────────────────────────────────

  onBridge(x: number, y: number): boolean {
    const rx = this.riverX(y);
    if (Math.abs(x - rx) > this.rW / 2 + 4) return false;
    return this.bridges.some(b => Math.abs(y - b.yc) < b.hy);
  }

  inRiver(x: number, y: number): boolean {
    return !this.onBridge(x, y) && Math.abs(x - this.riverX(y)) < this.rW / 2;
  }

  inForest(x: number, y: number): boolean {
    return this.forests.some(f => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h);
  }

  onHighGround(x: number, y: number): boolean {
    return this.highGround.some(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
  }

  onRoad(x: number, y: number): boolean {
    if (this.inRiver(x, y)) return false;
    if (Math.abs(y - 292) < 8) return true;
    if (Math.abs(x - 142) < 8) return true;
    return false;
  }

  onRock(x: number, y: number): boolean {
    return this.rocks.some(r => Math.hypot(x - r.cx, y - r.cy) < r.r);
  }

  speedMult(x: number, y: number): number {
    if (this.onRock(x, y))   return 0.28;
    if (this.inRiver(x, y))  return 0.14;
    if (this.onRoad(x, y))   return 1.30;
    if (this.inForest(x, y)) return 0.65;
    return 1.0;
  }

  rangeMult(x: number, y: number): number {
    return this.onHighGround(x, y) ? 1.28 : 1.0;
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    ctx.drawImage(this._off, 0, 0);

    // Animated river ripples (drawn on top)
    const steps = 6;
    ctx.save();
    ctx.globalAlpha = 0.12 + 0.04 * Math.sin(t * 1.8);
    ctx.strokeStyle = '#5599CC';
    ctx.lineWidth = 1;
    for (let y = 0; y < CANVAS_H; y += 28) {
      const yOff = (y + t * 18) % CANVAS_H;
      const rx = this.riverX(yOff);
      ctx.beginPath();
      ctx.moveTo(rx - this.rW * 0.3, yOff);
      ctx.lineTo(rx + this.rW * 0.3, yOff);
      ctx.stroke();
    }
    ctx.restore();
  }
}
