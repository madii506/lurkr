// GET /api/fetch?url=...&w=word1,word2  — a lurkr reads one page.
// Public pages only: http(s), ports 80/443, no private or local addresses, robots.txt respected, HTML only, first 1.5 MB.
// Returns the page title, its links (with anchor text) and every watched word it mentions, with the passage around it.
const dns = require('dns').promises, net = require('net');
const UA = 'lurkrbot/1.0 (+https://lurkr.vercel.app; reads public pages for its owner, respects robots.txt)';
const MAX = 1.5 * 1024 * 1024, ROBOTS = new Map(), HITS = new Map();

function privateIp(ip) {
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  const s = ip.toLowerCase(); return s === '::1' || s === '::' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80') || s.startsWith('::ffff:127.') || s.startsWith('::ffff:10.') || s.startsWith('::ffff:192.168.');
}
async function safeUrl(raw) {
  let u; try { u = new URL(raw); } catch { throw new Error('not a valid address'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('only http and https');
  if (u.username || u.password) throw new Error('no logins');
  if (u.port && !['80', '443'].includes(u.port) && process.env.ALLOW_LOCAL !== '1') throw new Error('only ports 80 and 443');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (process.env.ALLOW_LOCAL !== '1') {
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('not a public site');
    const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => { throw new Error('site not found'); })).map(a => a.address);
    if (!ips.length || ips.some(privateIp)) throw new Error('not a public site');
  }
  u.hash = ''; return u;
}
async function readCapped(res, cap) {
  const reader = res.body.getReader(), chunks = []; let n = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; n += value.length; chunks.push(value); if (n >= cap) { try { reader.cancel(); } catch {} break; } }
  return { buf: Buffer.concat(chunks.map(c => Buffer.from(c))).subarray(0, cap), bytes: n, cut: n >= cap };
}
async function get(u, ms, cap) {   // follows up to 5 redirects, checking every hop
  let cur = u;
  for (let hop = 0; hop < 6; hop++) {
    const r = await fetch(cur, { redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-language': 'en' }, signal: AbortSignal.timeout(ms) });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { cur = await safeUrl(new URL(r.headers.get('location'), cur).href); continue; }
    return { r, final: cur };
  }
  throw new Error('too many redirects');
}
// robots.txt: the groups for "lurkrbot" or "*", longest matching rule wins
async function robots(u) {
  const key = u.protocol + '//' + u.host, hit = ROBOTS.get(key); if (hit && Date.now() - hit.at < 3600e3) return hit;
  let rules = { at: Date.now(), allow: [], dis: [], delay: 0, ok: true };
  try {
    const { r } = await get(new URL('/robots.txt', key), 4000, 512 * 1024);
    if (r.status >= 200 && r.status < 300) {
      const txt = (await readCapped(r, 512 * 1024)).buf.toString('utf8'); const groups = []; let g = null, lastUA = false;
      for (let line of txt.split(/\r?\n/)) { line = line.replace(/#.*/, '').trim(); if (!line) continue; const i = line.indexOf(':'); if (i < 0) continue;
        const k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim();
        if (k === 'user-agent') { if (!lastUA) { g = { ua: [], allow: [], dis: [], delay: 0 }; groups.push(g); } g.ua.push(v.toLowerCase()); lastUA = true; continue; }
        lastUA = false; if (!g) continue;
        if (k === 'disallow' && v) g.dis.push(v); else if (k === 'allow' && v) g.allow.push(v); else if (k === 'crawl-delay') g.delay = Math.min(60, parseFloat(v) || 0); }
      const mine = groups.filter(x => x.ua.some(a => a.includes('lurkr'))); const pick = mine.length ? mine : groups.filter(x => x.ua.includes('*'));
      pick.forEach(x => { rules.allow.push(...x.allow); rules.dis.push(...x.dis); rules.delay = Math.max(rules.delay, x.delay); });
    } else if (r.status === 401 || r.status === 403) { rules.dis = ['/']; }
  } catch { /* no robots.txt: everything public is allowed */ }
  ROBOTS.set(key, rules); return rules;
}
const toRe = p => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
function allowed(rules, path) {
  let best = null;
  for (const p of rules.dis) if (toRe(p).test(path) && (!best || p.length > best.len)) best = { len: p.length, ok: false };
  for (const p of rules.allow) if (toRe(p).test(path) && (!best || p.length >= best.len)) best = { len: p.length, ok: true };
  return !best || best.ok;
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©' };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m));
const clean = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function parse(html, base) {
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i), title = titleM ? clean(titleM[1]).slice(0, 160) : '';
  const baseM = html.match(/<base[^>]+href=["']?([^"' >]+)/i); let b = base; try { if (baseM) b = new URL(baseM[1], base); } catch {}
  const body = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ');
  const links = [], seen = new Set(), re = /<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(body)) && links.length < 400) {
    const href = (m[1] ?? m[2] ?? m[3] ?? '').trim(); if (!href || /^(mailto|javascript|tel|data):/i.test(href)) continue;
    let u; try { u = new URL(decode(href), b); } catch { continue; } if (!/^https?:$/.test(u.protocol)) continue; u.hash = '';
    if (/\.(png|jpe?g|gif|webp|svg|ico|pdf|zip|gz|mp4|mp3|webm|woff2?|ttf|css|js|json|xml|rss|dmg|exe|apk)(\?|$)/i.test(u.pathname)) continue;
    const k = u.href; if (seen.has(k)) continue; seen.add(k); links.push({ u: k, t: clean(m[4]).slice(0, 80) });
  }
  const text = clean(body.replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')) || clean(body);
  return { title, links, text };
}
function matches(text, words) {
  const out = [], low = text.toLowerCase();
  for (const w of words) {
    const q = w.toLowerCase(); if (!q) continue; let i = low.indexOf(q), n = 0, first = -1;
    while (i >= 0 && n < 50) { const before = i === 0 ? ' ' : low[i - 1], after = low[i + q.length] || ' ';
      if (!/[a-z0-9]/.test(before) || q.length > 4) { if (first < 0) first = i; n++; } i = low.indexOf(q, i + q.length); }
    if (first >= 0) { const a = Math.max(0, first - 120), z = Math.min(text.length, first + q.length + 120);
      out.push({ w, n, passage: (a > 0 ? '…' : '') + text.slice(a, z).trim() + (z < text.length ? '…' : ''), at: first - a + (a > 0 ? 1 : 0) }); }
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store'); res.setHeader('access-control-allow-origin', '*');
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'x', now = Date.now(), h = (HITS.get(ip) || []).filter(t => now - t < 60e3);
  if (h.length >= 90) return res.status(429).json({ ok: false, reason: 'slow down: too many pages this minute' }); h.push(now); HITS.set(ip, h);
  const t0 = Date.now();
  try {
    const u = await safeUrl(String(req.query.url || '')); const words = String(req.query.w || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
    const rb = await robots(u); if (!allowed(rb, u.pathname + u.search)) return res.json({ ok: false, url: u.href, reason: 'robots.txt asks crawlers to stay out', delay: rb.delay });
    const { r, final } = await get(u, 8000, MAX);
    if (r.status >= 400) return res.json({ ok: false, url: final.href, status: r.status, reason: 'the site answered ' + r.status, delay: rb.delay });
    const ct = (r.headers.get('content-type') || '').toLowerCase(); if (ct && !/text\/html|application\/xhtml/.test(ct)) { try { r.body.cancel(); } catch {} return res.json({ ok: false, url: final.href, status: r.status, reason: 'not a web page (' + ct.split(';')[0] + ')', delay: rb.delay }); }
    const { buf, bytes, cut } = await readCapped(r, MAX); const cs = (ct.match(/charset=([\w-]+)/) || [])[1]; let html;
    try { html = new TextDecoder(cs && /^(utf-?8|iso-8859-1|latin1|windows-1252)$/i.test(cs) ? cs : 'utf-8').decode(buf); } catch { html = buf.toString('utf8'); }
    const p = parse(html, final);
    return res.json({ ok: true, url: final.href, status: r.status, title: p.title, links: p.links, matches: matches(p.text, words), textLen: p.text.length, snippet: p.text.slice(0, 280), bytes, cut, ms: Date.now() - t0, delay: rb.delay });
  } catch (e) {
    const msg = e.name === 'TimeoutError' || /abort/i.test(e.message) ? 'the site took too long' : String(e.message || e).slice(0, 120);
    return res.json({ ok: false, url: String(req.query.url || ''), reason: msg, ms: Date.now() - t0 });
  }
};
