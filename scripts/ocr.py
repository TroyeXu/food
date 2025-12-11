#!/usr/bin/env python3
"""
PaddleOCR 圖片文字識別服務
用於解析年菜圖片中的文字資訊
"""

import sys
import json
import os
import tempfile
import urllib.request
from typing import List, Optional


def download_image(url: str) -> Optional[str]:
    """下載圖片到暫存檔案"""
    try:
        # 建立暫存檔案
        suffix = '.jpg'
        if '.png' in url.lower():
            suffix = '.png'
        elif '.webp' in url.lower():
            suffix = '.webp'

        fd, temp_path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)

        # 下載圖片
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as response:
            with open(temp_path, 'wb') as f:
                f.write(response.read())

        return temp_path
    except Exception as e:
        print(f"[OCR] Failed to download {url}: {e}", file=sys.stderr)
        return None


def ocr_image(image_path: str, ocr_engine) -> str:
    """對單張圖片進行 OCR"""
    try:
        # 使用新版 predict 方法
        result = ocr_engine.predict(image_path)

        if not result:
            return ""

        texts = []

        # 新版 PaddleOCR predict 返回格式: [{'rec_texts': [...], 'rec_scores': [...], ...}]
        if isinstance(result, list):
            for item in result:
                if isinstance(item, dict):
                    rec_texts = item.get('rec_texts', [])
                    rec_scores = item.get('rec_scores', [])

                    for i, text in enumerate(rec_texts):
                        score = rec_scores[i] if i < len(rec_scores) else 1.0
                        if score > 0.5 and text.strip():  # 只取信心度 > 50% 的結果
                            texts.append(str(text))
                # 舊格式相容
                elif isinstance(item, list):
                    for line in item:
                        if line and len(line) >= 2:
                            text_info = line[1] if len(line) > 1 else line[0]
                            if isinstance(text_info, tuple) and len(text_info) >= 2:
                                text, confidence = text_info[0], text_info[1]
                                if confidence > 0.5:
                                    texts.append(str(text))

        return "\n".join(texts)
    except Exception as e:
        print(f"[OCR] Error processing {image_path}: {e}", file=sys.stderr)
        return ""


def process_images(image_urls: List[str], max_images: int = 20) -> dict:
    """處理多張圖片的 OCR"""
    try:
        from paddleocr import PaddleOCR

        # 初始化 PaddleOCR（使用繁體中文）
        ocr = PaddleOCR(
            lang='chinese_cht',  # 繁體中文
            use_textline_orientation=True,
        )

        results = []
        processed = 0

        for url in image_urls[:max_images]:
            if not url or not url.startswith('http'):
                continue

            # 跳過小圖標、logo 等
            skip_patterns = ['icon', 'logo', 'avatar', 'emoji', 'btn', 'button', 'arrow']
            if any(p in url.lower() for p in skip_patterns):
                continue

            print(f"[OCR] Processing: {url}", file=sys.stderr)

            # 下載圖片
            temp_path = download_image(url)
            if not temp_path:
                continue

            try:
                # 執行 OCR
                text = ocr_image(temp_path, ocr)
                if text.strip():
                    results.append({
                        "url": url,
                        "text": text.strip()
                    })
                    processed += 1
            finally:
                # 清理暫存檔案
                if os.path.exists(temp_path):
                    os.remove(temp_path)

        # 合併所有文字
        all_text = "\n\n---\n\n".join([
            f"[圖片 {i+1}]\n{r['text']}"
            for i, r in enumerate(results)
        ])

        return {
            "success": True,
            "processed": processed,
            "total": len(image_urls),
            "results": results,
            "combined_text": all_text
        }

    except ImportError:
        return {
            "success": False,
            "error": "PaddleOCR 未安裝，請執行: pip install paddlepaddle paddleocr"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def ocr_single_image(image_url: str) -> dict:
    """處理單張圖片的 OCR"""
    return process_images([image_url], max_images=1)


def main():
    """
    命令列介面

    用法:
    python ocr.py <image_url>                  # 單張圖片
    python ocr.py --batch <json_array>         # 批次處理（JSON 陣列）
    python ocr.py --batch-file <file_path>     # 從檔案讀取 URL 列表
    """
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python ocr.py <image_url> | --batch <json_array> | --batch-file <file>"
        }))
        sys.exit(1)

    arg1 = sys.argv[1]

    if arg1 == "--batch" and len(sys.argv) >= 3:
        # 批次模式：從 JSON 陣列讀取
        try:
            urls = json.loads(sys.argv[2])
            result = process_images(urls)
        except json.JSONDecodeError:
            result = {"success": False, "error": "Invalid JSON array"}

    elif arg1 == "--batch-file" and len(sys.argv) >= 3:
        # 從檔案讀取 URL 列表
        try:
            with open(sys.argv[2], 'r') as f:
                data = json.load(f)
                urls = data if isinstance(data, list) else data.get('urls', [])
            result = process_images(urls)
        except Exception as e:
            result = {"success": False, "error": str(e)}

    else:
        # 單張圖片模式
        result = ocr_single_image(arg1)

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
