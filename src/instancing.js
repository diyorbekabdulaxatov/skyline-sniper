// @ts-check
// Turns a loaded glTF (any hierarchy, many meshes) into one InstancedMesh per material, so a
// model placed 20 times costs as many draw calls as it has materials, not 20 times that.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Bakes the meshes under `root` (optionally filtered) into merged geometries grouped by
 * material, in the coordinate frame of `root`. Only position, normal and uv are kept.
 * @param {THREE.Object3D} root
 * @param {(mesh: THREE.Mesh) => boolean} [filter]
 * @returns {Map<THREE.Material, THREE.BufferGeometry>}
 */
export function bakeByMaterial(root, filter) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  /** @type {Map<THREE.Material, THREE.BufferGeometry[]>} */
  const lists = new Map();
  root.traverse((o) => {
    const mesh = /** @type {THREE.Mesh} */ (o);
    if (!mesh.isMesh) return;
    if (filter && !filter(mesh)) return;
    const material = /** @type {THREE.Material} */ (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material);
    const m = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
    let g = mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    g.morphAttributes = {};
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    // Dequantise (KHR_mesh_quantization) so every geometry has plain float attributes.
    for (const name of ['position', 'normal', 'uv']) {
      const attr = /** @type {THREE.BufferAttribute} */ (g.attributes[name]);
      if (!(attr.array instanceof Float32Array) || attr.normalized) {
        const n = attr.itemSize;
        const out = new Float32Array(attr.count * n);
        for (let i = 0; i < attr.count; i++) {
          out[i * n] = attr.getX(i);
          if (n > 1) out[i * n + 1] = attr.getY(i);
          if (n > 2) out[i * n + 2] = attr.getZ(i);
        }
        g.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
      }
    }
    g.applyMatrix4(m);
    // A mirrored transform (negative scale) reverses the triangle winding once baked in.
    if (m.determinant() < 0) flipWinding(g);
    if (!lists.has(material)) lists.set(material, []);
    lists.get(material).push(g);
  });
  /** @type {Map<THREE.Material, THREE.BufferGeometry>} */
  const merged = new Map();
  for (const [mat, list] of lists) {
    const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (g) merged.set(mat, g);
  }
  return merged;
}

/** Swaps the second and third vertex of every triangle of a non-indexed geometry. */
function flipWinding(g) {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name];
    const n = a.itemSize;
    const arr = a.array;
    for (let t = 0; t + 2 < a.count; t += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (t + 1) * n + k;
        const i2 = (t + 2) * n + k;
        const tmp = arr[i1];
        arr[i1] = arr[i2];
        arr[i2] = tmp;
      }
    }
    a.needsUpdate = true;
  }
}

/**
 * Scales and moves baked geometries together so the whole set has the given height (or
 * length along its longest horizontal axis when `byLength`), its base at y = 0 and its
 * footprint centred on the origin.
 * @param {Map<THREE.Material, THREE.BufferGeometry>} baked
 * @param {{ height?: number, length?: number }} size
 */
export function normalise(baked, size) {
  const box = new THREE.Box3();
  for (const g of baked.values()) {
    g.computeBoundingBox();
    box.union(g.boundingBox);
  }
  const s = box.getSize(new THREE.Vector3());
  const k = size.height ? size.height / s.y : size.length ? size.length / Math.max(s.x, s.z) : 1;
  const c = box.getCenter(new THREE.Vector3());
  const m = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
  for (const g of baked.values()) {
    g.applyMatrix4(m);
    g.computeBoundingBox();
    g.computeBoundingSphere();
  }
  return { width: s.x * k, height: s.y * k, depth: s.z * k };
}

/**
 * One InstancedMesh per material. `paint` picks the material(s) that get per-instance colours.
 * @param {Map<THREE.Material, THREE.BufferGeometry>} baked
 * @param {number} count
 * @param {{ paint?: (m: THREE.Material) => boolean, shadows?: boolean, moving?: boolean,
 *   remap?: (m: THREE.Material) => THREE.Material }} [opts]
 */
export function instanced(baked, count, opts = {}) {
  const group = new THREE.Group();
  /** @type {THREE.InstancedMesh[]} */
  const meshes = [];
  /** @type {THREE.InstancedMesh[]} */
  const painted = [];
  for (const [mat, geo] of baked) {
    const material = opts.remap ? opts.remap(mat) : mat;
    const mesh = new THREE.InstancedMesh(geo, material, count);
    mesh.castShadow = opts.shadows !== false;
    mesh.receiveShadow = true;
    // Moving instances outgrow their bounds; static ones get fresh bounds in finish().
    mesh.frustumCulled = !opts.moving;
    if (opts.paint && opts.paint(mat)) painted.push(mesh);
    group.add(mesh);
    meshes.push(mesh);
  }
  return {
    group,
    meshes,
    /** @param {number} i @param {THREE.Matrix4} matrix */
    set(i, matrix) {
      for (const m of meshes) m.setMatrixAt(i, matrix);
    },
    /** @param {number} i @param {THREE.Color} color */
    paint(i, color) {
      for (const m of painted) m.setColorAt(i, color);
    },
    /** Uploads changed matrices and colours; static sets also refresh their bounds. */
    finish() {
      for (const m of meshes) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        if (m.frustumCulled) m.computeBoundingSphere();
      }
    }
  };
}

/** Helper: a placement matrix from position, rotation about y and uniform scale. */
export function place(x, y, z, rotY, scale) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY || 0);
  const s = scale || 1;
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
}
