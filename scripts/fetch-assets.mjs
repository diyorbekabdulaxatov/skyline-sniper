// Downloads the CC0 assets listed in assets.json from Poly Haven and shrinks them for phones:
//   models   -> glTF optimised with gltf-transform (WebP textures at 512 px, meshopt geometry)
//   textures -> colour, normal and ARM (AO / roughness / metalness) maps at 512 px
//   sky      -> the HDR panorama as is
// Output goes to public/game-assets/ with a manifest.json the game reads. Raw downloads are
// cached in .cache/ so CI can restore them. Runs in GitHub Actions, not on the user's Mac.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const list = JSON.parse(readFileSync(join(root, 'assets.json'), 'utf8'));
const cache = join(root, '.cache', 'polyhaven');
const out = join(root, 'public', 'game-assets');
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });

const API = 'https://api.polyhaven.com/files/';
const headers = { 'User-Agent': 'skyline-sniper-asset-fetch' };

async function json(url) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function download(url, file) {
  if (existsSync(file) && statSync(file).size > 0) return;
  mkdirSync(dirname(file), { recursive: true });
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch (err) {
  console.warn('sharp is not available; textures are copied at full size.');
}

async function shrinkImage(src, dest, size) {
  if (!sharp) {
    writeFileSync(dest, readFileSync(src));
    return;
  }
  await sharp(src).resize(size, size, { fit: 'inside' }).jpeg({ quality: 82, mozjpeg: true }).toFile(dest);
}

/** @type {any} */
const manifest = { sky: null, textures: {}, models: {}, credits: [], bullet: null };

// Sky
{
  const { name, id, res } = list.hdri;
  const files = await json(API + id);
  const url = files.hdri[res].hdr.url;
  const raw = join(cache, id + '_' + res + '.hdr');
  await download(url, raw);
  writeFileSync(join(out, name + '.hdr'), readFileSync(raw));
  manifest.sky = name + '.hdr';
  manifest.credits.push(id);
  console.log('sky   ', id);
}

// Textures
for (const { name, id, res } of list.textures) {
  const files = await json(API + id);
  const maps = { map: 'Diffuse', normal: 'nor_gl', arm: 'arm' };
  manifest.textures[name] = {};
  for (const [slot, key] of Object.entries(maps)) {
    const url = files[key][res].jpg.url;
    const raw = join(cache, 'tex', id, slot + '.jpg');
    await download(url, raw);
    const file = `tex_${name}_${slot}.jpg`;
    await shrinkImage(raw, join(out, file), 512);
    manifest.textures[name][slot] = file;
  }
  manifest.credits.push(id);
  console.log('tex   ', id);
}

// Models
const gltfTransform = join(root, 'node_modules', '.bin', 'gltf-transform');
for (const { name, id } of list.models) {
  const files = await json(API + id);
  const g = files.gltf['1k'].gltf;
  const dir = join(cache, 'models', id);
  const main = join(dir, id + '.gltf');
  await download(g.url, main);
  for (const [rel, f] of Object.entries(g.include)) await download(f.url, join(dir, rel));
  const dest = join(out, name + '.glb');
  execFileSync(gltfTransform, [
    'optimize', main, dest,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', '512',
    '--simplify', 'false'
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  manifest.models[name] = name + '.glb';
  manifest.credits.push(id);
  console.log('model ', id, (statSync(dest).size / 1e6).toFixed(2) + ' MB');
}

// Local source assets (assets-src/): the bullet-cam bullet, textures shrunk to 1024 px.
{
  const src = join(root, 'assets-src', 'bullet');
  if (existsSync(join(src, 'bullet.fbx'))) {
    const dir = join(out, 'bullet');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'bullet.fbx'), readFileSync(join(src, 'bullet.fbx')));
    const maps = { map: 'basecolor', normal: 'normal', roughness: 'roughness', metalness: 'metallic' };
    manifest.bullet = { fbx: 'bullet/bullet.fbx' };
    for (const [slot, name] of Object.entries(maps)) {
      const file = 'bullet/' + name + '.jpg';
      if (sharp) await sharp(join(src, name + '.png')).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 88 }).toFile(join(out, file));
      else writeFileSync(join(out, 'bullet/' + name + '.png'), readFileSync(join(src, name + '.png')));
      manifest.bullet[slot] = sharp ? file : 'bullet/' + name + '.png';
    }
    console.log('local  bullet');
  }
}

writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Assets ready in public/game-assets/');
