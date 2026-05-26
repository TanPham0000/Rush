<script lang="ts">
  import {
    credits, powerGen, powerUsed, powerOk, incomeRate,
    wave, nextWaveIn, waveIncoming, totalWaves, gameState,
    selected, buildMode, statusMsg,
    selHasBarracks, selHasRefinery, selHasWarFactory, selHasUnits,
    hasTechLab, hasWarFactory, selHasTechLab,
    selHasTurret, selTurretVariant,
    warFactoryHp, warFactoryMaxHp,
    enemiesKilled, unitsLost,
    selBuildingQueue, captureNodesState, holdProgress,
    upgrades, blackMarketCaptured, blackMarketAbilities,
    hasArmoury, selHasArmoury, researchingKeys,
    totalQueueCount, globalQueueItems,
  } from '$lib/stores/gameStore';
  import { HOLD_WIN_TIME, UPGRADES, ARMOURY_UPGRADES } from '$lib/game/constants';
  import { survivalTimeLeft } from '$lib/stores/gameStore';
  import type { Engine } from '$lib/game/engine';
  import {
    Building, Turret, Harvester, Unit, Tank, HeavyTank,
    Grenadier, Marksman, Artillery, Scout, AntitankGun, EnemyUnit,
  } from '$lib/game/entities';

  interface Props { engine: Engine | null; muted: boolean; onToggleMute: () => void; }
  let { engine, muted, onToggleMute }: Props = $props();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function unitLabel(e: any): string {
    if (e instanceof Building)    return e.type;
    if (e instanceof Harvester)   return 'Harvester';
    if (e instanceof Grenadier)   return 'Grenadier';
    if (e instanceof Marksman)    return 'Marksman';
    if (e instanceof HeavyTank)   return 'Heavy Tank';
    if (e instanceof Artillery)   return 'Artillery';
    if (e instanceof Scout)       return 'Scout';
    if (e instanceof AntitankGun) return 'Anti-Tank Gun';
    if (e instanceof Tank)        return 'Tank';
    if (e instanceof EnemyUnit)   return (e as EnemyUnit).isHeavy ? 'Enemy Armor' : 'Enemy';
    if (e instanceof Unit)        return e.team === 'player' ? 'Infantry' : 'Enemy';
    return '?';
  }

  const wfPct      = $derived($warFactoryHp / $warFactoryMaxHp);
  const singleSel  = $derived($selected.length === 1 ? $selected[0] : null);
  const holdPct    = $derived($holdProgress / HOLD_WIN_TIME);
  const centerNode = $derived($captureNodesState.find(n => n.isCenter));
  const isSurvival = $derived(engine?._mapDef?.mode === 'survival');
  const objLabel   = $derived(
    isSurvival ? 'DEFEND YOUR BASE' :
    engine?._mapDef?.enemyEco ? 'DESTROY ENEMY HQ' : 'DESTROY WAR FACTORY'
  );
  // Only show wave counter on wave-based tutorial map (not eco / survival)
  const isWaveMap  = $derived(!engine?._mapDef?.enemyEco && engine?._mapDef?.mode !== 'survival');
  // True when the selected building is a research building (queue = research items)
  const selIsResearch = $derived(
    $selected.length === 1 &&
    ($selected[0] as any)?.type === 'Tech Lab' ||
    ($selected.length === 1 && ($selected[0] as any)?.type === 'Armoury')
  );
</script>

<aside>
  <!-- Header with mute toggle -->
  <div class="panel-title">
    <span>COMMAND HQ</span>
    <button class="mute-btn" onclick={onToggleMute} title={muted ? 'Unmute (M)' : 'Mute (M)'}>
      {muted ? '🔇' : '🔊'}
    </button>
  </div>

  <!-- Credits -->
  <div class="credits-bar">
    <span class="lbl">CREDITS</span>
    <span class="val">{$credits.toLocaleString()}</span>
    <span class="rate">+{$incomeRate}/s</span>
  </div>

  <!-- Power -->
  <div class="power-wrap" class:low={!$powerOk}>
    <div class="power-hdr">
      <span class="plbl">⚡ POWER</span>
      {#if $powerOk}
        <span class="psurplus">+{$powerGen - $powerUsed}W surplus</span>
      {:else}
        <span class="pdeficit pwarn">−{$powerUsed - $powerGen}W deficit</span>
      {/if}
    </div>
    <div class="power-row2">
      <span class="prow-lbl">GEN</span>
      <div class="pbg flex1"><div class="pfill ok" style="width:{Math.min(100,$powerGen/40*100)}%"></div></div>
      <span class="prow-val">{$powerGen}W</span>
    </div>
    <div class="power-row2">
      <span class="prow-lbl">USE</span>
      <div class="pbg flex1"><div class="pfill" class:ok={$powerOk} class:bad={!$powerOk} style="width:{Math.min(100,$powerUsed/40*100)}%"></div></div>
      <span class="prow-val" class:warn-txt={!$powerOk}>{$powerUsed}W</span>
    </div>
  </div>

  <!-- Objective -->
  <div class="objective">
    <div class="obj-lbl">▶ {objLabel}</div>
    <div class="obj-bg"><div class="obj-fill" style="width:{wfPct*100}%"></div></div>
    <div class="obj-hp">{$warFactoryHp} / {$warFactoryMaxHp} HP</div>
  </div>

  <!-- Alt Win: Hold primary objective node -->
  {#if centerNode}
  <div class="hold-box" class:active={centerNode.team === 'player'} class:enemy={centerNode.team === 'enemy'}>
    <div class="hold-lbl">◉ {centerNode.label}</div>
    <div class="hold-sub">
      {#if centerNode.team === 'player'}
        HOLDING {Math.floor(centerNode.holdTimer)}s / {HOLD_WIN_TIME}s
      {:else if centerNode.team === 'enemy'}
        ⚠ ENEMY CONTROLLED
      {:else}
        NEUTRAL — CAPTURE TO WIN
      {/if}
    </div>
    {#if centerNode.team === 'player'}
    <div class="pbg"><div class="hold-fill" style="width:{holdPct*100}%"></div></div>
    {/if}
  </div>
  {/if}

  <!-- Capture Nodes Status -->
  <div class="nodes-bar">
    {#each $captureNodesState as n}
    <div class="node-pip"
      class:player={n.team === 'player'}
      class:enemy={n.team === 'enemy'}
      class:bmarket={n.isBlackMarket}
      class:radar={n.isRadar}
      class:beachgun={n.isBeachGun}
      class:park={n.isPark}
      class:engineer={n.isEngineer}
      title={n.label}>
      <span class="node-label">{n.isBlackMarket ? '◈' : n.isRadar ? '📡' : n.isBeachGun ? '🔫' : n.isPark ? '🌳' : n.isEngineer ? '🔧' : n.label.split(' ')[0]}</span>
    </div>
    {/each}
  </div>

  <!-- Survival timer (only shown on survival maps) -->
  {#if isSurvival}
  <div class="wave-box" class:incoming={$waveIncoming}>
    <span class="surv-lbl">🌊 WAVE {$wave}</span>
    <span class="surv-timer" class:low={$survivalTimeLeft < 120}>
      ⏱ {Math.floor($survivalTimeLeft / 60)}:{String($survivalTimeLeft % 60).padStart(2,'0')}
    </span>
  </div>
  {/if}

  <!-- Wave (only shown on wave-based maps) -->
  {#if isWaveMap}
  <div class="wave-box" class:incoming={$waveIncoming}>
    <span>WAVE {$wave} / {$totalWaves}+</span>
    <span class="next-in">NEXT: {$nextWaveIn}s</span>
  </div>
  {/if}

  <!-- Kill stats -->
  <div class="kill-bar">
    <span class="k-kills">▶ {$enemiesKilled} KILLS</span>
    <span class="k-lost">{$unitsLost} LOST ◀</span>
  </div>

  <!-- Quick-select row: always visible during play -->
  {#if $gameState === 'playing'}
  <div class="select-row">
    <button class="sel-btn army-sel" onclick={() => engine?.selectAllArmy()} title="Select all combat units (A)">[A] ALL ARMY</button>
    <button class="sel-btn prod-sel" onclick={() => engine?.selectAllProduction()} title="Select all production buildings (P)">[P] ALL PROD</button>
  </div>
  {/if}

  <!-- Build -->
  <div class="section">
    <div class="section-label">CONSTRUCT · P B F T K O</div>
    <div class="btn-grid">
      <button class="btn" class:active={$buildMode==='Power Plant'}
        disabled={$credits<200||$gameState!=='playing'}
        onclick={() => engine?.enterBuild('Power Plant')}>
        <span class="bn">Power Plant</span><span class="bc">200¢ [P]</span>
      </button>
      <button class="btn" class:active={$buildMode==='Barracks'}
        disabled={$credits<300||$gameState!=='playing'}
        onclick={() => engine?.enterBuild('Barracks')}>
        <span class="bn">Barracks</span><span class="bc">300¢ [B]</span>
      </button>
      <button class="btn" class:active={$buildMode==='Refinery'}
        disabled={$credits<500||$gameState!=='playing'}
        onclick={() => engine?.enterBuild('Refinery')}>
        <span class="bn">Refinery</span><span class="bc">500¢ [F]</span>
      </button>
      <button class="btn" class:active={$buildMode==='Turret'}
        disabled={$credits<350||$gameState!=='playing'}
        onclick={() => engine?.enterBuild('Turret')}>
        <span class="bn">Turret</span><span class="bc">350¢ [T]</span>
      </button>
    </div>
    <button class="btn full tech-btn" class:active={$buildMode==='Tech Lab'}
      disabled={$credits<600||$gameState!=='playing'}
      onclick={() => engine?.enterBuild('Tech Lab')}
      style="margin-top:3px">
      <span class="bn">Tech Lab</span><span class="bc">600¢ [K] · tanks + units</span>
    </button>
    <button class="btn full arm-build-btn" class:active={$buildMode==='Armoury'}
      disabled={$credits<450||$gameState!=='playing'}
      onclick={() => engine?.enterBuild('Armoury')}
      style="margin-top:3px">
      <span class="bn">Armoury</span><span class="bc">450¢ [O] · inf upgrades</span>
    </button>
    <button class="btn full wf-btn" class:active={$buildMode==='War Factory'}
      disabled={$credits<700||$gameState!=='playing'||!$hasTechLab}
      onclick={() => engine?.enterBuild('War Factory')}
      style="margin-top:3px">
      <span class="bn">War Factory{!$hasTechLab?' 🔒':''}</span>
      <span class="bc">700¢ · needs Tech Lab · tanks</span>
    </button>
  </div>

  <!-- Barracks train — infantry + recon -->
  {#if $selHasBarracks}
  <div class="section">
    <div class="section-label">BARRACKS — TRAIN</div>
    <button class="btn full" disabled={$credits<100||$gameState!=='playing'}
      onclick={() => engine?.trainInfantry()}>
      <span class="bn">{$upgrades.includes('Grenadier') ? 'Grenadier★' : 'Infantry'}</span>
      <span class="bc">100¢ · {$upgrades.includes('Grenadier') ? '11s · splash' : '8s'}</span>
    </button>
    <button class="btn full mrk-btn" disabled={$credits<220||$gameState!=='playing'}
      onclick={() => engine?.trainMarksman()}
      style="margin-top:3px">
      <span class="bn">Marksman</span><span class="bc">220¢ · 14s · long-range sniper</span>
    </button>
    <button class="btn full scout-btn" disabled={$credits<80||$gameState!=='playing'}
      onclick={() => engine?.trainScout()}
      style="margin-top:3px">
      <span class="bn">Scout Car</span><span class="bc">80¢ · 5s · fast recon</span>
    </button>
    {#if $upgrades.includes('AntitankGun')}
    <button class="btn full atg-btn" disabled={$credits<280||$gameState!=='playing'}
      onclick={() => engine?.trainAntitank()}
      style="margin-top:3px">
      <span class="bn">Anti-Tank★</span><span class="bc">280¢ · 18s · armor pierce</span>
    </button>
    {/if}
  </div>
  {/if}

  <!-- War Factory train — armour only -->
  {#if $selHasWarFactory}
  <div class="section">
    <div class="section-label">WAR FACTORY — ARMOUR</div>
    <button class="btn full" disabled={$credits<400||$gameState!=='playing'}
      onclick={() => engine?.trainTank()}
      style="margin-bottom:3px">
      <span class="bn">Tank</span><span class="bc">400¢ · 20s</span>
    </button>
    {#if $upgrades.includes('HeavyTank')}
    <button class="btn full hvytank-btn" disabled={$credits<400||$gameState!=='playing'}
      onclick={() => engine?.trainHeavyTank()}
      style="margin-bottom:3px">
      <span class="bn">Heavy Tank★</span><span class="bc">400¢ · 26s · +60% HP, +30% dmg</span>
    </button>
    {/if}
    {#if $upgrades.includes('ArtilleryUnit')}
    <button class="btn full arty-btn" disabled={$credits<550||$gameState!=='playing'}
      onclick={() => engine?.trainArtillery()}
      style="margin-bottom:3px">
      <span class="bn">Artillery★</span><span class="bc">550¢ · 28s · long range</span>
    </button>
    {/if}
  </div>
  {/if}

  <!-- Tech Lab: Research panel -->
  {#if $selHasTechLab}
  <div class="section">
    <div class="section-label">TECH LAB — RESEARCH</div>
    {#each UPGRADES as upg}
    {@const done   = $upgrades.includes(upg.key)}
    {@const queued = $researchingKeys.includes(upg.key)}
    <button class="btn full upg-btn" class:done class:queued
      disabled={$credits < upg.cost || $gameState !== 'playing' || done || queued}
      onclick={() => engine?.researchUpgrade(upg.key)}
      style="margin-bottom:2px">
      <span class="bn">{upg.label}{done ? ' ✓' : queued ? ' ⏳' : ''}</span>
      <span class="bc">{done ? 'RESEARCHED' : queued ? 'RESEARCHING…' : `${upg.cost}¢ — ${upg.desc}`}</span>
    </button>
    {/each}
  </div>
  {/if}

  <!-- Armoury: Infantry upgrade panel -->
  {#if $selHasArmoury}
  <div class="section armoury-section">
    <div class="section-label">🛡 ARMOURY — INFANTRY</div>
    {#each ARMOURY_UPGRADES as upg}
    {@const done   = $upgrades.includes(upg.key)}
    {@const queued = $researchingKeys.includes(upg.key)}
    <button class="btn full arm-upg-btn" class:done class:queued
      disabled={$credits < upg.cost || $gameState !== 'playing' || done || queued}
      onclick={() => engine?.researchArmouryUpgrade(upg.key)}
      style="margin-bottom:2px">
      <span class="bn">{upg.label}{done ? ' ✓' : queued ? ' ⏳' : ''}</span>
      <span class="bc">{done ? 'RESEARCHED' : queued ? 'RESEARCHING…' : `${upg.cost}¢ — ${upg.desc}`}</span>
    </button>
    {/each}
  </div>
  {/if}

  <!-- Turret upgrade panel -->
  {#if $selHasTurret && $hasTechLab}
  <div class="section turret-upg-section">
    <div class="section-label">TURRET UPGRADE · requires Tech Lab</div>
    {#if $selTurretVariant === 'standard'}
    <button class="btn full ai-turret-btn" disabled={$credits<250||$gameState!=='playing'}
      onclick={() => engine?.upgradeTurret('anti-infantry')}
      style="margin-bottom:3px">
      <span class="bn">⚡ Anti-Infantry</span>
      <span class="bc">250¢ · dual cannons · ×0.28 vs armour</span>
    </button>
    <button class="btn full at-turret-btn" disabled={$credits<350||$gameState!=='playing'}
      onclick={() => engine?.upgradeTurret('anti-tank')}
      style="margin-bottom:3px">
      <span class="bn">💥 Anti-Tank</span>
      <span class="bc">350¢ · heavy cannon · ×1.65 vs armour</span>
    </button>
    <button class="btn full art-turret-btn" disabled={$credits<600||$gameState!=='playing'}
      onclick={() => engine?.upgradeTurret('artillery')}>
      <span class="bn">🔥 Artillery</span>
      <span class="bc">600¢ · massive splash · crushes buildings</span>
    </button>
    {:else}
    <div class="req-note">
      {$selTurretVariant === 'anti-infantry' ? '⚡ ANTI-INFANTRY — dual autocannons active'
      : $selTurretVariant === 'anti-tank' ? '💥 ANTI-TANK — heavy cannon active'
      : '🔥 ARTILLERY — howitzer online'}
    </div>
    {/if}
  </div>
  {/if}

  <!-- Build / research queue display -->
  {#if $selBuildingQueue.head !== null || $selBuildingQueue.rest.length > 0}
  <div class="section queue-section" class:research-queue={selIsResearch}>
    <div class="section-label">{selIsResearch ? '🔬 RESEARCHING' : 'PRODUCTION QUEUE'}</div>
    {#if $selBuildingQueue.head}
    <div class="queue-head">
      <span class="queue-type">{$selBuildingQueue.head.type}</span>
      <div class="pbg" style="flex:1">
        <div class="queue-fill" class:research-fill={selIsResearch}
             style="width:{$selBuildingQueue.head.pct * 100}%"></div>
      </div>
      <span class="queue-pct">{Math.round($selBuildingQueue.head.pct * 100)}%</span>
    </div>
    {/if}
    {#if $selBuildingQueue.rest.length}
    <div class="queue-rest">
      {#each $selBuildingQueue.rest as item}
      <span class="queue-tag">{item}</span>
      {/each}
    </div>
    {/if}
  </div>
  {/if}

  <!-- Global production queue summary — always visible when training is active -->
  {#if $totalQueueCount > 0}
  <div class="section global-q-section">
    <div class="section-label">⚙ IN TRAINING · {$totalQueueCount} unit{$totalQueueCount !== 1 ? 's' : ''}</div>
    <div class="queue-rest">
      {#each $globalQueueItems as item}
      <span class="queue-tag" class:gq-wf={item.buildingType === 'War Factory'}>{item.type}</span>
      {/each}
    </div>
  </div>
  {/if}

  <!-- Black Market Abilities -->
  {#if $blackMarketCaptured}
  <div class="section bm-section">
    <div class="section-label">◈ BLACK MARKET</div>
    {#if $blackMarketAbilities.length === 0}
      <div class="req-note bm-used">All abilities used</div>
    {:else}
      {#each $blackMarketAbilities as ab}
      <button class="btn full bm-btn" disabled={$gameState !== 'playing'}
        onclick={() => engine?.useAbility(ab)}
        style="margin-bottom:2px">
        <span class="bn">{ab}</span>
        <span class="bc">ONE-TIME USE</span>
      </button>
      {/each}
    {/if}
  </div>
  {/if}

  <!-- Refinery train -->
  {#if $selHasRefinery}
  <div class="section">
    <div class="section-label">REFINERY — TRAIN</div>
    <button class="btn full" disabled={$credits<300||$gameState!=='playing'}
      onclick={() => engine?.trainHarvester()}>
      <span class="bn">Harvester</span><span class="bc">300¢ · 13s</span>
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
      <button class="cmd-btn atk" onclick={() => engine?.enterAttackMove()}>[Q] Atk-Move</button>
      <button class="cmd-btn ret" onclick={() => engine?.commandRetreat()}>[R] Retreat</button>
    </div>
  </div>
  {/if}

  <!-- Minimap moved to bottom-right overlay of the game canvas -->

  <!-- Info panel -->
  <div class="info-panel">
    {#if $selected.length === 0}
      <span class="dim">No selection</span>
    {:else if singleSel}
      {@const e = singleSel}
      {@const pct = e.hp / e.maxHp}
      {@const hc  = pct>0.6?'#22EE44':pct>0.3?'#FFAA00':'#FF2222'}
      <div class="info-name">{unitLabel(e)}</div>
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
      {#if e instanceof Unit && e.kills > 0}
        <div class="info-row">Kills: <span class="vet-txt">{e.kills}{e.kills >= 5 ? ' ★★' : e.kills >= 2 ? ' ★' : ''}</span></div>
      {/if}
    {:else}
      <div class="info-name">{$selected.length} selected</div>
      <div class="info-row">Units: <span>{$selected.filter(e=>e instanceof Unit).length}</span></div>
    {/if}
  </div>

  <!-- Hotkeys -->
  <div class="hotkeys">
    ESC Cancel · RMB Move/Atk/Rally<br>
    S Stop · G Guard · Q Atk-Move · R Retreat<br>
    A All Army · P All Prod (buildings)<br>
    ↑↓←→ Pan · Scroll Zoom · DRAG Select<br>
    Build: P/B/F/T/K/O · M Mute
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
    width: 200px; height: 600px;
    background: #060A06; border-left: 2px solid #1A3A1A;
    color: #88CC88; display: flex; flex-direction: column;
    font-size: 11px; font-family: 'Courier New', Courier, monospace;
    overflow-y: auto; scrollbar-width: thin; scrollbar-color: #1E3A1E #080C08;
    flex-shrink: 0;
  }
  .panel-title {
    padding: 6px 10px; display: flex; align-items: center; justify-content: space-between;
    text-align: center; font-size: 11px; font-weight: bold; color: #00EE55; letter-spacing: 3px;
    background: linear-gradient(180deg,#0D160D,#080D08); border-bottom: 1px solid #1E3A1E;
    text-shadow: 0 0 12px rgba(0,238,85,0.6);
  }
  .mute-btn {
    background: none; border: 1px solid #1A3A1A; cursor: pointer;
    font-size: 13px; line-height: 1; padding: 1px 3px;
    opacity: 0.7; transition: opacity 0.15s;
  }
  .mute-btn:hover { opacity: 1; border-color: #3A7A3A; }
  .credits-bar { display:flex; align-items:baseline; gap:4px; padding:6px 10px; background:#0E160E; border-bottom:1px solid #1A2E1A; }
  .lbl  { color:#3A6A3A; font-size:8px; letter-spacing:1px; }
  .val  { color:#FFD700; font-weight:bold; font-size:16px; flex:1; text-shadow:0 0 10px rgba(255,200,0,0.45); }
  .rate { color:#3A8A3A; font-size:9px; }
  .power-wrap { padding:5px 10px 6px; border-bottom:1px solid #1A2E1A; background:#0B120B; }
  .power-wrap.low { background:#180A08; }
  .power-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
  .plbl      { color:#3A6A3A; font-size:9px; letter-spacing:1px; }
  .psurplus  { color:#22CC66; font-size:8px; font-weight:bold; }
  .pdeficit  { font-size:8px; font-weight:bold; }
  .power-row2 { display:flex; align-items:center; gap:4px; margin-bottom:2px; }
  .prow-lbl  { color:#3A6A3A; font-size:7px; letter-spacing:1px; min-width:22px; }
  .prow-val  { color:#88CC88; font-size:8px; min-width:24px; text-align:right; }
  .prow-val.warn-txt { color:#FF6600; }
  .flex1     { flex:1; }
  .pwarn     { color:#FF4400; animation:blink 0.8s infinite; }
  .pbg       { height:5px; background:#111; border:1px solid #1E3A1E; }
  .pfill     { height:100%; transition:width 0.4s, background 0.4s; }
  .pfill.ok  { background:linear-gradient(90deg,#008833,#00EE55); }
  .pfill.bad { background:linear-gradient(90deg,#880000,#FF3300); }
  .objective { padding:5px 10px; border-bottom:1px solid #1A2E1A; }
  .obj-lbl  { color:#FF4444; font-size:8px; letter-spacing:1px; margin-bottom:3px; font-weight:bold; text-shadow:0 0 8px rgba(255,60,60,0.6); }
  .obj-bg   { height:4px; background:#222; border:1px solid #441A1A; margin-bottom:2px; }
  .obj-fill { height:100%; background:linear-gradient(90deg,#660000,#FF2200); transition:width 0.5s; }
  .obj-hp   { color:#884444; font-size:8px; }
  .hold-box { padding:4px 10px; border-bottom:1px solid #1A2E1A; background:#0A0E0A; }
  .hold-box.active { background:#0A120A; }
  .hold-box.enemy  { background:#120808; }
  .hold-lbl { color:#FFD700; font-size:8px; font-weight:bold; letter-spacing:1px; }
  .hold-sub { color:#557755; font-size:8px; margin-bottom:3px; }
  .hold-box.active .hold-sub { color:#FFD700; }
  .hold-box.enemy  .hold-sub { color:#FF4444; }
  .hold-fill { height:100%; background:linear-gradient(90deg,#664400,#FFD700); transition:width 0.5s; }
  .nodes-bar { display:flex; gap:3px; padding:4px 10px; border-bottom:1px solid #1A2E1A; background:#080C08; }
  .node-pip  { flex:1; padding:3px 2px; text-align:center; border:1px solid #1A3A1A; font-size:7px; color:#3A6A3A; }
  .node-pip.player  { border-color:#3399FF; background:rgba(51,153,255,0.1); color:#88CCFF; }
  .node-pip.enemy   { border-color:#FF4422; background:rgba(255,68,34,0.1); color:#FF9966; }
  .node-pip.bmarket { border-color:#AA8800; background:rgba(200,160,0,0.12); color:#FFD700; }
  .node-pip.player.bmarket { border-color:#FFD700; background:rgba(255,215,0,0.18); }
  .node-pip.radar   { border-color:#006688; background:rgba(0,200,200,0.08); color:#00CCDD; }
  .node-pip.player.radar { border-color:#00FFCC; background:rgba(0,255,200,0.15); color:#00FFCC; }
  .node-pip.beachgun { border-color:#884400; background:rgba(255,100,0,0.08); color:#FF8844; }
  .node-pip.player.beachgun { border-color:#FF6600; background:rgba(255,100,0,0.16); color:#FFAA44; }
  .node-pip.park { border-color:#226622; background:rgba(20,100,20,0.12); color:#44CC44; }
  .node-pip.player.park { border-color:#44FF44; background:rgba(30,180,30,0.18); color:#88FF88; }
  .node-pip.engineer { border-color:#6A5A00; background:rgba(180,140,0,0.1); color:#DDBB44; }
  .node-pip.player.engineer { border-color:#FFCC22; background:rgba(255,200,0,0.15); color:#FFE066; }
  .node-label { font-size:7px; letter-spacing:0.5px; }
  .wave-box { display:flex; justify-content:space-between; align-items:center; padding:4px 10px; font-size:9px; color:#557755; border-bottom:1px solid #1A2E1A; background:#0B120B; transition:background 0.3s; }
  .wave-box.incoming { background:#1A0A08; color:#FF4422; }
  .next-in { color:#FFAA44; }
  .surv-lbl { color:#1188CC; font-weight:bold; letter-spacing:1px; }
  .surv-timer { color:#44AAFF; font-size:10px; font-weight:bold; font-variant-numeric: tabular-nums; }
  .surv-timer.low { color:#FF6622; animation:blink 1s infinite; }
  .kill-bar { display:flex; justify-content:space-between; padding:3px 10px; background:#0A0F0A; border-bottom:1px solid #1A2E1A; font-size:8px; letter-spacing:1px; }
  .k-kills  { color:#33FF88; font-weight:bold; }
  .k-lost   { color:#FF5544; }
  .section { padding:6px 10px; border-bottom:1px solid #1A2E1A; }
  .section-label { color:#3A7A3A; font-size:7px; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:5px; text-shadow:0 0 6px rgba(0,180,60,0.4); }
  .btn-grid { display:grid; grid-template-columns:1fr 1fr; gap:3px; }
  .btn { display:flex; flex-direction:column; align-items:flex-start; padding:5px 6px; background:#0D2B0D; color:#88CC88; border:1px solid #1E5A1E; cursor:pointer; font-family:inherit; font-size:9px; line-height:1.4; transition:background 0.08s, border-color 0.08s; }
  .btn.full { width:100%; }
  .btn:hover:not(:disabled) { background:#153D15; border-color:#44AA44; color:#AAFFAA; }
  .btn:disabled { opacity:0.28; cursor:not-allowed; }
  .btn.active   { background:#153D15; border-color:#00FF55; color:#CCFFCC; }
  .tech-btn { background:#0D2020; border-color:#1E5A40; }
  .tech-btn:hover:not(:disabled) { background:#153830; border-color:#44AA88; }
  .tech-btn.active { border-color:#00FFAA; }
  .wf-btn   { background:#1A1000; border-color:#4A3A00; }
  .wf-btn:hover:not(:disabled) { background:#2A2000; border-color:#AA8800; color:#FFDD88; }
  .wf-btn.active { border-color:#FFD700; }
  .minimap-dead { padding:8px 10px; background:#0A0808; }
  .no-radar { color:#552222; font-size:9px; text-align:center; padding:10px; line-height:1.8; letter-spacing:1px; }
  .scout-btn { background:#081A18; border-color:#0E4A44; color:#44DDCC; }
  .scout-btn:hover:not(:disabled) { background:#0D2422; border-color:#22AA99; }
  .hvytank-btn { background:#0A1620; border-color:#1A4060; color:#66AAFF; }
  .hvytank-btn:hover:not(:disabled) { background:#122030; border-color:#3366AA; color:#AADDFF; }
  .arty-btn { background:#1A1A08; border-color:#5A5A1A; }
  .arty-btn:hover:not(:disabled) { background:#282810; border-color:#AAAA33; }
  .atg-btn  { background:#0D1A2D; border-color:#1A3A6A; }
  .atg-btn:hover:not(:disabled) { background:#152240; border-color:#336699; }
  .upg-btn  { background:#0D2020; border-color:#1E5040; font-size:8px; }
  .upg-btn:hover:not(:disabled) { background:#153830; border-color:#44AA88; }
  .upg-btn.done   { opacity:0.5; background:#0A1A10; border-color:#1A3A28; }
  .upg-btn.queued { background:#0D2030; border-color:#2A5070; color:#66AACC; cursor:default; }
  .turret-upg-section { background:#0A1A14; border-color:#1A4A30; }
  .turret-upg-section .section-label { color:#44CC88; }
  .ai-turret-btn { background:#0A1F0A; border-color:#1A5A22; color:#66FF88; }
  .ai-turret-btn:hover:not(:disabled) { background:#112A12; border-color:#33AA44; }
  .at-turret-btn { background:#1A1008; border-color:#5A3010; color:#FF9944; }
  .at-turret-btn:hover:not(:disabled) { background:#261812; border-color:#AA6622; }
  .art-turret-btn { background:#201800; border-color:#705800; color:#FFEE44; }
  .art-turret-btn:hover:not(:disabled) { background:#2E2200; border-color:#FFCC00; }
  .mrk-btn { background:#081A10; border-color:#0E4A2A; color:#88FFAA; }
  .mrk-btn:hover:not(:disabled) { background:#0E2818; border-color:#22CC66; }
  .arm-build-btn { background:#0A1020; border-color:#1A3060; color:#88AAFF; }
  .arm-build-btn:hover:not(:disabled) { background:#121830; border-color:#3355AA; }
  .armoury-section { background:#080C18; border-color:#1A2848; }
  .armoury-section .section-label { color:#88AAFF; }
  .arm-upg-btn { background:#0A1020; border-color:#1A3060; color:#AACCFF; }
  .arm-upg-btn:hover:not(:disabled) { background:#121830; border-color:#4466CC; }
  .arm-upg-btn.done { background:#060A16; border-color:#0E1C40; color:#445588; cursor:default; }
  .bm-section { background:#0E0D08; border-color:#3A3010; }
  .bm-section .section-label { color:#AA9930; }
  .bm-btn { background:#1A1500; border-color:#6A5800; color:#FFD700; }
  .bm-btn:hover:not(:disabled) { background:#2A2200; border-color:#FFD700; }
  .bn { font-weight:bold; }
  .bc { color:#FFB700; font-size:8px; }
  .req-note { color:#445533; font-size:7px; margin-top:2px; }
  .bm-used  { color:#665500; }
  .queue-section { background:#080E08; }
  .queue-section.research-queue { background:#080C18; border-color:#1A3060; }
  .queue-section.research-queue .section-label { color:#88AAFF; }
  .queue-section.research-queue .queue-type { color:#AACCFF; }
  .queue-section.research-queue .queue-pct  { color:#5588CC; }
  .queue-head { display:flex; align-items:center; gap:4px; margin-bottom:3px; }
  .queue-type { color:#AADDAA; font-size:8px; font-weight:bold; min-width:52px; }
  .queue-fill { height:100%; background:linear-gradient(90deg,#005522,#00EE55); transition:width 0.2s; }
  .queue-fill.research-fill { background:linear-gradient(90deg,#002266,#2266FF); }
  .queue-pct  { color:#3A7A3A; font-size:7px; min-width:22px; text-align:right; }
  .queue-rest { display:flex; gap:2px; flex-wrap:wrap; }
  .queue-tag  { padding:1px 4px; background:#0D200D; border:1px solid #1E3A1E; color:#557755; font-size:7px; }
  .cmd-row { display:flex; gap:3px; }
  .cmd-btn { flex:1; padding:4px 3px; background:#1A2A1A; color:#88CC88; border:1px solid #2A5A2A; cursor:pointer; font-family:inherit; font-size:9px; }
  .cmd-btn:hover { background:#223A22; color:#AAFFAA; }
  .cmd-btn.atk { background:#2A1010; border-color:#5A1A1A; color:#FF8888; }
  .cmd-btn.atk:hover { background:#3A1818; color:#FFAAAA; }
  .cmd-btn.ret { background:#1A1A00; border-color:#4A4A00; color:#FFDD66; }
  .cmd-btn.ret:hover { background:#2A2A00; color:#FFFF88; }
  .minimap-wrap { padding:6px 8px; }
  .info-panel { flex:1; padding:7px 10px; border-bottom:1px solid #1A2E1A; font-size:10px; overflow-y:auto; min-height:50px; }
  .info-name  { color:#AAFFAA; font-weight:bold; margin-bottom:4px; font-size:11px; }
  .info-row   { color:#3A6A3A; margin-bottom:2px; }
  .info-row span { color:#88CC88; }
  .info-row span.ally  { color:#3399FF; }
  .info-row span.enemy { color:#FF4444; }
  .info-row span.warn  { color:#FF6600; }
  .vet-txt { color:#FFD700; font-weight:bold; }
  .dim { color:#2A5A2A; }
  .hotkeys { padding:5px 10px; font-size:7px; color:#2A4A2A; line-height:1.7; border-bottom:1px solid #1A2E1A; }
  .status-bar { padding:5px 10px; font-size:9px; color:#2A5A2A; background:#060A06; text-align:center; letter-spacing:0.5px; min-height:22px; }
  .status-bar.warn    { color:#FFAA00; }
  .status-bar.error   { color:#FF3333; }
  .status-bar.success { color:#33FF88; }
  /* ── Quick-select row ─────────────────────────── */
  .select-row { display:flex; gap:3px; padding:4px 10px; border-bottom:1px solid #1A2E1A; background:#090D09; }
  .sel-btn { flex:1; padding:4px 3px; font-family:inherit; font-size:8px; font-weight:bold; letter-spacing:0.5px; cursor:pointer; border:1px solid; transition:background 0.08s, border-color 0.08s; }
  .army-sel { background:#0D1F0D; color:#88FF88; border-color:#1E5A1E; }
  .army-sel:hover { background:#153A15; border-color:#44BB44; color:#CCFFCC; }
  .prod-sel { background:#0D1A2D; color:#88AAFF; border-color:#1A3A6A; }
  .prod-sel:hover { background:#152240; border-color:#4466BB; color:#CCDDFF; }
  /* ── Global training queue ───────────────────── */
  .global-q-section { background:#0A100A; border-color:#1A3A1A; }
  .global-q-section .section-label { color:#33AA66; }
  .queue-tag.gq-wf { background:#0D1A0D; border-color:#2A5A2A; color:#88FF88; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
</style>
