<script lang="ts">
  import { onMount } from 'svelte';
  import { Engine } from '$lib/game/engine';

  interface Props {
    onEngineReady?: (engine: Engine) => void;
    minimap?:       HTMLCanvasElement | null;
  }
  let { onEngineReady = () => {}, minimap = null }: Props = $props();

  let canvas: HTMLCanvasElement;
  let engine: Engine;
  let raf = 0;

  // ── Mouse input state ────────────────────────────────────
  let drag0:         { x: number; y: number } | null = null;
  let dragging     = false;
  let mouseScreenPos = { x: 0, y: 0 };
  let mouseWorldPos  = { x: 0, y: 0 };
  const DMIN = 6;

  const keysHeld = new Set<string>();

  // Edge-scroll
  const EDGE_ZONE  = 40;
  const EDGE_SPEED = 220;
  let edgeVx = 0, edgeVy = 0;

  // ── Touch state ──────────────────────────────────────────
  let moveMode   = $state(false);   // next tap fires right-click
  let t1Id:    number | null = null;
  let t1Start: { x: number; y: number } | null = null;
  let t1Moved  = false;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let pinchDist = 0;
  let pinchMid  = { x: 0, y: 0 };   // CSS screen pixels

  const LONG_PRESS_MS  = 480;
  const TOUCH_DRAG_PX  = 14;   // canvas-buffer pixels before we call it a drag

  // ── Coordinate helpers ───────────────────────────────────
  function screenPos(e: MouseEvent) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width  / r.width),
      y: (e.clientY - r.top)  * (canvas.height / r.height),
    };
  }

  function touchPos(t: Touch) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (t.clientX - r.left) * (canvas.width  / r.width),
      y: (t.clientY - r.top)  * (canvas.height / r.height),
    };
  }

  // ── Mouse handlers ───────────────────────────────────────
  function updateMousePos(e: MouseEvent) {
    mouseScreenPos = screenPos(e);
    mouseWorldPos  = engine ? engine.screenToWorld(mouseScreenPos.x, mouseScreenPos.y) : mouseScreenPos;
    const sx = mouseScreenPos.x, sy = mouseScreenPos.y;
    edgeVx = sx < EDGE_ZONE ? -EDGE_SPEED : sx > engine.viewW - EDGE_ZONE ? EDGE_SPEED : 0;
    edgeVy = sy < EDGE_ZONE ? -EDGE_SPEED : sy > engine.viewH - EDGE_ZONE ? EDGE_SPEED : 0;
    if (engine) engine.setCamVel(edgeVx, edgeVy);
  }

  function onMouseMove(e: MouseEvent) {
    updateMousePos(e);
    if (drag0 && Math.hypot(mouseScreenPos.x - drag0.x, mouseScreenPos.y - drag0.y) > DMIN) dragging = true;
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    drag0 = mouseScreenPos; dragging = false;
  }

  function onMouseUp(e: MouseEvent) {
    if (e.button !== 0) return;
    if (dragging && drag0) {
      const s   = engine.screenToWorld(drag0.x, drag0.y);
      const en2 = engine.screenToWorld(mouseScreenPos.x, mouseScreenPos.y);
      engine.onDragSelect(s, en2);
    } else if (drag0) {
      engine.onLeftClick(mouseWorldPos);
    }
    drag0 = null; dragging = false;
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    updateMousePos(e);
    engine.onRightClick(mouseWorldPos);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.07;
    engine.setZoom(delta, mouseScreenPos.x, mouseScreenPos.y);
  }

  function onMouseLeave() {
    edgeVx = 0; edgeVy = 0;
    if (engine) engine.setCamVel(0, 0);
  }

  // ── Touch handlers ───────────────────────────────────────
  function clearLong() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }

  function onTouchStart(e: TouchEvent) {
    e.preventDefault();
    const ts = e.touches;

    if (ts.length === 1) {
      const pos = touchPos(ts[0]);
      t1Id    = ts[0].identifier;
      t1Start = pos;
      t1Moved = false;
      drag0   = pos;
      dragging = false;
      mouseScreenPos = pos;
      mouseWorldPos  = engine?.screenToWorld(pos.x, pos.y) ?? pos;

      clearLong();
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        if (!t1Moved) {
          engine?.onRightClick(mouseWorldPos);
          if (navigator.vibrate) navigator.vibrate(50);
          t1Id = null; t1Start = null; drag0 = null;
        }
      }, LONG_PRESS_MS);

    } else if (ts.length === 2) {
      clearLong();
      t1Id = null; t1Start = null; t1Moved = false; drag0 = null; dragging = false;
      pinchDist = Math.hypot(ts[1].clientX - ts[0].clientX, ts[1].clientY - ts[0].clientY);
      pinchMid  = { x: (ts[0].clientX + ts[1].clientX) / 2, y: (ts[0].clientY + ts[1].clientY) / 2 };
    }
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault();
    const ts = e.touches;

    if (ts.length === 1 && t1Start) {
      const t = Array.from(ts).find(x => x.identifier === t1Id) ?? ts[0];
      const pos = touchPos(t);
      mouseScreenPos = pos;
      mouseWorldPos  = engine?.screenToWorld(pos.x, pos.y) ?? pos;

      if (!t1Moved && Math.hypot(pos.x - t1Start.x, pos.y - t1Start.y) > TOUCH_DRAG_PX) {
        t1Moved = true;
        clearLong();
        dragging = true;
      }

    } else if (ts.length === 2) {
      const dist = Math.hypot(ts[1].clientX - ts[0].clientX, ts[1].clientY - ts[0].clientY);
      const midX = (ts[0].clientX + ts[1].clientX) / 2;
      const midY = (ts[0].clientY + ts[1].clientY) / 2;
      const r    = canvas.getBoundingClientRect();
      const sx   = canvas.width  / r.width;   // CSS → buffer scale
      const sy   = canvas.height / r.height;

      // Pan: "drag to grab" — moving fingers right pans camera left
      const dmx = (midX - pinchMid.x) * sx;
      const dmy = (midY - pinchMid.y) * sy;
      engine?.panCamera(-dmx, -dmy);

      // Pinch zoom (threshold to avoid jitter from tiny changes)
      if (pinchDist > 0 && Math.abs(dist - pinchDist) > 1) {
        const zd = (dist - pinchDist) * 0.003;
        const cx = (midX - r.left) * sx;
        const cy = (midY - r.top)  * sy;
        engine?.setZoom(zd, cx, cy);
      }

      pinchMid  = { x: midX, y: midY };
      pinchDist = dist;
    }
  }

  function onTouchEnd(e: TouchEvent) {
    e.preventDefault();
    clearLong();

    if (e.touches.length === 0) {
      if (t1Start && !t1Moved) {
        // Clean tap
        if (moveMode) {
          engine?.onRightClick(mouseWorldPos);
          moveMode = false;
          if (navigator.vibrate) navigator.vibrate(30);
        } else {
          engine?.onLeftClick(mouseWorldPos);
        }
      } else if (dragging && drag0) {
        // Drag ended → box-select
        const s   = engine?.screenToWorld(drag0.x, drag0.y);
        const en2 = engine?.screenToWorld(mouseScreenPos.x, mouseScreenPos.y);
        if (s && en2) engine?.onDragSelect(s, en2);
      }

      t1Id = null; t1Start = null; t1Moved = false;
      drag0 = null; dragging = false; pinchDist = 0;
    }
  }

  // ── Keyboard ─────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    if (!engine) return;
    keysHeld.add(e.key);
    const k = e.key.toUpperCase();

    if (k === 'ESCAPE') { engine.cancelBuild(); return; }
    if (k === 'S')      { engine.commandStop();   return; }
    if (k === 'G')      { engine.commandGuard();  return; }
    if (k === 'R')      { engine.commandRetreat(); return; }

    if (k === 'W') { engine.enterBuild('Power Plant'); return; }
    if (k === 'B') { engine.enterBuild('Barracks');    return; }
    if (k === 'F') { engine.enterBuild('Refinery');    return; }
    if (k === 'T') { engine.enterBuild('Turret');      return; }
    if (k === 'K') { engine.enterBuild('Tech Lab');    return; }
    if (k === 'O') { engine.enterBuild('Armoury');     return; }
  }

  function onKeyUp(e: KeyboardEvent) { keysHeld.delete(e.key); }

  function dragRect() {
    if (!drag0 || !dragging) return null;
    const s   = engine.screenToWorld(drag0.x, drag0.y);
    const en2 = engine.screenToWorld(mouseScreenPos.x, mouseScreenPos.y);
    return { x: Math.min(s.x, en2.x), y: Math.min(s.y, en2.y),
             w: Math.abs(en2.x - s.x), h: Math.abs(en2.y - s.y) };
  }

  onMount(() => {
    engine = new Engine(canvas);
    onEngineReady(engine);

    // ResizeObserver — keeps buffer = CSS size
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) engine.resize(Math.round(width), Math.round(height));
    });
    ro.observe(canvas);

    // Touch events need { passive: false } so we can call preventDefault
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });

    let t = 0;
    const loop = (ts: number) => {
      t = ts / 1000;
      let kVx = edgeVx, kVy = edgeVy;
      if (keysHeld.has('ArrowLeft'))  kVx -= 280;
      if (keysHeld.has('ArrowRight')) kVx += 280;
      if (keysHeld.has('ArrowUp'))    kVy -= 280;
      if (keysHeld.has('ArrowDown'))  kVy += 280;
      engine.setCamVel(kVx, kVy);

      engine.draw(t, dragRect(), mouseScreenPos);
      if (minimap) engine.drawMinimap(minimap);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    engine.start();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
      ro.disconnect();
      cancelAnimationFrame(raf);
      engine.stop();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  });
</script>

<!-- Wrapper so we can layer the MOVE button over the canvas -->
<div class="canvas-root">
  <canvas
    bind:this={canvas}
    onmousemove={onMouseMove}
    onmousedown={onMouseDown}
    onmouseup={onMouseUp}
    oncontextmenu={onContextMenu}
    onwheel={onWheel}
    onmouseleave={onMouseLeave}
  ></canvas>

  <!-- Mobile HUD — visible only on touch (pointer: coarse) devices -->
  <div class="mob-hud">
    <button
      class="mob-btn move-btn"
      class:active={moveMode}
      ontouchstart={(e) => { e.preventDefault(); moveMode = !moveMode; }}
      onclick={() => { moveMode = !moveMode; }}
    >
      {moveMode ? '✕ CANCEL' : '⊕ MOVE'}
    </button>
    <div class="mob-hint">HOLD = MOVE</div>
  </div>
</div>

<style>
  .canvas-root {
    position: relative;
    width: 100%;
    height: 100%;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: default;
    /* Prevent default touch behaviors (scroll, zoom, context menu) */
    touch-action: none;
  }

  /* ── Mobile HUD ── */
  .mob-hud {
    position: absolute;
    bottom: 10px;
    left: 10px;
    display: none;          /* hidden on mouse devices */
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    pointer-events: none;   /* let clicks fall through except on buttons */
  }

  /* Show only on touch screens */
  @media (pointer: coarse) {
    .mob-hud { display: flex; pointer-events: auto; }
  }

  .mob-btn {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 1px;
    padding: 10px 16px;
    cursor: pointer;
    border: 1px solid #1E5A1E;
    background: rgba(6,10,6,0.82);
    color: #88CC88;
    backdrop-filter: blur(4px);
    transition: background 0.1s, border-color 0.1s;
    min-width: 100px;
    text-align: center;
  }
  .mob-btn:active,
  .mob-btn.active {
    background: rgba(40,100,40,0.9);
    border-color: #00FF88;
    color: #CCFFCC;
  }

  .mob-hint {
    font-family: 'Courier New', monospace;
    font-size: 8px;
    color: rgba(80,160,80,0.6);
    letter-spacing: 1px;
    padding-left: 4px;
  }
</style>
