// @ts-check
// Golden-hour lighting: an HDR sunset sky (image-based light and background), a warm low sun
// that casts shadows, warm haze and a lens flare. The sky panorama is turned so its sun sits
// to the player's left-front (west-north-west), and the shadow-casting light is placed on the
// sun found in the HDR data, so light and sky always agree.
// game.js only calls setupLighting() and resizes the returned sun's shadow map by quality.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { loadSky } from './assets.js';

/**
 * Where the sun should appear: angle about y from +z toward +x (the player looks along -z).
 * West and a little behind the player, so the facades the player faces are lit, the plaza is
 * not in the towers' shadow, and the sun and its flare show when the player turns left.
 */
const SUN_AZIMUTH = -1.25;
/** The shadow light never goes lower than this, so the plaza is not lost in long shadows. */
const MIN_LIGHT_ELEVATION = 0.36;
const PLAZA = new THREE.Vector3(0, 0, -70);

/** Looks for each time of day, all lit by the same sky panorama. */
const PRESETS = {
  golden: { exposure: 1.12, fog: '#c9b39e', fogDensity: 0.00085, env: 1.05, sky: 1, hemiSky: '#f3d6b8', hemiGround: '#5a4c42', hemi: 0.55, sun: '#ffc590', sunIntensity: 2.6, flare: true },
  sunset: { exposure: 1.0, fog: '#d8a07c', fogDensity: 0.0009, env: 0.95, sky: 0.95, hemiSky: '#ffcfa6', hemiGround: '#55443a', hemi: 0.62, sun: '#ff9c58', sunIntensity: 2.4, flare: true },
  dusk: { exposure: 0.62, fog: '#3d4763', fogDensity: 0.0012, env: 0.45, sky: 0.45, hemiSky: '#8494c0', hemiGround: '#2a2a33', hemi: 0.45, sun: '#ffae78', sunIntensity: 0.55, flare: false }
};

/**
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {import('./assets.js').Manifest | null} manifest
 * @returns {Promise<{ sun: THREE.DirectionalLight, setPreset: (name: string, focus?: { x: number, z: number }) => void }>}
 */
export async function setupLighting(scene, renderer, manifest) {
  renderer.toneMappingExposure = 1.12;
  scene.fog = new THREE.FogExp2('#c9b39e', 0.00085);

  // Direction toward the sun in the world, after the sky is turned.
  const sunDir = new THREE.Vector3(Math.sin(SUN_AZIMUTH), 0.12, Math.cos(SUN_AZIMUTH)).normalize();

  const pmrem = new THREE.PMREMGenerator(renderer);
  const sky = await loadSky(manifest);
  if (sky) {
    const found = findSun(sky);
    if (found) {
      const texAzimuth = Math.atan2(found.x, found.z);
      const turn = texAzimuth - SUN_AZIMUTH;
      scene.backgroundRotation.set(0, turn, 0);
      scene.environmentRotation.set(0, turn, 0);
      sunDir.copy(found).applyAxisAngle(new THREE.Vector3(0, 1, 0), -turn).normalize();
    }
    scene.background = sky;
    scene.environment = pmrem.fromEquirectangular(sky).texture;
  } else {
    scene.background = new THREE.Color('#d8b89a');
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  pmrem.dispose();
  scene.environmentIntensity = 1.05;

  const hemi = new THREE.HemisphereLight('#f3d6b8', '#5a4c42', 0.55);
  scene.add(hemi);

  // Shadow light: same azimuth as the sky's sun, raised to a playable minimum elevation.
  const lightDir = sunDir.clone();
  const elevation = Math.asin(Math.min(1, Math.max(-1, lightDir.y)));
  if (elevation < MIN_LIGHT_ELEVATION) {
    const flat = Math.hypot(lightDir.x, lightDir.z) || 1;
    lightDir.set(
      (lightDir.x / flat) * Math.cos(MIN_LIGHT_ELEVATION),
      Math.sin(MIN_LIGHT_ELEVATION),
      (lightDir.z / flat) * Math.cos(MIN_LIGHT_ELEVATION)
    );
  }
  const sun = new THREE.DirectionalLight('#ffc590', 2.6);
  sun.position.copy(PLAZA).addScaledVector(lightDir, 320);
  sun.target.position.copy(PLAZA);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -150; sc.right = 150; sc.top = 150; sc.bottom = -150; sc.near = 20; sc.far = 700;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // Lens flare on the visible sun, far away along its true direction.
  const flareAnchor = new THREE.Object3D();
  flareAnchor.position.copy(sunDir).multiplyScalar(3000);
  flareAnchor.add(makeFlare());
  scene.add(flareAnchor);

  /**
   * Time-of-day presets: the same sky panorama, tinted and dimmed. `focus` moves the shadow
   * camera to where the contract happens (the shadow map only covers 300 x 300 m).
   * @param {string} name 'golden' | 'sunset' | 'dusk'
   * @param {{ x: number, z: number }} [focus]
   */
  function setPreset(name, focus) {
    const p = PRESETS[name] || PRESETS.golden;
    renderer.toneMappingExposure = p.exposure;
    /** @type {THREE.FogExp2} */ (scene.fog).color.set(p.fog);
    /** @type {THREE.FogExp2} */ (scene.fog).density = p.fogDensity;
    scene.environmentIntensity = p.env;
    scene.backgroundIntensity = p.sky;
    hemi.color.set(p.hemiSky);
    hemi.groundColor.set(p.hemiGround);
    hemi.intensity = p.hemi;
    sun.color.set(p.sun);
    sun.intensity = p.sunIntensity;
    flareAnchor.visible = p.flare;
    const f = focus || { x: PLAZA.x, z: PLAZA.z };
    sun.target.position.set(f.x, 0, f.z);
    sun.position.copy(sun.target.position).addScaledVector(lightDir, 320);
    sun.target.updateMatrixWorld();
  }
  setPreset('golden');

  return { sun, setPreset };
}

/**
 * Finds the brightest region of an equirectangular HDR texture and returns the direction to
 * it in the texture's own frame (three's equirect convention), or null if the data is unusable.
 * @param {THREE.Texture} tex
 */
function findSun(tex) {
  const img = /** @type {any} */ (tex).image;
  if (!img || !img.data || !img.width) return null;
  const { data, width: w, height: h } = img;
  const half = data instanceof Uint16Array;
  const read = (i) => (half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i]);
  let best = -1;
  let bx = 0;
  let by = 0;
  const step = Math.max(1, Math.floor(w / 512));
  // Only the upper half: the sun is above the horizon.
  for (let y = 0; y < h / 2; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const lum = read(i) * 0.2126 + read(i + 1) * 0.7152 + read(i + 2) * 0.0722;
      if (lum > best) {
        best = lum;
        bx = x;
        by = y;
      }
    }
  }
  if (best <= 0) return null;
  const u = (bx + 0.5) / w;
  const v = 1 - (by + 0.5) / h;
  const lat = (v - 0.5) * Math.PI;
  const phi = (u - 0.5) * Math.PI * 2;
  return new THREE.Vector3(Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat));
}

/** Procedural flare textures: a soft glow, a ring and a hexagon ghost. */
function makeFlare() {
  const glow = flareTexture((g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,240,220,1)');
    grad.addColorStop(0.15, 'rgba(255,200,140,0.6)');
    grad.addColorStop(1, 'rgba(255,160,90,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
  const ring = flareTexture((g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, s * 0.32, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,220,180,0)');
    grad.addColorStop(0.7, 'rgba(255,210,160,0.35)');
    grad.addColorStop(1, 'rgba(255,200,150,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
  const hex = flareTexture((g, s) => {
    g.fillStyle = 'rgba(255,230,200,0.5)';
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.lineTo(s / 2 + Math.cos(a) * s * 0.45, s / 2 + Math.sin(a) * s * 0.45);
    }
    g.closePath();
    g.fill();
  });
  const flare = new Lensflare();
  flare.addElement(new LensflareElement(glow, 520, 0, new THREE.Color('#ffd2a0')));
  flare.addElement(new LensflareElement(ring, 120, 0.35, new THREE.Color('#ffb070')));
  flare.addElement(new LensflareElement(hex, 70, 0.55, new THREE.Color('#ffd8b0')));
  flare.addElement(new LensflareElement(hex, 110, 0.8, new THREE.Color('#ffe0c0')));
  flare.addElement(new LensflareElement(ring, 180, 1.0, new THREE.Color('#ffc890')));
  return flare;
}

function flareTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  draw(c.getContext('2d'), 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
