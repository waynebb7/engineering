#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STUB_MARKERS = ("Content is being developed", "Coming soon")
text = (ROOT / "quantum_subjects.html").read_text(encoding="utf-8")
links = []
for href in re.findall(r'href="([^"]+\.html)"', text):
    if href not in links and href != "index.html":
        links.append(href)

missing = []
stubs = []
short = []
for href in links:
    path = ROOT / href
    if not path.exists():
        missing.append(href)
        continue
    body = path.read_text(encoding="utf-8")
    if any(m in body for m in STUB_MARKERS):
        stubs.append(href)
    elif body.count("<div class=\"card\">") < 5 and "content-page" not in body:
        short.append(href)

print("Total catalog links:", len(links))
print("Missing:", len(missing))
for m in missing:
    print("  MISSING", m)
print("Stubs:", len(stubs))
for s in stubs:
    print("  STUB", s)
print("Short/old format:", len(short))
for s in short:
    print("  SHORT", s)
