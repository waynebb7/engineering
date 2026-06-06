#!/usr/bin/env python3
"""Inject expandable topic review keys on teaching pages (content-page)."""
from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CONTENT_KEY_RE = re.compile(
    r'\s*<details class="content-key"[^>]*>.*?</details>\s*',
    re.DOTALL | re.IGNORECASE,
)

CARD_RE = re.compile(
    r'<div class="card(?:\s+[^"]*)?">(.*?)</div>',
    re.DOTALL | re.IGNORECASE,
)
H2_RE = re.compile(r"<h2>(.*?)</h2>", re.DOTALL | re.IGNORECASE)
H3_RE = re.compile(r"<h3>(.*?)</h3>", re.DOTALL | re.IGNORECASE)
STRONG_RE = re.compile(r"<strong>(.*?)</strong>", re.DOTALL | re.IGNORECASE)
CODE_RE = re.compile(r"<code>(.*?)</code>", re.DOTALL | re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")
MATH_INLINE_RE = re.compile(r"\\\((.+?)\\\)", re.DOTALL)
MATH_BLOCK_RE = re.compile(r"\\\[(.+?)\\\]", re.DOTALL)
DOLLAR_INLINE_RE = re.compile(r"(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)", re.DOTALL)
DOLLAR_BLOCK_RE = re.compile(r"\$\$(.+?)\$\$", re.DOTALL)

SKIP_TERMS = {
    "example",
    "note",
    "warning",
    "important",
    "key idea",
    "worked example",
    "learning anchor",
    "success criteria",
    "exam trap",
    "common exam trap",
    "calculation strategy",
    "method step",
    "why it improves marks",
    "question prompt",
    "worked answer",
    "high-value habits",
    "communication quality",
    "define terms",
    "prerequisites",
    "next topics",
    "recommended next",
    "parallel options",
    "go deeper",
    "catalog navigation",
    "show answers",
    "quick quiz",
    "quick knowledge check",
    "revision habit",
    "banding risk",
    "reliability checklist",
    "start",
    "stop",
    "push",
    "pull",
    "arrow",
    "balanced",
    "speed up",
    "slow down",
    "change direction",
    "change shape",
}

TEMPLATE_SECTIONS = {
    "big picture and core ideas",
    "vocabulary precision and concept mapping",
    "equations, rearrangement, and unit discipline",
    "worked numerical examples with units",
    "required practical focus",
    "exam technique and command words",
    "misconceptions and synoptic links",
    "quiz (6 questions)",
    "quick knowledge check",
    "high-value habits",
    "communication quality",
    "define terms",
    "success criteria",
}

SKIP_ACRONYMS = {
    "THE", "AND", "FOR", "NOT", "ARE", "BUT", "YOU", "ALL", "ANY", "ONE", "TWO",
    "USE", "CAN", "HAS", "HAD", "WAS", "ITS", "OUR", "WHO", "HOW", "WHY", "NEW",
    "OLD", "BIG", "TOP", "LOW", "HIGH", "TRUE", "FALSE", "HTML", "HTTP", "HREF",
    "SRC", "CSS", "JS", "UK", "US", "EE", "EK",
}

ACRONYM_GLOSSARY: dict[str, str] = {
    "KS2": "Key Stage 2 — primary school years 3–6 (ages 7–11) in England.",
    "KS3": "Key Stage 3 — lower secondary years 7–9 (ages 11–14).",
    "GCSE": "General Certificate of Secondary Education — qualifications typically taken at age 16.",
    "A-Level": "Advanced Level qualifications — typically ages 16–18 in England.",
    "BSc": "Bachelor of Science undergraduate degree.",
    "MSc": "Master of Science postgraduate degree.",
    "PhD": "Doctor of Philosophy — research doctorate.",
    "SI": "International System of Units (m, kg, s, A, K, mol, cd).",
    "AC": "Alternating current — current that reverses direction periodically.",
    "DC": "Direct current — current flowing in one direction.",
    "EM": "Electromagnetism — unified theory of electric and magnetic fields.",
    "EMF": "Electromotive force — energy per unit charge driving current in a circuit.",
    "RF": "Radio frequency — electromagnetic signals used in communications and radar.",
    "SHM": "Simple harmonic motion — oscillation where restoring force is proportional to displacement.",
    "QM": "Quantum mechanics — physics of atomic and subatomic systems.",
    "QFT": "Quantum field theory — relativistic quantum framework for particles and fields.",
    "NISQ": "Noisy Intermediate-Scale Quantum — devices with limited qubits and significant noise.",
    "QKD": "Quantum key distribution — secure key exchange using quantum states.",
    "QAOA": "Quantum Approximate Optimization Algorithm — hybrid quantum-classical optimizer.",
    "VQE": "Variational Quantum Eigensolver — algorithm for estimating ground-state energies.",
    "PDE": "Partial differential equation — equation involving partial derivatives.",
    "ODE": "Ordinary differential equation — equation involving derivatives of one variable.",
    "FFT": "Fast Fourier Transform — efficient algorithm for frequency analysis.",
    "CFD": "Computational fluid dynamics — numerical simulation of fluid flow.",
    "MHD": "Magnetohydrodynamics — study of conducting fluids coupled to magnetic fields.",
    "AMO": "Atomic, molecular, and optical physics.",
    "LHC": "Large Hadron Collider — high-energy particle accelerator at CERN.",
    "CERN": "European laboratory for particle physics research.",
    "GPS": "Global Positioning System — satellite navigation using precise timing.",
    "TRU": "Transformer rectifier unit — aircraft power conversion equipment.",
    "FSM": "Finite state machine — model of sequential digital logic states and transitions.",
    "K-map": "Karnaugh map — graphical method for Boolean logic minimization.",
    "NAND": "NOT-AND logic gate — universal gate in digital electronics.",
    "NOR": "NOT-OR logic gate — universal gate in digital electronics.",
    "XOR": "Exclusive OR — logic output true when inputs differ.",
    "ASCII": "American Standard Code for Information Interchange — character encoding.",
    "AES": "Advanced Encryption Standard — widely used symmetric encryption.",
    "RSA": "Rivest–Shamir–Adleman — public-key cryptography algorithm.",
    "UV": "Ultraviolet radiation — electromagnetic radiation shorter than visible light.",
    "IR": "Infrared radiation — electromagnetic radiation longer than visible light.",
}

FORMULA_HINTS: dict[str, str] = {
    "speed": "Rate of distance travelled per unit time.",
    "velocity": "Rate of change of displacement; includes direction.",
    "acceleration": "Rate of change of velocity.",
    "displacement": "Change in position from start to finish, including direction.",
    "distance": "Total path length travelled (scalar).",
    "force": "Push or pull that can change motion or shape.",
    "weight": "Gravitational force on an object (often W = mg).",
    "mass": "Quantity of matter in an object (kg).",
    "energy": "Capacity to do work or cause heating.",
    "power": "Rate of energy transfer (energy per unit time).",
    "pressure": "Force per unit area.",
    "density": "Mass per unit volume.",
    "current": "Rate of flow of electric charge.",
    "voltage": "Energy transferred per unit charge (potential difference).",
    "resistance": "Opposition to electric current.",
}


def strip_tags(text: str) -> str:
    text = re.sub(r"</(p|li|h[1-6]|div|tr)>", "\n", text, flags=re.I)
    text = TAG_RE.sub(" ", text)
    text = html.unescape(text)
    text = re.sub(r"^>+\s*", "", text, flags=re.M)
    return re.sub(r"[ \t]+", " ", text).strip()


def normalize_term(term: str) -> str:
    term = strip_tags(term)
    term = re.sub(r"^\d+\)\s*", "", term)
    return term.strip(" :—-.")


def is_skip_term(term: str) -> bool:
    low = term.lower().strip()
    if not low or len(low) < 2:
        return True
    if low in SKIP_TERMS or low in TEMPLATE_SECTIONS:
        return True
    if len(low) <= 2 and low.isalpha():
        return True
    if low.startswith("http"):
        return True
    if re.fullmatch(r"[a-z]+", low) and low in {"and", "the", "for", "with", "from", "that", "this"}:
        return True
    return False


def is_template_section(title: str) -> bool:
    return normalize_term(title).lower() in TEMPLATE_SECTIONS


def is_poor_term(term: str) -> bool:
    low = term.lower()
    if term.endswith("?"):
        return True
    if low.startswith(
        (
            "experiment ",
            "ks2 to ks3 guide",
            "gcse guide",
            "a-level guide",
            "and ",
            "how ",
            "or ",
            "describing ",
            "simple ",
            "friction is ",
        )
    ):
        return True
    if "guide." in low:
        return True
    if len(term.split()) > 6:
        return True
    return False


def clean_definition(defn: str) -> str:
    defn = strip_tags(defn)
    defn = re.sub(r"^\d+\)\s*", "", defn)
    defn = re.sub(r"\s+", " ", defn).strip()
    sents = sentences(defn)
    if sents:
        sent = sents[0]
        if sent.lower().startswith(defn[:20].lower().split()[0] if defn else ""):
            # Drop heading echo; prefer the next sentence when present.
            if len(sents) > 1:
                return sents[1]
        return sent
    return defn[:220] + ("..." if len(defn) > 220 else "")


def is_key_formula(raw: str) -> bool:
    raw = raw.strip()
    if len(raw) < 4:
        return False
    if len(raw) > 100:
        return False
    if re.search(r"\d{2,}", raw):
        return False
    if re.search(r"\d+x", raw, re.I):
        return False
    if re.search(r"=\s*[1-9]", raw):
        return False
    if re.search(r"y\s*=\s*(?:u\^|x)", raw, re.I):
        return False
    if raw.count("=") > 2:
        return False
    if "=" in raw:
        return True
    if any(sym in raw for sym in ("×", "∝", "→", "±")):
        return True
    return False


def formula_hint(term: str) -> str | None:
    low = term.lower()
    for key, hint in FORMULA_HINTS.items():
        if low == key or low == f"{key}s":
            return hint
    return None


def sentences(text: str) -> list[str]:
    text = strip_tags(text)
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if len(p.strip()) > 15]


def guess_definition(term: str, scope: str) -> str:
    plain = strip_tags(scope)
    term_esc = re.escape(term)
    patterns = [
        rf"\b{term_esc}\b\s+is\s+([^.!?]+[.!?])",
        rf"\b{term_esc}\b\s+are\s+([^.!?]+[.!?])",
        rf"\b{term_esc}\b\s+means\s+([^.!?]+[.!?])",
        rf"\b{term_esc}\b\s+refers to\s+([^.!?]+[.!?])",
        rf"\b{term_esc}\b\s*:\s*([^.!?]+[.!?])",
        rf"\b{term_esc}\b\s+—\s*([^.!?]+[.!?])",
        rf"A\s+{term_esc}\b\s+is\s+([^.!?]+[.!?])",
        rf"The\s+{term_esc}\b\s+is\s+([^.!?]+[.!?])",
    ]
    for pat in patterns:
        m = re.search(pat, plain, re.IGNORECASE)
        if m:
            definition = m.group(1).strip()
            if 10 < len(definition) < 200:
                return definition

    for sentence in sentences(scope):
        if re.search(rf"\b{term_esc}\b", sentence, re.I):
            if 20 < len(sentence) < 220:
                return sentence

    hint = formula_hint(term)
    if hint:
        return hint

    if term.upper() in ACRONYM_GLOSSARY:
        return ACRONYM_GLOSSARY[term.upper()]

    return "Introduced and explained in the sections below."


def first_paragraph(card_html: str) -> str:
    m = re.search(r"<p[^>]*>(.*?)</p>", card_html, re.DOTALL | re.IGNORECASE)
    return m.group(1) if m else card_html


def first_paragraph_after_h2(card_html: str, h2_match: re.Match[str]) -> str:
    tail = card_html[h2_match.end() :]
    m = re.search(r"<p[^>]*>(.*?)</p>", tail, re.DOTALL | re.IGNORECASE)
    return m.group(1) if m else ""


def text_after_heading(card_html: str, heading: str) -> str:
    idx = card_html.lower().find(f">{heading.lower()}<")
    if idx == -1:
        return card_html
    tail = card_html[idx:]
    m = re.search(r"<p[^>]*class=\"mini\"[^>]*>(.*?)</p>", tail, re.DOTALL | re.I)
    if m:
        return m.group(1)
    m = re.search(r"<p[^>]*>(.*?)</p>", tail, re.DOTALL | re.I)
    return m.group(1) if m else tail


def get_teaching_cards(page_html: str) -> list[str]:
    body_match = re.search(
        r'<div class="content-body">(.*)</div>\s*</div>\s*</body>',
        page_html,
        re.DOTALL | re.IGNORECASE,
    )
    if not body_match:
        return []
    chunk = body_match.group(1)
    chunk = CONTENT_KEY_RE.sub(" ", chunk)
    cards = []
    for m in CARD_RE.finditer(chunk):
        card = m.group(0)
        if any(x in card for x in ("progression-card", "prerequisites-card", "next-topics-card")):
            continue
        if re.search(r"quick\s+(?:knowledge\s+check|quiz)", card, re.I):
            continue
        cards.append(m.group(1))
    return cards


def extract_hero_terms(page_html: str) -> list[tuple[str, str]]:
    found: dict[str, tuple[str, str]] = {}
    hero = re.search(
        r'<div class="content-hero">(.*?)</div>\s*<div class="content-body">',
        page_html,
        re.DOTALL | re.IGNORECASE,
    )
    if not hero:
        return []
    hero_html = hero.group(1)
    desc = re.search(r"<p>(.*?)</p>", hero_html, re.DOTALL | re.I)
    if not desc:
        return []
    text = strip_tags(desc.group(1))
    text = re.sub(
        r"^(?:KS2 to KS3|GCSE|A-Level|Undergraduate|Postgraduate|Applied physics|"
        r"Frontier research|Critical review|Quantum)\s+guide\.\s*",
        "",
        text,
        flags=re.I,
    )
    phrases: list[str] = []
    for segment in text.split(","):
        segment = segment.strip()
        if not segment:
            continue
        if " and " in segment:
            left, right = segment.rsplit(" and ", 1)
            if left.strip():
                phrases.append(left.strip())
            phrases.append(right.strip())
        else:
            phrases.append(segment)
    for phrase in phrases:
        phrase = normalize_term(phrase)
        if is_skip_term(phrase) or is_poor_term(phrase):
            continue
        if len(phrase) < 3 or len(phrase.split()) > 5:
            continue
        key = phrase.lower()
        if key not in found:
            found[key] = (phrase, guess_definition(phrase, page_html))
    return list(found.values())


def extract_formulae(cards: list[str]) -> list[tuple[str, str]]:
    text = "\n".join(cards)
    found: dict[str, str] = {}
    for regex in (MATH_BLOCK_RE, DOLLAR_BLOCK_RE):
        for m in regex.finditer(text):
            raw = strip_tags(m.group(1))
            if not is_key_formula(raw):
                continue
            key = raw if len(raw) <= 80 else raw[:77] + "..."
            if key not in found:
                lhs = raw.split("=")[0].strip().split()
                hint = formula_hint(lhs[-1]) if lhs else None
                found[key] = hint or "Key relationship used in this topic."

    for m in DOLLAR_INLINE_RE.finditer(text):
        raw = strip_tags(m.group(1))
        if not is_key_formula(raw):
            continue
        key = raw if len(raw) <= 80 else raw[:77] + "..."
        if key not in found:
            lhs = raw.split("=")[0].strip().split()
            hint = formula_hint(lhs[-1]) if lhs else None
            found[key] = hint or "Key relationship used in this topic."

    for m in MATH_INLINE_RE.finditer(text):
        raw = strip_tags(m.group(1))
        if not is_key_formula(raw):
            continue
        key = raw if len(raw) <= 80 else raw[:77] + "..."
        if key not in found:
            lhs = raw.split("=")[0].strip().split()
            hint = formula_hint(lhs[-1]) if lhs else None
            found[key] = hint or "Key relationship used in this topic."

    for m in CODE_RE.finditer(text):
        raw = strip_tags(m.group(1))
        if not is_key_formula(raw):
            continue
        if raw not in found:
            lhs_parts = raw.split("=")[0].strip().split()
            lhs = lhs_parts[-1] if lhs_parts else raw
            definition = formula_hint(lhs) or guess_definition(lhs, text)
            if definition.strip().rstrip(".") == raw.strip().rstrip("."):
                definition = "Relationship used in this topic."
            found[raw] = definition

    for m in re.finditer(
        r"<div class=\"callout\">.*?<strong>([^<:]+):</strong>\s*([^<]+)",
        text,
        re.DOTALL | re.IGNORECASE,
    ):
        label = strip_tags(m.group(1)).lower()
        if any(k in label for k in ("equation", "formula", "key equation", "si form")):
            body = strip_tags(m.group(2))
            if body and body not in found:
                found[body] = body if len(body) < 120 else "Key relationship highlighted in the lesson."

    return sorted(found.items(), key=lambda x: x[0].lower())


def extract_acronyms(cards: list[str], page_html: str) -> list[tuple[str, str]]:
    plain = strip_tags("\n".join(cards))
    found: dict[str, str] = {}

    for acr, definition in ACRONYM_GLOSSARY.items():
        if re.search(rf"\b{re.escape(acr)}\b", plain):
            found[acr] = definition

    for m in re.finditer(r"\b[A-Z][A-Z0-9]{1,5}(?:-[A-Z0-9]+)?\b", plain):
        acr = m.group(0)
        if acr in SKIP_ACRONYMS or acr in found:
            continue
        found[acr] = guess_definition(acr, plain)

    return sorted(found.items(), key=lambda x: x[0])


def definition_quality(defn: str, term: str) -> int:
    score = max(0, 180 - len(defn))
    low = defn.lower()
    if low.startswith(term.lower()):
        score -= 40
    if "introduced and explained" in low:
        score -= 20
    if term.lower() in low and "(" in defn:
        score -= 10
    return score


def add_term(found: dict[str, tuple[str, str]], term: str, definition: str) -> None:
    term = normalize_term(term)
    if is_skip_term(term) or is_template_section(term) or is_poor_term(term):
        return
    definition = clean_definition(definition)
    if len(definition) > 240:
        definition = definition[:237] + "..."
    key = term.lower()
    if key not in found or definition_quality(definition, term) > definition_quality(
        found[key][1], term
    ):
        found[key] = (term, definition)


def extract_terms(cards: list[str], page_html: str) -> list[tuple[str, str]]:
    found: dict[str, tuple[str, str]] = {}

    for card in cards:
        li_defined: set[str] = set()
        for m in re.finditer(
            r"<li>\s*<strong>(.*?)</strong>\s*\(([^)]+)\)",
            card,
            re.DOTALL | re.IGNORECASE,
        ):
            term = normalize_term(m.group(1))
            definition = strip_tags(m.group(2))
            if definition and not definition.endswith("."):
                definition += "."
            add_term(found, term, definition)
            li_defined.add(term.lower())

        for m in H2_RE.finditer(card):
            title = normalize_term(m.group(1))
            if is_skip_term(title) or is_template_section(title) or is_poor_term(title):
                continue
            scoped = sentences(first_paragraph_after_h2(card, m))
            definition = guess_definition(title, card)
            if definition.startswith("Introduced and explained") and scoped:
                definition = scoped[0]
            add_term(found, title, definition)

        for m in H3_RE.finditer(card):
            title = normalize_term(m.group(1))
            if is_skip_term(title) or is_template_section(title):
                continue
            scope = text_after_heading(card, title)
            scoped = sentences(scope)
            definition = scoped[0] if scoped else guess_definition(title, scope)
            add_term(found, title, definition)

        for m in re.finditer(
            r"<(?:p|div class=\"callout\"|div class=\"warning\")[^>]*>(.*?)</(?:p|div)>",
            card,
            re.DOTALL | re.IGNORECASE,
        ):
            block = m.group(1)
            if "<li>" in block:
                continue
            for sm in STRONG_RE.finditer(block):
                term = normalize_term(sm.group(1))
                if term.lower().endswith(":") or "?" in term:
                    continue
                if term.lower() in li_defined:
                    continue
                add_term(found, term, guess_definition(term, block))

        for m in re.finditer(r"<th>(.*?)</th>", card, re.DOTALL | re.IGNORECASE):
            term = normalize_term(m.group(1))
            add_term(found, term, guess_definition(term, card))

        for m in re.finditer(r"misconception is:\s*([^.<]+)", card, re.I):
            statement = strip_tags(m.group(1))
            if statement:
                add_term(found, "Common misconception", statement.strip() + ".")

        for m in re.finditer(
            r"<strong>([^<]+):</strong>\s*([^<]{10,200})",
            card,
            re.DOTALL | re.IGNORECASE,
        ):
            label = normalize_term(m.group(1)).lower()
            if label in SKIP_TERMS or label in {"learning anchor", "calculation strategy"}:
                body = strip_tags(m.group(2))
                for sm in STRONG_RE.finditer(m.group(2)):
                    term = normalize_term(sm.group(1))
                    add_term(found, term, guess_definition(term, body))
                continue
            if label in {"common exam trap", "key idea"}:
                body = strip_tags(m.group(2))
                add_term(found, label.title(), body)

        for m in re.finditer(r"<li>(.*?)</li>", card, re.DOTALL | re.IGNORECASE):
            li = m.group(1)
            if "<code>" in li and "=" not in strip_tags(li):
                continue
            plain_li = strip_tags(li)
            if "=" in plain_li and len(plain_li) < 12:
                continue
            if len(plain_li) > 25 and not plain_li.startswith("State "):
                for sm in STRONG_RE.finditer(li):
                    term = normalize_term(sm.group(1))
                    add_term(found, term, guess_definition(term, li))

    # Drop near-duplicate shorter terms when a longer term contains them
    items = sorted(found.values(), key=lambda x: x[0].lower())
    pruned: list[tuple[str, str]] = []
    for term, definition in items:
        low = term.lower()
        if any(low != other.lower() and low in other.lower() for other, _ in pruned):
            continue
        pruned.append((term, definition))
    return pruned


def build_section(title: str, items: list[tuple[str, str]]) -> str:
    if not items:
        return ""
    rows = []
    for name, definition in items:
        rows.append(
            f'        <div class="content-key__item">'
            f'<dt>{html.escape(name)}</dt>'
            f"<dd>{html.escape(definition)}</dd></div>"
        )
    return (
        f'      <h3 class="content-key__heading">{html.escape(title)}</h3>\n'
        f'      <dl class="content-key__list">\n'
        + "\n".join(rows)
        + "\n      </dl>\n"
    )


def build_content_key(
    formulae: list[tuple[str, str]],
    acronyms: list[tuple[str, str]],
    terms: list[tuple[str, str]],
) -> str | None:
    if not formulae and not acronyms and not terms:
        return None

    body = (
        '      <p class="content-key__intro">'
        "Expand this review key before you read, then use it afterwards to check you can "
        "explain each formula, acronym, and term without looking at the lesson."
        "</p>\n"
    )
    body += build_section("Formulae & relationships", formulae[:20])
    body += build_section("Acronyms & symbols", acronyms[:24])
    body += build_section("Key terms & phrases", terms[:35])

    return (
        f'    <details class="content-key" id="topic-review-key">\n'
        f'      <summary class="content-key__summary">Topic review key — formulae, terms &amp; acronyms</summary>\n'
        f'      <div class="content-key__body">\n'
        f"{body}"
        f"      </div>\n"
        f"    </details>\n"
    )


def inject_key(page_html: str, key_html: str) -> str:
    page_html = CONTENT_KEY_RE.sub("\n", page_html)
    marker = '<div class="content-body">'
    idx = page_html.find(marker)
    if idx == -1:
        return page_html
    insert_at = idx + len(marker)
    return page_html[:insert_at] + "\n\n" + key_html + page_html[insert_at:]


def should_process(path: Path, html_text: str) -> bool:
    if 'class="content-page"' not in html_text and "content-page" not in html_text:
        return False
    return "content-body" in html_text


def process_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if not should_process(path, text):
        return False

    cards = get_teaching_cards(text)
    if not cards:
        return False

    formulae = extract_formulae(cards)
    acronyms = extract_acronyms(cards, text)
    terms = extract_terms(cards, text)
    key = build_content_key(formulae, acronyms, terms)
    if not key:
        return False

    new_text = inject_key(text, key)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        return True
    return False


def main() -> None:
    updated = 0
    skipped = 0
    for path in sorted(ROOT.rglob("*.html")):
        if any(part.startswith(".") for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        if not should_process(path, text):
            skipped += 1
            continue
        if process_file(path):
            updated += 1

    print(f"Content keys added/updated: {updated}, skipped: {skipped}")


if __name__ == "__main__":
    main()
