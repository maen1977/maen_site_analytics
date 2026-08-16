from __future__ import annotations

import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "index.html"
TARGET = ROOT / "public" / "data" / "products.json"


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9\u0600-\u06ff]+", "-", value)
    return value.strip("-") or "product"


def clean(value: str) -> str:
    return " ".join(value.split())


def main() -> None:
    soup = BeautifulSoup(SOURCE.read_text(encoding="utf-8"), "html.parser")
    rows: list[dict] = []
    seen: set[str] = set()
    for card in soup.select(".device-card, .satellite-card"):
        title_node = card.select_one("h3")
        if not title_node:
            continue
        title = clean(title_node.get_text(" ", strip=True))
        key = slugify(title)
        if key in seen:
            continue
        seen.add(key)
        brand_node = card.select_one(".brand")
        available_node = card.select_one(".available")
        price_node = card.select_one(".price-row strong")
        desc_node = card.select_one(".desc")
        features_node = card.select_one(".features")
        image_node = card.select_one("img")
        row = {
            "id": key,
            "type": "satellite" if "satellite-card" in (card.get("class") or []) else "receiver",
            "brand": clean(brand_node.get_text(" ", strip=True)) if brand_node else "",
            "name": title,
            "price": clean(price_node.get_text(" ", strip=True)) if price_node else None,
            "available": clean(available_node.get_text(" ", strip=True)) if available_node else "",
            "description": clean(desc_node.get_text(" ", strip=True)) if desc_node else "",
            "features": clean(features_node.get_text(" ", strip=True)) if features_node else "",
            "image": image_node.get("src", "") if image_node else "",
        }
        rows.append(row)
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(rows)} products to {TARGET}")


if __name__ == "__main__":
    main()
