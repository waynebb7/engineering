#!/usr/bin/env python3
"""Generate assets/js/documents-manifest.js from reference/documents/manifest.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "reference" / "documents" / "manifest.json"
OUTPUT = ROOT / "assets" / "js" / "documents-manifest.js"


def main() -> int:
    if not MANIFEST.is_file():
        print(f"error: missing {MANIFEST.relative_to(ROOT)}", file=sys.stderr)
        return 1

    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    documents = data.get("documents", [])
    missing = []
    for doc in documents:
        rel = doc.get("file", "")
        path = ROOT / "reference" / "documents" / rel.replace("/", "\\").replace("\\", "/")
        if rel and not path.is_file():
            missing.append(rel)

    if missing:
        print("error: manifest references missing files:", file=sys.stderr)
        for rel in missing:
            print(f"  - {rel}", file=sys.stderr)
        return 1

    payload = json.dumps({"documents": documents}, ensure_ascii=False, indent=2)
    OUTPUT.write_text(
        "window.DocumentManifest = "
        + payload
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT.relative_to(ROOT)} ({len(documents)} document(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
