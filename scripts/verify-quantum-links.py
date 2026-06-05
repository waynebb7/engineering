#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
text = (ROOT / "quantum_subjects.html").read_text(encoding="utf-8")
missing = []
for href in re.findall(r'href="([^"]+\.html)"', text):
    if href == "index.html":
        continue
    if not (ROOT / href).exists():
        missing.append(href)

print(f"quantum catalog links: {len(missing)} missing")
for m in missing:
    print(" ", m)
