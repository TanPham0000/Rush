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

  // ── Input state ──────────────────────────────────────────
  let drag0:         { x: number; y: number } | null = null;
  let dragging     = false;
  let mouseScreenPos = { x: 0, y: 0 };
  let mouseWorldPos  = { x: 0, y: 0 };
  const DMIN = 6;

  const keysHeld = new Set<string>();

  // Edge-scroll velocity (screen px/s)
  const EDGE_ZONE  = 40;
  const EDGE_SPEED = 220;
  let edgeVx = 0, edgeVy = 0;

  function screenPos(e: MouseEvent) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width  / r.width),
      y: (e.clientY - r.top)  * (canvas.height / r.height),
    };
  }

  function updateMousePos(e: MouseEvent) {
    mouseScreenPos = screenPos(e);
    mouseWorldPos  = engine ? engine.screenToWorld(mouseScreenPos.x, mouseScreenPos.y) : mouseScreenPos;

    // Edge scroll detection — uses engine's current viewport size
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
      // drag rect in world space
      const s = engine.screenToWorld(drag0.x, drag0.y);
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

  function onKeyDown(e: KeyboardEvent) {
    if (!engine) return;
    keysHeld.add(e.key);
    const k = e.key.toUpperCase();

    // Unit commands
    if (k === 'ESCAPE') { engine.cancelBuild(); return; }
    if (k === 'S')      { engine.commandStop();   return; }
    if (k === 'G')      { engine.commandGuard();  return; }
    // 'A' handled globally by +page.svelte (handleArmyKey)
    // 'Q' handled globally by +page.svelte (enterAttackMove)
    if (k === 'R')      { engine.commandRetreat(); return; }

    // Build hotkeys — 'W' for Power Plant (P is now Select All Production)
    if (k === 'W') { engine.enterBuild('Power Plant'); return; }
    if (k === 'B') { engine.enterBuild('Barracks');    return; }
    if (k === 'F') { engine.enterBuild('Refinery');    return; }
    if (k === 'T') { engine.enterBuild('Turret');      return; }
    if (k === 'K') { engine.enterBuild('Tech Lab');    return; }
    if (k === 'O') { engine.enterBuild('Armoury');     return; }
  }

  function onKeyUp(e: KeyboardEvent) {
    keysHeld.delete(e.key);
  }

  function dragRect() {
    if (!drag0 || !dragging) return null;
    const s = engine.screenToWorld(drag0.x, drag0.y);
    const en2 = engine.screenToWorld(mouseScreenPos.x, mouseScreenPos.y);
    return {
      x: Math.min(s.x, en2.x), y: Math.min(s.y, en2.y),
      w: Math.abs(en2.x - s.x), h: Math.abs(en2.y - s.y),
    };
  }

  onMount(() => {
    engine = new Engine(canvas);
    onEngineReady(engine);

    // ── Resize observer — keeps canvas buffer = CSS display size ─
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) engine.resize(Math.round(width), Math.round(height));
    });
    ro.observe(canvas);

    let t = 0;
    const loop = (ts: number) => {
      t = ts / 1000;

      // Arrow-key camera pan
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
      ro.disconnect();
      cancelAnimationFrame(raf);
      engine.stop();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  });
</script>

<canvas
  bind:this={canvas}
  onmousemove={onMouseMove}
  onmousedown={onMouseDown}
  onmouseup={onMouseUp}
  oncontextmenu={onContextMenu}
  onwheel={onWheel}
  onmouseleave={onMouseLeave}
></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: default;
  }
</style>
