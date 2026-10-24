// lurkr: the background of the whole site is one huge orb web. It is a net of springs: the pointer tugs the silk near it,
// scrolling sends a shiver through every thread, dew catches the light, and now and then a small lurkr walks a ring.
export function initWeb() {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches, MOB = innerWidth < 900;
  const c = document.createElement('canvas'); c.id = 'web'; c.setAttribute('aria-hidden', 'true'); document.body.prepend(c);
  const x = c.getContext('2d'); const SP = MOB ? 18 : 28, RG = MOB ? 13 : 20;
  let W, H, D, R, N = [], ang = [];
  const node = (i, j) => N[j * SP + i];
  function build() {
    D = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; c.width = W * D; c.height = H * D; x.setTransform(D, 0, 0, D, 0, 0);
    R = Math.hypot(W, H) * .78; N = []; ang = Array.from({ length: SP }, (_, i) => i / SP * Math.PI * 2 + Math.sin(i * 7.1) * .05);
    for (let j = 0; j < RG; j++) { const rr = R * Math.pow((j + 1) / RG, 1.35); for (let i = 0; i < SP; i++) { const a = ang[i], sag = j % 2 ? .97 : 1;
      N.push({ rx: Math.cos(a) * rr * sag, ry: Math.sin(a) * rr * sag, x: 0, y: 0, vx: 0, vy: 0, dew: Math.random() < .07, ph: Math.random() * 6.28 }); } }
    N.forEach(n => { n.x = n.rx; n.y = n.ry; });
  }
  build(); addEventListener('resize', build);
  let mx = -1e4, my = -1e4, lastY = scrollY, v = 0, t0 = performance.now(), walker = null;
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
  document.addEventListener('pointerleave', () => { mx = my = -1e4; });
  function frame(now) {
    requestAnimationFrame(frame); const t = (now - t0) / 1000;
    const dy = scrollY - lastY; lastY = scrollY; v += (dy - v) * .12;
    // the web's hub drifts with the page so it feels hung behind it
    const cx = W * .72 + Math.sin(t * .05) * 30, cy = H * .3 - (scrollY * .06) % (H * .2) + Math.cos(t * .04) * 20;
    // springs: every knot is pulled home, tugged by the pointer, shivered by the scroll
    for (let k = 0; k < N.length; k++) { const n = N[k], j = Math.floor(k / SP);
      let fx = (n.rx - n.x) * .02, fy = (n.ry - n.y) * .02;
      const px = cx + n.x - mx, py = cy + n.y - my, d2 = px * px + py * py;
      if (d2 < 26000) { const f = (1 - d2 / 26000) * 1.4; fx += px * f * .02; fy += py * f * .02; }
      fy += Math.sin(t * 3 + j * .7) * Math.min(4, Math.abs(v)) * .06; fx += Math.cos(t * 2.4 + k) * Math.min(4, Math.abs(v)) * .03;
      n.vx = (n.vx + fx) * .9; n.vy = (n.vy + fy) * .9; n.x += n.vx; n.y += n.vy; }
    x.clearRect(0, 0, W, H);
    // a soft light where the pointer is, like a torch on the silk
    if (mx > -1e3) { const g = x.createRadialGradient(mx, my, 0, mx, my, 260); g.addColorStop(0, 'rgba(201,247,255,.045)'); g.addColorStop(1, 'rgba(201,247,255,0)'); x.fillStyle = g; x.fillRect(mx - 260, my - 260, 520, 520); }
    // spokes
    x.lineWidth = 1; x.strokeStyle = 'rgba(228,224,214,.065)'; x.beginPath();
    for (let i = 0; i < SP; i++) { x.moveTo(cx, cy); for (let j = 0; j < RG; j++) { const n = node(i, j); x.lineTo(cx + n.x, cy + n.y); } } x.stroke();
    // rings, brighter near the pointer
    for (let j = 0; j < RG; j++) { x.beginPath(); let near = 0;
      for (let i = 0; i <= SP; i++) { const n = node(i % SP, j), X = cx + n.x, Y = cy + n.y; if (i) x.lineTo(X, Y); else x.moveTo(X, Y); const dd = Math.hypot(X - mx, Y - my); if (dd < 220) near = Math.max(near, 1 - dd / 220); }
      x.strokeStyle = `rgba(228,224,214,${.06 + near * .16})`; x.stroke(); }
    // dew
    for (const n of N) if (n.dew) { const X = cx + n.x, Y = cy + n.y; if (X < -5 || Y < -5 || X > W + 5 || Y > H + 5) continue; const a = .25 + .25 * Math.sin(t * 1.3 + n.ph);
      x.fillStyle = `rgba(201,247,255,${a})`; x.beginPath(); x.arc(X, Y, 1.3, 0, 7); x.fill(); }
    // now and then a small lurkr walks one of the rings
    if (!walker && Math.random() < .002) walker = { j: 3 + Math.floor(Math.random() * (RG - 6)), i: Math.random() * SP, dir: Math.random() < .5 ? 1 : -1, life: 0 };
    if (walker) { walker.life += 1 / 60; walker.i = (walker.i + walker.dir * .012 + SP) % SP; const i0 = Math.floor(walker.i), f = walker.i - i0, a = node(i0, walker.j), b = node((i0 + 1) % SP, walker.j);
      const X = cx + a.x + (b.x - a.x) * f, Y = cy + a.y + (b.y - a.y) * f, al = Math.min(1, walker.life) * Math.min(1, (14 - walker.life) / 2) * .55;
      if (al > 0) { x.strokeStyle = `rgba(228,224,214,${al})`; x.fillStyle = `rgba(228,224,214,${al})`; for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const w = Math.sin(t * 14 + k * 1.7 + s) * 1.4; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + s * (5 + k * 1.3), Y - 4 + k * 1.6 + w); x.lineTo(X + s * (8 + k * 1.8), Y + 3 + k * 1.3); x.stroke(); }
        x.beginPath(); x.ellipse(X, Y, 3, 2.6, 0, 0, 7); x.fill(); }
      if (walker.life > 14) walker = null; }
  }
  if (RM) { frame(performance.now()); return; }
  requestAnimationFrame(frame);
}

// smooth wheel scrolling (desktop): the page glides to where the wheel sends it. Touch and keyboard stay native.
export function initSmooth() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(pointer: fine)').matches) return;
  document.documentElement.style.scrollBehavior = 'auto';
  let target = scrollY, cur = scrollY, running = false, lastSet = -1;
  const max = () => document.documentElement.scrollHeight - innerHeight;
  const scrollable = el => { for (; el && el !== document.body; el = el.parentElement) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2) return el; } return null; };
  function loop() { cur += (target - cur) * .095; if (Math.abs(target - cur) < .4) { cur = target; running = false; } lastSet = Math.round(cur); scrollTo(0, cur); if (running) requestAnimationFrame(loop); }
  addEventListener('wheel', e => {
    if (e.ctrlKey || document.documentElement.classList.contains('intro')) return;
    const sc = scrollable(e.target); if (sc && ((e.deltaY > 0 && sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1) || (e.deltaY < 0 && sc.scrollTop > 0))) return;
    e.preventDefault(); if (!running) { cur = scrollY; target = scrollY; }
    const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
    target = Math.max(0, Math.min(max(), target + dy)); if (!running) { running = true; requestAnimationFrame(loop); }
  }, { passive: false });
  // other scrolls (keys, scrollbar, anchors) take over cleanly
  addEventListener('scroll', () => { if (Math.abs(scrollY - lastSet) > 2 && !running) { cur = target = scrollY; } }, { passive: true });
  document.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (!a) return; const el = document.querySelector(a.getAttribute('href')); if (!el) return;
    e.preventDefault(); cur = scrollY; target = Math.max(0, Math.min(max(), el.getBoundingClientRect().top + scrollY - 20)); if (!running) { running = true; requestAnimationFrame(loop); } });
  window.__glideTo = y => { cur = scrollY; target = Math.max(0, Math.min(max(), y)); if (!running) { running = true; requestAnimationFrame(loop); } };
}
