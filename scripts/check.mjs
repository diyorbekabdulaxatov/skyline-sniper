// Fast checks that need no browser.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

for (const name of readdirSync(join(root, 'src'))) {
  if (!name.endsWith('.js')) continue;
  const text = readFileSync(join(root, 'src', name), 'utf8');
  if (!text.startsWith('// @ts-check')) problems.push(`src/${name}: start the file with "// @ts-check".`);
}
for (const name of readdirSync(join(root, 'public', 'models'))) {
  if (!name.endsWith('.glb')) continue;
  const head = readFileSync(join(root, 'public', 'models', name)).subarray(0, 4).toString('latin1');
  if (head !== 'glTF') problems.push(`public/models/${name} is not a binary glTF file.`);
}
const assets = JSON.parse(readFileSync(join(root, 'assets.json'), 'utf8'));
const names = new Set();
for (const group of [assets.textures, assets.models]) {
  for (const a of group) {
    if (names.has(a.name)) problems.push(`assets.json: duplicate name "${a.name}".`);
    names.add(a.name);
  }
}

// Release blockers: placeholder assets whose licence forbids commercial use (files ending _nc).
const blockers = readdirSync(join(root, 'public', 'models')).filter((n) => /_nc\.glb$/.test(n));
if (blockers.length) {
  console.warn('RELEASE BLOCKER: non-commercial placeholder models must be replaced before release: ' + blockers.join(', '));
  if (process.env.RELEASE === '1') problems.push('Non-commercial placeholder models present: ' + blockers.join(', '));
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('Checks passed.');
