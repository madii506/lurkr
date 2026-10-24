// lurkr: the page. Intro, hero, the builder with a live 3D preview, your lurkrs at work, their finds.
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { createStage } from './stage.js';
import { createLurkr, poseStand, poseWalk, palps, mixPose, LOOKS } from './creature.js';
import { initFx } from './fx.js';
import { initWeb, initSmooth } from './bgweb.js';
import { Lair, suggestName, normalize, hitRates, heads, avoids, suggestWords, host, shortPath } from './engine.js';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const html = document.documentElement, mob = innerWidth < 1000;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = t => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? s + 's ago' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago'; };
const clock = t => new Date(t).toTimeString().slice(0, 8);
const lair = new Lair();
let mapState = null, reading = null;   // the web map's layout and the page being read right now

// ---------- intro + hero ----------
const intro = html.classList.contains('intro');
const stage = createStage($('#stage'), { intro, mobile: mob });
stage.st.flashEl = $('#flash');
const FX = initFx({ stageSt: stage.st }); initWeb(); initSmooth();
function endIntro() { if (!html.classList.contains('intro')) return; setTimeout(() => FX.revealHero(), 200); $('#intro').classList.add('out'); html.classList.remove('intro', 'screen-on'); try { sessionStorage.setItem('lurkr.seen', '1'); } catch {} setTimeout(() => $('#intro') && $('#intro').remove(), 900); }
stage.st.onIntroEnd = endIntro;
if (intro) { setTimeout(() => html.classList.add('screen-on'), 900); $('#iSkip').onclick = () => { stage.skip(); endIntro(); }; addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Enter') { stage.skip(); endIntro(); } }, { once: true }); }
else { $('#intro') && $('#intro').remove(); FX.revealHero(); }
addEventListener('scroll', () => { $('#nav').classList.toggle('solid', scrollY > 40); }, { passive: true });
const navIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) $$('.links a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
['how', 'build', 'lair', 'finds', 'faq'].forEach(id => navIO.observe(document.getElementById(id)));
$$('.sec .lede, .two .card, .builder > .card, .flist, .lair, details, .story-vis').forEach(el => el.classList.add('rv'));
const rvIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rvIO.unobserve(e.target); } }), { threshold: .08 });
$$('.rv').forEach(el => rvIO.observe(el));
function heroLive() { const L = lair.L, p = L.reduce((a, l) => a + l.stats.pages, 0), f = L.reduce((a, l) => a + l.stats.finds, 0), on = L.filter(l => l.status === 'crawling').length;
  $('#heroLive').innerHTML = L.length ? `<b>${L.length}</b> lurkr${L.length > 1 ? 's' : ''} in this browser · <b>${on}</b> crawling · <b>${p}</b> pages read · <b>${f}</b> finds` : 'No lurkrs in this browser yet.'; }

// ---------- how: the flow ticks through its steps ----------


// ---------- builder ----------
const B = { name: '', look: 'bone', eyes: 8, legs: 1, start: '', words: [], range: 'site', pace: 'steady' };
const PACE_TXT = { calm: 'a page every 20 seconds', steady: 'a page every 9 seconds', quick: 'a page every 4 seconds' };
function seg(id, key, cast = v => v) { $$('#' + id + ' button').forEach(b => b.onclick = () => { $$('#' + id + ' button').forEach(x => x.classList.toggle('on', x === b)); B[key] = cast(b.dataset.v); preview(); if (['look', 'eyes'].includes(key)) rebuild(); }); }
seg('bLook', 'look'); seg('bEyes', 'eyes', Number); seg('bRange', 'range'); seg('bPace', 'pace');
$('#bLegs').oninput = e => { B.legs = e.target.value / 100; $('#bLegsV').textContent = e.target.value + '%'; rebuild(); };
$('#bSuggest').onclick = () => { $('#bName').value = suggestName(); B.name = $('#bName').value; preview(); };
$('#bName').oninput = e => { B.name = e.target.value; preview(); };
$('#bStart').oninput = e => { B.start = e.target.value; preview(); };
const wIn = $('#bWordIn');
function words() { $$('#bWords .chip').forEach(c => c.remove()); B.words.forEach((w, i) => { const c = document.createElement('span'); c.className = 'chip'; c.innerHTML = esc(w) + '<button type="button" aria-label="remove">×</button>'; c.querySelector('button').onclick = () => { B.words.splice(i, 1); words(); }; $('#bWords').insertBefore(c, wIn); }); wIn.placeholder = B.words.length >= 8 ? 'that\'s 8' : B.words.length ? 'another word' : 'mainnet'; preview(); }
function addWord(v) { v = v.trim().replace(/,/g, ''); if (!v || B.words.length >= 8 || B.words.some(w => w.toLowerCase() === v.toLowerCase())) return; B.words.push(v.slice(0, 40)); words(); }
wIn.onkeydown = e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addWord(wIn.value); wIn.value = ''; } else if (e.key === 'Backspace' && !wIn.value && B.words.length) { B.words.pop(); words(); } };
wIn.onblur = () => { if (wIn.value.trim()) { addWord(wIn.value); wIn.value = ''; } };
$('#bWords').onclick = () => wIn.focus();
function preview() { $('#pvName').textContent = B.name || 'Quiet Lurkr'; $('#pvStart').textContent = normalize(B.start) ? host(normalize(B.start)) + shortPath(normalize(B.start)) : '—';
  $('#pvWords').textContent = B.words.length ? B.words.join(', ') : 'no words: it keeps the long reads'; $('#pvRange').textContent = B.range === 'site' ? 'stays on the site · 4 links deep' : 'wanders off · 2 links deep'; $('#pvPace').textContent = PACE_TXT[B.pace]; }
$('#bform').onsubmit = e => { e.preventDefault(); if (wIn.value.trim()) { addWord(wIn.value); wIn.value = ''; }
  try { const lk = lair.create({ name: B.name.trim() || suggestName(), look: { skin: B.look, eyes: B.eyes, legs: B.legs }, orders: { start: B.start, words: B.words, range: B.range, pace: B.pace } });
    $('#bErr').textContent = ''; sel = lk.id; renderLair(true); pv.scuttle(); $('#bGo').disabled = true; setTimeout(() => { $('#bGo').disabled = false; const y = document.getElementById('lair').getBoundingClientRect().top + scrollY - 20; window.__glideTo ? window.__glideTo(y) : scrollTo({ top: y, behavior: 'smooth' }); }, 1300); B.name = ''; $('#bName').value = ''; preview(); }
  catch (err) { $('#bErr').textContent = err.message; } };
preview();

// the 3D preview: your lurkr, standing, turning slowly (drag to turn it)
const pv = (() => {
  const cv = $('#prev'), r = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.toneMapping = THREE.ACESFilmicToneMapping; r.setClearColor(0x030304, 1); r.shadowMap.enabled = true;
  const sc = new THREE.Scene(); sc.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), .04).texture;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: .5 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.64; floor.receiveShadow = true; sc.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.62, 96), new THREE.MeshBasicMaterial({ color: 0x2a2d34 })); ring.rotation.x = -Math.PI / 2; ring.position.y = -.635; sc.add(ring);
  const sp = new THREE.SpotLight(0xffffff, 90, 0, .55, .6, 2); sp.position.set(2, 6, 5); sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sc.add(sp, sp.target);
  const rim = new THREE.DirectionalLight(0xbcd2ff, 1.4); rim.position.set(-3, 3, -4); sc.add(rim); sc.add(new THREE.HemisphereLight(0x8899aa, 0x050506, .2));
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 50); cam.position.set(0, 3.4, 8.6); cam.lookAt(0, -.05, 0);
  let lk = null, rot = .5, vel = .25, drag = null, vis = true, t = 0, last = performance.now(), run = null, back = null;
  const build = () => { if (lk) { sc.remove(lk.group); lk.group.traverse(o => { o.geometry && o.geometry.dispose(); }); } lk = createLurkr({ look: B.look, eyes: B.eyes, legLen: B.legs }); lk.group.castShadow = true; sc.add(lk.group); };
  const size = () => { const b = cv.getBoundingClientRect(); r.setSize(b.width, b.height, false); cam.aspect = b.width / Math.max(1, b.height); cam.updateProjectionMatrix(); };
  build(); size(); addEventListener('resize', size); new IntersectionObserver(e => { vis = e[0].isIntersecting; }).observe(cv);
  cv.addEventListener('pointerdown', e => { drag = e.clientX; cv.setPointerCapture(e.pointerId); }); cv.addEventListener('pointermove', e => { if (drag != null) { vel = (e.clientX - drag) * .01; rot += vel; drag = e.clientX; } }); cv.addEventListener('pointerup', () => { drag = null; });
  (function f(now) { requestAnimationFrame(f); const dt = Math.min(.05, (now - last) / 1000); last = now; if (!vis) return; t += dt; if (drag == null) { vel += (.25 - vel) * dt; rot += vel * dt; }
    if (run != null) {   // released: it turns and scuttles off to work
      const k = (now - run) / 1000; lk.group.rotation.y += ((Math.PI / 2) - lk.group.rotation.y) * Math.min(1, dt * 8); lk.setLegs(poseWalk(t, 14), palps(t)); lk.group.position.x = Math.max(0, k - .25) ** 1.6 * 7;
      if (k > 1.35) { run = null; back = now; build(); rot = .5; lk.group.scale.setScalar(.001); }
    } else {
      lk.setLegs(poseStand(t), palps(t)); lk.group.rotation.y = rot; lk.group.position.set(0, Math.sin(t * 1.7) * .015, 0); lk.head.rotation.y = Math.sin(t * .7) * .3;
      if (back != null) { const k = Math.min(1, (now - back) / 600); lk.group.scale.setScalar(1 - Math.pow(1 - k, 3)); if (k >= 1) back = null; }
    }
    r.render(sc, cam); })(last);
  return { build, scuttle() { run = performance.now(); } };
})();
function rebuild() { pv.build(); }

// ---------- your lurkrs ----------
let sel = lair.L[0] ? lair.L[0].id : null;
const SC = { crawling: ['s-c', 'crawling'], resting: ['s-r', 'resting'], stuck: ['s-s', 'stuck'], paused: ['s-p', 'paused'] };
function portrait(cv, look) {   // a small drawn portrait: body, eight long legs, the eye cluster
  const d = 2, x = cv.getContext('2d'); cv.width = 44 * d; cv.height = 44 * d; x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, 44, 44);
  const L = LOOKS[look.skin] || LOOKS.bone, col = '#' + L.skin.toString(16).padStart(6, '0'), dk = '#' + L.dark.toString(16).padStart(6, '0'); const ll = look.legs || 1;
  x.strokeStyle = col; x.lineWidth = 1.2; x.lineCap = 'round';
  for (let s of [-1, 1]) for (let k = 0; k < 4; k++) { const kx = 22 + s * (6 + k * 2.2) * ll, ky = 13 - k * .6, fx = 22 + s * (10 + k * 3) * ll, fy = 33 + k * 1.4 - (k > 1 ? 2 : 0); x.beginPath(); x.moveTo(22 + s * 2, 23); x.lineTo(kx, ky); x.lineTo(fx, fy); x.stroke(); }
  x.fillStyle = col; x.beginPath(); x.ellipse(22, 20, 5.2, 4.4, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(22, 25, 3.6, 3.1, 0, 0, 7); x.fill();
  x.fillStyle = '#050506'; const n = look.eyes || 8; [[-1.2, 25.4, 1.1], [1.3, 25.4, 1.2], [-2.6, 24, .6], [2.7, 24, .6], [-.6, 23.4, .5], [.8, 23.3, .5], [-3.4, 25.6, .45], [3.4, 25.8, .45], [-1.8, 22.8, .4], [2, 22.8, .4], [0, 24.4, .35], [-3.9, 24.2, .35]].slice(0, n).forEach(([ex, ey, r]) => { x.beginPath(); x.arc(22 + ex, ey, r, 0, 7); x.fill(); });
  x.fillStyle = dk; x.globalAlpha = .5; x.beginPath(); x.ellipse(22, 17.5, 1.6, .7, 0, 0, 7); x.fill(); x.globalAlpha = 1;
}
function renderRoster() {
  const R = $('#roster');
  if (!lair.L.length) { R.innerHTML = '<div class="empty">No lurkrs yet.<br><a class="btn" style="margin-top:14px" href="#build">build one</a></div>'; return; }
  R.innerHTML = lair.L.map(l => `<div class="rk ${l.id === sel ? 'on' : ''}" data-id="${l.id}"><canvas></canvas><div><b>${esc(l.name)}</b><small><i class="${SC[l.status][0]}" style="width:7px;height:7px;border-radius:50%;display:inline-block"></i>${SC[l.status][1]} · ${l.stats.pages} pages · ${l.stats.finds} finds</small></div></div>`).join('');
  $$('#roster .rk').forEach(el => { const l = lair.get(el.dataset.id); portrait(el.querySelector('canvas'), l.look); el.onclick = () => { sel = l.id; renderLair(true); }; });
}
function renderDetail(full) {
  const D = $('#detail'), l = lair.get(sel);
  if (!l) { D.innerHTML = `<div class="card empty" style="padding:60px 24px">Release a lurkr above and watch it here: every page it reads, every link it follows, every find.</div>`; return; }
  if (full || !D.querySelector('.dhead')) {
    D.innerHTML = `<div class="card dhead"><div><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><h3>${esc(l.name)}</h3><span class="pill" id="dPill"></span></div><div class="note" id="dNote"></div>
        <div class="note" style="color:var(--dim)">starts at ${esc(host(l.orders.start) + shortPath(l.orders.start))} · watches for ${l.orders.words.length ? esc(l.orders.words.join(', ')) : 'nothing in particular (keeps the long reads)'} · ${l.orders.range === 'site' ? 'stays on the site' : 'wanders off'} · ${l.orders.pace}</div></div>
        <div class="dact"><button class="mini" id="dPause"></button><button class="mini" id="dNow">read now</button><button class="mini" id="dDel">let it go</button></div></div>
      <div class="stats" id="dStats"></div>
      <div class="dgrid"><div class="card trail"><div class="ch">trail · live</div><div class="tl" id="dTrail"></div></div><div class="card map"><div class="ch">its web · every page it read</div><canvas id="dMap"></canvas></div></div>
      <div class="card learn" id="dLearn"></div>`;
    $('#dPause').onclick = () => lair.pause(l.id, l.status !== 'paused'); $('#dNow').onclick = () => { l.nextAt = Date.now(); if (l.status === 'stuck' || l.status === 'resting') { l.status = 'crawling'; } lair.ensure(); };
    $('#dDel').onclick = () => { if (confirmDel === l.id) { lair.remove(l.id); sel = lair.L[0] ? lair.L[0].id : null; renderLair(true); renderFinds(); } else { confirmDel = l.id; $('#dDel').textContent = 'sure? click again'; setTimeout(() => { confirmDel = null; const b = $('#dDel'); if (b) b.textContent = 'let it go'; }, 3000); } };
    $('#dTrail').innerHTML = l.trail.slice(-80).map(trailRow).join(''); $('#dTrail').scrollTop = 1e9; mapState = null;
  }
  const [cls, label] = SC[l.status]; $('#dPill').innerHTML = `<i class="${cls}"></i>${label}`; $('#dNote').textContent = l.note || ''; $('#dPause').textContent = l.status === 'paused' ? 'resume' : 'pause';
  const sites = Object.keys(l.hosts).filter(h => l.hosts[h].pages > 0).length;
  const SV = [['pages read', l.stats.pages], ['links seen', l.stats.links], ['finds', l.stats.finds], ['sites', sites], ['waiting', l.queue.length]];
  if (!$('#dStats').children.length) $('#dStats').innerHTML = SV.map(([k]) => `<div class="card stat"><small>${k}</small><b data-v="0">0</b></div>`).join('');
  $$('#dStats b').forEach((b, i) => countTo(b, SV[i][1]));
  const hr = hitRates(l), hd = heads(l), av = avoids(l), sw = suggestWords(l);
  $('#dLearn').innerHTML = `<div><div class="ch">what it learned</div><div class="lv">${hr.judged ? `<b>${hr.judged}</b> links judged` : 'Nothing judged yet: it needs a few pages first.'}${hr.early != null ? `<br>early hit rate <b>${Math.round(hr.early * 100)}%</b><div class="bar2"><i style="width:${hr.early * 100}%"></i></div>lately <b>${Math.round((hr.late || 0) * 100)}%</b><div class="bar2"><i style="width:${(hr.late || 0) * 100}%"></i></div>` : ''}</div></div>
    <div><div class="ch">heads for links about</div><div class="lv">${hd.length ? hd.map(esc).join(' · ') : '—'}</div><div class="ch" style="margin-top:16px">avoids</div><div class="lv">${av.length ? av.map(esc).join(' · ') : '—'}</div></div>
    <div><div class="ch">words it keeps seeing near finds</div><div class="sug">${sw.length ? sw.map(s => `<button data-w="${esc(s.w)}" title="seen ${s.c} times">+ ${esc(s.w)}</button>`).join('') : '<span class="lv">—</span>'}</div><p class="small" style="margin-top:10px">Click one to add it to its words.</p></div>`;
  $$('#dLearn .sug button').forEach(b => b.onclick = () => { if (l.orders.words.length >= 8) return; lair.reorder(l.id, { words: [...l.orders.words, b.dataset.w] }); renderLair(true); });
}
let confirmDel = null;
function countTo(el, to) { const from = +el.dataset.v || 0; if (from === to) { el.textContent = to.toLocaleString(); return; } el.dataset.v = to; const t0 = performance.now(), d = 650;
  (function f(now) { const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e).toLocaleString(); if (k < 1 && +el.dataset.v === to) requestAnimationFrame(f); })(t0); }
const trailRow = e => `<div class="${e.k}"><span class="t">${clock(e.at)}</span>${esc(e.m)}</div>`;
function renderLair(full) { renderRoster(); renderDetail(full); heroLive(); }
let pend = false; const soon = () => { if (pend) return; pend = true; setTimeout(() => { pend = false; renderLair(false); }, 350); };
lair.on((type, l, data) => {
  if (type === 'trail' && l.id === sel) { const T = $('#dTrail'); if (T) { const atEnd = T.scrollHeight - T.scrollTop - T.clientHeight < 40; T.insertAdjacentHTML('beforeend', trailRow(data)); while (T.children.length > 120) T.firstChild.remove(); if (atEnd) T.scrollTop = 1e9; } }
  if (type === 'find') findsSoon();
  if (type === 'reading' && l.id === sel) reading = data.u;
  soon();
});
renderLair(true);

// ---------- its web: every page it read, tied to the page that led there; the lurkr walks to the newest ----------
(function map() {
  let last = performance.now();
  function f(now) {
    requestAnimationFrame(f); const cv = $('#dMap'), l = lair.get(sel); if (!cv || !l) return; const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    const b = cv.getBoundingClientRect(); if (b.bottom < 0 || b.top > innerHeight) return; const d = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(b.width * d)) { cv.width = b.width * d; cv.height = b.height * d; } const x = cv.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); const W = b.width, H = b.height;
    if (!mapState || mapState.id !== l.id) mapState = { id: l.id, N: new Map(), spider: { x: W / 2, y: H / 2 }, born: new Map() };
    const N = mapState.N, P = l.pg || [], start = l.orders.start, startHost = host(start);
    P.forEach((p, i) => { if (!N.has(p.u)) { const par = p.from && N.get(p.from), a = Math.random() * 6.283, r = par ? 26 : 10;
      N.set(p.u, { x: (par ? par.x : W / 2) + Math.cos(a) * r, y: (par ? par.y : H / 2) + Math.sin(a) * r, vx: 0, vy: 0, p, t0: now }); } else N.get(p.u).p = p; });
    for (const k of [...N.keys()]) if (!P.some(p => p.u === k)) N.delete(k);
    const nodes = [...N.values()], E = nodes.filter(n => n.p.from && N.has(n.p.from)).map(n => [N.get(n.p.from), n]);
    // forces: repel, pull along links, gather to the middle
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const A = nodes[i], C = nodes[j]; const dx = C.x - A.x, dy = C.y - A.y, dd = dx * dx + dy * dy + .01, f2 = 260 / dd, dl = Math.sqrt(dd); A.vx -= dx / dl * f2; A.vy -= dy / dl * f2; C.vx += dx / dl * f2; C.vy += dy / dl * f2; }
    E.forEach(([A, C]) => { const dx = C.x - A.x, dy = C.y - A.y, dd = Math.sqrt(dx * dx + dy * dy) || 1, k = (dd - 34) * .02; A.vx += dx / dd * k; A.vy += dy / dd * k; C.vx -= dx / dd * k; C.vy -= dy / dd * k; });
    nodes.forEach(n => { n.vx += (W / 2 - n.x) * .004; n.vy += (H / 2 - n.y) * .004; n.vx *= .8; n.vy *= .8; n.x = Math.max(10, Math.min(W - 10, n.x + n.vx)); n.y = Math.max(10, Math.min(H - 10, n.y + n.vy)); });
    // draw: a faint orb web, silk between pages, pages as beads, finds glowing
    x.clearRect(0, 0, W, H); x.strokeStyle = 'rgba(228,224,214,.045)'; x.lineWidth = 1; const R = Math.max(W, H) * .7;
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; x.beginPath(); x.moveTo(W / 2, H / 2); x.lineTo(W / 2 + Math.cos(a) * R, H / 2 + Math.sin(a) * R); x.stroke(); }
    for (let r = 24; r < R; r += 26) { x.beginPath(); for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI * 2, rr = r * (k % 2 ? .96 : 1); k ? x.lineTo(W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr) : x.moveTo(W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr); } x.stroke(); }
    E.forEach(([A, C]) => { const age = Math.min(1, (now - C.t0) / 900); x.strokeStyle = C.p.find ? 'rgba(201,247,255,.45)' : 'rgba(228,224,214,.18)'; x.lineWidth = 1; x.beginPath(); x.moveTo(A.x, A.y); const ex = A.x + (C.x - A.x) * age, ey = A.y + (C.y - A.y) * age; x.lineTo(ex, ey); x.stroke(); });
    nodes.forEach(n => { const pop = Math.min(1, (now - n.t0) / 500), off = n.p.h !== startHost, r = (n.p.find ? 5 : 3) * (0.4 + .6 * pop);
      if (n.p.find) { x.fillStyle = 'rgba(201,247,255,.12)'; x.beginPath(); x.arc(n.x, n.y, r + 6 + Math.sin(now / 400) * 1.5, 0, 7); x.fill(); }
      x.fillStyle = n.p.find ? '#c9f7ff' : off ? '#8a8d93' : '#e4e0d6'; x.beginPath(); x.arc(n.x, n.y, r, 0, 7); x.fill();
      if (n.p.find || n.p.u === start) { x.fillStyle = n.p.find ? 'rgba(201,247,255,.9)' : 'rgba(228,224,214,.8)'; x.font = '500 10.5px JBM, monospace'; const lab = n.p.u === start ? n.p.h : shortPath(n.p.u) || n.p.h; x.fillText(lab.length > 28 ? lab.slice(0, 27) + '…' : lab, n.x + r + 5, n.y + 3.5); } });
    const tgt = N.get(reading) || (P.length ? N.get(P[P.length - 1].u) : null);
    if (tgt) { const S2 = mapState.spider; S2.x += (tgt.x - S2.x) * Math.min(1, dt * 2.5); S2.y += (tgt.y - 12 - S2.y) * Math.min(1, dt * 2.5);
      x.strokeStyle = 'rgba(228,224,214,.5)'; x.beginPath(); x.moveTo(S2.x, S2.y); x.lineTo(tgt.x, tgt.y); x.stroke();
      x.strokeStyle = '#e4e0d6'; x.lineWidth = 1; for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const w = Math.sin(now / 90 + k + s) * 1.5; x.beginPath(); x.moveTo(S2.x, S2.y); x.lineTo(S2.x + s * (6 + k * 1.5), S2.y - 5 + k * 2 + w); x.lineTo(S2.x + s * (9 + k * 2), S2.y + 4 + k * 1.5); x.stroke(); }
      x.fillStyle = '#e4e0d6'; x.beginPath(); x.ellipse(S2.x, S2.y, 3.6, 3, 0, 0, 7); x.fill(); x.fillStyle = '#050506'; x.beginPath(); x.arc(S2.x - 1, S2.y + .5, .8, 0, 7); x.arc(S2.x + 1, S2.y + .5, .8, 0, 7); x.fill(); }
    x.fillStyle = '#5b5e65'; x.font = '500 11px JBM, monospace'; x.fillText(P.length ? `${P.length} pages · ${P.filter(p => p.find).length} finds · newest ${P.length ? shortPath(P[P.length - 1].u) || '/' : ''}` : 'the web grows as it reads', 12, H - 12);
  }
  requestAnimationFrame(f);
})();

// ---------- finds ----------
let who = 'all', fq = '';
function allFinds() { const out = []; lair.L.forEach(l => l.finds.forEach(f => out.push({ ...f, by: l.name, lid: l.id }))); return out.sort((a, b) => b.at - a.at); }
function hl(text, words) { let s = esc(text); words.forEach(w => { if (!w) return; const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'); s = s.replace(re, '<mark>$1</mark>'); }); return s; }
function renderFinds() {
  $('#fWho').innerHTML = [['all', 'all']].concat(lair.L.map(l => [l.id, l.name])).map(([id, n]) => `<button type="button" data-v="${id}" class="${who === id ? 'on' : ''}">${esc(n)}</button>`).join('');
  $$('#fWho button').forEach(b => b.onclick = () => { who = b.dataset.v; renderFinds(); });
  const F = allFinds().filter(f => (who === 'all' || f.lid === who) && (!fq || (f.title + ' ' + f.passage + ' ' + f.u).toLowerCase().includes(fq)));
  $('#flist').innerHTML = F.length ? F.slice(0, 120).map(f => `<div class="card fd"><div class="ft"><a href="${esc(f.u)}" target="_blank" rel="noopener nofollow">${esc(f.title)}</a></div><div class="fu">${esc(f.u)}</div>
      <div class="fp">${f.note ? esc(f.note) + '<br>' : ''}${hl(f.passage, f.words)}</div><div class="fm">${f.words.map(w => `<span class="chip">${esc(w)}</span>`).join('')}${f.n > 1 ? `<span>${f.n} mentions</span>` : ''}<span>matched, not checked</span><span class="by">${esc(f.by)} · ${ago(f.at)}</span></div></div>`).join('')
    : `<div class="card empty" style="grid-column:1/-1;padding:48px">${lair.L.length ? 'Nothing found yet. It keeps reading.' : 'Your lurkrs will bring finds back here.'}</div>`;
}
let fp = false; function findsSoon() { if (fp) return; fp = true; setTimeout(() => { fp = false; renderFinds(); }, 600); }
$('#fSearch').oninput = e => { fq = e.target.value.trim().toLowerCase(); renderFinds(); };
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
$('#exCsv').onclick = () => { const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"'; download('lurkr-finds.csv', ['found_at,lurkr,title,url,words,mentions,passage'].concat(allFinds().map(f => [new Date(f.at).toISOString(), f.by, f.title, f.u, f.words.join(' '), f.n, f.passage].map(q).join(','))).join('\n'), 'text/csv'); };
$('#exMd').onclick = () => download('lurkr-finds.md', '# lurkr finds\n\n' + allFinds().map(f => `## [${f.title}](${f.u})\n\n> ${f.passage}\n\n*${f.words.join(', ') || 'a long read'} · found by ${f.by} · ${new Date(f.at).toISOString()} · matched, not checked*\n`).join('\n'), 'text/markdown');
renderFinds();
setInterval(() => { heroLive(); }, 5000);

// ---------- the end: a web being spun ----------
(function end() { const c = $('#endCv'), x = c.getContext('2d'); let vis = false; new IntersectionObserver(e => { vis = e[0].isIntersecting; }).observe(c); const t0 = performance.now();
  (function f(now) { requestAnimationFrame(f); if (!vis) return; const b = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); if (c.width !== Math.round(b.width * d)) { c.width = b.width * d; c.height = b.height * d; }
    x.setTransform(d, 0, 0, d, 0, 0); const W = b.width, H = b.height, t = (now - t0) / 1000, cx = W / 2, cy = H / 2, R = Math.max(W, H) * .6; x.clearRect(0, 0, W, H); x.lineWidth = 1;
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2 + .03 * Math.sin(k * 7); x.strokeStyle = 'rgba(228,224,214,.07)'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.stroke(); }
    const spun = (t * 18) % (R * 1.2); for (let r = 18; r < Math.min(spun, R); r += 22) { x.strokeStyle = `rgba(228,224,214,${.1 * (1 - r / R)})`; x.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, rr = r * (k % 2 ? .95 : 1); k ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.stroke(); } })(t0); })();
