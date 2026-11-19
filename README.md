# Cover Coast — GTA 6 Cover Art Studio

[![make.fun bounty](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/zesty-pika-87/gta6-cover-art-01-v9/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/zesty-pika-87/gta6-cover-art-01-v9/reward.svg)](https://make.fun/c/gta6-cover-art-01)

Make a GTA-style cover in one click — no Rockstar logo, no official artwork, all original.

## What it does

- **9 layouts**: Full Bleed, Four Panel, Hero + Three, Hero + Four (hero left, 4 panels right), Nine Panel, Mosaic Nine, Tilted Snapshots, Story Stack, Poster Strip. Default on open: **Hero + Four** with the boulevard hero photo — the first screen already looks like a finished cover.
- **7 colour grades** as real per-pixel LUT-style maps (not a weak overlay, so they stay visible even on dark photos): Vice Sunset, Neon Nights, Palm Dusk, Magenta Heat, Teal Noir, Golden Hour, Ink Poster (posterize + strong halftone). Strength slider, skin-safe midtones.
- **6 photos**: 2 kit photos (boulevard convertible hero, pier angler) + 4 textured procedural photos generated in this repo (sunset skyline, neon street, ocean speedboat, palm road). Click a photo, then click a panel to place it; drag a panel to pan, scroll to zoom; shuffle; upload your own photo (local only).
- **Lettering**: giant Anton title with orange→pink gradient, thick black outline and drop shadow; Pacifico script subtitle overlapping the title edge; title position auto-detects the darkest area (top vs bottom) so it never sits on a face; per-panel caption chips (location + time + tagline, editable defaults); starburst badge, 5-star meter, bottom tagline strip.
- **Effects**: halftone dots in the sky (ON by default, density control), seeded film grain, vignette, sunburst — one deterministic renderer for preview and export, so what you see is what you get.
- **Presets, one click**: Vice Sunset Hero, Neon Nights Nine, Palm Dusk Strip, Ink Heatwave, Golden Getaway.
- **Export**: PNG Square 1080×1080, Portrait 1080×1350, Landscape 1920×1080, Story 1080×1920 — one by one, or all 4 as one ZIP (built-in ZIP writer, no dependency). Undo/redo (40 steps, Ctrl+Z / Ctrl+Y).
- **Fully offline**: Anton + Pacifico vendored as woff2 under `app/fonts/` (SIL OFL, see `OFL.txt`). No network request anywhere.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Submit locally

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` runs a pre-flight first: app caps, zero remote references, and screenshot dimensions read from the JPEG/PNG headers (long side ≤ 1280, short side ≥ 480, each ≤ 256 KiB) — the check that caught the v8 bug. `out/dossier.json` is byte-for-byte the vendored `buildDossier` output.

## Screenshots

`?shot=cover` finished poster · `?shot=editor` full editor · `?shot=grid` Nine Panel · `?shot=story` Story Stack portrait (540×960, inside the scorer's size cap).
