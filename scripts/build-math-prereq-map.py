#!/usr/bin/env python3
"""Embed maps/math-topics.json into maps/math-prereq-map.html for offline use."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAP_HTML = ROOT / "maps" / "math-prereq-map.html"
TOPIC_JSON = ROOT / "maps" / "math-topics.json"
MARKER = "<!-- MATH_TOPIC_DATA -->"

payload = json.loads(TOPIC_JSON.read_text(encoding="utf-8"))
embedded = json.dumps(
    {"nodes": payload.get("nodes", []), "edges": payload.get("edges", [])},
    ensure_ascii=False,
    indent=2,
)

html = MAP_HTML.read_text(encoding="utf-8")
block = (
    f'  <script type="application/json" id="math-topic-data">\n'
    f"{embedded}\n"
    f"  </script>\n"
    f"  {MARKER}\n"
)

if MARKER in html:
    html = re.sub(
        r'  <script type="application/json" id="math-topic-data">.*?</script>\n  '
        + re.escape(MARKER),
        block.rstrip("\n"),
        html,
        count=1,
        flags=re.DOTALL,
    )
else:
    html = html.replace(
        "  <script>\n    const LEVELS",
        block + "\n  <script>\n    const LEVELS",
        1,
    )

MAP_HTML.write_text(html, encoding="utf-8", newline="\n")
print(f"Embedded {len(payload.get('nodes', []))} nodes and {len(payload.get('edges', []))} edges into {MAP_HTML.relative_to(ROOT)}")
