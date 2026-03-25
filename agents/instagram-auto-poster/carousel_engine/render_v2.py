#!/usr/bin/env python3
"""
Render V2 — @coding_tips_pro
Generates unique HTML per slide. No templates. Brand DNA only.

Usage:
  python carousel_engine/render_v2.py content/post_xyz.json
  python carousel_engine/render_v2.py content/post_xyz.json --out ./output
"""

import argparse
import json
import os
import sys
from pathlib import Path

ENGINE_DIR = Path(__file__).parent

# ─── Brand DNA ───
FONTS_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Newsreader:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600;1,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
"""

BASE_CSS = """
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #777; }
.slide {
  width: 1080px; height: 1080px;
  position: relative; overflow: hidden;
  display: flex; flex-direction: column;
  font-family: 'Inter', -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  page-break-after: always;
}
.slide > * { position: relative; z-index: 1; }

/* Syntax highlighting */
.kw { color: #C586C0; } .str { color: #CE9178; } .fn { color: #DCDCAA; }
.type { color: #4EC9B0; } .num { color: #B5CEA8; } .cm { color: #6A9955; }
.prop { color: #9CDCFE; } .tag { color: #569CD6; }
"""


def hl(code: str) -> str:
    """Syntax highlight code string for HTML."""
    import re
    toks = []
    t = code
    # Comments
    t = re.sub(r'//(.*)$', lambda m: f'<span class="cm">//{m.group(1)}</span>', t, flags=re.MULTILINE)
    # Strings
    t = re.sub(r"'([^']*)'", lambda m: f"<span class=\"str\">'{m.group(1)}'</span>", t)
    t = re.sub(r'"([^"]*)"', lambda m: f'<span class="str">"{m.group(1)}"</span>', t)
    # Keywords
    t = re.sub(r'\b(const|let|var|function|return|if|else|new|export|import|from|async|await|class|extends|typeof|for|of|in|try|catch|throw|using|yield|match|case|def|print|type)\b',
               r'<span class="kw">\1</span>', t)
    # Numbers
    t = re.sub(r'\b(\d+\.?\d*)\b', r'<span class="num">\1</span>', t)
    # Types
    t = re.sub(r'\b([A-Z][a-zA-Z]*)\b', r'<span class="type">\1</span>', t)
    # Functions
    t = re.sub(r'\.([a-zA-Z_]+)\s*\(', r'.<span class="fn">\1</span>(', t)
    return t


def build_slide_html(slide: dict, slide_idx: int, total: int, post_meta: dict) -> str:
    """Generate unique HTML for a single slide based on its content."""
    bg = slide.get('bg', '#0a0a0a')
    accent = slide.get('accent', '#ff9f0a')
    stype = slide.get('type', 'content')

    # Determine text colors from background
    is_dark = bg in ('#0a0a0a', '#111', '#1a1a1a') or bg.startswith('linear-gradient') or bg.startswith('#0')
    text_color = '#f5f5f7' if is_dark else '#1d1d1f'
    dim_color = 'rgba(255,255,255,0.5)' if is_dark else 'rgba(0,0,0,0.45)'
    badge_text = '#000' if is_dark else '#fff'

    # Background style
    bg_style = f'background: {bg};' if not bg.startswith('linear') else f'background: {bg};'

    # Watermark
    watermark = f'''
    <div style="position:absolute;bottom:36px;right:44px;z-index:3;
      font-size:20px;font-weight:600;color:{dim_color};letter-spacing:1px;
      font-family:'JetBrains Mono',monospace;">@coding_tips_pro</div>
    ''' if stype != 'cta' else ''

    # Badge
    badge_html = ''
    if slide.get('badge'):
        badge_html = f'''
        <div style="font-family:'Inter';font-weight:700;font-size:22px;
          color:{badge_text};background:{accent};
          padding:6px 20px;border-radius:24px;display:inline-block;
          margin-bottom:24px;letter-spacing:0.5px;">{slide['badge']}</div>
        '''

    content = ''

    if stype == 'hook':
        # Snippet battle slide 1
        title = slide.get('title', '')
        problem = slide.get('problem', '')
        a = slide.get('a', {})
        b = slide.get('b', {})

        # Build A/B code blocks
        a_code = hl(a.get('code', ''))
        b_code = hl(b.get('code', ''))

        content = f'''
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;
          padding:80px 162px;text-align:center;align-items:center;">
          {badge_html}
          <div style="font-family:'Newsreader',Georgia,serif;font-weight:800;
            font-size:80px;color:{text_color};line-height:1.08;letter-spacing:-2px;
            margin-bottom:16px;">{title}</div>
          <div style="font-family:'Inter';font-size:26px;color:{dim_color};
            margin-bottom:28px;">{problem}</div>

          <div style="display:flex;flex-direction:column;gap:14px;width:85%;align-self:center;">
            <div style="background:rgba(255,255,255,0.04);backdrop-filter:blur(20px);
              border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
              <div style="display:flex;align-items:center;gap:14px;padding:14px 22px;
                border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="width:40px;height:40px;border-radius:50%;background:#ff9f0a;
                  display:flex;align-items:center;justify-content:center;
                  font-weight:800;font-size:22px;color:#000;">A</div>
                <div style="font-size:22px;font-weight:600;color:rgba(255,255,255,0.6);">{a.get('label','')}</div>
              </div>
              <div style="padding:16px 22px;font-family:'JetBrains Mono',monospace;
                font-size:19px;color:#e5e5e7;line-height:1.65;text-align:left;
                white-space:pre-wrap;">{a_code}</div>
            </div>

            <div style="background:rgba(255,255,255,0.04);backdrop-filter:blur(20px);
              border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
              <div style="display:flex;align-items:center;gap:14px;padding:14px 22px;
                border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="width:40px;height:40px;border-radius:50%;background:#2997ff;
                  display:flex;align-items:center;justify-content:center;
                  font-weight:800;font-size:22px;color:#000;">B</div>
                <div style="font-size:22px;font-weight:600;color:rgba(255,255,255,0.6);">{b.get('label','')}</div>
              </div>
              <div style="padding:16px 22px;font-family:'JetBrains Mono',monospace;
                font-size:19px;color:#e5e5e7;line-height:1.65;text-align:left;
                white-space:pre-wrap;">{b_code}</div>
            </div>
          </div>

          <div style="font-family:'Newsreader',serif;font-style:italic;
            font-size:28px;color:rgba(255,255,255,0.35);margin-top:20px;">
            Pick one. Then swipe.</div>
        </div>
        '''

    elif stype == 'title':
        # Tutorial reveal slide 1
        number = slide.get('number', '')
        title = slide.get('title', '').replace('<em>', f'<em style="color:{accent};font-style:normal;">')
        subtitle = slide.get('subtitle', '')
        hooks = slide.get('hooks', [])

        # Chips
        chips_html = ''
        if hooks:
            chips = ''.join(f'''
            <div style="font-family:'JetBrains Mono',monospace;font-size:16px;
              background:rgba(255,255,255,0.9);color:#1a1610;padding:6px 16px;
              border-radius:20px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.06);">{h}</div>
            ''' for h in hooks[:5])
            chips_html = f'<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-bottom:24px;">{chips}</div>'

        content = f'''
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;
          padding:80px 162px;text-align:center;align-items:center;">
          {badge_html}

          <!-- Accent glow behind number -->
          <div style="position:absolute;width:400px;height:400px;border-radius:50%;
            background:radial-gradient(circle, {accent}30 0%, {accent}08 50%, transparent 70%);
            top:50%;left:50%;transform:translate(-50%,-55%);filter:blur(30px);z-index:0;"></div>

          <div style="font-family:'Inter';font-weight:900;font-size:300px;
            color:{accent};line-height:0.82;letter-spacing:-12px;
            position:relative;z-index:1;opacity:0.9;">{number}</div>

          {chips_html}

          <div style="font-family:'Newsreader',Georgia,serif;font-weight:700;
            font-size:52px;color:{text_color};line-height:1.1;letter-spacing:-1px;
            margin-top:16px;">{title}</div>

          <div style="font-family:'Newsreader',serif;font-style:italic;
            font-size:28px;color:{dim_color};margin-top:16px;">{subtitle}</div>
        </div>
        '''

    elif stype == 'item':
        # Tutorial reveal item slide
        number = slide.get('number', '')
        title = slide.get('title', '').replace('<em>', f'<em style="color:{accent};font-style:normal;">')
        desc = slide.get('desc', '')
        code = slide.get('code', '')
        punchline = slide.get('punchline', '')
        code_size = slide.get('code_size', 18)

        code_html = ''
        if code:
            highlighted = hl(code)
            code_html = f'''
            <div style="background:#1d1d1f;border-radius:16px;padding:28px 32px;
              font-family:'JetBrains Mono',monospace;font-size:{code_size}px;
              color:#e5e5e7;line-height:1.7;text-align:left;margin-top:20px;
              white-space:pre-wrap;">{highlighted}</div>
            '''

        punchline_html = ''
        if punchline:
            punchline_html = f'''
            <div style="font-family:'Newsreader',serif;font-style:italic;
              font-size:24px;color:{accent};margin-top:20px;">{punchline}</div>
            '''

        content = f'''
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;
          padding:80px 120px;">
          {badge_html}
          <div style="font-family:'Inter';font-weight:800;font-size:18px;
            color:{accent};letter-spacing:2px;margin-bottom:8px;">{number}</div>
          <div style="font-family:'Newsreader',Georgia,serif;font-weight:700;
            font-size:44px;color:{text_color};line-height:1.1;letter-spacing:-1px;">{title}</div>
          <div style="font-family:'Inter';font-size:22px;color:{dim_color};
            line-height:1.4;margin-top:12px;">{desc}</div>
          {code_html}
          {punchline_html}
        </div>
        '''

    elif stype == 'answer':
        # Snippet battle answer slide
        title = slide.get('title', '').replace('<em>', f'<em style="color:{accent};font-style:normal;">')
        verdicts = slide.get('verdicts', [])
        takeaway = slide.get('takeaway', '')

        verdicts_html = ''
        for v in verdicts:
            is_good = v.get('result') == 'good'
            border_color = '#34c759' if is_good else '#ff3b30'
            bg_color = 'rgba(52,199,89,0.06)' if is_good else 'rgba(255,59,48,0.06)'
            tag_bg = '#34c759' if is_good else '#ff3b30'
            verdicts_html += f'''
            <div style="background:{bg_color};border:2px solid {border_color};
              border-radius:20px;padding:24px 28px;margin-bottom:16px;">
              <div style="font-family:'Inter';font-weight:700;font-size:16px;
                color:#fff;background:{tag_bg};padding:4px 14px;border-radius:12px;
                display:inline-block;margin-bottom:12px;">{v.get('tag','')}</div>
              <div style="font-family:'Newsreader',serif;font-weight:700;
                font-size:28px;color:{text_color};margin-bottom:8px;">{v.get('title','')}</div>
              <div style="font-family:'Inter';font-size:20px;color:{dim_color};
                line-height:1.4;">{v.get('text','')}</div>
            </div>
            '''

        content = f'''
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;
          padding:80px 120px;">
          {badge_html}
          <div style="font-family:'Newsreader',Georgia,serif;font-weight:700;
            font-size:64px;color:{text_color};line-height:1.08;letter-spacing:-2px;
            margin-bottom:28px;">{title}</div>
          {verdicts_html}
          <div style="font-family:'Newsreader',serif;font-style:italic;
            font-size:24px;color:{accent};margin-top:12px;">{takeaway}</div>
        </div>
        '''

    elif stype == 'deep_dive':
        title = slide.get('title', '').replace('<em>', f'<em style="color:{accent};font-style:normal;">')
        sub = slide.get('sub', '')
        code = hl(slide.get('code', ''))

        content = f'''
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;
          padding:80px 120px;">
          {badge_html}
          <div style="font-family:'Newsreader',Georgia,serif;font-weight:700;
            font-size:48px;color:{text_color};line-height:1.1;letter-spacing:-1px;">{title}</div>
          <div style="font-family:'Inter';font-size:22px;color:{dim_color};
            margin:12px 0 20px;">{sub}</div>
          <div style="background:#1d1d1f;border-radius:16px;padding:28px 32px;
            font-family:'JetBrains Mono',monospace;font-size:17px;
            color:#e5e5e7;line-height:1.7;text-align:left;
            white-space:pre-wrap;">{code}</div>
        </div>
        '''

    elif stype == 'save':
        title = slide.get('title', '').replace('<em>', f'<em style="color:{accent};font-style:normal;">')
        items = slide.get('items', [])
        question = slide.get('question', '')

        items_html = ''
        for item in items:
            label = item.get('label', '')
            desc = item.get('desc', item.get('text', ''))
            items_html += f'''
            <div style="display:flex;align-items:flex-start;gap:16px;padding:16px 0;
              border-bottom:1px solid {'rgba(255,255,255,0.06)' if is_dark else 'rgba(0,0,0,0.06)'};">
              <div style="font-family:'JetBrains Mono',monospace;font-weight:700;
                font-size:18px;color:{accent};min-width:140px;">{label}</div>
              <div style="font-family:'Inter';font-size:20px;color:{dim_color};
                line-height:1.4;">{desc}</div>
            </div>
            '''

        content = f'''
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;
          padding:80px 120px;">
          <div style="font-family:'Inter';font-weight:700;font-size:18px;
            color:{accent};letter-spacing:1px;margin-bottom:8px;">📌 SAVE THIS</div>
          <div style="font-family:'Newsreader',Georgia,serif;font-weight:700;
            font-size:44px;color:{text_color};line-height:1.1;margin-bottom:24px;">{title}</div>
          {items_html}
          <div style="font-family:'Newsreader',serif;font-style:italic;
            font-size:24px;color:{dim_color};margin-top:20px;">{question}</div>
        </div>
        '''

    elif stype == 'cta':
        teaser = slide.get('teaser', '').replace('<em>', f'<em style="color:{accent};font-style:normal;">')
        tagline = slide.get('tagline', 'Pro snippets. Zero fluff.')

        content = f'''
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;
          align-items:center;text-align:center;gap:24px;padding:80px 120px;">
          <div style="width:80px;height:80px;background:#ED4956;
            border-radius:26% 26% 26% 0;display:flex;align-items:center;
            justify-content:center;color:#fff;font-size:40px;">👤</div>
          <div style="font-family:'Inter';font-weight:800;font-size:44px;
            color:{text_color};">FOLLOW</div>
          <div style="font-family:'JetBrains Mono',monospace;font-weight:700;
            font-size:32px;color:#000;background:{accent};
            padding:14px 44px;border-radius:50px;">@coding_tips_pro</div>
          <div style="font-family:'Newsreader',serif;font-style:italic;
            font-size:28px;color:{dim_color};margin-top:8px;">{tagline}</div>
          <div style="font-family:'Newsreader',serif;font-size:24px;
            color:{dim_color};margin-top:16px;line-height:1.4;">
            {teaser}</div>
        </div>
        '''

    else:
        # Generic content slide
        content = f'''
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;
          padding:80px 162px;text-align:center;align-items:center;">
          {badge_html}
          <div style="font-family:'Inter';font-size:36px;color:{text_color};">
            {slide.get('text', '')}</div>
        </div>
        '''

    # Decorative elements
    deco = slide.get('deco', '')
    deco_html = ''
    if deco == 'glow-top':
        deco_html = f'<div style="position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,{accent}30 0%,transparent 70%);top:-15%;left:40%;filter:blur(40px);z-index:0;"></div>'
    elif deco == 'glow-center':
        deco_html = f'<div style="position:absolute;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,{accent}18 0%,transparent 70%);top:20%;left:10%;filter:blur(40px);z-index:0;"></div>'
    elif deco == 'circle-top':
        deco_html = f'<div style="position:absolute;width:500px;height:500px;border-radius:50%;background:{accent};opacity:0.1;top:-12%;right:-12%;z-index:0;"></div>'
    elif deco == 'circle-bottom':
        deco_html = f'<div style="position:absolute;width:550px;height:550px;border-radius:50%;background:{accent};opacity:0.1;bottom:-15%;left:-10%;z-index:0;"></div>'
    elif deco == 'line-accent':
        deco_html = f'<div style="position:absolute;top:0;left:0;right:0;height:6px;background:{accent};z-index:3;"></div>'

    gradient_style = ''
    if slide.get('gradient'):
        gradient_style = f'background:{slide["gradient"]};'

    return f'''
    <div class="slide" style="{bg_style}{gradient_style}">
      {deco_html}
      {content}
      {watermark}
    </div>
    '''


def render_v2(content_json: dict, out_dir: str = None) -> list:
    slides = content_json.get('slides', [])
    if not slides:
        print("Error: No slides in content JSON")
        sys.exit(1)

    topic = content_json.get('topic', 'post').replace(' ', '_').lower()
    if out_dir is None:
        out_dir = ENGINE_DIR.parent / "content" / f"carousel_{topic}"
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Build full HTML document
    slides_html = ''
    for i, slide in enumerate(slides):
        slides_html += build_slide_html(slide, i, len(slides), content_json)

    full_html = f'''<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>{FONTS_CSS}{BASE_CSS}</style>
</head><body>{slides_html}</body></html>'''

    rendered_path = out_dir / "slides.html"
    rendered_path.write_text(full_html)

    # Render with Playwright
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Error: playwright not installed")
        sys.exit(1)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 1200})
        page.goto(f"file://{rendered_path.resolve()}", wait_until="networkidle")
        page.wait_for_timeout(3000)

        slide_els = page.query_selector_all(".slide")
        paths = []
        for i, el in enumerate(slide_els):
            path = str(out_dir / f"slide_{i+1}.png")
            el.screenshot(path=path)
            paths.append(path)
            print(f"  Slide {i+1}/{len(slide_els)}: {path}")

        browser.close()
        return paths


def main():
    parser = argparse.ArgumentParser(description="Render V2 — unique slides per post")
    parser.add_argument("content", help="Path to content JSON file")
    parser.add_argument("--out", "-o", help="Output directory")
    args = parser.parse_args()

    with open(args.content) as f:
        content = json.load(f)

    print(f"\n  Rendering V2: {content.get('topic', 'untitled')}")
    print(f"  Slides: {len(content.get('slides', []))}")
    print()

    paths = render_v2(content, out_dir=args.out)
    print(f"\n  Done! {len(paths)} slides rendered.")
    print(f"  Output: {os.path.dirname(paths[0])}")


if __name__ == "__main__":
    main()
