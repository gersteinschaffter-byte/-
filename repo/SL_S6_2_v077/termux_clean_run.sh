#!/data/data/com.termux/files/usr/bin/bash
set -e

# Usage:
#   bash termux_clean_run.sh /sdcard/Download/SL_S6_2_v0xx_FULL.zip
# If zip path is not provided, it will auto-pick the newest SL_S6_2_*_*.zip in Download.

termux-setup-storage >/dev/null 2>&1 || true

pkg update -y >/dev/null
pkg install -y nodejs-lts unzip >/dev/null

ZIP_PATH="$1"
if [ -z "$ZIP_PATH" ]; then
  ZIP_PATH="$(ls -t /sdcard/Download/SL_S6_2_v*_*.zip 2>/dev/null | head -n 1)"
fi

if [ -z "$ZIP_PATH" ] || [ ! -f "$ZIP_PATH" ]; then
  echo "❌ 找不到 包(FULL/SPLIT)。请把 SL_S6_2_v0xx_FULL.zip 放到 /sdcard/Download/"
  echo "   或者手动指定：bash termux_clean_run.sh /sdcard/Download/xxx_FULL.zip"
  exit 1
fi

RUN_DIR="$HOME/game/SL_run"
echo "🧹 Clean run dir: $RUN_DIR"
rm -rf "$RUN_DIR"
mkdir -p "$RUN_DIR"
cd "$RUN_DIR"

echo "📦 Unzipping: $ZIP_PATH"
unzip -o "$ZIP_PATH" -d . >/dev/null

# Find project root (package.json)
PROJ_DIR="$(find . -maxdepth 3 -type f -name package.json -printf '%h
' | head -n 1)"
if [ -z "$PROJ_DIR" ]; then
  echo "❌ 解压后未找到 package.json，可能 zip 结构不对或解压失败。"
  exit 1
fi
cd "$PROJ_DIR"

echo "🔎 Verifying..."
bash verify_project.sh || true

echo "✅ Installing dependencies..."
npm install

echo "🚀 Starting dev server..."
npm run dev -- --host 0.0.0.0 --port 5173
