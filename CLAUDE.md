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
- `src/people.js`: `Person` (skinned clone, outfit colours, walk, idle, run, death, hit test), the crowd, panic, and `renderPortrait` for the briefing photo.
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

## Commands (CI)

`npm run check`, `npm run typecheck`, `npm test`, `npm run assets`, `npm run build`, `npm run android`.
