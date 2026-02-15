#!/bin/bash
# Regenerate all icon assets from SVG source files

set -e

cd "$(dirname "$0")/../src-tauri/icons"

echo "Regenerating icons from SVG sources..."

# Check for required tools
if ! command -v rsvg-convert &> /dev/null; then
    echo "Error: rsvg-convert not found. Install with: brew install librsvg"
    exit 1
fi

# Generate main app icon sizes from flame.svg
echo "  - Generating app icons from flame.svg..."
rsvg-convert -w 1024 -h 1024 flame.svg > icon-1024.png
rsvg-convert -w 512 -h 512 flame.svg > icon-512.png
rsvg-convert -w 256 -h 256 flame.svg > icon-256.png
rsvg-convert -w 256 -h 256 flame.svg > 128x128@2x.png
rsvg-convert -w 128 -h 128 flame.svg > 128x128.png
rsvg-convert -w 64 -h 64 flame.svg > 32x32@2x.png
rsvg-convert -w 32 -h 32 flame.svg > 32x32.png
rsvg-convert -w 16 -h 16 flame.svg > 16x16.png
cp icon-256.png icon.png

# Generate favicon sizes
echo "  - Generating favicon assets..."
cp 16x16.png favicon-16x16.png
cp 32x32.png favicon-32x32.png

# Generate tray template icons (for macOS menu bar)
echo "  - Generating menu bar icons from tray-template.svg..."
rsvg-convert -w 32 -h 32 tray-template.svg > tray-icon@2x.png
rsvg-convert -w 16 -h 16 tray-template.svg > tray-icon.png

# Generate .icns file using macOS iconutil
echo "  - Creating macOS .icns bundle..."
mkdir -p icon.iconset
cp 16x16.png icon.iconset/icon_16x16.png
cp 32x32.png icon.iconset/icon_16x16@2x.png
cp 32x32.png icon.iconset/icon_32x32.png
cp 32x32@2x.png icon.iconset/icon_32x32@2x.png
cp 128x128.png icon.iconset/icon_128x128.png
cp 128x128@2x.png icon.iconset/icon_128x128@2x.png
cp icon-256.png icon.iconset/icon_256x256.png
cp icon-512.png icon.iconset/icon_256x256@2x.png
cp icon-512.png icon.iconset/icon_512x512.png
cp icon-1024.png icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset

# Generate .ico file for Windows
echo "  - Creating Windows .ico file..."
python3 << 'PYTHON_EOF'
import struct

def create_ico(output_path, png_paths):
    """Create a .ico file from PNG images"""
    with open(output_path, 'wb') as ico:
        # ICO header
        ico.write(struct.pack('<HHH', 0, 1, len(png_paths)))

        offset = 6 + (16 * len(png_paths))

        # Write directory entries
        for png_path in png_paths:
            with open(png_path, 'rb') as png:
                png_data = png.read()

            if '16x16' in png_path:
                size = 16
            elif '32x32' in png_path:
                size = 32
            elif '256' in png_path:
                size = 0  # 0 means 256
            else:
                size = 0

            ico.write(struct.pack('<BBBBHHII',
                size, size, 0, 0, 1, 32, len(png_data), offset
            ))
            offset += len(png_data)

        # Write image data
        for png_path in png_paths:
            with open(png_path, 'rb') as png:
                ico.write(png.read())

create_ico('icon.ico', ['16x16.png', '32x32.png', 'icon-256.png'])
PYTHON_EOF

# Copy favicon to public directory
echo "  - Copying favicon to public directory..."
mkdir -p ../../public
cp favicon-32x32.png ../../public/favicon.png
cp icon.ico ../../public/favicon.ico

echo "Done! All icons regenerated successfully."
echo ""
echo "Generated files:"
echo "  - App icons: icon-{16,32,128,256,512,1024}.png"
echo "  - macOS bundle: icon.icns"
echo "  - Windows icon: icon.ico"
echo "  - Menu bar: tray-icon.png, tray-icon@2x.png"
echo "  - Favicon: public/favicon.png, public/favicon.ico"
