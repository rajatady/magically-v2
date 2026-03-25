#!/usr/bin/env python3
"""
Render V3 — Flexible canvas renderer with Monaco code blocks.

Layer 1: JSON → HTML → Playwright → PNG
- Background: solid, gradient, or image + stackable decorations
- Content area: 80% safe zone (10% margin each side)
- All positioning/sizing uses percentage properties (xPct, yPct, wPct, hPct, sizePct)
- Code blocks use Monaco Editor for syntax highlighting

Layer 2: Templates define aesthetic per content type (colors, fonts, mood)

Usage:
  python carousel_engine/render_v3.py content/v3/post_xyz.json
"""

import argparse
import json
import sys
from pathlib import Path

ENGINE_DIR = Path(__file__).parent

FONTS_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Newsreader:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600;1,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
"""

FONT_MAP = {
    'headline': "'Newsreader', Georgia, serif",
    'body': "'Inter', -apple-system, sans-serif",
    'mono': "'JetBrains Mono', monospace",
}

CANVAS = 1080
MARGIN_PCT = 10

# Monaco / syntax theme colors (VS Code Dark+)
SYNTAX_THEME = {
    'bg': '#1e1e1e',
    'fg': '#d4d4d4',
}


def pct(val):
    """Convert percentage to pixels on 1080 canvas."""
    return int(CANVAS * val / 100)


def render_element(el):
    """Render a single element to HTML. All sizing uses Pct suffix properties."""
    etype = el.get('type', 'text')
    x = el.get('xPct', 0)
    y = el.get('yPct', 0)
    w = el.get('wPct')
    h = el.get('hPct')
    font_name = el.get('font', 'body')
    font_family = FONT_MAP.get(font_name, FONT_MAP['body'])
    font_size = el.get('sizePct', 5)
    font_weight = el.get('weight', 400)
    color = el.get('color', '#f5f5f7')
    align = el.get('align', 'left')
    italic = el.get('italic', False)
    content = el.get('content', '')
    lh = el.get('lineHeight', 1.2)
    ls = el.get('letterSpacingPct', 0)
    opacity = el.get('opacity', 1)

    style = [
        f"position: absolute",
        f"left: {x}%",
        f"top: {y}%",
        f"font-family: {font_family}",
        f"font-size: {pct(font_size)}px",
        f"font-weight: {font_weight}",
        f"color: {color}",
        f"text-align: {align}",
        f"line-height: {lh}",
    ]
    if w: style.append(f"width: {w}%")
    if h: style.append(f"height: {h}%")
    if ls: style.append(f"letter-spacing: {pct(ls)}px")
    if opacity != 1: style.append(f"opacity: {opacity}")
    if italic: style.append("font-style: italic")
    css = "; ".join(style)

    if etype == 'text':
        html = content.replace('\n', '<br>')
        return f'<div style="{css}">{html}</div>'

    elif etype == 'code':
        lang = el.get('lang', 'javascript')
        border = el.get('border', '')
        radius = el.get('radiusPct', 1.5)
        pad = el.get('paddingPct', 2.5)
        code_bg = el.get('codeBg', SYNTAX_THEME['bg'])
        border_css = f"border: 2px solid {border};" if border else ""

        # For now, use pre-highlighted HTML content
        # TODO: integrate Monaco editor for auto-highlighting
        code_html = content.replace('\n', '<br>')

        return f'''<div style="{css}; background: {code_bg};
          border-radius: {pct(radius)}px; padding: {pct(pad)}px;
          {border_css} white-space: pre-wrap; overflow: hidden;
          font-family: {FONT_MAP['mono']}; font-size: {pct(font_size)}px;
          color: {SYNTAX_THEME['fg']}; line-height: 1.6;">{code_html}</div>'''

    elif etype == 'badge':
        bg = el.get('badgeBg', '#ff9f0a')
        tc = el.get('badgeColor', '#000')
        return f'''<div style="{css}; background: {bg}; color: {tc};
          padding: {pct(0.6)}px {pct(2)}px;
          border-radius: 24px; display: inline-block;
          font-weight: 700; letter-spacing: 0.5px;">{content}</div>'''

    elif etype == 'circle':
        size = el.get('sizePct', 10)
        bg = el.get('circleBg', '#ff9f0a')
        op = el.get('circleOpacity', 0.1)
        blur = el.get('blurPx', 0)
        blur_css = f"filter: blur({blur}px);" if blur else ""
        return f'''<div style="position: absolute; left: {x}%; top: {y}%;
          width: {pct(size)}px; height: {pct(size)}px;
          border-radius: 50%; background: {bg}; opacity: {op};
          {blur_css}"></div>'''

    elif etype == 'pill':
        bg = el.get('pillBg', '#ff9f0a')
        tc = el.get('pillColor', '#000')
        return f'''<div style="{css}; background: {bg}; color: {tc};
          padding: {pct(1.5)}px {pct(5)}px;
          border-radius: 50px; display: inline-block;
          font-weight: 700;">{content}</div>'''

    elif etype == 'card':
        bg = el.get('cardBg', 'rgba(255,255,255,0.04)')
        border = el.get('cardBorder', 'rgba(255,255,255,0.08)')
        radius = el.get('radiusPct', 1.8)
        pad = el.get('paddingPct', 2)
        children_html = ''.join(render_element(c) for c in el.get('children', []))
        return f'''<div style="{css}; background: {bg};
          border: 1px solid {border}; border-radius: {pct(radius)}px;
          padding: {pct(pad)}px;">{children_html}</div>'''

    elif etype == 'line':
        lw = el.get('wPct', 20)
        lh_val = el.get('hPct', 0.3)
        bg = el.get('lineBg', '#ff9f0a')
        return f'''<div style="position: absolute; left: {x}%; top: {y}%;
          width: {pct(lw)}px; height: {pct(lh_val)}px;
          background: {bg}; border-radius: 2px;"></div>'''

    return ''


def render_slide(slide, idx):
    """Render one slide."""
    bg = slide.get('background', {})
    bg_type = bg.get('type', 'solid')
    if bg_type == 'gradient':
        bg_css = f"background: {bg.get('value')};"
    else:
        bg_css = f"background: {bg.get('color', '#0a0a0a')};"

    decos = ''.join(render_element(d) for d in slide.get('decorations', []))
    elements = ''.join(render_element(e) for e in slide.get('elements', []))

    wm = slide.get('watermark', True)
    wm_html = ''
    if wm:
        wm_html = f'''<div style="position: absolute; bottom: {pct(3)}px;
          right: {pct(4)}px; font-family: {FONT_MAP['mono']};
          font-size: {pct(1.8)}px; font-weight: 600;
          color: rgba(255,255,255,0.3); letter-spacing: 1px;">@coding_tips_pro</div>'''

    m = pct(MARGIN_PCT)
    content_size = CANVAS - m * 2

    return f'''
    <div class="slide" style="{bg_css}">
      {decos}
      <div style="position: absolute; left: {m}px; top: {m}px;
        width: {content_size}px; height: {content_size}px;">
        {elements}
      </div>
      {wm_html}
    </div>'''


def render_post(post, out_dir):
    slides = post.get('slides', [])
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    html_slides = ''.join(render_slide(s, i) for i, s in enumerate(slides))

    full_html = f'''<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
{FONTS_CSS}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ background: #777; }}
.slide {{
  width: {CANVAS}px; height: {CANVAS}px;
  position: relative; overflow: hidden;
  page-break-after: always;
  -webkit-font-smoothing: antialiased;
}}
</style>
</head><body>{html_slides}</body></html>'''

    (out_dir / "slides.html").write_text(full_html)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Error: playwright not installed")
        sys.exit(1)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 1200})
        page.goto(f"file://{(out_dir / 'slides.html').resolve()}", wait_until="networkidle")
        page.wait_for_timeout(3000)

        els = page.query_selector_all(".slide")
        paths = []
        for i, el in enumerate(els):
            path = str(out_dir / f"slide_{i+1}.png")
            el.screenshot(path=path)
            paths.append(path)
            print(f"  Slide {i+1}/{len(els)}")

        browser.close()
        return paths


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("content")
    parser.add_argument("--out", "-o")
    args = parser.parse_args()

    with open(args.content) as f:
        post = json.load(f)

    topic = post.get('topic', 'post')
    out = args.out or str(ENGINE_DIR.parent / "content" / f"v3_{topic}")

    print(f"\n  Rendering V3: {topic}")
    print(f"  Slides: {len(post.get('slides', []))}")

    paths = render_post(post, out)
    print(f"\n  Done! {len(paths)} slides.")


if __name__ == "__main__":
    main()
