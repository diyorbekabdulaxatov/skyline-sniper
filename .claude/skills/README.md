# Project skills

Claude Code loads these skills when a task needs them.

## From awesome-gamedev-agent-skills

These six skills are copied unchanged from
[gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)
at commit `c6ca6c41c839b68319ffc08430b99ab768debc32` (2026-11-23). They are Apache-2.0, Copyright 2026
Abhishek Barali and the awesome-gamedev-agent-skills contributors; see
`LICENSE-awesome-gamedev-agent-skills` and `NOTICE-awesome-gamedev-agent-skills`.

| Skill | Use it for |
|---|---|
| `game-ui-ux` | Menus and HUD: safe areas, screen stack and Back, text size, contrast |
| `game-feel` | Kill-shot and bullet-cam impact: shake, slow motion, flash limits |
| `performance-optimization` | Heat and frame rate on the phone: measure first, then fix the biggest cost |
| `threejs-scene-setup` | Renderer, pixel ratio, resize, render loop, WebGL context loss |
| `threejs-gltf-loading` | Loading, compressing and animating glTF models |
| `threejs-materials-lighting` | Materials, lights, shadows and environment lighting |

To update them, copy the same folders from a newer commit and change the commit above.

## House rules come first

`CLAUDE.md` overrides these skills wherever they disagree:

- **Three.js version.** The skills are written for three.js r187; this game uses r170 (`three@0.170`).
  Before using an API they name (for example `THREE.Timer`, `WebGPURenderer`, or r182+ shadow
  behaviour), check that r170 has it.
- **No heavy work on the user's Mac.** Where a skill says to run `npx @gltf-transform/cli`,
  `npm i`, Playwright or a local browser, do it in GitHub Actions instead (`scripts/` and
  `.github/workflows/build.yml`), or check the GitHub Pages preview in the browser pane.
- **Engine examples.** The Godot, Unity and Unreal snippets are only illustrations. Apply the
  rule to our HTML/CSS menus and Three.js code.
- **Target device.** Samsung Galaxy S24 in landscape; frame rate 30 FPS by default (60 optional).
