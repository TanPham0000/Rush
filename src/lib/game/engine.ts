import {
  MAP_W, MAP_H, VIEW_W, VIEW_H,
  BDEF, WAVES, ENDLESS_INTERVAL,
  FOG_CELL, FOG_COLS, FOG_ROWS,
  TRAIN_TIME, UNIT_COST, HOLD_WIN_TIME,
  MAPS, C,
} from './constants';
import type { BType, MapDef } from './constants';
import { rnd, rndi, hypot, clamp, resetIds, nextId } from './utils';
import { TerrainMap } from './terrain';
import {
  Building, Turret, TiberiumField, Projectile,
  Unit, Tank, HeavyTank, Grenadier, Artillery, Scout, AntitankGun,
  Harvester, EnemyUnit, CaptureNode,
  type GameRef, type Entity, type TurretVariant,
} from './entities';
import {
  credits, powerGen, powerUsed, incomeRate,
  wave, nextWaveIn, waveIncoming, totalWaves,
  gameState, selected, buildMode,
  statusMsg, selHasBarracks, selHasRefinery, selHasWarFactory, selHasUnits,
  hasBarracks, hasRefinery, hasTechLab, hasWarFactory, selHasTechLab,
  selHasTurret, selTurretVariant,
  warFactoryHp, warFactoryMaxHp,
  enemiesKilled, unitsLost, unitsProduced,
  selBuildingQueue, captureNodesState, holdProgress,
  upgrades as upgradesStore,
  blackMarketCaptured, blackMarketAbilities,
  statsHistory, gameTimeElapsed, campaignMap,
  paused as pausedStore,
  survivalMode, survivalTimeLeft, survivalTotal,
} from '$lib/stores/gameStore';
import { sound } from './sound';
import { get } from 'svelte/store';

// ═══════════════════════════════════════════════════════════════
// BUILD QUEUE
// ═══════════════════════════════════════════════════════════════
interface QueueItem { type:string; timer:number; maxTimer:number; bldId:number }

// ═══════════════════════════════════════════════════════════════
// FX
// ═══════════════════════════════════════════════════════════════
interface Particle  { x:number;y:number;vx:number;vy:number;life:number;maxLife:number;color:string;r:number }
interface FlashMsg  { text:string;x:number;y:number;t:number;maxT:number;color:string }

// Tiberium respawn
interface TibRespawn { cx:number;cy:number;timer:number }

// ═══════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════
export class Engine {
  canvas:  HTMLCanvasElement;
  ctx:     CanvasRenderingContext2D;
  terrain: TerrainMap;

  // Entity lists
  buildings:    Building[]      = [];
  pUnits:       Unit[]          = [];
  eUnits:       Unit[]          = [];
  tibFields:    TiberiumField[] = [];
  projectiles:  Projectile[]    = [];
  captureNodes: CaptureNode[]   = [];
  _selected:    Entity[]        = [];

  // Economy
  _credits:   number=1000; _totalIncome:number=0;
  _powerGen:  number=5;    _powerUsed:number=0; _powerOk:boolean=true;

  // Build mode
  _buildMode:    BType|null=null;
  _commandMode:  'attack-move'|null=null;

  // Camera & zoom
  _camX:number=0; _camY:number=300; _zoom:number=1.0;
  _camVelX:number=0; _camVelY:number=0;

  // Fog of war (0=unexplored, 1=explored, 2=visible)
  _fogGrid: Uint8Array=new Uint8Array(FOG_COLS*FOG_ROWS);

  // Wave system
  _gameTime:number=0; _waveIndex:number=0; _wavesPassed:number=0;
  _spawnTimer:number=WAVES[0].at; _wavePending:boolean=false; _waveLabel:number=0;

  // FX
  _particles:  Particle[]=[];
  _flashMsgs:  FlashMsg[]=[];
  _moveInd:    {x:number;y:number;t:number}|null=null;

  // Stats
  _enemiesKilled:number=0; _unitsLost:number=0; _unitsProduced:number=0;

  // Tiberium
  _tibSpawnTimer:number=rnd(55,80); _tibSpawnCount:number=0;
  _tibRespawnQueue: TibRespawn[]=[];

  // Build queue
  _queues: Map<number,QueueItem[]>=new Map();

  // Upgrades & campaign
  _upgrades:   Set<string>=new Set();
  _mapDef:     MapDef=MAPS[0];
  _campaignMapIdx:number=0;

  // Black market
  _blackMarketAbilities: string[]=['Artillery Strike','Reinforcements','EMP Burst'];
  _blackMarketCaptured:  boolean=false;

  // Stats snapshots (every 5s)
  _statsTimer:  number=0;
  _statsSnaps:  {t:number;kills:number;produced:number;credits:number}[]=[];

  // Artillery strike overlay
  _artilleryTarget: {x:number;y:number;timer:number}|null=null;

  // Pause
  _paused: boolean=false;

  // Survival mode
  _survivalWaveTimer: number=60;   // seconds until next beach wave

  // Special capture node state
  _radarActive: boolean=false;     // full-map fog reveal
  _beachGunId:  number|null=null;  // turret entity ID spawned by beach gun capture

  private _raf:number=0;
  private _lastTime:number=0;
  private _stTimer:ReturnType<typeof setTimeout>|null=null;
  private _ref: GameRef;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d')!;
    canvas.width=VIEW_W; canvas.height=VIEW_H;
    const idx=get(campaignMap);
    this._campaignMapIdx=idx;
    this._mapDef=MAPS[idx]??MAPS[0];
    this.terrain=new TerrainMap(this._mapDef.theme);
    this._ref={ terrain:this.terrain, addCredits:(n)=>this._addCredits(n), buildings:this.buildings, tibFields:this.tibFields, pUnits:this.pUnits };
    this._init();
  }

  // ── COORDINATE CONVERSION ──────────────────────────────────
  screenToWorld(sx:number,sy:number){ return{x:sx/this._zoom+this._camX,y:sy/this._zoom+this._camY}; }

  // ── INIT ─────────────────────────────────────────────────
  _init() {
    resetIds();
    const md=this._mapDef;
    this._credits=md.startCredits; this._totalIncome=0;
    this.buildings=[]; this.pUnits=[]; this.eUnits=[];
    this.tibFields=[]; this.projectiles=[]; this._selected=[];
    this._particles=[]; this._flashMsgs=[]; this._moveInd=null;
    this._buildMode=null; this._commandMode=null;
    this._enemiesKilled=0; this._unitsLost=0; this._unitsProduced=0;
    this._tibSpawnTimer=rnd(55,80); this._tibSpawnCount=0; this._tibRespawnQueue=[];
    this._gameTime=0; this._waveIndex=0; this._wavesPassed=0;
    this._spawnTimer=WAVES[0].at; this._wavePending=false;
    this._queues=new Map(); this._upgrades=new Set();
    this._fogGrid=new Uint8Array(FOG_COLS*FOG_ROWS);
    this._camX=0; this._camY=300; this._zoom=1.0;
    this._blackMarketCaptured=false;
    this._blackMarketAbilities=['Artillery Strike','Reinforcements','EMP Burst'];
    this._artilleryTarget=null;
    this._statsTimer=0; this._statsSnaps=[];
    this._radarActive=false; this._beachGunId=null;

    this._ref.buildings=this.buildings;
    this._ref.tibFields=this.tibFields;
    this._ref.pUnits=this.pUnits;
    this._ref.onKill=(killer,victim)=>{ /* veterancy handled in Projectile */ };
    this._ref.onExplosion=(x,y,r)=>{ this._boom(x,y,'enemy'); };

    const pb=md.playerBase;
    const eb=md.enemyBase;
    const isSurvival = md.mode==='survival';

    if (isSurvival && md.preBuilt) {
      // ── BEACH DEFENCE — chaos under fire, dawn invasion feel ──
      // HQ + Economy (slightly inland, safe for now)
      this.buildings.push(new Building(pb.cx,      pb.cy,       'Construction Yard','player',true));
      this.buildings.push(new Building(pb.cx+160,  pb.cy-210,   'Power Plant',      'player',true));
      this.buildings.push(new Building(pb.cx+160,  pb.cy+210,   'Power Plant',      'player',true));
      this.buildings.push(new Building(pb.cx+160,  pb.cy-60,    'Refinery',         'player',true));
      this.buildings.push(new Building(pb.cx+160,  pb.cy+60,    'Refinery',         'player',true));
      this.buildings.push(new Building(pb.cx+320,  pb.cy,       'Barracks',         'player',true));
      this.buildings.push(new Building(pb.cx+320,  pb.cy+170,   'War Factory',      'player',true));
      // Only 2 turrets — manned positions, barely holding the line
      const turretSpots=[
        [960, 600],  // centre-road chokepoint
        [950, 200],  // northern sandbag emplacement
      ];
      for(const[tx,ty] of turretSpots){
        const t=new Turret(tx,ty,'player'); t.buildPct=1; this.buildings.push(t);
      }
      // Infantry scattered at the seawall / forward positions — scramble mode
      // Mix of Infantry and one Grenadier for variety
      const infSpots=[
        [460,160],[480,340],[460,540],[480,760],[460,980],[460,1100], // forest cover belt
        [920,300],[940,480],[920,720],[940,900],  // sandbag positions (forward)
        [700,420],[720,720],[700,580],            // mid-field (exposed, scrambling)
      ];
      for(const[ix,iy] of infSpots){
        const u=new Unit(ix,iy,'player'); u._game=this._ref; this.pUnits.push(u);
      }
      // One grenadier at the road chokepoint
      const gren=new Grenadier(960,600,'player'); gren._game=this._ref; this.pUnits.push(gren);
    } else {
      // ── STANDARD maps — minimal starting base ─────────────
      this.buildings.push(new Building(pb.cx,pb.cy,'Construction Yard','player',true));
      this.buildings.push(new Building(pb.cx+140,pb.cy+170,'Power Plant','player',true));
      this.buildings.push(new Building(pb.cx+140,pb.cy-170,'Refinery','player',true));

      // Enemy base
      this.buildings.push(new Building(eb.cx,eb.cy,'War Factory','enemy',true));
      const turretPositions=[[0,-150],[0,160],[-80,-270],[-80,280]];
      for(const[dx,dy] of turretPositions){
        const et=new Turret(eb.cx+dx,eb.cy+dy,'enemy'); et.buildPct=1; et.disabled=false; this.buildings.push(et);
      }
      if(md.theme===2){
        const et2=new Turret(eb.cx-200,eb.cy,'enemy'); et2.buildPct=1; et2.disabled=false; this.buildings.push(et2);
      }
    }

    // ── Tiberium fields ──────────────────────────────────────
    for(const{cx,cy} of md.tibFields) this.tibFields.push(new TiberiumField(cx,cy));

    // ── Starting harvester (for non-preBuilt maps) ───────────
    if (!isSurvival || !md.preBuilt) {
      const startHarv=new Harvester(pb.cx+220,pb.cy,this._ref);
      this.pUnits.push(startHarv);
    } else {
      // Beach Defence gets a harvester too
      const h=new Harvester(pb.cx+250,pb.cy-80,this._ref);
      this.pUnits.push(h);
    }
    this._ref.pUnits=this.pUnits;

    // ── Survival wave timer ───────────────────────────────────
    this._survivalWaveTimer = isSurvival ? 30 : 0;  // first beach wave at 30s

    // ── Starting camera ───────────────────────────────────────
    if (isSurvival && md.preBuilt) {
      // Zoom out so the player can see the beach and the approaching threat
      this._zoom = 0.68;
      this._camX = 0;
      this._camY = clamp(pb.cy - VIEW_H/(2*this._zoom), 0, Math.max(0, MAP_H - VIEW_H/this._zoom));
    }

    // ── Capture nodes ─────────────────────────────────────────
    this.captureNodes=md.captureNodes.map(n=>
      new CaptureNode(n.cx,n.cy,n.label,n.income,n.isCenter,n.isBlackMarket??false,n.isRadar??false,n.isBeachGun??false)
    );

    this._recalcPower();
    this._syncStores();
  }

  // ── POWER ─────────────────────────────────────────────────
  _recalcPower(){
    let gen=0,used=0;
    for(const b of this.buildings){
      if(b.team!=='player'||!b.isReady)continue;
      const p=BDEF[b.type].power;
      if(p>0)gen+=p;else used+=Math.abs(p);
    }
    this._powerGen=gen; this._powerUsed=used; this._powerOk=gen>=used;
    for(const b of this.buildings){if(b instanceof Turret&&b.team==='player')b.disabled=!this._powerOk;}
    for(const u of this.pUnits){if(u instanceof Harvester)u._speedMult=this._powerOk?1.0:0.6;}
    if(!this._powerOk) sound.lowPower();
  }

  // ── CREDITS ──────────────────────────────────────────────
  _addCredits(amt:number){
    this._credits+=amt; this._totalIncome+=amt;
    const ref=this.buildings.find(b=>b.type==='Refinery'&&b.team==='player');
    if(ref) this._flashMsgs.push({text:`+${Math.floor(amt)}`,x:ref.cx+rnd(-16,16),y:ref.y-8,t:1.1,maxT:1.1,color:C.tibGreen});
  }

  // ── CAMERA ───────────────────────────────────────────────
  setCamVel(vx:number,vy:number){ this._camVelX=vx; this._camVelY=vy; }

  setZoom(delta:number,screenX:number,screenY:number){
    const prevZoom=this._zoom;
    this._zoom=clamp(this._zoom+delta,0.35,1.0);
    const wx=screenX/prevZoom+this._camX, wy=screenY/prevZoom+this._camY;
    this._camX=wx-screenX/this._zoom; this._camY=wy-screenY/this._zoom;
    this._clampCamera();
  }

  _clampCamera(){
    const maxCamX=Math.max(0,MAP_W-VIEW_W/this._zoom);
    const maxCamY=Math.max(0,MAP_H-VIEW_H/this._zoom);
    this._camX=clamp(this._camX,0,maxCamX); this._camY=clamp(this._camY,0,maxCamY);
  }

  // ── FOG OF WAR ────────────────────────────────────────────
  _updateFog(){
    // Radar tower: full-map vision when captured
    if(this._radarActive){
      for(let i=0;i<this._fogGrid.length;i++) this._fogGrid[i]=2;
      return;
    }
    for(let i=0;i<this._fogGrid.length;i++){if(this._fogGrid[i]===2)this._fogGrid[i]=1;}
    const entities:{cx:number;cy:number;revealR:number}[]=[
      ...this.pUnits.map(u=>{
        const r=u instanceof Scout?u.visionRadius:200;
        return{cx:u.x,cy:u.y,revealR:r};
      }),
      ...this.buildings.filter(b=>b.team==='player').map(b=>({cx:b.cx,cy:b.cy,revealR:260})),
    ];
    for(const e of entities){
      const cellR=Math.ceil(e.revealR/FOG_CELL);
      const cCx=Math.floor(e.cx/FOG_CELL), cCy=Math.floor(e.cy/FOG_CELL);
      for(let dy=-cellR;dy<=cellR;dy++){
        for(let dx=-cellR;dx<=cellR;dx++){
          if(dx*dx+dy*dy>cellR*cellR)continue;
          const nx=cCx+dx,ny=cCy+dy;
          if(nx<0||nx>=FOG_COLS||ny<0||ny>=FOG_ROWS)continue;
          this._fogGrid[ny*FOG_COLS+nx]=2;
        }
      }
    }
  }

  _isFogVisible(wx:number,wy:number):boolean{
    const col=Math.floor(wx/FOG_CELL),row=Math.floor(wy/FOG_CELL);
    if(col<0||col>=FOG_COLS||row<0||row>=FOG_ROWS)return false;
    return this._fogGrid[row*FOG_COLS+col]===2;
  }

  // ── UPGRADES ─────────────────────────────────────────────
  researchUpgrade(key:string){
    const UPGRADE_COST:Record<string,number>={Grenadier:400,HeavyTank:500,AntitankGun:350,ArtilleryUnit:600};
    const cost=UPGRADE_COST[key]??999;
    if(this._upgrades.has(key))return this.setStatus('Already researched!','warn');
    if(this._credits<cost)return this.setStatus('Not enough credits!','error');
    if(!this.buildings.some(b=>b.team==='player'&&b.type==='Tech Lab'))return this.setStatus('Tech Lab required!','error');
    this._credits-=cost;
    this._upgrades.add(key);
    sound.upgrade();
    this.setStatus(`${key} unlocked!`,'success');
    this._syncStores();
  }

  // ── BLACK MARKET ABILITIES ────────────────────────────────
  useAbility(name:string){
    if(!this._blackMarketCaptured)return this.setStatus('Capture Black Market first!','warn');
    const idx=this._blackMarketAbilities.indexOf(name);
    if(idx<0)return this.setStatus('Ability not available!','warn');
    this._blackMarketAbilities.splice(idx,1);
    if(name==='Artillery Strike') this._callArtilleryStrike();
    else if(name==='Reinforcements') this._callReinforcements();
    else if(name==='EMP Burst') this._callEMP();
    this._syncStores();
  }

  _callArtilleryStrike(){
    // Strike the nearest cluster of enemy units
    let best:{cx:number;cy:number}|null=null,bestScore=0;
    for(const u of this.eUnits){
      if(!u.isAlive())continue;
      const nearby=this.eUnits.filter(e=>e.isAlive()&&hypot(u.x,u.y,e.x,e.y)<80).length;
      if(nearby>bestScore){bestScore=nearby;best={cx:u.x,cy:u.y};}
    }
    const target=best??this.buildings.find(b=>b.type==='War Factory');
    if(!target)return;
    this._artilleryTarget={x:target.cx,y:target.cy,timer:2.0};
    sound.artilleryFire();
    this.setStatus('Artillery strike incoming!','warn');
    setTimeout(()=>{
      const x=target.cx+rnd(-30,30),y=target.cy+rnd(-30,30);
      for(const u of this.eUnits){if(hypot(u.x,u.y,x,y)<80)u.takeDmg(120);}
      for(const b of this.buildings.filter(b=>b.team==='enemy')){if(hypot(b.cx,b.cy,x,y)<60)b.takeDmg(200);}
      this._boom(x,y,'enemy');
      this._flashMsgs.push({text:'STRIKE!',x,y:y-40,t:2,maxT:2,color:'#FF4400'});
      this._artilleryTarget=null;
    },2000);
  }

  _callReinforcements(){
    const base=this.buildings.find(b=>b.team==='player'&&b.type==='Construction Yard')??this.buildings.find(b=>b.team==='player');
    if(!base)return;
    const hasHT=this._upgrades.has('HeavyTank');
    const hasGR=this._upgrades.has('Grenadier');
    const spawn=(cls:new(x:number,y:number,team:'player'|'enemy')=>Unit,count:number)=>{
      for(let i=0;i<count;i++){
        const ang=Math.random()*Math.PI*2,r=rnd(60,100);
        const u=new cls(base.cx+Math.cos(ang)*r,base.cy+Math.sin(ang)*r,'player');
        u._game=this._ref; this.pUnits.push(u);
      }
    };
    if(hasHT) spawn(HeavyTank,2); else spawn(Tank,3);
    if(hasGR) spawn(Grenadier,3); else spawn(Unit,3);
    this._ref.pUnits=this.pUnits;
    sound.reinforcements();
    this.setStatus('Reinforcements deployed!','success');
    this._flashMsgs.push({text:'REINFORCEMENTS!',x:base.cx,y:base.cy-60,t:2.5,maxT:2.5,color:C.allyAccent});
  }

  _callEMP(){
    let affected=0;
    for(const u of this.eUnits){u._suppressTimer=Math.max(u._suppressTimer,5.0);affected++;}
    for(const b of this.buildings.filter(b=>b.team==='enemy'&&b instanceof Turret)){(b as Turret).disabled=true; setTimeout(()=>{(b as Turret).disabled=false;},6000);}
    sound.empBlast();
    this.setStatus(`EMP! ${affected} enemies suppressed for 5s`,'success');
    this._flashMsgs.push({text:'EMP!',x:MAP_W/2,y:MAP_H/2-40,t:2.5,maxT:2.5,color:'#FFEE00'});
  }

  // ── TURRET UPGRADE ───────────────────────────────────────
  upgradeTurret(variant: TurretVariant){
    if(variant==='standard')return;
    const costs:Record<string,number>={'anti-infantry':250,'anti-tank':350};
    const cost=costs[variant]??999;
    const t=this._selected.find(e=>e instanceof Turret&&e.team==='player') as Turret|undefined;
    if(!t)return this.setStatus('Select a turret first!','warn');
    if(t.variant!=='standard')return this.setStatus('Already upgraded!','warn');
    if(!this.buildings.some(b=>b.team==='player'&&b.type==='Tech Lab'))return this.setStatus('Tech Lab required!','error');
    if(this._credits<cost)return this.setStatus('Not enough credits!','error');
    this._credits-=cost;
    t.upgrade(variant);
    sound.upgrade();
    const label=variant==='anti-infantry'?'Anti-Infantry':'Anti-Tank';
    this.setStatus(`Turret upgraded → ${label}!`,'success');
    this._recalcPower();
    this._syncStores();
  }

  // ── PAUSE ────────────────────────────────────────────────
  togglePause(){
    this._paused=!this._paused;
    pausedStore.set(this._paused);
    if(!this._paused)this.setStatus('Game resumed','success');
  }

  // ── MINIMAP NAVIGATION ───────────────────────────────────
  centerCameraOn(wx:number,wy:number){
    this._camX=wx-VIEW_W/(2*this._zoom);
    this._camY=wy-VIEW_H/(2*this._zoom);
    this._clampCamera();
  }

  // ── BUILD ─────────────────────────────────────────────────
  enterBuild(type:BType){
    const cost=BDEF[type].cost;
    if(this._credits<cost)return this.setStatus('Not enough credits!','error');
    if(!this.buildings.some(b=>b.team==='player'&&b.type==='Construction Yard'))return this.setStatus('Construction Yard required!','error');
    if(type==='Tech Lab'&&!this.buildings.some(b=>b.team==='player'&&b.type==='Barracks'))return this.setStatus('Barracks required for Tech Lab!','error');
    if(type==='War Factory'&&!this.buildings.some(b=>b.team==='player'&&b.type==='Tech Lab'))return this.setStatus('Tech Lab required for War Factory!','error');
    this._buildMode=type; this._deselect();
    this.setStatus(`Click to place ${type}  ·  ESC = cancel`,'warn');
    this._syncStores();
  }

  cancelBuild(){ this._buildMode=null; this._commandMode=null; this.setStatus('Cancelled'); this._syncStores(); }

  placeBuild(wx:number,wy:number){
    if(!this._buildMode)return;
    const type=this._buildMode, cost=BDEF[type].cost;
    if(this._credits<cost){this.cancelBuild();return this.setStatus('Not enough credits!','error');}
    if(!this._isValidBuildPos(wx,wy))return this.setStatus('Cannot build here!','error');
    this._credits-=cost;
    const b=type==='Turret'?new Turret(wx,wy,'player'):new Building(wx,wy,type,'player');
    this.buildings.push(b); this._buildMode=null; this._recalcPower();
    // Auto-spawn a harvester beside every newly placed Refinery
    if(type==='Refinery'){
      const h=new Harvester(wx+60,wy,this._ref);
      h._speedMult=this._powerOk?1.0:0.6;
      this.pUnits.push(h);
    }
    sound.buildPlace();
    this.setStatus(`${type} placed!`,'success'); this._syncStores();
  }

  // ── TRAIN ─────────────────────────────────────────────────
  // ── Barracks ──────────────────────────────────────────────
  trainInfantry() { this._queueTrain('Barracks',this._upgrades.has('Grenadier')?'Grenadier':'Infantry',UNIT_COST['Infantry']); }
  trainScout()     { this._queueTrain('Barracks','Scout',UNIT_COST['Scout']); }
  trainAntitank(){
    if(!this._upgrades.has('AntitankGun'))return this.setStatus('AntitankGun upgrade required!','error');
    this._queueTrain('Barracks','AntitankGun',UNIT_COST['AntitankGun']);
  }
  // ── War Factory ───────────────────────────────────────────
  trainTank()      { this._queueTrain('War Factory',this._upgrades.has('HeavyTank')?'HeavyTank':'Tank',UNIT_COST['Tank']); }
  trainArtillery(){
    if(!this._upgrades.has('ArtilleryUnit'))return this.setStatus('Artillery upgrade required!','error');
    this._queueTrain('War Factory','Artillery',UNIT_COST['Artillery']);
  }
  trainHarvester() { this._queueTrain('Refinery','Harvester',UNIT_COST['Harvester']); }

  _queueTrain(bType:BType,unitType:string,cost:number){
    if(this._credits<cost)return this.setStatus('Not enough credits!','error');
    const brk=this._selected.find(e=>e instanceof Building&&e.type===bType&&e.team==='player') as Building|undefined;
    if(!brk)return this.setStatus(`Select a ${bType} first!`,'warn');
    if(!brk.isReady)return this.setStatus('Building still under construction!','warn');
    const queue=this._queues.get(brk.id)??[];
    if(queue.length>=5)return this.setStatus('Queue full!','warn');
    this._credits-=cost;
    queue.push({type:unitType,timer:TRAIN_TIME[unitType],maxTimer:TRAIN_TIME[unitType],bldId:brk.id});
    this._queues.set(brk.id,queue);
    this.setStatus(`${unitType} queued (${queue.length}/5)`,'success');
    this._syncStores();
  }

  _tickQueues(dt:number){
    for(const[bldId,queue] of this._queues){
      if(!queue.length)continue;
      const bld=this.buildings.find(b=>b.id===bldId&&b.isAlive());
      if(!bld){this._queues.delete(bldId);continue;}
      const item=queue[0]; item.timer-=dt;
      if(item.timer<=0){
        const ang=Math.random()*Math.PI*2,r=rnd(50,70);
        const spawnX=bld.cx+Math.cos(ang)*r, spawnY=bld.cy+Math.sin(ang)*r;
        let u:Unit;
        switch(item.type){
          case 'Grenadier':   u=new Grenadier(spawnX,spawnY,'player'); break;
          case 'Tank':        u=new Tank(spawnX,spawnY,'player'); break;
          case 'HeavyTank':   u=new HeavyTank(spawnX,spawnY,'player'); break;
          case 'Artillery':   u=new Artillery(spawnX,spawnY,'player'); break;
          case 'Scout':       u=new Scout(spawnX,spawnY,'player'); break;
          case 'AntitankGun': u=new AntitankGun(spawnX,spawnY,'player'); break;
          case 'Harvester':   u=new Harvester(spawnX,spawnY,this._ref); break;
          default:            u=new Unit(spawnX,spawnY,'player');
        }
        u._game=this._ref;
        if(u instanceof Harvester)u._speedMult=this._powerOk?1.0:0.6;
        if(bld.rallyPoint)u.moveTo(bld.rallyPoint.x,bld.rallyPoint.y);
        this.pUnits.push(u); this._ref.pUnits=this.pUnits;
        this._unitsProduced++;
        queue.shift();
        sound.unitReady();
        this.setStatus(`${item.type} ready!`,'success');
      }
    }
  }

  // ── SELECTION ─────────────────────────────────────────────
  _deselect(){ for(const e of this._selected)e.selected=false; this._selected=[]; }

  onLeftClick(pos:{x:number;y:number}){
    if(this._buildMode){this.placeBuild(pos.x,pos.y);return;}
    this._deselect();
    for(const u of this.pUnits){if(u.contains(pos.x,pos.y)){u.selected=true;this._selected=[u];sound.unitSelected();this._syncStores();return;}}
    for(const u of this.eUnits){if(u.contains(pos.x,pos.y)&&this._isFogVisible(u.x,u.y)){u.selected=true;this._selected=[u];this._syncStores();return;}}
    for(const b of this.buildings){if(b.contains(pos.x,pos.y)){b.selected=true;this._selected=[b];this._syncStores();return;}}
    this._syncStores();
  }

  onDragSelect(start:{x:number;y:number},end:{x:number;y:number}){
    if(this._buildMode)return;
    this._deselect();
    const rx=Math.min(start.x,end.x),ry=Math.min(start.y,end.y);
    const rw=Math.abs(end.x-start.x),rh=Math.abs(end.y-start.y);
    for(const u of this.pUnits){if(u.overlapsRect(rx,ry,rw,rh)){u.selected=true;this._selected.push(u);}}
    if(!this._selected.length){
      for(const b of this.buildings.filter(b=>b.team==='player')){if(b.overlapsRect(rx,ry,rw,rh)){b.selected=true;this._selected.push(b);}}
    }
    if(this._selected.length>0)sound.unitSelected();
    this._syncStores();
  }

  onRightClick(pos:{x:number;y:number}){
    if(this._buildMode){this.cancelBuild();return;}
    if(this._commandMode==='attack-move'){this.commandAttackMove(pos);return;}
    const selBld=this._selected.find(e=>e instanceof Building&&e.team==='player') as Building|undefined;
    if(selBld){selBld.rallyPoint={x:pos.x,y:pos.y};this.setStatus('Rally point set','success');this._syncStores();return;}
    const movers=this._selected.filter(e=>e instanceof Unit&&e.team==='player') as Unit[];
    if(!movers.length)return;
    let target:Entity|null=null;
    for(const e of[...this.eUnits,...this.buildings.filter(b=>b.team==='enemy')] as Entity[]){if(e.contains(pos.x,pos.y)){target=e;break;}}
    if(target){
      movers.forEach(u=>u.attack(target!));
      sound.attackOrder();
      this.setStatus('Attack order!','warn');
    } else {
      this._lineFormation(movers, pos);
      sound.moveOrder();
      this._moveInd={x:pos.x,y:pos.y,t:0.7};
    }
  }

  // ── COMMANDS ──────────────────────────────────────────────
  commandStop(){
    const units=this._selected.filter(e=>e instanceof Unit&&e.team==='player') as Unit[];
    units.forEach(u=>u.stop()); if(units.length)this.setStatus('Stop!');
  }
  commandGuard(){
    const units=this._selected.filter(e=>e instanceof Unit&&e.team==='player') as Unit[];
    units.forEach(u=>u.guard()); if(units.length)this.setStatus('Guard position set');
  }
  commandRetreat(){
    const units=this._selected.filter(e=>e instanceof Unit&&e.team==='player') as Unit[];
    if(!units.length)return;
    const base=this.buildings.find(b=>b.team==='player'&&b.type==='Construction Yard')??this.buildings.find(b=>b.team==='player');
    if(!base)return;
    units.forEach(u=>{u.retreating=true;u.autoAtk=false;u.atkTarget=null;u.moveTo(base.cx+rnd(-50,50),base.cy+rnd(-50,50));});
    this.setStatus(`Retreating ${units.length} units!`,'warn');
  }
  enterAttackMove(){
    const units=this._selected.filter(e=>e instanceof Unit&&e.team==='player');
    if(!units.length)return;
    this._commandMode='attack-move'; this.setStatus('ATTACK MOVE — right-click destination','warn'); this._syncStores();
  }
  commandAttackMove(pos:{x:number;y:number}){
    const movers=this._selected.filter(e=>e instanceof Unit&&e.team==='player') as Unit[];
    this._lineFormation(movers, pos);
    movers.forEach(u=>u.autoAtk=true);
    this._commandMode=null; this._moveInd={x:pos.x,y:pos.y,t:0.7};
    sound.attackOrder();
    this.setStatus('Attack move!','warn');
  }

  // Arrange units in a line perpendicular to the direction of movement.
  // Row 0 is the leading line; additional rows stagger behind for large groups.
  _lineFormation(movers: Unit[], dest: {x:number;y:number}){
    if(!movers.length) return;
    const cx=movers.reduce((s,u)=>s+u.x,0)/movers.length;
    const cy=movers.reduce((s,u)=>s+u.y,0)/movers.length;
    const dx=dest.x-cx, dy=dest.y-cy;
    const dist=Math.hypot(dx,dy);
    // If click is almost on top of the group, use a horizontal line as fallback
    const nx= dist>5 ? dx/dist : 1;
    const ny= dist>5 ? dy/dist : 0;
    // Perpendicular axis (left of forward)
    const px=-ny, py=nx;
    const ROW_SZ=6, SPACING=34;
    movers.forEach((u,i)=>{
      // ── Harvester: break out of auto-harvest AI on player command ──
      if(u instanceof Harvester){
        (u as Harvester).state='idle';
        (u as Harvester).targetField=null;
      }
      const row=Math.floor(i/ROW_SZ);
      const posInRow=i%ROW_SZ;
      const rowSize=Math.min(ROW_SZ, movers.length-row*ROW_SZ);
      const off=posInRow-(rowSize-1)/2;   // centered within row
      u.moveTo(
        clamp(dest.x + px*off*SPACING - nx*row*SPACING, 16, MAP_W-16),
        clamp(dest.y + py*off*SPACING - ny*row*SPACING, 16, MAP_H-16)
      );
    });
  }

  // ── WAVE SPAWNING ─────────────────────────────────────────
  _spawnWave(cfg:{infantry:number;tanks:number}){
    const sc=this._mapDef.waveScale, hsc=this._mapDef.enemyHpScale;
    const theme=this._mapDef.theme;
    const isSurvival = this._mapDef.mode === 'survival';

    const mkEnemy=(x:number,y:number,opts:{tank?:boolean;heavy?:boolean}={})=>{
      const e=new EnemyUnit(x,y,opts);
      if(hsc!==1) e.hp=e.maxHp=Math.round(e.hp*hsc);
      e._game=this._ref; e.mapTheme=theme;
      this.eUnits.push(e);
    };

    if (isSurvival) {
      // ── BEACH DEFENCE — amphibious assault from the ocean ──
      // Enemies wade in from the right edge in horizontal landing waves.
      // Spread vertically across the beach; tanks land at centre.
      const totalInf = Math.round(cfg.infantry * sc);
      const totalTnk = Math.round(cfg.tanks * sc);

      // Infantry: random spread up the beach
      for (let i = 0; i < totalInf; i++) {
        mkEnemy(MAP_W - rnd(20, 80), rnd(60, MAP_H - 60));
      }
      // Tanks: land near road centreline
      for (let i = 0; i < totalTnk; i++) {
        const heavy = this._gameTime > 300 && Math.random() < 0.30;
        mkEnemy(MAP_W - rnd(20, 70), rnd(MAP_H*0.3, MAP_H*0.7), {tank:true, heavy});
      }
      sound.waveAlert();
      return;
    }

    // ── STANDARD maps — use enemy War Factory ─────────────
    const wf=this.buildings.find(b=>b.type==='War Factory'&&b.team==='enemy');
    if(!wf)return;

    const totalInf=Math.round(cfg.infantry*sc);

    if(this._waveIndex===0 || totalInf<=2){
      for(let i=0;i<totalInf;i++) mkEnemy(wf.cx+rnd(-65,65),wf.cy+rnd(-65,65));
    } else {
      const nMain  = Math.round(totalInf*0.55);
      const nNorth = Math.round(totalInf*0.22);
      const nSouth = totalInf - nMain - nNorth;
      for(let i=0;i<nMain; i++) mkEnemy(wf.cx+rnd(-80,80),  wf.cy+rnd(-60,60));
      for(let i=0;i<nNorth;i++) mkEnemy(MAP_W-rnd(40,140),  rnd(60,240));
      for(let i=0;i<nSouth;i++) mkEnemy(MAP_W-rnd(40,140),  MAP_H-rnd(60,240));
    }
    for(let i=0;i<Math.round(cfg.tanks*sc);i++){
      const heavy=this._gameTime>250&&Math.random()<0.30;
      mkEnemy(wf.cx+rnd(-65,65),wf.cy+rnd(-65,65),{tank:true,heavy});
    }
    sound.waveAlert();
  }

  // ── UPDATE ────────────────────────────────────────────────
  update(dt:number){
    if(get(gameState)!=='playing'||this._paused)return;
    this._gameTime+=dt;

    if(this._camVelX!==0||this._camVelY!==0){this._camX+=this._camVelX*dt;this._camY+=this._camVelY*dt;this._clampCamera();}

    // Passive income
    this._credits+=10*dt;
    for(const n of this.captureNodes){if(n.team==='player'&&!n.isBlackMarket)this._credits+=n.income*dt;}

    // FX
    this._particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});
    this._particles=this._particles.filter(p=>p.life>0);
    this._flashMsgs.forEach(m=>m.t-=dt);
    this._flashMsgs=this._flashMsgs.filter(m=>m.t>0);
    if(this._moveInd){this._moveInd.t-=dt;if(this._moveInd.t<=0)this._moveInd=null;}

    // Projectiles + splash damage
    this.projectiles.forEach(p=>p.update(dt));
    for(const p of this.projectiles){
      if(p.dead&&p.splash>0){
        // Apply splash to all nearby enemies
        const targets=p.firedBy?.team==='player'?this.eUnits:this.pUnits;
        for(const t of targets){
          if(!t.isAlive())continue;
          const d=hypot(t.x,t.y,p.x,p.y);
          if(d<p.splash&&d>0){
            const dmg=p.dmg*(1-d/p.splash)*0.6;
            t.takeDmg(dmg);
          }
        }
        this._boom(p.x,p.y,p.firedBy?.team??'enemy');
      }
    }
    this.projectiles=this.projectiles.filter(p=>!p.dead);

    const allUnits=[...this.pUnits,...this.eUnits];

    // Auto-attack player units
    for(const u of this.pUnits){
      if(!u.retreating&&u.autoAtk&&!u.atkTarget&&!u.moveTarget&&!u.guardPos){
        let best:Unit|null=null,bestD=u.autoAtkRange;
        for(const e of this.eUnits){
          if(!e.isAlive())continue;
          const d=hypot(u.x,u.y,e.cx,e.cy);
          if(d<bestD){bestD=d;best=e;}
        }
        if(best)u.atkTarget=best;
      }
      if(u.guardPos&&!u.atkTarget){
        let best:Unit|null=null,bestD=u.guardRadius+u.autoAtkRange;
        for(const e of this.eUnits){if(!e.isAlive())continue;const d=hypot(u.x,u.y,e.cx,e.cy);if(d<bestD){bestD=d;best=e;}}
        if(best)u.atkTarget=best;
      }
      u.update(dt,allUnits,this.projectiles);
    }

    // Buildings
    const eTgts:Entity[]=[...this.eUnits,...this.buildings.filter(b=>b.team==='enemy')];
    const pTgts:Entity[]=[...this.pUnits,...this.buildings.filter(b=>b.team==='player')];
    for(const b of this.buildings){
      b.update(dt,b.team==='player'?eTgts:pTgts,this.projectiles);
      // Construction complete
      if((b as any)._justCompleted){
        (b as any)._justCompleted=false;
        sound.buildPlace();
        this._recalcPower();
        this._flashMsgs.push({text:`${b.type} READY`,x:b.cx,y:b.y-16,t:2,maxT:2,color:C.allyLight});
      }
    }
    for(const e of this.eUnits) e.update(dt,allUnits,this.projectiles);

    this._tickQueues(dt);

    // Capture nodes
    for(const n of this.captureNodes){
      n.update(dt,this.pUnits,this.eUnits as Unit[]);
      // Black market capture
      if(n.isBlackMarket&&!n.blackMarketClaimed&&n.team==='player'){
        n.blackMarketClaimed=true; this._blackMarketCaptured=true;
        sound.captureNode();
        this.setStatus('Black Market captured! 3 special abilities available!','success');
        this._flashMsgs.push({text:'BLACK MARKET!',x:n.cx,y:n.cy-60,t:3,maxT:3,color:C.blackMarket});
      }
      // ── Radar Tower — full-map vision while held ─────────────
      if(n.isRadar){
        const wasActive=this._radarActive;
        this._radarActive=(n.team==='player');
        if(!wasActive&&this._radarActive){
          sound.captureNode();
          this.setStatus('RADAR ONLINE — full map revealed!','success');
          this._flashMsgs.push({text:'RADAR ONLINE!',x:n.cx,y:n.cy-60,t:3,maxT:3,color:'#00FFCC'});
        } else if(wasActive&&!this._radarActive){
          this.setStatus('RADAR lost — fog of war restored','warn');
        }
      }
      // ── Beach Gun — spawns a long-range coastal cannon ───────
      if(n.isBeachGun&&!n.beachGunSpawned&&n.team==='player'){
        n.beachGunSpawned=true;
        const bg=new Turret(n.cx,n.cy,'player');
        bg.atkRange=340; bg.atkDmg=78; bg.atkRate=0.85;
        this.buildings.push(bg);
        this._ref.buildings=this.buildings;
        this._beachGunId=bg.id;
        this._recalcPower();
        sound.captureNode();
        this.setStatus('BEACH GUN online — coastal cannon active!','success');
        this._flashMsgs.push({text:'BEACH GUN!',x:n.cx,y:n.cy-60,t:3,maxT:3,color:C.enemyAccent});
      }
    }

    // Veteran pip sounds
    for(const u of this.pUnits){
      if(u.kills===2||u.kills===5){ /* Could play sound */ }
    }

    // Reap dead
    const prevKills=this._enemiesKilled, prevLost=this._unitsLost;
    this.pUnits=this._reap(this.pUnits); this._ref.pUnits=this.pUnits;
    this.eUnits=this._reap(this.eUnits);
    this.buildings=this._reap(this.buildings) as Building[];
    this._ref.buildings=this.buildings;   // keep enemy-unit game-ref in sync
    this._selected=this._selected.filter(e=>e.isAlive());
    this._recalcPower();
    this._updateFog();

    // Tiberium
    for(const f of this.tibFields){
      f.regen(dt);
      // Track depleted fields for respawn
      if(f.isEmpty()){
        if(!this._tibRespawnQueue.some(q=>hypot(q.cx,q.cy,f.cx,f.cy)<30)){
          this._tibRespawnQueue.push({cx:f.cx,cy:f.cy,timer:90});
        }
      }
    }
    this.tibFields=this.tibFields.filter(f=>!f.isEmpty()||this._tibRespawnQueue.some(q=>hypot(q.cx,q.cy,f.cx,f.cy)<30));

    // Tiberium respawn
    this._tibRespawnQueue=this._tibRespawnQueue.filter(q=>{
      q.timer-=dt;
      if(q.timer<=0){
        const nf=new TiberiumField(q.cx+rnd(-20,20),q.cy+rnd(-20,20));
        nf.capacity*=0.7; nf.remaining=nf.capacity;
        this.tibFields.push(nf); this._ref.tibFields=this.tibFields;
        this._flashMsgs.push({text:'TIBERIUM REGROWTH',x:q.cx,y:q.cy-40,t:2,maxT:2,color:C.tibGreen});
        return false;
      }
      return true;
    });

    // New tiberium spawn
    this._tibSpawnTimer-=dt;
    if(this._tibSpawnTimer<=0&&this._tibSpawnCount<6){
      this._trySpawnTibField(); this._tibSpawnTimer=rnd(50,80);
    }

    // Stats snapshot
    this._statsTimer+=dt;
    if(this._statsTimer>=5){
      this._statsTimer=0;
      this._statsSnaps.push({t:Math.floor(this._gameTime),kills:this._enemiesKilled,produced:this._unitsProduced,credits:Math.floor(this._credits)});
    }

    // ── Wave timer ────────────────────────────────────────────
    const isSurvival = this._mapDef.mode === 'survival';

    if (isSurvival) {
      // Survival mode: escalating waves from the ocean every ~60s
      this._survivalWaveTimer -= dt;
      if (this._survivalWaveTimer <= 0) {
        const waveNum = Math.floor(this._gameTime / 60);
        const infantry = Math.min(14, 3 + Math.floor(waveNum * 0.9));
        const tanks    = Math.max(0, Math.floor((waveNum - 3) * 0.65));
        this._spawnWave({ infantry, tanks });
        this._waveLabel++;
        // Interval shrinks as game progresses (from 60s → 35s min)
        this._survivalWaveTimer = Math.max(35, 65 - waveNum * 2);
        waveIncoming.set(true);
        this.setStatus(`WAVE ${this._waveLabel} — ASSAULT INCOMING!`, 'error');
        setTimeout(() => waveIncoming.set(false), 3000);
      }
    } else {
      this._spawnTimer -= dt;
      if(this._spawnTimer<=0){
        if(this._waveIndex<WAVES.length){
          const w=WAVES[this._waveIndex];
          this._spawnWave(w); this._waveLabel=this._waveIndex+1; this._waveIndex++;
          const nextW=WAVES[this._waveIndex];
          this._spawnTimer=nextW?nextW.at-w.at:ENDLESS_INTERVAL;
          waveIncoming.set(true);
          this.setStatus(`WAVE ${this._waveLabel} INCOMING!`,'error');
          setTimeout(()=>waveIncoming.set(false),3000);
        } else {
          const extra=Math.floor((this._gameTime-WAVES[WAVES.length-1].at)/65);
          this._spawnWave({infantry:Math.min(10,4+extra),tanks:Math.min(8,2+extra)});
          this._spawnTimer=Math.max(22,ENDLESS_INTERVAL-extra*3);
          this._waveLabel++;
          waveIncoming.set(true);
          this.setStatus(`ENDLESS ASSAULT ${this._waveLabel-WAVES.length}`,'error');
          setTimeout(()=>waveIncoming.set(false),3000);
        }
      }
    }

    // ── WIN / LOSE ────────────────────────────────────────────
    if (isSurvival) {
      const dur = this._mapDef.survivalDuration ?? 900;
      if (this._gameTime >= dur) { this._onWin(); return; }
      // Lose: Construction Yard destroyed
      const hq = this.buildings.find(b=>b.type==='Construction Yard'&&b.team==='player');
      if (!hq) { this._onLose(); return; }
    } else {
      const wf=this.buildings.find(b=>b.type==='War Factory'&&b.team==='enemy');
      if(!wf){this._onWin();return;}
      warFactoryHp.set(wf.hp);
      const centerNode=this.captureNodes.find(n=>n.isCenter);
      if(centerNode&&centerNode.holdTimer>=HOLD_WIN_TIME){this._onWin();return;}
      const pAlive=this.pUnits.length>0||this.buildings.some(b=>b.team==='player');
      if(!pAlive){this._onLose();return;}
    }

    this._syncStores();
  }

  _onWin(){
    statsHistory.set(this._statsSnaps);
    gameTimeElapsed.set(Math.floor(this._gameTime));
    sound.missionWon();
    gameState.set('won');
  }

  _onLose(){
    statsHistory.set(this._statsSnaps);
    gameTimeElapsed.set(Math.floor(this._gameTime));
    sound.missionLost();
    gameState.set('lost');
  }

  // ── TIBERIUM SPAWNING ─────────────────────────────────────
  _trySpawnTibField(){
    for(let attempt=0;attempt<40;attempt++){
      const x=rnd(80,MAP_W-80), y=rnd(80,MAP_H-80);
      const riverX=900+60*Math.sin(y*0.0045);
      if(this._mapDef.theme===0&&Math.abs(x-riverX)<90)continue;
      if(this.buildings.some(b=>hypot(x,y,b.cx,b.cy)<120))continue;
      if(this.tibFields.some(f=>hypot(x,y,f.cx,f.cy)<150))continue;
      const nf=new TiberiumField(x,y); this.tibFields.push(nf);
      this._ref.tibFields=this.tibFields; this._tibSpawnCount++;
      this._flashMsgs.push({text:'TIBERIUM!',x,y:y-48,t:2.5,maxT:2.5,color:C.tibGreen});
      this.setStatus('New Tiberium field detected!','success'); return;
    }
  }

  // ── BUILD VALIDITY ─────────────────────────────────────────
  _isValidBuildPos(cx:number,cy:number):boolean{
    if(!this._buildMode)return false;
    const d=BDEF[this._buildMode], bx=cx-d.w/2, by=cy-d.h/2, margin=6;
    if(bx<margin||by<margin||bx+d.w>MAP_W-margin||by+d.h>MAP_H-margin)return false;
    for(const b of this.buildings){
      if(bx<b.x+b.w+margin&&bx+d.w+margin>b.x&&by<b.y+b.h+margin&&by+d.h+margin>b.y)return false;
    }
    for(const b of this.buildings){if(b.team==='enemy'&&hypot(cx,cy,b.cx,b.cy)<130)return false;}
    if(this._mapDef.theme===0){
      const riverX=900+60*Math.sin(cy*0.0045);
      if(cx>riverX-64&&cx<riverX+64)return false;
    }
    if(this._mapDef.theme===2&&this.terrain.inCityBlock(cx,cy))return false;
    // ── Power-zone check: must be within range of a ready CY or Power Plant ──
    const inPowerZone=this.buildings.some(b=>{
      if(b.team!=='player'||!b.isReady)return false;
      const r=BDEF[b.type].buildRadius;
      return r>0 && hypot(cx,cy,b.cx,b.cy)<=r;
    });
    if(!inPowerZone)return false;
    return true;
  }

  private _reap<T extends Entity>(arr:T[]):T[]{
    return arr.filter(e=>{
      if(!e.isAlive()){
        this._boom(e.cx,e.cy,e.team);
        if(!(e instanceof Building)){
          if(e.team==='enemy')this._enemiesKilled++;
          else this._unitsLost++;
        }
        return false;
      }
      return true;
    });
  }

  _boom(cx:number,cy:number,team:string){
    const color=team==='player'?C.allyAccent:C.enemyAccent;
    for(let i=0;i<14;i++){const ang=Math.random()*Math.PI*2,spd=rnd(50,130);this._particles.push({x:cx,y:cy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,life:rnd(0.3,1.0),maxLife:1.0,color,r:rnd(2,7)});}
    this._flashMsgs.push({text:'',x:cx,y:cy,t:0.25,maxT:0.25,color});
  }

  // ── DRAW ─────────────────────────────────────────────────
  draw(t:number,dragRect:{x:number;y:number;w:number;h:number}|null,mouseScreenPos:{x:number;y:number}){
    const ctx=this.ctx, zoom=this._zoom, camX=this._camX, camY=this._camY;
    const dotMode=zoom<0.6;
    const mouseWorld=this.screenToWorld(mouseScreenPos.x,mouseScreenPos.y);

    ctx.setTransform(zoom,0,0,zoom,-camX*zoom,-camY*zoom);
    this.terrain.draw(ctx,t);

    ctx.fillStyle='rgba(0,12,6,0.12)'; ctx.fillRect(0,0,MAP_W,MAP_H);
    const scanY=((t*55)%(MAP_H+80))-40;
    const sg=ctx.createLinearGradient(0,scanY,0,scanY+70);
    sg.addColorStop(0,'rgba(0,255,80,0)'); sg.addColorStop(0.45,'rgba(0,255,80,0.05)'); sg.addColorStop(1,'rgba(0,255,80,0)');
    ctx.fillStyle=sg; ctx.fillRect(0,scanY,MAP_W,70);

    // Artillery strike target
    if(this._artilleryTarget){
      const{x,y,timer}=this._artilleryTarget;
      const pulse=0.5+0.5*Math.sin(t*10);
      ctx.beginPath(); ctx.arc(x,y,60+pulse*20,0,Math.PI*2);
      ctx.strokeStyle=`rgba(255,80,0,${0.6+pulse*0.4})`; ctx.lineWidth=3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-70,y); ctx.lineTo(x+70,y); ctx.moveTo(x,y-70); ctx.lineTo(x,y+70);
      ctx.strokeStyle=`rgba(255,150,0,${0.4+pulse*0.3})`; ctx.lineWidth=1.5; ctx.stroke();
    }

    for(const n of this.captureNodes) n.draw(ctx,t);
    for(const f of this.tibFields) f.draw(ctx,t);

    for(const u of this.pUnits){
      if(u instanceof Harvester&&u.moveTarget){
        ctx.beginPath(); ctx.moveTo(u.x,u.y); ctx.lineTo(u.moveTarget.x,u.moveTarget.y);
        ctx.strokeStyle='rgba(220,180,0,0.16)'; ctx.lineWidth=1/zoom; ctx.setLineDash([4,7]); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    for(const b of this.buildings) b.draw(ctx);

    // Queue progress bars above player buildings
    ctx.font=`bold ${7/zoom}px "Courier New"`;
    for(const[bldId,queue] of this._queues){
      if(!queue.length)continue;
      const bld=this.buildings.find(b=>b.id===bldId&&b.isAlive()&&b.team==='player');
      if(!bld)continue;
      const item=queue[0];
      const pct=Math.max(0,1-item.timer/item.maxTimer);
      const bw=bld.w-4,bx=bld.x+2,by=bld.y-22;
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(bx,by,bw,7);
      ctx.fillStyle='#00EE55';           ctx.fillRect(bx,by,bw*pct,7);
      ctx.strokeStyle='rgba(0,238,85,0.5)'; ctx.lineWidth=0.5/zoom; ctx.strokeRect(bx,by,bw,7);
      ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.textAlign='center';
      ctx.fillText(item.type,bld.cx,by-2); ctx.textAlign='left';
      if(queue.length>1){
        ctx.fillStyle='rgba(200,255,200,0.6)';
        ctx.fillText(`+${queue.length-1}`,bld.x+bld.w+3,by+5);
      }
    }

    for(const u of this.pUnits) (u as any).draw(ctx,dotMode);
    for(const u of this.eUnits){if(this._isFogVisible(u.x,u.y))(u as any).draw(ctx,dotMode);}
    for(const p of this.projectiles) p.draw(ctx);
    for(const p of this._particles){
      const a=clamp(p.life/p.maxLife,0,1);
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*a,0,Math.PI*2);
      ctx.fillStyle=p.color+Math.round(a*255).toString(16).padStart(2,'0'); ctx.fill();
    }

    // Fog
    const viewWorldW=VIEW_W/zoom, viewWorldH=VIEW_H/zoom;
    const cs=Math.floor(camX/FOG_CELL), ce=Math.ceil((camX+viewWorldW)/FOG_CELL)+1;
    const rs=Math.floor(camY/FOG_CELL), re=Math.ceil((camY+viewWorldH)/FOG_CELL)+1;
    for(let row=rs;row<=re;row++){
      for(let col=cs;col<=ce;col++){
        if(col<0||col>=FOG_COLS||row<0||row>=FOG_ROWS)continue;
        const state=this._fogGrid[row*FOG_COLS+col];
        if(state===2)continue;
        ctx.fillStyle=state===0?'rgba(0,6,3,0.94)':'rgba(0,6,3,0.62)';
        ctx.fillRect(col*FOG_CELL,row*FOG_CELL,FOG_CELL+0.5,FOG_CELL+0.5);
      }
    }

    ctx.font=`bold ${12/zoom}px "Courier New"`;
    for(const m of this._flashMsgs){
      if(!m.text)continue;
      const a=clamp(m.t/m.maxT,0,1);
      ctx.fillStyle=m.color+Math.round(a*255).toString(16).padStart(2,'0');
      ctx.textAlign='center'; ctx.fillText(m.text,m.x,m.y-(1-a)*28); ctx.textAlign='left';
    }

    if(this._moveInd){
      const{x,y,t:mt}=this._moveInd, a=clamp(mt/0.7,0,1), r=16*(0.5+a*0.5);
      ctx.strokeStyle=`rgba(0,255,100,${a})`; ctx.lineWidth=2/zoom;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-10,y); ctx.lineTo(x+10,y); ctx.moveTo(x,y-10); ctx.lineTo(x,y+10); ctx.stroke();
    }

    if(this._commandMode==='attack-move'){
      const{x,y}=mouseWorld; const cr=14;
      ctx.strokeStyle='rgba(255,50,50,0.85)'; ctx.lineWidth=1.5/zoom;
      ctx.beginPath(); ctx.arc(x,y,cr,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-cr-5,y); ctx.lineTo(x+cr+5,y); ctx.moveTo(x,y-cr-5); ctx.lineTo(x,y+cr+5); ctx.stroke();
    }

    if(dragRect){
      ctx.fillStyle='rgba(0,255,80,0.05)'; ctx.fillRect(dragRect.x,dragRect.y,dragRect.w,dragRect.h);
      ctx.strokeStyle=C.uiAccent; ctx.lineWidth=1/zoom; ctx.setLineDash([5,5]);
      ctx.strokeRect(dragRect.x,dragRect.y,dragRect.w,dragRect.h); ctx.setLineDash([]);
    }

    // Screen-space elements
    ctx.setTransform(1,0,0,1,0,0);
    const vig=ctx.createRadialGradient(VIEW_W*0.5,VIEW_H*0.5,VIEW_H*0.28,VIEW_W*0.5,VIEW_H*0.5,VIEW_H*0.82);
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,5,2,0.62)');
    ctx.fillStyle=vig; ctx.fillRect(0,0,VIEW_W,VIEW_H);

    const M=22; ctx.lineWidth=2; ctx.strokeStyle='rgba(0,238,85,0.9)'; ctx.shadowBlur=10; ctx.shadowColor='#00EE55';
    for(const[cx2,cy2,dx,dy] of[[0,0,1,1],[VIEW_W,0,-1,1],[VIEW_W,VIEW_H,-1,-1],[0,VIEW_H,1,-1]] as [number,number,number,number][]){
      ctx.beginPath(); ctx.moveTo(cx2+dx*M,cy2); ctx.lineTo(cx2,cy2); ctx.lineTo(cx2,cy2+dy*M); ctx.stroke();
    }
    ctx.shadowBlur=0;

    if(this._buildMode){
      ctx.setTransform(zoom,0,0,zoom,-camX*zoom,-camY*zoom);
      // ── Power zone rings ────────────────────────────────────
      for(const b of this.buildings){
        if(b.team!=='player'||!b.isReady)continue;
        const zr=BDEF[b.type].buildRadius;
        if(zr<=0)continue;
        ctx.beginPath(); ctx.arc(b.cx,b.cy,zr,0,Math.PI*2);
        ctx.strokeStyle='rgba(80,180,255,0.28)'; ctx.lineWidth=1.5/zoom; ctx.setLineDash([8,6]);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle='rgba(60,140,255,0.05)'; ctx.fill();
      }
      // ── Ghost building ──────────────────────────────────────
      const d=BDEF[this._buildMode], mx=mouseWorld.x-d.w/2, my=mouseWorld.y-d.h/2;
      const valid=this._isValidBuildPos(mouseWorld.x,mouseWorld.y);
      ctx.fillStyle=valid?'rgba(80,150,255,0.22)':'rgba(255,50,50,0.22)'; ctx.fillRect(mx,my,d.w,d.h);
      ctx.strokeStyle=valid?C.allyLight:C.error; ctx.lineWidth=1.5/zoom; ctx.setLineDash([5,5]);
      ctx.strokeRect(mx,my,d.w,d.h); ctx.setLineDash([]);
      ctx.fillStyle=valid?'#CCDDFF':'#FFAAAA'; ctx.font=`${9/zoom}px "Courier New"`; ctx.textAlign='center';
      ctx.fillText(valid?this._buildMode:'✗ BLOCKED',mouseWorld.x,mouseWorld.y+3); ctx.textAlign='left';
      ctx.setTransform(1,0,0,1,0,0);
    }
  }

  // ── MINIMAP ───────────────────────────────────────────────
  drawMinimap(mc:HTMLCanvasElement){
    const mctx=mc.getContext('2d')!;
    const mw=mc.width,mh=mc.height,sx=mw/MAP_W,sy=mh/MAP_H;
    mctx.drawImage(this.terrain['_off'],0,0,mw,mh);
    for(let row=0;row<FOG_ROWS;row++){for(let col=0;col<FOG_COLS;col++){
      const state=this._fogGrid[row*FOG_COLS+col]; if(state===2)continue;
      mctx.fillStyle=state===0?'rgba(0,4,2,0.9)':'rgba(0,4,2,0.55)';
      mctx.fillRect(col*FOG_CELL*sx,row*FOG_CELL*sy,FOG_CELL*sx+0.5,FOG_CELL*sy+0.5);
    }}
    for(const n of this.captureNodes){
      const col=n.isBlackMarket&&n.team==='player'?C.blackMarket:n.team==='player'?C.capturePlayer:n.team==='enemy'?C.captureEnemy:C.captureNeutral;
      mctx.beginPath(); mctx.arc(n.cx*sx,n.cy*sy,4,0,Math.PI*2); mctx.fillStyle=col; mctx.fill();
    }
    for(const f of this.tibFields){const p=f.pct();mctx.beginPath();mctx.arc(f.cx*sx,f.cy*sy,4*p,0,Math.PI*2);mctx.fillStyle=C.tibGreen;mctx.fill();}
    for(const b of this.buildings){mctx.fillStyle=b.team==='player'?C.allyAccent:(b.type==='War Factory'?'#FF0000':C.enemyAccent);mctx.fillRect(b.cx*sx-3,b.cy*sy-3,6,6);}
    for(const u of this.pUnits){mctx.beginPath();mctx.arc(u.x*sx,u.y*sy,2.5,0,Math.PI*2);mctx.fillStyle=C.allyLight;mctx.fill();}
    for(const u of this.eUnits){mctx.beginPath();mctx.arc(u.x*sx,u.y*sy,2.5,0,Math.PI*2);mctx.fillStyle=C.enemyLight;mctx.fill();}
    const vpX=this._camX*sx,vpY=this._camY*sy,vpW=(VIEW_W/this._zoom)*sx,vpH=(VIEW_H/this._zoom)*sy;
    mctx.strokeStyle='rgba(0,255,80,0.7)'; mctx.lineWidth=1.5; mctx.strokeRect(vpX,vpY,vpW,vpH);
    mctx.strokeStyle='rgba(0,255,80,0.3)'; mctx.lineWidth=1; mctx.strokeRect(0,0,mw,mh);
  }

  // ── STATUS ────────────────────────────────────────────────
  setStatus(text:string,type=''){
    statusMsg.set({text,type});
    if(this._stTimer)clearTimeout(this._stTimer);
    if(type==='success'||type==='error'||type==='warn'){
      this._stTimer=setTimeout(()=>statusMsg.set({text:'RUSH v1.0',type:''}),3000);
    }
  }

  // ── STORE SYNC ──────────────────────────────────────────
  _syncStores(){
    credits.set(Math.floor(this._credits));
    powerGen.set(this._powerGen); powerUsed.set(this._powerUsed);
    buildMode.set(this._buildMode); selected.set([...this._selected]);
    const harvs=this.pUnits.filter(u=>u instanceof Harvester).length;
    incomeRate.set(harvs*24+10+this.captureNodes.filter(n=>n.team==='player'&&!n.isBlackMarket).reduce((s,n)=>s+n.income,0));
    wave.set(this._waveLabel); totalWaves.set(WAVES.length);
    nextWaveIn.set(Math.ceil(Math.max(0,this._spawnTimer)));
    hasBarracks.set(this.buildings.some(b=>b.team==='player'&&b.type==='Barracks'));
    hasRefinery.set(this.buildings.some(b=>b.team==='player'&&b.type==='Refinery'));
    hasTechLab.set(this.buildings.some(b=>b.team==='player'&&b.type==='Tech Lab'));
    hasWarFactory.set(this.buildings.some(b=>b.team==='player'&&b.type==='War Factory'));
    selHasBarracks.set(this._selected.some(e=>e instanceof Building&&e.type==='Barracks'&&e.team==='player'));
    const selTurret=this._selected.find(e=>e instanceof Turret&&e.team==='player') as Turret|undefined;
    selHasTurret.set(!!selTurret); selTurretVariant.set(selTurret?.variant??'standard');
    selHasRefinery.set(this._selected.some(e=>e instanceof Building&&e.type==='Refinery'&&e.team==='player'));
    selHasWarFactory.set(this._selected.some(e=>e instanceof Building&&e.type==='War Factory'&&e.team==='player'));
    selHasUnits.set(this._selected.some(e=>e instanceof Unit&&e.team==='player'));
    selHasTechLab.set(this._selected.some(e=>e instanceof Building&&e.type==='Tech Lab'&&e.team==='player'));
    const wf=this.buildings.find(b=>b.type==='War Factory'&&b.team==='enemy');
    if(wf)warFactoryHp.set(wf.hp);
    enemiesKilled.set(this._enemiesKilled); unitsLost.set(this._unitsLost); unitsProduced.set(this._unitsProduced);
    const selBld=this._selected.find(e=>e instanceof Building&&e.team==='player') as Building|undefined;
    if(selBld){
      const q=this._queues.get(selBld.id)??[];
      selBuildingQueue.set({head:q[0]?{type:q[0].type,pct:1-q[0].timer/q[0].maxTimer}:null,rest:q.slice(1).map(qi=>qi.type)});
    } else { selBuildingQueue.set({head:null,rest:[]}); }
    captureNodesState.set(this.captureNodes.map(n=>({label:n.label,team:n.team,progress:n.progress,isCenter:n.isCenter,isBlackMarket:n.isBlackMarket,isRadar:n.isRadar,isBeachGun:n.isBeachGun,holdTimer:n.holdTimer})));
    const center=this.captureNodes.find(n=>n.isCenter);
    holdProgress.set(center?center.holdTimer:0);
    selected.set([...this._selected]);
    upgradesStore.set([...this._upgrades]);
    blackMarketCaptured.set(this._blackMarketCaptured);
    blackMarketAbilities.set([...this._blackMarketAbilities]);
    // Survival mode
    const isSurv = this._mapDef.mode === 'survival';
    survivalMode.set(isSurv);
    if (isSurv) {
      const dur = this._mapDef.survivalDuration ?? 900;
      survivalTotal.set(dur);
      survivalTimeLeft.set(Math.max(0, Math.ceil(dur - this._gameTime)));
    }
    pausedStore.set(this._paused);
  }

  // ── START / STOP ──────────────────────────────────────────
  start(){
    this._lastTime=performance.now();
    const loop=(ts:number)=>{
      const dt=Math.min((ts-this._lastTime)/1000,0.05);
      this._lastTime=ts; this.update(dt); this._raf=requestAnimationFrame(loop);
    };
    this._raf=requestAnimationFrame(loop);
  }

  stop(){ cancelAnimationFrame(this._raf); if(this._stTimer)clearTimeout(this._stTimer); }

  restart(){
    // Campaign progression: switch to next map on win, or stay on same map on lose
    const currentState=get(gameState);
    if(currentState==='won'){
      const nextIdx=(this._campaignMapIdx+1)%MAPS.length;
      this._campaignMapIdx=nextIdx;
      campaignMap.set(nextIdx);
      this._mapDef=MAPS[nextIdx];
      this.terrain=new TerrainMap(this._mapDef.theme);
      this._ref.terrain=this.terrain;
    }
    this._init();
    gameState.set('playing');
    this.setStatus(`${this._mapDef.name} — Mission started`,'success');
    this._syncStores();
  }

  // Skirmish restart (always map 0, or chosen map)
  restartMap(mapIdx:number){
    this._campaignMapIdx=mapIdx;
    this._mapDef=MAPS[mapIdx];
    campaignMap.set(mapIdx);
    this.terrain=new TerrainMap(this._mapDef.theme);
    this._ref.terrain=this.terrain;
    this._init();
    gameState.set('playing');
    this.setStatus(`${this._mapDef.name} — Mission started`,'success');
    this._syncStores();
  }
}
