/* World: chunk storage, terrain generation, modifications, lighting */
import { CHUNK, HEIGHT, WATER_LEVEL, B, REG, blocksLight } from './constants.js';
import { makeNoise, hash2, hash3 } from './noise.js';

const PAD = 8, RX = CHUNK + PAD * 2, RZ = RX, RY = HEIGHT;
const N = CHUNK * CHUNK * HEIGHT;

export class World {
  constructor(seed) {
    this.seed = seed;
    const a = makeNoise(seed), b = makeNoise(seed + 1337), c = makeNoise(seed + 777);
    this.n = a.n2; this.n2 = b.n2; this.n3 = c.n3; this.n3b = a.n3;
    this.chunks = new Map(); this.mods = new Map(); this.light = new Map(); this.heightCache = new Map();
    this.tiles = new Map();        // "x,y,z" -> block entity data (chest/furnace)
    this.spawnedChunks = new Set();
  }
  static key(cx, cz) { return cx + ',' + cz; }
  static idx(x, y, z) { return y + HEIGHT * (z + CHUNK * x); }

  height(x, z) {
    const k = x + ',' + z; let h = this.heightCache.get(k); if (h !== undefined) return h;
    const n = this.n, n2 = this.n2;
    let v = 23 + n(x / 90, z / 90) * 12 + n2(x / 28, z / 28) * 5 + n(x / 9 + 50, z / 9) * 1.5;
    const hills = n2(x / 170 + 100, z / 170);
    if (hills > 0.15) v += (hills - 0.15) * (hills - 0.15) * 90;
    h = Math.max(4, Math.min(HEIGHT - 5, Math.floor(v)));
    if (this.heightCache.size > 80000) this.heightCache.clear();
    this.heightCache.set(k, h); return h;
  }
  treeAt(x, z) {
    const h = this.height(x, z); if (h <= WATER_LEVEL + 1 || h >= 50) return 0;
    const forest = this.n2(x / 60 + 300, z / 60 + 300);
    const chance = forest > 0.1 ? 0.03 : 0.006;
    if (hash2(x, z, this.seed) > chance) return 0;
    return 4 + Math.floor(hash2(x, z, this.seed + 7) * 3);
  }
  isCave(x, y, z, h) {
    if (y >= h - 2 || y < 3) return false;
    const a = this.n3(x / 38, y / 22, z / 38), b = this.n3b(x / 30 + 90, y / 18, z / 30 + 90);
    if (a > 0.58) return true;
    return Math.abs(a) < 0.07 && Math.abs(b) < 0.09; // worm caves
  }
  generate(cx, cz) {
    const data = new Uint8Array(N);
    const ox = cx * CHUNK, oz = cz * CHUNK, seed = this.seed;
    for (let lx = 0; lx < CHUNK; lx++) for (let lz = 0; lz < CHUNK; lz++) {
      const x = ox + lx, z = oz + lz; const h = this.height(x, z);
      const base = (lz + CHUNK * lx) * HEIGHT;
      const beach = h <= WATER_LEVEL + 1; const snowy = h >= 50;
      for (let y = 0; y <= h; y++) {
        let id;
        if (y === 0 || (y < 4 && hash3(x, y, z, seed + 5) < 0.5 - y * 0.12)) id = B.BEDROCK;
        else if (this.isCave(x, y, z, h)) { id = y <= 9 ? B.LAVA : B.AIR; }
        else if (y < h - 3) {
          id = B.STONE; const r = hash3(x, y, z, seed);
          if (y < 52 && r < 0.012) id = B.COAL_ORE;
          else if (y < 40 && r > 0.5 && r < 0.508) id = B.IRON_ORE;
          else if (y < 26 && r > 0.6 && r < 0.6035) id = B.GOLD_ORE;
          else if (y < 15 && r > 0.7 && r < 0.7018) id = B.DIAMOND_ORE;
          else if (hash3(x, y, z, seed + 3) < 0.02) id = B.GRAVEL;
          else if (y > 30 && hash3(x >> 2, y >> 2, z >> 2, seed + 9) < 0.08) id = B.DIRT;
        }
        else if (y < h) id = beach ? B.SAND : B.DIRT;
        else id = beach ? B.SAND : snowy ? B.SNOW : B.GRASS;
        data[base + y] = id;
      }
      for (let y = h + 1; y <= WATER_LEVEL; y++) data[base + y] = B.WATER;
      if (!beach && !snowy && h + 1 < HEIGHT && data[base + h] === B.GRASS) {
        const r = hash2(x, z, seed + 11);
        if (r < 0.08) data[base + h + 1] = B.TALLGRASS;
        else if (r < 0.095) data[base + h + 1] = B.POPPY;
        else if (r < 0.11) data[base + h + 1] = B.DANDELION;
      }
    }
    for (let x = ox - 2; x < ox + CHUNK + 2; x++) for (let z = oz - 2; z < oz + CHUNK + 2; z++) {
      const th = this.treeAt(x, z); if (!th) continue;
      const h = this.height(x, z); const top = h + th;
      const set = (wx, wy, wz, id, force) => {
        const lx = wx - ox, lz = wz - oz; if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || wy <= 0 || wy >= HEIGHT) return;
        const i = (lz + CHUNK * lx) * HEIGHT + wy; if (force || data[i] === B.AIR || REG[data[i]].cross) data[i] = id;
      };
      for (let y = h + 1; y <= top; y++) set(x, y, z, B.LOG, true);
      for (let dy = -2; dy <= 1; dy++) {
        const rad = dy <= -1 ? 2 : 1;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (dx === 0 && dz === 0 && dy <= 0) continue;
          if (dy === 1 && dx !== 0 && dz !== 0) continue;
          if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && hash3(x + dx, top + dy, z + dz, seed) < 0.5) continue;
          set(x + dx, top + dy, z + dz, B.LEAVES, false);
        }
      }
    }
    const mods = this.mods.get(World.key(cx, cz));
    if (mods) for (const [i, id] of mods) data[i] = id;
    return data;
  }
  getChunk(cx, cz) {
    const k = World.key(cx, cz); let c = this.chunks.get(k);
    if (!c) { c = this.generate(cx, cz); this.chunks.set(k, c); }
    return c;
  }
  hasChunk(cx, cz) { return this.chunks.has(World.key(cx, cz)); }
  getBlock(x, y, z) {
    if (y < 0 || y >= HEIGHT) return B.AIR;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    return this.getChunk(cx, cz)[World.idx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }
  setBlock(x, y, z, id) {
    if (y < 0 || y >= HEIGHT) return [];
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    const i = World.idx(lx, y, lz);
    this.getChunk(cx, cz)[i] = id;
    const k = World.key(cx, cz);
    let m = this.mods.get(k); if (!m) { m = new Map(); this.mods.set(k, m); }
    m.set(i, id);
    // invalidate light + mark meshes dirty in a 3x3 neighbourhood when near a border, otherwise 1 chunk (+ borders)
    const dirty = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const near = (dx === 0 || (dx < 0 ? lx < 6 : lx > 9)) && (dz === 0 || (dz < 0 ? lz < 6 : lz > 9));
      if (near) { this.light.delete(World.key(cx + dx, cz + dz)); dirty.push([cx + dx, cz + dz]); }
    }
    return dirty;
  }
  // ---- Light ----
  getLightArray(cx, cz) {
    const k = World.key(cx, cz); let l = this.light.get(k);
    if (!l) { l = this.computeLight(cx, cz); this.light.set(k, l); }
    return l;
  }
  getLight(x, y, z) { // returns packed sky<<4|block
    if (y >= HEIGHT) return 0xF0; if (y < 0) return 0;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const l = this.light.get(World.key(cx, cz)); if (!l) return 0xF0;
    return l[World.idx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }
  skyLightAt(x, y, z) { return this.getLight(Math.floor(x), Math.floor(y), Math.floor(z)) >> 4; }
  blockLightAt(x, y, z) { return this.getLight(Math.floor(x), Math.floor(y), Math.floor(z)) & 15; }
  computeLight(cx, cz) {
    const ox = cx * CHUNK - PAD, oz = cz * CHUNK - PAD;
    const RN = RX * RZ * RY; const blk = new Uint8Array(RN), sky = new Uint8Array(RN), bl = new Uint8Array(RN);
    // gather blocks from 3x3 chunks
    for (let dcx = -1; dcx <= 1; dcx++) for (let dcz = -1; dcz <= 1; dcz++) {
      const data = this.getChunk(cx + dcx, cz + dcz); const bx = (cx + dcx) * CHUNK - ox, bz = (cz + dcz) * CHUNK - oz;
      for (let lx = 0; lx < CHUNK; lx++) { const rx = bx + lx; if (rx < 0 || rx >= RX) continue;
        for (let lz = 0; lz < CHUNK; lz++) { const rz = bz + lz; if (rz < 0 || rz >= RZ) continue;
          blk.set(data.subarray((lz + CHUNK * lx) * HEIGHT, (lz + CHUNK * lx) * HEIGHT + HEIGHT), (rx * RZ + rz) * RY); } }
    }
    const QS = 1 << 18, QM = QS - 1; const queue = new Int32Array(QS); let qh = 0, qt = 0;
    const opaque = new Uint8Array(256), attenuate = new Uint8Array(256);
    for (const id in REG) { opaque[id] = blocksLight(+id) ? 1 : 0; attenuate[id] = (+id === B.WATER || +id === B.LEAVES) ? 1 : 0; }
    // sky: vertical pass
    for (let rx = 0; rx < RX; rx++) for (let rz = 0; rz < RZ; rz++) {
      const col = (rx * RZ + rz) * RY; let v = 15;
      for (let y = RY - 1; y >= 0; y--) { const id = blk[col + y]; if (opaque[id]) v = 0; else if (attenuate[id] && v > 0) v--; sky[col + y] = v; if (v > 1) { queue[qt] = col + y; qt = (qt + 1) & QM; } }
    }
    const spread = (arr) => {
      const SZ = RY * RZ;
      while (qh !== qt) {
        const i = queue[qh]; qh = (qh + 1) & QM; const v = arr[i] - 1; if (v <= 0) continue;
        const y = i % RY, rz = ((i - y) / RY) % RZ, rx = (i / SZ) | 0;
        let j, id, nv;
        if (y > 0) { j = i - 1; id = blk[j]; if (!opaque[id]) { nv = attenuate[id] ? v - 1 : v; if (nv > arr[j]) { arr[j] = nv; queue[qt] = j; qt = (qt + 1) & QM; } } }
        if (y < RY - 1) { j = i + 1; id = blk[j]; if (!opaque[id]) { nv = attenuate[id] ? v - 1 : v; if (nv > arr[j]) { arr[j] = nv; queue[qt] = j; qt = (qt + 1) & QM; } } }
        if (rz > 0) { j = i - RY; id = blk[j]; if (!opaque[id]) { nv = attenuate[id] ? v - 1 : v; if (nv > arr[j]) { arr[j] = nv; queue[qt] = j; qt = (qt + 1) & QM; } } }
        if (rz < RZ - 1) { j = i + RY; id = blk[j]; if (!opaque[id]) { nv = attenuate[id] ? v - 1 : v; if (nv > arr[j]) { arr[j] = nv; queue[qt] = j; qt = (qt + 1) & QM; } } }
        if (rx > 0) { j = i - SZ; id = blk[j]; if (!opaque[id]) { nv = attenuate[id] ? v - 1 : v; if (nv > arr[j]) { arr[j] = nv; queue[qt] = j; qt = (qt + 1) & QM; } } }
        if (rx < RX - 1) { j = i + SZ; id = blk[j]; if (!opaque[id]) { nv = attenuate[id] ? v - 1 : v; if (nv > arr[j]) { arr[j] = nv; queue[qt] = j; qt = (qt + 1) & QM; } } }
      }
    };
    spread(sky);
    qh = qt = 0;
    const emit = new Uint8Array(256); for (const id in REG) emit[id] = REG[id].light || 0;
    for (let i = 0; i < RN; i++) { const e = emit[blk[i]]; if (e) { bl[i] = e; queue[qt] = i; qt = (qt + 1) & QM; } }
    spread(bl);
    const out = new Uint8Array(N);
    for (let lx = 0; lx < CHUNK; lx++) for (let lz = 0; lz < CHUNK; lz++) {
      const src = ((lx + PAD) * RZ + (lz + PAD)) * RY, dst = (lz + CHUNK * lx) * HEIGHT;
      for (let y = 0; y < HEIGHT; y++) out[dst + y] = (sky[src + y] << 4) | bl[src + y];
    }
    return out;
  }
  // ---- block entities ----
  tileKey(x, y, z) { return x + ',' + y + ',' + z; }
  getTile(x, y, z) { return this.tiles.get(this.tileKey(x, y, z)); }
  setTile(x, y, z, t) { if (t) this.tiles.set(this.tileKey(x, y, z), t); else this.tiles.delete(this.tileKey(x, y, z)); }
  // ---- persistence ----
  serialize() {
    const mods = {}; for (const [k, m] of this.mods) mods[k] = Array.from(m.entries());
    const tiles = {}; for (const [k, t] of this.tiles) tiles[k] = t;
    return { seed: this.seed, mods, tiles, spawned: Array.from(this.spawnedChunks) };
  }
  load(d) {
    this.mods.clear(); for (const k in (d.mods || {})) this.mods.set(k, new Map(d.mods[k]));
    this.tiles.clear(); for (const k in (d.tiles || {})) this.tiles.set(k, d.tiles[k]);
    this.spawnedChunks = new Set(d.spawned || []);
    this.chunks.clear(); this.light.clear();
  }
}
