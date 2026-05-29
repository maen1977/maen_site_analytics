#!/bin/zsh
cd "$(dirname "$0")"
echo "تشغيل موقع معن حنونة محلياً..."
echo "افتح الرابط: http://localhost:8080"
python3 -m http.server 8080 -d public
