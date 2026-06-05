#!/usr/bin/env python3
"""Build prerequisite and next-topic progression from catalog HTML files."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CATALOGS = {
    "math": {
        "file": "pure_math_subjects.html",
        "catalog_href": "pure_math_subjects.html",
        "prereq_map": "math/math-prereq-map.html",
        "label": "Mathematics",
    },
    "physics": {
        "file": "physics_subjects.html",
        "catalog_href": "physics_subjects.html",
        "prereq_map": "physics_subjects_drill_down/physics-prereq-map.html",
        "label": "Physics",
    },
    "quantum": {
        "file": "quantum_subjects.html",
        "catalog_href": "quantum_subjects.html",
        "prereq_map": None,
        "label": "Quantum",
    },
}

# Extra cross-topic dependencies (href -> list of href prereqs)
EXTRA_PREREQS = {
    "equations.html": [
        "variables.html",
        "powers.html",
        "orders-of-operations.html",
        "fractions.html",
    ],
    "variables.html": ["powers.html", "negative-numbers.html", "orders-of-operations.html"],
    "functions.html": ["equations.html", "variables.html", "mappings.html"],
    "calculus.html": ["elementary-algebra.html", "functions.html", "trigonometry.html"],
    "differentiation.html": ["calculus.html", "limits.html"],
    "integration.html": ["differentiation.html"],
    "matrices.html": ["vectors.html", "elementary-algebra.html"],
    "linear-transformations.html": ["matrices.html", "vector-spaces.html"],
    "hilbert-spaces.html": ["vector-spaces.html", "linear-transformations.html"],
    "complex-numbers.html": ["elementary-algebra.html", "trigonometry.html"],
    "quantum/wave-particle-duality.html": ["vectors.html", "complex-numbers.html"],
    "quantum/dirac-notation.html": ["quantum/superposition-and-measurement.html", "linear-transformations.html"],
    "quantum/qubits-and-bloch-sphere.html": ["quantum/dirac-notation.html", "complex-numbers.html"],
    "quantum/grovers-algorithm.html": ["quantum/quantum-gates.html", "quantum/quantum-circuits.html"],
    "quantum/shors-algorithm.html": ["quantum/quantum-fourier-transform.html"],
    "quantum-physics-intro.html": ["waves-a-level.html", "mathematical-methods-physics.html"],
    "quantum-mechanics-1.html": ["quantum-physics-intro.html", "hilbert-spaces.html"],
    "classical-mechanics.html": ["mechanics-a-level.html", "vectors-in-physics.html"],
    "logic_and_digital_math/logic-gates.html": [
        "logic_and_digital_math/boolean-algebra.html",
        "logic_and_digital_math/truth-tables.html",
    ],
}

# Overview / hub pages — different next-topic shape
OVERVIEW_PAGES = {
    "millennium-prize-problems.html",
    "logic_and_digital_math/digital_math_classification.html",
    "quantum/quantum-algorithms-overview.html",
}

LINK_RE = re.compile(
    r'<li>\s*<a\s+href="([^"]+\.html)">([^<]+)</a>\s*</li>',
    re.IGNORECASE,
)
SECTION_RE = re.compile(r"<section>(.*?)</section>", re.DOTALL | re.IGNORECASE)
H2_RE = re.compile(r"<h2>(.*?)</h2>", re.DOTALL | re.IGNORECASE)


def normalize_href(href: str) -> str:
    return href.replace("\\", "/").lstrip("./")


def parse_catalog(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    sections = []
    for block in SECTION_RE.findall(text):
        h2 = H2_RE.search(block)
        if not h2:
            continue
        title = re.sub(r"<[^>]+>", "", h2.group(1)).strip()
        topics = []
        for href, link_title in LINK_RE.findall(block):
            topics.append(
                {
                    "href": normalize_href(href),
                    "title": link_title.strip(),
                }
            )
        if topics:
            sections.append({"section": title, "topics": topics})
    return sections


def resolve_href(from_href: str, to_href: str) -> str:
    """Relative link from from_href's directory to to_href."""
    from_path = Path(from_href)
    to_path = Path(to_href)
    return Path(
        os_path_relpath(from_path.parent, to_path)
    ).as_posix()


def os_path_relpath(from_dir: Path, to_path: Path) -> str:
    # manual relpath for posix-style web paths
    from_parts = from_dir.parts if str(from_dir) != "." else ()
    to_parts = to_path.parts
    # find common prefix
    common = 0
    for a, b in zip(from_parts, to_parts):
        if a != b:
            break
        common += 1
    ups = [".."] * (len(from_parts) - common)
    return "/".join(ups + list(to_parts[common:]))


def dedupe_keep_order(items: list[str]) -> list[str]:
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def build_progression() -> dict:
    all_topics: dict[str, dict] = {}

    for cat_key, meta in CATALOGS.items():
        sections = parse_catalog(ROOT / meta["file"])
        flat = [t for s in sections for t in s["topics"]]

        for si, sec in enumerate(sections):
            prev_section_last = None
            if si > 0:
                prev_section_last = sections[si - 1]["topics"][-1]["href"]

            next_section_first = None
            if si + 1 < len(sections):
                next_section_first = sections[si + 1]["topics"][0]["href"]

            for ti, topic in enumerate(sec["topics"]):
                href = topic["href"]
                entry = all_topics.setdefault(
                    href,
                    {
                        "title": topic["title"],
                        "catalogs": [],
                        "prereqs": [],
                        "next_required": [],
                        "next_parallel": [],
                        "next_deeper": [],
                        "section": sec["section"],
                    },
                )
                entry["title"] = topic["title"]
                entry["catalogs"].append(
                    {
                        "key": cat_key,
                        "section": sec["section"],
                        "catalog_href": meta["catalog_href"],
                        "prereq_map": meta["prereq_map"],
                        "label": meta["label"],
                    }
                )

                immediate_prev = sec["topics"][ti - 1]["href"] if ti > 0 else None
                immediate_next = (
                    sec["topics"][ti + 1]["href"] if ti + 1 < len(sec["topics"]) else None
                )

                prereq_candidates = []
                if immediate_prev:
                    prereq_candidates.append(immediate_prev)
                    if ti > 1:
                        prereq_candidates.append(sec["topics"][ti - 2]["href"])
                elif prev_section_last:
                    prereq_candidates.append(prev_section_last)

                if href in EXTRA_PREREQS:
                    prereq_candidates = EXTRA_PREREQS[href] + prereq_candidates

                entry["prereqs"] = dedupe_keep_order(
                    entry["prereqs"] + prereq_candidates
                )[:6]

                next_req = []
                if immediate_next:
                    next_req.append(immediate_next)
                elif next_section_first:
                    next_req.append(next_section_first)
                entry["next_required"] = dedupe_keep_order(
                    entry["next_required"] + next_req
                )[:3]

                parallel = []
                if immediate_next and ti + 2 < len(sec["topics"]):
                    parallel.append(sec["topics"][ti + 2]["href"])
                if next_section_first and immediate_next is None:
                    if si + 1 < len(sections) and len(sections[si + 1]["topics"]) > 1:
                        parallel.append(sections[si + 1]["topics"][1]["href"])
                entry["next_parallel"] = dedupe_keep_order(
                    entry["next_parallel"] + parallel
                )[:3]

                # deeper = later in overall flat list
                try:
                    idx = next(i for i, t in enumerate(flat) if t["href"] == href)
                    deeper = [flat[j]["href"] for j in range(idx + 3, min(idx + 6, len(flat)))]
                    entry["next_deeper"] = dedupe_keep_order(
                        entry["next_deeper"] + deeper
                    )[:3]
                except StopIteration:
                    pass

    return all_topics


def main():
    progression = build_progression()
    out = ROOT / "scripts" / "topic-progression.json"
    out.write_text(json.dumps(progression, indent=2), encoding="utf-8")
    print(f"Wrote {len(progression)} topics to {out}")


if __name__ == "__main__":
    main()
