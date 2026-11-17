// @ts-check
// Loading: the Poly Haven assets fetched in CI (public/game-assets, see assets.json) and the
// CC0 character and rifle models in public/models. Everything is optional: if a file is
// missing, the caller gets null and falls back to plain materials or simple shapes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = './game-assets/';
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const textureLoader = new THREE.TextureLoader();
/** @type {Map<string, Promise<any>>} */
const gltfCache = new Map();

/**
 * @typedef {{ sky: string | null, textures: Record<string, Record<string, string>>,
 *   models: Record<string, string>, credits: string[] }} Manifest
 */

/** @returns {Promise<Manifest | null>} */
export async function loadManifest() {
  try {
    const r = await fetch(BASE + 'manifest.json');
    if (!r.ok) return null;
    return await r.json();
  } catch (err) {
    return null;
  }
}

/** The sky panorama as an equirectangular HDR texture, or null. */
export async function loadSky(manifest) {
  if (!manifest || !manifest.sky) return null;
  try {
    const tex = await new RGBELoader().loadAsync(BASE + manifest.sky);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  } catch (err) {
    console.warn('Sky did not load.', err);
    return null;
  }
}

/**
 * A tiling ground material from a Poly Haven texture set, or null.
 * @param {Manifest | null} manifest
 * @param {string} name
 * @param {number} metresPerTile how many metres one texture tile covers
 */
export async function loadGroundMaterial(manifest, name, metresPerTile) {
  const set = manifest && manifest.textures[name];
  if (!set) return null;
  try {
    const [map, normalMap, arm] = await Promise.all([
      textureLoader.loadAsync(BASE + set.map),
      textureLoader.loadAsync(BASE + set.normal),
      textureLoader.loadAsync(BASE + set.arm)
    ]);
    map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [map, normalMap, arm]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
    }
    const mat = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      roughnessMap: arm,
      metalnessMap: arm,
      aoMap: arm,
      roughness: 1,
      metalness: 1
    });
    mat.userData.metresPerTile = metresPerTile;
    return mat;
  } catch (err) {
    console.warn('Texture set ' + name + ' did not load.', err);
    return null;
  }
}

/** Loads a glTF once and shares it. */
export function loadGLTF(url) {
  if (!gltfCache.has(url)) gltfCache.set(url, gltfLoader.loadAsync(url));
  return gltfCache.get(url);
}

/** A Poly Haven prop model's scene, or null. */
export async function loadProp(manifest, name) {
  const file = manifest && manifest.models[name];
  if (!file) return null;
  try {
    const g = await loadGLTF(BASE + file);
    g.scene.traverse((o) => {
      const m = /** @type {any} */ (o);
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return g.scene;
  } catch (err) {
    console.warn('Prop ' + name + ' did not load.', err);
    return null;
  }
}

/** Bounding box of an object in its current pose, skinned meshes included. */
export function measure(obj) {
  obj.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(obj, true);
}

/**
 * Places a clone of a prop so it stands on y = 0 at (x, z), turned by rotY, scaled so its
 * largest horizontal size is `size` metres (or unscaled when size is 0).
 */
export function placeProp(parent, prop, x, y, z, rotY, size) {
  if (!prop) return null;
  const obj = prop.clone(true);
  if (size) {
    const s = measure(obj).getSize(new THREE.Vector3());
    obj.scale.multiplyScalar(size / Math.max(s.x, s.z));
  }
  const box = measure(obj);
  obj.position.set(x, y - box.min.y, z);
  obj.rotation.y = rotY;
  parent.add(obj);
  return obj;
}

/**
 * A converted Rocketbox animation (see scripts/fetch-animations.mjs): rotation tracks per
 * Biped bone sampled at `fps`, an optional hip bob in metres and the measured walking speed.
 * @typedef {{ name: string, duration: number, fps: number, frames: number, speed: number,
 *   bob: number[] | null, tracks: Record<string, number[]> }} AnimData
 */

/**
 * Loads every clip listed in game-assets/anims/manifest.json, or returns null if the
 * animations were not built (the crowd then falls back to the CC0 placeholder person).
 * @returns {Promise<Record<string, AnimData> | null>}
 */
export async function loadAnimationSet() {
  try {
    const r = await fetch(BASE + 'anims/manifest.json');
    if (!r.ok) return null;
    const manifest = await r.json();
    const names = Object.keys(manifest.clips || {});
    const list = await Promise.all(names.map(async (name) => {
      const res = await fetch(BASE + 'anims/' + manifest.clips[name].file);
      if (!res.ok) throw new Error('Animation ' + name + ' is missing');
      return /** @type {AnimData} */ (await res.json());
    }));
    /** @type {Record<string, AnimData>} */
    const out = {};
    names.forEach((n, i) => {
      out[n] = list[i];
    });
    return out;
  } catch (err) {
    console.warn('Animations did not load.', err);
    return null;
  }
}
