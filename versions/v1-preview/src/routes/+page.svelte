<script lang="ts">
  import { onMount } from 'svelte';
  import GameCanvas from '$lib/components/GameCanvas.svelte';
  import Sidebar    from '$lib/components/Sidebar.svelte';
  import { gameState, wave, waveIncoming } from '$lib/stores/gameStore';
  import type { Engine } from '$lib/game/engine';

  const TOTAL_W = 1100, TOTAL_H = 652;  // 38 header + 2 border + 600 game + 12 status strip

  let engine: Engine | null = $state(null);
  let minimapCanvas: HTMLCanvasElement | null = $state(null);
  let wrapper: HTMLDivElement;

  function fitViewport() {
    if (!wrapper) return;
    const s  = Math.min(1, window.innerWidth / TOTAL_W, window.innerHeight / TOTAL_H);
    const tx = Math.max(0, (window.innerWidth  - TOTAL_W * s) / 2);
    const ty = Math.max(0, (window.innerHeight - TOTAL_H * s) / 2);
    wrapper.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
  }

  onMount(() => {
    fitViewport();
    window.addEventListener('resize', fitViewport);
    return () => window.removeEventListener('resize', fitViewport);
  });

  function onEngineReady(e: Engine) { engine = e; }
</script>

<div id="wrapper" bind:this={wrapper}>

  <!-- WAR TABLE HEADER -->
  <header>
    <div class="hd-left">
      <span class="pip"></span>
      <span class="title">TIBERIUM COMMAND</span>
      <span class="sub">TACTICAL OPERATIONS</span>
    </div>
    <div class="hd-center">
      <span class="wave-badge" class:incoming={$waveIncoming}>
        {$waveIncoming ? '⚠ WAVE INCOMING' : `WAVE ${$wave}`}
      </span>
    </div>
    <div class="hd-right">
      <span class="tech-id">TS-{(Date.now()%9999).toString().padStart(4,'0')}</span>
    </div>
  </header>

  <!-- DISPLAY FRAME -->
  <div class="display-frame">
    <!-- Corner tick marks (CSS) -->
    <span class="tick tl"></span>
    <span class="tick tr"></span>
    <span class="tick bl"></span>
    <span class="tick br"></span>

    <!-- GAME -->
    <div class="game-row">
      <GameCanvas {onEngineReady} minimap={minimapCanvas} />
      <Sidebar {engine}>
        {#snippet minimap()}
          <canvas bind:this={minimapCanvas} width="178" height="118" class="minimap"></canvas>
        {/snippet}
      </Sidebar>
    </div>
  </div>

  <!-- STATUS STRIP -->
  <div class="status-strip">
    <span>■ SYSTEM NOMINAL</span>
    <span>GRID REF: SECTOR-7</span>
    <span>PROTOCOL: TIBERIUM-WAR v3</span>
  </div>
</div>

<!-- OVERLAY -->
{#if $gameState !== 'playing'}
<div
  class="overlay"
  role="button"
  tabindex="0"
  onclick={() => engine?.restart()}
  onkeydown={(e) => e.key === 'Enter' && engine?.restart()}
>
  <div class="box">
    <div class="box-corners">
      <span></span><span></span><span></span><span></span>
    </div>
    <div class="ot" class:win={$gameState==='won'} class:lose={$gameState==='lost'}>
      {$gameState === 'won' ? 'MISSION COMPLETE' : 'MISSION FAILED'}
    </div>
    <div class="os">
      {$gameState === 'won' ? 'War Factory destroyed. Tiberium secured.' : 'Base overrun. All units lost.'}
    </div>
    <div class="or">[CLICK TO REINITIATE]</div>
  </div>
</div>
{/if}

<style>
  /* ── WRAPPER ───────────────────────────────────────────── */
  #wrapper {
    position: fixed; top: 0; left: 0;
    transform-origin: 0 0;
    display: flex; flex-direction: column;
    width: 1100px;
    /* Outer table glow */
    filter: drop-shadow(0 0 32px rgba(0,180,60,0.18)) drop-shadow(0 0 6px rgba(0,100,40,0.4));
  }

  /* ── HEADER ────────────────────────────────────────────── */
  header {
    height: 38px;
    background: linear-gradient(180deg, #081208 0%, #040C04 100%);
    border: 1px solid #1A3A1A;
    border-bottom: 1px solid #0E2A0E;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 12px;
    position: relative;
  }
  /* glowing bottom accent line */
  header::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, #00EE55 20%, #00EE55 80%, transparent);
    opacity: 0.55;
  }
  .hd-left  { display: flex; align-items: center; gap: 8px; }
  .pip      { display: inline-block; width: 7px; height: 7px; background: #00FF66;
               border-radius: 50%; box-shadow: 0 0 8px #00FF66; animation: blink-pip 2.4s infinite; }
  .title    { font-size: 12px; font-weight: bold; color: #00EE55; letter-spacing: 3px; }
  .sub      { font-size: 8px; color: #274A27; letter-spacing: 2px; }
  .hd-center { position: absolute; left: 50%; transform: translateX(-50%); }
  .wave-badge {
    font-size: 10px; color: #FFAA44; letter-spacing: 2px;
    padding: 2px 10px; border: 1px solid #3A2A00;
    background: rgba(40,24,0,0.7);
    transition: color 0.3s, border-color 0.3s;
  }
  .wave-badge.incoming {
    color: #FF3322; border-color: #6A1A0A; background: rgba(60,10,5,0.8);
    animation: pulse-warn 0.5s infinite alternate;
  }
  .hd-right { display: flex; align-items: center; }
  .tech-id  { font-size: 8px; color: #1E4A1E; letter-spacing: 1px; }

  /* ── DISPLAY FRAME ─────────────────────────────────────── */
  .display-frame {
    position: relative;
    border: 1px solid #1A3A1A;
    border-top: none;
    box-shadow:
      inset 0 0 40px rgba(0,180,60,0.04),
      0 0 0 1px rgba(0,80,30,0.3);
  }

  /* CSS corner ticks (supplement canvas corners) */
  .tick {
    position: absolute; width: 10px; height: 10px;
    border-color: #00EE55; border-style: solid; opacity: 0.5;
    pointer-events: none; z-index: 2;
  }
  .tick.tl { top: -1px; left: -1px;  border-width: 2px 0 0 2px; }
  .tick.tr { top: -1px; right: -1px; border-width: 2px 2px 0 0; }
  .tick.bl { bottom: -1px; left: -1px;  border-width: 0 0 2px 2px; }
  .tick.br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }

  /* ── GAME ROW ──────────────────────────────────────────── */
  .game-row {
    display: flex;
    height: 600px;
    overflow: hidden;
  }

  /* ── STATUS STRIP ──────────────────────────────────────── */
  .status-strip {
    height: 14px;
    background: #030703;
    border: 1px solid #0E1E0E;
    border-top: none;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 12px;
    font-size: 7px; color: #1A3A1A; letter-spacing: 1.5px;
  }

  :global(.minimap) { display:block; border:1px solid #1A3A1A; }

  /* ── OVERLAY ───────────────────────────────────────────── */
  .overlay {
    position: fixed; inset: 0; background: rgba(0,3,1,0.85);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; z-index: 100;
    backdrop-filter: blur(2px);
  }
  .box {
    position: relative;
    background: linear-gradient(160deg, #060F06 0%, #040A04 100%);
    border: 1px solid #1A4A1A;
    padding: 44px 64px; text-align: center;
    box-shadow: 0 0 80px rgba(0,200,80,0.14), inset 0 0 60px rgba(0,40,15,0.3);
    font-family: 'Courier New', Courier, monospace;
  }
  /* box corners */
  .box-corners { position: absolute; inset: 0; pointer-events: none; }
  .box-corners span {
    position: absolute; width: 14px; height: 14px;
    border-color: #00EE55; border-style: solid; opacity: 0.7;
  }
  .box-corners span:nth-child(1) { top: 6px;  left: 6px;  border-width: 2px 0 0 2px; }
  .box-corners span:nth-child(2) { top: 6px;  right: 6px; border-width: 2px 2px 0 0; }
  .box-corners span:nth-child(3) { bottom: 6px; left: 6px;  border-width: 0 0 2px 2px; }
  .box-corners span:nth-child(4) { bottom: 6px; right: 6px; border-width: 0 2px 2px 0; }
  .ot { font-size: 34px; font-weight: bold; letter-spacing: 5px; margin-bottom: 14px; }
  .ot.win  { color: #00FF88; text-shadow: 0 0 30px rgba(0,255,136,0.5); }
  .ot.lose { color: #FF3333; text-shadow: 0 0 30px rgba(255,50,50,0.5); }
  .os { color: #557755; font-size: 12px; letter-spacing: 2px; margin-bottom: 22px; }
  .or { color: #2A5A2A; font-size: 10px; letter-spacing: 2px; animation: blink-pip 1.2s infinite; }

  /* ── ANIMATIONS ────────────────────────────────────────── */
  @keyframes blink-pip  { 0%,100%{opacity:1} 50%{opacity:0.2} }
  @keyframes pulse-warn { from{opacity:.8} to{opacity:1} }
</style>
