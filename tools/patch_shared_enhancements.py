from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS_TAG = '<link rel="stylesheet" href="/assets/maensat-enhancements.css?v=20260816">'
JS_TAG = '<script defer src="/assets/maensat-enhancements.js?v=20260816"></script>'

for name in ("index.html", "index_phone.html"):
    path = ROOT / "public" / name
    text = path.read_text(encoding="utf-8")
    if CSS_TAG not in text:
        marker = "</head>"
        if marker not in text:
            raise RuntimeError(f"Missing head marker in {name}")
        text = text.replace(marker, f"{CSS_TAG}\n{marker}", 1)
    if JS_TAG not in text:
        marker = "</body>"
        if marker not in text:
            raise RuntimeError(f"Missing body marker in {name}")
        text = text.replace(marker, f"{JS_TAG}\n{marker}", 1)
    path.write_text(text, encoding="utf-8")

redirects = ROOT / "public" / "_redirects"
redirect_text = redirects.read_text(encoding="utf-8") if redirects.exists() else ""
line = "/api/track-event  /api/track-event  200"
if line not in redirect_text:
    redirects.write_text(redirect_text.rstrip() + "\n" + line + "\n", encoding="utf-8")

print("patched index.html, index_phone.html, and public/_redirects")
