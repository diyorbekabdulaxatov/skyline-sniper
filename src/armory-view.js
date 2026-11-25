// @ts-check
// The rifle on show in the Armory: its own small renderer, studio lighting and a slow turn.
// It only draws while the Armory is open. setModel() switches to another rifle's model; models
// are loaded once and kept, and a missing model falls back to the default rifle.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadFittedRifle } from './rifle-model.js';

/** @param {HTMLCanvasElement} canvas */
export function createArmoryView(canvas) {
  /** @type {THREE.WebGLRenderer | null} */
  let renderer = null;
  /** @type {THREE.Scene | null} */
  let scene = null;
  /** @type {THREE.PerspectiveCamera | null} */
  let camera = null;
  /** @type {THREE.Object3D | null} */
  let rifle = null;
  let running = false;
  let started = false;
  let last = 0;
  let angle = 0.6;
  /** @type {any} */
  let drag = null;
  /** The model the store wants on show (a URL), and the fitted models loaded so far. */
  let wanted = '';
  /** @type {Map<string, Promise<THREE.Object3D | null>>} */
  const fitted = new Map();

  /** @param {string} url @returns {Promise<THREE.Object3D | null>} */
  function fittedModel(url) {
    if (!fitted.has(url)) {
      fitted.set(url, (async () => {
        try {
          const own = await loadFittedRifle(1.25, true, url || undefined);
          if (own) return own;
        } catch (err) {
          console.warn('Armory rifle model did not load: ' + url, err);
        }
        // The default rifle stands in for a missing or broken model.
        try {
          return url ? await loadFittedRifle(1.25, true) : null;
        } catch (err) {
          return null;
        }
      })());
    }
    return fitted.get(url);
  }

  /** Puts the wanted model on the stand once it has loaded (unless another was chosen since). */
  async function showWanted() {
    if (!scene) return;
    const url = wanted;
    const model = await fittedModel(url);
    if (url !== wanted || !scene) return;
    if (rifle && rifle !== model) scene.remove(rifle);
    rifle = model;
    if (rifle) scene.add(rifle);
  }

  async function setup() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (err) {
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight('#fff3e0', 2.2);
    key.position.set(2, 3, 2);
    scene.add(key, new THREE.HemisphereLight('#dfe8f2', '#30343a', 0.8));
    camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    camera.position.set(0, 0.25, 2.1);
    camera.lookAt(0, 0, 0);
    await showWanted();
    // Drag to turn the rifle.
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, a: angle };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* optional */
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (drag) angle = drag.a + (e.clientX - drag.x) * 0.01;
    });
    const end = () => {
      drag = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < 1000 / 30 - 3) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!renderer || !scene || !camera) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    // Hidden (the Gear tab is open): nothing to draw.
    if (!w || !h) return;
    const ratio = renderer.getPixelRatio();
    if (canvas.width !== Math.floor(w * ratio) || canvas.height !== Math.floor(h * ratio)) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if (!drag) angle += dt * 0.35;
    if (rifle) {
      rifle.rotation.y = angle;
      rifle.rotation.x = 0.08;
    }
    renderer.render(scene, camera);
  }

  return {
    /** Shows another rifle model (a URL; empty for the default rifle). */
    setModel(url) {
      if (url === wanted) return;
      wanted = url;
      showWanted();
    },
    async show() {
      if (!started) {
        started = true;
        await setup();
      }
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    },
    hide() {
      running = false;
    }
  };
}
