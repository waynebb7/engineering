#!/usr/bin/env python3
"""Map prereq graph node IDs to lesson page hrefs."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "assets" / "js" / "topic-catalog.json"
OVERRIDES = ROOT / "scripts" / "prereq-node-pages-overrides.json"
OUT = ROOT / "maps" / "prereq-node-pages.json"

TOPIC_FILES = {
    "math": ROOT / "maps" / "math-topics.json",
    "physics": ROOT / "maps" / "physics-topics.json",
    "quantum": ROOT / "maps" / "quantum-topics.json",
}


def norm(s: str) -> str:
    s = s.lower()
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def load_topics(catalog_id: str) -> list[dict]:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    cat = next(c for c in data["catalogs"] if c["id"] == catalog_id)
    topics: list[dict] = []
    for section in cat["sections"]:
        for topic in section["topics"]:
            topics.append(topic)
    return topics


def physics_guess(node: dict) -> str | None:
    node_id = node["id"]
    level = node["level"]
    folder = {
        "KS2": "ks2-ks3",
        "KS3": "ks2-ks3",
        "GCSE": "gcse",
        "A-Level": "a-level",
        "BSc": "undergraduate",
        "MSc": "postgraduate",
        "Frontier": "frontier",
    }.get(level, "")
    if not folder:
        return None
    core = node_id
    for suffix in ("_basics", "_ks3", "_gcse", "_alevel", "_bsc", "_msc", "_frontier"):
        if core.endswith(suffix):
            core = core[: -len(suffix)]
    slug = core.replace("_", "-")
    if level == "A-Level" and not slug.endswith("-a-level"):
        candidates = [f"learn/physics/{folder}/{slug}-a-level.html", f"learn/physics/{folder}/{slug}.html"]
    elif level == "GCSE" and not slug.endswith("-gcse"):
        candidates = [f"learn/physics/{folder}/{slug}-gcse.html", f"learn/physics/{folder}/{slug}.html"]
    else:
        candidates = [f"learn/physics/{folder}/{slug}.html"]
    for c in candidates:
        if (ROOT / c).exists():
            return c
    return None


def best_title_match(node_title: str, topics: list[dict]) -> str | None:
    target = norm(node_title)
    best = None
    best_score = 0
    for topic in topics:
        title = norm(topic["title"])
        if title == target:
            return topic["href"]
        if target in title or title in target:
            score = min(len(target), len(title))
            if score > best_score:
                best_score = score
                best = topic["href"]
    return best


def main() -> None:
    overrides = {}
    if OVERRIDES.exists():
        overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))

    math_topics = load_topics("math")
    physics_topics = load_topics("physics")
    quantum_topics = load_topics("quantum")

    result: dict[str, dict[str, list[str]]] = {"math": {}, "physics": {}, "quantum": {}}

    for map_id, path in TOPIC_FILES.items():
        if not path.exists():
            continue
        graph = json.loads(path.read_text(encoding="utf-8"))
        map_overrides = overrides.get(map_id, {})
        catalog_topics = {"math": math_topics, "physics": physics_topics, "quantum": quantum_topics}[map_id]

        for node in graph.get("nodes", []):
            node_id = node["id"]
            if node_id in map_overrides:
                result[map_id][node_id] = map_overrides[node_id]
                continue

            href = None
            if map_id == "physics":
                href = physics_guess(node)
            if not href:
                href = best_title_match(node["title"], catalog_topics)

            if href and (ROOT / href).exists():
                result[map_id][node_id] = [href]

        # Math external nodes used in cross maps
        for node in graph.get("nodes", []):
            if node.get("subject") == "math" and node["id"] not in result.get(map_id, {}):
                math_path = TOPIC_FILES["math"]
                if math_path.exists():
                    math_graph = json.loads(math_path.read_text(encoding="utf-8"))
                    math_node = next((n for n in math_graph["nodes"] if n["id"] == node["id"]), None)
                    if math_node:
                        href = best_title_match(math_node["title"], math_topics)
                        if href and (ROOT / href).exists():
                            result.setdefault(map_id, {})[node["id"]] = [href]

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for k, v in result.items():
        print(f"{k}: mapped {len(v)} nodes")


if __name__ == "__main__":
    main()
