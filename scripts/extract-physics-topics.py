#!/usr/bin/env python3
"""Extract physics graph data from maps/physics-prereq-map.html into maps/physics-topics.json."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "maps" / "physics-prereq-map.html"
OUT = ROOT / "maps" / "physics-topics.json"

text = SRC.read_text(encoding="utf-8")

nodes_block = re.search(r"const NODES = \[(.*?)\];", text, re.DOTALL)
edges_block = re.search(r"const EDGES = \[(.*?)\];", text, re.DOTALL)
if not nodes_block or not edges_block:
    raise SystemExit("Could not parse NODES/EDGES from physics-prereq-map.html")

node_re = re.compile(
    r'\{\s*id:"([^"]+)",\s*title:"([^"]+)",\s*level:"([^"]+)"\s*\}'
)
edge_re = re.compile(
    r'\{\s*from:"([^"]+)",\s*to:"([^"]+)"(?:,\s*type:"([^"]+)")?\s*\}'
)

nodes = [
    {"id": m.group(1), "title": m.group(2), "level": m.group(3), "subject": "physics"}
    for m in node_re.finditer(nodes_block.group(1))
]
edges = [
    {"from": m.group(1), "to": m.group(2), **({"type": m.group(3)} if m.group(3) else {})}
    for m in edge_re.finditer(edges_block.group(1))
]

payload = {
    "meta": {
        "title": "Physics Prerequisite Graph",
        "version": "1.0.0",
        "levels": ["KS2", "KS3", "GCSE", "A-Level", "BSc", "MSc", "Frontier"],
        "notes": [
            "Graph expresses prerequisite relationships, not an exam board specification.",
            "Cross-subject math prerequisites are listed in cross_edges.",
        ],
    },
    "nodes": nodes,
    "edges": edges,
    "cross_edges": [
        {"from": "gcse_algebra_basics", "to": "physics_maths_gcse", "type": "required", "subject": "math"},
        {"from": "gcse_linear_graphs", "to": "physics_maths_gcse", "type": "recommended", "subject": "math"},
        {"from": "al_vectors", "to": "vectors_alevel", "type": "required", "subject": "math"},
        {"from": "al_functions", "to": "calculus_concepts_alevel", "type": "required", "subject": "math"},
        {"from": "al_calculus_diff", "to": "calculus_concepts_alevel", "type": "required", "subject": "math"},
        {"from": "al_calculus_int", "to": "odes_bsc", "type": "recommended", "subject": "math"},
        {"from": "bsc_linear_algebra", "to": "linear_algebra_bsc", "type": "required", "subject": "math"},
        {"from": "bsc_multivariable_calc", "to": "vector_calculus_bsc", "type": "required", "subject": "math"},
        {"from": "bsc_complex", "to": "complex_variables_bsc", "type": "recommended", "subject": "math"},
        {"from": "bsc_fourier", "to": "fourier_methods_bsc", "type": "required", "subject": "math"},
        {"from": "al_probability", "to": "data_analysis_bsc", "type": "recommended", "subject": "math"},
        {"from": "bsc_real_analysis", "to": "tensor_calc_diff_geom_msc", "type": "recommended", "subject": "math"},
    ],
}

OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(nodes)} nodes, {len(edges)} edges, {len(payload['cross_edges'])} cross-edges -> {OUT.relative_to(ROOT)}")
