// @ts-check
// Sky, image-based lighting, sun with shadows, and atmosphere (fog). The city and lighting
// work owns this file; game.js only calls setupLighting() and uses the returned sun.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadSky } from './assets.js';

/**
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {import('./assets.js').Manifest | null} manifest
 * @returns {Promise<{ sun: THREE.DirectionalLight }>}
 */
export async function setupLighting(scene, renderer, manifest) {
  scene.fog = new THREE.FogExp2('#b9c4cf', 0.0011);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const sky = await loadSky(manifest);
  if (sky) {
    scene.background = sky;
    scene.environment = pmrem.fromEquirectangular(sky).texture;
  } else {
    scene.background = new THREE.Color('#a9c1d9');
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight('#d6e6f5', '#5d544b', 0.55));
  const sun = new THREE.DirectionalLight('#fff1dc', 2.8);
  sun.position.set(130, 210, 40);
  sun.target.position.set(0, 0, -70);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.near = 20; sc.far = 520;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  return { sun };
}
