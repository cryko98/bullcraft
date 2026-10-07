/* Voxel-style models: bull (player), cow, pig, zombie, item entities */
import * as THREE from 'three';
import { REG } from './constants.js';
import { tileOf, ATLAS_COLS, ATLAS_ROWS, iconFor } from './textures.js';

const matCache = new Map();
function mat(hex) { const m = new THREE.MeshLambertMaterial({ color: hex }); m.userData.base = new THREE.Color(hex); return m; }
function box(w, h, d, m, x, y, z, parent) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); parent.add(mesh); return mesh; }

export function setModelLight(group, b, hurt = 0) {
  group.traverse(o => { if (o.isMesh && o.material.userData.base) { const c = o.material.userData.base; o.material.color.setRGB(Math.min(1, c.r * b + hurt), c.g * b * (1 - hurt), c.b * b * (1 - hurt)); } });
}

export function buildBull() {
  const g = new THREE.Group();
  const body = mat(0x5a5048), light = mat(0x9a948c), muzzle = mat(0xd2cdc4), horn = mat(0x8f887c), dark = mat(0x1a1a1a), hoof = mat(0x2b2824), pink = mat(0xd98c9c);
  box(0.72, 0.66, 1.15, body, 0, 0.92, 0.05, g);
  box(0.3, 0.28, 0.02, light, 0.1, 0.95, -0.53, g); box(0.02, 0.3, 0.4, light, 0.37, 1.0, 0.2, g); box(0.02, 0.25, 0.3, light, -0.37, 0.85, -0.1, g);
  box(0.25, 0.02, 0.35, light, -0.15, 1.26, 0.25, g); box(0.3, 0.02, 0.25, light, 0.12, 1.26, -0.2, g); box(0.3, 0.2, 0.02, light, -0.05, 0.8, 0.63, g);
  box(0.3, 0.02, 0.3, pink, 0, 0.585, 0.25, g);
  const head = new THREE.Group(); head.position.set(0, 1.12, -0.6); g.add(head);
  box(0.5, 0.5, 0.45, body, 0, 0, -0.1, head);
  box(0.36, 0.22, 0.06, muzzle, 0, -0.12, -0.35, head);
  box(0.06, 0.05, 0.02, dark, -0.1, -0.1, -0.385, head); box(0.06, 0.05, 0.02, dark, 0.1, -0.1, -0.385, head);
  box(0.07, 0.07, 0.02, dark, -0.15, 0.1, -0.335, head); box(0.07, 0.07, 0.02, dark, 0.15, 0.1, -0.335, head);
  box(0.08, 0.06, 0.03, light, -0.15, 0.1, -0.33, head); box(0.08, 0.06, 0.03, light, 0.15, 0.1, -0.33, head);
  box(0.22, 0.1, 0.1, horn, -0.3, 0.18, -0.05, head); box(0.22, 0.1, 0.1, horn, 0.3, 0.18, -0.05, head);
  box(0.1, 0.16, 0.1, horn, -0.36, 0.3, -0.05, head); box(0.1, 0.16, 0.1, horn, 0.36, 0.3, -0.05, head);
  box(0.16, 0.08, 0.06, body, -0.3, 0.03, 0.05, head); box(0.16, 0.08, 0.06, body, 0.3, 0.03, 0.05, head);
  const legs = [];
  for (const [x, z] of [[-0.22, -0.38], [0.22, -0.38], [-0.22, 0.42], [0.22, 0.42]]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.62, z); g.add(leg);
    box(0.24, 0.62, 0.24, body, 0, -0.31, 0, leg); box(0.25, 0.1, 0.25, hoof, 0, -0.57, 0, leg); legs.push(leg);
  }
  box(0.06, 0.35, 0.06, body, 0, 1.05, 0.65, g);
  return { group: g, head, legs, arm: null };
}

export function buildMob(type) {
  const g = new THREE.Group(); const legs = []; let head, arms = [];
  if (type === 'cow') {
    const body = mat(0x4a3b2e), light = mat(0xb9b0a6), muzzle = mat(0xd2cdc4), horn = mat(0x8f887c), dark = mat(0x1a1a1a);
    box(0.72, 0.66, 1.15, body, 0, 0.92, 0.05, g);
    box(0.3, 0.28, 0.02, light, 0.1, 0.95, -0.53, g); box(0.02, 0.3, 0.4, light, 0.37, 1.0, 0.2, g); box(0.02, 0.25, 0.3, light, -0.37, 0.85, -0.1, g); box(0.25, 0.02, 0.35, light, -0.15, 1.26, 0.25, g);
    head = new THREE.Group(); head.position.set(0, 1.12, -0.6); g.add(head);
    box(0.5, 0.5, 0.45, body, 0, 0, -0.1, head); box(0.36, 0.22, 0.06, muzzle, 0, -0.12, -0.35, head);
    box(0.07, 0.07, 0.02, dark, -0.15, 0.1, -0.335, head); box(0.07, 0.07, 0.02, dark, 0.15, 0.1, -0.335, head);
    box(0.16, 0.08, 0.08, horn, -0.3, 0.2, -0.05, head); box(0.16, 0.08, 0.08, horn, 0.3, 0.2, -0.05, head);
    for (const [x, z] of [[-0.22, -0.38], [0.22, -0.38], [-0.22, 0.42], [0.22, 0.42]]) { const leg = new THREE.Group(); leg.position.set(x, 0.62, z); g.add(leg); box(0.24, 0.62, 0.24, body, 0, -0.31, 0, leg); legs.push(leg); }
  } else if (type === 'pig') {
    const body = mat(0xf0a0a0), nose = mat(0xe07c8a), dark = mat(0x1a1a1a);
    box(0.62, 0.5, 1.0, body, 0, 0.6, 0.05, g);
    head = new THREE.Group(); head.position.set(0, 0.7, -0.5); g.add(head);
    box(0.5, 0.5, 0.5, body, 0, 0, -0.1, head); box(0.24, 0.16, 0.06, nose, 0, -0.08, -0.37, head);
    box(0.06, 0.06, 0.02, dark, -0.14, 0.1, -0.35, head); box(0.06, 0.06, 0.02, dark, 0.14, 0.1, -0.35, head);
    for (const [x, z] of [[-0.2, -0.3], [0.2, -0.3], [-0.2, 0.35], [0.2, 0.35]]) { const leg = new THREE.Group(); leg.position.set(x, 0.36, z); g.add(leg); box(0.24, 0.36, 0.24, body, 0, -0.18, 0, leg); legs.push(leg); }
  } else { // zombie
    const skin = mat(0x5f9a4f), shirt = mat(0x2c8aa8), pants = mat(0x3f3f8f), dark = mat(0x1a1a1a);
    box(0.5, 0.75, 0.25, shirt, 0, 1.1, 0, g);
    head = new THREE.Group(); head.position.set(0, 1.5, 0); g.add(head);
    box(0.5, 0.5, 0.5, skin, 0, 0.25, 0, head);
    box(0.08, 0.08, 0.02, dark, -0.12, 0.3, -0.26, head); box(0.08, 0.08, 0.02, dark, 0.12, 0.3, -0.26, head); box(0.2, 0.05, 0.02, dark, 0, 0.1, -0.26, head);
    for (const x of [-0.33, 0.33]) { const arm = new THREE.Group(); arm.position.set(x, 1.45, 0); g.add(arm); box(0.22, 0.72, 0.22, skin, 0, -0.36, 0, arm); arm.rotation.x = -Math.PI / 2; arms.push(arm); }
    for (const x of [-0.13, 0.13]) { const leg = new THREE.Group(); leg.position.set(x, 0.72, 0); g.add(leg); box(0.24, 0.72, 0.24, pants, 0, -0.36, 0, leg); legs.push(leg); }
  }
  return { group: g, head, legs, arms };
}

const planeGeo = new THREE.PlaneGeometry(0.4, 0.4);
const iconTexCache = new Map();
export function makeItemMesh(id, atlas) {
  const def = REG[id];
  if (def.block && !def.cross) {
    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3); const uv = geo.attributes.uv; const arr = uv.array;
    // BoxGeometry face order: +x,-x,+y,-y,+z,-z ; 4 verts each
    for (let f = 0; f < 6; f++) {
      const tile = tileOf(id, f); const col = tile % ATLAS_COLS, row = Math.floor(tile / ATLAS_COLS);
      for (let v = 0; v < 4; v++) { const i = (f * 4 + v) * 2; arr[i] = (col + arr[i]) / ATLAS_COLS; arr[i + 1] = 1 - (row + 1 - arr[i + 1]) / ATLAS_ROWS; }
    }
    uv.needsUpdate = true;
    const m = new THREE.MeshLambertMaterial({ map: atlas, alphaTest: 0.5 }); m.userData.base = new THREE.Color(0xffffff);
    return new THREE.Mesh(geo, m);
  }
  let tex = iconTexCache.get(id);
  if (!tex) { tex = new THREE.CanvasTexture(iconFor(id, 32)); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; iconTexCache.set(id, tex); }
  const m = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }); m.userData.base = new THREE.Color(0xffffff);
  const mesh = new THREE.Mesh(planeGeo, m); return mesh;
}
export function makeHeldItemMesh(id, atlas) { const m = makeItemMesh(id, atlas); m.scale.setScalar(REG[id].block && !REG[id].cross ? 1.0 : 1.2); return m; }
