#!/usr/bin/env python3
"""
Render carousel slides from JSON content using HTML templates.

Usage:
  python carousel_engine/render.py content/post_xyz.json
  python carousel_engine/render.py content/post_xyz.json --out ./my_slides
"""

import argparse
import json
import os
import sys
from pathlib import Path

ENGINE_DIR = Path(__file__).parent
TEMPLATES_DIR = ENGINE_DIR / "templates"
DEFAULT_TEMPLATE = "snippet_battle"


def render_carousel(content_json: dict, template: str = DEFAULT_TEMPLATE, out_dir: str = None) -> list:
    template_path = TEMPLATES_DIR / f"{template}.html"
    if not template_path.exists():
        print(f"Error: Template '{template}' not found at {template_path}")
        sys.exit(1)

    slides = content_json.get("slides", [])
    if not slides:
        print("Error: No slides in content JSON")
        sys.exit(1)

    if out_dir is None:
        topic = content_json.get("topic", "carousel").replace(" ", "_").lower()
        out_dir = ENGINE_DIR.parent / "content" / f"carousel_{topic}"
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    template_html = template_path.read_text()
    slides_json_str = json.dumps(slides)
    rendered_html = template_html.replace("SLIDES_JSON_PLACEHOLDER", slides_json_str)

    rendered_path = out_dir / "slides.html"
    rendered_path.write_text(rendered_html)

    # Use Playwright to screenshot each .slide div
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Error: playwright not installed. Run: pip install playwright && playwright install chromium")
        sys.exit(1)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 1200})
        page.goto(f"file://{rendered_path.resolve()}", wait_until="networkidle")
        page.wait_for_timeout(3000)  # fonts + rendering

        slides_els = page.query_selector_all(".slide")
        paths = []
        for i, el in enumerate(slides_els):
            path = str(out_dir / f"slide_{i+1}.png")
            el.screenshot(path=path)
            paths.append(path)
            print(f"  Slide {i+1}/{len(slides_els)}: {path}")

        browser.close()
        return paths


def main():
    parser = argparse.ArgumentParser(description="Render carousel slides from JSON")
    parser.add_argument("content", help="Path to content JSON file")
    parser.add_argument("--template", "-t", default=DEFAULT_TEMPLATE)
    parser.add_argument("--out", "-o", help="Output directory")
    args = parser.parse_args()

    with open(args.content) as f:
        content = json.load(f)

    print(f"\n  Rendering: {content.get('topic', 'untitled')}")
    print(f"  Template: {args.template}")
    print(f"  Slides: {len(content.get('slides', []))}")
    print()

    paths = render_carousel(content, template=args.template, out_dir=args.out)

    print(f"\n  Done! {len(paths)} slides rendered.")
    print(f"  Output: {os.path.dirname(paths[0])}")
    print()


if __name__ == "__main__":
    main()
