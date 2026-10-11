#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$DIR/.." && pwd)"
APP_DIR="/Applications/Coco Squad.app"
DESKTOP_LINK="$HOME/Desktop/Coco Squad.app"

# Ensure node/npm are in PATH
export PATH="$HOME/.local/share/coco-squad-toolchain/node-v24/bin:$PATH:/usr/local/bin:/opt/homebrew/bin"

echo "=== 🥥 Compilando frontend web de Coco Squad ==="
cd "$ROOT_DIR/windows"
npx vite build

echo "=== 🥥 Compilando ejecutable nativo Swift para macOS ==="
cd "$DIR"
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    TARGET="arm64-apple-macos13.0"
else
    TARGET="x86_64-apple-macos13.0"
fi

swiftc -O -target "$TARGET" "$DIR/CocoSquadApp.swift" -o "$DIR/CocoSquad"

echo "=== 🥥 Empaquetando /Applications/Coco Squad.app ==="
pkill -f "Coco Squad" 2>/dev/null || true
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

cp "$DIR/CocoSquad" "$APP_DIR/Contents/MacOS/Coco Squad"
chmod +x "$APP_DIR/Contents/MacOS/Coco Squad"

# Copy web bundle
cp -R "$ROOT_DIR/windows/dist" "$APP_DIR/Contents/Resources/web"

# Copy Icon if exists
if [ -f "/tmp/AppIcon.icns" ]; then
    cp "/tmp/AppIcon.icns" "$APP_DIR/Contents/Resources/AppIcon.icns"
elif [ -f "$DIR/AppIcon.icns" ]; then
    cp "$DIR/AppIcon.icns" "$APP_DIR/Contents/Resources/AppIcon.icns"
fi

# Info.plist
cat << 'EOF' > "$APP_DIR/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Coco Squad</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.cocosquad.app</string>
    <key>CFBundleName</key>
    <string>Coco Squad</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# Symlink to Desktop
ln -sf "$APP_DIR" "$DESKTOP_LINK"

echo "=== ✅ Instalación completada con éxito ==="
echo "App instalada en: $APP_DIR"
echo "Acceso directo en Escritorio: $DESKTOP_LINK"
