<script lang="ts">
  import { onMount } from 'svelte';
  import GameCanvas from '$lib/components/GameCanvas.svelte';
  import Sidebar    from '$lib/components/Sidebar.svelte';
  import {
    gameState, wave, waveIncoming,
    campaignMap, paused,
    statsHistory, gameTimeElapsed,
    enemiesKilled, unitsLost, unitsProduced,
    survivalMode, survivalTimeLeft, survivalTotal,
  } from '$lib/stores/gameStore';
  import type { StatSnap } from '$lib/stores/gameStore';
  import { MAPS } from '$lib/game/constants';
  import { sound } from '$lib/game/sound';
  import type { Engine } from '$lib/game/engine';

  const TOTAL_W = 1100, TOTAL_H = 652;

  let engine: Engine | null = $state(null);
  let minimapCanvas: HTMLCanvasElement | null = $state(null);
  let wrapper: HTMLDivElement;

  // Menu state
  let menuMode    = $state<'campaign' | 'skirmish' | 'codex'>('campaign');
  let skirmishMap = $state(0);
  let codexUnit   = $state(0);   // selected unit index in codex
  let muted       = $state(false);

  function toggleMute() { muted = sound.toggleMute(); }

  // Stats graph computed from history
  const graphData = $derived.by(() => {
    const snaps: StatSnap[] = $statsHistory;
    if (snaps.length < 2) return null;
    const maxT   = snaps[snaps.length - 1].t || 1;
    const maxK   = Math.max(...snaps.map(s => s.kills), 1);
    const maxP   = Math.max(...snaps.map(s => s.produced), 1);
    const yMax   = Math.max(maxK, maxP);
    const W = 530, H = 90, padX = 6, padY = 6;
    const iW = W - padX * 2, iH = H - padY * 2;
    const kpts = snaps.map(s =>
      `${padX + (s.t / maxT) * iW},${padY + iH - (s.kills    / yMax) * iH}`
    ).join(' ');
    const ppts = snaps.map(s =>
      `${padX + (s.t / maxT) * iW},${padY + iH - (s.produced / yMax) * iH}`
    ).join(' ');
    return { W, H, kpts, ppts, maxT, maxK: yMax };
  });

  function fmtTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }

  function fmtCountdown(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── UNIT CODEX DATA ──────────────────────────────────────────
  const CODEX = [
    { name:'INFANTRY',     role:'ASSAULT',    roles:['ANTI-INFANTRY','GARRISON'],
      hp:100, spd:65,  atk:15,  rng:55,  cost:50,
      color:'#44AAFF', shape:'circle',
      lore:'Backbone of any force. Cheap, versatile, and effective in cover. Suppresses enemies and holds objectives.',
    },
    { name:'GRENADIER',    role:'SPLASH',     roles:['SPLASH DMG','ANTI-INFANTRY'],
      hp:110, spd:60,  atk:18,  rng:70,  cost:80,
      color:'#FF8800', shape:'circle',
      lore:'Lobbing grenades that scatter shrapnel. Clears trenches and punishes clustered enemies brutally.',
    },
    { name:'ANTI-TANK GUN',role:'ANTI-ARMOR', roles:['ANTI-ARMOR','HEAVY HIT'],
      hp:140, spd:42,  atk:72,  rng:120, cost:120,
      color:'#FF4400', shape:'square',
      lore:'Slow but devastating. Fires armour-piercing rounds that shred tank hulls. Weak against infantry.',
    },
    { name:'SCOUT CAR',    role:'RECON',      roles:['RECON','FAST','VISION'],
      hp:45,  spd:135, atk:8,   rng:55,  cost:80,
      color:'#00FFCC', shape:'diamond',
      lore:'Fastest unit on the field. Reveals wide fog-of-war and flanks artillery. Fragile in a firefight.',
    },
    { name:'TANK',         role:'ARMOR',      roles:['FLANKING','ARMOR','ASSAULT'],
      hp:320, spd:32,  atk:46,  rng:100, cost:400,
      color:'#FFDD44', shape:'square',
      lore:'Main battle tank. Powerful cannon crushes anything it flanks. Vulnerable to AT guns from the front.',
    },
    { name:'HEAVY TANK',   role:'BREAKTHROUGH',roles:['ARMORED','HIGH HP','ASSAULT'],
      hp:500, spd:26,  atk:60,  rng:100, cost:600,
      color:'#00AAFF', shape:'square',
      lore:'A rolling fortress. Takes enormous punishment and dishes it back. Requires Tech Lab and War Factory.',
    },
    { name:'ARTILLERY',    role:'SUPPORT',    roles:['LONG RANGE','SPLASH','DEPLOY'],
      hp:180, spd:30,  atk:85,  rng:280, cost:550,
      color:'#FFEE00', shape:'square',
      lore:'Must deploy before firing. Devastating at range, helpless up close. Keep it behind your front line.',
    },
    { name:'HARVESTER',    role:'LOGISTICS',  roles:['ECONOMY','UNARMED'],
      hp:200, spd:62,  atk:0,   rng:0,   cost:0,
      color:'#DDAA00', shape:'square',
      lore:'Collects Tiberium and converts it to credits at the Refinery. Protect it at all costs.',
    },
  ];

  function fitViewport() {
    if (!wrapper) return;
    // Scale to fill the window — allow upscaling up to 1.5× on large screens
    const s  = Math.min(1.5, window.innerWidth / TOTAL_W, window.innerHeight / TOTAL_H);
    const tx = Math.max(0, (window.innerWidth  - TOTAL_W * s) / 2);
    const ty = Math.max(0, (window.innerHeight - TOTAL_H * s) / 2);
    wrapper.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
  }

  function startGame() {
    if (menuMode === 'codex') return;  // no-op from codex tab
    if (menuMode === 'campaign') {
      engine?.restart();
    } else {
      engine?.restartMap(skirmishMap);
    }
  }

  function onGlobalKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && $gameState === 'menu') {
      startGame();
    } else if (e.key === 'Enter' && ($gameState === 'won' || $gameState === 'lost')) {
      engine?.restart();
    } else if ((e.key === ' ' || e.key === 'Spacebar') && $gameState === 'playing') {
      e.preventDefault();
      engine?.togglePause();
    } else if (e.key === 'm' || e.key === 'M') {
      toggleMute();
    }
  }

  // Minimap click — move camera to clicked world position
  function onMinimapClick(ev: MouseEvent) {
    if (!engine || !minimapCanvas) return;
    const rect = minimapCanvas.getBoundingClientRect();
    // minimapCanvas is 178×118, world is 1800×1200
    const wx = ((ev.clientX - rect.left) / rect.width)  * 1800;
    const wy = ((ev.clientY - rect.top)  / rect.height) * 1200;
    engine.centerCameraOn(wx, wy);
  }

  onMount(() => {
    fitViewport();
    window.addEventListener('resize', fitViewport);
    window.addEventListener('keydown', onGlobalKey);
    return () => {
      window.removeEventListener('resize', fitViewport);
      window.removeEventListener('keydown', onGlobalKey);
    };
  });

  function onEngineReady(e: Engine) { engine = e; }

  // Current map info for display
  const currentMapDef = $derived(MAPS[$campaignMap] ?? MAPS[0]);
</script>

<div id="wrapper" bind:this={wrapper}>

  <!-- WAR TABLE HEADER -->
  <header>
    <div class="hd-left">
      <span class="pip"></span>
      <span class="title">RUSH</span>
      <span class="sub">REAL-TIME STRATEGY</span>
    </div>
    <div class="hd-center">
      {#if $survivalMode && $gameState === 'playing'}
        <span class="wave-badge survival-badge" class:incoming={$waveIncoming}>
          {#if $waveIncoming}⚠ WAVE {$wave} INCOMING{:else}⏱ SURVIVE {fmtCountdown($survivalTimeLeft)}{/if}
        </span>
      {:else}
        <span class="wave-badge" class:incoming={$waveIncoming}>
          {$waveIncoming ? '⚠ WAVE INCOMING' : `WAVE ${$wave}`}
        </span>
      {/if}
    </div>
    <div class="hd-right">
      {#if $gameState === 'playing'}
        <button class="hd-pause" onclick={() => engine?.togglePause()} title="Pause / Resume (SPACE)">
          {$paused ? '▶' : '⏸'}
        </button>
        <button class="hd-menu" onclick={() => gameState.set('menu')} title="Back to Main Menu">
          ◀ MENU
        </button>
      {/if}
      <button class="hd-mute" onclick={toggleMute} title="Mute/Unmute (M)">
        {muted ? '🔇' : '🔊'}
      </button>
      <span class="tech-id">TS-{(Date.now()%9999).toString().padStart(4,'0')}</span>
    </div>
  </header>

  <!-- DISPLAY FRAME -->
  <div class="display-frame">
    <span class="tick tl"></span>
    <span class="tick tr"></span>
    <span class="tick bl"></span>
    <span class="tick br"></span>

    <div class="game-row">
      <GameCanvas {onEngineReady} minimap={minimapCanvas} />
      <Sidebar {engine} {muted} onToggleMute={toggleMute}>
        {#snippet minimap()}
          <canvas bind:this={minimapCanvas} width="178" height="118" class="minimap"
            style="cursor:crosshair" onclick={onMinimapClick}></canvas>
        {/snippet}
      </Sidebar>
    </div>

    <!-- PAUSED OVERLAY — floats over game canvas only -->
    {#if $paused && $gameState === 'playing'}
    <div class="paused-overlay">
      <div class="paused-content">
        <div class="paused-title">⏸ PAUSED</div>
        <div class="paused-hint">SPACE TO RESUME</div>
      </div>
    </div>
    {/if}
  </div>

  <!-- STATUS STRIP -->
  <div class="status-strip">
    <span>■ SYSTEM NOMINAL</span>
    <span>MAP: {currentMapDef.name}</span>
    <span>PROTOCOL: RUSH v1.0</span>
  </div>
</div>

<!-- ══════════════════════════════════════════════════
     MAIN MENU OVERLAY
══════════════════════════════════════════════════ -->
{#if $gameState === 'menu'}
<div class="overlay menu-overlay">
  <div class="box menu-box">
    <div class="box-corners">
      <span></span><span></span><span></span><span></span>
    </div>

    <div class="rush-title">RUSH</div>
    <div class="rush-sub">REAL-TIME STRATEGY</div>
    <div class="menu-divider"></div>

    <!-- Mode tabs -->
    <div class="mode-tabs">
      <button class="mode-tab" class:active={menuMode==='campaign'} onclick={() => menuMode = 'campaign'}>
        ◆ CAMPAIGN
      </button>
      <button class="mode-tab" class:active={menuMode==='skirmish'} onclick={() => menuMode = 'skirmish'}>
        ◇ SKIRMISH
      </button>
      <button class="mode-tab" class:active={menuMode==='codex'} onclick={() => menuMode = 'codex'}>
        ⊞ CODEX
      </button>
    </div>

    <!-- CAMPAIGN content -->
    {#if menuMode === 'campaign'}
    <div class="campaign-panel">
      <!-- Map progression dots -->
      <div class="camp-progress">
        {#each MAPS as m, i}
        <div class="camp-step" class:active={i === $campaignMap} class:done={i < $campaignMap}>
          <div class="camp-dot">{i < $campaignMap ? '✓' : i + 1}</div>
          <div class="camp-name">{m.name}</div>
        </div>
        {/each}
      </div>

      <!-- Current mission briefing -->
      <div class="briefing">
        <div class="brief-hdr">◉ {currentMapDef.name} — {currentMapDef.subtitle}</div>
        <p>{currentMapDef.description}</p>
        <div class="brief-stats">
          <span class="bstat">
            <span class="bs-lbl">START CREDITS</span>
            <span class="bs-val">{currentMapDef.startCredits}¢</span>
          </span>
          <span class="bstat">
            <span class="bs-lbl">WAVE STRENGTH</span>
            <span class="bs-val">{Math.round(currentMapDef.waveScale * 100)}%</span>
          </span>
          <span class="bstat">
            <span class="bs-lbl">ENEMY HP</span>
            <span class="bs-val">{Math.round(currentMapDef.enemyHpScale * 100)}%</span>
          </span>
        </div>
      </div>
    </div>

    <!-- SKIRMISH content -->
    {:else if menuMode === 'skirmish'}
    <div class="skirmish-panel">
      <div class="map-cards">
        {#each MAPS as m, i}
        <button class="map-card" class:selected={skirmishMap === i} onclick={() => skirmishMap = i}>
          <div class="mc-num">0{i + 1}</div>
          <div class="mc-name">{m.name}</div>
          <div class="mc-sub">{m.subtitle}</div>
          <div class="mc-diff">
            {#if m.mode === 'survival'}
              <span class="mc-mode-tag">⏱ SURVIVAL</span>
            {:else}
              <span class="mcd-lbl">DIFF</span>
              <span class="mcd-pips">
                {#each Array(3) as _, p}
                <span class="mcd-pip" class:lit={p < Math.ceil(m.waveScale)}></span>
                {/each}
              </span>
            {/if}
          </div>
        </button>
        {/each}
      </div>
      {#if skirmishMap !== null}
      <div class="briefing sk-brief">
        <div class="brief-hdr">◉ {MAPS[skirmishMap].subtitle}</div>
        <p>{MAPS[skirmishMap].description}</p>
        {#if MAPS[skirmishMap].mode === 'survival'}
        <div class="brief-stats">
          <span class="bstat">
            <span class="bs-lbl">OBJECTIVE</span>
            <span class="bs-val" style="font-size:9px">SURVIVE 15:00</span>
          </span>
          <span class="bstat">
            <span class="bs-lbl">START CREDITS</span>
            <span class="bs-val">{MAPS[skirmishMap].startCredits}¢</span>
          </span>
        </div>
        {/if}
      </div>
      {/if}
    </div>

    <!-- CODEX content -->
    {:else}
    <div class="codex-panel">
      <div class="codex-list">
        {#each CODEX as u, i}
        <button class="codex-unit-btn" class:active={codexUnit===i} onclick={() => codexUnit=i}>
          <span class="cu-icon" style="background:{u.color}22;border-color:{u.color}55;color:{u.color}">{u.name[0]}</span>
          <span class="cu-name">{u.name}</span>
          <span class="cu-role">{u.role}</span>
        </button>
        {/each}
      </div>
      <div class="codex-detail">
        {#each [CODEX[codexUnit]] as u}
        <div class="cd-header">
          <div class="cd-icon" style="background:{u.color}22;border-color:{u.color}77;color:{u.color};box-shadow:0 0 20px {u.color}44">
            {u.name[0]}
          </div>
          <div class="cd-title-block">
            <div class="cd-name">{u.name}</div>
            <div class="cd-roles">
              {#each u.roles as r}<span class="cd-tag">{r}</span>{/each}
            </div>
            {#if u.cost > 0}<div class="cd-cost">{u.cost}¢</div>{/if}
          </div>
        </div>
        <div class="cd-lore">{u.lore}</div>
        <div class="cd-stats">
          {#each [['HP', u.hp, 500, '#FF4444'], ['SPEED', u.spd, 135, '#44FFAA'],
                  ['ATTACK', u.atk, 85, '#FFDD44'], ['RANGE', u.rng, 280, '#44AAFF']] as [lbl, val, mx, col]}
          <div class="cd-stat-row">
            <span class="cd-stat-lbl">{lbl}</span>
            <div class="cd-bar-track">
              <div class="cd-bar-fill" style="width:{Math.round((val/mx)*100)}%;background:{col}"></div>
            </div>
            <span class="cd-stat-val">{val}</span>
          </div>
          {/each}
        </div>
        {/each}
      </div>
    </div>
    {/if}

    <!-- Controls & Tips (hidden in codex mode) -->
    {#if menuMode !== 'codex'}
    <div class="menu-divider" style="margin-top:10px"></div>
    <div class="menu-cols">
      <div class="menu-col">
        <div class="col-hdr">CONTROLS</div>
        <div class="ctrl-row"><span class="key">RMB</span><span>Move / Attack / Rally</span></div>
        <div class="ctrl-row"><span class="key">LMB</span><span>Select / Place building</span></div>
        <div class="ctrl-row"><span class="key">DRAG</span><span>Box-select units</span></div>
        <div class="ctrl-row"><span class="key">SCROLL</span><span>Zoom in / out</span></div>
        <div class="ctrl-row"><span class="key">↑↓←→</span><span>Pan camera</span></div>
        <div class="ctrl-row"><span class="key">SPACE</span><span>Pause / Resume</span></div>
        <div class="ctrl-row"><span class="key">M</span><span>Mute / Unmute</span></div>
      </div>
      <div class="menu-col">
        <div class="col-hdr">HOTKEYS</div>
        <div class="ctrl-row"><span class="key">P/B/F</span><span>Plant / Barracks / Refinery</span></div>
        <div class="ctrl-row"><span class="key">T/K</span><span>Turret / Tech Lab</span></div>
        <div class="ctrl-row"><span class="key">A</span><span>Attack-move order</span></div>
        <div class="ctrl-row"><span class="key">S/G/R</span><span>Stop / Guard / Retreat</span></div>
        <div class="ctrl-row"><span class="key">ESC</span><span>Cancel build mode</span></div>
      </div>
    </div>

    <div class="tips-row">
      <span class="tip">⚡ Power down = turrets offline</span>
      <span class="tip">🪨 Rocks give 50% cover</span>
      <span class="tip">◈ Black Market = 3 abilities</span>
      <span class="tip">★ Veterans deal +15% damage</span>
      <span class="tip">⚔ Flank tanks for +25–40% dmg</span>
    </div>

    <button class="start-btn" onclick={startGame}>
      ▶ {menuMode === 'campaign' ? 'START CAMPAIGN' : 'START SKIRMISH'}
    </button>
    <div class="press-hint">or press ENTER</div>
    {/if}

    <div class="menu-disclaimer">
      <p>An ode to Command &amp; Conquer — built from scratch in 48 hours as an act of free will.</p>
      <p>This is a fan-made tribute. Not affiliated with, endorsed by, or attempting to steal from Electronic Arts.</p>
    </div>
  </div>
</div>
{#if false}{/if}
{/if}

<!-- ══════════════════════════════════════════════════
     WIN / LOSE OVERLAY — Stats Card
══════════════════════════════════════════════════ -->
{#if $gameState === 'won' || $gameState === 'lost'}
<div class="overlay stats-overlay">
  <div class="box stats-box">
    <div class="box-corners">
      <span></span><span></span><span></span><span></span>
    </div>

    <!-- Result header -->
    <div class="ot" class:win={$gameState==='won'} class:lose={$gameState==='lost'}>
      {$gameState === 'won' ? '✓ MISSION COMPLETE' : '✗ MISSION FAILED'}
    </div>
    <div class="os">
      {$gameState === 'won'
        ? 'Objective secured. Excellent command.'
        : 'Base overrun. Regroup and try again.'}
    </div>

    <div class="stats-divider"></div>

    <!-- Stats cards -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="sc-lbl">TIME ELAPSED</div>
        <div class="sc-val">{fmtTime($gameTimeElapsed)}</div>
      </div>
      <div class="stat-card">
        <div class="sc-lbl">ENEMIES KILLED</div>
        <div class="sc-val kills">{$enemiesKilled}</div>
      </div>
      <div class="stat-card">
        <div class="sc-lbl">UNITS PRODUCED</div>
        <div class="sc-val prod">{$unitsProduced}</div>
      </div>
      <div class="stat-card">
        <div class="sc-lbl">UNITS LOST</div>
        <div class="sc-val lost">{$unitsLost}</div>
      </div>
    </div>

    <!-- Production vs Kills graph -->
    {#if graphData}
    <div class="graph-wrap">
      <div class="graph-legend">
        <span class="gl-item kills-leg">── Kills</span>
        <span class="gl-item prod-leg">── Produced</span>
      </div>
      <svg viewBox="0 0 {graphData.W} {graphData.H}" class="stat-graph"
        width={graphData.W} height={graphData.H}>
        <!-- Grid lines -->
        <line x1="6" y1="{graphData.H/2}" x2="{graphData.W-6}" y2="{graphData.H/2}"
          stroke="rgba(0,80,30,0.4)" stroke-width="1" stroke-dasharray="4,4"/>
        <line x1="6" y1="6" x2="{graphData.W-6}" y2="6"
          stroke="rgba(0,80,30,0.25)" stroke-width="1" stroke-dasharray="4,4"/>
        <!-- X axis baseline -->
        <line x1="6" y1="{graphData.H-6}" x2="{graphData.W-6}" y2="{graphData.H-6}"
          stroke="rgba(0,120,50,0.5)" stroke-width="1"/>
        <!-- Production line (teal) -->
        <polyline points={graphData.ppts}
          stroke="#44AAFF" fill="none" stroke-width="1.5" opacity="0.85"/>
        <!-- Kills line (green) -->
        <polyline points={graphData.kpts}
          stroke="#00FF88" fill="none" stroke-width="2" opacity="0.9"/>
        <!-- Y-axis label -->
        <text x="8" y="14" fill="rgba(0,200,80,0.5)" font-size="7" font-family="Courier New">
          {graphData.maxK}
        </text>
        <!-- time labels -->
        <text x="6" y="{graphData.H-1}" fill="rgba(0,150,60,0.5)" font-size="7" font-family="Courier New">0s</text>
        <text x="{graphData.W-26}" y="{graphData.H-1}" fill="rgba(0,150,60,0.5)" font-size="7" font-family="Courier New">
          {graphData.maxT}s
        </text>
      </svg>
    </div>
    {:else}
    <div class="no-graph">No data recorded</div>
    {/if}

    <div class="stats-divider"></div>

    <!-- Action buttons -->
    <div class="end-btns">
      <button class="end-btn primary" onclick={() => engine?.restart()}>
        {$gameState === 'won' ? '▶ NEXT MISSION' : '↺ RETRY MISSION'}
      </button>
      <button class="end-btn secondary" onclick={() => gameState.set('menu')}>
        ◀ MAIN MENU
      </button>
    </div>
    <div class="press-hint">ENTER to continue</div>
  </div>
</div>
{/if}

<style>
  /* ── WRAPPER ───────────────────────────────────────── */
  #wrapper {
    position: fixed; top: 0; left: 0;
    transform-origin: 0 0;
    display: flex; flex-direction: column;
    width: 1100px;
    filter: drop-shadow(0 0 32px rgba(0,180,60,0.18)) drop-shadow(0 0 6px rgba(0,100,40,0.4));
  }

  /* ── HEADER ────────────────────────────────────────── */
  header {
    height: 38px;
    background: linear-gradient(180deg, #081208 0%, #040C04 100%);
    border: 1px solid #1A3A1A;
    border-bottom: 1px solid #0E2A0E;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 12px;
    position: relative;
  }
  header::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, #00EE55 20%, #00EE55 80%, transparent);
    opacity: 0.55;
  }
  .hd-left  { display: flex; align-items: center; gap: 8px; }
  .pip      { display: inline-block; width: 7px; height: 7px; background: #00FF66;
               border-radius: 50%; box-shadow: 0 0 8px #00FF66; animation: blink-pip 2.4s infinite; }
  .title    { font-size: 12px; font-weight: bold; color: #00EE55; letter-spacing: 3px; font-family: 'Courier New', monospace; }
  .sub      { font-size: 8px; color: #274A27; letter-spacing: 2px; font-family: 'Courier New', monospace; }
  .hd-center { position: absolute; left: 50%; transform: translateX(-50%); }
  .wave-badge {
    font-size: 10px; color: #FFAA44; letter-spacing: 2px;
    padding: 2px 10px; border: 1px solid #3A2A00;
    background: rgba(40,24,0,0.7);
    font-family: 'Courier New', monospace;
    transition: color 0.3s, border-color 0.3s;
  }
  .wave-badge.incoming {
    color: #FF3322; border-color: #6A1A0A; background: rgba(60,10,5,0.8);
    animation: pulse-warn 0.5s infinite alternate;
  }
  .hd-right { display: flex; align-items: center; gap: 8px; }
  .tech-id  { font-size: 8px; color: #1E4A1E; letter-spacing: 1px; font-family: 'Courier New', monospace; }
  .hd-mute  {
    background: none; border: 1px solid #1A3A1A; cursor: pointer;
    font-size: 14px; padding: 1px 4px; opacity: 0.7; line-height: 1;
    transition: opacity 0.15s, border-color 0.15s;
  }
  .hd-mute:hover { opacity: 1; border-color: #3A7A3A; }

  /* ── DISPLAY FRAME ─────────────────────────────────── */
  .display-frame {
    position: relative;
    border: 1px solid #1A3A1A; border-top: none;
    box-shadow: inset 0 0 40px rgba(0,180,60,0.04), 0 0 0 1px rgba(0,80,30,0.3);
  }
  .tick { position: absolute; width: 10px; height: 10px; border-color: #00EE55; border-style: solid; opacity: 0.5; pointer-events: none; z-index: 2; }
  .tick.tl { top: -1px; left: -1px;  border-width: 2px 0 0 2px; }
  .tick.tr { top: -1px; right: -1px; border-width: 2px 2px 0 0; }
  .tick.bl { bottom: -1px; left: -1px;  border-width: 0 0 2px 2px; }
  .tick.br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
  .game-row { display: flex; height: 600px; overflow: hidden; }

  /* ── STATUS STRIP ──────────────────────────────────── */
  .status-strip {
    height: 14px; background: #030703; border: 1px solid #0E1E0E; border-top: none;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 12px; font-size: 7px; color: #1A3A1A; letter-spacing: 1.5px;
    font-family: 'Courier New', monospace;
  }

  :global(.minimap) { display: block; border: 1px solid #1A3A1A; }

  /* ── OVERLAY BASE ──────────────────────────────────── */
  .overlay {
    position: fixed; inset: 0; background: rgba(0,3,1,0.90);
    display: flex; align-items: center; justify-content: center;
    z-index: 100; backdrop-filter: blur(4px);
  }
  .menu-overlay { cursor: default; }
  .stats-overlay { cursor: default; }

  .box {
    position: relative;
    background: linear-gradient(160deg, #060F06 0%, #040A04 100%);
    border: 1px solid #1A4A1A;
    padding: 36px 52px;
    box-shadow: 0 0 80px rgba(0,200,80,0.14), inset 0 0 60px rgba(0,40,15,0.3);
    font-family: 'Courier New', Courier, monospace;
  }
  .box-corners { position: absolute; inset: 0; pointer-events: none; }
  .box-corners span {
    position: absolute; width: 14px; height: 14px;
    border-color: #00EE55; border-style: solid; opacity: 0.7;
  }
  .box-corners span:nth-child(1) { top: 6px;    left: 6px;  border-width: 2px 0 0 2px; }
  .box-corners span:nth-child(2) { top: 6px;    right: 6px; border-width: 2px 2px 0 0; }
  .box-corners span:nth-child(3) { bottom: 6px; left: 6px;  border-width: 0 0 2px 2px; }
  .box-corners span:nth-child(4) { bottom: 6px; right: 6px; border-width: 0 2px 2px 0; }

  /* ── MAIN MENU ─────────────────────────────────────── */
  .menu-box { width: min(780px, 96vw); text-align: left; }

  .rush-title {
    font-size: 54px; font-weight: 900; letter-spacing: 14px; color: #00FF66;
    text-shadow: 0 0 40px rgba(0,255,100,0.7), 0 0 80px rgba(0,200,60,0.3);
    text-align: center; margin-bottom: 4px;
  }
  .rush-sub {
    text-align: center; font-size: 10px; letter-spacing: 6px;
    color: #2A6A2A; margin-bottom: 12px;
  }
  .menu-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, #1E6A1E 20%, #1E6A1E 80%, transparent);
    margin: 10px 0;
  }

  /* Mode tabs */
  .mode-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
  .mode-tab {
    flex: 1; padding: 8px; background: #0A1A0A; border: 1px solid #1A3A1A;
    color: #3A7A3A; cursor: pointer; font-family: inherit; font-size: 10px;
    letter-spacing: 2px; transition: all 0.1s;
  }
  .mode-tab:hover { background: #0D220D; border-color: #3A6A3A; color: #66AA66; }
  .mode-tab.active { background: #0D2A0D; border-color: #00EE55; color: #00FF88; font-weight: bold; }

  /* Campaign panel */
  .campaign-panel { }
  .camp-progress { display: flex; gap: 0; margin-bottom: 10px; }
  .camp-step {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    gap: 4px; padding: 6px; border: 1px solid #1A3A1A;
    background: #080E08; position: relative;
  }
  .camp-step:not(:last-child)::after {
    content: '→'; position: absolute; right: -10px; top: 50%; transform: translateY(-50%);
    color: #1A3A1A; font-size: 12px; z-index: 1;
  }
  .camp-step.active { border-color: #00EE55; background: #0A1A0A; }
  .camp-step.done   { border-color: #224422; background: #081208; }
  .camp-dot {
    width: 22px; height: 22px; border-radius: 50%;
    border: 1px solid #2A5A2A; background: #0A150A;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; color: #3A7A3A;
  }
  .camp-step.active .camp-dot { border-color: #00EE55; color: #00FF88; background: #0D250D; box-shadow: 0 0 8px rgba(0,238,85,0.4); }
  .camp-step.done   .camp-dot { border-color: #338833; color: #33FF88; background: #0A1A0A; }
  .camp-name { font-size: 7px; color: #3A6A3A; letter-spacing: 0.5px; text-align: center; }
  .camp-step.active .camp-name { color: #88CC88; }
  .camp-step.done   .camp-name { color: #448844; }

  /* Briefing */
  .briefing {
    background: rgba(0,30,10,0.4); border: 1px solid #0E2E0E;
    padding: 10px 14px; margin-bottom: 10px;
  }
  .brief-hdr { color: #FFD700; font-size: 9px; letter-spacing: 2px; margin-bottom: 6px; font-weight: bold; }
  .briefing p { color: #6A9A6A; font-size: 10px; line-height: 1.7; margin: 0 0 8px 0; }
  .brief-stats { display: flex; gap: 10px; margin-top: 6px; }
  .bstat { display: flex; flex-direction: column; gap: 2px; }
  .bs-lbl { color: #3A6A3A; font-size: 7px; letter-spacing: 1px; }
  .bs-val { color: #AAFFAA; font-size: 11px; font-weight: bold; }

  /* Skirmish panel */
  .skirmish-panel { }
  .map-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
  .map-card {
    background: #080E08; border: 1px solid #1A3A1A; padding: 10px 8px;
    cursor: pointer; font-family: inherit; text-align: left;
    transition: all 0.1s;
  }
  .map-card:hover { background: #0D180D; border-color: #3A6A3A; }
  .map-card.selected { border-color: #00EE55; background: #0A1A0A; box-shadow: 0 0 12px rgba(0,238,85,0.15); }
  .mc-num  { color: #2A6A2A; font-size: 18px; font-weight: bold; letter-spacing: 2px; margin-bottom: 3px; }
  .map-card.selected .mc-num { color: #00EE55; }
  .mc-name { color: #88CC88; font-size: 9px; font-weight: bold; letter-spacing: 1px; margin-bottom: 2px; }
  .mc-sub  { color: #3A6A3A; font-size: 7px; letter-spacing: 0.5px; margin-bottom: 6px; }
  .mc-diff { display: flex; align-items: center; gap: 5px; }
  .mcd-lbl { color: #3A5A3A; font-size: 7px; }
  .mcd-pips { display: flex; gap: 3px; }
  .mcd-pip { width: 8px; height: 8px; border: 1px solid #1A3A1A; background: #0A120A; }
  .mcd-pip.lit { background: #00CC55; border-color: #00EE55; box-shadow: 0 0 4px rgba(0,238,85,0.5); }
  .sk-brief { margin-bottom: 0; }

  /* Controls grid */
  .menu-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .menu-col  { background: rgba(0,20,5,0.3); border: 1px solid #0E2A0E; padding: 8px 12px; }
  .col-hdr   { color: #00CC55; font-size: 8px; letter-spacing: 2px; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #0E2A0E; padding-bottom: 4px; }
  .ctrl-row  { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
  .key       { min-width: 40px; padding: 1px 4px; background: #0A2A0A; border: 1px solid #1E4A1E; color: #00EE55; font-size: 8px; text-align: center; font-weight: bold; }
  .ctrl-row span:last-child { color: #5A8A5A; font-size: 9px; }

  .tips-row  { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
  .tip       { font-size: 9px; color: #4A7A4A; padding: 3px 7px; border: 1px solid #0E2A0E; background: rgba(0,20,5,0.3); }

  .start-btn {
    display: block; width: 100%; padding: 13px;
    background: linear-gradient(180deg, #0D3A1A 0%, #081A0C 100%);
    border: 1px solid #33AA55; color: #00FF88;
    font-family: 'Courier New', Courier, monospace;
    font-size: 15px; font-weight: bold; letter-spacing: 5px;
    cursor: pointer; text-align: center;
    transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
    box-shadow: 0 0 20px rgba(0,200,80,0.15);
  }
  .start-btn:hover {
    background: linear-gradient(180deg, #173D22 0%, #0D2A14 100%);
    border-color: #55FF88; box-shadow: 0 0 30px rgba(0,255,100,0.25); color: #AAFFCC;
  }
  .press-hint { text-align: center; color: #2A4A2A; font-size: 8px; letter-spacing: 2px; margin-top: 7px; animation: blink-pip 2s infinite; }

  /* ── STATS END-SCREEN ──────────────────────────────── */
  .stats-box { width: 640px; text-align: center; padding: 32px 48px; }

  .ot { font-size: 28px; font-weight: bold; letter-spacing: 5px; margin-bottom: 6px; }
  .ot.win  { color: #00FF88; text-shadow: 0 0 30px rgba(0,255,136,0.5); }
  .ot.lose { color: #FF3333; text-shadow: 0 0 30px rgba(255,50,50,0.5); }
  .os { color: #557755; font-size: 11px; letter-spacing: 2px; margin-bottom: 0; }
  .stats-divider {
    height: 1px; margin: 14px 0;
    background: linear-gradient(90deg, transparent, #1E6A1E 20%, #1E6A1E 80%, transparent);
  }

  .stat-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
  .stat-card  { background: #080E08; border: 1px solid #1A3A1A; padding: 10px 8px; }
  .sc-lbl     { color: #3A6A3A; font-size: 7px; letter-spacing: 1px; margin-bottom: 4px; }
  .sc-val     { color: #AAFFAA; font-size: 18px; font-weight: bold; letter-spacing: 1px; }
  .sc-val.kills { color: #33FF88; }
  .sc-val.prod  { color: #44AAFF; }
  .sc-val.lost  { color: #FF5544; }

  /* Graph */
  .graph-wrap { margin-bottom: 4px; }
  .graph-legend { display: flex; gap: 16px; justify-content: center; margin-bottom: 5px; }
  .gl-item  { font-size: 9px; letter-spacing: 1px; }
  .kills-leg { color: #00FF88; }
  .prod-leg  { color: #44AAFF; }
  .stat-graph {
    display: block; width: 100%;
    background: #060E06; border: 1px solid #1A3A1A;
  }
  .no-graph { color: #2A4A2A; font-size: 9px; padding: 10px; }

  /* End buttons */
  .end-btns { display: flex; gap: 10px; margin-top: 14px; }
  .end-btn  {
    flex: 1; padding: 12px; border: 1px solid #1A4A1A;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px; font-weight: bold; letter-spacing: 3px;
    cursor: pointer; transition: all 0.1s;
  }
  .end-btn.primary {
    background: linear-gradient(180deg, #0D3A1A, #081A0C);
    border-color: #33AA55; color: #00FF88;
  }
  .end-btn.primary:hover { background: linear-gradient(180deg,#173D22,#0D2A14); border-color: #55FF88; }
  .end-btn.secondary {
    background: #080E08; border-color: #1E3A1E; color: #3A7A3A;
  }
  .end-btn.secondary:hover { background: #0D180D; border-color: #3A6A3A; color: #66AA66; }

  /* ── PAUSE & MENU HEADER BUTTONS ─────────────────── */
  .hd-pause {
    background: none; border: 1px solid #1A3A1A; cursor: pointer;
    font-size: 13px; padding: 2px 7px; color: #00EE55; opacity: 0.8; line-height: 1;
    transition: opacity 0.15s, border-color 0.15s;
  }
  .hd-pause:hover { opacity: 1; border-color: #3A7A3A; }

  .hd-menu {
    background: none; border: 1px solid #1A3A1A; cursor: pointer;
    font-size: 8px; padding: 2px 7px; color: #5A8A5A; opacity: 0.75;
    letter-spacing: 1px; line-height: 1;
    font-family: 'Courier New', monospace;
    transition: opacity 0.15s, border-color 0.15s, color 0.15s;
  }
  .hd-menu:hover { opacity: 1; border-color: #3A7A3A; color: #AAFFAA; }

  /* ── PAUSED OVERLAY ────────────────────────────────── */
  .paused-overlay {
    position: absolute; inset: 0; z-index: 20;
    /* only darken the left 900 px (canvas) — sidebar stays visible */
    background: linear-gradient(
      to right,
      rgba(0,3,1,0.72) 0%,
      rgba(0,3,1,0.72) 820px,
      rgba(0,3,1,0.00) 900px
    );
    display: flex; align-items: center; justify-content: flex-start;
    padding-left: calc(900px / 2 - 110px);
    pointer-events: none;
  }
  .paused-content { text-align: center; }
  .paused-title {
    font-size: 32px; font-weight: bold; letter-spacing: 10px;
    color: #00FF88;
    text-shadow: 0 0 28px rgba(0,255,136,0.65), 0 0 60px rgba(0,200,60,0.3);
    font-family: 'Courier New', monospace;
    animation: blink-pause 1.6s ease-in-out infinite;
  }
  .paused-hint {
    font-size: 9px; color: #3A7A3A; letter-spacing: 3px;
    font-family: 'Courier New', monospace; margin-top: 10px;
  }

  /* ── ANIMATIONS ────────────────────────────────────── */
  @keyframes blink-pip   { 0%,100%{opacity:1} 50%{opacity:0.2} }
  @keyframes pulse-warn  { from{opacity:.8} to{opacity:1} }
  @keyframes blink-pause { 0%,100%{opacity:1} 50%{opacity:0.35} }

  /* ── SURVIVAL BADGE ────────────────────────────────── */
  .survival-badge { color: #44CCFF !important; border-color: #226688 !important; background: rgba(0,20,40,0.8) !important; }
  .survival-badge.incoming { color: #FF3322 !important; border-color: #6A1A0A !important; }

  /* ── SKIRMISH survival tag ──────────────────────────── */
  .mc-mode-tag { font-size: 7px; color: #44CCFF; letter-spacing: 1px; }

  /* ── CODEX PANEL ───────────────────────────────────── */
  .codex-panel { display: flex; gap: 12px; margin-bottom: 10px; }
  .codex-list  { display: flex; flex-direction: column; gap: 3px; min-width: 160px; }
  .codex-unit-btn {
    display: flex; align-items: center; gap: 8px;
    background: #080E08; border: 1px solid #1A3A1A;
    padding: 5px 8px; cursor: pointer; font-family: inherit; text-align: left;
    transition: all 0.1s;
  }
  .codex-unit-btn:hover { background: #0D180D; border-color: #3A6A3A; }
  .codex-unit-btn.active { border-color: #00EE55; background: #0A1A0A; }
  .cu-icon {
    width: 22px; height: 22px; border: 1px solid; border-radius: 3px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: bold; flex-shrink: 0;
  }
  .cu-name { font-size: 8px; color: #88CC88; letter-spacing: 0.5px; flex: 1; }
  .cu-role { font-size: 7px; color: #3A6A3A; }

  .codex-detail { flex: 1; background: rgba(0,15,5,0.4); border: 1px solid #1A3A1A; padding: 12px 14px; }
  .cd-header   { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
  .cd-icon     {
    width: 48px; height: 48px; border: 2px solid; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: bold; flex-shrink: 0;
  }
  .cd-title-block { flex: 1; }
  .cd-name  { font-size: 13px; font-weight: bold; color: #AAFFAA; letter-spacing: 2px; margin-bottom: 4px; }
  .cd-roles { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px; }
  .cd-tag   { font-size: 7px; padding: 1px 5px; border: 1px solid #2A5A2A; background: rgba(0,40,10,0.4); color: #66AA66; letter-spacing: 1px; }
  .cd-cost  { font-size: 10px; color: #FFDD44; letter-spacing: 1px; }

  .cd-lore { font-size: 9px; color: #6A9A6A; line-height: 1.65; margin-bottom: 12px; border-left: 2px solid #1A4A1A; padding-left: 8px; }

  .cd-stats { display: flex; flex-direction: column; gap: 6px; }
  .cd-stat-row { display: flex; align-items: center; gap: 8px; }
  .cd-stat-lbl { width: 48px; font-size: 7px; color: #4A7A4A; letter-spacing: 1px; flex-shrink: 0; }
  .cd-bar-track { flex: 1; height: 6px; background: #0A1A0A; border: 1px solid #1A3A1A; overflow: hidden; }
  .cd-bar-fill  { height: 100%; transition: width 0.3s; }
  .cd-stat-val  { width: 28px; font-size: 8px; color: #88CC88; text-align: right; flex-shrink: 0; }

  /* ── DISCLAIMER ────────────────────────────────────── */
  .menu-disclaimer {
    margin-top: 18px; padding-top: 12px; border-top: 1px dashed #1E4A1E;
    text-align: center; color: #3A6A3A; font-size: 8.5px; letter-spacing: 0.5px;
    line-height: 1.5; font-family: 'Courier New', monospace;
  }
  .menu-disclaimer p { margin: 3px 0; }
  .menu-disclaimer p:first-child { color: #669966; font-weight: bold; }

  /* ── RESPONSIVE ─────────────────────────────────────── */
  /* Compact menu on narrow viewports (phone landscape / small tablets) */
  @media (max-width: 700px) {
    .box { padding: 20px 18px; }
    .rush-title { font-size: 36px; letter-spacing: 8px; }
    .rush-sub { font-size: 8px; letter-spacing: 3px; }
    .camp-progress { flex-wrap: wrap; }
    .map-cards { grid-template-columns: 1fr 1fr; }
    .brief-stats { flex-direction: column; gap: 6px; }
  }
  /* Tighter end-screen on small windows */
  @media (max-height: 560px) {
    .stats-box { padding: 18px 28px; }
    .stat-cards { grid-template-columns: repeat(4, 1fr); }
    .graph-wrap { display: none; }
  }
</style>
