#!/usr/bin/env python3
"""Generate all 24 v2 post JSONs and render them."""
import json, os, subprocess, sys
from pathlib import Path

OUT_DIR = Path(__file__).parent
ROOT = OUT_DIR.parent.parent

# All 24 posts — slide 1 only for grid comparison
# Each post has: id, type (sota/battle/tutorial), slides data
POSTS = [
    # ═══ SOTA (1-12) — dark backgrounds ═══
    {"id": "01_mirofish", "slides": [
        {"type": "title", "bg": "#0a0a0a", "accent": "#ff9f0a", "deco": "glow-top", "badge": "MIROFISH", "number": "700K", "title": "AI Agents", "subtitle": "Predicted the election. Built in 10 days.", "hooks": []},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#ff9f0a", "teaser": "Next: 11x faster than Chrome"}
    ]},
    {"id": "02_lightpanda", "slides": [
        {"type": "title", "bg": "#0a0a0a", "accent": "#2997ff", "deco": "circle-top", "badge": "LIGHTPANDA", "number": "11×", "title": "Faster", "subtitle": "Than Chrome. Written in Zig. Open source.", "hooks": []},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#2997ff", "teaser": "Next: Control any website with English"}
    ]},
    {"id": "03_apple_rejecting", "slides": [
        {"type": "title", "bg": "#f5f5f7", "accent": "#ff3b30", "deco": "line-accent", "badge": "BREAKING", "number": "", "title": "Apple Is <em>Rejecting</em> Vibe-Coded Apps", "subtitle": "March 18, 2026.", "hooks": []},
        {"type": "cta", "bg": "#f5f5f7", "accent": "#ff3b30", "teaser": "Next: 700K AI agents predicted the election"}
    ]},
    {"id": "04_page_agent", "slides": [
        {"type": "title", "bg": "#0a0a0a", "accent": "#ff9f0a", "deco": "glow-top", "badge": "PAGE-AGENT · 12K ⭐", "number": "", "title": "Control Any Website <em>With English.</em>", "subtitle": "One script tag. By Alibaba.", "hooks": []},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#ff9f0a", "teaser": "Next: $0.20 per million tokens"}
    ]},
    {"id": "05_gpt_nano", "slides": [
        {"type": "title", "bg": "#0a0a0a", "accent": "#30d158", "deco": "glow-center", "badge": "OPENAI", "number": "$0.20", "title": "", "subtitle": "Per million tokens. GPT-5.4 nano just dropped.", "hooks": []},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#30d158", "teaser": "Next: 100K stars in one week"}
    ]},
    {"id": "06_superpowers", "slides": [
        {"type": "title", "bg": "#0a0a0a", "accent": "#ff9f0a", "deco": "circle-bottom", "badge": "SUPERPOWERS", "number": "100K ⭐", "title": "<em>One Week.</em>", "subtitle": "Fastest-growing repo in GitHub history.", "hooks": []},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#ff9f0a", "teaser": "Next: 120B params on your laptop"}
    ]},
    {"id": "07_bitnet", "slides": [
        {"type": "title", "bg": "#0a0a0a", "accent": "#5e5ce6", "deco": "glow-top", "badge": "BITNET", "number": "", "title": "120 Billion Parameters. <em>Your Laptop.</em>", "subtitle": "1-bit LLMs. By Microsoft. Open source.", "hooks": []},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#5e5ce6", "teaser": "Next: One CSS line replaces 10 media queries"}
    ]},
    {"id": "08_container_queries", "slides": [
        {"type": "title", "bg": "#f5f5f7", "accent": "#007aff", "badge": "CSS", "number": "", "title": "One CSS Line Replaces <em>10 Media Queries</em>", "subtitle": "Container queries. The component knows its own width.", "hooks": []},
        {"type": "cta", "bg": "#f5f5f7", "accent": "#007aff", "teaser": "Next: Moment.js is dead"}
    ]},
    {"id": "09_temporal", "slides": [
        {"type": "title", "bg": "#f5f5f7", "accent": "#ff3b30", "badge": "ES2026", "number": "", "title": "Moment.js <em>is dead.</em>", "subtitle": "Temporal API is built into JS. No npm install.", "hooks": []},
        {"type": "cta", "bg": "#f5f5f7", "accent": "#ff3b30", "teaser": "Next: 4K video + audio locally"}
    ]},
    {"id": "10_ltx", "slides": [
        {"type": "title", "bg": "#0a0a0a", "accent": "#bf5af2", "deco": "glow-center", "badge": "LTX 2.3", "number": "", "title": "4K Video + Audio <em>Locally. Free.</em>", "subtitle": "Open source. Apache 2.0. Runs on your GPU.", "hooks": []},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#bf5af2", "teaser": "Next: Lazy arrays are here"}
    ]},
    {"id": "11_iterators", "slides": [
        {"type": "title", "bg": "#0a0a0a", "accent": "#30d158", "badge": "ES2026", "number": "", "title": "<em>Lazy</em> Arrays Are Here.", "subtitle": "Iterator helpers: .map(), .filter(), .take() — no intermediates.", "hooks": []},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#30d158", "teaser": "Next: Google Jules CLI"}
    ]},
    {"id": "12_jules", "slides": [
        {"type": "title", "bg": "#f5f5f7", "accent": "#007aff", "deco": "circle-top", "badge": "GOOGLE", "number": "", "title": "Jules CLI <em>Just Dropped.</em>", "subtitle": "Async coding agent. Start tasks from terminal.", "hooks": []},
        {"type": "cta", "bg": "#f5f5f7", "accent": "#007aff", "teaser": "Next: Which optimization is better?"}
    ]},

    # ═══ SNIPPET BATTLES (13-18, 21, 23) — dark gradient ═══
    {"id": "13_react_compiler", "slides": [
        {"type": "hook", "bg": "#0a0a0a", "accent": "#ff9f0a", "gradient": "linear-gradient(160deg, #0a0a0a 0%, #1a1020 50%, #0a0a0a 100%)", "badge": "REACT 19", "title": "Which <em>optimization</em> is better?", "problem": "Prevent unnecessary re-renders in React",
         "a": {"label": "Manual memo", "code": "const val = useMemo(\n  () => calc(x), [x]\n);\nconst fn = useCallback(\n  () => run(), []\n);"},
         "b": {"label": "React Compiler", "code": "const val = calc(x);\nconst fn = () => run();"}},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#ff9f0a", "teaser": "Next: 3 CSS tricks"}
    ]},
    {"id": "15_structuredclone", "slides": [
        {"type": "hook", "bg": "#0a0a0a", "accent": "#ff9f0a", "gradient": "linear-gradient(160deg, #0a0a0a 0%, #1a1508 50%, #0a0a0a 100%)", "badge": "JAVASCRIPT", "title": "Which <em>clone</em> is better?", "problem": "Deep copy an object with nested data",
         "a": {"label": "JSON trick", "code": "const copy =\n  JSON.parse(\n    JSON.stringify(obj)\n  );"},
         "b": {"label": "Native way", "code": "const copy =\n  structuredClone(obj);"}},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#ff9f0a", "teaser": "Next: 7 Git commands"}
    ]},
    {"id": "17_async_await", "slides": [
        {"type": "hook", "bg": "#0a0a0a", "accent": "#ff9f0a", "gradient": "linear-gradient(160deg, #0a0a0a 0%, #0a1020 50%, #0a0a0a 100%)", "badge": "JAVASCRIPT", "title": "Which <em>async</em> pattern?", "problem": "Fetch data from an API cleanly",
         "a": {"label": ".then() chain", "code": "fetch(url)\n  .then(r => r.json())\n  .then(data => {\n    process(data);\n  })"},
         "b": {"label": "async/await", "code": "const data = await\n  (await fetch(url)).json();"}},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#ff9f0a", "teaser": "Next: 4 TypeScript patterns"}
    ]},
    {"id": "19_fetch_axios", "slides": [
        {"type": "hook", "bg": "#0a0a0a", "accent": "#ff9f0a", "gradient": "linear-gradient(160deg, #0a0a0a 0%, #081518 50%, #0a0a0a 100%)", "badge": "JAVASCRIPT", "title": "Which HTTP <em>client</em>?", "problem": "Make API requests in JavaScript",
         "a": {"label": "axios", "code": "import axios from 'axios';\n\nconst { data } =\n  await axios.get(url);"},
         "b": {"label": "fetch()", "code": "// no import needed\nconst data = await\n  (await fetch(url)).json();"}},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#ff9f0a", "teaser": "Next: 6 React 19 features"}
    ]},
    {"id": "21_grid_flexbox", "slides": [
        {"type": "hook", "bg": "#0a0a0a", "accent": "#ff9f0a", "gradient": "linear-gradient(160deg, #0a0a0a 0%, #1a1020 50%, #0a0a0a 100%)", "badge": "CSS", "title": "Which <em>layout</em> system?", "problem": "Position elements on a page",
         "a": {"label": "Flexbox", "code": ".row {\n  display: flex;\n  gap: 1rem;\n}"},
         "b": {"label": "Grid", "code": ".layout {\n  display: grid;\n  grid-template:\n    \"a b\" / 1fr 2fr;\n}"}},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#ff9f0a", "teaser": "Next: 3 Python tricks"}
    ]},
    {"id": "23_let_const", "slides": [
        {"type": "hook", "bg": "#0a0a0a", "accent": "#ff9f0a", "gradient": "linear-gradient(160deg, #0a0a0a 0%, #081508 50%, #0a0a0a 100%)", "badge": "JAVASCRIPT", "title": "Which <em>declaration</em>?", "problem": "Declare variables in JavaScript",
         "a": {"label": "let", "code": "let count = 0;\nlet name = \"Ada\";\nlet items = [];\nlet config = {};\nlet active = true;"},
         "b": {"label": "const", "code": "const count = 0;\nconst name = \"Ada\";"}},
        {"type": "cta", "bg": "#0a0a0a", "accent": "#ff9f0a", "teaser": "Next: 4 Node.js built-ins"}
    ]},

    # ═══ TUTORIAL REVEALS (14, 16, 18, 20, 22, 24) — soft pastel ═══
    {"id": "14_css_tricks", "slides": [
        {"type": "title", "bg": "#c8f5e8", "accent": "#0d9373", "badge": "CSS", "number": "3", "title": "CSS tricks that replaced <em>JavaScript entirely</em>", "subtitle": "No JS needed. All browsers.", "hooks": [":has()", "scroll-snap", "@container"]},
        {"type": "cta", "bg": "#c8f5e8", "accent": "#0d9373", "teaser": "Next: structuredClone vs JSON"}
    ]},
    {"id": "16_git_commands", "slides": [
        {"type": "title", "bg": "#ffe4c4", "accent": "#c66d00", "badge": "GIT", "number": "7", "title": "Git commands <em>seniors use daily</em>", "subtitle": "Most juniors don't know #3.", "hooks": ["stash", "reflog", "bisect", "cherry-pick"]},
        {"type": "cta", "bg": "#ffe4c4", "accent": "#c66d00", "teaser": "Next: async/await vs .then()"}
    ]},
    {"id": "18_typescript_patterns", "slides": [
        {"type": "title", "bg": "#dde0ff", "accent": "#3451b2", "badge": "TYPESCRIPT", "number": "4", "title": "TypeScript patterns that make your code <em>bulletproof</em>", "subtitle": "satisfies, discriminated unions, type guards, infer.", "hooks": ["satisfies", "unions", "guards", "infer"]},
        {"type": "cta", "bg": "#dde0ff", "accent": "#3451b2", "teaser": "Next: fetch vs axios"}
    ]},
    {"id": "20_react_features", "slides": [
        {"type": "title", "bg": "#c4ecff", "accent": "#0880a8", "badge": "REACT 19", "number": "6", "title": "React 19 features you're <em>not using yet</em>", "subtitle": "use(), Server Components, Actions, Compiler, and more.", "hooks": ["use()", "RSC", "Actions", "Compiler"]},
        {"type": "cta", "bg": "#c4ecff", "accent": "#0880a8", "teaser": "Next: Grid vs Flexbox"}
    ]},
    {"id": "22_python_tricks", "slides": [
        {"type": "title", "bg": "#ffd6d4", "accent": "#c0392b", "badge": "PYTHON", "number": "3", "title": "Python tricks that <em>senior devs</em> use daily", "subtitle": "Walrus operator, match/case, and more.", "hooks": ["walrus :=", "match/case", "slots"]},
        {"type": "cta", "bg": "#ffd6d4", "accent": "#c0392b", "teaser": "Next: let vs const"}
    ]},
    {"id": "24_nodejs_builtins", "slides": [
        {"type": "title", "bg": "#e4d6ff", "accent": "#7c3aed", "badge": "NODE.JS", "number": "4", "title": "Node.js built-ins you're <em>still npm installing</em>", "subtitle": "fetch(), test runner, parseArgs, and more.", "hooks": ["fetch()", "node:test", "parseArgs", "watch"]},
        {"type": "cta", "bg": "#e4d6ff", "accent": "#7c3aed", "teaser": "Follow for more"}
    ]},
]

# Generate JSONs and render
rendered = []
for post in POSTS:
    pid = post["id"]
    json_path = OUT_DIR / f"post_{pid}.json"
    out_path = OUT_DIR / f"rendered_{pid}"

    # Write JSON
    with open(json_path, "w") as f:
        json.dump({"topic": f"v2_{pid}", "slides": post["slides"]}, f, indent=2)

    # Render
    print(f"\n  Rendering {pid}...")
    result = subprocess.run(
        [sys.executable, str(ROOT / "carousel_engine" / "render_v2.py"),
         str(json_path), "--out", str(out_path)],
        capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        print(f"  ERROR: {result.stderr[-300:]}")
    else:
        print(result.stdout.strip())
    rendered.append(str(out_path))

print(f"\n\nDone! Rendered {len(rendered)} posts.")
print("Output dirs:", "\n  ".join(rendered))
