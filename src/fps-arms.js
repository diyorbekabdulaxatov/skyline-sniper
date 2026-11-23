// @ts-check
// First-person gloved hands holding a sniper rifle ("sniper animated" by bumstrum on Sketchfab,
// CC BY, test-only list in sketchfab.json). The model's own idle pose is frozen and the whole
// model is sized and placed in front of the camera; recoil moves the holder in game.js.
// Returns null when the file is missing, so the plain rifle view stays as the fallback.
import * as THREE from 'three';
import { loadGLTF } from './assets.js';

/**
 * Placement of the model in camera space, tuned in the browser: longest side in metres,
 * offset (x right, y up, z forward is negative) and turn in radians.
 */
export const ARMS_FIT = { size: 1.05, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, poseTime: 0 };

/**
 * @returns {Promise<{ root: THREE.Group, model: THREE.Object3D, mixer: THREE.AnimationMixer | null,
 *   clips: THREE.AnimationClip[], fit: (f?: Partial<typeof ARMS_FIT>) => void } | null>}
 */
export async function loadFpsArms() {
  let gltf;
  try {
    gltf = await loadGLTF('./game-assets/sketchfab/fps_arms_sniper.glb');
  } catch (err) {
    return null;
  }
  const model = gltf.scene;
  model.traverse((o) => {
    const m = /** @type {any} */ (o);
    if (m.isMesh) {
      // Skinned meshes keep bounds from the bind pose; never cull the view model.
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });
  /** @type {THREE.AnimationMixer | null} */
  let mixer = null;
  /** @type {THREE.AnimationAction | null} */
  let action = null;
  if (gltf.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    action = mixer.clipAction(gltf.animations[0]);
    action.play();
  }
  // inner: centres and sizes the posed model; root: placed in camera space.
  const inner = new THREE.Group();
  inner.add(model);
  const root = new THREE.Group();
  root.add(inner);

  /** @param {Partial<typeof ARMS_FIT>} [f] */
  const fit = (f) => {
    Object.assign(ARMS_FIT, f || {});
    if (mixer && action) {
      action.paused = false;
      mixer.setTime(ARMS_FIT.poseTime);
      action.paused = true;
    }
    inner.scale.setScalar(1);
    inner.position.set(0, 0, 0);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const size = box.getSize(new THREE.Vector3());
    const k = ARMS_FIT.size / Math.max(size.x, size.y, size.z, 1e-6);
    const c = box.getCenter(new THREE.Vector3());
    inner.scale.setScalar(k);
    inner.position.set(-c.x * k, -c.y * k, -c.z * k);
    root.position.set(ARMS_FIT.x, ARMS_FIT.y, ARMS_FIT.z);
    root.rotation.set(ARMS_FIT.rx, ARMS_FIT.ry, ARMS_FIT.rz, 'YXZ');
  };
  fit();
  return { root, model, mixer, clips: gltf.animations, fit };
}
