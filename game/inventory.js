/* Inventory, crafting matcher and container GUI (inventory / crafting table / furnace / chest) */
import { REG, RECIPES, SMELTING, SMELT_TIME, CREATIVE_ITEMS, B, I } from './constants.js';
import { iconClone } from './textures.js';

export const maxStack = id => REG[id].maxStack || 64;
export const sameItem = (a, b) => a && b && a.id === b.id && a.dur === undefined && b.dur === undefined;

export class Inventory {
  constructor(n = 36) { this.slots = new Array(n).fill(null); }
  add(stack) { // returns leftover count
    let left = stack.count;
    if (stack.dur === undefined) for (let i = 0; i < this.slots.length && left > 0; i++) { const s = this.slots[i]; if (sameItem(s, stack)) { const t = Math.min(maxStack(s.id) - s.count, left); s.count += t; left -= t; } }
    for (let i = 0; i < this.slots.length && left > 0; i++) { if (!this.slots[i]) { const t = Math.min(maxStack(stack.id), left); this.slots[i] = { id: stack.id, count: t }; if (stack.dur !== undefined) this.slots[i].dur = stack.dur; left -= t; } }
    return left;
  }
  count(id) { return this.slots.reduce((a, s) => a + (s && s.id === id ? s.count : 0), 0); }
  remove(id, n) { for (let i = 0; i < this.slots.length && n > 0; i++) { const s = this.slots[i]; if (s && s.id === id) { const t = Math.min(s.count, n); s.count -= t; n -= t; if (s.count <= 0) this.slots[i] = null; } } }
  isEmpty() { return this.slots.every(s => !s); }
}

// ---- Crafting ----
function shapeMatches(recipe, grid, size) {
  const rows = recipe.shape.length, cols = Math.max(...recipe.shape.map(r => r.length));
  if (rows > size || cols > size) return false;
  const tryAt = (oy, ox, mirror) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const s = grid[y * size + x]; let want = 0;
      const ry = y - oy, rx = mirror ? cols - 1 - (x - ox) : x - ox;
      if (ry >= 0 && ry < rows && rx >= 0 && rx < cols) { const ch = recipe.shape[ry][rx]; if (ch && ch !== '.') want = recipe.key[ch]; }
      if ((s ? s.id : 0) !== want) return false;
    }
    return true;
  };
  for (let oy = 0; oy <= size - rows; oy++) for (let ox = 0; ox <= size - cols; ox++) if (tryAt(oy, ox, false) || tryAt(oy, ox, true)) return true;
  return false;
}
export function matchRecipe(grid, size) {
  const present = grid.filter(Boolean);
  if (!present.length) return null;
  for (const r of RECIPES) {
    if (r.shapeless) {
      if (present.length !== r.shapeless.length) continue;
      const need = r.shapeless.slice(); let ok = true;
      for (const s of present) { const i = need.indexOf(s.id); if (i < 0) { ok = false; break; } need.splice(i, 1); }
      if (ok) return r;
    } else if (shapeMatches(r, grid, size)) return r;
  }
  return null;
}

// ---- GUI ----
export class Gui {
  constructor(game) {
    this.game = game; this.root = document.getElementById('gui'); this.cursorEl = document.getElementById('cursorStack');
    this.open = false; this.kind = null; this.cursor = null; this.craft = new Array(9).fill(null); this.craftSize = 2; this.chest = null; this.furnace = null;
    this.root.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('mousemove', e => { if (this.open) { this.cursorEl.style.left = e.clientX + 'px'; this.cursorEl.style.top = e.clientY + 'px'; } });
    this.root.addEventListener('mousedown', e => { if (e.target === this.root || e.target.classList.contains('gui-backdrop')) { if (this.cursor) { this.game.throwStack(this.cursor); this.cursor = null; this.render(); } } });
  }
  show(kind, ctx = {}) {
    this.kind = kind; this.open = true; this.craftSize = kind === 'crafting' ? 3 : 2; this.craft.fill(null);
    this.chest = ctx.chest || null; this.furnace = ctx.furnace || null; this.chestPos = ctx.pos || null;
    this.root.classList.remove('hidden'); this.render();
  }
  close() {
    if (!this.open) return;
    // return crafting grid + cursor to inventory
    for (let i = 0; i < 9; i++) if (this.craft[i]) { this.game.giveOrDrop(this.craft[i]); this.craft[i] = null; }
    if (this.cursor) { this.game.giveOrDrop(this.cursor); this.cursor = null; }
    this.open = false; this.kind = null; this.root.classList.add('hidden'); this.cursorEl.innerHTML = '';
  }
  // --- slot access by group ---
  get(group, i) {
    if (group === 'inv') return this.game.inv.slots[i]; if (group === 'craft') return this.craft[i]; if (group === 'chest') return this.chest[i];
    if (group === 'fin') return this.furnace.in; if (group === 'ffuel') return this.furnace.fuel; if (group === 'fout') return this.furnace.out;
    if (group === 'result') return this.resultStack(); if (group === 'creative') return { id: CREATIVE_ITEMS[i], count: 1 };
  }
  set(group, i, s) {
    if (s && s.count <= 0) s = null;
    if (group === 'inv') this.game.inv.slots[i] = s; else if (group === 'craft') this.craft[i] = s; else if (group === 'chest') this.chest[i] = s;
    else if (group === 'fin') this.furnace.in = s; else if (group === 'ffuel') this.furnace.fuel = s; else if (group === 'fout') this.furnace.out = s;
  }
  resultStack() { const size = this.craftSize; const grid = []; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) grid.push(this.craft[y * 3 + x]); const r = matchRecipe(grid, size); return r ? { id: r.out[0], count: r.out[1] } : null; }
  consumeCraft() { const r = this.resultStack(); if (!r) return; for (let i = 0; i < 9; i++) if (this.craft[i]) { this.craft[i].count--; if (this.craft[i].count <= 0) this.craft[i] = null; } this.game.onCrafted(r); }
  accepts(group, s) { if (group === 'ffuel') return !!REG[s.id].fuel; if (group === 'fin') return !!SMELTING[s.id]; if (group === 'fout' || group === 'result' || group === 'creative') return false; return true; }
  click(group, i, button, shift) {
    const cur = this.cursor; const s = this.get(group, i);
    if (group === 'creative') {
      if (shift) { this.game.inv.add({ id: s.id, count: maxStack(s.id) }); }
      else if (!cur) this.cursor = { id: s.id, count: button === 2 ? 1 : maxStack(s.id) };
      else if (cur.id === s.id) cur.count = Math.min(maxStack(s.id), cur.count + (button === 2 ? 1 : maxStack(s.id)));
      else this.cursor = null;
      this.render(); return;
    }
    if (group === 'result') {
      if (!s) return;
      if (shift) { let guard = 0; while (this.resultStack() && guard++ < 64) { const r = this.resultStack(); if (this.game.inv.add({ id: r.id, count: r.count }) > 0) break; this.consumeCraft(); } }
      else if (!cur) { this.cursor = { id: s.id, count: s.count }; this.consumeCraft(); }
      else if (cur.id === s.id && cur.count + s.count <= maxStack(s.id)) { cur.count += s.count; this.consumeCraft(); }
      this.render(); return;
    }
    if (shift) { // quick move
      if (!s) return;
      let moved = false;
      if (group === 'inv') {
        if (this.chest) { const left = addTo(this.chest, s); if (left === 0) this.set(group, i, null); else s.count = left; moved = true; }
        else if (this.furnace && (REG[s.id].fuel || SMELTING[s.id])) {
          const tgt = SMELTING[s.id] ? 'fin' : 'ffuel'; const t = this.get(tgt, 0);
          if (!t) { this.set(tgt, 0, s); this.set(group, i, null); moved = true; } else if (sameItem(t, s)) { const n = Math.min(maxStack(s.id) - t.count, s.count); t.count += n; s.count -= n; if (s.count <= 0) this.set(group, i, null); moved = true; }
        }
        if (!moved) { // hotbar <-> main
          const target = i < 9 ? [9, 36] : [0, 9]; const slots = this.game.inv.slots;
          for (let j = target[0]; j < target[1] && s.count > 0; j++) if (sameItem(slots[j], s)) { const n = Math.min(maxStack(s.id) - slots[j].count, s.count); slots[j].count += n; s.count -= n; }
          for (let j = target[0]; j < target[1] && s.count > 0; j++) if (!slots[j]) { slots[j] = s; this.set(group, i, null); s.count = 0; break; }
          if (s.count <= 0) this.set(group, i, null);
        }
      } else { const left = this.game.inv.add(s); if (left === 0) this.set(group, i, null); else s.count = left; if (group === 'fout' && this.furnace) this.game.onSmeltTaken(this.furnace); }
      this.render(); return;
    }
    if (button === 0) {
      if (!cur) { if (s) { this.cursor = s; this.set(group, i, null); if (group === 'fout') this.game.onSmeltTaken(this.furnace); } }
      else if (!s) { if (this.accepts(group, cur)) { this.set(group, i, cur); this.cursor = null; } }
      else if (sameItem(s, cur) && this.accepts(group, cur)) { const n = Math.min(maxStack(s.id) - s.count, cur.count); s.count += n; cur.count -= n; if (cur.count <= 0) this.cursor = null; }
      else if (this.accepts(group, cur)) { this.set(group, i, cur); this.cursor = s; }
    } else if (button === 2) {
      if (!cur) { if (s) { const half = Math.ceil(s.count / 2); this.cursor = Object.assign({}, s, { count: half }); s.count -= half; if (s.count <= 0) this.set(group, i, null); if (group === 'fout') this.game.onSmeltTaken(this.furnace); } }
      else if (!s) { if (this.accepts(group, cur)) { this.set(group, i, Object.assign({}, cur, { count: 1 })); cur.count--; if (cur.count <= 0) this.cursor = null; } }
      else if (sameItem(s, cur) && s.count < maxStack(s.id) && this.accepts(group, cur)) { s.count++; cur.count--; if (cur.count <= 0) this.cursor = null; }
    }
    this.render();
  }
  slotEl(group, i, s, extraClass = '') {
    const el = document.createElement('div'); el.className = 'gslot ' + extraClass; el.dataset.group = group; el.dataset.i = i;
    if (s) { el.appendChild(iconClone(s.id, 32)); if (s.count > 1 || group === 'creative') { const c = document.createElement('span'); c.className = 'count'; c.textContent = group === 'creative' ? '' : s.count; el.appendChild(c); } if (s.dur !== undefined && s.dur < REG[s.id].dur) { const d = document.createElement('div'); d.className = 'dur'; const f = s.dur / REG[s.id].dur; d.innerHTML = '<div style="width:' + (f * 100) + '%;background:' + (f > 0.5 ? '#4c4' : f > 0.25 ? '#ec4' : '#e44') + '"></div>'; el.appendChild(d); } el.title = REG[s.id].name; }
    el.addEventListener('mousedown', e => { e.preventDefault(); this.click(group, i, e.button, e.shiftKey); });
    el.addEventListener('mouseenter', () => { this.hover = s ? REG[s.id].name : ''; this.renderHover(); });
    el.addEventListener('mouseleave', () => { this.hover = ''; this.renderHover(); });
    return el;
  }
  renderHover() { const h = document.getElementById('guiTooltip'); if (h) { h.textContent = this.hover || ''; h.classList.toggle('hidden', !this.hover); } }
  render() {
    if (!this.open) return;
    const r = this.root; r.innerHTML = '';
    const panel = document.createElement('div'); panel.className = 'mc-panel gui-panel'; r.appendChild(panel);
    const title = document.createElement('div'); title.className = 'gui-title'; panel.appendChild(title);
    const top = document.createElement('div'); top.className = 'gui-top'; panel.appendChild(top);
    if (this.kind === 'inventory' || this.kind === 'crafting') {
      title.textContent = this.kind === 'crafting' ? 'Crafting' : 'Inventory';
      if (this.game.mode === 'creative' && this.kind === 'inventory') {
        title.textContent = 'Creative — all items';
        const grid = document.createElement('div'); grid.className = 'gui-grid creative-grid'; CREATIVE_ITEMS.forEach((id, i) => grid.appendChild(this.slotEl('creative', i, { id, count: 1 }))); top.appendChild(grid);
      } else {
        const wrap = document.createElement('div'); wrap.className = 'craft-wrap';
        const size = this.craftSize; const grid = document.createElement('div'); grid.className = 'gui-grid'; grid.style.gridTemplateColumns = 'repeat(' + size + ', 52px)';
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) grid.appendChild(this.slotEl('craft', y * 3 + x, this.craft[y * 3 + x]));
        wrap.appendChild(grid); const arrow = document.createElement('div'); arrow.className = 'gui-arrow'; arrow.textContent = '→'; wrap.appendChild(arrow);
        wrap.appendChild(this.slotEl('result', 0, this.resultStack(), 'result')); top.appendChild(wrap);
        if (this.kind === 'inventory') { const hint = document.createElement('div'); hint.className = 'gui-hint'; hint.innerHTML = 'Click a slot to pick up / place. Right-click: half / one. Shift-click: quick move. Drop outside to throw.<br>Use a Crafting Table for 3×3 recipes.'; top.appendChild(hint); }
        else { top.appendChild(this.recipeBook()); }
      }
    } else if (this.kind === 'chest') {
      title.textContent = 'Chest'; const grid = document.createElement('div'); grid.className = 'gui-grid'; grid.style.gridTemplateColumns = 'repeat(9, 52px)';
      for (let i = 0; i < 27; i++) grid.appendChild(this.slotEl('chest', i, this.chest[i])); top.appendChild(grid);
    } else if (this.kind === 'furnace') {
      title.textContent = 'Furnace'; const f = this.furnace; const wrap = document.createElement('div'); wrap.className = 'furnace-wrap';
      const col = document.createElement('div'); col.className = 'furnace-col'; col.appendChild(this.slotEl('fin', 0, f.in));
      const fire = document.createElement('div'); fire.className = 'furnace-fire'; fire.innerHTML = '<div style="height:' + Math.round((f.fuelLeft > 0 ? f.fuelLeft / f.fuelMax : 0) * 100) + '%"></div>'; col.appendChild(fire);
      col.appendChild(this.slotEl('ffuel', 0, f.fuel)); wrap.appendChild(col);
      const prog = document.createElement('div'); prog.className = 'furnace-prog'; prog.innerHTML = '<div style="width:' + Math.round(f.progress / SMELT_TIME * 100) + '%"></div>'; wrap.appendChild(prog);
      wrap.appendChild(this.slotEl('fout', 0, f.out, 'result')); top.appendChild(wrap);
      const hint = document.createElement('div'); hint.className = 'gui-hint'; hint.textContent = 'Top: ore / sand / cobblestone / raw meat / logs. Bottom: fuel (coal, planks, logs, sticks).'; top.appendChild(hint);
    }
    // player inventory
    const invLabel = document.createElement('div'); invLabel.className = 'gui-sub'; invLabel.textContent = 'Inventory'; panel.appendChild(invLabel);
    const main = document.createElement('div'); main.className = 'gui-grid'; main.style.gridTemplateColumns = 'repeat(9, 52px)';
    for (let i = 9; i < 36; i++) main.appendChild(this.slotEl('inv', i, this.game.inv.slots[i])); panel.appendChild(main);
    const hb = document.createElement('div'); hb.className = 'gui-grid gui-hotbar'; hb.style.gridTemplateColumns = 'repeat(9, 52px)';
    for (let i = 0; i < 9; i++) hb.appendChild(this.slotEl('inv', i, this.game.inv.slots[i], i === this.game.slot ? 'selected' : '')); panel.appendChild(hb);
    const tip = document.createElement('div'); tip.id = 'guiTooltip'; tip.className = 'gui-tooltip hidden'; panel.appendChild(tip);
    const close = document.createElement('button'); close.className = 'mc-btn mc-btn-small gui-close'; close.textContent = '✕'; close.addEventListener('click', () => this.game.closeGui()); panel.appendChild(close);
    // cursor
    this.cursorEl.innerHTML = ''; if (this.cursor) { this.cursorEl.appendChild(iconClone(this.cursor.id, 32)); if (this.cursor.count > 1) { const c = document.createElement('span'); c.className = 'count'; c.textContent = this.cursor.count; this.cursorEl.appendChild(c); } }
    this.game.hud.updateHotbar();
  }
  recipeBook() {
    const box = document.createElement('div'); box.className = 'recipe-book'; const h = document.createElement('div'); h.className = 'gui-sub'; h.textContent = 'Recipe book (click to auto-fill if you have the items)'; box.appendChild(h);
    const list = document.createElement('div'); list.className = 'recipe-list';
    for (const r of RECIPES) {
      const need = {}; if (r.shapeless) r.shapeless.forEach(id => need[id] = (need[id] || 0) + 1); else r.shape.forEach(row => [...row].forEach(ch => { if (ch !== '.') need[r.key[ch]] = (need[r.key[ch]] || 0) + 1; }));
      const can = this.game.mode === 'creative' || Object.keys(need).every(id => this.game.inv.count(+id) >= need[id]);
      const el = document.createElement('div'); el.className = 'recipe-entry' + (can ? '' : ' disabled'); el.appendChild(iconClone(r.out[0], 28)); el.title = REG[r.out[0]].name + ' ×' + r.out[1];
      el.addEventListener('click', () => { if (!can) return; this.autoFill(r, need); });
      list.appendChild(el);
    }
    box.appendChild(list); return box;
  }
  autoFill(r, need) {
    for (let i = 0; i < 9; i++) if (this.craft[i]) { this.game.giveOrDrop(this.craft[i]); this.craft[i] = null; }
    const take = id => { if (this.game.mode === 'creative') return { id, count: 1 }; if (this.game.inv.count(id) < 1) return null; this.game.inv.remove(id, 1); return { id, count: 1 }; };
    const size = this.craftSize;
    if (r.shapeless) { r.shapeless.forEach((id, i) => { const y = Math.floor(i / size), x = i % size; this.craft[y * 3 + x] = take(id); }); }
    else { r.shape.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && y < size && x < size) this.craft[y * 3 + x] = take(r.key[ch]); })); }
    this.render();
  }
}
function addTo(slots, s) { let left = s.count; for (let i = 0; i < slots.length && left > 0; i++) if (sameItem(slots[i], s)) { const n = Math.min(maxStack(s.id) - slots[i].count, left); slots[i].count += n; left -= n; } for (let i = 0; i < slots.length && left > 0; i++) if (!slots[i]) { slots[i] = Object.assign({}, s, { count: left }); left = 0; } return left; }
export { B, I };
