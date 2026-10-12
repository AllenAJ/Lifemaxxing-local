'use strict';
const KEY = 'lifemax.v1';
const DAY_START_HOUR = 4; // late-night check-ins before 4am count for the previous day

/* ---------- dates & helpers ---------- */
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => keyOf(new Date(Date.now() - DAY_START_HOUR * 3600e3));
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const dow = k => parseKey(k).getDay();
const weekStart = k => addDays(k, -((dow(k) + 6) % 7)); // Monday
const weekDays = ws => Array.from({ length: 7 }, (_, i) => addDays(ws, i));
const lastN = n => Array.from({ length: n }, (_, i) => addDays(today(), -i));
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = x => Math.round(x * 100) + '%';
const avg = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rand = seed => hash(seed) / 4294967296; // deterministic, so undo/redo can't re-roll crits

/* ---------- state ---------- */
function fresh() {
  return {
    v: 1, onboarded: false, created: today(),
    profile: { name: '', identity: IDENTITIES[0] },
    habits: Object.fromEntries(HABITS.map(h => [h.id, { on: !!h.def, cue: h.cue || '' }])),
    custom: [], log: {}, ach: {}, flags: { upkeep1: true, teeth2: true },
    settings: { minDaily: 3, sound: true, haptics: true, units: 'metric' },
  };
}
function migrate(s) {
  const f = fresh();
  s.settings = { ...f.settings, ...s.settings };
  s.profile = { ...f.profile, ...s.profile };
  s.habits = { ...Object.fromEntries(HABITS.map(h => [h.id, { on: false, cue: h.cue || '' }])), ...s.habits };
  s.custom = s.custom || []; s.log = s.log || {}; s.ach = s.ach || {}; s.flags = s.flags || {};
  if (!s.flags.upkeep1) { for (const id of UPKEEP_V1) s.habits[id].on = true; s.flags.upkeep1 = true; }
  // teeth was split into AM + PM: PM follows whatever the old combined habit was set to
  if (!s.flags.teeth2) { s.habits.teethpm = { ...s.habits.teethpm, on: !!s.habits.teeth?.on }; s.flags.teeth2 = true; }
  const first = Object.keys(s.log).sort()[0];
  if (!s.created || (first && first < s.created)) s.created = first || today();
  return s;
}
const UPKEEP_V1 = ['teeth', 'shower', 'trim', 'nails', 'haircut', 'shoes', 'room'];
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return migrate(s); } catch (e) {} return fresh(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Could not save'); } markDirty(); }
const touch = () => { state.mt = Date.now(); }; // settings/profile/habit-list changed (sync merge: newest wins)

let state = load();
const ui = { tab: 'today', day: 't', onboard: 0, just: null, anim: '' };
const app = document.getElementById('app');
const EMPTY = { done: {}, quests: {}, bonus: {}, m: {}, note: '' };

function getDay(k) { const e = state.log[k] || (state.log[k] = {}); e.t = Date.now(); // getDay = about to mutate this day
  e.done ||= {}; e.quests ||= {}; e.bonus ||= {}; e.m ||= {}; e.note ??= ''; return e; }
const peek = k => state.log[k] || EMPTY;
const viewDay = () => ui.day === 'y' ? addDays(today(), -1) : today();

/* ---------- habits ---------- */
const allHabits = () => [...HABITS, ...state.custom];
const habitById = id => allHabits().find(h => h.id === id);
const isOn = h => !!state.habits[h.id]?.on;
const activeHabits = () => allHabits().filter(isOn);
const cueOf = h => state.habits[h.id]?.cue || '';
const isUpkeep = h => (h.every || 1) > 1;
const dailyHabits = () => activeHabits().filter(h => !isUpkeep(h));
const upkeepHabits = () => activeHabits().filter(isUpkeep);
const everyLabel = n => ({ 7: 'weekly', 14: 'every 2 wks', 30: 'monthly', 90: 'every 3 mo' }[n] || `every ${n}d`);
// Upkeep countdown relative to day k: due = days left (negative = overdue). Never done → due now.
function upkeepStatus(h, k) {
  if (peek(k).done[h.id]) return { done: true, due: h.every };
  for (let d = 1; d <= 400; d++) if (peek(addDays(k, -d)).done[h.id]) return { due: h.every - d, since: d };
  return { due: 0, never: true };
}

/* ---------- XP & levels ---------- */
function entryXP(e) {
  const r = { total: 0, stats: {} };
  const add = (x, s) => { r.total += x; if (s) r.stats[s] = (r.stats[s] || 0) + x; };
  for (const v of Object.values(e.done || {})) add(v.xp, v.s);
  for (const v of Object.values(e.quests || {})) add(v.xp, v.s);
  for (const v of Object.values(e.bonus || {})) add(v.xp, v.s);
  return r;
}
function totals() {
  const r = { total: 0, stats: Object.fromEntries(STAT_ORDER.map(s => [s, 0])) };
  for (const e of Object.values(state.log)) { const x = entryXP(e); r.total += x.total; for (const s in x.stats) r.stats[s] += x.stats[s]; }
  return r;
}
function lvl(xp, base, inc) { let L = 1, need = base; while (xp >= need) { xp -= need; L++; need = base + inc * (L - 1); } return { L, into: Math.floor(xp), need, pct: xp / need }; }
const LV = xp => lvl(xp, 100, 50);
const SLV = xp => lvl(xp, 50, 25);
const rankOf = L => RANKS.reduce((r, [l, n]) => L >= l ? n : r, RANKS[0][1]);
function snap() { const t = totals(); return { L: LV(t.total).L, s: Object.fromEntries(STAT_ORDER.map(s => [s, SLV(t.stats[s]).L])) }; }

/* ---------- streaks (derived, never stored) ---------- */
const countDone = k => Object.keys(peek(k).done).length;
const activeDay = k => countDone(k) >= state.settings.minDaily;
function streakInfo() {
  const t = today(); let k = state.created < t ? state.created : t;
  let streak = 0, best = 0, shields = 1; const frozen = new Set();
  while (k < t) {
    if (activeDay(k)) { streak++; if (streak % 7 === 0) shields = Math.min(3, shields + 1); }
    else if (streak > 0 && shields > 0) { shields--; frozen.add(k); }
    else streak = 0;
    best = Math.max(best, streak); k = addDays(k, 1);
  }
  const todayDone = activeDay(t), cur = streak + (todayDone ? 1 : 0);
  const y = addDays(t, -1);
  return { streak: cur, best: Math.max(best, cur), shields, frozen, todayDone, yesterday: y, yesterdayMissed: y >= state.created && !activeDay(y) };
}

/* ---------- quests & bosses ---------- */
function questsFor(k) { const pool = [...QUESTS], out = []; for (let i = 0; out.length < 3; i++) out.push(pool.splice(hash(k + ':' + i) % pool.length, 1)[0]); return out; }
function bossFor(k) {
  const week = weekStart(k), base = BOSSES[hash(week) % BOSSES.length];
  const n = dailyHabits().filter(h => h.stat === base.stat).length;
  const hp = Math.max(5, n * 4); let dmg = 0;
  for (const d of weekDays(week)) {
    const e = state.log[d]; if (!e) continue;
    for (const v of Object.values(e.done || {})) if (v.s === base.stat) dmg += v.t === 'full' ? 1 : 0.5;
    for (const v of Object.values(e.quests || {})) if (v.s === base.stat) dmg += 2;
  }
  return { ...base, week, hp, dmg: Math.min(dmg, hp), defeated: dmg >= hp };
}

/* ---------- bonuses ---------- */
function syncBonuses(k) {
  const e = getDay(k), act = dailyHabits();
  const perfect = act.length > 0 && act.every(h => e.done[h.id]?.t === 'full');
  if (perfect && !e.bonus.perfect) { e.bonus.perfect = { xp: 50, label: 'Perfect day' }; queue({ type: 'perfect' }); }
  else if (!perfect && e.bonus.perfect) delete e.bonus.perfect;

  if (activeDay(k) && !e.bonus.chest) {
    const xp = 10 + Math.floor(rand(k + 'chest') * 41);
    e.bonus.chest = { xp, label: 'Daily chest' };
    queue({ type: 'chest', xp, card: WISDOM[hash(k + 'w') % WISDOM.length] });
  }

  const b = bossFor(k), bk = 'boss:' + b.week;
  const holder = weekDays(b.week).find(d => state.log[d]?.bonus?.[bk]);
  if (b.defeated && !holder) { e.bonus[bk] = { xp: 150, s: b.stat, label: 'Boss slain: ' + b.name }; queue({ type: 'boss', boss: b }); }
  else if (!b.defeated && holder) delete state.log[holder].bonus[bk];
}

/* ---------- actions ---------- */
function toggleHabit(id, kind) {
  const k = viewDay(), e = getDay(k), h = habitById(id); if (!h) return;
  const before = snap(), cur = e.done[id];
  if (cur && cur.t === kind) { delete e.done[id]; buzz(8); }
  else {
    const crit = rand(k + '|' + id + '|' + kind) < 0.12;
    let xp = Math.round(h.xp * (kind === 'mini' ? 0.5 : 1)); if (crit) xp *= 2;
    e.done[id] = { t: kind, xp, s: h.stat, crit };
    sfx(crit ? 'crit' : 'tick'); buzz(crit ? [15, 40, 15] : 12);
    floatXP(crit ? `+${xp} crit!` : `+${xp}`, crit ? RED : ORANGE);
    ui.just = id; ui.anim = 'watering';
  }
  syncBonuses(k); commit(before);
}
function toggleQuest(id) {
  const k = viewDay(), e = getDay(k), q = QUESTS.find(x => x.id === id); if (!q) return;
  const before = snap();
  if (e.quests[id]) { delete e.quests[id]; buzz(8); }
  else { e.quests[id] = { xp: q.xp, s: q.stat }; sfx('crit'); buzz(15); floatXP(`+${q.xp}`, ORANGE); ui.just = id; ui.anim = 'watering'; }
  syncBonuses(k); commit(before);
}
function commit(before) {
  save();
  const after = snap();
  if (after.L > before.L) queue({ type: 'level', L: after.L, newRank: rankOf(after.L) !== rankOf(before.L) });
  for (const s of STAT_ORDER) if (after.s[s] > before.s[s]) toast(`${STATS[s].name} → lv ${after.s[s]}`, STATS[s].color);
  checkAch(); render(); pump();
}

function achCtx() {
  const t = totals(), st = streakInfo();
  const c = { L: LV(t.total).L, best: st.best, comps: 0, perfect: false, boss: false, metrics: 0, notes: 0, comeback: false, slv: STAT_ORDER.map(s => SLV(t.stats[s]).L) };
  for (const k of Object.keys(state.log)) {
    const e = state.log[k];
    c.comps += Object.keys(e.done || {}).length;
    if (e.bonus?.perfect) c.perfect = true;
    if (Object.keys(e.bonus || {}).some(b => b.startsWith('boss:'))) c.boss = true;
    if (Object.values(e.m || {}).some(v => v !== '' && v != null)) c.metrics++;
    if (e.note?.trim()) c.notes++;
    if (k > state.created && activeDay(k) && !activeDay(addDays(k, -1))) c.comeback = true;
  }
  return c;
}
function checkAch() {
  const c = achCtx(); let changed = false;
  for (const a of ACHIEVEMENTS) if (!state.ach[a.id] && a.test(c)) { state.ach[a.id] = today(); queue({ type: 'ach', a }); changed = true; }
  if (changed) save();
}

/* ---------- feedback: sound, haptics, toasts, modals, confetti ---------- */
let ac;
function sfx(type) {
  if (!state.settings.sound) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const notes = { tick: [660, 880], crit: [660, 880, 1320], level: [523, 659, 784, 1047, 1319], chest: [784, 988, 1175], pop: [520] }[type];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + i * 0.07;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + 0.22);
    });
  } catch (e) {}
}
const buzz = p => { if (state.settings.haptics && navigator.vibrate) navigator.vibrate(p); };

function toast(msg, color) {
  const t = document.createElement('div'); t.className = 'toast'; t.style.setProperty('--c', color || INK); t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 1900); setTimeout(() => t.remove(), 2400);
}
let lastTap = { x: innerWidth / 2, y: innerHeight / 2 };
document.addEventListener('pointerdown', e => { lastTap = { x: e.clientX, y: e.clientY }; }, true);
function floatXP(text, color) {
  const el = document.createElement('div'); el.className = 'floatxp hand'; el.textContent = text; el.style.color = color;
  el.style.left = lastTap.x + 'px'; el.style.top = lastTap.y + 'px';
  document.body.appendChild(el); setTimeout(() => el.remove(), 1100);
}

const modalQ = []; let modalOpen = false;
const queue = m => modalQ.push(m);
function modalHTML(m) {
  switch (m.type) {
    case 'level': return `${levelScene(m.L)}<h2 class="hand">level ${m.L}</h2>${m.newRank ? `<p>new rank · <b class="red">${rankOf(m.L)}</b></p>` : ''}`;
    case 'chest': return `${chestScene(m.xp)}<p class="quote hand">${esc(m.card)}</p>`;
    case 'perfect': return `${perfectScene(LV(totals().total).L)}<h2 class="hand">+50 xp</h2><p>every habit, done in full.</p>`;
    case 'boss': return `${bossDownScene(m.boss)}<h2 class="hand">${esc(m.boss.name)}, down</h2><p>+150 xp</p>`;
    case 'ach': return `<div class="stampbig">${stamp(m.a.icon, { size: 132 })}</div><h2 class="hand">${esc(m.a.name)}</h2><p>${esc(m.a.desc)}</p>`;
    case 'synccode': return `${keyScene()}<h2 class="hand">your sync code</h2><div class="code hand">${esc(sync.code)}</div><p>it backs up everything and restores it on any phone. save it in your notes.</p>`;
    case 'welcome': return `${seedScene()}<h2 class="hand">+50 xp head start</h2><p>${state.settings.minDaily} habits today and it blooms.</p>`;
  }
}
function pump() {
  if (modalOpen || !modalQ.length) return;
  const m = modalQ.shift();
  let body; try { body = modalHTML(m); } catch (e) { console.error(e); return pump(); } // a broken modal must never block the queue
  modalOpen = true;
  const el = document.createElement('div'); el.className = 'modal-wrap';
  el.innerHTML = `<div class="modal">${body}<button class="btn primary" data-close ${m.type === 'synccode' ? 'data-copy' : ''}>${m.type === 'chest' ? 'claim' : m.type === 'synccode' ? 'copy code' : 'nice'}</button></div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  if (m.type === 'level' || m.type === 'boss' || m.type === 'perfect') { confetti(); sfx('level'); buzz([30, 50, 30, 50, 60]); }
  else if (m.type === 'chest' || m.type === 'ach') { sfx('chest'); buzz([20, 30, 20]); }
  el.addEventListener('click', ev => {
    if (ev.target.closest('[data-copy]')) copySyncCode();
    if (ev.target.closest('[data-close]') || ev.target === el) { el.remove(); modalOpen = false; setTimeout(pump, 120); }
  });
}
function confetti() {
  const c = document.createElement('canvas'); c.className = 'confetti';
  const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr; document.body.appendChild(c);
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const cols = [RED, ORANGE, BLUE, INK, '#5fae4f'];
  const P = Array.from({ length: 110 }, () => ({ x: W / 2, y: H * 0.38, vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 12 - 4, r: Math.random() * 7 + 4, c: cols[Math.random() * cols.length | 0], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4 }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, W, H);
    for (const p of P) { p.vy += 0.33; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.strokeStyle = p.c; x.lineWidth = 2; x.lineCap = 'round'; x.beginPath(); x.moveTo(-p.r / 2, 0); x.quadraticCurveTo(0, -p.r / 3, p.r / 2, 0); x.stroke(); x.restore(); }
    if (++f < 130) requestAnimationFrame(tick); else c.remove();
  })();
}

/* ---------- views ---------- */
function render() {
  if (!state.onboarded) app.innerHTML = vOnboard();
  else {
    const views = { today: vToday, stats: vStats, quests: vQuests, log: vLog, me: vMe };
    app.innerHTML = `<main class="view">${views[ui.tab]()}</main>${nav()}`;
  }
  ui.just = null; ui.anim = '';
}
function nav() {
  const items = [['today', 'sprout', 'today'], ['stats', 'hex', 'stats'], ['quests', 'flag', 'quests'], ['log', 'scale', 'body'], ['me', 'xh', 'me']];
  return `<nav class="tabs">${items.map(([id, ic, l]) => `<button class="${ui.tab === id ? 'on' : ''}" data-act="tab" data-id="${id}">${icon(ic, { size: 24, sw: 1.7 })}<span>${l}</span></button>`).join('')}</nav>`;
}
const CHECK = '<svg viewBox="0 0 28 28" class="ck"><path d="M5 15c2.5 2 4.5 4.5 6 7 3-7 7-12.5 12-17"/></svg>';
const HALF = '<svg viewBox="0 0 28 28" class="ck"><path d="M7 21 21 7"/></svg>';

function habitRow(h, d) {
  return `<div class="row ${d ? 'done ' + d.t : ''} ${ui.just === h.id ? 'just' : ''}" data-act="full" data-id="${h.id}">
    <span class="box">${d ? (d.t === 'full' ? CHECK : HALF) : ''}</span>
    <span class="nm"><span class="hl">${esc(h.name)}</span>${d?.crit ? '<span class="critb hand">crit!</span>' : ''}</span>
    ${h.mini ? `<button class="half ${d?.t === 'mini' ? 'on' : ''}" data-act="mini" data-id="${h.id}" aria-label="Minimum version">½</button>` : ''}
    <span class="pts hand">${d ? '+' + d.xp : h.xp}</span>
  </div>`;
}
function questRow(q, done) {
  return `<div class="row ${done ? 'done full' : ''} ${ui.just === q.id ? 'just' : ''}" data-act="quest" data-id="${q.id}">
    <span class="box">${done ? CHECK : ''}</span>
    <span class="nm"><span class="hl">${esc(q.name)}</span></span>
    ${icon(STATS[q.stat].icon, { size: 16, color: STATS[q.stat].color })}
    <span class="pts hand">${done ? '+' : ''}${q.xp}</span>
  </div>`;
}
function upkeepTile(h, k) {
  const st = upkeepStatus(h, k), R = 21, C = 2 * Math.PI * R;
  const late = !st.done && st.due < 0, due = !st.done && st.due === 0;
  const label = st.done ? 'done' : st.never ? 'due' : late ? `${-st.due}d late` : due ? 'today' : `${st.due}d`;
  const ring = st.done ? `<circle cx="28" cy="28" r="${R}" fill="#fff3e6" stroke="${ORANGE}" stroke-width="3"/>`
    : late || due ? `<circle cx="28" cy="28" r="${R}" fill="none" stroke="${late ? RED : ORANGE}" stroke-width="2.6" stroke-dasharray="4 4.5"/>`
    : `<circle cx="28" cy="28" r="${R}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${f1(C * st.due / h.every)} ${f1(C)}" transform="rotate(-90 28 28)"/>`;
  const glyph = st.done ? '<path d="M4.5 13 9.5 18 19.5 6.5" stroke-width="2.6"/>' : `<path d="${ICONS[h.icon] || ICONS.sun}"/>`;
  return `<button class="tile ${st.done ? 'done' : ''} ${late ? 'late' : ''} ${due ? 'due' : ''} ${ui.just === h.id ? 'just' : ''}" data-act="full" data-id="${h.id}" aria-label="${esc(h.name)}: ${label}">
    <svg viewBox="0 0 56 56" class="ring"><g filter="url(#wob)"><circle cx="28" cy="28" r="${R}" fill="none" stroke="#ececec" stroke-width="3"/>${ring}
    <g transform="translate(16 16)" fill="none" stroke="${st.done ? ORANGE : late ? RED : INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></g></svg>
    <span class="tn">${esc(h.short || h.name)}</span><span class="ts hand">${label}</span></button>`;
}
function upkeepStrip(k) {
  const hs = upkeepHabits(); if (!hs.length) return '';
  const urgency = h => { const s = upkeepStatus(h, k); return s.done ? 1e3 + s.due : s.due; };
  return `<section class="grp"><div class="gh">${icon('scissors', { size: 18, color: INK })}<span class="gname hand">upkeep</span><span class="glv hand">on a timer</span></div>
    <div class="upkeep">${hs.sort((a, b) => urgency(a) - urgency(b)).map(h => upkeepTile(h, k)).join('')}</div></section>`;
}
function bubbleLine(k, st, e, done, min) {
  if (k !== today()) return '';
  if (st.yesterdayMissed && !st.todayDone) return st.frozen.has(st.yesterday) ? 'shield saved us. never miss twice.' : 'never miss twice. ½ counts.';
  if (e.bonus?.perfect) return 'flawless.';
  const over = upkeepHabits().map(h => [h, upkeepStatus(h, k)]).filter(([, s]) => !s.done && !s.never && s.due < 0).sort((a, b) => a[1].due - b[1].due)[0];
  if (done >= min) return over ? `${over[0].short || over[0].name} is ${-over[1].due}d overdue.` : '';
  if (done === 0) return new Date().getHours() < 12 ? 'morning. first one?' : "first one's the hardest.";
  return `${min - done} more and it blooms.`;
}

// keep the speech bubble just above Xiaohei's head as the scene's cropped height changes (mirrors gardenScene)
function bubbleBottom(L) { const tipY = 227 - plantH(L), T = Math.max(0, Math.min(100, tipY - 112)); return f1((290 - 170) / (290 - T) * 100); }
function vToday() {
  const k = viewDay(), isT = k === today(), e = peek(k), t = totals(), lv = LV(t.total), st = streakInfo(), act = dailyHabits();
  const done = countDone(k), min = state.settings.minDaily, boss = bossFor(k);
  const hr = new Date().getHours(), late = isT && (hr >= 22 || hr < 4);
  const pose = ui.anim ? 'water' : done >= min ? (late ? 'stand' : 'cheer') : done > 0 ? 'water' : 'stand';
  const say = bubbleLine(k, st, e, done, min);
  const canYest = addDays(today(), -1) >= state.created;
  const date = parseKey(k).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }).toLowerCase();
  const groups = STAT_ORDER.map(s => {
    const hs = act.filter(h => h.stat === s); if (!hs.length) return '';
    const sl = SLV(t.stats[s]);
    return `<section class="grp" style="--c:${STATS[s].color}">
      <div class="gh">${icon(STATS[s].icon, { size: 18, color: STATS[s].color })}<span class="gname hand">${STATS[s].name.toLowerCase()}</span><span class="gbar"><i style="width:${(sl.pct * 100).toFixed(0)}%"></i></span><span class="glv hand">lv ${sl.L}</span></div>
      ${hs.map(h => habitRow(h, e.done[h.id])).join('')}
    </section>`;
  }).join('');
  const hpLeft = +(boss.hp - boss.dmg).toFixed(1);
  return `<div class="top">
      <div><div class="date hand">${date}</div>
      ${canYest ? `<div class="daytog"><button class="${ui.day === 't' ? 'on' : ''}" data-act="day" data-id="t">today</button><button class="${ui.day === 'y' ? 'on' : ''}" data-act="day" data-id="y">yesterday</button></div>` : ''}</div>
      <div class="streak ${st.todayDone ? 'lit' : ''}">${icon('flame', { size: 28, color: st.todayDone ? ORANGE : '#c4c4c4', fill: st.todayDone ? '#ffe2c4' : 'none' })}<b class="hand">${st.streak}</b>
        <span class="shields">${Array.from({ length: st.shields }, () => icon('shield', { size: 13, color: BLUE, fill: '#e3ecfb' })).join('')}</span></div>
    </div>
    <div class="stage">
      ${gardenScene({ L: lv.L, rank: rankOf(lv.L).toLowerCase(), into: lv.into, need: lv.need, done, min, perfect: !!e.bonus?.perfect, pose, sleep: late && done >= min, anim: ui.anim })}
      <div class="bubble hand ${say ? 'show' : ''}" id="bubble" style="bottom:${bubbleBottom(lv.L)}%">${esc(say)}</div>
      <div class="xpline"><i style="width:${(lv.pct * 100).toFixed(1)}%"></i></div>
    </div>
    <p class="identity hand">becoming someone who ${esc(state.profile.identity || '…')}</p>
    ${groups || `<div class="empty hand">no habits yet. add some in <b>me</b>.</div>`}
    ${upkeepStrip(k)}
    <section class="grp" style="--c:${ORANGE}"><div class="gh">${icon('flag', { size: 18, color: ORANGE })}<span class="gname hand">side quests</span></div>
      ${questsFor(k).map(q => questRow(q, !!e.quests[q.id])).join('')}</section>
    <button class="bossstrip" data-act="tab" data-id="quests">
      <svg viewBox="-64 -112 128 124" class="bmini"><g filter="url(#wob)">${bossArt(boss.name, { dead: boss.defeated })}</g></svg>
      <span class="bsinfo"><span class="bname hand">${esc(boss.name.toLowerCase())}</span><span class="hpbar"><i style="width:${((1 - boss.dmg / boss.hp) * 100).toFixed(0)}%"></i></span></span>
      <span class="hpnum hand">${boss.defeated ? 'gg' : hpLeft + ' hp'}</span>
    </button>
    <label class="win">${icon('pen', { size: 18, color: '#999' })}<input data-field="note" maxlength="280" value="${esc(e.note)}" placeholder="one win ${isT ? 'today' : 'yesterday'}…"></label>`;
}

function radar(t) {
  const cx = 150, cy = 138, R = 90;
  const lv = STAT_ORDER.map(s => { const l = SLV(t.stats[s]); return l.L + l.pct; });
  const max = Math.max(5, Math.ceil(Math.max(...lv)));
  const pt = (i, r) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  let g = '';
  for (const f of [0.33, 0.66, 1]) g += `<polygon points="${STAT_ORDER.map((_, i) => pt(i, R * f).map(f1).join(',')).join(' ')}" fill="none" stroke="#d6d6d6" stroke-width="1.2"/>`;
  STAT_ORDER.forEach((s, i) => {
    const [x, y] = pt(i, R), [lx, ly] = pt(i, R + 30);
    g += `<line x1="${cx}" y1="${cy}" x2="${f1(x)}" y2="${f1(y)}" stroke="#d6d6d6" stroke-width="1.2"/>`;
    g += `<g transform="translate(${f1(lx - 10)} ${f1(ly - 18)})"><path d="${ICONS[STATS[s].icon]}" transform="scale(.85)" fill="none" stroke="${STATS[s].color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g><text x="${f1(lx)}" y="${f1(ly + 14)}" class="hand" font-size="15" text-anchor="middle" fill="${INK}">lv ${Math.floor(lv[i])}</text>`;
  });
  const poly = STAT_ORDER.map((_, i) => pt(i, R * lv[i] / max).map(f1).join(',')).join(' ');
  return `<svg class="radar" viewBox="0 0 300 285" role="img" aria-label="Stat radar"><g filter="url(#wob)">${g}
    <polygon points="${poly}" fill="${ORANGE}" fill-opacity=".14" stroke="${ORANGE}" stroke-width="2.4" stroke-linejoin="round"/></g></svg>`;
}
function heat() {
  const t = today(), n = dailyHabits().length || 1, start = addDays(weekStart(t), -77);
  let cells = '';
  for (let w = 0; w < 12; w++) for (let d = 0; d < 7; d++) {
    const k = addDays(start, w * 7 + d), r = countDone(k) / n;
    const c = k > t ? 'hx' : r === 0 ? 'h0' : r < 0.34 ? 'h1' : r < 0.67 ? 'h2' : r < 1 ? 'h3' : 'h4';
    cells += `<i class="${c}${k === t ? ' now' : ''}" style="grid-column:${w + 1};grid-row:${d + 1}"></i>`;
  }
  return `<div class="heat">${cells}</div>`;
}
function insights() {
  const out = [], act = dailyHabits(), days14 = lastN(14).filter(k => k >= state.created);
  if (days14.length >= 3) {
    const rate = {};
    for (const s of STAT_ORDER) { const hs = act.filter(h => h.stat === s); if (!hs.length) continue; let d = 0; for (const k of days14) for (const h of hs) if (peek(k).done[h.id]) d++; rate[s] = d / (hs.length * days14.length); }
    const ent = Object.entries(rate).sort((a, b) => a[1] - b[1]);
    if (ent.length > 1) {
      out.push([icon('flag', { size: 18, color: RED }), `weakest · <b>${STATS[ent[0][0]].name}</b> ${pct(ent[0][1])}`]);
      out.push([icon('trophy', { size: 18, color: ORANGE }), `strongest · <b>${STATS[ent.at(-1)[0]].name}</b> ${pct(ent.at(-1)[1])}`]);
    }
  }
  const good = [], bad = [];
  for (const k of Object.keys(state.log)) { const sl = parseFloat(state.log[k].m?.sleep); if (!isNaN(sl)) (sl >= 7.5 ? good : bad).push(countDone(k)); }
  if (good.length >= 3 && bad.length >= 3) out.push([icon('moon', { size: 18, color: BLUE }), `7.5h+ sleep → <b>${avg(good).toFixed(1)}</b> habits vs <b>${avg(bad).toFixed(1)}</b>`]);
  const days = lastN(56).filter(k => k >= state.created && k < today());
  if (days.length >= 14) {
    const wd = Array.from({ length: 7 }, () => []); for (const k of days) wd[dow(k)].push(countDone(k));
    const v = wd.map((a, i) => [a.length ? avg(a) : null, i]).filter(x => x[0] != null).sort((a, b) => a[0] - b[0]);
    out.push([icon('calendar', { size: 18, color: INK }), `best <b>${DOW[v.at(-1)[1]].slice(0, 3)}</b> · toughest <b>${DOW[v[0][1]].slice(0, 3)}</b>`]);
  }
  if (!out.length) return `<li class="muted hand">log a few days to unlock.</li>`;
  return out.map(([i, x]) => `<li>${i}<span>${x}</span></li>`).join('');
}
function habitStreak(id) { let k = today(), n = 0; if (!peek(k).done[id]) k = addDays(k, -1); while (peek(k).done[id]) { n++; k = addDays(k, -1); } return n; }

function vStats() {
  const t = totals(), lv = LV(t.total), st = streakInfo(), c = achCtx();
  const days30 = lastN(30).filter(k => k >= state.created);
  const up = upkeepHabits().map(h => { const s = upkeepStatus(h, today());
    return `<div class="hrow" style="--c:${STATS[h.stat].color}">${icon(h.icon, { size: 15, color: STATS[h.stat].color })}<span class="hrn">${esc(h.name)}</span><span class="hand hs">${everyLabel(h.every)}</span><span class="hand hs ${!s.done && s.due < 0 ? 'late' : ''}">${s.done ? 'today' : s.never ? 'never' : s.since + 'd ago'}</span></div>`; }).join('');
  const rows = dailyHabits().map(h => {
    const r = days30.length ? days30.filter(k => peek(k).done[h.id]).length / days30.length : 0;
    return `<div class="hrow" style="--c:${STATS[h.stat].color}">${icon(STATS[h.stat].icon, { size: 15, color: STATS[h.stat].color })}<span class="hrn">${esc(h.name)}</span><span class="hand hs">${habitStreak(h.id)}d</span><span class="bar"><i style="width:${pct(r)}"></i></span></div>`;
  }).join('');
  return `<h1 class="title hand">character</h1>
    <div class="kpis">${[[lv.L, 'level'], [t.total, 'xp'], [st.best, 'best streak'], [c.comps, 'reps']].map(([v, l]) => `<div><b class="hand">${v.toLocaleString()}</b><span>${l}</span></div>`).join('')}</div>
    <section class="sheet">${radar(t)}
      ${STAT_ORDER.map(s => { const l = SLV(t.stats[s]); return `<div class="statrow" style="--c:${STATS[s].color}">${icon(STATS[s].icon, { size: 18, color: STATS[s].color })}<span>${STATS[s].name}</span><span class="bar"><i style="width:${(l.pct * 100).toFixed(0)}%"></i></span><b class="hand">lv ${l.L}</b></div>`; }).join('')}
    </section>
    <section class="sheet"><div class="sh hand">12 weeks</div>${heat()}</section>
    <section class="sheet"><div class="sh hand">notes</div><ul class="insights">${insights()}</ul></section>
    <section class="sheet"><div class="sh hand">habits · 30 days</div>${rows || '<div class="muted">no active habits.</div>'}</section>
    ${up ? `<section class="sheet"><div class="sh hand">upkeep</div>${up}</section>` : ''}`;
}

function vQuests() {
  const k = today(), boss = bossFor(k), e = peek(k);
  const got = ACHIEVEMENTS.filter(a => state.ach[a.id]).length;
  const hpLeft = +(boss.hp - boss.dmg).toFixed(1);
  return `<h1 class="title hand">quests</h1>
    <section class="sheet bossbox">
      ${bossScene(boss)}
      <div class="bosshead"><span class="hand bigname">${esc(boss.name.toLowerCase())}</span><span class="weak" style="color:${STATS[boss.stat].color}">${icon(STATS[boss.stat].icon, { size: 16, color: STATS[boss.stat].color })} weak to ${STATS[boss.stat].name.toLowerCase()}</span></div>
      <div class="hpbar big"><i style="width:${((1 - boss.dmg / boss.hp) * 100).toFixed(0)}%"></i></div>
      <div class="tiny">${boss.defeated ? 'defeated · +150 xp' : `${hpLeft}/${boss.hp} hp · ends sunday · +150 xp`}</div>
    </section>
    <section class="grp" style="--c:${ORANGE}"><div class="gh">${icon('flag', { size: 18, color: ORANGE })}<span class="gname hand">today's side quests</span></div>
      ${questsFor(k).map(q => questRow(q, !!e.quests[q.id])).join('')}</section>
    <div class="sh hand" style="margin-top:26px">stamps · ${got}/${ACHIEVEMENTS.length}</div>
    <div class="ach">${ACHIEVEMENTS.map(a => `<button class="a ${state.ach[a.id] ? 'got' : ''}" data-act="ach" data-id="${a.id}">${stamp(a.icon, { got: !!state.ach[a.id] })}<span>${esc(a.name)}</span></button>`).join('')}</div>`;
}

function battery(v, on) {
  let bars = ''; for (let i = 0; i < 5; i++) bars += `<rect x="${5 + i * 5.4}" y="7" width="3.6" height="10" rx=".8" fill="${i < v ? (on ? ORANGE : INK) : 'none'}"/>`;
  return `<svg viewBox="0 0 38 24" width="40" height="26"><g filter="url(#wob)"><rect x="2" y="4" width="30" height="16" rx="2.5" fill="none" stroke="${on ? ORANGE : INK}" stroke-width="1.8"/><path d="M33 10v4" stroke="${on ? ORANGE : INK}" stroke-width="2.4" stroke-linecap="round"/>${bars}</g></svg>`;
}
function spark(key, label, unit, color) {
  const pts = Object.keys(state.log).sort().map(k => [k, parseFloat(state.log[k].m?.[key])]).filter(p => !isNaN(p[1])).slice(-30);
  if (pts.length < 2) return `<div class="spark empty"><span class="hand">${label}</span><span class="muted small">2+ logs for a trend</span></div>`;
  const vs = pts.map(p => p[1]), mn = Math.min(...vs), mx = Math.max(...vs), rg = mx - mn || 1, W = 300, H = 60;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${f1(i / (pts.length - 1) * W)},${f1(H - 6 - (p[1] - mn) / rg * (H - 12))}`).join('');
  const delta = vs.at(-1) - vs[0];
  return `<div class="spark"><div class="sph"><span class="hand">${label}</span><b class="hand">${vs.at(-1)}${unit}</b><small style="color:${color}">${delta > 0 ? '+' : ''}${delta.toFixed(1)}</small></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg></div>`;
}
function vLog() {
  const k = today(), e = peek(k), imp = state.settings.units === 'imperial';
  const wu = imp ? 'lb' : 'kg', lu = imp ? 'in' : 'cm';
  const notes = Object.keys(state.log).sort().reverse().filter(d => state.log[d].note?.trim()).slice(0, 30);
  return `<h1 class="title hand">body</h1>
    <section class="sheet">
      <div class="metrics">
        <label><span class="hand">weight</span><input class="inp" type="number" inputmode="decimal" step="0.1" data-field="m.weight" value="${esc(e.m.weight)}" placeholder="${wu}"></label>
        <label><span class="hand">waist</span><input class="inp" type="number" inputmode="decimal" step="0.1" data-field="m.waist" value="${esc(e.m.waist)}" placeholder="${lu}"></label>
        <label><span class="hand">sleep</span><input class="inp" type="number" inputmode="decimal" step="0.25" data-field="m.sleep" value="${esc(e.m.sleep)}" placeholder="h"></label>
      </div>
      <div class="energy"><span class="hand">energy</span><div>${[1, 2, 3, 4, 5].map(v => `<button class="bat" data-act="energy" data-id="${v}" aria-label="Energy ${v}">${battery(v, String(e.m.energy) === String(v))}</button>`).join('')}</div></div>
    </section>
    <section class="sheet">${spark('weight', 'weight', wu, RED)}${spark('waist', 'waist', lu, ORANGE)}${spark('sleep', 'sleep', 'h', BLUE)}${spark('energy', 'energy', '/5', '#5fae4f')}</section>
    <section class="sheet"><div class="sh hand">wins</div>${notes.length ? `<ul class="journal">${notes.map(d => `<li><span class="hand jd">${parseKey(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase()}</span><span>${esc(state.log[d].note)}</span></li>`).join('')}</ul>` : '<div class="muted hand">your wins land here.</div>'}</section>`;
}

let deferredInstall = null;
function vMe() {
  const s = state.settings, standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const habitRows = STAT_ORDER.map(st => {
    const hs = allHabits().filter(h => h.stat === st);
    return `<div class="mgroup" style="--c:${STATS[st].color}"><div class="gh">${icon(STATS[st].icon, { size: 18, color: STATS[st].color })}<span class="gname hand">${STATS[st].name.toLowerCase()}</span></div>
      ${hs.map(h => `<div class="mh ${isOn(h) ? 'on' : ''}">
        <div class="mh-top"><button class="sw ${isOn(h) ? 'on' : ''}" data-act="habit-onoff" data-id="${h.id}" aria-label="Toggle ${esc(h.name)}"></button><span class="mh-n">${esc(h.name)}${isUpkeep(h) ? ` <span class="every hand">${everyLabel(h.every)}</span>` : ''}</span>${h.custom ? `<button class="x" data-act="del-custom" data-id="${h.id}" aria-label="Delete">${icon('x', { size: 16 })}</button>` : ''}</div>
        ${isOn(h) ? `<input class="cue hand" data-field="cue:${h.id}" value="${esc(cueOf(h))}" placeholder="after I ___, I will…">` : ''}
      </div>`).join('')}</div>`;
  }).join('');
  const syncPanel = `<section class="sheet syncbox">
      <div class="synchead">${icon('cloud', { size: 22, color: sync.code ? BLUE : '#aaa' })}<b>cloud sync</b><span id="syncstat" class="syncstat ${sync.status}">${syncStatusText()}</span></div>
      ${sync.code ? `<div class="code hand">${esc(sync.code)}</div>
        <div class="row2"><button class="btn" data-act="sync-copy">${icon('key', { size: 16 })} copy code</button><button class="btn" data-act="sync-now">${icon('loop', { size: 16 })} sync now</button></div>`
      : `<button class="btn primary" data-act="sync-on">turn on sync</button>`}
      <details class="pr"><summary>use a code from another device</summary>
        <input class="inp" id="sync-in" placeholder="word-word-xxxxx-xxxxx" autocapitalize="off" autocomplete="off" spellcheck="false" style="margin-top:8px">
        <button class="btn" data-act="sync-link">connect</button></details>
      <p class="muted small">your code is the key to your data. keep it private. anyone with it can read your progress.</p>
      ${sync.code ? '<button class="btn danger" data-act="sync-off">turn off on this device</button>' : ''}
    </section>`;
  return `<h1 class="title hand">me</h1>${syncPanel}
    ${!standalone ? `<section class="sheet install">${icon('download', { size: 20, color: ORANGE })}<div><b>add to home screen</b><div class="muted small">${ios ? 'safari → share → add to home screen' : 'browser menu → install app'}</div></div>${deferredInstall ? '<button class="btn primary sm" data-act="install">install</button>' : ''}</section>` : ''}
    <section class="sheet">
      <label class="lbl hand">name</label><input class="inp" data-field="name" value="${esc(state.profile.name)}" maxlength="30">
      <label class="lbl hand">becoming someone who…</label><textarea class="inp" data-field="identity" rows="2" maxlength="140">${esc(state.profile.identity)}</textarea>
    </section>
    <section class="sheet">
      <div class="setrow"><div><b>daily minimum</b><div class="muted small">to keep the streak</div></div>
        <div class="stepper"><button data-act="min" data-id="-1" aria-label="Less">${icon('minus', { size: 16 })}</button><b class="hand">${s.minDaily}</b><button data-act="min" data-id="1" aria-label="More">${icon('plus', { size: 16 })}</button></div></div>
      <div class="setrow"><b>sound</b><button class="sw ${s.sound ? 'on' : ''}" data-act="set" data-id="sound" aria-label="Sound"></button></div>
      <div class="setrow"><b>haptics</b><button class="sw ${s.haptics ? 'on' : ''}" data-act="set" data-id="haptics" aria-label="Haptics"></button></div>
      <div class="setrow"><b>units</b><div class="seg"><button class="${s.units === 'metric' ? 'on' : ''}" data-act="units" data-id="metric">kg/cm</button><button class="${s.units === 'imperial' ? 'on' : ''}" data-act="units" data-id="imperial">lb/in</button></div></div>
    </section>
    <div class="sh hand" style="margin-top:26px">habits · ${activeHabits().length} on</div>
    ${habitRows}
    <section class="sheet">
      <div class="sh hand">new habit</div>
      <input class="inp" id="nh-name" placeholder="name" maxlength="60">
      <input class="inp" id="nh-mini" placeholder="½ version (optional)" maxlength="60" style="margin-top:8px">
      <div class="row2"><select class="inp" id="nh-stat">${STAT_ORDER.map(st => `<option value="${st}">${STATS[st].name}</option>`).join('')}</select>
      <select class="inp" id="nh-xp"><option value="5">+5 xp</option><option value="10" selected>+10 xp</option><option value="15">+15 xp</option><option value="25">+25 xp</option></select></div>
      <select class="inp" id="nh-every" style="margin-top:10px"><option value="1">daily</option><option value="7">weekly</option><option value="14">every 2 weeks</option><option value="30">monthly</option><option value="90">every 3 months</option></select>
      <button class="btn" data-act="add-custom">add</button>
    </section>
    <section class="sheet"><div class="sh hand">why it works</div>${PRINCIPLES.map(p => `<details class="pr"><summary>${esc(p.t)}</summary><p>${esc(p.d)}</p></details>`).join('')}</section>
    <section class="sheet"><div class="sh hand">data</div><p class="muted small">stored on this device only.</p>
      <div class="row2"><button class="btn" data-act="export">${icon('download', { size: 16 })} export</button><button class="btn" data-act="import">${icon('upload', { size: 16 })} import</button></div>
      <button class="btn danger" data-act="reset">reset everything</button></section>`;
}

function vOnboard() {
  const s = ui.onboard, dots = `<div class="dots">${[0, 1, 2].map(i => `<i class="${i === s ? 'on' : ''}"></i>`).join('')}</div>`;
  if (s === 0) return `<div class="ob">${dots}${seedScene()}
    <h1 class="hand big">lifemax</h1>
    <p class="lead">grow a better you,<br>one habit at a time.</p>
    <div class="pills"><span>${icon('up', { size: 15, color: ORANGE })} xp</span><span>${icon('flame', { size: 15, color: RED })} streaks</span><span>${icon('sword', { size: 15, color: BLUE })} bosses</span></div>
    <input class="inp" id="ob-name" value="${esc(state.profile.name)}" placeholder="your name" maxlength="30">
    <button class="btn primary" data-act="ob-next">plant the seed</button>
    ${ui.restore ? `<div class="restore"><input class="inp" id="sync-in" placeholder="word-word-xxxxx-xxxxx" autocapitalize="off" autocomplete="off" spellcheck="false"><button class="btn" data-act="sync-link">restore my progress</button></div>`
      : `<button class="linkbtn hand" data-act="ob-restore">already playing? restore with your sync code</button>`}</div>`;
  if (s === 1) return `<div class="ob">${dots}${mirrorScene()}
    <h1 class="hand">who are you becoming?</h1>
    <div class="idlist">${IDENTITIES.map((t, i) => `<button class="chip ${state.profile.identity === t ? 'on' : ''}" data-act="ob-id" data-id="${i}">…${esc(t)}</button>`).join('')}</div>
    <textarea class="inp" id="ob-identity" rows="2" maxlength="140" placeholder="…or write your own">${esc(state.profile.identity)}</textarea>
    <div class="row2"><button class="btn" data-act="ob-back">back</button><button class="btn primary" data-act="ob-next">next</button></div></div>`;
  const n = dailyHabits().length;
  return `<div class="ob">${dots}${boxesScene()}
    <h1 class="hand">pick 6–10</h1>
    ${STAT_ORDER.map(st => `<div class="mgroup" style="--c:${STATS[st].color}"><div class="gh">${icon(STATS[st].icon, { size: 18, color: STATS[st].color })}<span class="gname hand">${STATS[st].name.toLowerCase()}</span></div>
      ${HABITS.filter(h => h.stat === st && !isUpkeep(h)).map(h => `<button class="row pick ${isOn(h) ? 'done full' : ''}" data-act="ob-habit" data-id="${h.id}"><span class="box">${isOn(h) ? CHECK : ''}</span><span class="nm">${esc(h.name)}</span></button>`).join('')}</div>`).join('')}
    <div class="mgroup"><div class="gh">${icon('scissors', { size: 18, color: INK })}<span class="gname hand">upkeep</span><span class="glv hand">on a timer, never breaks streaks</span></div>
      ${HABITS.filter(isUpkeep).map(h => `<button class="row pick ${isOn(h) ? 'done full' : ''}" data-act="ob-habit" data-id="${h.id}"><span class="box">${isOn(h) ? CHECK : ''}</span><span class="nm">${esc(h.name)} <span class="every hand">${everyLabel(h.every)}</span></span></button>`).join('')}</div>
    <div class="ob-foot"><div class="row2"><button class="btn" data-act="ob-back">back</button><button class="btn primary" data-act="ob-finish" ${n ? '' : 'disabled'}>start · ${n}</button></div>${n > 10 ? '<div class="warn hand">that\'s a lot. fewer, done daily, wins.</div>' : ''}</div></div>`;
}

/* ---------- events ---------- */
let pokeT;
app.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const id = el.dataset.id;
  switch (el.dataset.act) {
    case 'full': return toggleHabit(id, 'full');
    case 'mini': {
      const wasMini = peek(viewDay()).done[id]?.t === 'mini';
      toggleHabit(id, 'mini');
      if (!wasMini) { const h = habitById(id); if (h?.mini) toast('½ · ' + h.mini); }
      return;
    }
    case 'quest': return toggleQuest(id);
    case 'poke': {
      const b = document.getElementById('bubble'), x = app.querySelector('.garden .xh');
      if (b) { b.textContent = SAYINGS[Math.random() * SAYINGS.length | 0]; b.classList.add('show'); clearTimeout(pokeT); pokeT = setTimeout(() => b.classList.remove('show'), 2600); }
      if (x) { x.classList.remove('hop'); void x.getBoundingClientRect(); x.classList.add('hop'); }
      sfx('pop'); buzz(10); return;
    }
    case 'ach': { const a = ACHIEVEMENTS.find(x => x.id === id); if (a) toast(state.ach[id] ? `${a.name} · ${a.desc}` : `locked · ${a.desc}`); return; }
    case 'tab': ui.tab = id; ui.day = 't'; render(); scrollTo(0, 0); return;
    case 'day': ui.day = id; return render();
    case 'energy': { const e = getDay(today()); e.m.energy = e.m.energy === id ? '' : id; save(); checkAch(); render(); pump(); return; }
    case 'min': touch(); state.settings.minDaily = Math.max(1, Math.min(10, state.settings.minDaily + Number(id))); save(); return render();
    case 'set': touch(); state.settings[id] = !state.settings[id]; save(); return render();
    case 'units': touch(); state.settings.units = id; save(); return render();
    case 'habit-onoff': { touch(); const before = snap(); const h = state.habits[id] || (state.habits[id] = { cue: '' }); h.on = !h.on; syncBonuses(today()); return commit(before); }
    case 'del-custom': if (confirm('Delete this habit? Past XP is kept.')) { touch(); state.custom = state.custom.filter(h => h.id !== id); delete state.habits[id]; save(); render(); } return;
    case 'add-custom': {
      const name = document.getElementById('nh-name').value.trim(); if (!name) return toast('give it a name first');
      const h = { id: 'c_' + Date.now().toString(36), stat: document.getElementById('nh-stat').value, xp: Number(document.getElementById('nh-xp').value), name, mini: document.getElementById('nh-mini').value.trim(), custom: true };
      const every = Number(document.getElementById('nh-every').value); if (every > 1) { h.every = every; h.short = name.toLowerCase().slice(0, 12); h.icon = 'sun'; h.mini = ''; }
      state.custom.push(h); state.habits[h.id] = { on: true, cue: '' }; touch(); save(); toast('habit added'); return render();
    }
    case 'sync-on': enableSync(); render(); pump(); return;
    case 'sync-off': if (confirm('Stop syncing this device? Your cloud copy stays safe under the code.')) { disableSync(); render(); } return;
    case 'sync-copy': return copySyncCode();
    case 'sync-now': return syncPull();
    case 'sync-link': return linkSyncCode(document.getElementById('sync-in')?.value);
    case 'ob-restore': ui.restore = true; render(); document.getElementById('sync-in')?.focus(); return;
    case 'export': return exportData();
    case 'import': return document.getElementById('imp').click();
    case 'reset': if (confirm('Erase all progress on this device?') && confirm(sync.code ? 'Sync will be turned off here. Your cloud copy stays restorable with your code.' : 'Really? This cannot be undone.')) { disableSync(); localStorage.removeItem(KEY); state = fresh(); ui.onboard = 0; ui.tab = 'today'; render(); } return;
    case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } return;
    case 'ob-next': {
      const n = document.getElementById('ob-name'), i = document.getElementById('ob-identity');
      if (n) state.profile.name = n.value.trim(); if (i) state.profile.identity = i.value.trim();
      ui.onboard++; touch(); save(); render(); scrollTo(0, 0); return;
    }
    case 'ob-back': { const i = document.getElementById('ob-identity'); if (i) state.profile.identity = i.value.trim(); ui.onboard--; return render(); }
    case 'ob-id': touch(); state.profile.identity = IDENTITIES[id]; return render();
    case 'ob-habit': touch(); state.habits[id].on = !state.habits[id].on; buzz(8); return render();
    case 'ob-finish': {
      state.onboarded = true; state.created = today(); touch();
      getDay(today()).bonus.starter = { xp: 50, label: 'Starter bonus' };
      queue({ type: 'welcome' }); if (!sync.code) enableSync(); save(); render(); pump(); scrollTo(0, 0); return;
    }
  }
});
app.addEventListener('change', ev => {
  const f = ev.target.dataset.field; if (!f) return;
  const v = ev.target.value;
  if (f === 'note') getDay(viewDay()).note = v.slice(0, 280);
  else if (f.startsWith('m.')) getDay(today()).m[f.slice(2)] = v;
  else {
    touch();
    if (f === 'name') state.profile.name = v.trim().slice(0, 30);
    else if (f === 'identity') state.profile.identity = v.trim().slice(0, 140);
    else if (f.startsWith('cue:')) { const id = f.slice(4); state.habits[id] = { ...(state.habits[id] || { on: false }), cue: v.trim().slice(0, 100) }; }
  }
  save(); checkAch(); pump(); // no re-render: keeps keyboard focus while moving between fields
});

async function exportData() {
  const json = JSON.stringify(state, null, 2), name = `lifemax-backup-${today()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Lifemax backup' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
document.getElementById('imp').addEventListener('change', async ev => {
  const file = ev.target.files[0]; ev.target.value = ''; if (!file) return;
  try {
    const s = JSON.parse(await file.text());
    if (s?.v !== 1 || typeof s.log !== 'object') throw new Error('bad');
    if (!confirm('Replace your current data with this backup?')) return;
    state = migrate(s); touch(); save(); render(); toast('backup restored');
  } catch (e) { toast('not a valid lifemax backup'); }
});

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (ui.tab === 'me') render(); });
let lastDay = today();
document.addEventListener('visibilitychange', () => { if (!document.hidden && today() !== lastDay) { lastDay = today(); ui.day = 't'; render(); } });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
// ask the browser not to evict our localStorage under storage pressure (granted automatically for installed apps on most phones)
navigator.storage?.persist?.().catch(() => {});

render();
if (sync.code) syncPull();
else if (state.onboarded) { enableSync(); pump(); }
