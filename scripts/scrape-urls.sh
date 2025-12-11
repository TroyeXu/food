#!/bin/bash

# 爬取3個年菜網頁

URLS=(
  "https://www.pengyuan.com.tw/news_detail/13"
  "https://www.myfeel-tw.com/media/new-year-dishes"
  "https://www.harpersbazaar.com/tw/life/food/a69563693/2026-chinese-new-year-cuisine/"
)

for url in "${URLS[@]}"; do
  echo "=========================================="
  echo "爬取: $url"
  echo "=========================================="

  curl -s -X POST http://localhost:3000/api/ai-extract \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"$url\",\"cli\":\"claude\",\"service\":\"jina\"}"

  echo ""
  echo ""
  sleep 2
done
