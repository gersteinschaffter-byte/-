#!/data/data/com.termux/files/usr/bin/bash
set -e

# Simple sanity checks to prevent "mixed unzip / missing file" issues.

if [ ! -f "package.json" ]; then
  echo "❌ verify: 未找到 package.json（请在项目根目录运行）"
  exit 1
fi

# Key files (adjust as project evolves)
NEEDED=(
  "src/main.ts"
  "src/core/GameApp.ts"
  "src/battle/BattleEngine.ts"
  "src/battle/BattleLogic.ts"
  "src/battle/BattleView.ts"
)

missing=0
for f in "${NEEDED[@]}"; do
  if [ ! -f "$f" ]; then
    echo "❌ verify: 缺少文件 $f（很可能解压混了版本/解压不完整）"
    missing=1
  fi
done

# Node version check (need >= 18)
NODEV="$(node -v 2>/dev/null || true)"
if [ -z "$NODEV" ]; then
  echo "❌ verify: 未检测到 node（请先 pkg install nodejs-lts）"
  exit 1
fi

major="$(echo "$NODEV" | sed 's/^v//' | cut -d. -f1)"
if [ "$major" -lt 18 ]; then
  echo "⚠️  verify: Node 版本过低：$NODEV（建议 >= 18，Termux 用 nodejs-lts）"
fi

if [ "$missing" -eq 0 ]; then
  echo "✅ verify: 关键文件齐全，环境OK（Node $NODEV）"
else
  exit 1
fi
