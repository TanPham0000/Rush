<script lang="ts">
  import { onMount } from 'svelte';
  import GameCanvas from '$lib/components/GameCanvas.svelte';
  import Sidebar    from '$lib/components/Sidebar.svelte';
  import { gameState, wave, waveIncoming } from '$lib/stores/gameStore';
  import type { Engine } from '$lib/game/engine';

  const TOTAL_W = 1100, TOTAL_H = 638;

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

  <!-- TITLE -->
  <header>
    <span class="title">■ TIBERIUM WARS</span>
    <span class="sub">SVELTEKIT · TS · CANVAS</span>
    <span class="wave-badge" class:incoming={$waveIncoming}>
      {$waveIncoming ? '⚠ WAVE INCOMING!' : `WAVE ${$wave}`}
    </span>
  </header>

  <!-- GAME -->
  <div class="game-row">
    <GameCanvas {onEngineReady} minimap={minimapCanvas} />
    <Sidebar {engine}>
      {#snippet minimap()}
        <canvas bind:this={minimapCanvas} width="180" height="120" class="minimap"></canvas>
      {/snippet}
    </Sidebar>
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
    <div class="ot" class:win={$gameState==='won'} class:lose={$gameState==='lost'}>
      {$gameState === 'won' ? 'MISSION COMPLETE' : 'MISSION FAILED'}
    </div>
    <div class="os">
      {$gameState === 'won' ? 'War Factory destroyed!' : 'Your base has been overrun'}
    </div>
    <div class="or">Click anywhere to restart</div>
  </div>
</div>
{/if}

<style>
  #wrapper {
    position: fixed; top: 0; left: 0;
    transform-origin: 0 0;
    display: flex; flex-direction: column;
    width: 1100px;
  }
  header {
    height: 38px; background: #050D05;
    border: 2px solid #1E3A1E; border-bottom: 1px solid #1A2E1A;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 14px;
  }
  .title { font-size:13px; font-weight:bold; color:#00EE55; letter-spacing:3px; }
  .sub   { font-size:9px;  color:#2A4A2A;   letter-spacing:1px; }
  .wave-badge { font-size:11px; color:#FFAA44; letter-spacing:1px; transition:color 0.3s; }
  .wave-badge.incoming { color:#FF3322; animation:pulse 0.6s infinite alternate; }

  .game-row {
    display: flex;
    border: 2px solid #1E3A1E; border-top: none;
    box-shadow: 0 0 60px rgba(0,180,80,0.08), 0 0 20px rgba(0,0,0,0.9);
  }

  :global(.minimap) { display:block; border:1px solid #1E3A1E; margin:0 auto; }

  .overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.78);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; z-index: 100;
  }
  .box {
    background: #0D130D; border: 2px solid #1E3A1E;
    padding: 40px 60px; text-align: center;
    box-shadow: 0 0 60px rgba(0,200,80,0.18);
    font-family: 'Courier New', Courier, monospace;
  }
  .ot { font-size:36px; font-weight:bold; letter-spacing:4px; margin-bottom:12px; }
  .ot.win  { color:#00FF88; }
  .ot.lose { color:#FF3333; }
  .os { color:#88CC88; font-size:14px; letter-spacing:2px; margin-bottom:20px; }
  .or { color:#3A6A3A; font-size:12px; letter-spacing:1px; }

  @keyframes pulse { from{opacity:.7} to{opacity:1} }
</style>
