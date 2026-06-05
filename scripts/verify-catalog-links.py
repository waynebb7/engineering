#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
missing = []
for cat in ["pure_math_subjects.html", "physics_subjects.html"]:
    text = (ROOT / cat).read_text(encoding="utf-8")
    for href in re.findall(r'href="([^"]+\.html)"', text):
        if href == "index.html":
            continue
        if not (ROOT / href).exists():
            missing.append((cat, href))

print(f"missing from math/physics catalogs: {len(missing)}")
for item in missing:
    print(item)
