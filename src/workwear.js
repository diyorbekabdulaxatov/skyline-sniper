// @ts-check
// Site workwear for people: a hard hat, a hi-vis vest and a recoloured coat, chosen per person
// through their Look (hat, vest and coat colours). The hat and vest are one small skinned mesh
// bound to the avatar's own skeleton (hat vertices to the head bone, vest vertices to the upper
// spine), so they follow every animation and the procedural fall at one extra draw call each.
// Everything is optional: without a skeleton or a texture it quietly does less.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** One material for all workwear; the colours live in the vertices. */
const wearMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
/** Recoloured clothing textures, shared by people (and the briefing photo) with the same look. */
const tinted = new Map();
const BAND = '#d9dde0';

/**
 * @param {{ model: THREE.Object3D, root: THREE.Object3D, h: number }} person
 * @param {{ hat?: string, vest?: string, coat?: string }} look
 */
export function dressWorkwear(person, look) {
  if (!look || (!look.hat && !look.vest && !look.coat)) return;
  try {
    if (look.coat) tintClothes(person.model, look.coat);
    if (look.hat || look.vest) addWear(person, look);
  } catch (err) {
    console.warn('Workwear failed for one person.', err);
  }
}

/** Builds the hat and vest in the person's own frame (metres, facing +z) and skins them. */
function addWear(person, look) {
  /** @type {any} */
  let skinned = null;
  person.model.traverse((o) => {
    if (!skinned && /** @type {any} */ (o).isSkinnedMesh) skinned = o;
  });
  if (!skinned) return;
  const skeleton = skinned.skeleton;
  const bones = skeleton.bones;
  const find = (re) => bones.find((b) => re.test(b.name));
  const head = find(/^Bip01_Head$/) || find(/head/i);
  const chest = find(/^Bip01_Spine2$/) || find(/^Bip01_Spine1$/) || find(/spine|chest/i);
  const root = person.root;
  root.updateMatrixWorld(true);
  const h = person.h;
  const s = h / 1.8;
  const local = (bone) => root.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));

  /** @type {THREE.BufferGeometry[]} */
  const parts = [];
  if (look.hat && head) {
    const hp = local(head);
    const hat = [];
    const dome = new THREE.SphereGeometry(0.135, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, 0.82, 1.08);
    hat.push(dome);
    const brim = new THREE.CylinderGeometry(0.158, 0.164, 0.014, 18);
    brim.scale(1, 1, 1.14);
    brim.translate(0, 0.006, 0.022);
    hat.push(brim);
    const ridge = new THREE.BoxGeometry(0.03, 0.022, 0.26);
    ridge.translate(0, 0.108, 0);
    hat.push(ridge);
    const geo = colourise(mergeGeometries(hat.map(plain), false), look.hat);
    geo.scale(s, s, s);
    geo.translate(hp.x, h - 0.072 * s, hp.z + 0.012 * s);
    parts.push(skin(geo, skeleton, head, root));
  }
  if (look.vest && chest) {
    const cp = local(chest);
    const y0 = 0.53 * h;
    const y1 = 0.79 * h;
    const rx = 0.172 * s;
    const rz = 0.122 * s;
    const vest = [];
    const shell = new THREE.CylinderGeometry(0.97, 1, 1, 18, 1, true);
    shell.scale(rx, y1 - y0, rz);
    shell.translate(0, (y0 + y1) / 2, 0);
    vest.push(colourise(plain(shell), look.vest));
    for (const f of [0.3, 0.62]) {
      const band = new THREE.CylinderGeometry(1.012, 1.012, 1, 18, 1, true);
      band.scale(rx, 0.036 * s, rz);
      band.translate(0, y0 + (y1 - y0) * f, 0);
      vest.push(colourise(plain(band), BAND));
    }
    for (const side of [-1, 1]) {
      const strap = new THREE.BoxGeometry(0.075 * s, 0.03 * s, rz * 1.9);
      strap.translate(side * 0.095 * s, y1 + 0.012 * s, 0);
      vest.push(colourise(plain(strap), look.vest));
    }
    const geo = mergeGeometries(vest, false);
    geo.translate(cp.x, 0, cp.z + 0.015 * s);
    parts.push(skin(geo, skeleton, chest, root));
  }
  if (!parts.length) return;
  const merged = mergeGeometries(parts, false);
  if (!merged) return;
  const mesh = new THREE.SkinnedMesh(merged, wearMaterial);
  mesh.name = 'workwear';
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  // An explicit identity bind matrix: bind() without one would recompute the shared skeleton's
  // inverses and spoil the avatar's own skinning.
  mesh.bind(skeleton, new THREE.Matrix4());
  person.root.add(mesh);
}

/**
 * Moves a geometry from the person's frame into the space of a vertex bound rigidly to one bone
 * and gives every vertex full weight on that bone. The skinning shader computes
 * boneWorld * boneInverse * v, so a point p of the person's frame (in the pose of this moment)
 * must be written as v = inverse(boneInverse) * inverse(boneWorld) * rootWorld * p.
 * @param {THREE.BufferGeometry} geo
 * @param {THREE.Skeleton} skeleton
 * @param {THREE.Bone} bone
 * @param {THREE.Object3D} root
 */
function skin(geo, skeleton, bone, root) {
  const index = skeleton.bones.indexOf(bone);
  const m = new THREE.Matrix4().copy(skeleton.boneInverses[index]).invert()
    .multiply(new THREE.Matrix4().copy(bone.matrixWorld).invert())
    .multiply(root.matrixWorld);
  geo.applyMatrix4(m);
  const n = geo.attributes.position.count;
  const idx = new Uint16Array(n * 4);
  const w = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    idx[i * 4] = index;
    w[i * 4] = 1;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
  return geo;
}

/** Keeps only position and normal, non-indexed, so different shapes merge. */
function plain(g) {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) {
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  }
  return out;
}

/** Paints every vertex one colour (sRGB string), in the renderer's working colour space. */
function colourise(g, colour) {
  const c = new THREE.Color(colour);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/**
 * Recolours the avatar's clothes (its "body" material) toward `colour`, keeping the fabric's
 * light and dark detail, skin and strongly coloured pieces such as a shirt.
 */
function tintClothes(model, colour) {
  model.traverse((o) => {
    const mesh = /** @type {any} */ (o);
    if (!mesh.isMesh) return;
    const swap = (m) => {
      if (!m || !/body/i.test(m.name || '')) return m;
      const c = m.clone();
      const map = m.map ? tintedMap(m.map, colour) : null;
      if (map) c.map = map;
      else c.color.set(colour);
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
}

/**
 * @param {THREE.Texture} map
 * @param {string} colour
 */
function tintedMap(map, colour) {
  const key = map.uuid + colour;
  if (tinted.has(key)) return tinted.get(key);
  const img = /** @type {any} */ (map.image);
  if (!img || !img.width || typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const hex = parseInt(colour.replace('#', ''), 16);
  const cr = (hex >> 16) & 255;
  const cg = (hex >> 8) & 255;
  const cb = hex & 255;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const gg = px[i + 1];
    const b = px[i + 2];
    const max = Math.max(r, gg, b);
    const min = Math.min(r, gg, b);
    const skin = r > 120 && r > gg && gg > b && r - b > 45 && gg - b > 8;
    if (skin || max - min > 70) continue;
    const lum = (0.3 * r + 0.59 * gg + 0.11 * b) / 255;
    const k = Math.min(1.6, lum / 0.42);
    px[i] = Math.min(255, cr * k);
    px[i + 1] = Math.min(255, cg * k);
    px[i + 2] = Math.min(255, cb * k);
  }
  g.putImageData(data, 0, 0);
  const tex = map.clone();
  tex.source = new THREE.Source(canvas);
  tex.needsUpdate = true;
  tinted.set(key, tex);
  return tex;
}
