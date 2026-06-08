#!/usr/bin/env python3
"""Regenerate legacy/physics-drill-down/list.html from the physics prereq graph."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIST_FILE = ROOT / "legacy" / "physics-drill-down" / "list.html"
GRAPH_FILE = ROOT / "maps" / "physics-topics.json"
NODE_PAGES_FILE = ROOT / "maps" / "prereq-node-pages.json"
MAP_HREF = "maps/physics-prereq-map.html"

LIST_START = "<!-- ek-legacy-physics-list:start -->"
LIST_END = "<!-- ek-legacy-physics-list:end -->"


def os_path_relpath(from_dir: Path, to_path: Path) -> str:
    from_parts = from_dir.parts if str(from_dir) != "." else ()
    to_parts = to_path.parts
    common = 0
    for a, b in zip(from_parts, to_parts):
        if a != b:
            break
        common += 1
    ups = [".."] * (len(from_parts) - common)
    return "/".join(ups + list(to_parts[common:]))


def escape_html(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def build_list_html(by_node: dict[str, list[str]], nodes: list[dict], levels: list[str]) -> str:
    from_dir = LIST_FILE.parent
    lines: list[str] = [
        "    " + LIST_START,
        '    <div class="card">',
        "      <h2>All topics</h2>",
        "      <p class=\"note\">",
        "        Each topic links to its lesson page where available, and to its position on the",
        f'        <a href="{os_path_relpath(from_dir, ROOT / MAP_HREF)}">physics prerequisite map</a>.',
        "      </p>",
    ]

    by_level: dict[str, list[dict]] = {level: [] for level in levels}
    for node in nodes:
        level = node.get("level", "")
        if level in by_level:
            by_level[level].append(node)

    for level in levels:
        group = sorted(by_level[level], key=lambda n: n["title"].lower())
        if not group:
            continue
        lines.append(f'      <h3>{escape_html(level)}</h3>')
        lines.append("      <ul>")
        for node in group:
            node_id = node["id"]
            map_link = (
                os_path_relpath(from_dir, ROOT / MAP_HREF) + f"?topic={node_id}"
            )
            pages = by_node.get(node_id, [])
            title = escape_html(node["title"])
            if pages:
                lesson = os_path_relpath(from_dir, ROOT / pages[0])
                lines.append(
                    f'        <li><a href="{lesson}">{title}</a> '
                    f'(<a href="{map_link}">map</a>)</li>'
                )
            else:
                lines.append(f'        <li><a href="{map_link}">{title}</a></li>')
        lines.append("      </ul>")

    lines.extend(["    </div>", "    " + LIST_END])
    return "\n".join(lines) + "\n"


def main() -> None:
    if not LIST_FILE.exists():
        raise SystemExit(f"Missing {LIST_FILE}")

    graph = json.loads(GRAPH_FILE.read_text(encoding="utf-8"))
    node_pages = json.loads(NODE_PAGES_FILE.read_text(encoding="utf-8"))
    by_node = node_pages.get("byNode", {}).get("physics", {})
    levels = graph.get("meta", {}).get("levels", [])
    nodes = graph.get("nodes", [])

    html = LIST_FILE.read_text(encoding="utf-8")
    html = re.sub(
        LIST_START + r"[\s\S]*?" + LIST_END,
        "",
        html,
    )
    block = build_list_html(by_node, nodes, levels)

    callout_end = html.find('<details class="content-key"')
    if callout_end == -1:
        raise SystemExit("Could not locate insertion point in list.html")
    html = html[:callout_end] + block + html[callout_end:]

    LIST_FILE.write_text(html, encoding="utf-8")
    mapped = sum(1 for n in nodes if n["id"] in by_node)
    print(f"Updated {LIST_FILE.relative_to(ROOT)} ({mapped}/{len(nodes)} topics with lesson links)")


if __name__ == "__main__":
    main()
