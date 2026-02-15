# The Fireplace — Branding & Visual Identity

## Brand Overview

**The Fireplace** is a native macOS + iOS app that serves as "Mission Control for OpenClaw." The branding reflects warmth, control, and a central gathering place — just like a real fireplace.

## Logo & Icon

### Design Concept

The flame icon embodies:
- **Warmth**: Amber/orange gradient creates a welcoming, comfortable feeling
- **Energy**: Dynamic flame shape suggests activity and power
- **Centrality**: A fireplace is the heart of a space, just as this app is central to OpenClaw control
- **Technical**: Clean, modern design suitable for a developer tool

### Color Palette

The flame uses a warm gradient that aligns with the app's design system:

```
Outer Flame:
  - Top: #fbbf24 (amber-400)
  - Middle: #f59e0b (amber-500)
  - Bottom: #dc2626 (red-600)

Inner Flame:
  - Top: #fef3c7 (amber-50)
  - Middle: #fbbf24 (amber-400)
  - Bottom: #f59e0b (amber-500)

Hotspot Core:
  - Center: #fffbeb (amber-50)
  - Fade: Radial gradient to transparent
```

This palette:
- Matches the app's zinc/amber design system
- Works beautifully in dark mode
- Maintains visibility at all sizes
- Conveys warmth without being overwhelming

## Icon Assets

### Locations

```
src-tauri/icons/          # All icon assets
├── flame.svg             # Master icon (1024x1024)
├── tray-template.svg     # Menu bar template (32x32)
├── icon-*.png            # Generated PNGs (16-1024px)
├── icon.icns             # macOS bundle
├── icon.ico              # Windows icon
└── tray-icon*.png        # Menu bar template PNGs

public/                   # Web assets
├── favicon.png           # 32x32 favicon
└── favicon.ico           # Multi-size ICO
```

### Sizes & Uses

| Size | File | Use Case |
|------|------|----------|
| 1024x1024 | icon-1024.png | macOS App Store, Finder preview |
| 512x512 | icon-512.png | macOS retina displays |
| 256x256 | icon-256.png | Standard macOS icon |
| 128x128 | 128x128.png | Smaller icons, lists |
| 64x64 | 32x32@2x.png | Retina small icons |
| 32x32 | 32x32.png | Menu items, toolbars |
| 16x16 | 16x16.png | Smallest standard size |

### Menu Bar Icons

The tray icons are **template images** (black with alpha channel) that:
- Automatically adapt to macOS menu bar theme (light/dark)
- Render in system accent color when clicked
- Match native macOS appearance
- Work in both standard and retina displays

## Typography

The Fireplace uses system fonts for a native feel:

- **macOS**: San Francisco (system default)
- **iOS**: San Francisco (system default)
- **Web**: System font stack via Tailwind CSS

This ensures:
- Fast rendering (no font downloads)
- Perfect OS integration
- Accessibility support
- Consistent with other native apps

## Design System

See the main documentation for full design system details, but key points:

- **Dark mode only** — no light theme
- **Primary colors**: zinc (grays), amber (accent)
- **Never use**: blue, slate, gray-*, raw hex colors
- **Spacing**: Dense layouts with p-2/p-3 padding
- **Status indicators**:
  - 🟢 Emerald — connected, success
  - 🟡 Amber — warning, pending
  - 🔴 Red — error, critical
  - ⚪ Zinc — offline, disabled

## Usage Guidelines

### DO

- Use the flame icon consistently across all platforms
- Maintain the gradient (don't flatten to solid colors)
- Ensure adequate clear space around the icon
- Use template images for menu bar integration
- Keep the SVG sources as the master files

### DON'T

- Modify the flame shape or proportions
- Change the color scheme (must stay amber/orange)
- Add effects (shadows, glows, outlines) to the master icon
- Use low-resolution versions where high-res is available
- Edit PNG files directly (always regenerate from SVG)

## Regenerating Assets

If you need to modify the icons:

1. Edit the SVG source files in `src-tauri/icons/`:
   - `flame.svg` for the main icon
   - `tray-template.svg` for menu bar icons

2. Run the regeneration script:
   ```bash
   ./scripts/regenerate-icons.sh
   ```

3. Verify all sizes look correct:
   ```bash
   open src-tauri/icons/icon-1024.png  # Check full size
   open src-tauri/icons/tray-icon.png   # Check menu bar
   ```

See `docs/ICONS.md` for detailed instructions.

## File Sizes

Total branding assets: ~450KB

- Largest: icon.icns (275KB)
- Smallest: tray-icon.png (261 bytes)
- All files are optimized for app distribution

## Accessibility

The flame icon:
- Has strong contrast at all sizes
- Is recognizable even at 16x16 pixels
- Works for users with color vision deficiencies
- Includes proper alt text in web contexts
- Uses template rendering for system accessibility features

## Future Considerations

If expanding the brand:
- Marketing materials should use the 1024x1024 PNG
- Social media profiles can use icon-512.png
- Favicons are already configured for web use
- Print materials would need vector (SVG) export

For questions about branding, see the project maintainer or refer to `docs/ICONS.md`.
