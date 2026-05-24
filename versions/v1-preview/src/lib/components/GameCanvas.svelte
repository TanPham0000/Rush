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
  let drag0: { x: number; y: number } | null = null;
  let dragging = false;
  let mousePos = { x: 0, y: 0 };
  const DMIN = 6;

  function pos(e: MouseEvent) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width  / r.width),
      y: (e.clientY - r.top)  * (canvas.height / r.height),
    };
  }

  function dragRect() {
    if (!drag0 || !dragging) return null;
    return {
      x: Math.min(drag0.x, mousePos.x), y: Math.min(drag0.y, mousePos.y),
      w: Math.abs(mousePos.x - drag0.x), h: Math.abs(mousePos.y - drag0.y),
    };
  }

  function onMouseMove(e: MouseEvent) {
    mousePos = pos(e);
    if (drag0 && Math.hypot(mousePos.x - drag0.x, mousePos.y - drag0.y) > DMIN) dragging = true;
  }
  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    drag0 = pos(e); dragging = false;
  }
  function onMouseUp(e: MouseEvent) {
    if (e.button !== 0) return;
    const p = pos(e);
    if (dragging && drag0) engine.onDragSelect(drag0, p);
    else if (drag0)        engine.onLeftClick(p);
    drag0 = null; dragging = false;
  }
  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    engine.onRightClick(pos(e));
  }
  function onKeyDown(e: KeyboardEvent) {
    if (!engine) return;
    const k = e.key.toUpperCase();
    if (k === 'ESCAPE') engine.cancelBuild();
    if (k === 'S')      engine.commandStop();
    if (k === 'G')      engine.commandGuard();
    if (k === 'A')      engine.enterAttackMove();
  }

  onMount(() => {
    engine = new Engine(canvas);
    onEngineReady(engine);

    let t = 0;
    const loop = (ts: number) => {
      t = ts / 1000;
      engine.draw(t, dragRect(), mousePos);
      if (minimap) engine.drawMinimap(minimap);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    engine.start();
    window.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      engine.stop();
      window.removeEventListener('keydown', onKeyDown);
    };
  });
</script>

<canvas
  bind:this={canvas}
  onmousemove={onMouseMove}
  onmousedown={onMouseDown}
  onmouseup={onMouseUp}
  oncontextmenu={onContextMenu}
></canvas>

<style>
  canvas {
    display: block;
    cursor: default;
    width: 900px;
    height: 600px;
    flex-shrink: 0;   /* never shrink — fixes viewport-stretch on sidebar reflow */
  }
</style>
