// lurkr: motion. Headlines rise word by word, a silk thread with a small spider measures the scroll,
// every section spins a corner web as you reach it, the hero leans in, buttons pull toward the pointer,
// and "how it works" plays as a pinned story driven by the scroll.
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches, FINE = matchMedia('(pointer: fine)').matches;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), ease = k => 1 - Math.pow(1 - clamp(k), 3), smooth = k => { k = clamp(k); return k * k * (3 - 2 * k); };

export function split(el) {
  if (!el || el.dataset.split) return; el.dataset.split = 1; let i = 0;
  const walk = n => [...n.childNodes].forEach(c => {
    if (c.nodeType === 3) { const f = document.createDocumentFragment(); c.textContent.split(/(\s+)/).forEach(w => { if (!w) return; if (/^\s+$/.test(w)) { f.appendChild(document.createTextNode(' ')); return; }
        const o = document.createElement('span'); o.className = 'w'; const s = document.createElement('span'); s.textContent = w; s.style.setProperty('--i', i++); o.appendChild(s); f.appendChild(o); }); c.replaceWith(f); }
    else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c); });
  walk(el); el.classList.add('split');
}
const GL = '01<>/\\|_-=+*#';
export function scramble(el, dur = 800) { if (!el || RM) return; const fin = el.textContent, t0 = performance.now();
  const f = now => { const k = Math.min(1, (now - t0) / dur); let s = ''; for (let i = 0; i < fin.length; i++) s += fin[i] === ' ' || i / fin.length < k ? fin[i] : GL[(Math.random() * GL.length) | 0]; el.textContent = s; if (k < 1) requestAnimationFrame(f); else el.textContent = fin; }; requestAnimationFrame(f); }

// a silk thread down the right edge; a small spider hangs at its end and sways with the scroll speed
function silk() {
  const g = document.createElement('div'); g.id = 'silk'; g.innerHTML = '<i></i><svg viewBox="0 0 40 40"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18 10 9 6 17M16 20 7 15 3 24M23 18l7-9 4 8M24 20l9-5 4 9M17 23l-7 5-2 8M23 23l7 5 2 8M18 24l-3 6 1 7M22 24l3 6-1 7"/></g><ellipse cx="20" cy="21" rx="5" ry="4.4" fill="currentColor"/><circle cx="18.4" cy="22.6" r="1" fill="#050506"/><circle cx="21.6" cy="22.6" r="1" fill="#050506"/><circle cx="20" cy="20" r=".7" fill="#050506"/></svg><span></span>';
  document.body.appendChild(g); const line = g.querySelector('i'), sp = g.querySelector('svg'), lab = g.querySelector('span');
  let cur = 0, v = 0, lastY = scrollY, sw = 0;
  (function f() { requestAnimationFrame(f); const max = document.documentElement.scrollHeight - innerHeight, k = max > 0 ? scrollY / max : 0; cur += (k - cur) * .1; const dy = scrollY - lastY; lastY = scrollY; v += (dy - v) * .08;
    sw += (-v * .9 - sw) * .08; const y = 80 + cur * (innerHeight - 190); line.style.height = y + 'px'; sp.style.transform = `translate(-50%, ${y - 4}px) rotate(${Math.max(-35, Math.min(35, sw)) + Math.sin(performance.now() / 900) * 4}deg)`;
    lab.style.transform = `translateY(${y + 40}px)`; lab.textContent = String(Math.round(cur * 100)).padStart(2, '0'); })();
}
// a corner web per section, spun as you scroll into it
function webs() {
  $$('.sec').forEach((sec, n) => {
    const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('viewBox', '0 0 400 400'); sv.classList.add('cweb'); if (n % 2) sv.classList.add('l');
    let d = ''; const cx = 400, cy = 0, R = 390, A = [100, 112, 124, 137, 150, 163, 176].map(a => a * Math.PI / 180);
    A.forEach(a => { d += `M${cx},${cy}L${cx + Math.cos(a) * R},${cy + Math.sin(a) * R}`; });
    for (let r = 30; r < R; r += 26 + r * .08) { A.forEach((a, i) => { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1); }); }
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); sv.appendChild(p); sec.appendChild(sv);
    const len = 9000; p.style.strokeDasharray = len; p.style.strokeDashoffset = len; sec.__web = { p, len };
  });
  const f = () => { requestAnimationFrame(f); $$('.sec').forEach(sec => { const w = sec.__web; if (!w) return; const r = sec.getBoundingClientRect(), k = clamp((innerHeight - r.top) / (innerHeight * 1.3)); w.p.style.strokeDashoffset = w.len * (1 - smooth(k)); }); };
  if (!RM) requestAnimationFrame(f); else $$('.cweb path').forEach(p => p.style.strokeDashoffset = 0);
}
function magnetic() { if (!FINE || RM) return; $$('.btn, .cta').forEach(b => { b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px, ${(e.clientY - r.top - r.height / 2) * .28}px)`; }); b.addEventListener('pointerleave', () => { b.style.transform = ''; }); }); }
function tilt() { if (!FINE || RM) return; $$('.manners, .states, .bform').forEach(el => { el.classList.add('tilt'); el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; el.style.setProperty('--gx', px * 100 + '%'); el.style.setProperty('--gy', py * 100 + '%'); }); }); }

// ---------- the pinned story: how a lurkr works, drawn as you scroll ----------
function story() {
  const box = $('#story'), cv = $('#storyCv'); if (!box || !cv) return; const steps = $$('#story .ss'); const x = cv.getContext('2d');
  const Q = [{ dx: .62, dy: .2, r: 3 }, { dx: .78, dy: .34, r: 1 }, { dx: .86, dy: .55, r: 5 }, { dx: .74, dy: .74, r: 2 }, { dx: .6, dy: .86, r: 6 }, { dx: .9, dy: .8, r: 4 }];
  function spider(cx, cy, s, t, walk = 0) { x.strokeStyle = '#e4e0d6'; x.lineWidth = 1.3 * s; x.lineCap = 'round';
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) { const w = Math.sin(t * 10 + k * 1.7 + side) * walk * 3 * s; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + side * (10 + k * 3) * s, cy - (12 - k * 2) * s + w); x.lineTo(cx + side * (15 + k * 4.2) * s, cy + (6 + k * 2.4) * s); x.stroke(); }
    x.fillStyle = '#e4e0d6'; x.beginPath(); x.ellipse(cx, cy - 2 * s, 6 * s, 5 * s, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(cx, cy + 4 * s, 4.4 * s, 3.6 * s, 0, 0, 7); x.fill();
    x.fillStyle = '#050506'; [[-1.6, 5, 1.2], [1.6, 5, 1.3], [-3.2, 3.6, .7], [3.2, 3.6, .7], [-.6, 2.8, .6], [.8, 2.8, .6]].forEach(([ex, ey, r]) => { x.beginPath(); x.arc(cx + ex * s, cy + ey * s, r * s, 0, 7); x.fill(); }); }
  function page(cx, cy, w, h, glow, lit = 0) { x.save(); x.fillStyle = glow ? `rgba(201,247,255,${.06 + .1 * glow})` : '#0f1115'; x.strokeStyle = glow ? `rgba(201,247,255,${.4 + .5 * glow})` : '#2a2d34'; x.lineWidth = 1.2;
    x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, 8); x.fill(); x.stroke(); x.fillStyle = '#2a2d34'; x.fillRect(cx - w / 2, cy - h / 2, w, 12); x.fillStyle = '#5b5e65'; [0, 1, 2].forEach(i => { x.beginPath(); x.arc(cx - w / 2 + 8 + i * 6, cy - h / 2 + 6, 2, 0, 7); x.fill(); });
    for (let i = 0; i < 5; i++) { const yy = cy - h / 2 + 22 + i * ((h - 30) / 5); if (yy > cy + h / 2 - 6) break; x.fillStyle = i === 2 && lit ? `rgba(201,247,255,${.35 + .5 * lit})` : '#25282e'; x.fillRect(cx - w / 2 + 10, yy, (w - 20) * (.5 + ((i * 37) % 10) / 22), 4); } x.restore(); }
  let p = 0, pt = 0;
  (function f(now) {
    requestAnimationFrame(f); const r = box.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const target = clamp((innerHeight * .5 - r.top) / (r.height - innerHeight * .2) * 4, 0, 3.999); p += (target - p) * .1; const t = now / 1000;
    steps.forEach((s, i) => s.classList.toggle('on', Math.floor(p + .15) === i || (i === 3 && p > 3.2)));
    const b = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); if (cv.width !== Math.round(b.width * d)) { cv.width = b.width * d; cv.height = b.height * d; }
    x.setTransform(d, 0, 0, d, 0, 0); const W = b.width, H = b.height; x.clearRect(0, 0, W, H);
    // a faint web behind everything
    x.strokeStyle = 'rgba(228,224,214,.05)'; x.lineWidth = 1; for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; x.beginPath(); x.moveTo(W * .3, H * .5); x.lineTo(W * .3 + Math.cos(a) * W, H * .5 + Math.sin(a) * W); x.stroke(); }
    const sx = W * .3, sy = H * .5, s = Math.min(W, H) / 420;
    // step 1: the start page, the lurkr on top of it
    const k1 = ease(clamp(p / .6)); page(sx, sy, 170 * s * k1, 120 * s * k1, 0);
    x.fillStyle = `rgba(138,141,147,${k1})`; x.font = `600 ${11 * s}px JBM, monospace`; x.fillText('START PAGE', sx - 85 * s, sy + 76 * s);
    // step 2: the words it watches for, hung on threads
    const k2 = ease(clamp(p - 1)); ['mainnet', 'airdrop', 'v2'].forEach((w, i) => { const a = -2.4 + i * .55, rr = 120 * s, wx = sx + Math.cos(a) * rr * k2, wy = sy - 70 * s + Math.sin(a) * rr * .6 * k2 - 30 * s; if (k2 <= 0) return;
      x.strokeStyle = `rgba(201,247,255,${.3 * k2})`; x.beginPath(); x.moveTo(sx, sy - 66 * s); x.lineTo(wx, wy); x.stroke(); x.font = `600 ${12 * s}px JBM, monospace`; const tw = x.measureText(w).width + 16 * s;
      x.fillStyle = `rgba(201,247,255,${.1 * k2})`; x.strokeStyle = `rgba(201,247,255,${.5 * k2})`; x.beginPath(); x.roundRect(wx - tw / 2, wy - 11 * s, tw, 22 * s, 11 * s); x.fill(); x.stroke(); x.fillStyle = `rgba(201,247,255,${k2})`; x.fillText(w, wx - tw / 2 + 8 * s, wy + 4 * s); });
    // step 3: links shoot out as threads to waiting pages; it walks to the best one
    const k3 = clamp(p - 2), best = Q[4];
    Q.forEach((q, i) => { const kk = ease(clamp(k3 * 2.2 - i * .12)); if (kk <= 0) return; const qx = sx + (W * q.dx - sx) * kk, qy = sy + (H * q.dy - sy) * kk;
      x.strokeStyle = q === best && p > 2.55 ? 'rgba(201,247,255,.7)' : 'rgba(228,224,214,.22)'; x.lineWidth = 1; x.beginPath(); x.moveTo(sx + 85 * s, sy); x.quadraticCurveTo((sx + qx) / 2, Math.min(sy, qy) - 30 * s, qx, qy); x.stroke();
      const lit = q === best ? ease(clamp((p - 3) * 1.6)) : 0; page(qx, qy, (q === best ? 54 + 86 * lit : 54) * s, (q === best ? 38 + 62 * lit : 38) * s, lit, lit);
      x.fillStyle = q === best ? '#c9f7ff' : '#8a8d93'; x.font = `700 ${10 * s}px JBM, monospace`; x.fillText('#' + q.r, qx - 27 * s, qy - 24 * s - (q === best ? 31 * lit * s : 0)); });
    if (k3 > 0) { x.fillStyle = '#8a8d93'; x.font = `600 ${11 * s}px JBM, monospace`; x.fillText(Math.max(0, Math.round(6 - clamp((p - 2.6) * 2) * 1)) + ' LINKS WAITING · BEST FIRST', W * .56, H * .08); }
    // the lurkr: on the start page, then along the best thread
    const walkK = smooth(clamp((p - 2.55) / .45)); const bx = W * best.dx, by = H * best.dy;
    const lx = sx + (bx - sx) * walkK, ly = (sy - 66 * s) + (by - 40 * s - (sy - 66 * s)) * walkK - Math.sin(walkK * Math.PI) * 50 * s;
    if (k1 > .2) spider(lx, ly, s * 1.15, t, walkK > 0 && walkK < 1 ? 1 : .15);
    // step 4: a find, with its passage
    const k4 = ease(clamp((p - 3.15) * 1.8)); if (k4 > 0) { const w = 280 * s, h = 64 * s, cx = Math.max(12, Math.min(W - w - 12, bx - w + 40 * s)), cy = Math.max(12, by - 150 * s); x.globalAlpha = k4;
      x.fillStyle = '#0f1115'; x.strokeStyle = 'rgba(201,247,255,.5)'; x.beginPath(); x.roundRect(cx, cy, w, h, 10 * s); x.fill(); x.stroke();
      x.font = `600 ${10 * s}px JBM, monospace`; x.fillStyle = '#c9f7ff'; x.fillText('FIND · “MAINNET” · MATCHED, NOT CHECKED', cx + 12 * s, cy + 18 * s);
      x.font = `400 ${13 * s}px Inter, sans-serif`; x.fillStyle = '#b8b5ad'; x.fillText('…the', cx + 12 * s, cy + 44 * s); const w1 = x.measureText('…the ').width; x.fillStyle = 'rgba(201,247,255,.18)'; const w2 = x.measureText('mainnet').width; x.fillRect(cx + 12 * s + w1, cy + 31 * s, w2, 18 * s);
      x.fillStyle = '#c9f7ff'; x.fillText('mainnet', cx + 12 * s + w1, cy + 44 * s); x.fillStyle = '#b8b5ad'; x.fillText(' launch is scheduled for…', cx + 12 * s + w1 + w2, cy + 44 * s); x.globalAlpha = 1; }
  })(performance.now());
}

export function initFx({ stageSt } = {}) {
  $$('.sec h2, .end h2').forEach(split);
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); e.target.classList.add('shown'); const lab = e.target.parentElement && e.target.parentElement.querySelector('.sl'); lab && scramble(lab, 700); }), { threshold: .25 });
  $$('.split').forEach(h => io.observe(h));
  silk(); webs(); magnetic(); tilt(); story();
  // headlines drift a little slower than the page; groups of cards and rows come in one after another
  const heads = $$('.sec h2, .end h2');
  (function par() { requestAnimationFrame(par); if (RM) return; for (const h of heads) { const r = h.getBoundingClientRect(); if (r.bottom < -100 || r.top > innerHeight + 100) continue; h.style.transform = `translateY(${((r.top + r.height / 2) - innerHeight / 2) * -.06}px)`; } })();
  $$('.manners tr, .states .st, .stats .stat, details, .bsec').forEach((el, i, all) => { el.classList.add('stg'); el.style.setProperty('--d', ((i % 8) * 70) + 'ms'); });
  const so = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); so.unobserve(e.target); } }), { threshold: .1, rootMargin: '0px 0px -8% 0px' });
  $$('.stg').forEach(el => so.observe(el));
  // the hero leans in as you scroll: the copy lifts and fades, the camera moves toward its eyes
  const copy = $('.hero-copy'), hero = $('.hero');
  (function f() { requestAnimationFrame(f); if (!hero) return; const k = clamp(scrollY / (hero.offsetHeight || 1)); if (stageSt) stageSt.reel = k;
    if (copy && innerWidth > 1000 && !document.documentElement.classList.contains('intro')) { copy.style.transform = `translateY(calc(-50% - ${k * 140}px))`; copy.style.opacity = String(1 - k * 1.5); } })();
  return { revealHero() { const h = $('.hero-copy h1'); if (h) { split(h); requestAnimationFrame(() => h.classList.add('shown')); } scramble($('.eyebrow span:last-child'), 900); } };
}
