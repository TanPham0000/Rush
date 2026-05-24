<script lang="ts">
  import type { Snippet } from 'svelte';
  import { credits, powerGen, powerUsed, powerOk, incomeRate,
           wave, nextWaveIn, waveIncoming, totalWaves, gameState,
           selected, buildMode, statusMsg,
           selHasBarracks, selHasRefinery, selHasUnits,
           warFactoryHp, warFactoryMaxHp,
           enemiesKilled, unitsLost } from '$lib/stores/gameStore';
  import type { Engine } from '$lib/game/engine';
  import { Building, Turret, Harvester, Unit } from '$lib/game/entities';

  interface Props {
    engine:  Engine | null;
    minimap: Snippet;
  }
  let { engine, minimap }: Props = $props();

  const powerBarPct = $derived(
    $powerUsed === 0 ? 1 : Math.min(1, $powerGen / Math.max(1, $powerUsed))
  );
  const wfPct = $derived($warFactoryHp / $warFactoryMaxHp);
  const singleSel = $derived($selected.length === 1 ? $selected[0] : null);
</script>

<aside>
  <div class="panel-title">COMMAND HQ</div>

  <!-- Credits -->
  <div class="credits-bar">
    <span class="lbl">CREDITS</span>
    <span class="val">{$credits.toLocaleString()}</span>
    <span class="rate">+{$incomeRate}/s</span>
  </div>

  <!-- Power -->
  <div class="power-wrap" class:low={!$powerOk}>
    <div class="power-row">
      <span class="plbl">⚡ POWER</span>
      <span class="pnums">{$powerGen}W / {$powerUsed}W</span>
      {#if !$powerOk}<span class="pwarn">LOW</span>{/if}
    </div>
    <div class="pbg"><div class="pfill" style="width:{powerBarPct*100}%" class:ok={$powerOk} class:bad={!$powerOk}></div></div>
  </div>

  <!-- Objective -->
  <div class="objective">
    <div class="obj-lbl">▶ DESTROY WAR FACTORY</div>
    <div class="obj-bg"><div class="obj-fill" style="width:{wfPct*100}%"></div></div>
    <div class="obj-hp">{$warFactoryHp} / {$warFactoryMaxHp} HP</div>
  </div>

  <!-- Wave -->
  <div class="wave-box" class:incoming={$waveIncoming}>
    <span>WAVE {$wave} / {$totalWaves}+</span>
    <span class="next-in">NEXT: {$nextWaveIn}s</span>
  </div>

  <!-- Kill stats -->
  <div class="kill-bar">
    <span class="k-kills">▶ {$enemiesKilled} KILLS</span>
    <span class="k-lost">{$unitsLost} LOST ◀</span>
  </div>

  <!-- Build -->
  <div class="section">
    <div class="section-label">CONSTRUCT</div>
    <div class="btn-grid">
      <button class="btn" class:active={$buildMode==='Power Plant'}
        disabled={$credits<200||$gameState!=='playing'}
        onclick={() => engine?.enterBuild('Power Plant')}>
        <span class="bn">Power Plant</span><span class="bc">200¢</span>
      </button>
      <button class="btn" class:active={$buildMode==='Barracks'}
        disabled={$credits<300||$gameState!=='playing'}
        onclick={() => engine?.enterBuild('Barracks')}>
        <span class="bn">Barracks</span><span class="bc">300¢</span>
      </button>
      <button class="btn" class:active={$buildMode==='Refinery'}
        disabled={$credits<500||$gameState!=='playing'}
        onclick={() => engine?.enterBuild('Refinery')}>
        <span class="bn">Refinery</span><span class="bc">500¢</span>
      </button>
      <button class="btn" class:active={$buildMode==='Turret'}
        disabled={$credits<350||$gameState!=='playing'}
        onclick={() => engine?.enterBuild('Turret')}>
        <span class="bn">Turret</span><span class="bc">350¢</span>
      </button>
    </div>
  </div>

  <!-- Barracks train -->
  {#if $selHasBarracks}
  <div class="section">
    <div class="section-label">BARRACKS</div>
    <button class="btn full" disabled={$credits<100||$gameState!=='playing'}
      onclick={() => engine?.trainInfantry()}>
      <span class="bn">Infantry</span><span class="bc">100¢</span>
    </button>
    <button class="btn full" disabled={$credits<400||$gameState!=='playing'}
      onclick={() => engine?.trainTank()}>
      <span class="bn">Tank</span><span class="bc">400¢</span>
    </button>
  </div>
  {/if}

  <!-- Refinery train -->
  {#if $selHasRefinery}
  <div class="section">
    <div class="section-label">REFINERY</div>
    <button class="btn full" disabled={$credits<300||$gameState!=='playing'}
      onclick={() => engine?.trainHarvester()}>
      <span class="bn">Harvester</span><span class="bc">300¢</span>
    </button>
  </div>
  {/if}

  <!-- Unit commands -->
  {#if $selHasUnits}
  <div class="section">
    <div class="section-label">COMMANDS</div>
    <div class="cmd-row">
      <button class="cmd-btn" onclick={() => engine?.commandStop()}>[S] Stop</button>
      <button class="cmd-btn" onclick={() => engine?.commandGuard()}>[G] Guard</button>
    </div>
    <div class="cmd-row" style="margin-top:3px">
      <button class="cmd-btn atk" onclick={() => engine?.enterAttackMove()}>[A] Atk-Move</button>
    </div>
  </div>
  {/if}

  <!-- Minimap -->
  <div class="section minimap-wrap">
    <div class="section-label">RADAR</div>
    {@render minimap()}
  </div>

  <!-- Info panel -->
  <div class="info-panel">
    {#if $selected.length === 0}
      <span class="dim">No selection</span>
    {:else if singleSel}
      {@const e = singleSel}
      {@const pct = e.hp / e.maxHp}
      {@const hc  = pct>0.6?'#22EE44':pct>0.3?'#FFAA00':'#FF2222'}
      <div class="info-name">
        {e instanceof Building ? e.type : e instanceof Harvester ? 'Harvester' : e instanceof Unit && e.team==='player' ? (e.radius>10?'Tank':'Infantry') : 'Enemy'}
      </div>
      <div class="info-row">Team: <span class:ally={e.team==='player'} class:enemy={e.team==='enemy'}>{e.team}</span></div>
      <div class="info-row">HP: <span style="color:{hc}">{Math.ceil(e.hp)}/{e.maxHp}</span></div>
      {#if e instanceof Harvester}
        <div class="info-row">Cargo: <span>{Math.floor(e.cargo)}/{e.maxCargo}</span></div>
        <div class="info-row">State: <span>{e.state}</span></div>
      {/if}
      {#if e instanceof Turret}
        <div class="info-row">Range: <span>{e.atkRange}px</span></div>
        <div class="info-row">Status: <span class:warn={e.disabled}>{e.disabled?'OFFLINE':'ACTIVE'}</span></div>
      {/if}
    {:else}
      <div class="info-name">{$selected.length} selected</div>
      <div class="info-row">Units: <span>{$selected.filter(e=>e instanceof Unit).length}</span></div>
    {/if}
  </div>

  <!-- Hotkeys -->
  <div class="hotkeys">
    ESC Cancel · RMB Move/Atk<br>
    S Stop · G Guard · A Atk-Move<br>
    DRAG Select
  </div>

  <!-- Status -->
  <div class="status-bar"
    class:warn={$statusMsg.type==='warn'}
    class:error={$statusMsg.type==='error'}
    class:success={$statusMsg.type==='success'}>
    {$statusMsg.text}
  </div>
</aside>

<style>
  aside {
    width: 200px;
    background: #080C08;
    border-left: 2px solid #1E3A1E;
    color: #88CC88;
    display: flex; flex-direction: column;
    font-size: 11px;
    font-family: 'Courier New', Courier, monospace;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #1E3A1E #080C08;
  }
  .panel-title {
    padding: 8px 10px; text-align: center;
    font-size: 11px; font-weight: bold; color: #00EE55; letter-spacing: 3px;
    background: #0D130D; border-bottom: 1px solid #1E3A1E;
  }
  /* Credits */
  .credits-bar { display:flex; align-items:baseline; gap:4px; padding:6px 10px; background:#0E160E; border-bottom:1px solid #1A2E1A; }
  .lbl  { color:#3A6A3A; font-size:8px; letter-spacing:1px; }
  .val  { color:#FFD700; font-weight:bold; font-size:16px; flex:1; }
  .rate { color:#3A8A3A; font-size:9px; }
  /* Power */
  .power-wrap { padding:5px 10px 6px; border-bottom:1px solid #1A2E1A; background:#0B120B; }
  .power-wrap.low { background:#180A08; }
  .power-row { display:flex; align-items:center; gap:4px; margin-bottom:3px; }
  .plbl  { color:#3A6A3A; font-size:9px; letter-spacing:1px; flex:1; }
  .pnums { color:#88CC88; font-size:9px; }
  .pwarn { color:#FF4400; font-size:8px; font-weight:bold; animation:blink 0.8s infinite; }
  .pbg   { height:5px; background:#111; border:1px solid #1E3A1E; }
  .pfill { height:100%; transition:width 0.4s, background 0.4s; }
  .pfill.ok  { background:linear-gradient(90deg,#008833,#00EE55); }
  .pfill.bad { background:linear-gradient(90deg,#880000,#FF3300); }
  /* Objective */
  .objective { padding:5px 10px; border-bottom:1px solid #1A2E1A; }
  .obj-lbl  { color:#FF4444; font-size:8px; letter-spacing:1px; margin-bottom:3px; font-weight:bold; }
  .obj-bg   { height:4px; background:#222; border:1px solid #441A1A; margin-bottom:2px; }
  .obj-fill { height:100%; background:linear-gradient(90deg,#660000,#FF2200); transition:width 0.5s; }
  .obj-hp   { color:#884444; font-size:8px; }
  /* Wave */
  .wave-box { display:flex; justify-content:space-between; align-items:center; padding:4px 10px; font-size:9px; color:#557755; border-bottom:1px solid #1A2E1A; background:#0B120B; transition:background 0.3s; }
  .wave-box.incoming { background:#1A0A08; color:#FF4422; }
  .next-in { color:#FFAA44; }
  /* Kill stats */
  .kill-bar { display:flex; justify-content:space-between; padding:3px 10px; background:#0A0F0A; border-bottom:1px solid #1A2E1A; font-size:8px; letter-spacing:1px; }
  .k-kills  { color:#33FF88; font-weight:bold; }
  .k-lost   { color:#FF5544; }
  /* Sections */
  .section { padding:6px 10px; border-bottom:1px solid #1A2E1A; }
  .section-label { color:#2A5A2A; font-size:8px; letter-spacing:2px; text-transform:uppercase; margin-bottom:5px; }
  /* Build grid */
  .btn-grid { display:grid; grid-template-columns:1fr 1fr; gap:3px; }
  .btn {
    display:flex; flex-direction:column; align-items:flex-start;
    padding:5px 6px; background:#0D2B0D; color:#88CC88;
    border:1px solid #1E5A1E; cursor:pointer; font-family:inherit;
    font-size:9px; line-height:1.4; transition:background 0.08s, border-color 0.08s;
  }
  .btn.full { width:100%; margin-bottom:3px; }
  .btn:hover:not(:disabled) { background:#153D15; border-color:#44AA44; color:#AAFFAA; }
  .btn:disabled { opacity:0.28; cursor:not-allowed; }
  .btn.active   { background:#153D15; border-color:#00FF55; color:#CCFFCC; }
  .bn { font-weight:bold; }
  .bc { color:#FFB700; font-size:8px; }
  /* Commands */
  .cmd-row { display:flex; gap:3px; }
  .cmd-btn { flex:1; padding:4px 3px; background:#1A2A1A; color:#88CC88; border:1px solid #2A5A2A; cursor:pointer; font-family:inherit; font-size:9px; }
  .cmd-btn:hover { background:#223A22; color:#AAFFAA; }
  .cmd-btn.atk { background:#2A1010; border-color:#5A1A1A; color:#FF8888; }
  .cmd-btn.atk:hover { background:#3A1818; color:#FFAAAA; }
  /* Minimap */
  .minimap-wrap { padding:6px 8px; }
  /* Info */
  .info-panel { flex:1; padding:7px 10px; border-bottom:1px solid #1A2E1A; font-size:10px; overflow-y:auto; min-height:50px; }
  .info-name  { color:#AAFFAA; font-weight:bold; margin-bottom:4px; font-size:11px; }
  .info-row   { color:#3A6A3A; margin-bottom:2px; }
  .info-row span { color:#88CC88; }
  .info-row span.ally  { color:#3399FF; }
  .info-row span.enemy { color:#FF4444; }
  .info-row span.warn  { color:#FF6600; }
  .dim { color:#2A5A2A; }
  /* Hotkeys */
  .hotkeys { padding:5px 10px; font-size:8px; color:#2A4A2A; line-height:1.7; border-bottom:1px solid #1A2E1A; }
  /* Status */
  .status-bar { padding:5px 10px; font-size:9px; color:#2A5A2A; background:#060A06; text-align:center; letter-spacing:0.5px; min-height:22px; }
  .status-bar.warn    { color:#FFAA00; }
  .status-bar.error   { color:#FF3333; }
  .status-bar.success { color:#33FF88; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
</style>
