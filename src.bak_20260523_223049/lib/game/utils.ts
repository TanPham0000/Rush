export const hypot  = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(bx - ax, by - ay);

export const clamp  = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export const rnd    = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const rndi   = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo));

export const lerpAngle = (a: number, b: number, t: number) => {
  let diff = b - a;
  while (diff >  Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
};

let _uid = 0;
export const nextId = () => ++_uid;
export const resetIds = () => { _uid = 0; };

/** Draw bracket corners (selection indicator for buildings) */
export function drawBrackets(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, s = 10
) {
  const L = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
    ctx.stroke();
  };
  L(x, y+s, x, y, x+s, y);
  L(x+w-s, y, x+w, y, x+w, y+s);
  L(x, y+h-s, x, y+h, x+s, y+h);
  L(x+w-s, y+h, x+w, y+h, x+w, y+h-s);
}

/** Generic HP bar */
export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  cx: number, top: number, width: number,
  hp: number, maxHp: number
) {
  const bw = width, bh = 4, bx = cx - bw / 2, by = top;
  const pct = clamp(hp / maxHp, 0, 1);
  ctx.fillStyle = '#0008';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = pct > 0.6 ? '#22EE44' : pct > 0.3 ? '#FFAA00' : '#FF2222';
  ctx.fillRect(bx, by, bw * pct, bh);
  ctx.strokeStyle = '#0006';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(bx, by, bw, bh);
}

/** Hex to RGB alpha helper — appends 2-char hex alpha */
export const hexA = (hex: string, alpha: number) =>
  hex + Math.round(clamp(alpha, 0, 1) * 255).toString(16).padStart(2, '0');
