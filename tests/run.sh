#!/bin/bash
# ============================================================
# 一键运行所有测试
# 退出码：0 = 全部通过，1 = 有失败
# ============================================================

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="/Users/kj/projects/wechat"
RESULTS=()
FAIL_COUNT=0

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
  echo ""
  echo "============================================================"
  echo "  $1"
  echo "============================================================"
}

record_result() {
  local name="$1"
  local status="$2"
  if [ "$status" -eq 0 ]; then
    RESULTS+=("PASS | $name")
    echo -e "  ${GREEN}✅ PASS${NC} | $name"
  else
    RESULTS+=("FAIL | $name")
    echo -e "  ${RED}❌ FAIL${NC} | $name"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# ============================================================
# 1. 后端 Go 测试
# ============================================================
print_header "1/4 后端 Go 测试"

if [ -d "$BACKEND_DIR" ]; then
  cd "$BACKEND_DIR"
  go test ./internal/scheduler/... ./internal/handler/... -v -count=1 2>&1 | tail -20
  record_result "Go 单元测试 (scheduler + handler)" $?
else
  echo -e "  ${YELLOW}⚠️  后端目录不存在: $BACKEND_DIR${NC}"
  record_result "Go 单元测试 (scheduler + handler)" 1
fi

# ============================================================
# 2. 前端编译检查（通过 preview 触发完整编译）
# ============================================================
print_header "2/4 前端编译检查"

PORT=$(cat ~/Library/Application\ Support/微信开发者工具/*/Default/.ide 2>/dev/null | head -1 | tr -d '[:space:]')
PROJ="$PROJECT_DIR"

if [ -z "$PORT" ]; then
  echo -e "  ${YELLOW}⚠️  DevTools 端口未找到，跳过编译检查${NC}"
  RESULTS+=("SKIP | 前端编译检查 (DevTools)")
else
  ENCODED=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$PROJ")
  echo "  DevTools 端口: $PORT"
  HTTP_STATUS=$(curl -s --max-time 60 -o /tmp/preview-qr.jpg -w "%{http_code}" "http://127.0.0.1:${PORT}/v2/preview?project=${ENCODED}")

  # 检查 HTTP 状态码
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "COMPILE OK (HTTP 200, QR saved to /tmp/preview-qr.jpg)"
    record_result "前端编译检查 (DevTools)" 0
  else
    record_result "前端编译检查 (DevTools)" 1
  fi
fi

# ============================================================
# 3. 前端冒烟测试 (automator)
# ============================================================
print_header "3/4 前端冒烟测试"

cd "$PROJECT_DIR"
if [ -f "tests/smoke.test.js" ]; then
  node tests/smoke.test.js 2>&1
  record_result "前端冒烟测试 (automator)" $?
else
  echo -e "  ${YELLOW}⚠️  smoke.test.js 不存在${NC}"
  record_result "前端冒烟测试 (automator)" 1
fi

# ============================================================
# 4. DatePicker 回归测试
# ============================================================
print_header "4/4 DatePicker 回归测试"

if [ -f "tests/datepicker.test.js" ]; then
  node tests/datepicker.test.js 2>&1
  record_result "DatePicker 回归测试" $?
else
  echo -e "  ${YELLOW}⚠️  datepicker.test.js 不存在${NC}"
  record_result "DatePicker 回归测试" 1
fi

# ============================================================
# 汇总报告
# ============================================================
echo ""
echo "============================================================"
echo "  测试汇总报告"
echo "============================================================"
echo ""

for r in "${RESULTS[@]}"; do
  if [[ "$r" == PASS* ]]; then
    echo -e "  ${GREEN}$r${NC}"
  elif [[ "$r" == FAIL* ]]; then
    echo -e "  ${RED}$r${NC}"
  else
    echo -e "  ${YELLOW}$r${NC}"
  fi
done

echo ""
echo "────────────────────────────────────────────────────────────"
if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "  ${GREEN}全部通过 ✅${NC}"
  echo "────────────────────────────────────────────────────────────"
  exit 0
else
  echo -e "  ${RED}${FAIL_COUNT} 项失败 ❌${NC}"
  echo "────────────────────────────────────────────────────────────"
  exit 1
fi
