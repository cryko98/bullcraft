/* Item drops and mobs */
import * as THREE from 'three';
import { B, REG, MOB_TYPES, isSolid } from './constants.js';
import { moveBody, inLiquid, collides } from './physics.js';
import { buildMob, makeItemMesh, setModelLight } from './models.js';

const GRAVITY = 32;

export class ItemEntity {
  constructor(game, stack, x, y, z, vel) {
    this.game = game; this.stack = stack; this.w = 0.25; this.h = 0.25;
    this.pos = new THREE.Vector3(x, y, z); this.vel = vel ? vel.clone() : new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2);
    this.onGround = false; this.age = 0; this.pickupDelay = 0.6; this.dead = false;
    this.mesh = makeItemMesh(stack.id, game.atlas); this.mesh.position.copy(this.pos); game.scene.add(this.mesh);
    this.spin = Math.random() * Math.PI * 2;
  }
  update(dt) {
    this.age += dt; this.pickupDelay -= dt;
    const inWater = inLiquid(this.game.world, this);
    if (inWater) { this.vel.y += (1.5 - this.vel.y) * Math.min(1, dt * 4); this.vel.x *= 0.9; this.vel.z *= 0.9; }
    else { this.vel.y -= GRAVITY * dt; if (this.onGround) { this.vel.x *= Math.pow(0.02, dt); this.vel.z *= Math.pow(0.02, dt); } }
    moveBody(this.game.world, this, dt);
    // escape if stuck inside a block
    if (collides(this.game.world, this.pos.x, this.pos.y, this.pos.z, this.w, this.h)) this.pos.y += dt * 2;
    if (this.game.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z)) === B.LAVA) { this.dead = true; }
    if (this.age > 300 || this.pos.y < -5) this.dead = true;
    // merge
    if (this.age > 1) for (const o of this.game.items) {
      if (o === this || o.dead || o.stack.id !== this.stack.id || (o.stack.dur !== undefined)) continue;
      if (o.pos.distanceToSquared(this.pos) < 0.5) { const max = REG[this.stack.id].maxStack; const take = Math.min(max - this.stack.count, o.stack.count); if (take > 0) { this.stack.count += take; o.stack.count -= take; if (o.stack.count <= 0) o.dead = true; } }
    }
    // pickup
    if (this.pickupDelay <= 0 && !this.game.dead) {
      const p = this.game.player.pos; const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
      const d2 = dx * dx + dz * dz; const inY = this.pos.y > p.y - 1.0 && this.pos.y < p.y + 2.0;
      if (d2 < 1.6 && inY) {
        if (d2 > 0.1) { this.vel.x += dx * 8 * dt / Math.sqrt(d2) * 3; this.vel.z += dz * 8 * dt / Math.sqrt(d2) * 3; this.vel.y += 0.5 * dt * 10; }
        if (d2 < 0.9) { const left = this.game.pickupItem(this.stack); if (left === 0) { this.dead = true; } else { this.stack.count = left; this.pickupDelay = 0.5; } }
      }
    }
    this.spin += dt * 2.2;
    this.mesh.position.set(this.pos.x, this.pos.y + 0.15 + Math.sin(this.age * 2.5) * 0.05, this.pos.z);
    this.mesh.rotation.y = this.spin;
    setModelLight(this.mesh, this.game.brightnessAt(this.pos.x, this.pos.y + 0.2, this.pos.z));
    if (this.dead) this.game.scene.remove(this.mesh);
  }
  serialize() { return { stack: this.stack, x: this.pos.x, y: this.pos.y, z: this.pos.z, age: this.age }; }
}

export class Mob {
  constructor(game, type, x, y, z) {
    this.game = game; this.type = type; const def = MOB_TYPES[type]; this.def = def;
    this.w = def.w; this.h = def.h; this.hp = def.hp; this.maxHp = def.hp;
    this.pos = new THREE.Vector3(x, y, z); this.vel = new THREE.Vector3(); this.onGround = false; this.dead = false;
    this.yaw = Math.random() * Math.PI * 2; this.wanderT = 0; this.moveDir = null; this.walk = 0; this.hurtT = 0; this.attackT = 0; this.burnT = 0; this.age = 0;
    this.model = buildMob(type); this.model.group.position.copy(this.pos); game.scene.add(this.model.group);
    this.bodyYaw = this.yaw;
  }
  hurt(dmg, fromX, fromZ) {
    if (this.dead) return; this.hp -= dmg; this.hurtT = 0.4;
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ, l = Math.hypot(dx, dz) || 1;
    this.vel.x += dx / l * 6; this.vel.z += dz / l * 6; this.vel.y = 4.5;
    this.game.sound.play('hurt');
    if (this.hp <= 0) this.die();
    else if (!this.def.hostile) { this.panicT = 4; }
  }
  die() {
    this.dead = true; this.game.scene.remove(this.model.group);
    for (const [id, min, max] of this.def.drops) { const n = min + Math.floor(Math.random() * (max - min + 1)); if (n > 0) this.game.dropStack({ id, count: n }, this.pos.x, this.pos.y + 0.5, this.pos.z); }
    const xp = this.def.xp[0] + Math.floor(Math.random() * (this.def.xp[1] - this.def.xp[0] + 1)); this.game.addXp(xp);
    this.game.stats.killed[this.type] = (this.game.stats.killed[this.type] || 0) + 1;
  }
  update(dt) {
    const g = this.game, world = g.world; this.age += dt;
    const p = g.player.pos; const dxp = p.x - this.pos.x, dzp = p.z - this.pos.z; const distP = Math.hypot(dxp, dzp);
    if (distP > 64) return; // frozen when far
    this.hurtT = Math.max(0, this.hurtT - dt); this.attackT = Math.max(0, this.attackT - dt); if (this.panicT) this.panicT -= dt;
    // ---- AI ----
    let speed = this.def.speed; let want = null;
    if (this.def.hostile && distP < 20 && !g.dead) { want = [dxp / distP, dzp / distP]; }
    else if (this.panicT > 0) { want = [-dxp / (distP || 1), -dzp / (distP || 1)]; speed *= 1.8; }
    else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderT = 2 + Math.random() * 5; this.moveDir = Math.random() < 0.55 ? null : (() => { const a = Math.random() * Math.PI * 2; return [Math.sin(a), Math.cos(a)]; })(); }
      want = this.moveDir; speed *= 0.6;
    }
    if (want) {
      this.yaw = Math.atan2(-want[0], -want[1]);
      const inWater = inLiquid(world, this);
      const acc = this.onGround ? 10 : 2;
      this.vel.x += (want[0] * speed - this.vel.x) * Math.min(1, acc * dt);
      this.vel.z += (want[1] * speed - this.vel.z) * Math.min(1, acc * dt);
      if (inWater && this.vel.y < 1) this.vel.y += 20 * dt;
    } else { this.vel.x *= Math.pow(0.01, dt); this.vel.z *= Math.pow(0.01, dt); }
    const inWater = inLiquid(world, this);
    if (inWater) { this.vel.y -= GRAVITY * 0.2 * dt; this.vel.y *= 0.92; } else { this.vel.y -= GRAVITY * dt; }
    const wasOnGround = this.onGround; const fallV = this.vel.y;
    const res = moveBody(world, this, dt);
    if ((res.hitX || res.hitZ) && this.onGround && want) { this.vel.y = 8.5; this.onGround = false; }
    if (!wasOnGround && this.onGround && fallV < -14) { this.hurt(Math.floor(-fallV / 2 - 6), this.pos.x, this.pos.z); }
    // lava
    if (world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.2), Math.floor(this.pos.z)) === B.LAVA) { this.burnT = 4; this.dmgT = (this.dmgT || 0) + dt; if (this.dmgT > 0.5) { this.dmgT = 0; this.hurt(4, this.pos.x + 0.01, this.pos.z); } }
    // zombie: burn in daylight, attack player
    if (this.def.hostile) {
      if (g.sunUp() && world.skyLightAt(this.pos.x, this.pos.y + 1, this.pos.z) >= 14) { this.burnT = 2; this.dmgT = (this.dmgT || 0) + dt; if (this.dmgT > 1) { this.dmgT = 0; this.hurt(1, this.pos.x + 0.01, this.pos.z); } }
      if (distP < 1.7 && Math.abs(p.y - this.pos.y) < 2 && this.attackT <= 0 && !g.dead) { this.attackT = 1.0; g.damagePlayer(this.def.dmg, this.pos); }
      if (distP > 60 || (g.sunUp() && this.age > 30 && distP > 30)) this.dead = true;
      if (this.dead && this.model.group.parent) this.game.scene.remove(this.model.group);
    }
    if (this.pos.y < -5) { this.dead = true; this.game.scene.remove(this.model.group); }
    // ---- animation ----
    const hs = Math.hypot(this.vel.x, this.vel.z); this.walk += hs * dt * 2.5; const sw = Math.sin(this.walk) * Math.min(1, hs) * 0.7;
    const m = this.model; let d = this.yaw - m.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); m.group.rotation.y += d * Math.min(1, dt * 8);
    m.group.position.copy(this.pos);
    if (m.legs.length === 4) { m.legs[0].rotation.x = sw; m.legs[3].rotation.x = sw; m.legs[1].rotation.x = -sw; m.legs[2].rotation.x = -sw; }
    else { m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw; }
    if (this.def.hostile && m.head) { let hd = Math.atan2(-dxp, -dzp) - m.group.rotation.y; hd = Math.atan2(Math.sin(hd), Math.cos(hd)); m.head.rotation.y = distP < 20 ? Math.max(-1, Math.min(1, hd)) : 0; }
    const b = g.brightnessAt(this.pos.x, this.pos.y + 1, this.pos.z);
    setModelLight(m.group, this.burnT > 0 ? Math.min(1.3, b + 0.5) : b, this.hurtT > 0 ? 0.5 : 0);
    if (this.burnT > 0) this.burnT -= dt;
  }
  serialize() { return { type: this.type, x: this.pos.x, y: this.pos.y, z: this.pos.z, hp: this.hp }; }
}
export { isSolid };
