# Model credits

## People: Microsoft Rocketbox Avatar Library (MIT)

`people/Male_Adult_03, 04, 05, 07, 10, 11, 12, 17, 20` and `people/Female_Adult_02, 11` are avatars from the Microsoft Rocketbox library (https://github.com/microsoft/Microsoft-Rocketbox). Their animations come from the same library and are fetched during the build.

Animations used (Microsoft Rocketbox, `Assets/Animations`, MIT, same notice as below), converted by `scripts/fetch-animations.mjs`:
`m_walk_neutral_01`, `m_run_neutral_01`, `m_idle_breathe_01`, `m_idle_look_around_01`, `m_cell_phone_talk_01`, `m_gestic_talk_neutral_01`, `f_walk_neutral_01`, `f_run_neutral_01`, `f_idle_breathe_01`, `f_idle_look_around_01`, `f_cell_phone_textmessage`, `f_gestic_talk_neutral_01`.

> Copyright (c) 2020 Microsoft
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Props (Sketchfab, CC Attribution 4.0)

| File | Model | Author | Source |
|---|---|---|---|
| `props/sedan_wagon.glb` | Lowpoly Sedan & Wagon | Han66st | https://sketchfab.com/3d-models/e11a46478c674b279fe9d299b2125c30 |
| `props/traffic_light.glb` | Low Poly & Game Ready Traffic Light | YourLocalJavaCarDealer | https://sketchfab.com/3d-models/79e7769b03c44ff19fec4e802e4df0aa |
| `props/tree.glb` | Tree low poly lowpoly | 00amza | https://sketchfab.com/3d-models/tree-low-poly-lowpoly-73201f05280d48dcb10ed4ca362d69f8 |

Licence: https://creativecommons.org/licenses/by/4.0/

## Quaternius (CC0)

| File | Model | Source |
|---|---|---|
| `man-suit.glb` | Man in Suit (Animated Men Pack), fallback person | https://poly.pizza/m/mQnGoME1ez |
| `rifle.glb` | Sniper Rifle (Ultimate Guns Pack) | https://poly.pizza/bundle/Ultimate-Guns-Pack-cpgUfI4t2F |

The sky, ground textures and street props are CC0 assets from Poly Haven, listed in `assets.json` and fetched during the build.

### City textures (Poly Haven, CC0)

The golden-hour sky is "Kloppenheim 06 (Pure Sky)". The brick and plaster walls use "Red Brick 03", "Brick Wall 006" and "Painted Plaster Wall". All shop signs, billboards and brand names in the city are invented for this game.

## Placeholder (test builds only — REPLACE BEFORE RELEASE)

| File | Model | Author | Licence | Source |
|---|---|---|---|---|
| `rifle_awm_nc.glb` | L11A3/AWP/AWM | Aronvctr | CC BY-NC-SA 4.0 (non-commercial) | https://sketchfab.com/3d-models/l11a3awpawm-976f084d925e4f6884a8c1d959c59d38 |

Non-commercial licence: allowed in free test builds only. It must be replaced by a commercially licensed rifle before any release, ads or sales. `npm run check` lists it as a release blocker.

## Bullet (CC Attribution 4.0)

| Source | Model | Author | Source page |
|---|---|---|---|
| `assets-src/bullet/` (built into `game-assets/bullet/`) | Bullet | RoutineStudio | https://sketchfab.com/3d-models/bullet-8333d86fe2674aaf8888cc5fa4537d20 |
