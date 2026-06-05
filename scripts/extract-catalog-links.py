#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOGS = [
    "pure_math_subjects.html",
    "physics_subjects.html",
    "quantum_subjects.html",
]

for cat in CATALOGS:
    text = (ROOT / cat).read_text(encoding="utf-8")
    links = []
    for href in re.findall(r'href="([^"]+\.html)"', text):
        if href not in links and href != "index.html":
            links.append(href)
    print(cat, len(links))
