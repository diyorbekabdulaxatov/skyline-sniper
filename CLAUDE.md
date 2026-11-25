# Skyline Sniper: notes for Claude

A realistic 3D city sniper game (Three.js), Android first through Capacitor. Main test phone: Samsung Galaxy S24, landscape. The look aims for the quality of commercial mobile sniper games: bright daytime cities, realistic lighting, crowds and a bullet cam. It must be an **original** game: never copy another game's levels, UI, names or assets, and never use files taken from another game's APK.

## The user's constraints

- **Don't use the user's Mac for heavy work.** File edits, git and small `node` scripts are fine. No `npm install`, Vite, dev servers, browsers, Gradle or asset processing locally. All of that runs in GitHub Actions.
- To check the game, open the GitHub Pages preview in the browser pane: https://diyorbekabdulaxatov.github.io/skyline-sniper/ (add `#selftest` after load for an automatic shot at the target).
- Ask before downloading any asset (name, source, licence, size). Only CC0 or properly licensed assets; credit them.

## Layout

- `index.html`: page, styles, HUD and menus (Vite entry).
- `src/main.js`: loading screen, menu with the contract dossier and target photo, pause, settings, results, Android back button, `#selftest`.
- `src/game.js`: renderer, HDR sky lighting and shadows, camera and scope, sway and breath, bullets, hits, mission rules (target, civilians, escape), bullet cam, `game.debug` hooks.
- `src/city.js`: `LAYOUT` and the Harbor Plaza level (streets, plaza, buildings, props, skyline, traffic). `src/facades.js`: procedural facade textures (colour plus ARM map) and world-scaled building UVs.
- `src/people.js`: `Person` (skinned clone, roles walk/run/idle/idle2/phone/talk, procedural fall on death, hit test), the crowd, panic, and `renderPortrait` for the briefing photo.
- **People and animations:** avatars are Microsoft Rocketbox (MIT) in `public/models/people/` (3ds Max Biped skeleton, `Bip01_*` bones after three's name sanitising, no clips of their own). `scripts/fetch-animations.mjs` (`npm run anims`, CI only) downloads Rocketbox FBX animations, parses them with three's FBXLoader in Node and writes `public/game-assets/anims/*.json`: local bone rotations resampled per bone, root motion removed (kept as a measured `speed` for walk/run timeScale) and a hip bob in metres. The FBX bones share the avatars' bone frames, so rotations play directly. There is no death clip; `Person.kill()` freezes the pose and tips the body over procedurally. The target is `Male_Adult_03` and nobody else uses that avatar. Without the anims or people files, the crowd falls back to `models/man-suit.glb`.
- **Store (Armory):** `src/armory.js` holds `RIFLES` (stats override `KESTREL`, one `traits` effect each: suppressed, zoomBonus, breathBonus, semiAuto, pierceCars; `model` is the Armory's Sketchfab model), per-rifle `UPGRADES` and one-time `GEAR` (wind meter, extended magazine, steady brace, ballistic computer). `loadoutFor()` turns the account into what `game.setLoadout()` applies. `src/progress.js` `migrateProgress()` repairs old saves. The store screen has Rifles and Gear tabs and must fit 780x360 without the page scrolling.
- `src/assets.js`: loaders for `public/game-assets` (made in CI) and `public/models`; everything returns null when missing.
- `src/ballistics.js`, `src/scope.js`, `src/input.js`, `src/audio.js`, `src/settings.js`: shared with the user's earlier `silent-contract-3d` repo.
- `assets.json` + `scripts/fetch-assets.mjs`: Poly Haven assets, fetched and optimised in CI (gltf-transform, WebP textures, meshopt).

## City and lighting

- `src/lighting.js`: golden-hour HDR sky. The panorama is turned so its sun sits west-north-west (`SUN_AZIMUTH`), and the shadow light is placed on the sun found in the HDR pixels, raised to at least 15 degrees. Also a lens flare and warm fog.
- `src/city.js`: towers (`TOWERS`, procedural facades) and brick or plaster mid-rises (`BLOCKS`, photo textures from `assets.json`). The east side is kept low so the harbour shows. Cars follow `ROUTES` on the avenue, Meridian Street and the quay road. Trees, traffic lights and cars are CC-BY models from `public/models/props/`, instanced.
- `src/blocks.js`: windows, shopfronts, awnings, invented-brand signs, rooftop clutter and billboards, collected and then built as a few instanced or merged meshes.
- `src/harbor.js`: water, quay, pier with containers, gantry cranes, moored ship, boats. `HARBOR.quayX` (162) is the land's east edge.
- `src/instancing.js`: bakes any glTF into one `InstancedMesh` per material. Use it for anything repeated.

## Rules

- Units are metres and seconds. Axes: x east, y up, z toward the player (south); north is `-z`.
- People are drawn inside the `BODY` hit zones (`src/ballistics.js`), scaled to each person's height.
- Every `src/*.js` file starts with `// @ts-check`.
- Missing assets must never break the game: fall back to plain materials and shapes.

## Project skills

`.claude/skills/` holds six skills from awesome-gamedev-agent-skills (Apache-2.0): game UI/UX, game feel, performance, and three.js scene setup, glTF loading, and materials and lighting. They target three.js r187 and other engines; `.claude/skills/README.md` lists the house rules that override them (r170, CI only).

## Commands (CI)

`npm run check`, `npm run typecheck`, `npm test`, `npm run assets`, `npm run build`, `npm run android`.

## Release blockers

- `public/models/rifle_awm_nc.glb` (L11A3/AWP/AWM by Aronvctr) is **CC BY-NC-SA**, allowed in free test builds only. The user will find or buy a commercially licensed rifle before release. Files ending `_nc.glb` are reported by `npm run check`, and `RELEASE=1 npm run check` fails while any remain. Never call the rifle "AWP" in the game's text.
