# Design V2 — Visual System (Approved March 2026)

## Brand DNA (same across ALL post types)
- **Fonts**: Newsreader (serif, headlines), Inter (body/labels), JetBrains Mono (code)
- **Margins**: 15% horizontal minimum (162px on 1080px canvas). Content must NEVER touch the edges.
- **Canvas**: 1080×1080px. Grid shows 3:4 crop (left/right 12.5% cropped). Keep important content in center 75% width.
- **Code blocks**: Dark (#1d1d1f), rounded corners (16-20px), syntax highlighted
- **Watermark**: @coding_tips_pro in JetBrains Mono, bottom-right, subtle
- **Each slide has ONE job** — one idea, one visual, one takeaway
- **No templates** — every slide is custom HTML composed from brand rules

## Three Content Types — Color Coding

### 1. SOTA / Trending (Dark)
- Background: #0a0a0a with accent glows/circles
- Text: #f5f5f7 (white), accent colors vary per post
- Subtitle: Newsreader italic, rgba(255,255,255,0.5)
- Decorative: radial gradients, blurred circles, subtle glows
- Badge: accent color pill
- Purpose: Breaking news, trending repos, industry stats

### 2. Snippet Battle (Dark gradient + glassmorphism)
- Background: dark gradient (e.g., linear-gradient(160deg, #0a0a0a 0%, #1a1020 50%, #0a0a0a 100%))
- Gradient tint varies per post (purple, amber, blue, teal, green)
- Question: Newsreader serif, 80px+, white
- Problem context: Inter 26px, rgba(255,255,255,0.4)
- Code cards: glassmorphic (rgba(255,255,255,0.04), backdrop-blur, subtle border)
- A/B circles: orange (#ff9f0a) for A, blue (#2997ff) for B
- "Pick one. Then swipe." in Newsreader italic, rgba(255,255,255,0.35)
- Code: 85% width, centered
- Purpose: A/B code comparison quiz

### 3. Tutorial Reveal (Soft pastel backgrounds)
- Background: soft pastel color unique per post topic:
  - CSS: #c8f5e8 (mint), accent #0d9373
  - Git: #ffe4c4 (peach), accent #c66d00
  - TypeScript: #dde0ff (lavender), accent #3451b2
  - React: #c4ecff (sky), accent #0880a8
  - Python: #ffd6d4 (rose), accent #c0392b
  - Node.js: #e4d6ff (lilac), accent #7c3aed
  - (New topics get new pastel + accent pairs)
- Number: Inter 900, 300px, accent color
- Label: Newsreader serif 600, 38-44px, dark (#1d1d1f)
- Decorative: subtle glow behind number
- Internal slides: dark backgrounds with accent color
- Purpose: Listicle / N-items spotlight. N varies (3, 4, 6, 7, 8 — NEVER default to 5)

## What's SAME across types
- Fonts (Newsreader, Inter, JetBrains Mono)
- Code block styling (dark, rounded, syntax highlighted)
- Margin rules (15% horizontal)
- Watermark placement
- CTA slide structure (handle pill + "Follow for more")

## What's DIFFERENT per post (even within same type)
- Slide layouts — each slide composed fresh for its content
- Title sizes — based on text length and emphasis needed
- Code line counts — vary between snippets
- Decorative element positions — circles, glows placed differently
- Color accents — even within a type, accent colors vary
- Slide count — different per post
- Content flow — story arc is unique to each topic

## What to NEVER do
- Don't copy a previous post's layout verbatim
- Don't default to 5 items in tutorial_reveal
- Don't use the same gradient tint for adjacent snippet battles
- Don't let text touch the crop zone (outer 12.5% on each side)
- Don't make every slide have the same visual weight
