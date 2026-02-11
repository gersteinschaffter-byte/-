#!/data/data/com.termux/files/usr/bin/bash
set -e

# Run from project root (where package.json is).
if [ ! -f "package.json" ]; then
  echo "❌ 请在项目根目录运行（能看到 package.json 的目录）"
  exit 1
fi

# Termux storage permission (safe even if already granted)
termux-setup-storage >/dev/null 2>&1 || true

# Basic deps
pkg update -y >/dev/null
pkg install -y nodejs-lts unzip >/dev/null

# Optional: faster npm in CN
# npm config set registry https://registry.npmmirror.com >/dev/null 2>&1 || true

echo "✅ Installing dependencies..."
npm install

echo "🚀 Starting dev server..."
npm run dev -- --host 0.0.0.0 --port 5173
