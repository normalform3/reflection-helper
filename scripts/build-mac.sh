#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/build/Reflection Helper.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
WEB_DIR="$RESOURCES_DIR/Web"

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$WEB_DIR"

# Generate app icon if .icns is missing or iconset is newer
if [ ! -f "$ROOT_DIR/mac/AppIcon.icns" ] || [ "$ROOT_DIR/mac/AppIcon.iconset" -nt "$ROOT_DIR/mac/AppIcon.icns" ]; then
  echo "Building AppIcon.icns..."
  iconutil -c icns "$ROOT_DIR/mac/AppIcon.iconset" -o "$ROOT_DIR/mac/AppIcon.icns"
fi

swiftc "$ROOT_DIR/mac/ReflectionHelperLauncher.swift" \
  -o "$MACOS_DIR/ReflectionHelper" \
  -framework AppKit \
  -framework UserNotifications \
  -framework WebKit

cp "$ROOT_DIR/mac/Info.plist" "$CONTENTS_DIR/Info.plist"
cp "$ROOT_DIR/mac/AppIcon.icns" "$RESOURCES_DIR/AppIcon.icns"
cp "$ROOT_DIR/index.html" "$WEB_DIR/index.html"
cp "$ROOT_DIR/styles.css" "$WEB_DIR/styles.css"
cp "$ROOT_DIR/app.js" "$WEB_DIR/app.js"

echo "$APP_DIR"
