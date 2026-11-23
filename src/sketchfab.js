// @ts-check
// Test-only Sketchfab models (sketchfab.json), fetched and shrunk in CI into
// public/game-assets/sketchfab/. Each file is a pack of named parts (buildings, props); the game
// picks single parts out of a pack and places them. Everything returns null when a file is missing,
// so the procedural city stays as the fallback.
import * as THREE from 'three';
import { loadGLTF } from './assets.js';
import { bakeByMaterial, instanced, place } from './instancing.js';

const BASE = './game-assets/sketchfab/';

/**
 * @typedef {{ name: string, parts: Map<string, THREE.Object3D> }} Pack
 */

/**
 * Loads a pack and indexes its parts by node name. Each part is detached from the pack's
 * wrapper nodes with its world transform baked into its own, so a clone stands on its own.
 * @param {string} name
 * @returns {Promise<Pack | null>}
 */
export async function loadPack(name) {
  try {
    const gltf = await loadGLTF(BASE + name + '.glb');
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    // Walk down while there is a single child: Sketchfab wraps a pack in a few root nodes.
    /** @type {THREE.Object3D[]} */
    let level = root.children;
    while (level.length === 1 && level[0].children.length > 0) level = level[0].children;
    /** @type {Map<string, THREE.Object3D>} */
    const parts = new Map();
    for (const node of level) {
      const holder = new THREE.Group();
      const part = node.clone(true);
      node.matrixWorld.decompose(part.position, part.quaternion, part.scale);
      holder.add(part);
      holder.traverse((o) => {
        const m = /** @type {any} */ (o);
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      // Centre the footprint on the origin and stand it on y = 0.
      holder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(holder);
      if (box.isEmpty()) continue;
      const c = box.getCenter(new THREE.Vector3());
      part.position.x -= c.x;
      part.position.z -= c.z;
      part.position.y -= box.min.y;
      holder.name = node.name;
      parts.set(node.name, holder);
    }
    return { name, parts };
  } catch (err) {
    console.warn('Sketchfab pack ' + name + ' did not load.', err);
    return null;
  }
}

/** Size of a part as loaded (metres): x width, y height, z depth. */
export function partSize(part) {
  part.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(part).getSize(new THREE.Vector3());
}

/**
 * Places a clone of a part with its footprint centred on (x, z), standing on y, turned by rot
 * (radians) and scaled uniformly by s.
 * @param {THREE.Object3D} parent
 * @param {THREE.Object3D} part
 * @param {{ x: number, z: number, y?: number, rot?: number, s?: number }} at
 */
export function placePart(parent, part, at) {
  const obj = part.clone(true);
  obj.position.set(at.x, at.y || 0, at.z);
  obj.rotation.y = at.rot || 0;
  obj.scale.setScalar(at.s || 1);
  parent.add(obj);
  obj.updateMatrixWorld(true);
  return obj;
}

/**
 * Fits a building part into a footprint slot (w along x, d along z): picks the turn (0 or 90
 * degrees) that wastes least space and the largest uniform scale that fits, within limits.
 * @param {THREE.Object3D} part
 * @param {number} w
 * @param {number} d
 */
export function fitScale(part, w, d) {
  const s = partSize(part);
  const straight = Math.min(w / s.x, d / s.z);
  const turned = Math.min(w / s.z, d / s.x);
  const rot = turned > straight * 1.05 ? Math.PI / 2 : 0;
  return { rot, s: Math.max(0.35, Math.min(1.6, Math.max(straight, turned))) };
}

/**
 * Draws many copies of one part with one InstancedMesh per material (a few draw calls for any
 * number of copies). Each spot stands on its y (default 0), turned by rot, scaled by s.
 * @param {THREE.Object3D} parent
 * @param {THREE.Object3D | null | undefined} part
 * @param {{ x: number, z: number, y?: number, rot?: number, s?: number }[]} spots
 */
export function instancePart(parent, part, spots) {
  if (!part || !spots.length) return null;
  part.updateMatrixWorld(true);
  const set = instanced(bakeByMaterial(part), spots.length);
  spots.forEach((p, i) => set.set(i, place(p.x, p.y || 0, p.z, p.rot || 0, p.s || 1)));
  set.finish();
  parent.add(set.group);
  return set.group;
}

/**
 * The world-space box of an object as a bullet collider [minX, minY, minZ, maxX, maxY, maxZ],
 * plus its meshes for the rangefinder.
 * @param {THREE.Object3D} obj
 */
export function solidOf(obj) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  /** @type {THREE.Mesh[]} */
  const meshes = [];
  obj.traverse((o) => {
    if (/** @type {any} */ (o).isMesh) meshes.push(/** @type {THREE.Mesh} */ (o));
  });
  return { box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z], meshes, top: b.max.y };
}
