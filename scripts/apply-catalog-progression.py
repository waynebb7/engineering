#!/usr/bin/env python3
"""Inject Pre-requisites and Next topics sections on catalog topic pages."""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROGRESSION_FILE = ROOT / "scripts" / "topic-progression.json"
NODE_PAGES_FILE = ROOT / "maps" / "prereq-node-pages.json"

PREREQ_CARD_MARKER = "progression-card prerequisites-card"
NEXT_CARD_MARKER = "progression-card next-topics-card"

CATALOG_LINKS = {
    "math": ("learn/mathematics/index.html", "Mathematics Catalog"),
    "physics": ("learn/physics/index.html", "Physics Catalog"),
    "quantum": ("learn/quantum/index.html", "Quantum Catalog"),
}

NEXT_TOPICS_CARD_RE = re.compile(
    r'<div class="card(?:\s+[^"]*)?">\s*<h2>(?:(\d+)\)\s*)?Next topics</h2>.*?</div>',
    re.DOTALL | re.IGNORECASE,
)


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


def link(from_href: str, to_href: str) -> str:
    return os_path_relpath(Path(from_href).parent, Path(to_href))


def escape_html(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def section_blurb(section: str) -> str:
    if not section:
        return "earlier material in the learning path"
    if " - " in section:
        return section.split(" - ", 1)[1].strip().lower()
    return section.lower()


def prereq_description(p_entry: dict) -> str:
    section = p_entry.get("section", "")
    title = p_entry.get("title", "this topic")
    if section == "Prerequisites":
        return "mathematical tool needed before quantum topics"
    if "KS2" in section or "KS3" in section or "Primary" in section:
        return f"foundational skills that support {title.lower()}"
    if "GCSE" in section:
        return f"GCSE-level background for {title.lower()}"
    if "A-Level" in section:
        return f"A-Level preparation relevant to this topic"
    if "Undergraduate" in section or "BSc" in section:
        return f"undergraduate background from {section_blurb(section)}"
    if "Postgraduate" in section or "Research" in section or "PhD" in section:
        return f"advanced background from {section_blurb(section)}"
    if "Quantum" in section:
        return "quantum learning path — study before advancing"
    if "Physics" in section:
        return f"physics background from {section_blurb(section)}"
    if "Logic" in section or "Digital" in section:
        return "digital logic pathway — review before advancing"
    return f"study before this topic — from {section_blurb(section)}"


def build_prereq_card(
    from_href: str, entry: dict, progression: dict, heading_number: int | None
) -> str:
    prereqs = entry.get("prereqs", [])
    catalogs = entry.get("catalogs", [])

    if heading_number:
        heading = f"<h2>{heading_number}) Pre-requisites</h2>"
    else:
        heading = "<h2>Pre-requisites</h2>"

    map_link = ""
    page_maps = json.loads(NODE_PAGES_FILE.read_text(encoding="utf-8")) if NODE_PAGES_FILE.exists() else {}
    by_page = page_maps.get("byPage", {})
    for cat in catalogs:
        if cat.get("prereq_map"):
            map_href = link(from_href, cat["prereq_map"])
            cat_key = cat.get("key") or ""
            node_id = (by_page.get(cat_key) or {}).get(from_href.replace("\\", "/"))
            if node_id:
                map_href += f"?topic={node_id}"
            map_link = (
                f'<p class="mini">See the '
                f'<a href="{map_href}">{escape_html(cat["label"])} prerequisite map</a> '
                f"for the wider dependency graph.</p>"
            )
            break

    if not prereqs:
        items = (
            "        <li><em>No formal prerequisites — this is a starting topic in its section.</em></li>"
        )
    else:
        lines = []
        for p in prereqs:
            p_entry = progression.get(p, {"title": Path(p).stem.replace("-", " ").title()})
            title = p_entry.get("title", Path(p).stem.replace("-", " ").title())
            href = link(from_href, p)
            blurb = prereq_description(p_entry)
            lines.append(
                f'        <li><a href="{href}">{escape_html(title)}</a> — {escape_html(blurb)}</li>'
            )
        items = "\n".join(lines)

    return f"""    <div class="card {PREREQ_CARD_MARKER}">
      {heading}
      <p>If you are struggling with this topic, review these subjects first.</p>
      <ul>
{items}
      </ul>
      {map_link}
    </div>
"""


def build_next_card(
    from_href: str, entry: dict, progression: dict, heading_number: int | None
) -> str:
    if heading_number:
        heading = f"<h2>{heading_number}) Next topics</h2>"
    else:
        heading = "<h2>Next topics</h2>"

    def topic_list(hrefs: list[str]) -> str:
        lines = []
        for h in hrefs:
            t = progression.get(h, {}).get("title", Path(h).stem.replace("-", " ").title())
            lines.append(f'        <li><a href="{link(from_href, h)}">{escape_html(t)}</a></li>')
        return "\n".join(lines)

    required = entry.get("next_required", [])
    parallel = entry.get("next_parallel", [])
    deeper = entry.get("next_deeper", [])

    sections = []
    if required:
        sections.append(
            f"""      <h3>Recommended next</h3>
      <p>Continue in catalog learning order.</p>
      <ul>
{topic_list(required)}
      </ul>"""
        )
    if parallel:
        sections.append(
            f"""      <h3>Parallel options</h3>
      <p>Related topics you can study alongside or instead.</p>
      <ul>
{topic_list(parallel)}
      </ul>"""
        )
    if deeper:
        sections.append(
            f"""      <h3>Go deeper</h3>
      <p>Further topics once you are comfortable with the core material.</p>
      <ul>
{topic_list(deeper)}
      </ul>"""
        )

    cat_lines = []
    seen: set[str] = set()
    for cat in entry.get("catalogs", []):
        key = cat["key"]
        if key in seen:
            continue
        seen.add(key)
        chref, clabel = CATALOG_LINKS[key]
        cat_lines.append(
            f'        <li><a href="{link(from_href, chref)}">{escape_html(clabel)}</a></li>'
        )
    cat_lines.append(
        f'        <li><a href="{link(from_href, "index.html")}">Engineering Knowledge Hub</a></li>'
    )

    body = "\n".join(sections)
    return f"""    <div class="card {NEXT_CARD_MARKER}">
      {heading}
      <p>Keep building your understanding — follow the path or explore branches.</p>
{body}
      <h3>Catalog navigation</h3>
      <ul>
{chr(10).join(cat_lines)}
      </ul>
    </div>
"""


def remove_existing_progression_cards(html: str) -> str:
    # Preserve content-key — only remove progression cards
    html = re.sub(
        rf'\s*<div class="card {re.escape(PREREQ_CARD_MARKER)}">.*?</div>\s*',
        "\n",
        html,
        flags=re.DOTALL,
    )
    html = re.sub(
        rf'\s*<div class="card {re.escape(NEXT_CARD_MARKER)}">.*?</div>\s*',
        "\n",
        html,
        flags=re.DOTALL,
    )
    html = re.sub(
        r'\s*<div class="card">\s*<h2>(?:\d+\)\s*)?Pre-?requisites?</h2>.*?</div>\s*',
        "\n",
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    html = re.sub(
        r'\s*<div class="card(?:\s+[^"]*)?">\s*<h2>(?:\d+\)\s*)?Next topics</h2>.*?</div>\s*',
        "\n",
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    html = re.sub(
        r'\s*<div class="callout">\s*<strong>Prerequisites?:</strong>.*?</div>\s*',
        "\n",
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    return html


def detect_heading_number(html: str) -> int | None:
    m = re.search(r"<h2>(\d+)\)\s*Quick knowledge check</h2>", html, re.I)
    if m:
        return int(m.group(1)) + 1
    match = NEXT_TOPICS_CARD_RE.search(html)
    if match and match.group(1):
        return int(match.group(1)) - 1
    return None


def insert_progression_cards(html: str, prereq_card: str, next_card: str) -> str:
    footer = re.search(r"(\s*<p class=\"page-footer-note\">)", html)
    if footer:
        return html[: footer.start()] + "\n" + prereq_card + "\n" + next_card + html[footer.start() :]
    return html + "\n" + prereq_card + "\n" + next_card


def patch_file(path: Path, href: str, entry: dict, progression: dict) -> bool:
    if not path.exists():
        print(f"  MISSING {href}")
        return False
    html = path.read_text(encoding="utf-8")
    if 'class="content-page"' not in html and "content-body" not in html:
        print(f"  SKIP (no content-page) {href}")
        return False

    heading_number = detect_heading_number(html)
    html = remove_existing_progression_cards(html)

    prereq_num = heading_number
    next_num = heading_number + 1 if heading_number else None

    prereq = build_prereq_card(href, entry, progression, prereq_num)
    nxt = build_next_card(href, entry, progression, next_num)
    html = insert_progression_cards(html, prereq, nxt)

    path.write_text(html, encoding="utf-8")
    return True


def main():
    if not PROGRESSION_FILE.exists():
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "build-topic-progression.py")],
            check=True,
        )

    progression = json.loads(PROGRESSION_FILE.read_text(encoding="utf-8"))
    updated = 0
    missing = 0
    skipped = 0

    for href, entry in sorted(progression.items()):
        path = ROOT / href
        if patch_file(path, href, entry, progression):
            updated += 1
        elif not path.exists():
            missing += 1
        else:
            skipped += 1

    print(f"Updated: {updated}, missing files: {missing}, skipped: {skipped}")


if __name__ == "__main__":
    main()
