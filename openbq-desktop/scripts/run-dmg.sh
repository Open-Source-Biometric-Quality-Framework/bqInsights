#!/usr/bin/env bash
set -euo pipefail

DMG=$(ls ./release/*.dmg | head -n 1)
echo "▶ Mounting $DMG"

MOUNT_PLIST=$(hdiutil attach "$DMG" -nobrowse -plist)
VOLUME=$(/usr/libexec/PlistBuddy -c \
  "Print :system-entities:0:mount-point" \
  /dev/stdin <<< "$MOUNT_PLIST")

if [ ! -d "$VOLUME" ]; then
  echo "❌ Failed to find mounted volume"
  exit 1
fi

echo "▶ Mounted at $VOLUME"
ls -la "$VOLUME"

APP=$(find "$VOLUME" -name "*.app" -maxdepth 1 | head -n 1)
if [ -z "${APP:-}" ]; then
  echo "❌ No .app found in $VOLUME"
  exit 1
fi

echo "▶ Found app: $APP"

MACOS_DIR="$APP/Contents/MacOS"
if [ ! -d "$MACOS_DIR" ]; then
  echo "❌ MacOS directory missing: $MACOS_DIR"
  ls -la "$APP"
  exit 1
fi

BIN_NAME=$(ls -1 "$MACOS_DIR" | head -n 1)
BIN="$MACOS_DIR/$BIN_NAME"

if [ ! -x "$BIN" ]; then
  echo "❌ Binary not executable: $BIN"
  ls -la "$MACOS_DIR"
  exit 1
fi

echo "▶ Running $BIN"
"$BIN" --test

echo "▶ App exited, unmounting $VOLUME"
hdiutil detach "$VOLUME"

echo "▶ Cleaning up DMG"
rm -f "$DMG"