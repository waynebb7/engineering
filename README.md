# Engineering Knowledge Hub

A static reference and calculator site for electrical engineering, mathematics, physics, and digital logic. No build step is required — HTML, CSS, and JavaScript are served as-is.

**Live site:** [https://waynebb7.github.io/engineering/](https://waynebb7.github.io/engineering/)

## Features

- **40+ interactive calculators** — power, AC/three-phase, unit conversion, digital logic, physics, aerospace
- **Engineering reference** — variables and equations with click-to-learn modals
- **Shared calculator engine** — definitions in `js/calculator-registry.js`, UI in `js/calculator-core.js`
- **Corporate design system** — `css/corporate.css` across all pages

## Local development

You need a local web server. Some pages load JSON with `fetch()` and will not work when opened as `file://` links.

### Python (recommended)

```bash
cd engineering
python -m http.server 8080
```

Open [http://localhost:8080/index.html](http://localhost:8080/index.html)

### PowerShell

```powershell
cd engineering
python -m http.server 8080
```

## Project structure

```
engineering/
├── index.html                 # Hub page
├── css/corporate.css          # Site-wide styles
├── js/
│   ├── site-layout.js         # Header, nav, footer
│   ├── calculator-core.js     # Calculator engine (render, validation, live recalc)
│   ├── calculator-registry.js # Calculator definitions and formulas
│   ├── variable-details.js    # Variable reference modals
│   └── equation-details.js    # Equation reference modals
├── scripts/
│   ├── check-links.py         # Internal link checker
│   └── migrate-calc-shell.ps1 # Calculator HTML migration helper
├── logic_and_digital_math/    # Digital logic topics
├── basic_physics/             # Introductory physics
├── math/                      # Math prerequisite map
└── physics_subjects_drill_down/
```

## Adding a calculator

1. Create a minimal HTML shell:

```html
<body class="calculator-page" data-calc="my_calc"></body>
```

2. Register the calculator in `js/calculator-registry.js` (fields, formula, `compute`, help text).

3. Run locally and verify at `http://localhost:8080/my_calc_calculator.html`.

## Quality checks

### JavaScript syntax

```bash
node --check js/calculator-core.js
```

### Internal links (CI scope)

Checks pages reachable from `index.html`, excluding subject-catalog stubs with many unwritten topics:

```bash
python scripts/check-links.py --scope core
```

Full scan (includes catalogs — expect many failures until content is written):

```bash
python scripts/check-links.py --scope all
```

## CI and deployment

GitHub Actions workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

| Job | When | What |
|-----|------|------|
| **check** | Every push and PR | `node --check` on all `js/*.js`; internal link check (`--scope core`) |
| **deploy** | Push to `main` after check passes | Publishes the site to GitHub Pages |

### First-time GitHub Pages setup

1. Push this repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to `main` (or run the workflow manually under **Actions**).

The site will be available at:

`https://<your-github-username>.github.io/engineering/`

## Subject catalogs

`pure_math_subjects.html` and `physics_subjects.html` list many topics that are not yet written. Those pages are excluded from the core link check so CI stays green while content is added gradually. Run `--scope all` locally to see the full backlog.

## License

MIT — see [LICENSE](LICENSE).
