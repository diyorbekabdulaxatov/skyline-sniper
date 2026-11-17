// Downloads a small set of Microsoft Rocketbox animations (MIT, https://github.com/microsoft/Microsoft-Rocketbox)
// and converts them for the game:
//   FBX (3ds Max Biped, centimetres) -> parsed with three's FBXLoader in Node
//   -> resampled rotation tracks per bone + a hip-height bob, root motion removed
//   -> public/game-assets/anims/<name>.json and manifest.json
// The Rocketbox avatars in public/models/people use the same Biped skeleton with the same bone
// frames, so the rotations play on them directly. Runs in GitHub Actions, not on the user's Mac.
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.cache', 'rocketbox');
const out = join(root, 'public', 'game-assets', 'anims');
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });

const RAW = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/Assets/Animations/';
const STATIC = 'all_animations_max_motextr_static/';
const XY = 'all_animations_max_motextr_xy/';

/**
 * Clip name -> source file. walk and run keep their forward root motion only as a measured speed.
 * fps: sampling rate after conversion (long talking clips are sampled lower to stay small).
 */
const CLIPS = [
  { name: 'm_walk', file: XY + 'm_walk_neutral_01.max.fbx', fps: 30 },
  { name: 'm_run', file: XY + 'm_run_neutral_01.max.fbx', fps: 30 },
  { name: 'm_idle', file: STATIC + 'm_idle_breathe_01.max.fbx', fps: 15 },
  { name: 'm_idle2', file: STATIC + 'm_idle_look_around_01.max.fbx', fps: 15 },
  { name: 'm_phone', file: STATIC + 'm_cell_phone_talk_01.max.fbx', fps: 15 },
  { name: 'm_talk', file: STATIC + 'm_gestic_talk_neutral_01.max.fbx', fps: 15 },
  { name: 'f_walk', file: XY + 'f_walk_neutral_01.max.fbx', fps: 30 },
  { name: 'f_run', file: XY + 'f_run_neutral_01.max.fbx', fps: 30 },
  { name: 'f_idle', file: STATIC + 'f_idle_breathe_01.max.fbx', fps: 15 },
  { name: 'f_idle2', file: STATIC + 'f_idle_look_around_01.max.fbx', fps: 15 },
  { name: 'f_phone', file: STATIC + 'f_cell_phone_textmessage.max.fbx', fps: 15 },
  { name: 'f_talk', file: STATIC + 'f_gestic_talk_neutral_01.max.fbx', fps: 15 }
];

async function download(url, file) {
  if (existsSync(file) && statSync(file).size > 0) return;
  const r = await fetch(url, { headers: { 'User-Agent': 'skyline-sniper-asset-fetch' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

const round = (v, d) => Math.round(v * d) / d;
const summary = ['| Clip | Source | Duration | Bones | Root speed | Size |', '|---|---|---|---|---|---|'];
const manifest = { source: 'Microsoft Rocketbox (MIT)', clips: {} };
const loader = new FBXLoader();

for (const c of CLIPS) {
  const local = join(cache, c.file.split('/').pop());
  await download(RAW + c.file, local);
  const buf = readFileSync(local);
  const warn = console.warn;
  console.warn = () => {};
  let group;
  try {
    group = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  } finally {
    console.warn = warn;
  }
  const clip = group.animations[0];
  if (!clip) throw new Error(c.file + ' has no animation');
  const frames = Math.max(2, Math.round(clip.duration * c.fps) + 1);
  const times = [];
  for (let i = 0; i < frames; i++) times.push(Math.min(clip.duration, i / c.fps));

  /** @type {Record<string, number[]>} */
  const tracks = {};
  let bob = null;
  let speed = 0;
  const tmp = new Float32Array(4);
  for (const track of clip.tracks) {
    const [bone, prop] = track.name.split('.');
    if (!bone.startsWith('Bip01') || bone.includes('Footsteps')) continue;
    const interp = track.createInterpolant();
    if (prop === 'quaternion') {
      const values = [];
      let maxDelta = 0;
      let first = null;
      for (const t of times) {
        const v = interp.evaluate(t);
        tmp.set(v);
        if (!first) first = Array.from(tmp);
        maxDelta = Math.max(maxDelta, Math.abs(tmp[0] - first[0]), Math.abs(tmp[1] - first[1]), Math.abs(tmp[2] - first[2]), Math.abs(tmp[3] - first[3]));
        values.push(round(tmp[0], 1e4), round(tmp[1], 1e4), round(tmp[2], 1e4), round(tmp[3], 1e4));
      }
      // Bones that never move keep one key (their pose may still differ from the bind pose).
      tracks[bone] = maxDelta < 2e-4 ? values.slice(0, 4) : values;
    } else if (prop === 'position' && bone === 'Bip01') {
      // Root motion: measure forward speed (m/s), keep only the vertical hip bob in metres.
      const a = interp.evaluate(times[0]).slice();
      const b = interp.evaluate(times[times.length - 1]).slice();
      speed = Math.hypot(b[0] - a[0], b[2] - a[2]) / 100 / clip.duration;
      bob = times.map((t) => round((interp.evaluate(t)[1] - a[1]) / 100, 1e4));
    }
  }
  const data = {
    name: c.name,
    source: c.file.split('/').pop(),
    duration: round(clip.duration, 1e3),
    fps: c.fps,
    frames,
    speed: round(speed, 1e3),
    bob,
    tracks
  };
  const json = JSON.stringify(data);
  writeFileSync(join(out, c.name + '.json'), json);
  manifest.clips[c.name] = { file: c.name + '.json', duration: data.duration, speed: data.speed };
  const moving = Object.values(tracks).filter((v) => v.length > 4).length;
  summary.push(`| ${c.name} | ${data.source} | ${data.duration.toFixed(2)} s | ${Object.keys(tracks).length} (${moving} animated) | ${data.speed ? data.speed.toFixed(2) + ' m/s' : '-'} | ${(json.length / 1024).toFixed(0)} KB |`);
  console.log('anim  ', c.name, data.duration + ' s', Object.keys(tracks).length + ' bones', (json.length / 1024).toFixed(0) + ' KB');
}

writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
const sample = Object.keys(JSON.parse(readFileSync(join(out, 'm_walk.json'), 'utf8')).tracks).slice(0, 8).join(', ');
const report = ['## Rocketbox animations', '', ...summary, '', 'Bone names (sample): ' + sample, ''].join('\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
