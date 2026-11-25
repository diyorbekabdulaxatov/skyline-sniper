// @ts-check
// Loads the rifle model and fits it to a standard frame: barrel along -z (muzzle away from the
// shooter), centred, `length` metres long. Used by the first-person view and the Armory.
import * as THREE from 'three';
import { loadGLTF, measure } from './assets.js';

/** The placeholder AWM-style model (CC BY-NC-SA, test builds only), then the CC0 rifle. */
const MODELS = ['./models/rifle_awm_nc.glb', './models/rifle.glb'];

/** Model sample points in the space of `root`, skinned meshes included (bind pose). */
function samplePoints(root, max) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const pts = [];
  root.traverse((o) => {
    const mesh = /** @type {any} */ (o);
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.attributes.position;
    const stride = Math.max(1, Math.floor(pos.count / max));
    for (let i = 0; i < pos.count; i += stride) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      if (mesh.isSkinnedMesh) mesh.applyBoneTransform(i, v);
      v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
      pts.push(v);
    }
  });
  return pts;
}

/**
 * A fitted rifle: a Group whose child is the model, barrel along -z, `length` metres long,
 * centred on the origin. `clone` must be true when the same model is shown twice. `url` is
 * tried first; when it is missing the default models stand in. Returns null when none loads.
 * @param {number} length
 * @param {boolean} [clone]
 * @param {string} [url]
 */
export async function loadFittedRifle(length, clone, url) {
  let gltf = null;
  for (const u of url ? [url, ...MODELS] : MODELS) {
    try {
      gltf = await loadGLTF(u);
      break;
    } catch (err) {
      /* try the next model */
    }
  }
  if (!gltf) return null;
  // Skinned parts stay bound to their own skeleton, so a second copy needs a real deep clone.
  const { clone: skeletonClone } = await import('three/addons/utils/SkeletonUtils.js');
  const model = clone ? skeletonClone(gltf.scene) : gltf.scene;
  model.traverse((o) => {
    const m = /** @type {any} */ (o);
    if (m.isMesh && m.material) {
      m.material = m.material.clone();
      m.material.metalness = Math.min(0.45, m.material.metalness ?? 0.3);
      m.material.roughness = Math.max(0.45, m.material.roughness ?? 0.55);
      m.frustumCulled = false;
    }
  });

  const turn = new THREE.Group();
  turn.add(model);
  // Longest axis onto z.
  const size = measure(turn).getSize(new THREE.Vector3());
  if (size.x >= size.y && size.x >= size.z) model.rotation.y = Math.PI / 2;
  else if (size.y >= size.x && size.y >= size.z) model.rotation.x = Math.PI / 2;
  // The muzzle is the thin end: compare how tall each end is, then point it along -z.
  const pts = samplePoints(turn, 3000);
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const p of pts) {
    zMin = Math.min(zMin, p.z);
    zMax = Math.max(zMax, p.z);
  }
  const span = (list) => {
    if (!list.length) return 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of list) {
      lo = Math.min(lo, p.y);
      hi = Math.max(hi, p.y);
    }
    return hi - lo;
  };
  const len = zMax - zMin;
  const farEnd = span(pts.filter((p) => p.z < zMin + len * 0.12));
  const nearEnd = span(pts.filter((p) => p.z > zMax - len * 0.12));
  if (nearEnd < farEnd) turn.rotation.y = Math.PI;

  const wrap = new THREE.Group();
  wrap.add(turn);
  const s = measure(wrap).getSize(new THREE.Vector3());
  const longest = Math.max(s.x, s.y, s.z);
  // An empty or broken model: let the caller fall back to the default rifle.
  if (!(longest > 0) || !Number.isFinite(longest)) return null;
  wrap.scale.setScalar(length / longest);
  const c = measure(wrap).getCenter(new THREE.Vector3());
  wrap.position.sub(c);
  const holder = new THREE.Group();
  holder.add(wrap);
  return holder;
}
