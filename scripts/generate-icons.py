#!/usr/bin/env python3
"""Generate placeholder icons for The Fireplace"""

import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("PIL (Pillow) not found. Installing...")
    os.system(f"{sys.executable} -m pip install --quiet Pillow")
    from PIL import Image, ImageDraw

def create_icon(size, filepath):
    """Create a simple fire emoji icon"""
    # Create image with dark background
    img = Image.new('RGBA', (size, size), (9, 9, 11, 255))  # zinc-950
    draw = ImageDraw.Draw(img)

    # Draw a simple amber circle as placeholder
    margin = size // 4
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        fill=(245, 158, 11, 255)  # amber-500
    )

    img.save(filepath, 'PNG')
    print(f"Created {filepath}")

def main():
    icons_dir = os.path.join(os.path.dirname(__file__), '..', 'src-tauri', 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    # Create PNG icons
    create_icon(32, os.path.join(icons_dir, '32x32.png'))
    create_icon(128, os.path.join(icons_dir, '128x128.png'))
    create_icon(256, os.path.join(icons_dir, '128x128@2x.png'))
    create_icon(256, os.path.join(icons_dir, 'icon.png'))

    print("Icon generation complete!")
    print("Note: icon.icns and icon.ico are placeholders. Use proper icon generation for production.")

if __name__ == '__main__':
    main()
