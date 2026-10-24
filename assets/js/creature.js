// lurkr: the creature. A pale thing with very long jointed legs and a cluster of glossy black eyes.
// Legs are live: every leg is a chain of joints you can move each frame (setLegs), so it can unfold, drape and twitch.
import * as THREE from 'three';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const LOOKS = {
  bone: { skin: 0xc9c2b4, dark: 0xa79f93, hair: 0xe9e4da },
  ash: { skin: 0x9a9a98, dark: 0x6f6f6d, hair: 0xc9c9c6 },
  ink: { skin: 0x2a2b2f, dark: 0x16171a, hair: 0x6a6d75 },
  rust: { skin: 0x9c6b52, dark: 0x6e4634, hair: 0xd2a58c },
  moss: { skin: 0x7f8a6c, dark: 0x5a6449, hair: 0xb9c2a2 },
};
// eye layouts: [x, y, z, r] on the head
const EYES = {
  2: [[-.085, .06, .29, .085], [.09, .07, .285, .09]],
  4: [[-.085, .06, .29, .08], [.09, .07, .285, .085], [-.2, .13, .22, .04], [.2, .12, .22, .04]],
  8: [[-.085, .06, .29, .075], [.09, .07, .285, .082], [-.19, .13, .22, .042], [.2, .12, .22, .038], [-.045, .19, .25, .03], [.07, .2, .245, .034], [-.25, .03, .15, .028], [.255, .05, .15, .03]],
  12: [[-.085, .06, .29, .075], [.09, .07, .285, .082], [-.19, .13, .22, .042], [.2, .12, .22, .038], [-.045, .19, .25, .03], [.07, .2, .245, .034], [-.25, .03, .15, .028], [.255, .05, .15, .03], [-.13, .24, .17, .022], [.015, .125, .3, .02], [.15, .25, .17, .02], [-.3, .1, .06, .02]],
};
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const UP = V(0, 1, 0), tmp = new THREE.Vector3();

export function createLurkr({ look = 'bone', eyes = 8, legLen = 1, hair = true } = {}) {
  const L = LOOKS[look] || LOOKS.bone;
  const SKIN = new THREE.MeshPhysicalMaterial({ color: L.skin, roughness: .62, sheen: .8, sheenColor: new THREE.Color('#f3eee6'), sheenRoughness: .45, envMapIntensity: .25 });
  const DARK = new THREE.MeshPhysicalMaterial({ color: L.dark, roughness: .7, envMapIntensity: .2 });
  const EYE = new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: .02, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 1.4 });
  const GLINT = new THREE.MeshBasicMaterial({ color: 0xcff6ff });
  const HAIR = new THREE.LineBasicMaterial({ color: L.hair, transparent: true, opacity: .5 });
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const abd = new THREE.Mesh(new THREE.SphereGeometry(.42, 40, 28), SKIN); abd.scale.set(.9, .78, 1.3); abd.position.set(0, .12, -.55); abd.castShadow = true; body.add(abd);
  const ceph = new THREE.Mesh(new THREE.SphereGeometry(.3, 40, 28), SKIN); ceph.scale.set(1, .8, 1.05); ceph.position.set(0, 0, .12); ceph.castShadow = true; body.add(ceph);
  const hairsAt = (parent, a, b, n, len) => { if (!hair) return; const P = []; for (let i = 0; i < n; i++) { const p = a.clone().lerp(b, rnd()), d = V(rnd() - .5, rnd() - .2, rnd() - .5).normalize().multiplyScalar(len * (.5 + rnd())); P.push(p.x, p.y, p.z, p.x + d.x, p.y + d.y, p.z + d.z); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); parent.add(new THREE.LineSegments(geo, HAIR)); };
  hairsAt(body, V(-.3, .1, -.9), V(.3, .3, -.2), 60, .06); hairsAt(body, V(-.2, .05, 0), V(.2, .2, .3), 34, .05);
  const head = new THREE.Group(); head.position.set(0, .02, .12); body.add(head);
  (EYES[eyes] || EYES[8]).forEach(([x, y, z, r]) => { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), EYE); e.position.set(x, y, z); head.add(e);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(r * .22, 10, 8), GLINT); gl.position.set(x - r * .3, y + r * .35, z + r * .82); head.add(gl); });
  // fangs
  const seg = (r0, r1, mat) => { const geo = new THREE.CylinderGeometry(r1, r0, 1, 12, 1); geo.translate(0, .5, 0); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };
  const place = (m, a, b) => { m.position.copy(a); tmp.copy(b).sub(a); const len = tmp.length() || 1e-4; m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(UP, tmp.normalize()); };
  [-1, 1].forEach(s => { const f = seg(.035, .012, DARK); place(f, V(s * .06, -.12, .33), V(s * .05, -.3, .36)); body.add(f); });
  // legs: 8 chains of 4 joints (hip, knee, ankle, tip), plus 2 short palps
  const legs = [];
  const mkLeg = (r) => { const segs = [0, 1, 2].map(i => { const m = seg(r * (1 - i * .25), r * (1 - (i + 1) * .25) * (i === 2 ? .45 : 1), SKIN);
      if (hair) { const P = []; for (let k = 0; k < 14; k++) { const y = rnd(), a = rnd() * 6.283, rr = r * .9; const d = V(Math.cos(a), .2 + rnd() * .5, Math.sin(a)).multiplyScalar(.08 + rnd() * .06); P.push(Math.cos(a) * rr, y, Math.sin(a) * rr, Math.cos(a) * rr + d.x, y + d.y * .15, Math.sin(a) * rr + d.z); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); m.add(new THREE.LineSegments(geo, HAIR)); }
      g.add(m); return m; });
    const knots = [0, 1, 2].map(() => { const k = new THREE.Mesh(new THREE.SphereGeometry(r * 1.2, 12, 8), DARK); g.add(k); return k; });
    return { segs, knots }; };
  for (let i = 0; i < 8; i++) legs.push(mkLeg(.045));
  const palps = [0, 1].map(() => mkLeg(.028));
  const api = {
    group: g, body, head, legs, legLen,
    // joints: array of 8 arrays of 4 Vector3 (local, before legLen scaling of the outer joints)
    setLegs(joints, palpJoints) {
      joints.forEach((J, i) => { const leg = legs[i]; const P = J.map((p, k) => k === 0 ? p : p.clone().sub(J[0]).multiplyScalar(legLen).add(J[0]));
        for (let k = 0; k < 3; k++) { place(leg.segs[k], P[k], P[k + 1]); leg.knots[k].position.copy(P[k]); } });
      (palpJoints || []).forEach((J, i) => { const leg = palps[i]; for (let k = 0; k < 3; k++) { place(leg.segs[k], J[k], J[k + 1]); leg.knots[k].position.copy(J[k]); } });
    },
  };
  return api;
}

// ---------- poses ----------
// draped: perched on the top edge of a screen (edge at y = 0 under the body), front legs hang down the glass, back legs reach along the top
export function poseDrape(t = 0) {
  const J = []; [-1, 1].forEach(s => {
    const tw = Math.sin(t * 1.3 + s) * .02;
    J.push([V(s * .16, -.05, .25), V(s * .55, .85 + tw, .55), V(s * .85, -.15, .3), V(s * .92, -1.15, .02)]);
    J.push([V(s * .24, -.04, .15), V(s * 1.25, 1.15, .4), V(s * 1.75, -.2, .22), V(s * 1.95, -1.55, .02)]);
    J.push([V(s * .26, -.02, .02), V(s * 1.5, 1.8, -.15), V(s * 2.7, .95, -.1), V(s * 3.2, .02, .05)]);
    J.push([V(s * .22, 0, -.1), V(s * 1.15, 2.0, -.7), V(s * 2.0, 1.35, -1.2), V(s * 2.5, .02, -.9)]);
  });
  return order(J);
}
// folded: crouched tight, legs pulled in above the body like a hand closing
export function poseFold() {
  const J = []; [-1, 1].forEach(s => [0, 1, 2, 3].forEach(k => { const z = .25 - k * .17;
    J.push([V(s * (.16 + k * .03), -.04, z), V(s * (.45 + k * .05), .75 - k * .05, z + .05), V(s * (.35 + k * .03), .25, z + .12), V(s * (.3 + k * .02), -.1, z + .2)]); }));
  return order(J);
}
// standing on a floor at y = -0.62
export function poseStand(t = 0) {
  const J = []; [-1, 1].forEach(s => [0, 1, 2, 3].forEach(k => { const z0 = .2 - k * .12, zf = [1.25, .55, -.35, -1.15][k], zk = [.75, .3, -.2, -.75][k], b = Math.sin(t * 2 + k + s) * .02;
    J.push([V(s * .2, -.02, z0), V(s * (.75 + k * .12), .95 - k * .05 + b, zk), V(s * (1.35 + k * .2), .05, zf * .9), V(s * (1.55 + k * .25), -.62, zf)]); }));
  return order(J);
}
// legs are built left 0..3 then right 0..3; poses above push per side in that same order
const order = J => J;
export function palps(t = 0) { return [-1, 1].map(s => [V(s * .12, -.05, .3), V(s * .2, .05 + Math.sin(t * 3 + s) * .02, .5), V(s * .17, -.12, .62), V(s * .15, -.2, .66)]); }
export function mixPose(A, B, k) { return A.map((leg, i) => leg.map((p, j) => p.clone().lerp(B[i][j], k))); }

// walking: the stand pose with each leg stepping in turn (alternating tetrapod gait)
export function poseWalk(t, speed = 9) {
  const S = poseStand(0), grp = [0, 1, 0, 1, 1, 0, 1, 0];
  return S.map((J, i) => { const ph = t * speed + (grp[i] ? Math.PI : 0) + i * .15, sw = Math.sin(ph), lift = Math.max(0, Math.cos(ph)) * .35;
    return J.map((p, k) => k === 0 ? p : p.clone().add(new THREE.Vector3(0, k === 3 ? lift : k === 1 ? lift * .5 : lift * .3, sw * (k === 3 ? .45 : k === 2 ? .3 : .12)))); });
}
