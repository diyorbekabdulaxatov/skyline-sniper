// Downloads the Sketchfab models listed in sketchfab.json and shrinks them for phones
// (meshopt geometry, WebP textures), keeping named parts so the game can pick single buildings or
// props out of a pack. Runs in GitHub Actions only, with the SKETCHFAB_TOKEN secret; without the
// token it does nothing and the game keeps its procedural buildings.
//
// Output: public/game-assets/sketchfab/<name>.glb, plus inventory.json listing each model's
// author, licence, sizes and its parts (name, size in metres, triangles), which is how placements
// are planned. Raw downloads are cached in .cache/sketchfab/.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const list = JSON.parse(readFileSync(join(root, 'sketchfab.json'), 'utf8')).models;
const cache = join(root, '.cache', 'sketchfab');
const out = join(root, 'public', 'game-assets', 'sketchfab');

const token = process.env.SKETCHFAB_TOKEN;
if (!token) {
  console.warn('SKETCHFAB_TOKEN is not set; skipping the Sketchfab models.');
  process.exit(0);
}
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });

const API = 'https://api.sketchfab.com/v3/models/';
const auth = { Authorization: 'Token ' + token, 'User-Agent': 'skyline-sniper-asset-fetch' };

async function api(path) {
  const r = await fetch(API + path, { headers: auth });
  if (r.status === 401 || r.status === 403) throw new Error(`HTTP ${r.status}: the token was rejected or the model is not downloadable`);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

async function download(url, file) {
  // Signed storage URLs: no token needed there.
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download: HTTP ${r.status}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

/** Finds the first .gltf or .glb file under dir. */
function findScene(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findScene(p);
      if (found) return found;
    } else if (/\.(gltf|glb)$/i.test(entry.name)) {
      return p;
    }
  }
  return null;
}

const { NodeIO, getBounds } = await import('@gltf-transform/core');
const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** Triangles under a node, counting each mesh once per node that uses it. */
function trianglesOf(node) {
  let tris = 0;
  node.traverse((n) => {
    const mesh = n.getMesh();
    if (!mesh) return;
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue;
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      tris += Math.floor((idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3);
    }
  });
  return tris;
}

/**
 * The model's parts: walk down from the scene while there is a single child (Sketchfab wraps
 * everything in a few root nodes), then list that level's children with their world size.
 */
async function inventory(file) {
  const doc = await io.read(file);
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  let level = scene.listChildren();
  while (level.length === 1 && level[0].listChildren().length > 0) level = level[0].listChildren();
  const r1 = (v) => Math.round(v * 10) / 10;
  const parts = level.map((n) => {
    const b = getBounds(n);
    return {
      name: n.getName(),
      size: [r1(b.max[0] - b.min[0]), r1(b.max[1] - b.min[1]), r1(b.max[2] - b.min[2])],
      center: [r1((b.max[0] + b.min[0]) / 2), r1(b.min[1]), r1((b.max[2] + b.min[2]) / 2)],
      tris: trianglesOf(n)
    };
  });
  const sb = getBounds(scene);
  return {
    tris: parts.reduce((s, p) => s + p.tris, 0),
    size: [r1(sb.max[0] - sb.min[0]), r1(sb.max[1] - sb.min[1]), r1(sb.max[2] - sb.min[2])],
    materials: doc.getRoot().listMaterials().length,
    textures: doc.getRoot().listTextures().length,
    parts
  };
}

const mb = (bytes) => (bytes / 1e6).toFixed(2);
const gltfTransform = join(root, 'node_modules', '.bin', 'gltf-transform');
/** @type {any[]} */
const results = [];

for (const item of list) {
  const { name, uid, texture = 1024, use = '' } = item;
  /** @type {any} */
  const row = { name, uid, use, url: 'https://sketchfab.com/3d-models/' + uid };
  results.push(row);
  try {
    const info = await api(uid);
    row.title = info.name;
    row.author = info.user && info.user.username;
    row.licence = info.license && info.license.label;
    row.url = info.viewerUrl || row.url;

    const dir = join(cache, uid);
    if (!(existsSync(dir) && findScene(dir))) {
      const dl = await api(uid + '/download');
      const pick = dl.glb ? { url: dl.glb.url, ext: 'glb' } : dl.gltf ? { url: dl.gltf.url, ext: 'zip' } : null;
      if (!pick) throw new Error('no glTF or GLB download offered');
      mkdirSync(dir, { recursive: true });
      const raw = join(dir, 'download.' + pick.ext);
      await download(pick.url, raw);
      if (pick.ext === 'zip') execFileSync('unzip', ['-qo', raw, '-d', dir]);
    }
    const scene = findScene(dir);
    if (!scene) throw new Error('no .gltf or .glb in the download');
    row.sourceMB = mb(readdirSync(dir, { recursive: true }).reduce((sum, f) => {
      const p = join(dir, String(f));
      const st = statSync(p);
      return st.isFile() && !/download\.zip$/.test(p) ? sum + st.size : sum;
    }, 0));

    const dest = join(out, name + '.glb');
    execFileSync(gltfTransform, [
      'optimize', scene, dest,
      '--compress', 'meshopt',
      '--texture-compress', 'webp',
      '--texture-size', String(texture),
      '--simplify', 'false',
      // Keep each building or prop a separate named node the game can pick out.
      '--flatten', 'false',
      '--join-named', 'false'
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
    row.file = 'sketchfab/' + name + '.glb';
    row.outMB = mb(statSync(dest).size);
    // Inventory from the source file: the optimised one is meshopt-compressed.
    Object.assign(row, await inventory(scene));
    console.log(`ok    ${name}: ${row.tris} triangles, ${row.parts.length} parts, ${row.sourceMB} MB -> ${row.outMB} MB (${row.licence})`);
  } catch (err) {
    row.error = String(err && err.message || err).slice(0, 300);
    console.error(`fail  ${name}: ${row.error}`);
  }
}

writeFileSync(join(out, 'inventory.json'), JSON.stringify(results, null, 1));
const lines = [
  '## Sketchfab models (test only)',
  '',
  '| Name | Model | Author | Licence | Triangles | Parts | Source MB | Phone MB | Status |',
  '|---|---|---|---|---:|---:|---:|---:|---|',
  ...results.map((r) => `| ${r.name} | [${r.title || r.uid}](${r.url}) | ${r.author || ''} | ${r.licence || ''} | ${r.tris ?? ''} | ${r.parts ? r.parts.length : ''} | ${r.sourceMB ?? ''} | ${r.outMB ?? ''} | ${r.error ? 'failed: ' + r.error : 'ok'} |`)
];
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
console.log(lines.join('\n'));
if (process.env.GITHUB_ACTIONS) {
  for (const r of results) {
    const text = r.error
      ? `failed: ${r.error}`
      : `${r.title} by ${r.author} (${r.licence}): ${r.tris} triangles, ${r.parts.length} parts, ${r.materials} materials, ${r.sourceMB} MB -> ${r.outMB} MB`;
    console.log(`::notice title=${r.name}::${text.replace(/[\r\n%]/g, ' ')}`);
  }
}
