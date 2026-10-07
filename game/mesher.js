/* Chunk mesher with per-vertex AO + smooth light, and the chunk shader material */
import * as THREE from 'three';
import { CHUNK, HEIGHT, B, REG, isOpaque } from './constants.js';
import { World } from './world.js';
import { TILE_INDEX, ATLAS_COLS, ATLAS_ROWS } from './textures.js';

const FACES = [];
(function build() {
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
    FACES.push({ dir, slot: d.slot, corners, shade: d.shade, t1: d.t1, t2: d.t2 });
  }
})();
const UV_EPS = 0.002;
const OPQ = new Uint8Array(256); for (const id in REG) OPQ[id] = isOpaque(+id) ? 1 : 0;
function tileUV(tile, u, v) {
  const col = tile % ATLAS_COLS, row = Math.floor(tile / ATLAS_COLS);
  return [(col + UV_EPS + u * (1 - 2 * UV_EPS)) / ATLAS_COLS, 1 - (row + UV_EPS + (1 - v) * (1 - 2 * UV_EPS)) / ATLAS_ROWS];
}

export function buildChunkMesh(world, cx, cz) {
  const data = world.getChunk(cx, cz); const lightArr = world.getLightArray(cx, cz);
  const ox = cx * CHUNK, oz = cz * CHUNK;
  const solid = { pos: [], uv: [], col: [], light: [], idx: [] }, water = { pos: [], uv: [], col: [], light: [], idx: [] };
  const get = (x, y, z) => {
    if (y < 0 || y >= HEIGHT) return B.AIR;
    if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK) return data[World.idx(x, y, z)];
    return world.getBlock(ox + x, y, oz + z);
  };
  const getL = (x, y, z) => {
    if (y >= HEIGHT) return 0xF0; if (y < 0) return 0;
    if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK) return lightArr[World.idx(x, y, z)];
    return world.getLight(ox + x, y, oz + z);
  };
  const pushQuad = (buf, pts, uvs, cols, lights) => {
    const base = buf.pos.length / 3;
    for (let i = 0; i < 4; i++) { buf.pos.push(pts[i][0], pts[i][1], pts[i][2]); buf.uv.push(uvs[i][0], uvs[i][1]); buf.col.push(cols[i]); buf.light.push(lights[i][0], lights[i][1]); }
    if (cols[0] + cols[2] > cols[1] + cols[3]) buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else buf.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
  };
  const lightOf = (x, y, z) => { const l = getL(x, y, z); return [(l >> 4) / 15, (l & 15) / 15]; };
  for (let x = 0; x < CHUNK; x++) for (let z = 0; z < CHUNK; z++) for (let y = 0; y < HEIGHT; y++) {
    const id = data[World.idx(x, y, z)]; if (id === B.AIR) continue;
    const bl = REG[id];
    if (bl.cross) {
      const tile = TILE_INDEX[bl.tiles[0]]; const c = 0.9; const L = lightOf(x, y, z); const Ls = [L, L, L, L];
      const inset = bl.torch ? 0.25 : 0;
      const quads = [[[inset, 0, inset], [1 - inset, 0, 1 - inset], [1 - inset, 1, 1 - inset], [inset, 1, inset]], [[1 - inset, 0, inset], [inset, 0, 1 - inset], [inset, 1, 1 - inset], [1 - inset, 1, inset]]];
      for (const q of quads) {
        const pts = q.map(p => [ox + x + p[0], y + p[1], oz + z + p[2]]);
        const uvs = [tileUV(tile, 0, 0), tileUV(tile, 1, 0), tileUV(tile, 1, 1), tileUV(tile, 0, 1)];
        pushQuad(solid, pts, uvs, [c, c, c, c], Ls);
        pushQuad(solid, [pts[3], pts[2], pts[1], pts[0]], [uvs[3], uvs[2], uvs[1], uvs[0]], [c, c, c, c], Ls);
      }
      continue;
    }
    for (const f of FACES) {
      const nx = x + f.dir[0], ny = y + f.dir[1], nz = z + f.dir[2];
      const n = get(nx, ny, nz);
      if (bl.liquid) { if (n === id || OPQ[n]) continue; }
      else if (OPQ[n] || (n === id && bl.cutout)) continue;
      const tile = TILE_INDEX[bl.tiles[f.slot]];
      const pts = [], uvs = [], cols = [], lights = [];
      const top = bl.liquid && f.slot === 2 && n === B.AIR ? 0.875 : 1;
      const nl = getL(nx, ny, nz);
      for (const c of f.corners) {
        pts.push([ox + x + c.p[0], y + c.p[1] * top, oz + z + c.p[2]]);
        uvs.push(tileUV(tile, c.u, c.v));
        if (bl.liquid) { cols.push(f.shade); lights.push([(nl >> 4) / 15, (nl & 15) / 15]); continue; }
        // neighbours around this vertex (in the plane of the face)
        const t1 = f.t1, t2 = f.t2;
        const ax = nx + (t1 === 0 ? c.s1 : t2 === 0 ? c.s2 : 0), ay = ny + (t1 === 1 ? c.s1 : t2 === 1 ? c.s2 : 0), az = nz + (t1 === 2 ? c.s1 : t2 === 2 ? c.s2 : 0);
        const o1x = nx + (t1 === 0 ? c.s1 : 0), o1y = ny + (t1 === 1 ? c.s1 : 0), o1z = nz + (t1 === 2 ? c.s1 : 0);
        const o2x = nx + (t2 === 0 ? c.s2 : 0), o2y = ny + (t2 === 1 ? c.s2 : 0), o2z = nz + (t2 === 2 ? c.s2 : 0);
        const s1 = OPQ[get(o1x, o1y, o1z)], s2 = OPQ[get(o2x, o2y, o2z)], s3 = OPQ[get(ax, ay, az)];
        const ao = (s1 && s2) ? 0 : 3 - (s1 + s2 + s3);
        cols.push(f.shade * (0.5 + ao * 0.1667));
        let sk = nl >> 4, bk = nl & 15, cnt = 1, l;
        if (!s1) { l = getL(o1x, o1y, o1z); sk += l >> 4; bk += l & 15; cnt++; }
        if (!s2) { l = getL(o2x, o2y, o2z); sk += l >> 4; bk += l & 15; cnt++; }
        if (!s3 && !(s1 && s2)) { l = getL(ax, ay, az); sk += l >> 4; bk += l & 15; cnt++; }
        lights.push([sk / cnt / 15, bk / cnt / 15]);
      }
      pushQuad(bl.liquid ? water : solid, pts, uvs, cols, lights);
    }
  }
  const mk = buf => {
    if (!buf.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
    g.setAttribute('shade', new THREE.Float32BufferAttribute(buf.col, 1));
    g.setAttribute('light', new THREE.Float32BufferAttribute(buf.light, 2));
    g.setIndex(buf.idx); g.computeBoundingSphere();
    return g;
  };
  return { solid: mk(solid), water: mk(water) };
}

export function makeChunkMaterial(atlas, opts = {}) {
  const uniforms = {
    map: { value: atlas }, dayLight: { value: 1 }, fogColor: { value: new THREE.Color(0x78a7ff) }, fogNear: { value: 40 }, fogFar: { value: 90 },
    opacity: { value: opts.water ? 0.78 : 1 }, time: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute float shade; attribute vec2 light;
      varying vec2 vUv; varying float vShade; varying vec2 vLight; varying float vDepth;
      void main() { vUv = uv; vShade = shade; vLight = light; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform sampler2D map; uniform float dayLight; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float opacity;
      varying vec2 vUv; varying float vShade; varying vec2 vLight; varying float vDepth;
      void main() {
        vec4 t = texture2D(map, vUv);
        ${opts.water ? '' : 'if (t.a < 0.5) discard;'}
        float sky = vLight.x * dayLight; float bl = vLight.y;
        float l = max(sky, bl);
        float b = 0.045 + 0.955 * pow(l, 1.5);
        vec3 warm = mix(vec3(1.0), vec3(1.0, 0.88, 0.7), clamp(bl - sky, 0.0, 1.0) * 0.8);
        vec3 col = t.rgb * vShade * b * warm;
        float f = smoothstep(fogNear, fogFar, vDepth);
        col = mix(col, fogColor, f);
        gl_FragColor = vec4(col, t.a * opacity);
        #include <colorspace_fragment>
      }`,
    transparent: !!opts.water, depthWrite: !opts.water, side: opts.water ? THREE.DoubleSide : THREE.FrontSide,
  });
  return mat;
}
