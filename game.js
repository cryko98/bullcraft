/* =====================================================================
   BullCraft — browser voxel game (Three.js)
   You play the bull. Infinite procedurally generated world, mining,
   building, crafting, day/night cycle, local save in localStorage.
   ===================================================================== */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------
const CHUNK = 16;          // chunk width/depth
const HEIGHT = 64;         // world height
const WATER_LEVEL = 24;
const SAVE_KEY = 'bullcraft_save_v1';
const DAY_LENGTH = 480;    // seconds for a full day
const GRAVITY = 28;
const JUMP_VEL = 9.2;
const PLAYER_W = 0.8, PLAYER_H = 1.35, EYE_H = 1.15;

// Block definitions. tiles: [+x, -x, +y, -y, +z, -z] atlas tile ids
const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, LOG: 4, LEAVES: 5, PLANKS: 6, SAND: 7, WATER: 8,
  COBBLE: 9, GLASS: 10, FLOWER_RED: 11, FLOWER_YELLOW: 12, BRICKS: 13, GOLD: 14, BEDROCK: 15,
  CRAFTING: 16, TALLGRASS: 17, GOLD_ORE: 18, SNOW: 19, GRAVEL: 20
};
const BLOCKS = {
  [B.AIR]: { name: 'Air', tiles: null },
  [B.GRASS]: { name: 'Grass Block', tiles: [1, 1, 0, 2, 1, 1], hard: 0.6 },
  [B.DIRT]: { name: 'Dirt', tiles: [2, 2, 2, 2, 2, 2], hard: 0.5 },
  [B.STONE]: { name: 'Stone', tiles: [3, 3, 3, 3, 3, 3], hard: 1.5, drop: 9 },
  [B.LOG]: { name: 'Oak Log', tiles: [4, 4, 5, 5, 4, 4], hard: 1.0 },
  [B.LEAVES]: { name: 'Oak Leaves', tiles: [6, 6, 6, 6, 6, 6], hard: 0.25, cutout: true },
  [B.PLANKS]: { name: 'Oak Planks', tiles: [7, 7, 7, 7, 7, 7], hard: 0.9 },
  [B.SAND]: { name: 'Sand', tiles: [8, 8, 8, 8, 8, 8], hard: 0.5 },
  [B.WATER]: { name: 'Water', tiles: [9, 9, 9, 9, 9, 9], liquid: true, noCollide: true, unbreakable: true },
  [B.COBBLE]: { name: 'Cobblestone', tiles: [10, 10, 10, 10, 10, 10], hard: 1.6 },
  [B.GLASS]: { name: 'Glass', tiles: [11, 11, 11, 11, 11, 11], hard: 0.3, cutout: true },
  [B.FLOWER_RED]: { name: 'Poppy', tiles: [12, 12, 12, 12, 12, 12], hard: 0.05, cross: true, noCollide: true },
  [B.FLOWER_YELLOW]: { name: 'Dandelion', tiles: [13, 13, 13, 13, 13, 13], hard: 0.05, cross: true, noCollide: true },
  [B.BRICKS]: { name: 'Bricks', tiles: [14, 14, 14, 14, 14, 14], hard: 1.6 },
  [B.GOLD]: { name: 'Block of Gold', tiles: [15, 15, 15, 15, 15, 15], hard: 2.0 },
  [B.BEDROCK]: { name: 'Bedrock', tiles: [16, 16, 16, 16, 16, 16], unbreakable: true },
  [B.CRAFTING]: { name: 'Crafting Table', tiles: [18, 18, 17, 7, 18, 18], hard: 1.0 },
  [B.TALLGRASS]: { name: 'Grass', tiles: [19, 19, 19, 19, 19, 19], hard: 0.05, cross: true, noCollide: true, drop: 0 },
  [B.GOLD_ORE]: { name: 'Gold Ore', tiles: [20, 20, 20, 20, 20, 20], hard: 2.2 },
  [B.SNOW]: { name: 'Snow Block', tiles: [21, 21, 21, 21, 21, 21], hard: 0.4 },
  [B.GRAVEL]: { name: 'Gravel', tiles: [22, 22, 22, 22, 22, 22], hard: 0.6 },
};
const PLACEABLE = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.LOG, B.PLANKS, B.LEAVES, B.SAND, B.GRAVEL, B.GLASS, B.BRICKS, B.GOLD, B.GOLD_ORE, B.SNOW, B.CRAFTING, B.FLOWER_RED, B.FLOWER_YELLOW, B.TALLGRASS];
const RECIPES = [
  { name: 'Planks', input: [[B.LOG, 1]], output: [B.PLANKS, 4] },
  { name: 'Crafting Table', input: [[B.PLANKS, 4]], output: [B.CRAFTING, 1] },
  { name: 'Stone', input: [[B.COBBLE, 1]], output: [B.STONE, 1] },
  { name: 'Glass', input: [[B.SAND, 1]], output: [B.GLASS, 1] },
  { name: 'Bricks', input: [[B.COBBLE, 2], [B.SAND, 2]], output: [B.BRICKS, 4] },
  { name: 'Block of Gold', input: [[B.GOLD_ORE, 4]], output: [B.GOLD, 1] },
  { name: 'Gravel', input: [[B.COBBLE, 1], [B.DIRT, 1]], output: [B.GRAVEL, 2] },
];
const isSolid = id => id !== B.AIR && !BLOCKS[id].noCollide;
const isOpaque = id => id !== B.AIR && !BLOCKS[id].cutout && !BLOCKS[id].cross && !BLOCKS[id].liquid;

// ---------------------------------------------------------------------
// Noise (2D simplex) + hashing
// ---------------------------------------------------------------------
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function (xin, yin) {
    const s = (xin + yin) * F2; const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2; const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0; if (t0 > 0) { const g = grad[perm[ii + perm[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1; if (t1 > 0) { const g = grad[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2; if (t2 > 0) { const g = grad[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * n; // [-1,1]
  };
}
function hash2(x, z, seed) { let h = (x * 374761393 + z * 668265263 + seed * 1274126177) | 0; h = (h ^ (h >> 13)) * 1274126177; h = h ^ (h >> 16); return (h >>> 0) / 4294967296; }
function hash3(x, y, z, seed) { let h = (x * 374761393 + y * 1103515245 + z * 668265263 + seed * 97) | 0; h = (h ^ (h >> 13)) * 1274126177; h = h ^ (h >> 16); return (h >>> 0) / 4294967296; }

// ---------------------------------------------------------------------
// Texture atlas (procedural 16x16 tiles)
// ---------------------------------------------------------------------
const TILE = 16, ATLAS_COLS = 8, ATLAS_ROWS = 4;
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = TILE * ATLAS_COLS; atlasCanvas.height = TILE * ATLAS_ROWS;
function buildAtlas() {
  const ctx = atlasCanvas.getContext('2d');
  const rngFor = seed => { let s = seed * 7919 + 13; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const put = (idx, fn) => {
    const img = ctx.createImageData(TILE, TILE); const r = rngFor(idx + 1);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const p = fn(x, y, r) || [0, 0, 0, 0]; const i = (y * TILE + x) * 4;
      img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2]; img.data[i + 3] = p.length > 3 ? p[3] : 255;
    }
    ctx.putImageData(img, (idx % ATLAS_COLS) * TILE, Math.floor(idx / ATLAS_COLS) * TILE);
  };
  const noisy = (c, a) => (x, y, r) => { const n = (r() - 0.5) * a; return [c[0] + n, c[1] + n, c[2] + n]; };
  const grassTop = noisy([93, 158, 59], 44), dirt = noisy([121, 85, 61], 44);
  put(0, grassTop);
  put(1, (x, y, r) => { const edge = 3 + Math.floor(r() * 2); return y < edge ? grassTop(x, y, r) : dirt(x, y, r); });
  put(2, dirt);
  put(3, (x, y, r) => { const v = r(); const b = v < 0.12 ? 100 : v > 0.88 ? 145 : 127; const n = (r() - 0.5) * 14; return [b + n, b + n, b + n]; });
  put(4, (x, y, r) => { const stripe = (x % 4 === 0) ? -18 : (x % 4 === 2 ? 10 : 0); const n = (r() - 0.5) * 20; return [107 + stripe + n, 79 + stripe + n, 46 + stripe + n]; });
  put(5, (x, y, r) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); const ring = Math.floor(d) % 2 === 0 ? 12 : -10; const n = (r() - 0.5) * 14; return d < 2 ? [120 + n, 90 + n, 55 + n] : d > 6.5 ? [96 + n, 70 + n, 40 + n] : [170 + ring + n, 135 + ring + n, 85 + ring + n]; });
  put(6, (x, y, r) => { const v = r(); if (v < 0.13) return [0, 0, 0, 0]; const n = (r() - 0.5) * 50; return [50 + n, 125 + n, 40 + n, 255]; });
  put(7, (x, y, r) => { const line = (y % 4 === 3) ? -40 : 0; const sep = (y < 4 && x === 3) || (y >= 4 && y < 8 && x === 11) || (y >= 8 && y < 12 && x === 5) || (y >= 12 && x === 13) ? -40 : 0; const n = (r() - 0.5) * 18; return [168 + line + sep + n, 130 + line + sep + n, 79 + line + sep + n]; });
  put(8, noisy([219, 211, 160], 30));
  put(9, (x, y, r) => { const n = (r() - 0.5) * 30; return [50 + n, 110 + n, 225 + n, 175]; });
  put(10, (x, y, r) => {
    let best = 99;
    for (let cy = -1; cy <= 2; cy++) for (let cx = -1; cx <= 2; cx++) {
      const sx = cx * 8 + 4 + hash2(cx, cy, 21) * 3 - 1.5, sy = cy * 8 + 4 + hash2(cx, cy, 22) * 3 - 1.5;
      const d = Math.hypot(x - sx, y - sy); if (d < best) best = d;
    }
    const n = (r() - 0.5) * 16; const b = best > 4.3 ? 78 : best > 3.3 ? 104 : 134; return [b + n, b + n, b + n];
  });
  put(11, (x, y, r) => { const edge = x === 0 || y === 0 || x === 15 || y === 15; if (edge) return [220, 235, 245, 255]; if ((x === 2 && y < 6) || (y === 2 && x < 6)) return [255, 255, 255, 200]; return [200, 230, 255, 35]; });
  const flower = (petal) => (x, y, r) => {
    if (y >= 9 && y <= 15 && x === 7) return [40, 120, 30, 255];
    if (y === 10 && x === 8) return [40, 120, 30, 255];
    if (y === 11 && x === 6) return [40, 120, 30, 255];
    const d = Math.abs(x - 7) + Math.abs(y - 6);
    if (d <= 2 && !(d === 2 && (x === 7 || y === 6))) return petal.concat(255);
    if (d <= 3 && (x === 7 || y === 6)) return petal.concat(255);
    if (x === 7 && y === 6) return [40, 40, 20, 255];
    return [0, 0, 0, 0];
  };
  put(12, flower([225, 40, 40]));
  put(13, flower([240, 215, 60]));
  put(14, (x, y, r) => { const row = Math.floor(y / 4); const off = row % 2 ? 4 : 0; const mortar = (y % 4 === 3) || ((x + off) % 8 === 7); const n = (r() - 0.5) * 18; return mortar ? [184 + n, 170 + n, 155 + n] : [156 + n, 86 + n, 65 + n]; });
  put(15, (x, y, r) => { const edge = x === 0 || y === 0 || x === 15 || y === 15; const n = (r() - 0.5) * 24; if (edge) return [184 + n, 134 + n, 27 + n]; if ((x + y) % 7 === 0 || (x - y + 16) % 9 === 0) return [255, 240, 160]; return [245 + n, 200 + n, 66 + n]; });
  put(16, (x, y, r) => { const v = r(); const b = v < 0.4 ? 40 : v < 0.8 ? 75 : 110; return [b, b, b]; });
  put(17, (x, y, r) => { const grid = (x === 4 || x === 8 || x === 12 || y === 4 || y === 8 || y === 12) ? -45 : 0; const n = (r() - 0.5) * 16; return [170 + grid + n, 132 + grid + n, 80 + grid + n]; });
  put(18, (x, y, r) => { const tool = (y > 3 && y < 7 && x > 2 && x < 7) || (y > 8 && y < 13 && x > 9 && x < 14) || (y > 6 && y < 10 && x === 8); const n = (r() - 0.5) * 16; return tool ? [60, 60, 60] : [160 + n, 122 + n, 72 + n]; });
  put(19, (x, y, r) => { const blades = [[3, 6], [5, 3], [7, 2], [9, 4], [11, 5], [13, 8], [1, 9]]; for (const [bx, top] of blades) { if ((x === bx || (x === bx + 1 && y > top + 3)) && y >= top && y <= 15) return [70 + y * 4, 150 + y * 3, 45, 255]; } return [0, 0, 0, 0]; });
  put(20, (x, y, r) => { const v = r(); const gold = hash2(x, y, 5) < 0.2 && ((x + y) % 3 !== 0); const b = v < 0.12 ? 100 : v > 0.88 ? 145 : 127; const n = (r() - 0.5) * 14; return gold ? [245, 205, 70] : [b + n, b + n, b + n]; });
  put(21, noisy([240, 244, 250], 18));
  put(22, (x, y, r) => { const v = r(); const b = v < 0.3 ? 95 : v < 0.6 ? 125 : v < 0.85 ? 150 : 110; return [b + 6, b, b - 6]; });
  const tex = new THREE.CanvasTexture(atlasCanvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function tileIcon(tile, size) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlasCanvas, (tile % ATLAS_COLS) * TILE, Math.floor(tile / ATLAS_COLS) * TILE, TILE, TILE, 0, 0, size, size);
  return c;
}
function blockIcon(id, size = 32) { const bl = BLOCKS[id]; const tile = bl.cross ? bl.tiles[0] : (id === B.GRASS ? 1 : bl.tiles[4]); return tileIcon(tile, size); }

// ---------------------------------------------------------------------
// World (chunks, generation, modifications)
// ---------------------------------------------------------------------
class World {
  constructor(seed) {
    this.seed = seed;
    this.noise = makeNoise(seed);
    this.noise2 = makeNoise(seed + 1337);
    this.chunks = new Map();     // key -> Uint8Array
    this.mods = new Map();       // key -> Map(localIndex -> id)
    this.heightCache = new Map();
  }
  static key(cx, cz) { return cx + ',' + cz; }
  static idx(x, y, z) { return y + HEIGHT * (z + CHUNK * x); }
  height(x, z) {
    const k = x + ',' + z; let h = this.heightCache.get(k); if (h !== undefined) return h;
    const n = this.noise, n2 = this.noise2;
    let v = 22 + n(x / 90, z / 90) * 12 + n2(x / 28, z / 28) * 5 + n(x / 9 + 50, z / 9) * 1.5;
    const hills = n2(x / 170 + 100, z / 170);
    if (hills > 0.15) v += (hills - 0.15) * (hills - 0.15) * 90;
    h = Math.max(4, Math.min(HEIGHT - 5, Math.floor(v)));
    if (this.heightCache.size > 60000) this.heightCache.clear();
    this.heightCache.set(k, h); return h;
  }
  treeAt(x, z) {
    const h = this.height(x, z);
    if (h <= WATER_LEVEL + 1) return 0;
    const forest = this.noise2(x / 60 + 300, z / 60 + 300);
    const chance = forest > 0.1 ? 0.03 : 0.006;
    if (hash2(x, z, this.seed) > chance) return 0;
    return 4 + Math.floor(hash2(x, z, this.seed + 7) * 3); // trunk height 4..6
  }
  generate(cx, cz) {
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    const ox = cx * CHUNK, oz = cz * CHUNK, seed = this.seed;
    for (let lx = 0; lx < CHUNK; lx++) for (let lz = 0; lz < CHUNK; lz++) {
      const x = ox + lx, z = oz + lz; const h = this.height(x, z);
      const base = (lz + CHUNK * lx) * HEIGHT;
      const beach = h <= WATER_LEVEL + 1; const snowy = h >= 50;
      for (let y = 0; y <= h; y++) {
        let id;
        if (y === 0) id = B.BEDROCK;
        else if (y < h - 3) { id = B.STONE; if (y < 22 && hash3(x, y, z, seed) < 0.011) id = B.GOLD_ORE; else if (hash3(x, y, z, seed + 3) < 0.02) id = B.GRAVEL; }
        else if (y < h) id = beach ? B.SAND : B.DIRT;
        else id = beach ? B.SAND : snowy ? B.SNOW : B.GRASS;
        data[base + y] = id;
      }
      for (let y = h + 1; y <= WATER_LEVEL; y++) data[base + y] = B.WATER;
      // plants
      if (!beach && !snowy && h + 1 < HEIGHT) {
        const r = hash2(x, z, seed + 11);
        if (r < 0.08) data[base + h + 1] = B.TALLGRASS;
        else if (r < 0.095) data[base + h + 1] = B.FLOWER_RED;
        else if (r < 0.11) data[base + h + 1] = B.FLOWER_YELLOW;
      }
    }
    // trees (including ones rooted in neighbouring chunks)
    for (let x = ox - 2; x < ox + CHUNK + 2; x++) for (let z = oz - 2; z < oz + CHUNK + 2; z++) {
      const th = this.treeAt(x, z); if (!th) continue;
      const h = this.height(x, z); const top = h + th;
      const set = (wx, wy, wz, id, force) => {
        const lx = wx - ox, lz = wz - oz; if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || wy <= 0 || wy >= HEIGHT) return;
        const i = (lz + CHUNK * lx) * HEIGHT + wy; if (force || data[i] === B.AIR || BLOCKS[data[i]].cross) data[i] = id;
      };
      for (let y = h + 1; y <= top; y++) set(x, y, z, B.LOG, true);
      for (let dy = -2; dy <= 1; dy++) {
        const rad = dy <= -1 ? 2 : dy === 0 ? 1 : 1;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (dx === 0 && dz === 0 && dy <= 0) continue;
          if (dy === 1 && dx !== 0 && dz !== 0) continue;
          if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && hash3(x + dx, top + dy, z + dz, seed) < 0.5) continue;
          set(x + dx, top + dy, z + dz, B.LEAVES, false);
        }
      }
    }
    // apply saved modifications
    const mods = this.mods.get(World.key(cx, cz));
    if (mods) for (const [i, id] of mods) data[i] = id;
    return data;
  }
  getChunk(cx, cz) {
    const k = World.key(cx, cz); let c = this.chunks.get(k);
    if (!c) { c = this.generate(cx, cz); this.chunks.set(k, c); }
    return c;
  }
  getBlock(x, y, z) {
    if (y < 0 || y >= HEIGHT) return B.AIR;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    return this.getChunk(cx, cz)[World.idx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }
  setBlock(x, y, z, id) {
    if (y < 0 || y >= HEIGHT) return;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    const i = World.idx(lx, y, lz);
    this.getChunk(cx, cz)[i] = id;
    const k = World.key(cx, cz);
    let m = this.mods.get(k); if (!m) { m = new Map(); this.mods.set(k, m); }
    m.set(i, id);
    const dirty = [[cx, cz]];
    if (lx === 0) dirty.push([cx - 1, cz]); if (lx === CHUNK - 1) dirty.push([cx + 1, cz]);
    if (lz === 0) dirty.push([cx, cz - 1]); if (lz === CHUNK - 1) dirty.push([cx, cz + 1]);
    return dirty;
  }
  serializeMods() { const o = {}; for (const [k, m] of this.mods) o[k] = Array.from(m.entries()); return o; }
  loadMods(o) { this.mods.clear(); for (const k in o) this.mods.set(k, new Map(o[k])); this.chunks.clear(); }
}

// ---------------------------------------------------------------------
// Chunk mesher (greedy-free, per-face culling, vertex AO)
// ---------------------------------------------------------------------
const FACES = []; // {dir:[x,y,z], tileSlot, corners:[{p:[x,y,z], u, v, t1s, t2s}], shade}
(function buildFaces() {
  const defs = [
    { a: 0, s: 1, slot: 0, t1: 2, t2: 1, shade: 0.8 }, { a: 0, s: -1, slot: 1, t1: 2, t2: 1, shade: 0.8 },
    { a: 1, s: 1, slot: 2, t1: 0, t2: 2, shade: 1.0 }, { a: 1, s: -1, slot: 3, t1: 0, t2: 2, shade: 0.5 },
    { a: 2, s: 1, slot: 4, t1: 0, t2: 1, shade: 0.65 }, { a: 2, s: -1, slot: 5, t1: 0, t2: 1, shade: 0.65 },
  ];
  for (const d of defs) {
    const dir = [0, 0, 0]; dir[d.a] = d.s;
    let corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([i, j]) => { const p = [0, 0, 0]; p[d.a] = d.s > 0 ? 1 : 0; p[d.t1] = i; p[d.t2] = j; return { p, u: i, v: j, s1: i ? 1 : -1, s2: j ? 1 : -1 }; });
    const e1 = corners[1].p.map((v, k) => v - corners[0].p[k]), e2 = corners[2].p.map((v, k) => v - corners[0].p[k]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2] < 0) corners = [corners[0], corners[3], corners[2], corners[1]];
    FACES.push({ dir, slot: d.slot, corners, shade: d.shade, t1: d.t1, t2: d.t2, a: d.a });
  }
})();
const UV_EPS = 0.002;
function tileUV(tile, u, v) {
  const col = tile % ATLAS_COLS, row = Math.floor(tile / ATLAS_COLS);
  const uu = (col + UV_EPS + u * (1 - 2 * UV_EPS)) / ATLAS_COLS;
  const vv = 1 - (row + UV_EPS + (1 - v) * (1 - 2 * UV_EPS)) / ATLAS_ROWS;
  return [uu, vv];
}
function buildChunkMesh(world, cx, cz) {
  const data = world.getChunk(cx, cz); const ox = cx * CHUNK, oz = cz * CHUNK;
  const solid = { pos: [], uv: [], col: [], idx: [] }, water = { pos: [], uv: [], col: [], idx: [] };
  const get = (x, y, z) => {
    if (y < 0 || y >= HEIGHT) return B.AIR;
    if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK) return data[World.idx(x, y, z)];
    return world.getBlock(ox + x, y, oz + z);
  };
  const pushQuad = (buf, pts, uvs, cols) => {
    const base = buf.pos.length / 3;
    for (let i = 0; i < 4; i++) { buf.pos.push(pts[i][0], pts[i][1], pts[i][2]); buf.uv.push(uvs[i][0], uvs[i][1]); buf.col.push(cols[i], cols[i], cols[i]); }
    if (cols[0] + cols[2] > cols[1] + cols[3]) buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else buf.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
  };
  for (let x = 0; x < CHUNK; x++) for (let z = 0; z < CHUNK; z++) for (let y = 0; y < HEIGHT; y++) {
    const id = data[World.idx(x, y, z)]; if (id === B.AIR) continue;
    const bl = BLOCKS[id];
    if (bl.cross) {
      const tile = bl.tiles[0]; const c = 0.85;
      const quads = [[[0, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]], [[1, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 0]]];
      for (const q of quads) {
        const pts = q.map(p => [ox + x + p[0], y + p[1], oz + z + p[2]]);
        const uvs = [tileUV(tile, 0, 0), tileUV(tile, 1, 0), tileUV(tile, 1, 1), tileUV(tile, 0, 1)];
        pushQuad(solid, pts, uvs, [c, c, c, c]);
        pushQuad(solid, [pts[3], pts[2], pts[1], pts[0]], [uvs[3], uvs[2], uvs[1], uvs[0]], [c, c, c, c]);
      }
      continue;
    }
    for (const f of FACES) {
      const nx = x + f.dir[0], ny = y + f.dir[1], nz = z + f.dir[2];
      const n = get(nx, ny, nz);
      if (bl.liquid) { if (n === B.WATER || isOpaque(n)) continue; }
      else if (isOpaque(n) || (n === id && bl.cutout)) continue;
      const tile = bl.tiles[f.slot];
      const pts = [], uvs = [], cols = [];
      for (const c of f.corners) {
        pts.push([ox + x + c.p[0], y + c.p[1], oz + z + c.p[2]]);
        uvs.push(tileUV(tile, c.u, c.v));
        let ao = 3;
        if (!bl.liquid) {
          const o1 = [nx, ny, nz], o2 = [nx, ny, nz], o3 = [nx, ny, nz];
          o1[f.t1] += c.s1; o2[f.t2] += c.s2; o3[f.t1] += c.s1; o3[f.t2] += c.s2;
          const s1 = isOpaque(get(o1[0], o1[1], o1[2])) ? 1 : 0, s2 = isOpaque(get(o2[0], o2[1], o2[2])) ? 1 : 0, s3 = isOpaque(get(o3[0], o3[1], o3[2])) ? 1 : 0;
          ao = (s1 && s2) ? 0 : 3 - (s1 + s2 + s3);
        }
        cols.push(f.shade * (0.55 + ao * 0.15));
      }
      pushQuad(bl.liquid ? water : solid, pts, uvs, cols);
    }
  }
  const mk = buf => {
    if (!buf.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
    g.setIndex(buf.idx); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  };
  return { solid: mk(solid), water: mk(water) };
}

// ---------------------------------------------------------------------
// Bull character (voxel model built from boxes)
// ---------------------------------------------------------------------
function buildBull() {
  const g = new THREE.Group();
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const body = mat(0x5a5048), light = mat(0x9a948c), muzzle = mat(0xd2cdc4), horn = mat(0x8f887c), dark = mat(0x1a1a1a), hoof = mat(0x2b2824), pink = mat(0xd98c9c);
  const box = (w, h, d, m, x, y, z, parent = g) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  // body (facing -z)
  box(0.72, 0.66, 1.15, body, 0, 0.92, 0.05);
  // light patches
  box(0.3, 0.28, 0.02, light, 0.1, 0.95, -0.53); box(0.02, 0.3, 0.4, light, 0.37, 1.0, 0.2); box(0.02, 0.25, 0.3, light, -0.37, 0.85, -0.1);
  box(0.25, 0.02, 0.35, light, -0.15, 1.26, 0.25); box(0.3, 0.02, 0.25, light, 0.12, 1.26, -0.2); box(0.3, 0.2, 0.02, light, -0.05, 0.8, 0.63);
  // udder-ish pink belly patch (like the logo's cow base)
  box(0.3, 0.02, 0.3, pink, 0, 0.585, 0.25);
  // head
  const head = new THREE.Group(); head.position.set(0, 1.12, -0.6); g.add(head);
  box(0.5, 0.5, 0.45, body, 0, 0, -0.1, head);
  box(0.36, 0.22, 0.06, muzzle, 0, -0.12, -0.35, head);
  box(0.06, 0.05, 0.02, dark, -0.1, -0.1, -0.385, head); box(0.06, 0.05, 0.02, dark, 0.1, -0.1, -0.385, head);
  box(0.07, 0.07, 0.02, dark, -0.15, 0.1, -0.335, head); box(0.07, 0.07, 0.02, dark, 0.15, 0.1, -0.335, head);
  box(0.08, 0.06, 0.03, light, -0.15, 0.1, -0.33, head); box(0.08, 0.06, 0.03, light, 0.15, 0.1, -0.33, head);
  box(0.22, 0.1, 0.1, horn, -0.3, 0.18, -0.05, head); box(0.22, 0.1, 0.1, horn, 0.3, 0.18, -0.05, head);
  box(0.1, 0.16, 0.1, horn, -0.36, 0.3, -0.05, head); box(0.1, 0.16, 0.1, horn, 0.36, 0.3, -0.05, head);
  box(0.16, 0.08, 0.06, body, -0.3, 0.03, 0.05, head); box(0.16, 0.08, 0.06, body, 0.3, 0.03, 0.05, head);
  // legs
  const legs = [];
  for (const [x, z] of [[-0.22, -0.38], [0.22, -0.38], [-0.22, 0.42], [0.22, 0.42]]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.62, z); g.add(leg);
    box(0.24, 0.62, 0.24, body, 0, -0.31, 0, leg); box(0.25, 0.1, 0.25, hoof, 0, -0.57, 0, leg);
    legs.push(leg);
  }
  // tail
  box(0.06, 0.35, 0.06, body, 0, 1.05, 0.65);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
  return { group: g, head, legs };
}

// ---------------------------------------------------------------------
// Sound (tiny WebAudio effects)
// ---------------------------------------------------------------------
const Sound = {
  ctx: null, enabled: true,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  play(type) {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (type === 'break' || type === 'place' || type === 'step') {
      const len = type === 'break' ? 0.18 : type === 'place' ? 0.08 : 0.05;
      const buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate); const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = type === 'break' ? 900 : type === 'place' ? 1400 : 500;
      const gain = c.createGain(); gain.gain.value = type === 'step' ? 0.08 : 0.25;
      src.connect(f); f.connect(gain); gain.connect(c.destination); src.start(t);
    } else if (type === 'craft' || type === 'pickup') {
      const o = c.createOscillator(), gn = c.createGain(); o.type = 'square';
      o.frequency.setValueAtTime(type === 'craft' ? 440 : 660, t); o.frequency.setValueAtTime(type === 'craft' ? 660 : 880, t + 0.07);
      gn.gain.setValueAtTime(0.08, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(gn); gn.connect(c.destination); o.start(t); o.stop(t + 0.2);
    }
  }
};

// ---------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.wrap = document.getElementById('gameWrap');
    this.ui = {
      overlay: document.getElementById('overlay'), overlayTitle: document.getElementById('overlayTitle'), overlayText: document.getElementById('overlayText'),
      btnPlay: document.getElementById('btnPlay'), btnNew: document.getElementById('btnNewWorld'), selRender: document.getElementById('selRender'), chkSound: document.getElementById('chkSound'),
      coords: document.getElementById('hudCoords'), time: document.getElementById('hudTime'), target: document.getElementById('hudTarget'), hotbar: document.getElementById('hotbar'),
      breakProg: document.getElementById('breakProgress'), toast: document.getElementById('toast'), inv: document.getElementById('inventoryPanel'), invGrid: document.getElementById('invGrid'), recipes: document.getElementById('recipes'),
      btnInv: document.getElementById('btnInventory'), btnMode: document.getElementById('btnMode'), btnSave: document.getElementById('btnSave'), btnFull: document.getElementById('btnFullscreen'), btnCloseInv: document.getElementById('btnCloseInv'),
    };
    this.renderDistance = parseInt(this.ui.selRender.value, 10);
    this.isTouch = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 1 && !matchMedia('(pointer: fine)').matches);
    if (this.isTouch) { document.body.classList.add('touch'); document.getElementById('btnPlay').textContent = 'Tap to Play'; }
    this.keys = {}; this.mouse = { dx: 0, dy: 0, left: false, right: false };
    this.locked = false; this.running = false; this.started = false;
    this.firstPerson = false; this.flying = false; this.mode = 'survival';
    this.yaw = 0; this.pitch = -0.25;
    this.pos = new THREE.Vector3(8, 40, 8); this.vel = new THREE.Vector3();
    this.onGround = false; this.inWater = false;
    this.inventory = {}; this.hotbar = [B.PLANKS, B.COBBLE, B.GLASS, B.LOG, B.GOLD, 0, 0, 0, 0]; this.slot = 0;
    this.time = 0.22; // day fraction
    this.breaking = null; // {x,y,z,progress}
    this.placeCooldown = 0; this.walkCycle = 0; this.stepTimer = 0;
    this.meshes = new Map(); this.dirty = new Set(); this.buildQueue = [];
    this.lastSave = 0; this.frameTime = 0;
    this.initThree();
    this.bindUI();
    this.loadOrCreate();
    this.buildHotbar(); this.updateHotbar();
    requestAnimationFrame(t => this.loop(t));
  }

  // ---------------- setup ----------------
  initThree() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x78a7ff);
    this.scene.fog = new THREE.Fog(0x78a7ff, 40, 90);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
    this.atlas = buildAtlas();
    this.matSolid = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, alphaTest: 0.5, side: THREE.FrontSide });
    this.matWater = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
    this.sun = new THREE.DirectionalLight(0xffffff, 1.0); this.scene.add(this.sun);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.5); this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x6b4f2e, 0.35); this.scene.add(this.hemi);
    // sun & moon sprites
    const sunGeo = new THREE.PlaneGeometry(14, 14);
    this.sunMesh = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: 0xfff1a0, fog: false })); this.scene.add(this.sunMesh);
    this.moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false })); this.scene.add(this.moonMesh);
    // stars
    const starPos = []; for (let i = 0; i < 500; i++) { const v = new THREE.Vector3().randomDirection(); if (v.y < 0.05) continue; starPos.push(v.x * 300, v.y * 300, v.z * 300); }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 }));
    this.scene.add(this.stars);
    // block highlight
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
    this.highlight.visible = false; this.scene.add(this.highlight);
    // bull
    this.bull = buildBull(); this.scene.add(this.bull.group);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    new ResizeObserver(() => this.resize()).observe(this.wrap);
  }
  resize() {
    const w = this.wrap.clientWidth, h = this.wrap.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  bindUI() {
    const u = this.ui;
    u.btnPlay.addEventListener('click', () => this.start());
    u.btnNew.addEventListener('click', () => { if (confirm('Start a new world? Your current world will be deleted from this browser.')) this.newWorld(); });
    u.selRender.addEventListener('change', () => { this.renderDistance = parseInt(u.selRender.value, 10); this.unloadFar(true); });
    u.chkSound.addEventListener('change', () => { Sound.enabled = u.chkSound.checked; });
    u.btnInv.addEventListener('click', () => this.toggleInventory());
    u.btnCloseInv.addEventListener('click', () => this.toggleInventory(false));
    u.btnMode.addEventListener('click', () => this.toggleMode());
    u.btnSave.addEventListener('click', () => { this.save(); this.toast('World saved'); });
    u.btnFull.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else this.wrap.requestFullscreen && this.wrap.requestFullscreen(); });
    // keyboard
    window.addEventListener('keydown', e => {
      if (!this.started) return;
      const k = e.code;
      if (this.invOpen) { if (k === 'KeyE' || k === 'Escape') { e.preventDefault(); this.toggleInventory(false); } return; }
      if (!this.running) return;
      if (k === 'KeyE') { e.preventDefault(); this.toggleInventory(true); return; }
      this.keys[k] = true;
      if (k === 'KeyF') { this.flying = !this.flying; this.vel.y = 0; this.toast(this.flying ? 'Flying enabled' : 'Flying disabled'); }
      if (k === 'F5') { e.preventDefault(); this.firstPerson = !this.firstPerson; }
      if (k.startsWith('Digit')) { const n = parseInt(k.slice(5), 10); if (n >= 1 && n <= 9) { this.slot = n - 1; this.updateHotbar(); } }
      if (k === 'Space' || k === 'ArrowUp' || k === 'ArrowDown') e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    // mouse
    this.canvas.addEventListener('click', () => { if (this.started && !this.isTouch && !this.locked) this.lock(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.locked) { this.running = true; this.ui.overlay.classList.add('hidden'); }
      else if (!this.isTouch && !this.invOpen) this.pause();
    });
    document.addEventListener('pointerlockerror', () => this.toast('Pointer lock failed — click the game again'));
    document.addEventListener('mousemove', e => { if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    this.canvas.addEventListener('mousedown', e => { if (!this.locked) return; if (e.button === 0) this.mouse.left = true; if (e.button === 2) { this.mouse.right = true; this.placeCooldown = 0; } });
    document.addEventListener('mouseup', e => { if (e.button === 0) { this.mouse.left = false; this.breaking = null; } if (e.button === 2) this.mouse.right = false; });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('wheel', e => { if (!this.locked) return; e.preventDefault(); this.slot = (this.slot + (e.deltaY > 0 ? 1 : 8)) % 9; this.updateHotbar(); }, { passive: false });
    // touch
    if (this.isTouch) this.bindTouch();
    // autosave
    window.addEventListener('beforeunload', () => { if (this.started) this.save(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.started) this.save(); });
  }
  bindTouch() {
    const joy = document.getElementById('joystick'), knob = document.getElementById('joyKnob');
    this.joy = { x: 0, y: 0, id: null };
    const setKnob = (dx, dy) => { knob.style.left = (35 + dx * 35) + 'px'; knob.style.top = (35 + dy * 35) + 'px'; };
    joy.addEventListener('touchstart', e => { e.preventDefault(); this.joy.id = e.changedTouches[0].identifier; }, { passive: false });
    joy.addEventListener('touchmove', e => {
      e.preventDefault(); const r = joy.getBoundingClientRect();
      for (const t of e.changedTouches) if (t.identifier === this.joy.id) {
        let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        this.joy.x = dx; this.joy.y = dy; setKnob(dx, dy);
      }
    }, { passive: false });
    const endJoy = e => { for (const t of e.changedTouches) if (t.identifier === this.joy.id) { this.joy.id = null; this.joy.x = 0; this.joy.y = 0; setKnob(0, 0); } };
    joy.addEventListener('touchend', endJoy); joy.addEventListener('touchcancel', endJoy);
    // look by dragging on canvas
    let lookId = null, lx = 0, ly = 0;
    this.canvas.addEventListener('touchstart', e => { if (!this.running) { if (this.started) this.resume(); return; } const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY; }, { passive: true });
    this.canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === lookId) { this.mouse.dx += (t.clientX - lx) * 2.2; this.mouse.dy += (t.clientY - ly) * 2.2; lx = t.clientX; ly = t.clientY; } }, { passive: true });
    this.canvas.addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; });
    const hold = (id, on, off) => { const el = document.getElementById(id); el.addEventListener('touchstart', e => { e.preventDefault(); on(); }, { passive: false }); el.addEventListener('touchend', e => { e.preventDefault(); off && off(); }); el.addEventListener('touchcancel', () => off && off()); };
    hold('tJump', () => { this.keys.Space = true; }, () => { this.keys.Space = false; });
    hold('tMine', () => { this.mouse.left = true; }, () => { this.mouse.left = false; this.breaking = null; });
    hold('tPlace', () => { this.mouse.right = true; this.placeCooldown = 0; }, () => { this.mouse.right = false; });
    hold('tFly', () => { this.flying = !this.flying; this.vel.y = 0; this.toast(this.flying ? 'Flying enabled' : 'Flying disabled'); });
    this.ui.hotbar.addEventListener('touchstart', e => { const s = e.target.closest('.slot'); if (s) { this.slot = parseInt(s.dataset.i, 10); this.updateHotbar(); } });
  }
  lock() { try { this.canvas.requestPointerLock(); } catch (e) { this.toast('Pointer lock unavailable'); } }
  start() {
    Sound.init(); this.started = true;
    if (this.isTouch) { this.running = true; this.ui.overlay.classList.add('hidden'); } else this.lock();
  }
  resume() { if (this.isTouch) { this.running = true; this.ui.overlay.classList.add('hidden'); } else this.lock(); }
  pause() {
    this.running = false; this.keys = {}; if (!this.started) return; this.mouse.left = this.mouse.right = false; this.breaking = null;
    this.ui.overlayTitle.textContent = 'Paused'; this.ui.overlayText.textContent = 'Your world is saved in this browser.';
    this.ui.btnPlay.textContent = this.isTouch ? 'Tap to Resume' : 'Resume'; this.ui.overlay.classList.remove('hidden'); this.save();
  }
  toast(msg) { const t = this.ui.toast; t.textContent = msg; t.classList.add('show'); clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.remove('show'), 1800); }

  // ---------------- world / save ----------------
  loadOrCreate() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { data = null; }
    if (data && data.seed !== undefined) {
      this.world = new World(data.seed); this.world.loadMods(data.mods || {});
      if (data.player) { this.pos.set(data.player.x, data.player.y, data.player.z); this.yaw = data.player.yaw || 0; this.pitch = data.player.pitch || -0.25; }
      this.inventory = data.inv || {}; if (data.hotbar) this.hotbar = data.hotbar; this.slot = data.slot || 0;
      this.time = data.time ?? 0.22; this.mode = data.mode || 'survival'; this.flying = !!data.flying; this.firstPerson = !!data.firstPerson;
      this.ui.overlayText.textContent = 'Welcome back! Loading your world…';
    } else {
      this.world = new World((Math.random() * 2147483647) | 0);
      this.inventory = { [B.PLANKS]: 32, [B.COBBLE]: 16, [B.GLASS]: 8, [B.LOG]: 4, [B.GOLD]: 1 };
      this.spawn();
      this.ui.overlayText.textContent = 'Generating a fresh world…';
    }
    this.ui.btnMode.textContent = this.mode === 'survival' ? 'Survival' : 'Creative';
    this.ui.btnPlay.disabled = true;
  }
  spawn() {
    for (let r = 0; r < 64; r += 4) for (let a = 0; a < 8; a++) {
      const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
      const h = this.world.height(x, z); if (h > WATER_LEVEL + 1) { this.pos.set(x + 0.5, h + 2, z + 0.5); return; }
    }
    this.pos.set(0.5, 40, 0.5);
  }
  save() {
    if (!this.world) return;
    const data = { v: 1, seed: this.world.seed, mods: this.world.serializeMods(), player: { x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw, pitch: this.pitch }, inv: this.inventory, hotbar: this.hotbar, slot: this.slot, time: this.time, mode: this.mode, flying: this.flying, firstPerson: this.firstPerson, saved: Date.now() };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { this.toast('Save failed (storage full?)'); }
    this.lastSave = performance.now();
  }
  newWorld() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
    for (const m of this.meshes.values()) this.disposeMesh(m);
    this.meshes.clear(); this.dirty.clear(); this.buildQueue.length = 0;
    this.world = new World((Math.random() * 2147483647) | 0);
    this.inventory = { [B.PLANKS]: 32, [B.COBBLE]: 16, [B.GLASS]: 8, [B.LOG]: 4, [B.GOLD]: 1 };
    this.hotbar = [B.PLANKS, B.COBBLE, B.GLASS, B.LOG, B.GOLD, 0, 0, 0, 0]; this.slot = 0;
    this.vel.set(0, 0, 0); this.flying = false; this.time = 0.22; this.yaw = 0; this.pitch = -0.25;
    this.spawn(); this.updateHotbar(); this.toast('New world created');
    this.ui.overlayText.textContent = 'Generating a fresh world…'; this.ui.btnPlay.disabled = true; this.ui.btnPlay.textContent = 'Click to Play';
    this.started = false; this.running = false; this.ui.overlayTitle.textContent = 'BullCraft'; this.ui.overlay.classList.remove('hidden');
    if (this.locked) document.exitPointerLock();
  }

  // ---------------- chunk management ----------------
  disposeMesh(m) { if (m.solid) { this.scene.remove(m.solid); m.solid.geometry.dispose(); } if (m.water) { this.scene.remove(m.water); m.water.geometry.dispose(); } }
  updateChunks() {
    const pcx = Math.floor(this.pos.x / CHUNK), pcz = Math.floor(this.pos.z / CHUNK), R = this.renderDistance;
    // queue missing chunks
    this.buildQueue.length = 0;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
      const k = World.key(pcx + dx, pcz + dz);
      if (!this.meshes.has(k) || this.dirty.has(k)) this.buildQueue.push({ cx: pcx + dx, cz: pcz + dz, d: dx * dx + dz * dz, k });
    }
    this.buildQueue.sort((a, b) => a.d - b.d);
    const budget = this.started ? 1 : 4; let built = 0; const t0 = performance.now();
    for (const q of this.buildQueue) {
      if (built >= budget && performance.now() - t0 > 12) break;
      this.rebuildChunk(q.cx, q.cz); built++;
      if (performance.now() - t0 > 30) break;
    }
    this.unloadFar(false);
  }
  rebuildChunk(cx, cz) {
    const k = World.key(cx, cz);
    const old = this.meshes.get(k); if (old) this.disposeMesh(old);
    const geo = buildChunkMesh(this.world, cx, cz);
    const m = { solid: null, water: null };
    if (geo.solid) { m.solid = new THREE.Mesh(geo.solid, this.matSolid); this.scene.add(m.solid); }
    if (geo.water) { m.water = new THREE.Mesh(geo.water, this.matWater); this.scene.add(m.water); }
    this.meshes.set(k, m); this.dirty.delete(k);
  }
  unloadFar(force) {
    const pcx = Math.floor(this.pos.x / CHUNK), pcz = Math.floor(this.pos.z / CHUNK), R = this.renderDistance + (force ? 0 : 2);
    for (const [k, m] of this.meshes) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx - pcx) > R || Math.abs(cz - pcz) > R) { this.disposeMesh(m); this.meshes.delete(k); }
    }
    if (this.world.chunks.size > 900) { for (const k of this.world.chunks.keys()) { if (!this.meshes.has(k) && !this.world.mods.has(k)) this.world.chunks.delete(k); } }
  }
  nearbyReady() {
    const pcx = Math.floor(this.pos.x / CHUNK), pcz = Math.floor(this.pos.z / CHUNK);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!this.meshes.has(World.key(pcx + dx, pcz + dz))) return false;
    return true;
  }

  // ---------------- physics ----------------
  collides(px, py, pz) {
    const hw = PLAYER_W / 2;
    const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw - 0.001), y0 = Math.floor(py), y1 = Math.floor(py + PLAYER_H - 0.001), z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw - 0.001);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (isSolid(this.world.getBlock(x, y, z))) return true;
    return false;
  }
  updatePlayer(dt) {
    // look
    const sens = 0.0022;
    this.yaw -= this.mouse.dx * sens; this.pitch -= this.mouse.dy * sens;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch)); this.mouse.dx = this.mouse.dy = 0;
    // input
    let fw = 0, st = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) fw += 1; if (this.keys.KeyS || this.keys.ArrowDown) fw -= 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) st -= 1; if (this.keys.KeyD || this.keys.ArrowRight) st += 1;
    if (this.joy) { fw -= this.joy.y; st += this.joy.x; }
    const sprint = this.keys.ShiftLeft || this.keys.ShiftRight || this.keys.ControlLeft;
    const len = Math.hypot(fw, st); if (len > 1) { fw /= len; st /= len; }
    const speed = this.flying ? 11 : this.inWater ? 2.6 : sprint ? 6.6 : 4.4;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const mx = (-sin * fw + cos * st) * speed, mz = (-cos * fw - sin * st) * speed;
    const feet = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.2), Math.floor(this.pos.z));
    const head = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + EYE_H), Math.floor(this.pos.z));
    this.inWater = feet === B.WATER || head === B.WATER;
    const accel = this.onGround || this.flying ? 14 : 4;
    this.vel.x += (mx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (mz - this.vel.z) * Math.min(1, accel * dt);
    if (this.flying) {
      let vy = 0; if (this.keys.Space) vy += speed; if (this.keys.ShiftLeft || this.keys.ShiftRight || this.keys.KeyC) vy -= speed;
      this.vel.y += (vy - this.vel.y) * Math.min(1, 10 * dt);
    } else if (this.inWater) {
      this.vel.y -= GRAVITY * 0.25 * dt; this.vel.y *= 0.9;
      if (this.keys.Space) this.vel.y = Math.min(this.vel.y + 24 * dt, 4);
    } else {
      this.vel.y -= GRAVITY * dt; if (this.vel.y < -40) this.vel.y = -40;
      if (this.keys.Space && this.onGround) { this.vel.y = JUMP_VEL; this.onGround = false; }
    }
    // move with collision (per axis)
    const move = (axis, d) => {
      const p = this.pos.clone(); p[axis] += d;
      if (!this.collides(p.x, p.y, p.z)) { this.pos[axis] += d; return false; }
      // step back to boundary
      const step = d > 0 ? 0.01 : -0.01; let moved = 0;
      while (Math.abs(moved + step) < Math.abs(d)) { const q = this.pos.clone(); q[axis] += moved + step; if (this.collides(q.x, q.y, q.z)) break; moved += step; }
      this.pos[axis] += moved; return true;
    };
    const wasOnGround = this.onGround;
    const dx = this.vel.x * dt, dy = this.vel.y * dt, dz = this.vel.z * dt;
    // auto step-up for 1-block ledges
    let hitX = move('x', dx); let hitZ = move('z', dz);
    if ((hitX || hitZ) && (this.onGround || this.inWater) && !this.flying) {
      const up = this.pos.clone(); up.y += 1.01;
      if (!this.collides(up.x, up.y, up.z)) {
        const tryP = up.clone(); tryP.x += dx; tryP.z += dz;
        if (!this.collides(tryP.x, tryP.y, tryP.z)) { this.pos.copy(tryP); hitX = hitZ = false; }
      }
    }
    if (hitX) this.vel.x = 0; if (hitZ) this.vel.z = 0;
    this.onGround = false;
    if (move('y', dy)) { if (dy < 0) this.onGround = true; this.vel.y = 0; }
    if (this.flying && this.onGround) this.flying = false;
    if (this.pos.y < -10) { this.spawn(); this.vel.set(0, 0, 0); }
    // walk animation + steps
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    this.walkCycle += hspeed * dt * 2.2; this.moving = hspeed > 0.5;
    if (this.moving && this.onGround) { this.stepTimer -= dt * hspeed; if (this.stepTimer <= 0) { this.stepTimer = 2.2; Sound.play('step'); } }
    if (!wasOnGround && this.onGround) Sound.play('step');
  }

  // ---------------- targeting / actions ----------------
  raycast() {
    const eye = new THREE.Vector3(this.pos.x, this.pos.y + EYE_H, this.pos.z);
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    let x = Math.floor(eye.x), y = Math.floor(eye.y), z = Math.floor(eye.z);
    const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);
    const tdx = Math.abs(1 / (dir.x || 1e-9)), tdy = Math.abs(1 / (dir.y || 1e-9)), tdz = Math.abs(1 / (dir.z || 1e-9));
    let tmx = (stepX > 0 ? (x + 1 - eye.x) : (eye.x - x)) * tdx, tmy = (stepY > 0 ? (y + 1 - eye.y) : (eye.y - y)) * tdy, tmz = (stepZ > 0 ? (z + 1 - eye.z) : (eye.z - z)) * tdz;
    let face = [0, 0, 0];
    for (let i = 0; i < 60; i++) {
      const id = this.world.getBlock(x, y, z);
      if (id !== B.AIR && id !== B.WATER) return { x, y, z, id, face };
      if (tmx < tmy && tmx < tmz) { if (tmx > 6) break; x += stepX; tmx += tdx; face = [-stepX, 0, 0]; }
      else if (tmy < tmz) { if (tmy > 6) break; y += stepY; tmy += tdy; face = [0, -stepY, 0]; }
      else { if (tmz > 6) break; z += stepZ; tmz += tdz; face = [0, 0, -stepZ]; }
    }
    return null;
  }
  updateActions(dt) {
    const hit = this.raycast();
    if (hit) { this.highlight.visible = true; this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); this.ui.target.textContent = BLOCKS[hit.id].name; }
    else { this.highlight.visible = false; this.ui.target.textContent = ''; }
    // breaking
    if (this.mouse.left && hit && !BLOCKS[hit.id].unbreakable) {
      if (!this.breaking || this.breaking.x !== hit.x || this.breaking.y !== hit.y || this.breaking.z !== hit.z) this.breaking = { x: hit.x, y: hit.y, z: hit.z, progress: 0 };
      const need = this.mode === 'creative' ? 0.05 : (BLOCKS[hit.id].hard || 1);
      this.breaking.progress += dt;
      this.ui.breakProg.classList.add('active'); this.ui.breakProg.firstElementChild.style.width = Math.min(100, this.breaking.progress / need * 100) + '%';
      if (this.breaking.progress >= need) {
        this.breakBlock(hit.x, hit.y, hit.z, hit.id); this.breaking = null; this.ui.breakProg.classList.remove('active');
      }
    } else { this.breaking = null; this.ui.breakProg.classList.remove('active'); }
    // placing
    this.placeCooldown -= dt;
    if (this.mouse.right && hit && this.placeCooldown <= 0) {
      this.placeCooldown = 0.22;
      const id = this.hotbar[this.slot];
      if (id && (this.mode === 'creative' || (this.inventory[id] || 0) > 0)) {
        const target = BLOCKS[hit.id].cross ? hit : { x: hit.x + hit.face[0], y: hit.y + hit.face[1], z: hit.z + hit.face[2] };
        if (target.y >= 1 && target.y < HEIGHT) {
          const existing = this.world.getBlock(target.x, target.y, target.z);
          const replaceable = existing === B.AIR || existing === B.WATER || BLOCKS[existing].cross;
          const overlapsPlayer = isSolid(id) && this.blockOverlapsPlayer(target.x, target.y, target.z);
          const needsSupport = BLOCKS[id].cross && !isSolid(this.world.getBlock(target.x, target.y - 1, target.z));
          if (replaceable && !overlapsPlayer && !needsSupport) {
            this.applyBlock(target.x, target.y, target.z, id);
            if (this.mode !== 'creative') { this.inventory[id]--; if (this.inventory[id] <= 0) { delete this.inventory[id]; } }
            this.updateHotbar(); Sound.play('place');
          }
        }
      }
    }
  }
  blockOverlapsPlayer(bx, by, bz) {
    const hw = PLAYER_W / 2;
    return bx + 1 > this.pos.x - hw && bx < this.pos.x + hw && by + 1 > this.pos.y && by < this.pos.y + PLAYER_H && bz + 1 > this.pos.z - hw && bz < this.pos.z + hw;
  }
  breakBlock(x, y, z, id) {
    this.applyBlock(x, y, z, B.AIR); Sound.play('break');
    const above = this.world.getBlock(x, y + 1, z); if (BLOCKS[above].cross) this.applyBlock(x, y + 1, z, B.AIR);
    if (this.mode === 'creative') return;
    const drop = BLOCKS[id].drop !== undefined ? BLOCKS[id].drop : id;
    if (drop) { this.inventory[drop] = (this.inventory[drop] || 0) + 1; this.autoHotbar(drop); this.updateHotbar(); }
  }
  applyBlock(x, y, z, id) { const dirty = this.world.setBlock(x, y, z, id); for (const [cx, cz] of dirty) this.dirty.add(World.key(cx, cz)); }
  autoHotbar(id) { if (this.hotbar.includes(id)) return; const free = this.hotbar.indexOf(0); if (free >= 0) this.hotbar[free] = id; }

  // ---------------- camera & model ----------------
  updateCamera() {
    const eye = new THREE.Vector3(this.pos.x, this.pos.y + EYE_H, this.pos.z);
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    if (this.firstPerson) {
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(dir)); this.bull.group.visible = false;
    } else {
      this.bull.group.visible = true;
      const maxDist = 4.5; let dist = maxDist;
      for (let d = 0.3; d <= maxDist; d += 0.2) {
        const p = eye.clone().addScaledVector(dir, -d);
        if (isSolid(this.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)))) { dist = Math.max(0.3, d - 0.35); break; }
      }
      this.camera.position.copy(eye).addScaledVector(dir, -dist);
      this.camera.lookAt(eye.clone().add(dir.clone().multiplyScalar(2)));
    }
    // bull model
    const g = this.bull.group; g.position.set(this.pos.x, this.pos.y, this.pos.z);
    let targetYaw = this.yaw;
    if (this.moving) { targetYaw = Math.atan2(-this.vel.x, -this.vel.z); }
    let d = targetYaw - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * 0.25;
    const swing = this.moving ? Math.sin(this.walkCycle) * 0.6 : 0;
    this.bull.legs[0].rotation.x = swing; this.bull.legs[3].rotation.x = swing; this.bull.legs[1].rotation.x = -swing; this.bull.legs[2].rotation.x = -swing;
    this.bull.head.rotation.x = Math.max(-0.5, Math.min(0.5, -this.pitch * 0.5));
    let hd = (this.yaw - g.rotation.y); hd = Math.atan2(Math.sin(hd), Math.cos(hd)); this.bull.head.rotation.y = Math.max(-0.9, Math.min(0.9, hd));
    this.bull.group.position.y += this.moving && this.onGround ? Math.abs(Math.sin(this.walkCycle)) * 0.05 : 0;
  }
  updateSky() {
    const ang = this.time * Math.PI * 2; const elev = Math.sin(ang);
    const dayAmt = THREE.MathUtils.smoothstep(elev, -0.12, 0.25);
    const dusk = 1 - Math.min(1, Math.abs(elev) / 0.25);
    const night = new THREE.Color(0x0a1026), day = new THREE.Color(0x78a7ff), sunset = new THREE.Color(0xff9a5a);
    const sky = night.clone().lerp(day, dayAmt).lerp(sunset, dusk * 0.45 * (elev > -0.2 ? 1 : 0));
    this.scene.background.copy(sky); this.scene.fog.color.copy(sky);
    const R = this.renderDistance * CHUNK; this.scene.fog.near = R * 0.55; this.scene.fog.far = R * 0.98;
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    this.sun.position.copy(sunDir).multiplyScalar(100).add(this.pos); this.sun.target.position.copy(this.pos); this.sun.target.updateMatrixWorld();
    this.sun.intensity = 0.15 + dayAmt * 1.1; this.ambient.intensity = 0.18 + dayAmt * 0.5; this.hemi.intensity = 0.1 + dayAmt * 0.35;
    this.sunMesh.position.copy(this.pos).addScaledVector(sunDir, 250); this.sunMesh.lookAt(this.pos);
    this.moonMesh.position.copy(this.pos).addScaledVector(sunDir, -250); this.moonMesh.lookAt(this.pos);
    this.stars.position.copy(this.pos); this.stars.material.opacity = 1 - dayAmt;
    const hour = Math.floor(((this.time + 0.25) % 1) * 24), min = Math.floor((((this.time + 0.25) % 1) * 24 % 1) * 60);
    this.ui.time.textContent = (elev > 0 ? '☀ ' : '☾ ') + String(hour).padStart(2, '0') + ':' + String(min).padStart(2, '0');
  }

  // ---------------- inventory UI ----------------
  buildHotbar() {
    this.ui.hotbar.innerHTML = '';
    this.slotEls = [];
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div'); s.className = 'slot'; s.dataset.i = i;
      s.addEventListener('click', () => { this.slot = i; this.updateHotbar(); });
      this.ui.hotbar.appendChild(s); this.slotEls.push(s);
    }
  }
  updateHotbar() {
    for (let i = 0; i < 9; i++) {
      const s = this.slotEls[i]; const id = this.hotbar[i]; s.innerHTML = ''; s.classList.toggle('selected', i === this.slot);
      if (id) {
        const cnt = this.mode === 'creative' ? '∞' : (this.inventory[id] || 0);
        if (this.mode !== 'creative' && !this.inventory[id]) { this.hotbar[i] = 0; continue; }
        s.appendChild(blockIcon(id)); const c = document.createElement('span'); c.className = 'count'; c.textContent = cnt; s.appendChild(c); s.title = BLOCKS[id].name;
      }
    }
    if (!this.ui.inv.classList.contains('hidden')) this.renderInventory();
  }
  toggleInventory(show) {
    const panel = this.ui.inv; const open = show === undefined ? panel.classList.contains('hidden') : show;
    panel.classList.toggle('hidden', !open);
    if (open) { this.invOpen = true; this.renderInventory(); this.keys = {}; this.mouse.left = this.mouse.right = false; this.breaking = null; this.ui.breakProg.classList.remove('active'); if (this.locked) document.exitPointerLock(); }
    else { this.invOpen = false; if (!this.isTouch && this.started) this.lock(); }
  }
  renderInventory() {
    const grid = this.ui.invGrid; grid.innerHTML = '';
    const ids = this.mode === 'creative' ? PLACEABLE : Object.keys(this.inventory).map(Number).filter(id => this.inventory[id] > 0);
    if (!ids.length) grid.innerHTML = '<p style="grid-column:1/-1">Nothing yet — go mine some blocks!</p>';
    for (const id of ids) {
      const s = document.createElement('div'); s.className = 'slot'; s.title = BLOCKS[id].name; s.appendChild(blockIcon(id));
      const c = document.createElement('span'); c.className = 'count'; c.textContent = this.mode === 'creative' ? '∞' : this.inventory[id]; s.appendChild(c);
      s.addEventListener('click', () => { this.hotbar[this.slot] = id; this.updateHotbar(); Sound.play('pickup'); });
      grid.appendChild(s);
    }
    const rc = this.ui.recipes; rc.innerHTML = '';
    for (const r of RECIPES) {
      const can = this.mode === 'creative' || r.input.every(([id, n]) => (this.inventory[id] || 0) >= n);
      const row = document.createElement('div'); row.className = 'recipe' + (can ? '' : ' disabled');
      r.input.forEach(([id, n], i) => { if (i) row.appendChild(document.createTextNode('+')); row.appendChild(blockIcon(id, 28)); row.appendChild(document.createTextNode('×' + n + ' ')); });
      const ar = document.createElement('span'); ar.className = 'arrow'; ar.textContent = '→'; row.appendChild(ar);
      row.appendChild(blockIcon(r.output[0], 28)); row.appendChild(document.createTextNode('×' + r.output[1] + ' ' + r.name));
      const btn = document.createElement('button'); btn.className = 'mc-btn mc-btn-small'; btn.textContent = 'Craft'; btn.disabled = !can;
      btn.addEventListener('click', () => this.craft(r)); row.appendChild(btn); rc.appendChild(row);
    }
  }
  craft(r) {
    if (this.mode !== 'creative') {
      if (!r.input.every(([id, n]) => (this.inventory[id] || 0) >= n)) return;
      for (const [id, n] of r.input) { this.inventory[id] -= n; if (this.inventory[id] <= 0) delete this.inventory[id]; }
      this.inventory[r.output[0]] = (this.inventory[r.output[0]] || 0) + r.output[1];
    }
    this.autoHotbar(r.output[0]); Sound.play('craft'); this.updateHotbar(); this.renderInventory(); this.toast('Crafted ' + r.output[1] + '× ' + r.name);
  }
  toggleMode() {
    this.mode = this.mode === 'survival' ? 'creative' : 'survival';
    this.ui.btnMode.textContent = this.mode === 'survival' ? 'Survival' : 'Creative';
    if (this.mode === 'creative') { this.hotbar = [B.GRASS, B.STONE, B.COBBLE, B.PLANKS, B.GLASS, B.BRICKS, B.GOLD, B.LOG, B.LEAVES]; }
    else { this.hotbar = this.hotbar.map(id => (this.inventory[id] || 0) > 0 ? id : 0); this.flying = false; }
    this.updateHotbar(); this.toast(this.mode === 'creative' ? 'Creative mode: unlimited blocks' : 'Survival mode');
    if (!this.isTouch && this.started && !this.locked && this.ui.inv.classList.contains('hidden')) this.lock();
  }

  // ---------------- main loop ----------------
  loop(t) {
    requestAnimationFrame(tt => this.loop(tt));
    const dt = Math.min(0.05, (t - (this.frameTime || t)) / 1000); this.frameTime = t;
    this.updateChunks();
    if (!this.started && this.nearbyReady()) { this.ui.btnPlay.disabled = false; this.ui.overlayText.textContent = 'World ready. You are the bull. Mine, build, explore!'; }
    if (this.running && !this.invOpen) {
      this.time = (this.time + dt / DAY_LENGTH) % 1;
      this.updatePlayer(dt); this.updateActions(dt);
      if (performance.now() - this.lastSave > 15000) this.save();
      this.ui.coords.textContent = 'XYZ: ' + Math.floor(this.pos.x) + ' ' + Math.floor(this.pos.y) + ' ' + Math.floor(this.pos.z) + (this.flying ? ' ✈' : '');
    }
    this.updateCamera(); this.updateSky();
    this.renderer.render(this.scene, this.camera);
  }
}

function boot() { try { window.bullcraft = new Game(); } catch (e) { console.error(e); const t = document.getElementById('overlayText'); if (t) t.textContent = 'Could not start the game: ' + e.message; } }
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot); else boot();
