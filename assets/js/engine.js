// lurkr: the engine. Each lurkr reads one page at a time through /api/fetch, keeps a queue of links,
// learns which kinds of links lead to finds and reads those first. State lives in this browser (localStorage).
const KEY = 'lurkr.v1', PACE = { calm: 20, steady: 9, quick: 4 }, QCAP = 600, HOST_GAP = 4;
const DEPTH = { site: 4, wander: 2 };
const now = () => Date.now();
export const ADJ = ['Quiet', 'Pale', 'Hollow', 'Velvet', 'Night', 'Ash', 'Moss', 'Static', 'Silent', 'Grey', 'Lantern', 'Dust', 'Vesper', 'Thin', 'Long', 'Low'];
export const NOUN = ['Lurkr', 'Watcher', 'Reader', 'Creeper', 'Skitter', 'Weaver', 'Stitch', 'Spinner', 'Leg', 'Thread', 'Peeker', 'Crawler'];
export const suggestName = () => ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + NOUN[Math.floor(Math.random() * NOUN.length)];
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const site = h => { const p = h.split('.'); if (p.length <= 2) return h; const sld = p[p.length - 2], tld = p[p.length - 1]; return (tld.length === 2 && /^(co|com|org|net|gov|ac|edu)$/.test(sld)) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
const toks = (u, t) => { let s = ''; try { const x = new URL(u); s = x.pathname + ' ' + x.search; } catch {} return (s + ' ' + (t || '')).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && w.length < 24 && !/^\d+$/.test(w)).slice(0, 14); };

export class Lair {
  constructor() { this.L = []; this.listeners = new Set(); this.load(); this.timer = null; this.busy = new Set(); }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, lk, data) { this.listeners.forEach(fn => { try { fn(type, lk, data); } catch (e) { console.error(e); } }); }
  load() { try { const j = JSON.parse(localStorage.getItem(KEY) || '[]'); this.L = Array.isArray(j) ? j : []; } catch { this.L = []; } this.L.forEach(l => { if (l.status === 'crawling' || l.status === 'resting') { l.status = 'crawling'; l.note = 'Back to work'; } l.nextAt = Math.min(l.nextAt || 0, now() + 1500); }); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.L)); } catch (e) { /* storage full: trim the oldest finds */ this.L.forEach(l => { l.finds = l.finds.slice(-120); l.trail = l.trail.slice(-60); }); try { localStorage.setItem(KEY, JSON.stringify(this.L)); } catch {} } }
  get(id) { return this.L.find(l => l.id === id); }
  create({ name, look, orders }) {
    const start = normalize(orders.start); if (!start) throw new Error('give it a start page, like example.com');
    const lk = { id: Math.random().toString(36).slice(2, 10), name: (name || suggestName()).slice(0, 24), look, born: now(),
      orders: { start, words: (orders.words || []).map(w => w.trim()).filter(Boolean).slice(0, 8), range: orders.range === 'wander' ? 'wander' : 'site', pace: PACE[orders.pace] ? orders.pace : 'steady' },
      status: 'crawling', note: 'Heading to ' + host(start), nextAt: now() + 400,
      queue: [{ u: start, d: 0, s: 99, from: null, t: 'start' }], seen: {}, hosts: {},
      stats: { pages: 0, links: 0, finds: 0, failed: 0, bytes: 0 }, trail: [], finds: [],
      learn: { w: {}, judged: 0, early: { n: 0, hits: 0 }, late: [], near: {} } };
    this.L.unshift(lk); this.save(); this.emit('new', lk); this.ensure(); return lk;
  }
  remove(id) { this.L = this.L.filter(l => l.id !== id); this.save(); this.emit('gone', { id }); }
  pause(id, p) { const l = this.get(id); if (!l) return; l.status = p ? 'paused' : 'crawling'; l.note = p ? 'Paused' : 'Back to work'; l.nextAt = now() + 300; this.save(); this.emit('status', l); this.ensure(); }
  reorder(id, orders) { const l = this.get(id); if (!l) return; const start = normalize(orders.start) || l.orders.start; const fresh = start !== l.orders.start;
    l.orders = { ...l.orders, ...orders, start, words: (orders.words || l.orders.words).slice(0, 8) }; if (fresh) { l.queue = [{ u: start, d: 0, s: 99, from: null, t: 'start' }]; l.seen = {}; }
    l.status = 'crawling'; l.nextAt = now() + 300; this.save(); this.emit('status', l); this.ensure(); }
  ensure() { if (!this.timer) this.timer = setInterval(() => this.tick(), 500); }
  tick() {
    const t = now(); let running = 0;
    for (const l of this.L) {
      if (this.busy.has(l.id)) { running++; continue; }
      if (l.status === 'paused') continue;
      if (t < l.nextAt) continue;
      if (running >= 3) break;
      running++; this.step(l);
    }
  }
  score(l, link) { const w = l.learn.w; let s = 0; for (const k of toks(link.u, link.t)) s += w[k] || 0; const txt = (link.t + ' ' + link.u).toLowerCase(); for (const q of l.orders.words) if (txt.includes(q.toLowerCase())) s += 3; return s; }
  pick(l) {
    // the best-scoring link whose site we may visit now
    const t = now(); let best = -1, bs = -1e9;
    for (let i = 0; i < l.queue.length; i++) { const q = l.queue[i], h = host(q.u), hs = l.hosts[h]; if (hs && t < hs.next) continue; const sc = q.s - q.d * .4; if (sc > bs) { bs = sc; best = i; } }
    if (best < 0) return null; return l.queue.splice(best, 1)[0];
  }
  async step(l) {
    if (!l.queue.length) { // read everything in reach: rest, then reread the start page
      if (l.status !== 'resting') { l.status = 'resting'; l.note = 'Read everything in reach. Resting.'; this.emit('status', l); }
      l.nextAt = now() + 5 * 60e3; l.queue.push({ u: l.orders.start, d: 0, s: 99, from: null, t: 'start' }); delete l.seen[l.orders.start]; this.save(); return;
    }
    const q = this.pick(l); if (!q) { l.nextAt = now() + 1000; return; }
    if (l.seen[q.u]) { l.nextAt = now() + 50; return; }
    l.seen[q.u] = 1; const h = host(q.u);
    this.busy.add(l.id); l.status = 'crawling'; l.note = 'Reading ' + h + shortPath(q.u); this.emit('reading', l, q);
    let r; try { r = await fetch('/api/fetch?url=' + encodeURIComponent(q.u) + '&w=' + encodeURIComponent(l.orders.words.join(','))).then(x => x.json()); } catch (e) { r = { ok: false, reason: 'network: ' + e.message }; }
    this.busy.delete(l.id);
    const hs = l.hosts[h] || (l.hosts[h] = { pages: 0, finds: 0, first: now(), next: 0, delay: 0, fail: 0 });
    hs.delay = Math.max(HOST_GAP, r.delay || 0); hs.next = now() + hs.delay * 1000;
    const pace = PACE[l.orders.pace] * 1000;
    if (!r.ok) {
      l.stats.failed++; hs.fail++;
      const msg = 'Couldn\'t read ' + h + shortPath(q.u) + ': ' + (r.reason || 'unknown');
      this.trail(l, { k: 'fail', u: q.u, m: msg });
      if (q.t === 'start' && l.stats.pages === 0) { l.status = 'stuck'; l.note = 'Stuck: ' + (r.reason || 'the start page won\'t load') + '. Trying again in 10 min.'; l.nextAt = now() + 10 * 60e3; l.queue.push(q); delete l.seen[q.u]; }
      else { l.nextAt = now() + Math.min(pace, 3000); }
      this.save(); this.emit('status', l); return;
    }
    // read it
    l.stats.pages++; hs.pages++; l.stats.bytes += r.bytes || 0;
    const fh = host(r.url); if (fh !== h && !l.hosts[fh]) l.hosts[fh] = { pages: 0, finds: 0, first: now(), next: hs.next, delay: hs.delay, fail: 0 };
    const hit = (r.matches || []).length > 0, noWords = !l.orders.words.length;
    let kept = false;
    if (hit) { l.stats.finds++; hs.finds++; kept = true;
      const f = { id: Math.random().toString(36).slice(2, 9), u: r.url, title: r.title || r.url, at: now(), words: r.matches.map(m => m.w), n: r.matches.reduce((a, m) => a + m.n, 0), passage: r.matches[0].passage, all: r.matches.map(m => ({ w: m.w, n: m.n, p: m.passage })) };
      l.finds.push(f); if (l.finds.length > 300) l.finds.shift();
      this.trail(l, { k: 'find', u: r.url, m: 'Found ' + f.words.map(w => '“' + w + '”').join(', ') + ' on ' + fh + shortPath(r.url) });
      this.emit('find', l, f);
      // words it keeps seeing near the matches
      const near = l.learn.near; r.matches.forEach(m => m.passage.toLowerCase().split(/[^a-z0-9]+/).forEach(w => { if (w.length > 3 && w.length < 18 && !STOP.has(w) && !l.orders.words.some(x => x.toLowerCase() === w)) near[w] = (near[w] || 0) + 1; }));
    } else if (noWords && (r.textLen || 0) > 2500) { // no words given: keep the most substantial pages
      l.stats.finds++; hs.finds++; kept = true;
      const f = { id: Math.random().toString(36).slice(2, 9), u: r.url, title: r.title || r.url, at: now(), words: [], n: 0, passage: (r.snippet || '').slice(0, 240) + '…', all: [], note: 'worth a look: ' + Math.round(r.textLen / 1000) + 'k characters of text' };
      l.finds.push(f); if (l.finds.length > 300) l.finds.shift(); this.trail(l, { k: 'find', u: r.url, m: 'Kept ' + fh + shortPath(r.url) + ' (a long read)' }); this.emit('find', l, f);
    } else this.trail(l, { k: 'read', u: r.url, m: 'Read ' + fh + shortPath(r.url) + (r.title ? ' · ' + r.title.slice(0, 60) : '') });
    // the page graph for its web map: the last 140 pages it read, each tied to the page that led there
    l.pg = l.pg || []; l.pg.push({ u: r.url, from: q.from, find: kept, h: fh, t: (r.title || '').slice(0, 60) }); if (l.pg.length > 140) l.pg.shift();
    if (q.from) { const a = host(q.from); if (a && a !== fh) { l.edges = l.edges || {}; const k = a + '|' + fh; l.edges[k] = (l.edges[k] || 0) + 1; } }
    // learn: the tokens of the link that led here get credit (or a little blame)
    if (q.from) { const L2 = l.learn; L2.judged++; const ts = toks(q.u, q.t); ts.forEach(k => { L2.w[k] = Math.max(-2, Math.min(6, (L2.w[k] || 0) + (kept ? 1 : -.15))); });
      if (L2.early.n < 25) { L2.early.n++; if (kept) L2.early.hits++; } L2.late.push(kept ? 1 : 0); if (L2.late.length > 25) L2.late.shift(); }
    // follow its links
    const lim = DEPTH[l.orders.range], startSite = site(host(l.orders.start)); let added = 0;
    if (q.d < lim) for (const ln of (r.links || [])) {
      if (l.seen[ln.u] || l.queue.length >= QCAP) continue; const s2 = site(host(ln.u));
      if (l.orders.range === 'site' && s2 !== startSite) continue;
      const nd = q.d + 1; if (l.orders.range === 'wander' && nd > lim) continue;
      if (l.queue.some(x => x.u === ln.u)) continue;
      l.queue.push({ u: ln.u, d: nd, s: this.score(l, ln), from: r.url, t: ln.t }); added++;
    }
    l.stats.links += (r.links || []).length;
    l.note = (hit ? 'Got it. ' : '') + 'Next: ' + (l.queue.length ? l.queue.length + ' links waiting' : 'nothing left in reach');
    l.nextAt = now() + pace; this.save(); this.emit('read', l, { r, q, added, kept });
  }
  trail(l, e) { e.at = now(); l.trail.push(e); if (l.trail.length > 200) l.trail.shift(); this.emit('trail', l, e); }
}
const STOP = new Set('that this with from have will your they their there what when which more about into than then them these those were been also just like over only some such very most other after before here where while would could should because being does doing each every upon among within without across along page pages read more home menu search click privacy cookies terms copyright rights reserved'.split(' '));
const shortPath = u => { try { const x = new URL(u); const p = x.pathname === '/' ? '' : x.pathname; return (p.length > 38 ? p.slice(0, 36) + '…' : p); } catch { return ''; } };
export function normalize(s) { s = String(s || '').trim(); if (!s) return ''; if (!/^https?:\/\//i.test(s)) s = 'https://' + s; try { const u = new URL(s); if (!/\./.test(u.hostname) && u.hostname !== 'localhost') return ''; u.hash = ''; return u.href; } catch { return ''; } }
export function hitRates(l) { const e = l.learn.early, late = l.learn.late; return { early: e.n ? e.hits / e.n : null, late: late.length ? late.reduce((a, b) => a + b, 0) / late.length : null, judged: l.learn.judged }; }
export function heads(l, n = 6) { return Object.entries(l.learn.w).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k); }
export function avoids(l, n = 5) { return Object.entries(l.learn.w).filter(([, v]) => v < -.5).sort((a, b) => a[1] - b[1]).slice(0, n).map(([k]) => k); }
export function suggestWords(l, n = 6) { return Object.entries(l.learn.near).sort((a, b) => b[1] - a[1]).filter(([, c]) => c > 1).slice(0, n).map(([k, c]) => ({ w: k, c })); }
export { host, shortPath, site };
