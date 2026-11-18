// @ts-check
// Contract 03, Rooftop Gala (Old Town, 21:40, dusk). A party on the roof terrace of the plaster
// mid-rise across the plaza (x 42..74, z -173..-127, roof at y = 26): string lights, cocktail
// tables, a bar, a lectern with a banner and the stair-door hut. Councillor Mara Voss mingles
// with three groups, gives a short speech at the lectern and leaves through the stair door.
import * as THREE from 'three';

/** Terrace geometry: everything stands on the deck top. */
export const GALA = {
  roof: { x0: 42, x1: 74, z0: -173, z1: -127, y: 26 },
  deckY: 26.12,
  door: { x: 46.2, z: -166.2 },
  lectern: { x: 60, z: -162.1 },
  speaker: { x: 60, z: -162.9 },
  bar: { x: 45.5, z: -150 },
  tables: [[52, -135], [60, -133], [68, -136], [50, -145], [58, -145], [67, -146], [53, -154], [64, -155]],
  light: { x: 58, y: 30.5, z: -148 }
};

const TARGET_AVATAR = 'Female_Adult_11';
/** The roof's own clutter (stair hut, AC units, tank, billboard...) inside this box is hidden
 * while the gala is dressed, and put back for other contracts. Parapets and windows stay. */
const CLUTTER_BOX = { x0: 42.8, x1: 73.2, z0: -172.2, z1: -127.8, y0: 25.9, y1: 46 };
/** @type {{ inst: { mesh: THREE.InstancedMesh, i: number, m: THREE.Matrix4 }[], groups: THREE.Object3D[] } | null} */
let hidden = null;
/** @type {THREE.Group | null} */
let dressed = null;
const GUARD_AVATAR = 'Male_Adult_04';

/**
 * Set dressing for the terrace. Cheap on purpose: one real light, instanced repeats, no shadow
 * casters; the bulbs glow with unlit materials and an additive sprite layer.
 * @returns {{ group: THREE.Group, colliders: number[][], rangeMeshes: THREE.Object3D[] }}
 */
export function galaDress(scene) {
  const group = new THREE.Group();
  group.name = 'gala-dressing';
  dressed = group;
  if (scene) hideClutter(scene);
  /** @type {number[][]} */
  const colliders = [];
  /** @type {THREE.Object3D[]} */
  const rangeMeshes = [];
  const y0 = GALA.deckY;
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const solid = (x0, y0b, z0, x1, y1, z1) => colliders.push([x0, y0b, z0, x1, y1, z1]);

  const mats = {
    deck: new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.82, metalness: 0 }),
    wood: new THREE.MeshStandardMaterial({ color: '#3a281d', roughness: 0.6 }),
    marble: new THREE.MeshStandardMaterial({ color: '#e9e4dc', roughness: 0.25 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#f1ede6', roughness: 0.9 }),
    plaster: new THREE.MeshStandardMaterial({ color: '#d8d0c4', roughness: 0.9 }),
    door: new THREE.MeshStandardMaterial({ color: '#2a2320', roughness: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ color: '#202327', roughness: 0.5, metalness: 0.6 }),
    pot: new THREE.MeshStandardMaterial({ color: '#4b4f55', roughness: 0.8 }),
    leaves: new THREE.MeshStandardMaterial({ color: '#2f4a2c', roughness: 1 }),
    glow: new THREE.MeshBasicMaterial({ color: '#ffcf8a', toneMapped: false })
  };

  // Deck over the roof, inside the parapet.
  const deckTex = /** @type {THREE.Texture} */ (mats.deck.map);
  deckTex.repeat.set(8, 12);
  const deck = box(30.6, 0.12, 44.6, mats.deck, 58, y0 - 0.06, -150);
  rangeMeshes.push(deck);

  // Stair-door hut in the north-west corner: the way out.
  const hut = box(4, 2.8, 3.6, mats.plaster, 46.2, GALA.roof.y + 1.4, -168.8);
  rangeMeshes.push(hut);
  solid(44.2, GALA.roof.y, -170.6, 48.2, GALA.roof.y + 2.8, -167);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), mats.door);
  door.position.set(GALA.door.x, y0 + 1.05, -166.98);
  group.add(door);
  box(0.5, 0.12, 0.2, mats.glow, GALA.door.x, y0 + 2.35, -166.9);

  // Bar along the west side, with a lit shelf behind it.
  const counter = box(1.0, 1.1, 9, mats.wood, GALA.bar.x, y0 + 0.55, GALA.bar.z);
  rangeMeshes.push(counter);
  box(1.15, 0.06, 9.2, mats.marble, GALA.bar.x, y0 + 1.13, GALA.bar.z);
  solid(GALA.bar.x - 0.58, y0, GALA.bar.z - 4.6, GALA.bar.x + 0.58, y0 + 1.16, GALA.bar.z + 4.6);
  box(0.4, 1.8, 8, mats.wood, 43.2, y0 + 0.9, GALA.bar.z);
  box(0.05, 0.05, 7.6, mats.glow, 43.42, y0 + 1.25, GALA.bar.z);
  box(0.05, 0.05, 7.6, mats.glow, 43.42, y0 + 1.65, GALA.bar.z);

  // Lectern and a banner backdrop on the north side.
  box(0.6, 1.15, 0.45, mats.wood, GALA.lectern.x, y0 + 0.575, GALA.lectern.z);
  solid(GALA.lectern.x - 0.3, y0, GALA.lectern.z - 0.23, GALA.lectern.x + 0.3, y0 + 1.15, GALA.lectern.z + 0.23);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 2.4),
    new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.9, emissive: '#ffffff', emissiveIntensity: 0.35 })
  );
  /** @type {THREE.MeshStandardMaterial} */ (banner.material).emissiveMap = /** @type {THREE.MeshStandardMaterial} */ (banner.material).map;
  banner.position.set(60, y0 + 1.6, -166.4);
  group.add(banner);
  rangeMeshes.push(banner);
  for (const x of [56.4, 63.6]) box(0.08, 2.9, 0.08, mats.metal, x, y0 + 1.45, -166.45);
  solid(56.4, y0, -166.6, 63.6, y0 + 2.9, -166.3);

  // Cocktail tables with long cloths, one instanced mesh.
  const tableGeo = new THREE.CylinderGeometry(0.42, 0.5, 1.1, 16);
  tableGeo.translate(0, 0.55, 0);
  const tables = new THREE.InstancedMesh(tableGeo, mats.cloth, GALA.tables.length);
  const m4 = new THREE.Matrix4();
  GALA.tables.forEach(([x, z], i) => {
    tables.setMatrixAt(i, m4.makeTranslation(x, y0, z));
    solid(x - 0.5, y0, z - 0.5, x + 0.5, y0 + 1.1, z + 0.5);
  });
  tables.receiveShadow = true;
  group.add(tables);

  // Potted plants along the south parapet and beside the banner.
  const plantSpots = [[46, -128.8], [52, -128.8], [58, -128.8], [64, -128.8], [70, -128.8], [54.8, -165.6], [65.2, -165.6]];
  const pots = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 10).translate(0, 0.3, 0), mats.pot, plantSpots.length);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.6, 1).translate(0, 1.15, 0), mats.leaves, plantSpots.length);
  plantSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, y0, z);
    pots.setMatrixAt(i, m4);
    crowns.setMatrixAt(i, m4);
  });
  group.add(pots, crowns);

  // String lights: poles, sagging wires, bulbs and their glow.
  const top = y0 + 3.2;
  const poles = [[43.6, -128.6], [58, -128.6], [72.4, -128.6], [72.4, -171.2], [58, -171.2], [50, -171.2]];
  const poleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 3.3, 6).translate(0, 1.65, 0), mats.metal, poles.length);
  poles.forEach(([x, z], i) => poleMesh.setMatrixAt(i, m4.makeTranslation(x, y0, z)));
  group.add(poleMesh);
  const strings = [
    [poles[0], poles[1]], [poles[1], poles[2]], [poles[0], poles[4]], [poles[2], poles[4]],
    [poles[1], poles[5]], [poles[1], poles[3]], [poles[3], poles[4]], [poles[4], poles[5]]
  ];
  /** @type {number[]} */
  const wire = [];
  /** @type {THREE.Vector3[]} */
  const bulbs = [];
  for (const [[ax, az], [bx, bz]] of strings) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(6, Math.round(len / 1.4));
    const sag = Math.min(1.1, len * 0.03);
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3(ax + (bx - ax) * t, top - sag * 4 * t * (1 - t), az + (bz - az) * t);
      if (prev) wire.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      if (i > 0 && i < n) bulbs.push(p.clone().setY(p.y - 0.08));
      prev = p;
    }
  }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  group.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: '#141414' })));
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), mats.glow, bulbs.length);
  bulbs.forEach((p, i) => bulbMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  group.add(bulbMesh);
  const glowGeo = new THREE.BufferGeometry().setFromPoints(bulbs);
  const glow = new THREE.Points(glowGeo, new THREE.PointsMaterial({
    size: 1.1, map: glowTexture(), color: '#ffc477', transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false
  }));
  group.add(glow);

  // One warm light over the terrace so faces read in the scope.
  const light = new THREE.PointLight('#ffcf8a', 260, 42, 2);
  light.position.set(GALA.light.x, GALA.light.y, GALA.light.z);
  group.add(light);

  group.traverse((o) => {
    o.castShadow = false;
  });
  return { group, colliders, rangeMeshes };
}

/**
 * @param {import('../people.js').CrowdKit} kit
 * @returns {import('../people.js').CrowdSetup}
 */
export function galaPeople(kit) {
  const { r, make, avatar, randomLook, MEN, WOMEN } = kit;
  const y = GALA.deckY;
  const men = MEN.filter((id) => id !== GUARD_AVATAR);
  const women = WOMEN.filter((id) => id !== TARGET_AVATAR);
  const guest = (female) => {
    const pool = female && women.length ? women : men;
    const id = pool[Math.floor(r() * pool.length)];
    return make(avatar(id), randomLook(), female ? 1.6 + r() * 0.1 : 1.72 + r() * 0.14);
  };
  const faceTo = (p, x, z) => Math.atan2(x - p.x, z - p.z);
  /** @type {import('../people.js').Person[]} */
  const civilians = [];
  /** Guests who turn to the lectern during the speech: { person, chatRole }. */
  const audience = [];

  // Talking groups around the tables. Each spot is [x, z, female?].
  const groups = [
    { cx: 52, cz: -135, spots: [[51.0, -134.3, false], [52.9, -134.1, true], [52.1, -136.3, false]] },
    { cx: 60, cz: -133, spots: [[59.0, -132.2, false], [60.9, -132.0, true]] },
    { cx: 68, cz: -136, spots: [[67.0, -135.3, false], [68.9, -135.2, false]] },
    { cx: 58, cz: -145, spots: [[56.9, -144.6, true], [59.0, -144.1, false], [58.6, -146.2, false]] },
    { cx: 67, cz: -146, spots: [[66.0, -145.4, false], [67.9, -145.2, true]] },
    { cx: 53, cz: -154, spots: [[52.0, -153.6, false], [53.9, -153.2, false]] }
  ];
  for (const g of groups) {
    g.spots.forEach(([x, z, female], i) => {
      const p = guest(female);
      p.place(x, z, 0, y);
      const role = i === 0 ? 'talk' : r() < 0.5 ? 'idle' : 'idle2';
      p.standStill(faceTo(p, g.cx, g.cz), role);
      civilians.push(p);
      audience.push({ person: p, role, cx: g.cx, cz: g.cz });
    });
  }
  // Two guests on their phones by the east parapet.
  for (const [x, z] of [[71.6, -150], [71.6, -139]]) {
    const p = guest(false);
    p.place(x, z, 0, y);
    p.standStill(-Math.PI / 2, 'phone');
    civilians.push(p);
  }
  // Bartender behind the bar, facing the terrace.
  const bartender = guest(false);
  bartender.place(44.3, GALA.bar.z, 0, y);
  bartender.standStill(Math.PI / 2, 'idle');
  civilians.push(bartender);
  // Waiters loop from the bar out among the tables and back.
  const waiterRoutes = [
    [{ x: 47.2, z: -148 }, { x: 55, z: -140 }, { x: 64, z: -134 }, { x: 70, z: -141 }, { x: 62, z: -150 }, { x: 47.2, z: -152, wait: 4 }],
    [{ x: 47.2, z: -152 }, { x: 56, z: -158 }, { x: 66, z: -152 }, { x: 62, z: -140 }, { x: 50, z: -140 }, { x: 47.2, z: -148, wait: 5 }],
    [{ x: 47.4, z: -146 }, { x: 50, z: -131 }, { x: 70, z: -131 }, { x: 70, z: -158 }, { x: 47.4, z: -156, wait: 3 }]
  ];
  waiterRoutes.forEach((route, i) => {
    const p = guest(false);
    const s = route[i % route.length];
    p.place(s.x, s.z, 0, y);
    p.walk(route, { loop: true, speed: 1.05 + r() * 0.2, start: (i + 1) % route.length });
    civilians.push(p);
  });

  // Her bodyguard keeps close.
  const guard = make(avatar(GUARD_AVATAR), randomLook(), 1.86);
  civilians.push(guard);

  // Councillor Mara Voss: brown knit sweater dress, belt, brown leather boots (Female_Adult_11).
  const targetLook = { suit: '#5a3a26', trousers: '#3a2a20', skin: '#e3b9a0', hair: '#2b1d14', avatar: TARGET_AVATAR };
  const target = make(avatar(TARGET_AVATAR), targetLook, 1.7);
  const door = GALA.door;
  target.place(door.x, door.z, 0, y);
  guard.place(door.x + 1.2, door.z + 0.6, 0, y);
  guard.standStill(0, 'idle');
  // Her evening: three groups, the speech, then the stair door. `face` is applied while she waits.
  const route = [
    { x: door.x + 0.4, z: door.z + 1.2 },
    { x: 54.4, z: -152.3, wait: 13, anim: 'talk', face: faceTo({ x: 54.4, z: -152.3 }, 53, -154) },
    { x: 57.6, z: -143.2, wait: 11, anim: 'talk', face: faceTo({ x: 57.6, z: -143.2 }, 58, -145) },
    { x: 61.2, z: -134.6, wait: 10, anim: 'talk', face: faceTo({ x: 61.2, z: -134.6 }, 60, -133) },
    { x: 61.5, z: -158.5 },
    { x: GALA.speaker.x, z: GALA.speaker.z, wait: 20, anim: 'talk', face: 0 },
    { x: 52, z: -164.5 },
    { x: door.x, z: door.z }
  ];
  target.walk(route, { loop: false, speed: 1.05 });

  const lecternWait = 5;
  let guardTimer = 0;
  const exits = [{ x: door.x, z: door.z }, { x: 43.6, z: GALA.bar.z }];

  return {
    civilians,
    target,
    targetLook,
    contact: null,
    exits,
    panicTarget(t) {
      t.path = [{ x: door.x, z: door.z }];
      t.index = 0;
      t.loop = false;
      t.wait = 0;
      t.speed = 3.6;
      t.mode = 'walk';
      t.panicDelay = 0.3;
    },
    update(dt) {
      // While she waits at a spot, turn her to face whoever she is talking to (or the crowd).
      if (target.alive && target.wait > 0 && target.index > 0) {
        const wp = /** @type {any} */ (route[target.index - 1]);
        if (wp && wp.face !== undefined && target.path === /** @type {any} */ (route)) {
          let diff = wp.face - target.root.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          target.root.rotation.y += diff * Math.min(1, dt * 4);
        }
      }
      // During the speech the guests turn to the lectern and stop talking.
      const speaking = target.alive && target.index === lecternWait + 1 && target.wait > 0 &&
        Math.hypot(target.x - GALA.speaker.x, target.z - GALA.speaker.z) < 0.4;
      for (const a of audience) {
        const p = a.person;
        if (!p.alive || p.mode !== 'idle') continue;
        const want = speaking ? faceTo(p, GALA.speaker.x, GALA.speaker.z) : faceTo(p, a.cx, a.cz);
        let diff = want - p.root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        p.root.rotation.y += diff * Math.min(1, dt * 2);
        p.setIdle(speaking ? 'idle' : a.role);
      }
      // The bodyguard keeps about two metres behind her right shoulder.
      guardTimer -= dt;
      if (guard.alive && target.alive && guard.mode !== 'flee' && guard.mode !== 'gone' && guardTimer <= 0) {
        guardTimer = 0.5;
        const yaw = target.root.rotation.y;
        const gx = target.x + Math.cos(yaw) * -1.3 - Math.sin(yaw) * 1.4;
        const gz = target.z - Math.sin(yaw) * -1.3 - Math.cos(yaw) * 1.4;
        if (Math.hypot(guard.x - gx, guard.z - gz) > 1.4) {
          guard.walk([{ x: gx, z: gz }], { loop: false, speed: Math.min(1.6, target.speed + 0.3) });
        } else if (guard.mode === 'idle') {
          guard.root.rotation.y = faceTo(guard, target.x, target.z);
        }
      }
    },
    escaped() {
      return target.mode === 'idle' && target.index === target.path.length - 1 &&
        Math.hypot(target.x - door.x, target.z - door.z) < 0.5;
    }
  };
}

/** Hides the roof's random clutter that would stand in the party (see CLUTTER_BOX). */
function hideClutter(scene) {
  if (hidden) return;
  hidden = { inst: [], groups: [] };
  const b = CLUTTER_BOX;
  const inside = (p) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y > b.y0 && p.y < b.y1;
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const o of scene.children) {
    const obj = /** @type {any} */ (o);
    if (obj.isInstancedMesh) {
      let touched = false;
      for (let i = 0; i < obj.count; i++) {
        obj.getMatrixAt(i, m);
        p.setFromMatrixPosition(m);
        if (!inside(p)) continue;
        hidden.inst.push({ mesh: obj, i, m: m.clone() });
        obj.setMatrixAt(i, zero);
        touched = true;
      }
      if (touched) {
        obj.instanceMatrix.needsUpdate = true;
        obj.computeBoundingSphere();
      }
    } else if (obj.isGroup && obj.visible && obj.children.length === 4 && inside(obj.position) &&
      !obj.getObjectByProperty('isSkinnedMesh', true)) {
      // A rooftop billboard (two legs, a back panel and the printed ad).
      obj.visible = false;
      hidden.groups.push(obj);
    }
  }
}

/** Puts the hidden clutter back once the gala's dressing has left the scene. */
export function galaReset() {
  if (!hidden || (dressed && dressed.parent)) return;
  const meshes = new Set();
  for (const h of hidden.inst) {
    h.mesh.setMatrixAt(h.i, h.m);
    meshes.add(h.mesh);
  }
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  for (const g of hidden.groups) g.visible = true;
  hidden = null;
}

/** Wooden decking planks. */
function plankTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6b4a33';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,220,180,0.06)' : 'rgba(0,0,0,0.08)';
    g.fillRect(0, i * 32, 256, 30);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(0, i * 32 + 30, 256, 2);
    g.fillRect(((i * 97) % 200) + 20, i * 32, 2, 30);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** The campaign banner behind the lectern (invented slogan). */
function bannerTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 176;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2b4a';
  g.fillRect(0, 0, 512, 176);
  g.fillStyle = '#c9a45c';
  g.fillRect(0, 150, 512, 8);
  g.fillStyle = '#f3efe6';
  g.font = 'bold 64px "Rajdhani", "Arial Narrow", sans-serif';
  g.textAlign = 'center';
  g.fillText('VARENNE FORWARD', 256, 84);
  g.font = '600 30px "Inter", sans-serif';
  g.fillStyle = '#c9a45c';
  g.fillText('Councillor Mara Voss', 256, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft round glow for the bulbs. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,240,210,1)');
  grad.addColorStop(0.25, 'rgba(255,200,130,0.55)');
  grad.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
