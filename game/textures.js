/* Procedural texture atlas, item icons and destroy-stage textures */
import * as THREE from 'three';
import { REG, B } from './constants.js';
import { hash2 } from './noise.js';

export const TILE = 16, ATLAS_COLS = 8, ATLAS_ROWS = 8;
export const TILE_NAMES = ['grass_top', 'grass_side', 'dirt', 'stone', 'cobble', 'log', 'log_top', 'leaves', 'planks', 'sand', 'gravel', 'water', 'glass', 'poppy', 'dandelion', 'tallgrass',
  'gold_block', 'iron_block', 'diamond_block', 'bedrock', 'craft_top', 'craft_side', 'furnace_top', 'furnace_side', 'furnace_front', 'furnace_front_lit', 'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'torch', 'snow',
  'stone_bricks', 'chest_top', 'chest_side', 'chest_front', 'lava', 'glowstone', 'bookshelf'];
export const TILE_INDEX = {}; TILE_NAMES.forEach((n, i) => TILE_INDEX[n] = i);
export const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = TILE * ATLAS_COLS; atlasCanvas.height = TILE * ATLAS_ROWS;

const rngFor = seed => { let s = (seed * 7919 + 13) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const noisy = (c, a) => (x, y, r) => { const n = (r() - 0.5) * a; return [c[0] + n, c[1] + n, c[2] + n]; };
const grassTop = noisy([93, 158, 59], 44), dirt = noisy([121, 85, 61], 44), sand = noisy([219, 211, 160], 30);
const stone = (x, y, r) => { const v = r(); const b = v < 0.12 ? 100 : v > 0.88 ? 145 : 127; const n = (r() - 0.5) * 14; return [b + n, b + n, b + n]; };
const planks = (x, y, r) => { const line = (y % 4 === 3) ? -40 : 0; const sep = (y < 4 && x === 3) || (y >= 4 && y < 8 && x === 11) || (y >= 8 && y < 12 && x === 5) || (y >= 12 && x === 13) ? -40 : 0; const n = (r() - 0.5) * 18; return [168 + line + sep + n, 130 + line + sep + n, 79 + line + sep + n]; };
const ore = (color, seed, density = 0.22) => (x, y, r) => { const s = stone(x, y, r); return hash2(x, y, seed) < density && ((x * 3 + y * 5) % 4 !== 0) ? color : s; };
const metalBlock = (c, hi) => (x, y, r) => { const edge = x === 0 || y === 0 || x === 15 || y === 15; const n = (r() - 0.5) * 20; if (edge) return [c[0] * 0.72 + n, c[1] * 0.72 + n, c[2] * 0.72 + n]; if ((x + y) % 7 === 0) return hi; return [c[0] + n, c[1] + n, c[2] + n]; };
const flower = petal => (x, y) => {
  if (y >= 9 && y <= 15 && x === 7) return [40, 120, 30, 255];
  if ((y === 10 && x === 8) || (y === 11 && x === 6)) return [40, 120, 30, 255];
  const d = Math.abs(x - 7) + Math.abs(y - 6);
  if (x === 7 && y === 6) return [40, 40, 20, 255];
  if (d <= 2 && !(d === 2 && (x === 7 || y === 6))) return petal.concat(255);
  if (d <= 3 && (x === 7 || y === 6)) return petal.concat(255);
  return [0, 0, 0, 0];
};
const furnaceSide = (x, y, r) => { const s = stone(x, y, r); const edge = x === 0 || y === 0 || x === 15 || y === 15; return edge ? [s[0] - 30, s[1] - 30, s[2] - 30] : s; };
const furnaceFront = lit => (x, y, r) => { const s = furnaceSide(x, y, r); if (y >= 7 && y <= 13 && x >= 4 && x <= 11) { if (lit) { const f = hash2(x, y, 9) < 0.5; return y > 10 ? (f ? [255, 190, 60] : [255, 120, 20]) : (f ? [40, 20, 10] : [255, 150, 40]); } return y > 10 ? [25, 25, 25] : [60, 60, 60]; } return s; };
const chestSide = (x, y, r) => { const n = (r() - 0.5) * 14; const edge = x === 0 || y === 0 || x === 15 || y === 15; if (edge) return [70 + n, 45 + n, 20 + n]; if (y === 5) return [95 + n, 62 + n, 30 + n]; return [160 + n, 108 + n, 50 + n]; };
const TILE_GEN = {
  grass_top: grassTop,
  grass_side: (x, y, r) => { const edge = 3 + Math.floor(r() * 2); return y < edge ? grassTop(x, y, r) : dirt(x, y, r); },
  dirt, stone, sand, planks,
  cobble: (x, y, r) => { let best = 99; for (let cy = -1; cy <= 2; cy++) for (let cx = -1; cx <= 2; cx++) { const sx = cx * 8 + 4 + hash2(cx, cy, 21) * 3 - 1.5, sy = cy * 8 + 4 + hash2(cx, cy, 22) * 3 - 1.5; const d = Math.hypot(x - sx, y - sy); if (d < best) best = d; } const n = (r() - 0.5) * 16; const b = best > 4.3 ? 78 : best > 3.3 ? 104 : 134; return [b + n, b + n, b + n]; },
  log: (x, y, r) => { const stripe = (x % 4 === 0) ? -18 : (x % 4 === 2 ? 10 : 0); const n = (r() - 0.5) * 20; return [107 + stripe + n, 79 + stripe + n, 46 + stripe + n]; },
  log_top: (x, y, r) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); const ring = Math.floor(d) % 2 === 0 ? 12 : -10; const n = (r() - 0.5) * 14; return d < 2 ? [120 + n, 90 + n, 55 + n] : d > 6.5 ? [96 + n, 70 + n, 40 + n] : [170 + ring + n, 135 + ring + n, 85 + ring + n]; },
  leaves: (x, y, r) => { const v = r(); if (v < 0.13) return [0, 0, 0, 0]; const n = (r() - 0.5) * 50; return [50 + n, 125 + n, 40 + n, 255]; },
  gravel: (x, y, r) => { const v = r(); const b = v < 0.3 ? 95 : v < 0.6 ? 125 : v < 0.85 ? 150 : 110; return [b + 6, b, b - 6]; },
  water: (x, y, r) => { const n = (r() - 0.5) * 30; return [50 + n, 110 + n, 225 + n, 175]; },
  lava: (x, y, r) => { const n = r(); const hot = hash2(x >> 1, y >> 1, 31) < 0.4; return hot ? [255, 200 + n * 40, 60] : [220 + n * 30, 90 + n * 40, 20]; },
  glass: (x, y) => { const edge = x === 0 || y === 0 || x === 15 || y === 15; if (edge) return [220, 235, 245, 255]; if ((x === 2 && y < 6) || (y === 2 && x < 6)) return [255, 255, 255, 200]; return [200, 230, 255, 35]; },
  poppy: flower([225, 40, 40]), dandelion: flower([240, 215, 60]),
  tallgrass: (x, y) => { const blades = [[3, 6], [5, 3], [7, 2], [9, 4], [11, 5], [13, 8], [1, 9]]; for (const [bx, top] of blades) { if ((x === bx || (x === bx + 1 && y > top + 3)) && y >= top && y <= 15) return [70 + y * 4, 150 + y * 3, 45, 255]; } return [0, 0, 0, 0]; },
  gold_block: metalBlock([245, 200, 66], [255, 240, 160]), iron_block: metalBlock([220, 220, 220], [255, 255, 255]), diamond_block: metalBlock([80, 225, 220], [200, 255, 255]),
  bedrock: (x, y, r) => { const v = r(); const b = v < 0.4 ? 40 : v < 0.8 ? 75 : 110; return [b, b, b]; },
  craft_top: (x, y, r) => { const grid = (x === 4 || x === 8 || x === 12 || y === 4 || y === 8 || y === 12) ? -45 : 0; const n = (r() - 0.5) * 16; return [170 + grid + n, 132 + grid + n, 80 + grid + n]; },
  craft_side: (x, y, r) => { const tool = (y > 3 && y < 7 && x > 2 && x < 7) || (y > 8 && y < 13 && x > 9 && x < 14) || (y > 6 && y < 10 && x === 8); const n = (r() - 0.5) * 16; return tool ? [60, 60, 60] : [160 + n, 122 + n, 72 + n]; },
  furnace_top: stone, furnace_side: furnaceSide, furnace_front: furnaceFront(false), furnace_front_lit: furnaceFront(true),
  coal_ore: ore([30, 30, 30], 5), iron_ore: ore([215, 170, 140], 6), gold_ore: ore([245, 205, 70], 7), diamond_ore: ore([90, 230, 225], 8, 0.18),
  torch: (x, y) => { if (x >= 7 && x <= 8 && y >= 6 && y <= 15) return [120, 85, 45, 255]; if (x >= 6 && x <= 9 && y >= 3 && y <= 6) return (y <= 4 ? [255, 230, 120, 255] : [255, 160, 40, 255]); return [0, 0, 0, 0]; },
  snow: noisy([240, 244, 250], 18),
  stone_bricks: (x, y, r) => { const row = Math.floor(y / 8); const off = row % 2 ? 4 : 0; const mortar = (y % 8 === 7) || ((x + off) % 8 === 7); const n = (r() - 0.5) * 16; return mortar ? [85 + n, 85 + n, 85 + n] : [135 + n, 135 + n, 135 + n]; },
  chest_top: chestSide, chest_side: chestSide,
  chest_front: (x, y, r) => { const c = chestSide(x, y, r); if (x >= 6 && x <= 9 && y >= 4 && y <= 8) return [120, 120, 120]; return c; },
  glowstone: (x, y, r) => { const v = r(); return v < 0.3 ? [255, 240, 170] : v < 0.7 ? [230, 190, 90] : [190, 140, 60]; },
  bookshelf: (x, y, r) => { if (y < 2 || y > 13 || (y >= 7 && y <= 8)) return planks(x, y, r); const c = [[150, 40, 40], [40, 80, 160], [60, 130, 60], [200, 170, 60], [120, 60, 150]][Math.floor(hash2(x >> 1, y < 7 ? 0 : 1, 4) * 5)]; return (x % 2 === 0) ? c : [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7]; },
};

export function buildAtlas() {
  const ctx = atlasCanvas.getContext('2d');
  TILE_NAMES.forEach((name, idx) => {
    const fn = TILE_GEN[name]; const img = ctx.createImageData(TILE, TILE); const r = rngFor(idx + 1);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const p = fn(x, y, r) || [0, 0, 0, 0]; const i = (y * TILE + x) * 4;
      img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2]; img.data[i + 3] = p.length > 3 ? p[3] : 255;
    }
    ctx.putImageData(img, (idx % ATLAS_COLS) * TILE, Math.floor(idx / ATLAS_COLS) * TILE);
  });
  const tex = new THREE.CanvasTexture(atlasCanvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export function tileOf(id, face) { const t = REG[id].tiles; return TILE_INDEX[t[face]]; }

// ---- Item icons (pixel-art patterns) ----
const P = {
  stick: ['................', '..........hh....', '.........hhh....', '........hhh.....', '.......hhh......', '......hhh.......', '.....hhh........', '....hhh.........', '...hhh..........', '..hhh...........', '.hhh............', '.hh.............', '................', '................', '................', '................'],
  pickaxe: ['................', '....MMMMMMM.....', '...MMMMMMMMMM...', '..MMM.....MMMM..', '..MM.....h.MMM..', '..M.....hh..MM..', '.......hhh...M..', '......hhh.......', '.....hhh........', '....hhh.........', '...hhh..........', '..hhh...........', '.hh.............', '................', '................', '................'],
  axe: ['................', '.....MMMM.......', '....MMMMMM......', '...MMMMMMMM.....', '...MMMM.hMM.....', '...MMM.hhhM.....', '....M.hhh.......', '.....hhh........', '....hhh.........', '...hhh..........', '..hhh...........', '.hhh............', '.hh.............', '................', '................', '................'],
  shovel: ['................', '.........MMM....', '........MMMMM...', '........MMMMM...', '........MMMM....', '.......hhMM.....', '......hhh.......', '.....hhh........', '....hhh.........', '...hhh..........', '..hhh...........', '.hhh............', '.hh.............', '................', '................', '................'],
  sword: ['...........MM...', '..........MMM...', '.........MMM....', '........MMM.....', '.......MMM......', '......MMM.......', '.h...MMM........', '.hh.MMM.........', '..hhMM..........', '...hh...........', '..hhhh..........', '.hh..hh.........', 'hh..............', '................', '................', '................'],
  ingot: ['................', '................', '................', '................', '....MMMMMMMM....', '...MLLLLLLLMM...', '..MMLLLLLLLMMM..', '..MMMMMMMMMMMM..', '.MMMMMMMMMMMMM..', '.MMDDDDDDDDDDD..', '.MDDDDDDDDDDD...', '................', '................', '................', '................', '................'],
  diamond: ['................', '................', '......LLLL......', '.....LLLLLL.....', '....LLMMMMLL....', '...LLMMMMMMLL...', '...MMMMMMMMMM...', '...DMMMMMMMMD...', '....DMMMMMMD....', '.....DMMMMD.....', '......DMMD......', '.......DD.......', '................', '................', '................', '................'],
  coal: ['................', '................', '......kkkk......', '....kkkkkkkk....', '...kkkgkkkkkk...', '...kkggkkkkkkk..', '..kkkkkkkkkkkk..', '..kkkkkkkgkkkk..', '..kkkkkkkkkkkk..', '...kkkkkkkkkk...', '....kkkkkkkk....', '......kkkk......', '................', '................', '................', '................'],
  apple: ['................', '........ss......', '.......ss.gg....', '.......s.gg.....', '....MMMMMMMM....', '...MMLMMMMMMM...', '..MMLMMMMMMMMM..', '..MMMMMMMMMMMM..', '..MMMMMMMMMMMM..', '..MMMMMMMMMMMM..', '...MMMMMMMMMM...', '...MMMMMMMMMM...', '....MMM..MMM....', '................', '................', '................'],
  meat: ['................', '................', '....MMMMMMM.....', '...MMMLLMMMMM...', '..MMLLLMMMMMMM..', '..MMLLMMMMMMMM..', '..MMMMMMMMMMMM..', '..MMMMMMMMMMMM..', '...MMMMMMMDDD...', '....MMMMMDDD....', '.....MMMDDD.....', '......DDDD......', '................', '................', '................', '................'],
  leather: ['................', '................', '.....bbbb.......', '...bbbbbbbb.....', '..bbbbbbbbbbb...', '..bbbbbbbbbbbb..', '..bbbbbbbbbbbb..', '...bbbbbbbbbbb..', '....bbbbbbbbb...', '.....bbbbbbb....', '......bbbbb.....', '................', '................', '................', '................', '................'],
  bread: ['................', '................', '................', '......ccccc.....', '....ccccccccc...', '...ccLLcccccccc.', '..ccLLcccccccccc', '..cccccccccccc..', '...ccccccccccc..', '....ccccccccc...', '......ccccc.....', '................', '................', '................', '................', '................'],
};
const BASE_COLORS = { h: [139, 90, 43], L: [255, 255, 255], D: null, k: [35, 35, 35], g: [60, 140, 50], s: [100, 70, 40], b: [170, 110, 60], c: [205, 150, 80] };
export function itemIcon(id, size = 32) {
  const def = REG[id]; const c = document.createElement('canvas'); c.width = size; c.height = size; const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  if (def.block) {
    // isometric-ish cube: top + two sides
    const top = tileOf(id, 2), side = tileOf(id, 4), side2 = tileOf(id, 0);
    const sx = t => (t % ATLAS_COLS) * TILE, sy = t => Math.floor(t / ATLAS_COLS) * TILE;
    if (def.cross) { ctx.drawImage(atlasCanvas, sx(side), sy(side), TILE, TILE, 0, 0, size, size); return c; }
    const s = size;
    ctx.save(); ctx.translate(s / 2, s * 0.27); ctx.transform(1, 0.5, -1, 0.5, 0, 0); ctx.drawImage(atlasCanvas, sx(top), sy(top), TILE, TILE, -s * 0.33, -s * 0.33, s * 0.66, s * 0.66); ctx.restore();
    ctx.save(); ctx.translate(s * 0.03, s * 0.42); ctx.transform(1, 0.5, 0, 1, 0, 0); ctx.globalAlpha = 0.8; ctx.drawImage(atlasCanvas, sx(side), sy(side), TILE, TILE, 0, 0, s * 0.47, s * 0.47); ctx.restore();
    ctx.save(); ctx.translate(s / 2, s * 0.655); ctx.transform(1, -0.5, 0, 1, 0, 0); ctx.globalAlpha = 0.6; ctx.drawImage(atlasCanvas, sx(side2), sy(side2), TILE, TILE, 0, 0, s * 0.47, s * 0.47); ctx.restore();
    return c;
  }
  const pat = P[def.icon] || P.stick; const M = def.color || [200, 200, 200]; const img = ctx.createImageData(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ch = pat[y][x]; if (!ch || ch === '.') continue; let col;
    if (ch === 'M') col = M; else if (ch === 'L') col = [Math.min(255, M[0] + 70), Math.min(255, M[1] + 70), Math.min(255, M[2] + 70)]; else if (ch === 'D') col = [M[0] * 0.6, M[1] * 0.6, M[2] * 0.6]; else col = BASE_COLORS[ch] || M;
    const i = (y * 16 + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
  }
  const tmp = document.createElement('canvas'); tmp.width = 16; tmp.height = 16; tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.drawImage(tmp, 0, 0, size, size); return c;
}
const iconCache = new Map();
export function iconFor(id, size = 32) { const k = id + ':' + size; let c = iconCache.get(k); if (!c) { c = itemIcon(id, size); iconCache.set(k, c); } return c; }
export function iconClone(id, size = 32) { const src = iconFor(id, size); const c = document.createElement('canvas'); c.width = size; c.height = size; c.getContext('2d').drawImage(src, 0, 0); return c; }

// ---- Destroy stages ----
export function buildDestroyTextures() {
  const list = [];
  for (let stage = 0; stage < 10; stage++) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; const ctx = c.getContext('2d'); const img = ctx.createImageData(16, 16); const r = rngFor(500 + stage);
    const cracks = 1 + stage * 1.6;
    for (let k = 0; k < cracks; k++) {
      let x = 8, y = 8; const len = 3 + stage; let dx = r() < 0.5 ? 1 : -1, dy = r() < 0.5 ? 1 : -1;
      for (let s = 0; s < len; s++) {
        const i = ((y & 15) * 16 + (x & 15)) * 4; img.data[i] = 20; img.data[i + 1] = 20; img.data[i + 2] = 20; img.data[i + 3] = 170 + stage * 8;
        if (r() < 0.5) x += dx; else y += dy; if (r() < 0.15) dx = -dx; if (r() < 0.15) dy = -dy;
        if (x < 0 || x > 15 || y < 0 || y > 15) break;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; list.push(t);
  }
  return list;
}
export function blockTexturePreview(id) { return iconFor(id, 32); }
export { B };
