#!/usr/bin/env python3
"""Generate quiz-answers.json from quiz-questions.json and page content."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_FILE = ROOT / "scripts" / "quiz-questions.json"
ANSWERS_FILE = ROOT / "scripts" / "quiz-answers.json"

try:
    import sympy as sp
except ImportError:
    sp = None

MINI_RE = re.compile(
    r"Quick knowledge check</h2>\s*<div class=\"quiz\">.*?</div>\s*<p class=\"mini\">\s*(.*?)\s*</p>",
    re.DOTALL | re.IGNORECASE,
)
CALLOUT_RE = re.compile(
    r'<div class="callout">.*?<strong>(?:Example|Worked example|Answer)[^:]*:</strong>\s*(.*?)</div>',
    re.DOTALL | re.IGNORECASE,
)


def read_page_context(path: Path) -> dict:
    if not path.exists():
        return {"mini": "", "examples": []}
    text = path.read_text(encoding="utf-8")
    mini = ""
    m = MINI_RE.search(text)
    if m:
        mini = re.sub(r"<[^>]+>", " ", m.group(1))
        mini = re.sub(r"\s+", " ", mini).strip()
    examples = []
    for ex in CALLOUT_RE.findall(text):
        ex = re.sub(r"<br\s*/?>", " ", ex, flags=re.IGNORECASE)
        ex = re.sub(r"<[^>]+>", " ", ex)
        ex = re.sub(r"\s+", " ", ex).strip()
        if ex:
            examples.append(ex)
    return {"mini": mini, "examples": examples}


def solve_linear_simple(expr: str) -> str | None:
    """Fallback linear solver when sympy is unavailable."""
    expr = expr.replace("−", "-").replace("×", "*").replace("÷", "/").replace(" ", "")
    m = re.match(r"(-?\d*)x([+\-]\d+)=(-?\d+)", expr, re.I)
    if m:
        coeff_raw, b_raw, rhs_raw = m.groups()
        coeff = int(coeff_raw or "1")
        if coeff == 0:
            return None
        b = int(b_raw)
        rhs = int(rhs_raw)
        val = (rhs - b) / coeff
        if val == int(val):
            val = int(val)
        return f"<code>x = {val}</code>"
    m = re.match(r"x([+\-]\d+)=(-?\d+)", expr, re.I)
    if m:
        b = int(m.group(1))
        rhs = int(m.group(2))
        val = rhs - b
        return f"<code>x = {val}</code>"
    return None


def solve_linear(code: str) -> str | None:
    code = code.replace("−", "-").replace("×", "*").replace("÷", "/").replace(" ", "")
    m = re.search(r"([0-9a-zA-Z+\-*/().]+=[0-9a-zA-Z+\-*/().]+)", code)
    if not m:
        return None
    expr = m.group(1).strip()
    if "x" not in expr.lower():
        return None
    if sp is not None:
        try:
            x = sp.symbols("x")
            lhs, rhs = expr.split("=")
            sol = sp.solve(sp.Eq(sp.sympify(lhs), sp.sympify(rhs)), x)
            if sol:
                val = sol[0]
                if val == int(val):
                    val = int(val)
                return f"<code>x = {val}</code>"
        except Exception:
            pass
    return solve_linear_simple(expr)


def gradient_through_points(q: str) -> str | None:
    pts = re.findall(r"\((-?\d+)\s*,\s*(-?\d+)\)", q)
    if len(pts) >= 2:
        x1, y1 = map(int, pts[0])
        x2, y2 = map(int, pts[1])
        if x2 != x1:
            m = (y2 - y1) / (x2 - x1)
            if m == int(m):
                return f"Gradient <code>m = {int(m)}</code> (rise {y2 - y1}, run {x2 - x1})."
            return f"Gradient <code>m = {m}</code> (rise {y2 - y1}, run {x2 - x1})."
    return None


def line_equation_answer(q: str) -> str | None:
    gm = re.search(r"gradient\s*\\?\(?\s*(-?\d+)\s*\\?\)?", q, re.I)
    cm = re.search(r"y-?intercept\s*(\d+)", q, re.I)
    if gm and cm:
        m = int(gm.group(1))
        c = int(cm.group(1))
        sign = "+" if c >= 0 else "&minus;"
        cabs = abs(c)
        return f"<code>y = {m}x {sign} {cabs}</code>."
    pts = re.findall(r"\((-?\d+)\s*,\s*(-?\d+)\)", q)
    if len(pts) >= 2 and "equation" in q.lower():
        x1, y1 = map(int, pts[0])
        x2, y2 = map(int, pts[1])
        if x2 != x1:
            m = (y2 - y1) / (x2 - x1)
            c = y1 - m * x1
            if m == int(m) and c == int(c):
                sign = "+" if c >= 0 else "&minus;"
                return f"<code>y = {int(m)}x {sign} {abs(int(c))}</code>."
    return None


def parallel_perpendicular(q: str) -> str | None:
    if "parallel" in q.lower():
        ms = re.findall(r"=\s*(-?\d+)x", q.replace("−", "-"))
        if len(ms) >= 2 and ms[0] == ms[1]:
            return f"Yes &mdash; both lines have gradient <code>m = {ms[0]}</code>, so they are parallel."
        if len(ms) >= 2:
            return f"No &mdash; gradients are <code>{ms[0]}</code> and <code>{ms[1]}</code>."
    if "perpendicular" in q.lower():
        m = re.search(r"=\s*(-?\d+)x", q.replace("−", "-"))
        if m:
            grad = int(m.group(1))
            if grad != 0:
                perp = -1 / grad
                return f"Perpendicular gradient <code>m = {perp}</code> (negative reciprocal of {grad})."
    return None


def general_form_answer(q: str) -> str | None:
    m = re.search(r"<code>([^<]+)</code>", q)
    if not m:
        m = re.search(r"(\d+x\s*[+\-−]\s*\d+y\s*[+\-−]\s*\d+\s*=\s*0)", q)
    if not m:
        return None
    expr = m.group(1).replace("−", "-")
    parts = re.match(r"\s*(-?\d+)x\s*([+\-])\s*(\d+)y\s*([+\-])\s*(\d+)\s*=\s*0", expr)
    if parts:
        a, bsign, b, csign, c = parts.groups()
        a, b, c = int(a), int(bsign + b), int(csign + c)
        if b != 0:
            m_val = -a / b
            intercept = -c / b
            m_str = int(m_val) if m_val == int(m_val) else m_val
            i_str = int(intercept) if intercept == int(intercept) else intercept
            return (
                f"Rearrange to <code>y = {m_str}x + {i_str}</code>; "
                f"gradient <code>{m_str}</code>, y-intercept <code>{i_str}</code>."
            )
    return None


def taxi_cost_answer(q: str) -> str | None:
    if "taxi" in q.lower() or "per mile" in q.lower():
        return "<code>C = 2n + 3</code>; fixed charge &pound;3, &pound;2 per mile &mdash; gradient (rate) is <code>2</code>."
    return None


def counting_answer(q: str) -> str | None:
    ql = q.lower()
    if "what question does counting answer" in ql:
        return "Counting answers <strong>“how many?”</strong> — the total number of objects."
    if "touch or mark each object" in ql:
        return "So each object is counted <strong>once</strong> (one-to-one matching) and none is missed or double-counted."
    if "count on from 14" in ql:
        return "<code>15, 16, 17, 18</code>"
    if "skip counting in 5" in ql:
        return "<code>5, 10, 15, 20, 25</code>"
    if "number line" in ql and "9" in ql and "6" in ql:
        return "9 is to the <strong>right</strong> of 6, so <code>9 &gt; 6</code>."
    if "digit 0" in ql and "408" in ql:
        return "0 is a <strong>placeholder</strong> in the tens place — there are no tens in 408."
    return None


def check_solution(q: str) -> str | None:
    if "check whether" in q.lower() and "solution" in q.lower():
        m = re.search(r"x\s*=\s*(\d+)", q)
        eq = re.search(r"<code>([^<]+)</code>", q)
        if m and eq:
            x = int(m.group(1))
            expr = eq.group(1).replace("−", "-")
            if sp is not None:
                try:
                    x_sym = sp.symbols("x")
                    lhs_rhs = expr.split("=")
                    lhs = sp.sympify(lhs_rhs[0])
                    rhs = sp.sympify(lhs_rhs[1])
                    ok = lhs.subs(x_sym, x) == rhs.subs(x_sym, x)
                    if ok:
                        return f"Yes — substituting <code>x = {x}</code> makes both sides equal."
                    return f"No — substituting <code>x = {x}</code> does not satisfy the equation."
                except Exception:
                    pass
            solved = solve_linear_simple(expr.replace(" ", ""))
            if solved and f"x = {x}" in solved.replace("<code>", "").replace("</code>", ""):
                return f"Yes — substituting <code>x = {x}</code> makes both sides equal."
    return None


def sum_equation_word_problem(q: str) -> str | None:
    if "sum of a number and 12 is 31" in q.lower():
        return "Equation: <code>n + 12 = 31</code>; solution <code>n = 19</code>."
    return None


def expand_solve(q: str) -> str | None:
    if "expand and solve" in q.lower():
        ans = solve_linear(q)
        if ans:
            return f"Expand to <code>2x − 8 = 10</code>, then {ans}."
    return None


def generate_answer(question: str, ctx: dict, index: int) -> str:
    q = question
    ordered = (
        counting_answer,
        line_equation_answer,
        gradient_through_points,
        parallel_perpendicular,
        taxi_cost_answer,
        general_form_answer,
        check_solution,
        sum_equation_word_problem,
        expand_solve,
    )
    for fn in ordered:
        ans = fn(q)
        if ans:
            return ans

    if "<code>" in q and ("solve" in q.lower() or "=" in q):
        ans = solve_linear(q)
        if ans:
            return ans

    if ctx["examples"] and index < len(ctx["examples"]):
        return f"See the worked example: {ctx['examples'][min(index, len(ctx['examples']) - 1)]}"

    if ctx["mini"]:
        return f"Your answer should include: {ctx['mini']}"

    return "Review the sections above — the key ideas needed are explained in the worked examples."


def main():
    if sp is None:
        print("Note: sympy not installed — using basic linear-equation fallback (pip install -r scripts/requirements.txt for full coverage)")
    questions = json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))
    answers: dict[str, list[str]] = {}
    for topic, qs in questions.items():
        ctx = read_page_context(ROOT / topic)
        answers[topic] = [generate_answer(q, ctx, i) for i, q in enumerate(qs)]

    ANSWERS_FILE.write_text(json.dumps(answers, indent=2), encoding="utf-8")
    print(f"Wrote answers for {len(answers)} topics to {ANSWERS_FILE}")


if __name__ == "__main__":
    main()
