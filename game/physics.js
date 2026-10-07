/* AABB physics against the voxel world */
import { isSolid, B, REG } from './constants.js';

export function collides(world, px, py, pz, w, h) {
  const hw = w / 2;
  const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw - 0.001), y0 = Math.floor(py), y1 = Math.floor(py + h - 0.001), z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw - 0.001);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (isSolid(world.getBlock(x, y, z))) return true;
  return false;
}
// body: {pos, vel, w, h, onGround, sneak}
export function moveBody(world, body, dt, opts = {}) {
  const res = { hitX: false, hitZ: false, hitY: false };
  const move = (axis, d) => {
    if (d === 0) return false;
    const p = body.pos;
    const nx = axis === 'x' ? p.x + d : p.x, ny = axis === 'y' ? p.y + d : p.y, nz = axis === 'z' ? p.z + d : p.z;
    if (!collides(world, nx, ny, nz, body.w, body.h)) { p[axis] += d; return false; }
    const step = d > 0 ? 0.02 : -0.02; let moved = 0;
    while (Math.abs(moved + step) <= Math.abs(d)) {
      const tx = axis === 'x' ? p.x + moved + step : p.x, ty = axis === 'y' ? p.y + moved + step : p.y, tz = axis === 'z' ? p.z + moved + step : p.z;
      if (collides(world, tx, ty, tz, body.w, body.h)) break; moved += step;
    }
    p[axis] += moved; return true;
  };
  const dx = body.vel.x * dt, dy = body.vel.y * dt, dz = body.vel.z * dt;
  // sneaking: don't walk off edges
  const sneakOK = (axis, d) => {
    if (!body.sneak || !body.onGround) return true;
    const p = body.pos; const tx = axis === 'x' ? p.x + d : p.x, tz = axis === 'z' ? p.z + d : p.z;
    return collides(world, tx, p.y - 0.1, tz, body.w, 0.1);
  };
  if (sneakOK('x', dx)) res.hitX = move('x', dx); else { body.vel.x = 0; }
  if (sneakOK('z', dz)) res.hitZ = move('z', dz); else { body.vel.z = 0; }
  if ((res.hitX || res.hitZ) && opts.autoStep && body.onGround) {
    const p = body.pos;
    if (!collides(world, p.x, p.y + 1.0, p.z, body.w, body.h)) {
      const tx = p.x + (res.hitX ? dx : 0), tz = p.z + (res.hitZ ? dz : 0);
      if (!collides(world, tx, p.y + 1.0, tz, body.w, body.h)) { p.x = tx; p.z = tz; p.y += 1.0; res.hitX = res.hitZ = false; }
    }
  }
  if (res.hitX) body.vel.x = 0; if (res.hitZ) body.vel.z = 0;
  body.onGround = false;
  res.hitY = move('y', dy);
  if (res.hitY) { if (dy < 0) body.onGround = true; body.vel.y = 0; }
  return res;
}
export function inLiquid(world, body, id = B.WATER) {
  const p = body.pos;
  return world.getBlock(Math.floor(p.x), Math.floor(p.y + 0.3), Math.floor(p.z)) === id || world.getBlock(Math.floor(p.x), Math.floor(p.y + body.h * 0.8), Math.floor(p.z)) === id;
}
export function touching(world, body, pred) {
  const p = body.pos, hw = body.w / 2;
  for (let x = Math.floor(p.x - hw); x <= Math.floor(p.x + hw); x++) for (let y = Math.floor(p.y); y <= Math.floor(p.y + body.h); y++) for (let z = Math.floor(p.z - hw); z <= Math.floor(p.z + hw); z++) if (pred(world.getBlock(x, y, z))) return true;
  return false;
}
export { REG };
