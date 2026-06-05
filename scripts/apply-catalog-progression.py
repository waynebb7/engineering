#!/usr/bin/env python3
"""Inject Pre-requisites sections before Next topics on catalog topic pages."""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROGRESSION_FILE = ROOT / "scripts" / "topic-progression.json"

PREREQ_CARD_MARKER = "progression-card prerequisites-card"

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
    if "Prerequisites" in section:
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
        return f"quantum learning path — study before advancing"
    if "Physics" in section:
        return f"physics background from {section_blurb(section)}"
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
    for cat in catalogs:
        if cat.get("prereq_map"):
            map_href = link(from_href, cat["prereq_map"])
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


def remove_existing_prereq_cards(html: str) -> str:
    html = re.sub(
        rf'\s*<div class="card {re.escape(PREREQ_CARD_MARKER)}">.*?</div>\s*',
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
        r'\s*<div class="callout">\s*<strong>Prerequisites?:</strong>.*?</div>\s*',
        "\n",
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    return html


def insert_prereq_before_next_topics(html: str, prereq_card: str) -> str:
    if PREREQ_CARD_MARKER in html:
        return html

    match = NEXT_TOPICS_CARD_RE.search(html)
    if not match:
        footer = re.search(r'(\s*<p class="page-footer-note">)', html)
        if footer:
            return html[: footer.start()] + "\n" + prereq_card + html[footer.start() :]
        return html + "\n" + prereq_card

    next_block = match.group(0)
    next_num = int(match.group(1)) if match.group(1) else None

    if next_num:
        prereq_card = re.sub(
            r"<h2>.*?</h2>",
            f"<h2>{next_num}) Pre-requisites</h2>",
            prereq_card,
            count=1,
            flags=re.DOTALL,
        )
        updated_next = re.sub(
            r"<h2>\d+\)\s*Next topics</h2>",
            f"<h2>{next_num + 1}) Next topics</h2>",
            next_block,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        updated_next = next_block

    return html[: match.start()] + prereq_card + "\n" + updated_next + html[match.end() :]


def patch_file(path: Path, href: str, entry: dict, progression: dict) -> bool:
    if not path.exists():
        print(f"  MISSING {href}")
        return False
    html = path.read_text(encoding="utf-8")
    if 'class="content-page"' not in html and "content-body" not in html:
        print(f"  SKIP (no content-page) {href}")
        return False

    match = NEXT_TOPICS_CARD_RE.search(html)
    heading_number = int(match.group(1)) if match and match.group(1) else None

    html = remove_existing_prereq_cards(html)
    prereq = build_prereq_card(href, entry, progression, heading_number)
    html = insert_prereq_before_next_topics(html, prereq)

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
