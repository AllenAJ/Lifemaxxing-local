'use strict';
// Cloud sync. localStorage stays the source of truth for the UI; every save is mirrored to /api/sync
// (debounced, offline-tolerant). Conflicts between devices merge day by day using per-day timestamps.
// Uses globals from app.js at call time: state, KEY, migrate, render, toast, queue, pump.

const SYNC_KEY = 'lifemax.sync';
const SYNC_CODE_RE = /^[a-z]+-[a-z]+-[a-z2-9]{5}-[a-z2-9]{5}$/;
const SYNC_WORDS = ['sprout', 'ninja', 'pebble', 'comet', 'maple', 'otter', 'cedar', 'ember', 'lotus', 'raven', 'tiger', 'cobalt', 'fable', 'gizmo', 'hazel', 'indigo',
  'jolly', 'koala', 'lunar', 'mango', 'nova', 'olive', 'pixel', 'quill', 'river', 'sable', 'tulip', 'umber', 'vivid', 'willow', 'yonder', 'zephyr'];
const sync = { code: '', rev: 0, last: 0, dirty: false, status: 'off', busy: false, again: false, timer: null, ver: 0 };

try { const s = JSON.parse(localStorage.getItem(SYNC_KEY)); if (s) Object.assign(sync, { code: s.code || '', rev: s.rev || 0, last: s.last || 0, dirty: !!s.dirty }); } catch (e) {}
sync.status = sync.code ? 'idle' : 'off';

function saveSync() { try { localStorage.setItem(SYNC_KEY, JSON.stringify({ code: sync.code, rev: sync.rev, last: sync.last, dirty: sync.dirty })); } catch (e) {} }
function newSyncCode() {
  const r = crypto.getRandomValues(new Uint8Array(12)), A = 'abcdefghjkmnpqrstuvwxyz23456789';
  const c = i => A[r[i] % A.length];
  return `${SYNC_WORDS[r[0] % 32]}-${SYNC_WORDS[r[1] % 32]}-${[2, 3, 4, 5, 6].map(c).join('')}-${[7, 8, 9, 10, 11].map(c).join('')}`;
}
const normCode = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '');

async function syncApi(method, body, code = sync.code) {
  const r = await fetch('/api/sync', { method, cache: 'no-store', headers: { 'x-sync-code': code, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

/* ---------- status ---------- */
function syncAgo() { const s = (Date.now() - sync.last) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`; }
function syncStatusText() {
  return { off: 'off', idle: 'waiting…', syncing: 'syncing…', synced: `synced · ${syncAgo()}`, offline: 'offline · will retry', noserver: 'server not set up yet', error: 'error · will retry' }[sync.status] || sync.status;
}
function setSyncStatus(s) {
  sync.status = s;
  const el = document.getElementById('syncstat');
  if (el) { el.textContent = syncStatusText(); el.className = 'syncstat ' + s; }
}

/* ---------- merge ---------- */
// Settings/profile/habits: newest wins (state.mt). Days: newest wins per day (entry.t). Achievements: union, earliest date.
function mergeStates(a, b) {
  const meta = (b.mt || 0) > (a.mt || 0) ? b : a;
  const out = { ...meta, log: { ...a.log }, ach: { ...a.ach }, flags: { ...a.flags, ...b.flags } };
  for (const [k, e] of Object.entries(b.log || {})) { const mine = out.log[k]; if (!mine || (e.t || 0) > (mine.t || 0)) out.log[k] = e; }
  for (const [id, d] of Object.entries(b.ach || {})) if (!out.ach[id] || d < out.ach[id]) out.ach[id] = d;
  out.created = [a.created, b.created].filter(Boolean).sort()[0];
  out.onboarded = !!(a.onboarded || b.onboarded);
  return migrate(out);
}

/* ---------- push / pull ---------- */
function markDirty() {
  if (!sync.code) return;
  sync.dirty = true; sync.ver++; saveSync();
  clearTimeout(sync.timer); sync.timer = setTimeout(syncPush, 1500);
}
async function syncPush() {
  if (!sync.code) return;
  if (sync.busy) { sync.again = true; return; }
  if (!navigator.onLine) return setSyncStatus('offline');
  sync.busy = true; setSyncStatus('syncing');
  const v = sync.ver;
  try {
    const r = await syncApi('PUT', { baseRev: sync.rev, data: state });
    if (r.status === 200) { sync.rev = r.rev; sync.last = Date.now(); if (sync.ver === v) sync.dirty = false; setSyncStatus('synced'); }
    else if (r.status === 409) { sync.busy = false; await syncPull(); return; }
    else setSyncStatus(r.status === 503 ? 'noserver' : 'error');
  } catch (e) { setSyncStatus('offline'); }
  finally { sync.busy = false; saveSync(); }
  if (sync.again || sync.dirty && sync.status === 'synced') { sync.again = false; if (sync.dirty) { clearTimeout(sync.timer); sync.timer = setTimeout(syncPush, 300); } }
}
async function syncPull() {
  if (!sync.code || sync.busy) return;
  sync.busy = true; setSyncStatus('syncing');
  try {
    const r = await syncApi('GET');
    if (r.status === 404) { sync.rev = 0; sync.dirty = true; } // nothing in the cloud yet: uploaded below
    else if (r.status !== 200) setSyncStatus(r.status === 503 ? 'noserver' : 'error');
    else {
      const remote = JSON.stringify(migrate(structuredClone(r.data)));
      const merged = mergeStates(state, r.data), mergedJson = JSON.stringify(merged);
      sync.rev = r.rev; sync.last = Date.now();
      if (mergedJson !== JSON.stringify(state)) { state = merged; localStorage.setItem(KEY, mergedJson); render(); }
      sync.dirty = mergedJson !== remote;
      setSyncStatus('synced');
    }
  } catch (e) { setSyncStatus('offline'); }
  finally { sync.busy = false; saveSync(); }
  if (sync.dirty && (sync.status === 'synced' || sync.status === 'syncing')) { sync.ver++; syncPush(); }
}

/* ---------- user actions ---------- */
function enableSync({ showCode = true } = {}) {
  sync.code = newSyncCode(); sync.rev = 0; sync.dirty = true; sync.ver++; saveSync();
  if (showCode) queue({ type: 'synccode' });
  syncPush();
}
async function linkSyncCode(input) {
  const code = normCode(input);
  if (!SYNC_CODE_RE.test(code)) return toast('that code looks wrong');
  let r;
  try { r = await syncApi('GET', null, code); } catch (e) { return toast("offline. try again when you're connected"); }
  if (r.status === 404) return toast('no data under that code');
  if (r.status !== 200) return toast('sync server unavailable');
  if (state.onboarded && sync.code && sync.code !== code && !confirm("Merge this device's progress into that code? This device will use it from now on.")) return;
  sync.code = code; sync.rev = 0; saveSync();
  await syncPull();
  ui.tab = 'today'; render(); toast('synced with your code');
}
function disableSync() { sync.code = ''; sync.rev = 0; sync.dirty = false; clearTimeout(sync.timer); saveSync(); setSyncStatus('off'); }
function copySyncCode() { navigator.clipboard?.writeText(sync.code).then(() => toast('code copied'), () => toast(sync.code)); }

/* ---------- lifecycle ---------- */
window.addEventListener('online', () => { if (sync.code && sync.dirty) syncPush(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && sync.code && Date.now() - sync.last > 20000) syncPull(); });
setInterval(() => { if (sync.code && sync.dirty && !sync.busy) syncPush(); }, 60000);
