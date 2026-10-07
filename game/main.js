/* BullCraft — main game: player, world streaming, actions, mobs, survival systems, save/load */
import * as THREE from 'three';
import { CHUNK, HEIGHT, WATER_LEVEL, SAVE_KEY, DAY_LENGTH, B, I, REG, SMELTING, SMELT_TIME, ADVANCEMENTS, MOB_TYPES, isSolid, isOpaque } from './constants.js';
import { World } from './world.js';
import { buildChunkMesh, makeChunkMaterial } from './mesher.js';
import { buildAtlas, buildDestroyTextures } from './textures.js';
import { buildBull, setModelLight, makeHeldItemMesh } from './models.js';
import { moveBody, inLiquid, collides } from './physics.js';
import { ItemEntity, Mob } from './entities.js';
import { Inventory, Gui, maxStack } from './inventory.js';
import { Hud } from './ui.js';

const GRAVITY = 32, JUMP_VEL = 8.95;
const WALK = 4.317, SPRINT = 5.612, SNEAK = 1.31, FLY = 10.9, SWIM = 2.2;
const PW = 0.7, PH = 1.5, EYE = 1.3;
const HARD_FLOOR = 0;

// ---------------- Sound ----------------
const Sound = {
  ctx: null, enabled: true,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  noise(len, freq, gain) { const c = this.ctx, t = c.currentTime; const buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = c.createGain(); g.gain.value = gain; src.connect(f); f.connect(g); g.connect(c.destination); src.start(t); },
  tone(f1, f2, len, gain, type = 'square') { const c = this.ctx, t = c.currentTime; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.linearRampToValueAtTime(f2, t + len); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + len); },
  play(type) {
    if (!this.enabled || !this.ctx) return;
    switch (type) {
      case 'break': this.noise(0.18, 900, 0.25); break; case 'place': this.noise(0.08, 1400, 0.25); break; case 'step': this.noise(0.05, 500, 0.08); break;
      case 'hit': this.noise(0.1, 700, 0.2); break; case 'dig': this.noise(0.05, 800, 0.08); break;
      case 'pickup': this.tone(660, 1100, 0.12, 0.08); break; case 'craft': this.tone(440, 660, 0.15, 0.08); break; case 'adv': this.tone(523, 1046, 0.5, 0.1, 'triangle'); this.tone(659, 1318, 0.5, 0.06, 'triangle'); break;
      case 'hurt': this.tone(300, 120, 0.25, 0.12, 'sawtooth'); break; case 'eat': this.noise(0.08, 400, 0.12); break; case 'death': this.tone(400, 60, 1.0, 0.15, 'sawtooth'); break;
      case 'levelup': this.tone(800, 1600, 0.3, 0.08, 'triangle'); break; case 'zombie': this.tone(140, 90, 0.5, 0.08, 'sawtooth'); break;
    }
  }
};

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas'); this.wrap = document.getElementById('gameWrap');
    const $ = id => document.getElementById(id);
    this.ui = { overlay: $('overlay'), overlayTitle: $('overlayTitle'), overlayText: $('overlayText'), btnPlay: $('btnPlay'), btnNew: $('btnNewWorld'), selRender: $('selRender'), chkSound: $('chkSound'), chkAutoJump: $('chkAutoJump'), btnMode: $('btnMode'), btnQuests: $('btnQuests'), btnPause: $('btnPause'), btnFull: $('btnFullscreen'), btnRespawn: $('btnRespawn'), crack: null };
    this.renderDistance = parseInt(this.ui.selRender.value, 10);
    this.autoJump = this.ui.chkAutoJump.checked;
    this.isTouch = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 1 && !matchMedia('(pointer: fine)').matches);
    if (this.isTouch) { document.body.classList.add('touch'); this.ui.btnPlay.textContent = 'Tap to Play'; }
    this.sound = Sound;
    this.keys = {}; this.mouse = { dx: 0, dy: 0, left: false, right: false }; this.locked = false; this.running = false; this.started = false;
    this.firstPerson = false; this.flying = false; this.mode = 'survival'; this.sprinting = false; this.sneaking = false;
    this.yaw = 0; this.pitch = -0.2; this.player = { pos: new THREE.Vector3(8, 40, 8), vel: new THREE.Vector3(), w: PW, h: PH, onGround: false, sneak: false };
    this.inv = new Inventory(36); this.slot = 0;
    this.health = 20; this.hunger = 20; this.saturation = 5; this.exhaustion = 0; this.air = 300; this.xp = 0; this.level = 0; this.dead = false;
    this.time = 0.3; this.stats = { obtained: {}, crafted: {}, placed: {}, placedTotal: 0, killed: {}, eaten: {}, smelted: {}, minY: 64, maxY: 0, nights: 0, maxLevel: 0 };
    this.advDone = new Set(); this.items = []; this.mobs = [];
    this.breaking = null; this.attackT = 0; this.useT = 0; this.eatT = 0; this.fallStart = null; this.lastSpaceT = 0; this.lastWT = 0; this.regenT = 0; this.starveT = 0; this.lavaT = 0; this.hurtT = 0; this.spawnT = 0; this.advT = 0; this.lastSave = 0; this.walkCycle = 0; this.stepT = 0; this.fov = 70; this.diedThisNight = false;
    this.meshes = new Map(); this.dirty = new Set();
    this.initThree(); this.hud = new Hud(this); this.gui = new Gui(this); this.bindUI();
    this.loadOrCreate(); this.hud.updateHotbar(); this.hud.updateStatus();
    requestAnimationFrame(t => this.loop(t));
  }
  // ---------------- three.js ----------------
  initThree() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x78a7ff);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 420);
    this.atlas = buildAtlas(); this.destroyTex = buildDestroyTextures();
    this.matSolid = makeChunkMaterial(this.atlas); this.matWater = makeChunkMaterial(this.atlas, { water: true });
    this.sun = new THREE.DirectionalLight(0xffffff, 1.0); this.scene.add(this.sun); this.ambient = new THREE.AmbientLight(0xffffff, 0.5); this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x6b4f2e, 0.35); this.scene.add(this.hemi);
    this.sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0xfff1a0, fog: false })); this.scene.add(this.sunMesh);
    this.moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false })); this.scene.add(this.moonMesh);
    const starPos = []; for (let i = 0; i < 600; i++) { const v = new THREE.Vector3().randomDirection(); if (v.y < 0.05) continue; starPos.push(v.x * 300, v.y * 300, v.z * 300); }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 })); this.scene.add(this.stars);
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 })); this.highlight.visible = false; this.scene.add(this.highlight);
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), new THREE.MeshBasicMaterial({ map: this.destroyTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })); this.crack.visible = false; this.scene.add(this.crack);
    this.bull = buildBull(); this.scene.add(this.bull.group);
    this.heldHolder = new THREE.Group(); this.heldHolder.position.set(0, -0.15, -0.42); this.bull.head.add(this.heldHolder);
    this.fpHolder = new THREE.Group(); this.fpHolder.position.set(0.42, -0.36, -0.7); this.fpHolder.rotation.set(0.1, -0.6, 0.1); this.camera.add(this.fpHolder); this.scene.add(this.camera);
    this.heldId = null;
    this.resize(); window.addEventListener('resize', () => this.resize()); new ResizeObserver(() => this.resize()).observe(this.wrap);
  }
  resize() { const w = this.wrap.clientWidth, h = this.wrap.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  // ---------------- input ----------------
  bindUI() {
    const u = this.ui;
    u.btnPlay.addEventListener('click', () => this.start());
    u.btnNew.addEventListener('click', () => { if (confirm('Start a new world? Your current world will be deleted from this browser.')) this.newWorld(); });
    u.selRender.addEventListener('change', () => { this.renderDistance = parseInt(u.selRender.value, 10); this.unloadFar(true); });
    u.chkSound.addEventListener('change', () => { Sound.enabled = u.chkSound.checked; });
    u.chkAutoJump.addEventListener('change', () => { this.autoJump = u.chkAutoJump.checked; });
    u.btnMode.addEventListener('click', () => this.toggleMode());
    u.btnQuests.addEventListener('click', () => this.toggleQuests());
    u.btnPause.addEventListener('click', () => { if (this.running) this.pause(); else this.resume(); });
    u.btnFull.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else this.wrap.requestFullscreen && this.wrap.requestFullscreen(); });
    u.btnRespawn.addEventListener('click', () => this.respawn());
    document.getElementById('btnCloseQuests').addEventListener('click', () => this.toggleQuests(false));
    window.addEventListener('keydown', e => this.onKeyDown(e));
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.left = this.mouse.right = false; });
    this.canvas.addEventListener('click', () => { if (this.started && !this.isTouch && !this.locked && !this.gui.open && !this.questsOpen && !this.dead) this.lock(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.locked) { this.running = true; this.ui.overlay.classList.add('hidden'); this.lockScroll(true); }
      else if (!this.isTouch && !this.gui.open && !this.questsOpen && !this.dead) this.pause();
    });
    document.addEventListener('wheel', e => { if (this.locked || this.gui.open || this.questsOpen) e.preventDefault(); }, { passive: false });
    document.addEventListener('keydown', e => { if (this.started && (this.locked || this.gui.open || this.questsOpen || (this.isTouch && this.running)) && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.code)) e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockerror', () => this.hud.toast('Click the game again to capture the mouse'));
    document.addEventListener('mousemove', e => { if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    this.canvas.addEventListener('mousedown', e => { if (!this.locked) return; if (e.button === 0) { this.mouse.left = true; this.attackClick(); } if (e.button === 2) { this.mouse.right = true; this.useT = 0; } if (e.button === 1) { e.preventDefault(); this.pickBlock(); } });
    document.addEventListener('mouseup', e => { if (e.button === 0) { this.mouse.left = false; this.breaking = null; } if (e.button === 2) { this.mouse.right = false; this.eatT = 0; } });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('wheel', e => { if (!this.locked) return; e.preventDefault(); this.slot = (this.slot + (e.deltaY > 0 ? 1 : 8)) % 9; this.hud.updateHotbar(); }, { passive: false });
    if (this.isTouch) this.bindTouch();
    window.addEventListener('beforeunload', () => { if (this.started) this.save(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.started) this.save(); });
  }
  onKeyDown(e) {
    if (!this.started) return; const k = e.code;
    if (this.gui.open) { if (k === 'KeyE' || k === 'Escape') { e.preventDefault(); this.closeGui(); } return; }
    if (this.questsOpen) { if (k === 'KeyL' || k === 'Escape') { e.preventDefault(); this.toggleQuests(false); } return; }
    if (!this.running || this.dead) return;
    if (k === 'KeyE') { e.preventDefault(); this.openGui('inventory'); return; }
    if (k === 'KeyL') { e.preventDefault(); this.toggleQuests(true); return; }
    if (k === 'F3') { e.preventDefault(); this.debugOn = !this.debugOn; this.hud.debug(''); }
    if (k === 'F5') { e.preventDefault(); this.firstPerson = !this.firstPerson; }
    if (k === 'KeyQ') { e.preventDefault(); this.dropSelected(e.ctrlKey); }
    if (k.startsWith('Digit')) { const n = parseInt(k.slice(5), 10); if (n >= 1 && n <= 9) { this.slot = n - 1; this.hud.updateHotbar(); } }
    if (k === 'Space') { e.preventDefault(); const now = performance.now(); if (this.mode === 'creative' && now - this.lastSpaceT < 300 && !this.keys.Space) { this.flying = !this.flying; this.player.vel.y = 0; this.hud.toast(this.flying ? 'Flying' : 'Flying off'); } this.lastSpaceT = now; }
    if (k === 'KeyW' && !this.keys.KeyW) { const now = performance.now(); if (now - this.lastWT < 300) this.wantSprint = true; this.lastWT = now; }
    if (k === 'ArrowUp' || k === 'ArrowDown') e.preventDefault();
    this.keys[k] = true;
  }
  bindTouch() {
    const joy = document.getElementById('joystick'), knob = document.getElementById('joyKnob');
    this.joy = { x: 0, y: 0, id: null };
    const setKnob = (dx, dy) => { knob.style.left = (35 + dx * 35) + 'px'; knob.style.top = (35 + dy * 35) + 'px'; };
    joy.addEventListener('touchstart', e => { e.preventDefault(); this.joy.id = e.changedTouches[0].identifier; }, { passive: false });
    joy.addEventListener('touchmove', e => { e.preventDefault(); const r = joy.getBoundingClientRect(); for (const t of e.changedTouches) if (t.identifier === this.joy.id) { let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } this.joy.x = dx; this.joy.y = dy; setKnob(dx, dy); } }, { passive: false });
    const endJoy = e => { for (const t of e.changedTouches) if (t.identifier === this.joy.id) { this.joy.id = null; this.joy.x = 0; this.joy.y = 0; setKnob(0, 0); } };
    joy.addEventListener('touchend', endJoy); joy.addEventListener('touchcancel', endJoy);
    let lookId = null, lx = 0, ly = 0;
    this.canvas.addEventListener('touchstart', e => { if (!this.running) { if (this.started && !this.dead) this.resume(); return; } const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY; }, { passive: true });
    this.canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === lookId) { this.mouse.dx += (t.clientX - lx) * 2.2; this.mouse.dy += (t.clientY - ly) * 2.2; lx = t.clientX; ly = t.clientY; } }, { passive: true });
    this.canvas.addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; });
    const hold = (id, on, off) => { const el = document.getElementById(id); el.addEventListener('touchstart', e => { e.preventDefault(); on(); }, { passive: false }); el.addEventListener('touchend', e => { e.preventDefault(); off && off(); }); el.addEventListener('touchcancel', () => off && off()); };
    hold('tJump', () => { this.keys.Space = true; if (this.mode === 'creative') { const now = performance.now(); if (now - this.lastSpaceT < 300) { this.flying = !this.flying; } this.lastSpaceT = now; } }, () => { this.keys.Space = false; });
    hold('tMine', () => { this.mouse.left = true; this.attackClick(); }, () => { this.mouse.left = false; this.breaking = null; });
    hold('tPlace', () => { this.mouse.right = true; this.useT = 0; }, () => { this.mouse.right = false; this.eatT = 0; });
    hold('tSneak', () => { this.keys.ShiftLeft = !this.keys.ShiftLeft; document.getElementById('tSneak').classList.toggle('on', this.keys.ShiftLeft); });
    hold('tSprint', () => { this.keys.ControlLeft = !this.keys.ControlLeft; document.getElementById('tSprint').classList.toggle('on', this.keys.ControlLeft); });
    document.getElementById('btnInventory').addEventListener('click', () => { if (this.gui.open) this.closeGui(); else this.openGui('inventory'); });
  }
  lock() { this.centerGame(); try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
  centerGame() { const r = this.wrap.getBoundingClientRect(); const target = window.scrollY + r.top - Math.max(0, (window.innerHeight - r.height) / 2); if (Math.abs(target - window.scrollY) > 2 && !document.fullscreenElement) window.scrollTo({ top: target, behavior: 'instant' }); }
  lockScroll(on) { document.body.classList.toggle('playing', !!on); }
  start() { Sound.init(); this.started = true; if (this.isTouch) { this.running = true; this.ui.overlay.classList.add('hidden'); this.centerGame(); this.lockScroll(true); } else this.lock(); }
  resume() { if (this.isTouch) { this.running = true; this.ui.overlay.classList.add('hidden'); this.centerGame(); this.lockScroll(true); } else this.lock(); }
  pause() {
    this.running = false; this.keys = {}; this.mouse.left = this.mouse.right = false; this.breaking = null; this.lockScroll(false); if (!this.started) return;
    this.ui.overlayTitle.textContent = 'Game Paused'; this.ui.overlayText.textContent = 'Your world is saved in this browser.';
    this.ui.btnPlay.textContent = this.isTouch ? 'Tap to Resume' : 'Back to Game'; this.ui.overlay.classList.remove('hidden'); this.save();
  }
  openGui(kind, ctx) { if (this.dead) return; this.keys = {}; this.mouse.left = this.mouse.right = false; this.breaking = null; this.gui.show(kind, ctx); if (this.locked) document.exitPointerLock(); }
  closeGui() { this.gui.close(); this.hud.updateHotbar(); if (!this.isTouch && this.started && !this.dead) this.lock(); else this.running = true; }
  toggleQuests(show) { this.questsOpen = show === undefined ? !this.questsOpen : show; this.hud.showQuests(this.questsOpen); if (this.questsOpen) { this.keys = {}; this.mouse.left = this.mouse.right = false; if (this.locked) document.exitPointerLock(); } else if (!this.isTouch && this.started && !this.dead) this.lock(); }
  toggleMode() {
    this.mode = this.mode === 'survival' ? 'creative' : 'survival'; this.ui.btnMode.textContent = 'Mode: ' + (this.mode === 'survival' ? 'Survival' : 'Creative');
    if (this.mode === 'survival') this.flying = false; this.hud.updateStatus(); this.hud.toast(this.mode === 'creative' ? 'Creative mode' : 'Survival mode');
  }
  // ---------------- world / save ----------------
  starterKit() { this.inv = new Inventory(36); [{ id: I.WOOD_PICK, count: 1, dur: 59 }, { id: I.WOOD_AXE, count: 1, dur: 59 }, { id: I.WOOD_SWORD, count: 1, dur: 59 }, { id: B.TORCH, count: 8 }, { id: I.APPLE, count: 3 }].forEach(s => this.inv.add(s)); }
  loadOrCreate() {
    let d = null; try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { d = null; }
    if (d && d.world) {
      this.world = new World(d.world.seed); this.world.load(d.world);
      const p = d.player; this.player.pos.set(p.x, p.y, p.z); this.yaw = p.yaw || 0; this.pitch = p.pitch || -0.2; this.spawnPos = d.spawn ? new THREE.Vector3(d.spawn.x, d.spawn.y, d.spawn.z) : this.player.pos.clone();
      this.inv.slots = d.inv || new Array(36).fill(null); this.slot = d.slot || 0;
      this.health = d.health ?? 20; this.hunger = d.hunger ?? 20; this.saturation = d.saturation ?? 5; this.xp = d.xp || 0; this.level = d.level || 0;
      this.time = d.time ?? 0.3; this.mode = d.mode || 'survival'; this.flying = !!d.flying; this.firstPerson = !!d.firstPerson;
      this.stats = Object.assign(this.stats, d.stats || {}); this.advDone = new Set(d.adv || []);
      this.pendingEntities = d.entities || null;
      this.ui.overlayText.textContent = 'Welcome back! Loading your world…';
    } else {
      this.world = new World((Math.random() * 2147483647) | 0); this.starterKit(); this.spawn(); this.spawnPos = this.player.pos.clone();
      this.ui.overlayText.textContent = 'Generating a fresh world…';
    }
    this.ui.btnMode.textContent = 'Mode: ' + (this.mode === 'survival' ? 'Survival' : 'Creative'); this.ui.btnPlay.disabled = true;
  }
  spawn() {
    const s = this.world.spawn; const h = this.world.height(s.x, s.z);
    this.player.pos.set(s.x + 0.5, h + 1.2, s.z + 0.5); this.player.vel.set(0, 0, 0);
  }
  save() {
    if (!this.world) return;
    const p = this.player.pos;
    const d = { v: 2, world: this.world.serialize(), player: { x: p.x, y: p.y, z: p.z, yaw: this.yaw, pitch: this.pitch }, spawn: { x: this.spawnPos.x, y: this.spawnPos.y, z: this.spawnPos.z },
      inv: this.inv.slots, slot: this.slot, health: this.health, hunger: this.hunger, saturation: this.saturation, xp: this.xp, level: this.level, time: this.time, mode: this.mode, flying: this.flying, firstPerson: this.firstPerson,
      stats: this.stats, adv: Array.from(this.advDone), entities: { items: this.items.filter(i => !i.dead).map(i => i.serialize()), mobs: this.mobs.filter(m => !m.dead).map(m => m.serialize()) }, saved: Date.now() };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { this.hud.toast('Save failed (storage full?)'); }
    this.lastSave = performance.now();
  }
  newWorld() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
    for (const m of this.meshes.values()) this.disposeMesh(m); this.meshes.clear(); this.dirty.clear();
    for (const i of this.items) this.scene.remove(i.mesh); for (const m of this.mobs) this.scene.remove(m.model.group); this.items = []; this.mobs = [];
    this.world = new World((Math.random() * 2147483647) | 0); this.starterKit(); this.slot = 0; this.player.vel.set(0, 0, 0); this.flying = false; this.time = 0.3; this.yaw = 0; this.pitch = -0.2;
    this.health = 20; this.hunger = 20; this.saturation = 5; this.xp = 0; this.level = 0; this.dead = false; this.hud.showDeath(false);
    this.stats = { obtained: {}, crafted: {}, placed: {}, placedTotal: 0, killed: {}, eaten: {}, smelted: {}, minY: 64, maxY: 0, nights: 0, maxLevel: 0 }; this.advDone = new Set();
    this.spawn(); this.spawnPos = this.player.pos.clone(); this.hud.updateHotbar(); this.hud.updateStatus(); this.hud.toast('New world created');
    this.ui.overlayTitle.textContent = 'BullCraft'; this.ui.overlayText.textContent = 'Generating a fresh world…'; this.ui.btnPlay.disabled = true; this.ui.btnPlay.textContent = this.isTouch ? 'Tap to Play' : 'Click to Play';
    this.started = false; this.running = false; this.ui.overlay.classList.remove('hidden'); if (this.locked) document.exitPointerLock();
  }
  restoreEntities() {
    const e = this.pendingEntities; this.pendingEntities = null; if (!e) return;
    for (const it of e.items || []) { const ie = new ItemEntity(this, it.stack, it.x, it.y, it.z, new THREE.Vector3()); ie.age = it.age || 0; this.items.push(ie); }
    for (const m of e.mobs || []) { if (!MOB_TYPES[m.type]) continue; const mob = new Mob(this, m.type, m.x, m.y, m.z); mob.hp = m.hp; this.mobs.push(mob); }
  }
  // ---------------- chunks ----------------
  disposeMesh(m) { if (m.solid) { this.scene.remove(m.solid); m.solid.geometry.dispose(); } if (m.water) { this.scene.remove(m.water); m.water.geometry.dispose(); } }
  updateChunks() {
    const p = this.player.pos; const pcx = Math.floor(p.x / CHUNK), pcz = Math.floor(p.z / CHUNK), R = this.renderDistance;
    const queue = [];
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
      const k = World.key(pcx + dx, pcz + dz);
      if (!this.meshes.has(k) || this.dirty.has(k)) queue.push({ cx: pcx + dx, cz: pcz + dz, d: dx * dx + dz * dz + (this.dirty.has(k) ? -100 : 0) });
    }
    queue.sort((a, b) => a.d - b.d);
    const t0 = performance.now(); const budget = this.started ? 9 : 40; let built = 0;
    for (const q of queue) { this.rebuildChunk(q.cx, q.cz); built++; if (performance.now() - t0 > budget) break; }
    if (built) this.unloadFar(false);
  }
  rebuildChunk(cx, cz) {
    const k = World.key(cx, cz); const old = this.meshes.get(k); if (old) this.disposeMesh(old);
    const geo = buildChunkMesh(this.world, cx, cz); const m = { solid: null, water: null };
    if (geo.solid) { m.solid = new THREE.Mesh(geo.solid, this.matSolid); this.scene.add(m.solid); }
    if (geo.water) { m.water = new THREE.Mesh(geo.water, this.matWater); this.scene.add(m.water); }
    this.meshes.set(k, m); this.dirty.delete(k);
    if (!this.world.spawnedChunks.has(k) && this.started) this.spawnAnimals(cx, cz);
  }
  unloadFar(force) {
    const p = this.player.pos; const pcx = Math.floor(p.x / CHUNK), pcz = Math.floor(p.z / CHUNK), R = this.renderDistance + (force ? 0 : 2);
    for (const [k, m] of this.meshes) { const [cx, cz] = k.split(',').map(Number); if (Math.abs(cx - pcx) > R || Math.abs(cz - pcz) > R) { this.disposeMesh(m); this.meshes.delete(k); } }
    if (this.world.chunks.size > 900) for (const k of this.world.chunks.keys()) if (!this.meshes.has(k) && !this.world.mods.has(k)) { this.world.chunks.delete(k); this.world.light.delete(k); }
  }
  nearbyReady() { const p = this.player.pos; const pcx = Math.floor(p.x / CHUNK), pcz = Math.floor(p.z / CHUNK); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!this.meshes.has(World.key(pcx + dx, pcz + dz))) return false; return true; }
  markDirty(list) { for (const [cx, cz] of list) this.dirty.add(World.key(cx, cz)); }
  setBlock(x, y, z, id) { this.markDirty(this.world.setBlock(x, y, z, id)); }
  // ---------------- lighting helpers ----------------
  dayAmount() { const elev = Math.sin(this.time * Math.PI * 2); return THREE.MathUtils.smoothstep(elev, -0.12, 0.25); }
  sunUp() { return Math.sin(this.time * Math.PI * 2) > -0.05; }
  dayLight() { return 0.12 + 0.88 * this.dayAmount(); }
  brightnessAt(x, y, z) { const l = this.world.getLight(Math.floor(x), Math.floor(y), Math.floor(z)); const v = Math.max((l >> 4) / 15 * this.dayLight(), (l & 15) / 15); return Math.max(0.12, 0.045 + 0.955 * Math.pow(v, 1.5)); }
  // ---------------- player ----------------
  heldStack() { return this.inv.slots[this.slot]; }
  updatePlayer(dt) {
    const P = this.player, keys = this.keys;
    const sens = 0.0022; this.yaw -= this.mouse.dx * sens; this.pitch -= this.mouse.dy * sens; this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch)); this.mouse.dx = this.mouse.dy = 0;
    let fw = 0, st = 0;
    if (keys.KeyW || keys.ArrowUp) fw += 1; if (keys.KeyS || keys.ArrowDown) fw -= 1; if (keys.KeyA || keys.ArrowLeft) st -= 1; if (keys.KeyD || keys.ArrowRight) st += 1;
    if (this.joy) { fw -= this.joy.y; st += this.joy.x; }
    const len = Math.hypot(fw, st); if (len > 1) { fw /= len; st /= len; }
    const inWater = inLiquid(this.world, P), inLava = inLiquid(this.world, P, B.LAVA);
    this.sneaking = !!(keys.ShiftLeft || keys.ShiftRight) && !this.flying; P.sneak = this.sneaking;
    const canSprint = this.mode === 'creative' || this.hunger > 6;
    if ((keys.ControlLeft || keys.ControlRight || this.wantSprint) && fw > 0.5 && !this.sneaking && canSprint) this.sprinting = true;
    if (fw <= 0.5 || this.sneaking || !canSprint) { this.sprinting = false; this.wantSprint = false; }
    let speed = this.flying ? (this.sprinting ? FLY * 2 : FLY) : inWater || inLava ? SWIM : this.sneaking ? SNEAK : this.sprinting ? SPRINT : WALK;
    if (this.eatT > 0 || (this.useT > 0 && this.breaking)) speed *= 0.8;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const mx = (-sin * fw + cos * st) * speed, mz = (-cos * fw - sin * st) * speed;
    const acc = this.flying ? 8 : P.onGround ? 22 : inWater ? 6 : 3;
    P.vel.x += (mx - P.vel.x) * Math.min(1, acc * dt); P.vel.z += (mz - P.vel.z) * Math.min(1, acc * dt);
    if (this.flying) { let vy = 0; if (keys.Space) vy += speed; if (keys.ShiftLeft || keys.ShiftRight) vy -= speed; P.vel.y += (vy - P.vel.y) * Math.min(1, 10 * dt); }
    else if (inWater || inLava) { P.vel.y -= GRAVITY * 0.12 * dt; P.vel.y *= Math.pow(0.3, dt); if (keys.Space) P.vel.y = Math.min(P.vel.y + 30 * dt, 3.5); if (this.fallStart !== null) this.fallStart = null; }
    else {
      P.vel.y -= GRAVITY * dt; if (P.vel.y < -78) P.vel.y = -78;
      if (keys.Space) this.jumpBuffer = 0.12; else this.jumpBuffer = Math.max(0, (this.jumpBuffer || 0) - dt);
      if ((keys.Space || this.jumpBuffer > 0 || this.autoJumpNow) && P.onGround) { P.vel.y = JUMP_VEL; P.onGround = false; this.jumpBuffer = 0; if (this.sprinting) { P.vel.x += -sin * 2; P.vel.z += -cos * 2; } this.addExhaustion(this.sprinting ? 0.2 : 0.05); }
      this.autoJumpNow = false;
    }
    const wasOnGround = P.onGround; const vyBefore = P.vel.y;
    if (!wasOnGround && this.fallStart === null && !this.flying) this.fallStart = P.pos.y;
    if (this.fallStart !== null && P.pos.y > this.fallStart) this.fallStart = P.pos.y;
    const res = moveBody(this.world, P, dt, { autoStep: this.autoJump && !this.sneaking && (fw !== 0 || st !== 0) });
    if (res.autoJump) this.autoJumpNow = true;
    if ((res.hitX || res.hitZ) && this.sprinting && !res.autoJump) { this.sprinting = false; this.wantSprint = false; }
    if (P.onGround && !wasOnGround) {
      if (this.fallStart !== null && this.mode === 'survival' && !inWater) { const dist = this.fallStart - P.pos.y; if (dist > 3) { this.damage(Math.floor(dist - 3), 'fall'); } }
      this.fallStart = null; Sound.play('step');
    }
    if (this.flying && P.onGround) this.flying = false;
    if (P.pos.y < -10) { this.damage(100, 'void'); }
    const hs = Math.hypot(P.vel.x, P.vel.z); this.walkCycle += hs * dt * 2.2; this.moving = hs > 0.4;
    if (this.moving && P.onGround) { this.stepT -= dt * hs; if (this.stepT <= 0) { this.stepT = 2.3; Sound.play('step'); } if (this.sprinting) this.addExhaustion(0.1 * hs * dt); }
    this.fov += ((this.sprinting ? 80 : 70) - this.fov) * Math.min(1, dt * 8); if (Math.abs(this.camera.fov - this.fov) > 0.1) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
    // stats
    const y = Math.floor(P.pos.y); if (y < this.stats.minY) this.stats.minY = y; if (y > this.stats.maxY) this.stats.maxY = y;
    // ---- survival ticks ----
    if (this.mode !== 'survival') { this.air = 300; return; }
    const head = this.world.getBlock(Math.floor(P.pos.x), Math.floor(P.pos.y + EYE), Math.floor(P.pos.z));
    if (head === B.WATER) { this.air -= dt * 20; if (this.air <= 0) { this.air = 0; this.drownT = (this.drownT || 0) + dt; if (this.drownT > 1) { this.drownT = 0; this.damage(2, 'drown'); } } } else this.air = Math.min(300, this.air + dt * 60);
    if (inLava || this.world.getBlock(Math.floor(P.pos.x), Math.floor(P.pos.y), Math.floor(P.pos.z)) === B.LAVA) { this.lavaT += dt; if (this.lavaT > 0.5) { this.lavaT = 0; this.damage(4, 'lava'); } }
    if (this.exhaustion >= 4) { this.exhaustion -= 4; if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1); else this.hunger = Math.max(0, this.hunger - 1); }
    if (this.hunger >= 18 && this.health < 20) { this.regenT += dt; const period = this.hunger >= 20 && this.saturation > 0 ? 1 : 4; if (this.regenT >= period) { this.regenT = 0; this.health = Math.min(20, this.health + 1); this.addExhaustion(6); } } else this.regenT = 0;
    if (this.hunger <= 0) { this.starveT += dt; if (this.starveT >= 4) { this.starveT = 0; if (this.health > 1) this.damage(1, 'starve'); } } else this.starveT = 0;
    if (this.hurtT > 0) this.hurtT -= dt;
  }
  addExhaustion(v) { if (this.mode === 'survival') this.exhaustion += v; }
  damage(amount, source, fromPos) {
    if (this.mode !== 'survival' || this.dead || amount <= 0) return;
    if (this.hurtT > 0 && source !== 'void') return;
    this.health -= amount; this.hurtT = 0.5; Sound.play('hurt'); this.wrap.classList.add('hurt'); setTimeout(() => this.wrap.classList.remove('hurt'), 250);
    if (fromPos) { const dx = this.player.pos.x - fromPos.x, dz = this.player.pos.z - fromPos.z, l = Math.hypot(dx, dz) || 1; this.player.vel.x += dx / l * 5; this.player.vel.z += dz / l * 5; this.player.vel.y = Math.max(this.player.vel.y, 4); }
    if (this.health <= 0) this.die(source);
    this.hud.updateStatus();
  }
  damagePlayer(amount, fromPos) { this.damage(amount, 'mob', fromPos); }
  die(source) {
    this.dead = true; this.health = 0; Sound.play('death'); this.diedThisNight = true;
    // drop inventory
    for (let i = 0; i < 36; i++) { const s = this.inv.slots[i]; if (s) { this.dropStack(s, this.player.pos.x, this.player.pos.y + 1, this.player.pos.z); this.inv.slots[i] = null; } }
    this.xp = 0; this.level = 0; this.hud.updateHotbar();
    const msgs = { fall: 'You fell from a high place', drown: 'You drowned', lava: 'You tried to swim in lava', starve: 'You starved to death', mob: 'You were slain by a Zombie', void: 'You fell out of the world' };
    this.hud.showDeath(true, msgs[source] || 'You died!'); this.breaking = null; this.keys = {}; this.mouse.left = this.mouse.right = false;
    if (this.locked) document.exitPointerLock(); this.save();
  }
  respawn() {
    this.dead = false; this.health = 20; this.hunger = 20; this.saturation = 5; this.exhaustion = 0; this.air = 300; this.fallStart = null;
    this.player.pos.copy(this.spawnPos); this.player.vel.set(0, 0, 0); this.hud.showDeath(false); this.hud.updateStatus();
    if (!this.isTouch) this.lock(); else this.running = true; this.save();
  }
  // ---------------- items & XP ----------------
  pickupItem(stack) { const left = this.inv.add(stack); const got = stack.count - left; if (got > 0) { this.stats.obtained[stack.id] = (this.stats.obtained[stack.id] || 0) + got; Sound.play('pickup'); this.hud.updateHotbar(); if (this.gui.open) this.gui.render(); } return left; }
  dropStack(stack, x, y, z, vel) { const e = new ItemEntity(this, Object.assign({}, stack), x, y, z, vel); this.items.push(e); return e; }
  giveOrDrop(stack) { const left = this.inv.add(stack); if (left > 0) this.throwStack(Object.assign({}, stack, { count: left })); this.hud.updateHotbar(); }
  throwStack(stack) { const d = this.lookDir(); const p = this.player.pos; const e = this.dropStack(stack, p.x + d.x * 0.5, p.y + EYE - 0.3, p.z + d.z * 0.5, new THREE.Vector3(d.x * 6, d.y * 6 + 1.5, d.z * 6)); e.pickupDelay = 1.5; }
  dropSelected(all) { const s = this.heldStack(); if (!s) return; const n = all ? s.count : 1; this.throwStack(Object.assign({}, s, { count: n })); s.count -= n; if (s.count <= 0) this.inv.slots[this.slot] = null; this.hud.updateHotbar(); }
  xpToNext(l) { return l < 16 ? 2 * l + 7 : l < 31 ? 5 * l - 38 : 9 * l - 158; }
  xpProgress() { return this.xp / this.xpToNext(this.level); }
  addXp(n) { if (n <= 0) return; this.xp += n; let up = false; while (this.xp >= this.xpToNext(this.level)) { this.xp -= this.xpToNext(this.level); this.level++; up = true; } if (up) { Sound.play('levelup'); if (this.level > this.stats.maxLevel) this.stats.maxLevel = this.level; } else Sound.play('pickup'); this.hud.updateStatus(); }
  onCrafted(stack) { this.stats.crafted[stack.id] = (this.stats.crafted[stack.id] || 0) + stack.count; if (REG[stack.id].dur) stack.dur = REG[stack.id].dur; Sound.play('craft'); }
  onSmeltTaken(f) { if (f && f.takenXp) { this.addXp(Math.round(f.takenXp)); f.takenXp = 0; } }
  // ---------------- targeting / actions ----------------
  lookDir() { return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
  eyePos() { return new THREE.Vector3(this.player.pos.x, this.player.pos.y + EYE - (this.sneaking ? 0.25 : 0), this.player.pos.z); }
  raycast(maxD = 4.5) {
    const eye = this.eyePos(), dir = this.lookDir();
    let x = Math.floor(eye.x), y = Math.floor(eye.y), z = Math.floor(eye.z);
    const stepX = Math.sign(dir.x) || 1, stepY = Math.sign(dir.y) || 1, stepZ = Math.sign(dir.z) || 1;
    const tdx = Math.abs(1 / (dir.x || 1e-9)), tdy = Math.abs(1 / (dir.y || 1e-9)), tdz = Math.abs(1 / (dir.z || 1e-9));
    let tmx = (stepX > 0 ? (x + 1 - eye.x) : (eye.x - x)) * tdx, tmy = (stepY > 0 ? (y + 1 - eye.y) : (eye.y - y)) * tdy, tmz = (stepZ > 0 ? (z + 1 - eye.z) : (eye.z - z)) * tdz;
    let face = [0, 0, 0], t = 0;
    for (let i = 0; i < 80; i++) {
      const id = this.world.getBlock(x, y, z);
      if (id !== B.AIR && !REG[id].liquid) return { x, y, z, id, face, dist: t };
      if (tmx < tmy && tmx < tmz) { if (tmx > maxD) break; t = tmx; x += stepX; tmx += tdx; face = [-stepX, 0, 0]; }
      else if (tmy < tmz) { if (tmy > maxD) break; t = tmy; y += stepY; tmy += tdy; face = [0, -stepY, 0]; }
      else { if (tmz > maxD) break; t = tmz; z += stepZ; tmz += tdz; face = [0, 0, -stepZ]; }
    }
    return null;
  }
  mobHit(maxD = 3.2) {
    const eye = this.eyePos(), dir = this.lookDir(); let best = null, bestD = maxD;
    for (const m of this.mobs) {
      if (m.dead) continue; const hw = m.w / 2 + 0.1;
      const min = [m.pos.x - hw, m.pos.y, m.pos.z - hw], max = [m.pos.x + hw, m.pos.y + m.h, m.pos.z + hw];
      let t0 = 0, t1 = bestD, ok = true;
      for (let a = 0; a < 3 && ok; a++) { const o = eye.getComponent(a), d = dir.getComponent(a); if (Math.abs(d) < 1e-9) { if (o < min[a] || o > max[a]) ok = false; } else { let ta = (min[a] - o) / d, tb = (max[a] - o) / d; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) ok = false; } }
      if (ok && t0 < bestD) { bestD = t0; best = m; }
    }
    return best ? { mob: best, dist: bestD } : null;
  }
  attackClick() {
    if (this.attackT > 0 || this.dead) return;
    const mh = this.mobHit(); const bh = this.raycast();
    if (mh && (!bh || mh.dist < bh.dist)) {
      this.attackT = 0.6; const s = this.heldStack(); let dmg = s && REG[s.id].dmg ? REG[s.id].dmg : 1;
      if (!this.player.onGround && this.player.vel.y < 0 && !inLiquid(this.world, this.player)) dmg *= 1.5;
      mh.mob.hurt(dmg, this.player.pos.x, this.player.pos.z); this.addExhaustion(0.1); Sound.play('hit');
      if (s && REG[s.id].dur) this.useDurability(s, REG[s.id].toolType === 'sword' ? 1 : 2);
      this.swing = 0.3;
    }
  }
  useDurability(s, n) { if (this.mode !== 'survival') return; if (s.dur === undefined) s.dur = REG[s.id].dur; s.dur -= n; if (s.dur <= 0) { this.inv.slots[this.slot] = null; Sound.play('break'); this.hud.toast(REG[s.id].name + ' broke!'); } this.hud.updateHotbar(); }
  breakTime(id) {
    const def = REG[id]; if (def.unbreakable) return Infinity; if (this.mode === 'creative') return 0.03;
    const s = this.heldStack(); const tool = s ? REG[s.id] : null;
    const matches = tool && tool.toolType === def.tool; const canHarvest = !def.tool || !def.tier || (matches && tool.tier >= def.tier);
    let speed = 1; if (matches) speed = tool.speed; else if (tool && tool.toolType === 'sword' && (id === B.LEAVES)) speed = 1.5;
    if (def.hard === 0) return 0.03;
    const t = canHarvest ? def.hard * 1.5 / speed : def.hard * 5;
    return Math.max(0.05, t * (this.player.onGround ? 1 : 5) * (inLiquid(this.world, this.player) ? 5 : 1));
  }
  canHarvest(id) { const def = REG[id]; if (!def.tool || !def.tier) return true; const s = this.heldStack(); const tool = s ? REG[s.id] : null; return !!(tool && tool.toolType === def.tool && tool.tier >= def.tier); }
  updateActions(dt) {
    this.attackT = Math.max(0, this.attackT - dt); this.useT -= dt; if (this.swing > 0) this.swing -= dt;
    const hit = this.raycast();
    if (hit) { this.highlight.visible = true; this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); this.hud.el.target.textContent = REG[hit.id].name; }
    else { this.highlight.visible = false; this.hud.el.target.textContent = ''; }
    // mining
    if (this.mouse.left && hit && !REG[hit.id].unbreakable && !this.mobHit()) {
      if (!this.breaking || this.breaking.x !== hit.x || this.breaking.y !== hit.y || this.breaking.z !== hit.z) this.breaking = { x: hit.x, y: hit.y, z: hit.z, progress: 0, need: this.breakTime(hit.id) };
      const b = this.breaking; b.progress += dt; this.swing = 0.2;
      this.crack.visible = true; this.crack.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); this.crack.material.map = this.destroyTex[Math.min(9, Math.floor(b.progress / b.need * 10))];
      this.digSoundT = (this.digSoundT || 0) - dt; if (this.digSoundT <= 0) { this.digSoundT = 0.25; Sound.play('dig'); }
      if (b.progress >= b.need) { this.breakBlock(hit.x, hit.y, hit.z, hit.id); this.breaking = null; this.crack.visible = false; }
    } else { this.breaking = null; this.crack.visible = false; }
    // use / place / eat
    const s = this.heldStack();
    if (this.mouse.right) {
      if (s && REG[s.id].food && this.mode === 'survival' && (this.hunger < 20 || REG[s.id].heal)) {
        this.eatT += dt; this.swing = 0.1; if (this.eatT > 0.3 && Math.floor(this.eatT * 6) !== Math.floor((this.eatT - dt) * 6)) Sound.play('eat');
        if (this.eatT >= 1.6) { this.eatT = 0; const f = REG[s.id]; this.hunger = Math.min(20, this.hunger + f.food); this.saturation = Math.min(this.hunger, this.saturation + f.sat); if (f.heal) this.health = Math.min(20, this.health + f.heal); this.stats.eaten[s.id] = (this.stats.eaten[s.id] || 0) + 1; s.count--; if (s.count <= 0) this.inv.slots[this.slot] = null; this.hud.updateHotbar(); this.hud.updateStatus(); Sound.play('pickup'); }
      } else if (this.useT <= 0 && hit) {
        this.useT = 0.25; const def = REG[hit.id];
        if (def.use && !this.sneaking) { this.interact(hit); }
        else if (s && REG[s.id].block) this.placeBlock(hit, s);
      }
    } else this.eatT = 0;
  }
  interact(hit) {
    const def = REG[hit.id]; this.mouse.right = false;
    if (def.use === 'crafting') this.openGui('crafting');
    else if (def.use === 'chest') { let t = this.world.getTile(hit.x, hit.y, hit.z); if (!t) { t = { type: 'chest', slots: new Array(27).fill(null) }; this.world.setTile(hit.x, hit.y, hit.z, t); } this.openGui('chest', { chest: t.slots, pos: [hit.x, hit.y, hit.z] }); }
    else if (def.use === 'furnace') { let t = this.world.getTile(hit.x, hit.y, hit.z); if (!t) { t = { type: 'furnace', in: null, fuel: null, out: null, fuelLeft: 0, fuelMax: 0, progress: 0, takenXp: 0 }; this.world.setTile(hit.x, hit.y, hit.z, t); } this.openGui('furnace', { furnace: t }); }
  }
  blockOverlaps(bx, by, bz, body) { const hw = body.w / 2; return bx + 1 > body.pos.x - hw && bx < body.pos.x + hw && by + 1 > body.pos.y && by < body.pos.y + body.h && bz + 1 > body.pos.z - hw && bz < body.pos.z + hw; }
  placeBlock(hit, s) {
    const id = s.id; const def = REG[id];
    const target = REG[hit.id].cross ? hit : { x: hit.x + hit.face[0], y: hit.y + hit.face[1], z: hit.z + hit.face[2] };
    if (target.y < 1 || target.y >= HEIGHT) return;
    const existing = this.world.getBlock(target.x, target.y, target.z);
    const replaceable = existing === B.AIR || REG[existing].liquid || REG[existing].cross;
    if (!replaceable) return;
    if (isSolid(id) && (this.blockOverlaps(target.x, target.y, target.z, this.player) || this.mobs.some(m => !m.dead && this.blockOverlaps(target.x, target.y, target.z, m)))) return;
    if (def.cross) {
      if (def.torch) { if (![[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].some(([dx, dy, dz]) => isOpaque(this.world.getBlock(target.x + dx, target.y + dy, target.z + dz)))) return; }
      else { const below = this.world.getBlock(target.x, target.y - 1, target.z); if (below !== B.GRASS && below !== B.DIRT) return; }
    }
    this.setBlock(target.x, target.y, target.z, id);
    if (id === B.CHEST) this.world.setTile(target.x, target.y, target.z, { type: 'chest', slots: new Array(27).fill(null) });
    if (id === B.FURNACE) this.world.setTile(target.x, target.y, target.z, { type: 'furnace', in: null, fuel: null, out: null, fuelLeft: 0, fuelMax: 0, progress: 0, takenXp: 0 });
    if (this.mode !== 'creative') { s.count--; if (s.count <= 0) this.inv.slots[this.slot] = null; }
    this.stats.placed[id] = (this.stats.placed[id] || 0) + 1; this.stats.placedTotal++;
    this.hud.updateHotbar(); Sound.play('place'); this.swing = 0.2;
  }
  breakBlock(x, y, z, id) {
    const def = REG[id];
    this.setBlock(x, y, z, B.AIR); Sound.play('break');
    const above = this.world.getBlock(x, y + 1, z); if (REG[above].cross && !REG[above].torch) this.breakBlock(x, y + 1, z, above);
    // block entity contents
    const tile = this.world.getTile(x, y, z);
    if (tile) { const drops = tile.type === 'chest' ? tile.slots : [tile.in, tile.fuel, tile.out]; for (const s of drops) if (s) this.dropStack(s, x + 0.5, y + 0.5, z + 0.5); this.world.setTile(x, y, z, null); if (this.gui.open && (this.gui.chest === tile.slots || this.gui.furnace === tile)) this.closeGui(); }
    if (this.mode === 'creative') return;
    const s = this.heldStack(); if (s && REG[s.id].dur) this.useDurability(s, REG[s.id].toolType === 'sword' ? 2 : 1);
    this.addExhaustion(0.005);
    if (!this.canHarvest(id)) return;
    let drop = def.drop !== undefined ? def.drop : id; if (def.dropFn) drop = def.dropFn(Math.random());
    if (drop) this.dropStack({ id: drop, count: 1 }, x + 0.5, y + 0.3, z + 0.5, new THREE.Vector3((Math.random() - 0.5) * 1.5, 2.5, (Math.random() - 0.5) * 1.5));
    if (def.xp) this.addXp(def.xp[0] + Math.floor(Math.random() * (def.xp[1] - def.xp[0] + 1)));
  }
  pickBlock() { if (this.mode !== 'creative') return; const hit = this.raycast(); if (!hit) return; const id = hit.id === B.FURNACE_LIT ? B.FURNACE : hit.id; const i = this.inv.slots.findIndex((s, idx) => idx < 9 && s && s.id === id); if (i >= 0) this.slot = i; else this.inv.slots[this.slot] = { id, count: 1 }; this.hud.updateHotbar(); }
  // ---------------- block entities (furnaces) ----------------
  tickFurnaces(dt) {
    for (const [k, t] of this.world.tiles) {
      if (t.type !== 'furnace') continue;
      const [x, y, z] = k.split(',').map(Number);
      const recipe = t.in ? SMELTING[t.in.id] : null;
      const canOut = recipe && (!t.out || (t.out.id === recipe.out && t.out.count < maxStack(recipe.out)));
      if (t.fuelLeft <= 0 && recipe && canOut && t.fuel && REG[t.fuel.id].fuel) { t.fuelMax = t.fuelLeft = REG[t.fuel.id].fuel; t.fuel.count--; if (t.fuel.count <= 0) t.fuel = null; }
      const lit = t.fuelLeft > 0;
      if (lit) {
        t.fuelLeft -= dt;
        if (recipe && canOut) { t.progress += dt; if (t.progress >= SMELT_TIME) { t.progress = 0; if (t.out) t.out.count++; else t.out = { id: recipe.out, count: 1 }; t.in.count--; if (t.in.count <= 0) t.in = null; t.takenXp = (t.takenXp || 0) + recipe.xp; this.stats.smelted[recipe.out] = (this.stats.smelted[recipe.out] || 0) + 1; } }
        else t.progress = Math.max(0, t.progress - dt * 2);
      } else t.progress = Math.max(0, t.progress - dt * 2);
      const cur = this.world.getBlock(x, y, z); const want = lit ? B.FURNACE_LIT : B.FURNACE;
      if ((cur === B.FURNACE || cur === B.FURNACE_LIT) && cur !== want) this.setBlock(x, y, z, want);
      if (this.gui.open && this.gui.furnace === t && (lit || t.progress > 0)) { this.furnaceUiT = (this.furnaceUiT || 0) + dt; if (this.furnaceUiT > 0.5) { this.furnaceUiT = 0; this.gui.render(); } }
    }
  }
  // ---------------- mobs ----------------
  spawnAnimals(cx, cz) {
    this.world.spawnedChunks.add(World.key(cx, cz));
    if (this.mobs.filter(m => !m.def.hostile && !m.dead).length > 24) return;
    const n = Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 3) : 0; const type = Math.random() < 0.5 ? 'cow' : 'pig';
    for (let i = 0; i < n; i++) { const x = cx * CHUNK + Math.floor(Math.random() * 16), z = cz * CHUNK + Math.floor(Math.random() * 16); const h = this.world.height(x, z); if (this.world.getBlock(x, h, z) !== B.GRASS) continue; this.mobs.push(new Mob(this, type, x + 0.5, h + 1, z + 0.5)); }
  }
  spawnMonsters() {
    if (this.mode !== 'survival') return;
    const hostile = this.mobs.filter(m => m.def.hostile && !m.dead).length; if (hostile >= 8) return;
    const p = this.player.pos; const dayL = this.dayLight();
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 20; const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK); if (!this.meshes.has(World.key(cx, cz))) continue;
      // find a ground block with 2 air above, scanning from a random height
      let y = Math.floor(Math.random() * 50) + 4; let found = -1;
      for (let i = 0; i < 20; i++, y--) { if (y < 2) break; if (isSolid(this.world.getBlock(x, y - 1, z)) && this.world.getBlock(x, y, z) === B.AIR && this.world.getBlock(x, y + 1, z) === B.AIR) { found = y; break; } }
      if (found < 0) continue;
      const l = this.world.getLight(x, found, z); const light = Math.max((l >> 4) * dayL, l & 15);
      if (light > 7) continue;
      this.mobs.push(new Mob(this, 'zombie', x + 0.5, found, z + 0.5)); if (Math.random() < 0.5) Sound.play('zombie'); return;
    }
  }
  updateEntities(dt) {
    for (const it of this.items) it.update(dt); this.items = this.items.filter(i => !i.dead);
    for (const m of this.mobs) m.update(dt); this.mobs = this.mobs.filter(m => !m.dead);
    this.spawnT -= dt; if (this.spawnT <= 0) { this.spawnT = 3; this.spawnMonsters(); }
  }
  // ---------------- camera / model ----------------
  updateCamera() {
    const eye = this.eyePos(), dir = this.lookDir(); const g = this.bull.group; g.position.copy(this.player.pos);
    if (this.firstPerson) { this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(dir)); g.visible = false; }
    else {
      g.visible = !this.dead; let dist = 4.5;
      for (let d = 0.3; d <= 4.5; d += 0.1) { const p = eye.clone().addScaledVector(dir, -d); if (isSolid(this.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)))) { dist = Math.max(0.3, d - 0.3); break; } }
      if (this.camDist === undefined) this.camDist = dist; this.camDist += (dist - this.camDist) * (dist < this.camDist ? 1 : 0.15);
      this.camera.position.copy(eye).addScaledVector(dir, -this.camDist); this.camera.lookAt(eye.clone().add(dir.clone().multiplyScalar(2)));
    }
    let targetYaw = this.moving ? Math.atan2(-this.player.vel.x, -this.player.vel.z) : this.yaw;
    if (this.keys.KeyS && !this.keys.KeyW) targetYaw = this.yaw;
    let d = targetYaw - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * 0.25;
    const sw = this.moving ? Math.sin(this.walkCycle) * (this.sprinting ? 0.9 : 0.6) : 0;
    this.bull.legs[0].rotation.x = sw; this.bull.legs[3].rotation.x = sw; this.bull.legs[1].rotation.x = -sw; this.bull.legs[2].rotation.x = -sw;
    this.bull.head.rotation.x = Math.max(-0.5, Math.min(0.5, -this.pitch * 0.5)) + (this.swing > 0 ? Math.sin(this.swing * 20) * 0.25 : 0);
    let hd = this.yaw - g.rotation.y; hd = Math.atan2(Math.sin(hd), Math.cos(hd)); this.bull.head.rotation.y = Math.max(-0.9, Math.min(0.9, hd));
    g.position.y += this.moving && this.player.onGround ? Math.abs(Math.sin(this.walkCycle)) * 0.05 : 0; if (this.sneaking) g.position.y -= 0.15;
    const b = this.brightnessAt(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z); setModelLight(g, b, this.hurtT > 0.25 ? 0.5 : 0);
    // held item
    const s = this.heldStack(); const hid = s ? s.id : null;
    if (hid !== this.heldId) { this.heldId = hid; this.heldHolder.clear(); this.fpHolder.clear(); if (hid) { const m1 = makeHeldItemMesh(hid, this.atlas); m1.scale.multiplyScalar(0.6); this.heldHolder.add(m1); const m2 = makeHeldItemMesh(hid, this.atlas); this.fpHolder.add(m2); } }
    if (this.fpHolder.children.length) { setModelLight(this.fpHolder, b); this.fpHolder.position.y = -0.36 + (this.swing > 0 ? -Math.sin(this.swing * 10) * 0.15 : 0) + (this.moving && this.player.onGround ? Math.sin(this.walkCycle) * 0.02 : 0); this.fpHolder.visible = this.firstPerson && !this.dead; }
    if (this.heldHolder.children.length) setModelLight(this.heldHolder, b);
  }
  updateSky() {
    const ang = this.time * Math.PI * 2, elev = Math.sin(ang); const dayAmt = this.dayAmount(); const dusk = 1 - Math.min(1, Math.abs(elev) / 0.25);
    const night = new THREE.Color(0x070b1c), day = new THREE.Color(0x78a7ff), sunset = new THREE.Color(0xff9a5a);
    const sky = night.clone().lerp(day, dayAmt).lerp(sunset, dusk * 0.45 * (elev > -0.2 ? 1 : 0));
    // underwater tint
    const headBlock = this.world.getBlock(Math.floor(this.camera.position.x), Math.floor(this.camera.position.y), Math.floor(this.camera.position.z));
    const under = headBlock === B.WATER; if (under) sky.set(0x1a3f8a);
    this.scene.background.copy(sky);
    const R = this.renderDistance * CHUNK; const fogNear = under ? 2 : R * 0.6, fogFar = under ? 18 : R * 0.98;
    for (const m of [this.matSolid, this.matWater]) { m.uniforms.fogColor.value.copy(sky); m.uniforms.fogNear.value = fogNear; m.uniforms.fogFar.value = fogFar; m.uniforms.dayLight.value = this.dayLight(); }
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.35).normalize(); const p = this.player.pos;
    this.sun.position.copy(sunDir).multiplyScalar(100).add(p); this.sun.target.position.copy(p); this.sun.target.updateMatrixWorld();
    this.sun.intensity = 0.15 + dayAmt * 1.0; this.ambient.intensity = 0.25 + dayAmt * 0.45; this.hemi.intensity = 0.1 + dayAmt * 0.35;
    this.sunMesh.position.copy(p).addScaledVector(sunDir, 250); this.sunMesh.lookAt(p); this.moonMesh.position.copy(p).addScaledVector(sunDir, -250); this.moonMesh.lookAt(p);
    this.stars.position.copy(p); this.stars.material.opacity = 1 - dayAmt;
    const hour = Math.floor(((this.time + 0.25) % 1) * 24), min = Math.floor((((this.time + 0.25) % 1) * 24 % 1) * 60);
    this.hud.el.time.textContent = (elev > 0 ? '☀ ' : '☾ ') + 'Day ' + (this.stats.nights + 1) + ' · ' + String(hour).padStart(2, '0') + ':' + String(min).padStart(2, '0');
  }
  // ---------------- advancements ----------------
  checkAdvancements() {
    for (const a of ADVANCEMENTS) { if (this.advDone.has(a.id)) continue; let ok = false; try { ok = !!a.check(this.stats); } catch (e) { } if (ok) { this.advDone.add(a.id); this.hud.advancement(a); Sound.play('adv'); this.addXp(5); if (this.questsOpen) this.hud.renderQuests(); } }
  }
  // ---------------- main loop ----------------
  loop(t) {
    requestAnimationFrame(tt => this.loop(tt));
    const dt = Math.min(0.05, (t - (this.frameTime || t)) / 1000); this.frameTime = t;
    this.updateChunks();
    if (!this.started && this.nearbyReady()) { this.ui.btnPlay.disabled = false; this.ui.overlayText.textContent = 'World ready. You are the bull. Mine, craft, survive!'; if (this.pendingEntities) this.restoreEntities(); }
    const active = this.running && !this.gui.open && !this.questsOpen;
    if (this.started && (this.running || this.gui.open) ) {
      const prevTime = this.time; this.time = (this.time + dt / DAY_LENGTH) % 1;
      if (prevTime > this.time) { if (!this.diedThisNight) this.stats.nights++; this.diedThisNight = false; }
      this.tickFurnaces(dt);
      if (!this.dead) { if (active) { this.updatePlayer(dt); this.updateActions(dt); } else { this.player.vel.x *= 0.8; this.player.vel.z *= 0.8; if (!this.flying) this.player.vel.y -= GRAVITY * dt; moveBody(this.world, this.player, dt); } }
      this.updateEntities(dt);
      this.advT += dt; if (this.advT > 1) { this.advT = 0; this.checkAdvancements(); this.hud.updateStatus(); }
      if (performance.now() - this.lastSave > 20000) this.save();
      const p = this.player.pos; this.hud.el.coords.textContent = 'XYZ: ' + Math.floor(p.x) + ' ' + Math.floor(p.y) + ' ' + Math.floor(p.z) + (this.flying ? ' ✈' : '') + (this.sneaking ? ' (sneaking)' : '');
      if (this.debugOn) { const l = this.world.getLight(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)); this.hud.debug('BullCraft F3\nXYZ ' + p.x.toFixed(2) + ' / ' + p.y.toFixed(2) + ' / ' + p.z.toFixed(2) + '\nChunk ' + Math.floor(p.x / 16) + ' ' + Math.floor(p.z / 16) + '\nLight sky ' + (l >> 4) + ' block ' + (l & 15) + '\nMeshes ' + this.meshes.size + ' · Mobs ' + this.mobs.length + ' · Items ' + this.items.length + '\nFPS ' + Math.round(1 / Math.max(dt, 0.001)) + '\nHunger ' + this.hunger + ' sat ' + this.saturation.toFixed(1) + ' exh ' + this.exhaustion.toFixed(2)); }
    }
    this.updateCamera(); this.updateSky();
    this.renderer.render(this.scene, this.camera);
  }
}

function boot() { try { window.bullcraft = new Game(); } catch (e) { console.error(e); const t = document.getElementById('overlayText'); if (t) t.textContent = 'Could not start the game: ' + e.message; } }
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot); else boot();
