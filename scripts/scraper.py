#!/usr/bin/env .venv/bin/python
"""
Python 爬取服務包裝器
支援 Crawl4AI 和 ScrapeGraphAI
"""

import sys
import json
import asyncio
from typing import Optional

def scrape_with_crawl4ai(url: str) -> dict:
    """使用 Crawl4AI 爬取網頁"""
    try:
        from crawl4ai import WebCrawler

        crawler = WebCrawler()
        crawler.warmup()

        result = crawler.run(url=url)

        return {
            "success": True,
            "url": url,
            "title": result.metadata.get("title", "") if result.metadata else "",
            "content": result.markdown or result.cleaned_html or "",
            "images": result.media.get("images", []) if result.media else []
        }
    except ImportError:
        return {
            "success": False,
            "error": "Crawl4AI 未安裝，請執行: pip install crawl4ai"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def scrape_with_crawl4ai_async(url: str) -> dict:
    """使用 Crawl4AI 異步版本爬取網頁"""
    try:
        from crawl4ai import AsyncWebCrawler

        async def crawl():
            async with AsyncWebCrawler() as crawler:
                result = await crawler.arun(url=url)
                return result

        result = asyncio.run(crawl())

        return {
            "success": True,
            "url": url,
            "title": result.metadata.get("title", "") if result.metadata else "",
            "content": result.markdown or result.cleaned_html or "",
            "images": result.media.get("images", []) if result.media else []
        }
    except ImportError:
        return {
            "success": False,
            "error": "Crawl4AI 未安裝，請執行: pip install crawl4ai"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def scrape_with_scrapegraph(url: str, llm_config: Optional[dict] = None) -> dict:
    """使用 ScrapeGraphAI 爬取網頁"""
    try:
        from scrapegraphai.graphs import SmartScraperGraph

        # 預設使用 OpenAI，也可以改用其他 LLM
        if llm_config is None:
            llm_config = {
                "llm": {
                    "model": "gpt-4o-mini",
                    "temperature": 0
                }
            }

        # 建立爬取圖
        graph = SmartScraperGraph(
            prompt="Extract all the text content from this page and format it as markdown. Include the page title.",
            source=url,
            config=llm_config
        )

        result = graph.run()

        # 結果可能是 dict 或 string
        if isinstance(result, dict):
            content = json.dumps(result, ensure_ascii=False, indent=2)
        else:
            content = str(result)

        return {
            "success": True,
            "url": url,
            "title": "",
            "content": content,
            "images": []
        }
    except ImportError:
        return {
            "success": False,
            "error": "ScrapeGraphAI 未安裝，請執行: pip install scrapegraphai"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python scraper.py <service> <url>"
        }))
        sys.exit(1)

    service = sys.argv[1]
    url = sys.argv[2]

    if service == "crawl4ai":
        result = scrape_with_crawl4ai_async(url)
    elif service == "scrapegraph":
        result = scrape_with_scrapegraph(url)
    else:
        result = {
            "success": False,
            "error": f"Unknown service: {service}"
        }

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
