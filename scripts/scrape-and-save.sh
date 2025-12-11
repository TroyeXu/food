#!/bin/bash

# 爬取年菜網頁並保存結果

OUTPUT_FILE="/Users/elonmusk/food/data/scraped-plans.json"
mkdir -p /Users/elonmusk/food/data

echo "[]" > "$OUTPUT_FILE"

URLS=(
  "https://www.pengyuan.com.tw/news_detail/13"
)

ALL_ITEMS="[]"

for url in "${URLS[@]}"; do
  echo "=========================================="
  echo "爬取: $url"
  echo "=========================================="

  RESULT=$(curl -L -s -X POST http://localhost:3000/api/ai-extract \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"$url\",\"cli\":\"claude\",\"service\":\"jina\"}")

  # 提取 parsed 陣列
  ITEMS=$(echo "$RESULT" | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data.get('data', {}).get('parsed', [])))" 2>/dev/null)

  if [ -n "$ITEMS" ] && [ "$ITEMS" != "[]" ] && [ "$ITEMS" != "null" ]; then
    # 合併到總陣列
    ALL_ITEMS=$(echo "$ALL_ITEMS" "$ITEMS" | python3 -c "import sys, json; a = json.loads(sys.stdin.readline()); b = json.loads(sys.stdin.readline()); print(json.dumps(a + b))")
    COUNT=$(echo "$ITEMS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))")
    echo "成功提取 $COUNT 筆資料"
  else
    echo "無法提取資料"
  fi

  sleep 2
done

# 保存結果
echo "$ALL_ITEMS" | python3 -m json.tool > "$OUTPUT_FILE"
TOTAL=$(echo "$ALL_ITEMS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))")
echo ""
echo "=========================================="
echo "完成！共提取 $TOTAL 筆資料"
echo "結果已保存到: $OUTPUT_FILE"
echo "=========================================="
