/* HUD: hotbar, hearts, hunger, air, XP, toasts, quest panel, death screen */
import { REG, ADVANCEMENTS } from './constants.js';
import { iconClone } from './textures.js';

const HEART = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
const FOOD = ['.....XXX.', '....XXXXX', '....XXXXX', '...XXXXX.', '..XXXX...', '.XXX.....', 'XXX......', 'XX.......'];
const BUBBLE = ['..XXXX...', '.X....X..', 'X......X.', 'X......X.', 'X......X.', '.X....X..', '..XXXX...', '.........'];
function iconUrl(pat, fill, half, outline) {
  const c = document.createElement('canvas'); c.width = 9; c.height = 9; const ctx = c.getContext('2d');
  for (let y = 0; y < pat.length; y++) for (let x = 0; x < 9; x++) {
    if (pat[y][x] !== 'X') continue;
    const edge = !(pat[y - 1] && pat[y - 1][x] === 'X') || !(pat[y + 1] && pat[y + 1][x] === 'X') || pat[y][x - 1] !== 'X' || pat[y][x + 1] !== 'X';
    ctx.fillStyle = edge ? outline : (half && x >= 5 ? '#3a3a3a' : fill); if (half && x >= 5 && !edge) ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x, y, 1, 1);
  }
  return 'url(' + c.toDataURL() + ')';
}
function makeStatusIcons() {
  const r = document.documentElement.style;
  r.setProperty('--ic-heart-full', iconUrl(HEART, '#ff2a2a', false, '#000')); r.setProperty('--ic-heart-half', iconUrl(HEART, '#ff2a2a', true, '#000')); r.setProperty('--ic-heart-empty', iconUrl(HEART, '#4a4a4a', false, '#000'));
  r.setProperty('--ic-food-full', iconUrl(FOOD, '#c8742a', false, '#3b1d08')); r.setProperty('--ic-food-half', iconUrl(FOOD, '#c8742a', true, '#3b1d08')); r.setProperty('--ic-food-empty', iconUrl(FOOD, '#4a4a4a', false, '#222'));
  r.setProperty('--ic-bubble', iconUrl(BUBBLE, '#9fd3ff', false, '#3a7bd5'));
}

export class Hud {
  constructor(game) {
    makeStatusIcons();
    this.game = game; const $ = id => document.getElementById(id);
    this.el = { hotbar: $('hotbar'), itemName: $('itemName'), hearts: $('hearts'), hunger: $('hunger'), air: $('air'), xpBar: $('xpBar'), xpLevel: $('xpLevel'), toast: $('toast'), advToast: $('advToast'), quest: $('questPanel'), questList: $('questList'), death: $('deathScreen'), debug: $('debug'), coords: $('hudCoords'), time: $('hudTime'), target: $('hudTarget'), status: $('statusBars') };
    this.slotEls = [];
    for (let i = 0; i < 9; i++) { const s = document.createElement('div'); s.className = 'slot'; s.dataset.i = i; s.addEventListener('click', () => { game.slot = i; this.updateHotbar(); }); this.el.hotbar.appendChild(s); this.slotEls.push(s); }
    this.lastSlot = -1; this.lastHearts = -1;
  }
  updateHotbar() {
    const inv = this.game.inv;
    for (let i = 0; i < 9; i++) {
      const el = this.slotEls[i], s = inv.slots[i]; el.innerHTML = ''; el.classList.toggle('selected', i === this.game.slot);
      if (s) { el.appendChild(iconClone(s.id, 32)); if (s.count > 1) { const c = document.createElement('span'); c.className = 'count'; c.textContent = s.count; el.appendChild(c); }
        if (s.dur !== undefined && s.dur < REG[s.id].dur) { const d = document.createElement('div'); d.className = 'dur'; const f = s.dur / REG[s.id].dur; d.innerHTML = '<div style="width:' + (f * 100) + '%;background:' + (f > 0.5 ? '#4c4' : f > 0.25 ? '#ec4' : '#e44') + '"></div>'; el.appendChild(d); } }
    }
    if (this.lastSlot !== this.game.slot) { this.lastSlot = this.game.slot; this.showItemName(); }
  }
  showItemName() { const s = this.game.inv.slots[this.game.slot]; const n = this.el.itemName; n.textContent = s ? REG[s.id].name : ''; n.classList.add('show'); clearTimeout(this._nt); this._nt = setTimeout(() => n.classList.remove('show'), 1500); }
  updateStatus() {
    const g = this.game; const surv = g.mode === 'survival'; this.el.status.classList.toggle('hidden', !surv); if (!surv) return;
    const hp = Math.max(0, g.health), hu = g.hunger;
    let h = ''; for (let i = 0; i < 10; i++) { const v = hp - i * 2; h += '<i class="' + (v >= 2 ? 'full' : v >= 1 ? 'half' : 'empty') + (hp <= 4 && g.health > 0 ? ' blink' : '') + '"></i>'; }
    this.el.hearts.innerHTML = h;
    let f = ''; for (let i = 0; i < 10; i++) { const v = hu - i * 2; f += '<i class="' + (v >= 2 ? 'full' : v >= 1 ? 'half' : 'empty') + '"></i>'; }
    this.el.hunger.innerHTML = f;
    if (g.air < 300) { let a = ''; for (let i = 0; i < 10; i++) a += '<i class="' + (g.air > i * 30 ? 'full' : 'empty') + '"></i>'; this.el.air.innerHTML = a; } else this.el.air.innerHTML = '';
    this.el.xpBar.firstElementChild.style.width = (g.xpProgress() * 100) + '%'; this.el.xpLevel.textContent = g.level > 0 ? g.level : '';
  }
  toast(msg) { const t = this.el.toast; t.textContent = msg; t.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), 2000); }
  advancement(adv) {
    const t = this.el.advToast; t.innerHTML = ''; t.appendChild(iconClone(adv.icon, 32)); const d = document.createElement('div'); d.innerHTML = '<b>Advancement Made!</b><br>' + adv.name; t.appendChild(d);
    t.classList.add('show'); clearTimeout(this._at); this._at = setTimeout(() => t.classList.remove('show'), 4000);
  }
  renderQuests() {
    const done = this.game.advDone; const list = this.el.questList; list.innerHTML = '';
    let n = 0; for (const a of ADVANCEMENTS) { const ok = done.has(a.id); if (ok) n++; const el = document.createElement('div'); el.className = 'quest' + (ok ? ' done' : ''); el.appendChild(iconClone(a.icon, 32)); const t = document.createElement('div'); t.innerHTML = '<b>' + a.name + '</b><br><span>' + a.desc + '</span>'; el.appendChild(t); const m = document.createElement('span'); m.className = 'mark'; m.textContent = ok ? '✔' : '☐'; el.appendChild(m); list.appendChild(el); }
    document.getElementById('questCount').textContent = n + ' / ' + ADVANCEMENTS.length;
  }
  showQuests(show) { this.el.quest.classList.toggle('hidden', !show); if (show) this.renderQuests(); }
  showDeath(show, msg) { this.el.death.classList.toggle('hidden', !show); if (show) document.getElementById('deathMsg').textContent = msg || 'You died!'; }
  debug(txt) { this.el.debug.textContent = txt; }
}
