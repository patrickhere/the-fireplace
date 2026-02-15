# The Fireplace Icons

This directory contains all icon assets for The Fireplace app.

## Source Files

- **flame.svg** — Master icon with full gradient (1024x1024)
- **tray-template.svg** — Menu bar template icon (32x32, black with alpha)

## Generated Assets

All PNG, ICNS, and ICO files are generated from the SVG sources using `scripts/regenerate-icons.sh`.

### App Icons (Full Color)
- `icon-1024.png` — 1024x1024 (macOS App Store)
- `icon-512.png` — 512x512
- `icon-256.png` / `icon.png` — 256x256
- `128x128@2x.png` — 256x256 retina
- `128x128.png` — 128x128
- `32x32@2x.png` — 64x64 retina
- `32x32.png` — 32x32
- `16x16.png` — 16x16

### Platform Bundles
- `icon.icns` — macOS icon bundle (contains all sizes)
- `icon.ico` — Windows icon (16, 32, 256)

### Menu Bar Icons (Template)
- `tray-icon@2x.png` — 32x32 retina
- `tray-icon.png` — 16x16

These are template images (black with alpha) that automatically adapt to the macOS menu bar theme.

### Favicon
- `favicon-32x32.png` — Web favicon (copied to `/public/`)
- `favicon-16x16.png` — Small favicon variant

## Design

The flame icon uses a warm gradient:
- Outer flame: amber-400 → amber-500 → red-600
- Inner flame: amber-50 → amber-400 → amber-500
- Core hotspot: radial gradient from amber-50

The design:
- Works at all sizes (16x16 to 1024x1024)
- Optimized for dark mode
- Aligns with The Fireplace's zinc/amber design system
- Simple, recognizable silhouette

## Regenerating Icons

To regenerate all assets after editing the SVG sources:

```bash
./scripts/regenerate-icons.sh
```

Requirements:
- `librsvg` (install with `brew install librsvg`)
- `iconutil` (built-in macOS tool)
- Python 3 (built-in on macOS)

## File Sizes

- Total icon assets: ~450KB
- Largest file: icon.icns (275KB)
- Smallest file: tray-icon.png (261 bytes)

All sizes are optimized for distribution.
