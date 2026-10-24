// lurkr: the hero stage. A glowing browser window in the dark, being read; the lurkr perched on top of it.
// The intro: the screen flickers on, eyes glint over its edge, the legs unfold one by one, a camera flash, the camera pulls back.
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { createLurkr, poseDrape, poseFold, palps, mixPose } from './creature.js';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lin = (t, a, b) => clamp((t - a) / (b - a));
const ease = k => 1 - Math.pow(1 - clamp(k), 3), smooth = k => { k = clamp(k); return k * k * (3 - 2 * k); };

// the screen: a page that is being read, line by line; a found line lights up
function makeScreen() {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 960; const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const lines = Array.from({ length: 15 }, (_, i) => ({ w: i === 0 ? 620 : 420 + ((i * 397) % 900), h: i === 0 ? 30 : 16, find: i === 7 || i === 12 }));
  let page = 0;
  const urls = ['lurkr://reading/docs/changelog', 'lurkr://reading/blog/announcements', 'lurkr://reading/roadmap', 'lurkr://reading/status/incidents'];
  function draw(t, on) {
    const read = (t * .55) % 1.25;   // a reading head sweeps down the page, then the next page loads
    const pg = Math.floor(t * .55 / 1.25); if (pg !== page) page = pg;
    const gr = x.createLinearGradient(0, 0, 0, 960); gr.addColorStop(0, '#dfe8ec'); gr.addColorStop(1, '#bccbd2'); x.fillStyle = gr; x.fillRect(0, 0, 1600, 960);
    x.fillStyle = '#cdd8dd'; x.fillRect(0, 0, 1600, 68); x.fillStyle = '#9eaeb5'; [0, 1, 2].forEach(i => { x.beginPath(); x.arc(40 + i * 30, 34, 9, 0, 7); x.fill(); });
    x.fillStyle = '#eef3f5'; x.beginPath(); x.roundRect(140, 15, 760, 38, 19); x.fill(); x.fillStyle = '#5f727b'; x.font = '500 22px JBM, monospace'; x.fillText(urls[((page % urls.length) + urls.length) % urls.length], 164, 42);
    let y = 120; const hy = 120 + read * 820;
    lines.forEach((l, i) => { const shown = on > 0 ? clamp((on * 18 - i) / 2) : 0; if (shown <= 0) { y += i === 0 ? 70 : 50; return; }
      const lit = l.find && hy > y + 10; x.fillStyle = lit ? '#79cfe2' : '#a2b3bb'; x.globalAlpha = shown; x.fillRect(70, y, l.w * ((page * 37 + i * 13) % 7 / 20 + .75), l.h); x.globalAlpha = 1; y += i === 0 ? 70 : 50; });
    if (on > .9 && read < 1) { x.fillStyle = 'rgba(121,207,226,.16)'; x.fillRect(0, hy - 18, 1600, 36); }
    tex.needsUpdate = true;
  }
  return { tex, draw };
}

const DEBUG_T = (() => { const m = location.search.match(/introAt=([\d.]+)/); return m ? parseFloat(m[1]) : null; })();
export function createStage(canvas, { intro = false, mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(mobile ? 1.5 : 2, devicePixelRatio || 1)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setClearColor(0x030304, 1);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x030304, 9, 17);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  // the monitor: its top edge is y = 0, the glass at z = 0
  const W = 6.4, H = 3.8, mon = new THREE.Group(); mon.position.set(0, -H / 2 - .15, 0); scene.add(mon);
  const bez = new THREE.Mesh(new RoundedBoxGeometry(W + .3, H + .3, .5, 5, .1), new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: .55 })); bez.position.z = -.24; bez.receiveShadow = true; mon.add(bez);
  const S = makeScreen(); const glass = new THREE.MeshBasicMaterial({ map: S.tex, toneMapped: false, color: new THREE.Color(0, 0, 0) });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(W, H), glass); scr.position.z = .015; mon.add(scr);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShadowMaterial({ opacity: .55 })); shade.position.z = .03; shade.receiveShadow = true; mon.add(shade);
  const top = new THREE.Mesh(new THREE.BoxGeometry(W + .4, .1, 1.4), new THREE.MeshStandardMaterial({ color: 0x131417, roughness: .6 })); top.position.set(0, 0, -.45); top.receiveShadow = true; scene.add(top);
  // the creature
  const lk = createLurkr({ look: 'bone', eyes: 8 }); lk.group.scale.setScalar(1.05); scene.add(lk.group);
  const FOLD = poseFold();
  // light: the flash (a spot from up front), the screen's cold glow from below
  const flash = new THREE.SpotLight(0xffffff, 0, 0, .5, .6, 2); flash.position.set(1.4, 4.2, 7.6); flash.target.position.set(0, .2, 0); flash.castShadow = true; flash.shadow.mapSize.set(1024, 1024); scene.add(flash, flash.target);
  const glow = new THREE.PointLight(0xbfe6f2, 0, 0, 2); glow.position.set(0, -1.0, 1.4); scene.add(glow);
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
  const st = { t: 0, intro, introT: 0, introStart: performance.now(), done: !intro, mx: 0, my: 0, smx: 0, smy: 0, twitch: 0, reel: 0, visible: true, onIntroEnd: null, flashEl: null, heroX: mobile ? 0 : -2.6 };
  function size() { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); }
  size(); addEventListener('resize', size);
  addEventListener('pointermove', e => { st.mx = e.clientX / innerWidth * 2 - 1; st.my = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  new IntersectionObserver(es => { st.visible = es[0].isIntersecting; }).observe(canvas);
  // camera keys: [t, pos, look]
  const HERO = () => [V(st.heroX * .55 - .4, 1.7, mobile ? 14.5 : 12.6), V(st.heroX, -.15, 0)];
  const K = () => [[0, V(0, .2, 4.2), V(0, -.6, 0)], [2.2, V(0, .35, 5.0), V(0, -.2, 0)], [4.0, V(-.3, .8, 6.6), V(0, .1, 0)], [5.9, ...HERO()]];
  function camAt(t) { const k = K(); if (t <= k[0][0]) return [k[0][1], k[0][2]]; for (let i = 0; i < k.length - 1; i++) { if (t <= k[i + 1][0]) { const a = smooth((t - k[i][0]) / (k[i + 1][0] - k[i][0])); return [k[i][1].clone().lerp(k[i + 1][1], a), k[i][2].clone().lerp(k[i + 1][2], a)]; } } return [k[k.length - 1][1], k[k.length - 1][2]]; }
  let last = performance.now(), look = V();
  function frame(now) {
    requestAnimationFrame(frame); const dt = clamp((now - last) / 1000, 0, .05); last = now; if (!st.visible) return; st.t += dt;
    if (!st.started) { st.started = true; st.introStart = performance.now(); }
    st.smx += (st.mx - st.smx) * Math.min(1, dt * 2.5); st.smy += (st.my - st.smy) * Math.min(1, dt * 2.5);
    let on = 1, rise = 1, unfold = 1, flashK = 1;
    if (!st.done) {
      st.introT = DEBUG_T != null ? DEBUG_T : (now - st.introStart) / 1000; const t = st.introT;   // wall clock: the intro ends on time even when frames drop
      on = smooth(lin(t, .5, 1.6)) * (t > .55 && t < 1.0 ? (Math.random() > .3 ? 1 : .55) : 1);       // the screen flickers on, then settles
      rise = ease(lin(t, 1.3, 2.9)); unfold = t; flashK = t > 4.0 ? 1 : 0;
      if (t > 4.0 && !st.flashed && DEBUG_T == null) { st.flashed = true; if (st.flashEl) { st.flashEl.style.transition = 'none'; st.flashEl.style.opacity = .82; requestAnimationFrame(() => requestAnimationFrame(() => { st.flashEl.style.transition = 'opacity .9s cubic-bezier(.2,.8,.2,1)'; st.flashEl.style.opacity = 0; })); } }
      const [p, l] = camAt(t); cam.position.copy(p); look.copy(l);
      if (t > 6.0 && DEBUG_T == null) { st.done = true; st.onIntroEnd && st.onIntroEnd(); }
    } else { const [p, l] = HERO(), k = smooth(Math.min(1, st.reel * 1.7)), eye = V(.55, 1.0, 3.5), eyeL = V(.05, .68, .45);   // scrolling leans in, right up to its eyes
      cam.position.set(p.x + (eye.x - p.x) * k + st.smx * .35 * (1 - k * .7), p.y + (eye.y - p.y) * k - st.smy * .2 * (1 - k * .7), p.z + (eye.z - p.z) * k); look.set(l.x + (eyeL.x - l.x) * k, l.y + (eyeL.y - l.y) * k, l.z + (eyeL.z - l.z) * k); }
    cam.lookAt(look);
    // the screen and its light
    glass.color.setScalar(.72 * on); glow.intensity = 3.0 * on; S.draw(st.t, on);
    flash.intensity = 150 * flashK;
    // the creature: rises over the edge, legs unfold one by one from folded to draped
    const D = poseDrape(st.t), J = [];
    for (let i = 0; i < 8; i++) { const order = [0, 4, 1, 5, 2, 6, 3, 7].indexOf(i); const k = st.done ? 1 : ease(lin(unfold, 2.0 + order * .22, 2.7 + order * .22)); J.push(mixPose([FOLD[i]], [D[i]], k)[0]); }
    // a twitch now and then: one front leg lifts and taps
    st.twitch -= dt; if (st.twitch < -3 - Math.random() * 4) st.twitch = .5; if (st.twitch > 0) { const a = Math.sin((1 - st.twitch / .5) * Math.PI); J[4][3] = J[4][3].clone().add(V(0, a * .35, a * .25)); J[4][2] = J[4][2].clone().add(V(0, a * .25, a * .15)); }
    lk.setLegs(J, palps(st.t));
    lk.group.position.set(0, .3 - (1 - rise) * 1.5 + Math.sin(st.t * 1.6) * .012, .05 - (1 - rise) * 1.3); lk.group.visible = rise > .015;
    lk.group.rotation.set(.18, .22 + st.smx * .12, .13);
    lk.head.rotation.set(-.05 + st.smy * .25, st.smx * .45, 0);
    renderer.render(scene, cam);
  }
  try { renderer.compile(scene, cam); } catch {}
  requestAnimationFrame(frame);
  return { st, size, skip() { st.introStart = performance.now() - 6100; st.flashed = true; } };
}
