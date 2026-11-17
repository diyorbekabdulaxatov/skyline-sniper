# Skyline Sniper

A realistic 3D city sniper game for phones and browsers, built with [Three.js](https://threejs.org).

**Status:** vertical slice. One contract, *Harbor Plaza*: from a rooftop across the avenue, find Victor Hale in the midday crowd and take him before he reaches his car. No civilians.

## Play

- **Phone preview (browser):** https://diyorbekabdulaxatov.github.io/skyline-sniper/
- **Android test APK:** https://github.com/diyorbekabdulaxatov/skyline-sniper/releases/download/android-latest/skyline-sniper.apk

Both update on every push.

## Controls

| Phone (landscape) | Keyboard and mouse |
|---|---|
| Drag to aim | Drag to aim |
| **Scope**, zoom slider | `E` or right-click, mouse wheel |
| Hold **Hold breath** while scoped | Hold `Shift` |
| **Fire** | `Space` |
| **Reload** | `R` |
| Tap during the bullet cam to skip it | Click |

## How it's built

- Three.js with plain JavaScript modules, type-checked by TypeScript (`// @ts-check`), bundled by Vite.
- **Assets:** the sky, ground textures and street and rooftop props are CC0 from Poly Haven. They are listed in `assets.json`; GitHub Actions downloads them and shrinks them for phones (`scripts/fetch-assets.mjs`), so they are not in the repo. Buildings and their reflective facades are generated in code (`src/facades.js`). People and the rifle are CC0 Quaternius models for now (`public/models/CREDITS.md`).
- **Android:** Capacitor 8 wraps the build; `scripts/android.mjs` configures landscape, full screen, icon and signing.
- **CI** (`.github/workflows/build.yml`): checks, type-check, tests, asset fetch, build, GitHub Pages preview and test APK.

## Mixamo characters (next)

Realistic people will come from Mixamo. Mixamo's licence lets games use the characters, but the raw files must not be shared, so they will live in a separate **private** repository that the build reads with a token.
