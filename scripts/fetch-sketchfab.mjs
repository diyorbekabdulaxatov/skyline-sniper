// Downloads the Sketchfab models listed in sketchfab.json and shrinks them for phones
// (meshopt geometry, WebP textures). Runs in GitHub Actions only, with the SKETCHFAB_TOKEN secret.
//
// Output goes to .cache/sketchfab-out/ (not public/, so nothing ships in the game or the preview
// yet), with report.md and manifest.json describing each model: author, licence, sizes and
// triangle count. Raw downloads are cached in .cache/sketchfab/.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const list = JSON.parse(readFileSync(join(root, 'sketchfab.json'), 'utf8')).models;
const cache = join(root, '.cache', 'sketchfab');
const out = join(root, '.cache', 'sketchfab-out');
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });

const token = process.env.SKETCHFAB_TOKEN;
if (!token) {
  console.warn('SKETCHFAB_TOKEN is not set; skipping the Sketchfab models.');
  process.exit(0);
}

const API = 'https://api.sketchfab.com/v3/models/';
const auth = { Authorization: 'Token ' + token, 'User-Agent': 'skyline-sniper-asset-fetch' };

async function api(path) {
  const r = await fetch(API + path, { headers: auth });
  if (r.status === 401 || r.status === 403) throw new Error(`HTTP ${r.status}: the token was rejected or the model is not downloadable`);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

async function download(url, file) {
  // Signed storage URLs; sending the API token there is not needed.
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download: HTTP ${r.status}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

/** Finds the first .gltf or .glb file under dir. */
function findScene(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      const found = findScene(p);
      if (found) return found;
    } else if (/\.(gltf|glb)$/i.test(name.name)) {
      return p;
    }
  }
  return null;
}

/** Triangles drawn by the scene, counting each mesh once per node that uses it. */
async function countTriangles(file) {
  try {
    const { NodeIO } = await import('@gltf-transform/core');
    const { ALLExtensions } = await import('@gltf-transform/extensions');
    const io = new NodeIO().registerExtensions(ALLExtensions);
    const doc = await io.read(file);
    let tris = 0;
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== 4) continue;
        const idx = prim.getIndices();
        const pos = prim.getAttribute('POSITION');
        tris += Math.floor((idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3);
      }
    }
    return { tris, meshes: doc.getRoot().listMeshes().length, materials: doc.getRoot().listMaterials().length, textures: doc.getRoot().listTextures().length };
  } catch (err) {
    console.warn('  could not count triangles:', String(err.message || err).slice(0, 200));
    return null;
  }
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
    const scene0 = existsSync(dir) ? findScene(dir) : null;
    if (!scene0) {
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
    Object.assign(row, await countTriangles(scene));

    const dest = join(out, name + '.glb');
    execFileSync(gltfTransform, [
      'optimize', scene, dest,
      '--compress', 'meshopt',
      '--texture-compress', 'webp',
      '--texture-size', String(texture),
      '--simplify', 'false'
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
    row.file = name + '.glb';
    row.outMB = mb(statSync(dest).size);
    console.log(`ok    ${name}: ${row.tris} triangles, ${row.sourceMB} MB -> ${row.outMB} MB (${row.licence})`);
  } catch (err) {
    row.error = String(err.message || err).slice(0, 300);
    console.error(`fail  ${name}: ${row.error}`);
  }
}

writeFileSync(join(out, 'manifest.json'), JSON.stringify(results, null, 2));
const lines = [
  '## Sketchfab models (test only)',
  '',
  '| Name | Model | Author | Licence | Triangles | Source MB | Phone MB | Status |',
  '|---|---|---|---|---:|---:|---:|---|',
  ...results.map((r) => `| ${r.name} | [${r.title || r.uid}](${r.url}) | ${r.author || ''} | ${r.licence || ''} | ${r.tris ?? ''} | ${r.sourceMB ?? ''} | ${r.outMB ?? ''} | ${r.error ? 'failed: ' + r.error : 'ok'} |`)
];
writeFileSync(join(out, 'report.md'), lines.join('\n') + '\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
// One annotation per model too: annotations of a public repo can be read without signing in.
if (process.env.GITHUB_ACTIONS) {
  for (const r of results) {
    const text = r.error
      ? `failed: ${r.error}`
      : `${r.title} by ${r.author} (${r.licence}): ${r.tris} triangles, ${r.meshes} meshes, ${r.materials} materials, ${r.textures} textures, ${r.sourceMB} MB -> ${r.outMB} MB`;
    console.log(`::notice title=${r.name}::${text.replace(/[\r\n%]/g, ' ')}`);
  }
}
console.log(lines.join('\n'));

if (results.every((r) => r.error)) {
  console.error('No Sketchfab model could be fetched.');
  process.exit(1);
}
