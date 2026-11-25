// @ts-check
// First-person gloved hands holding a sniper rifle ("sniper animated" by bumstrum on Sketchfab,
// CC BY, test-only list in sketchfab.json). The model's own idle pose is frozen and the model is
// placed in front of the camera; recoil moves the holder in game.js.
// Returns null when the file is missing, so the plain rifle view stays as the fallback.
import * as THREE from 'three';
import { loadGLTF } from './assets.js';

/**
 * Placement in the rifle holder's space (game.js puts the holder at 0.17, -0.2, -0.36 in front
 * of the camera), tuned in the browser at a 780x360 phone view. The model is authored in
 * centimetres with its origin at the eye and the barrel along +z, hence the half turn.
 */
export const ARMS_FIT = { scale: 0.01, x: 0.03, y: -0.075, z: 0, rx: 0.02, ry: Math.PI + 0.06, rz: 0, poseTime: 0 };

/**
 * @returns {Promise<{ root: THREE.Group, model: THREE.Object3D, mixer: THREE.AnimationMixer | null,
 *   clips: THREE.AnimationClip[], fit: (f?: Partial<typeof ARMS_FIT>) => void,
 *   setSuppressor: (on: boolean) => void } | null>}
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
  // inner: scales the model to metres; root: places it in the rifle holder.
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
    inner.scale.setScalar(ARMS_FIT.scale);
    root.position.set(ARMS_FIT.x, ARMS_FIT.y, ARMS_FIT.z);
    root.rotation.set(ARMS_FIT.rx, ARMS_FIT.ry, ARMS_FIT.rz, 'YXZ');
  };
  fit();
  // The model's rifle has a silencer part (silencer_sniper_0): shown only for a suppressed rifle.
  /** @type {THREE.Object3D[]} */
  const silencers = [];
  model.traverse((o) => {
    if (/silencer/i.test(o.name)) silencers.push(o);
  });
  /** @param {boolean} on */
  const setSuppressor = (on) => {
    for (const o of silencers) o.visible = on;
  };
  setSuppressor(false);
  return { root, model, mixer, clips: gltf.animations, fit, setSuppressor };
}
