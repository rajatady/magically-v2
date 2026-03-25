# V3 Render Engine — Critical Context

## The Decision (March 22, 2026)

### Two-Layer Architecture
**Layer 1: Renderer (Engine)**
- JSON-driven flexible canvas renderer
- Background layer: solid, gradient, image + stackable decorations (circles, shapes)
- Content area: 80% of 1080×1080 (10% margin each side = 20% total)
- All positioning uses PERCENTAGE properties: xPct, yPct, wPct, hPct
- ALL percentage properties MUST have "Pct" suffix in the name — mission critical to avoid confusion
- Code blocks: use Monaco Editor with our syntax theme, pass raw code + language, no manual HTML spans
- Font specified as name + sizePct (percentage of canvas)
- File: carousel_engine/render_v3.py

**Layer 2: Templates (Per Content Type)**
- Templates define the AESTHETIC (colors, fonts, mood) — not the layout
- SOTA: dark bg, accent glows, editorial typography
- Snippet Battle: dark gradient, glassmorphic cards, Newsreader question
- Tutorial Reveal: soft pastel backgrounds, big number, Newsreader label
- Inner slides follow the SAME background/color as slide 1
- Templates are starting points — each post customizes freely within the aesthetic

### Three Sources to Learn From
1. **2022 Posts** — Content strategy. Story arc: problem with REAL DATA → transformation → revelation ("That's it!") → bonus ("WAIT, THERE'S MORE") → bold CTA. Each slide has ONE job. Celebration moments. Human names in arrays, not abstract "obj".
2. **V1 Published Posts** — Internal slide positioning was good (title + code block + punchline layout). Color palette was NOT good (cream/yellow monotony). Code block sizing and font were decent.
3. **Grid Preview (React)** — First-page/thumbnail strategy is approved. Color coding works. Dark SOTA, dark gradient snippet battles, soft pastel tutorial reveals. Font system (Newsreader, Inter, JetBrains Mono) approved.

### What to Combine
- 2022's content strategy + story arc + real data + engagement flow
- V1's internal slide positioning + code block layout
- Grid preview's color coding + thumbnail design + font system
- V3's flexible rendering engine

### Color Coding (FINAL)
- **SOTA**: dark (#0a0a0a) with accent glows
- **Snippet Battle**: dark gradient (linear-gradient with colored tints), glassmorphic cards
- **Tutorial Reveal**: soft pastel (mint, peach, lavender, sky, rose, lilac)
- Color extends to ALL slides within a post — consistent background throughout
- Tutorial reveal item slides: pastel bg + dark code block cards

### Key Rules
- 20% margins on ALL sides, ALL slides
- Large fonts, focused messaging
- Each slide is distinct in composition — no two slides look alike even within same post
- Never default to 5 items in tutorial_reveal
- Number variety: 3, 4, 6, 7, 8 — check posts.tsv before picking
- All content must use REAL DATA (actual names, actual values) not abstract placeholders
- Revelation moment on every snippet battle ("That's it!" energy)
- Bonus value slide on every post ("Also handles...", "WAIT — there's more")
- Bold CTA slide that fills the frame

## Cron Job (Session-Only, Dies on Exit)
Every 4 hours at :17 — the autonomous growth engine runs:
1. Check insights
2. Read posts.tsv — last post type/template/lang
3. Read CONTENT_STRATEGY.md — topic backlog
4. Read memory/lessons_learned.md — rules
5. Rotate: snippet_battle → tutorial_reveal → reel (skipped) → snippet_battle
6. Pick topic from queued, cross-check posts.tsv for duplicates
7. Create JSON, render, VERIFY visually, publish
8. Update posts.tsv, CONTENT_STRATEGY.md, git commit

Cron prompt (verbatim):
```
AUTONOMOUS GROWTH ENGINE — execute the full cycle:
STEP 1 — CONTEXT LOAD: insights, posts.tsv, CONTENT_STRATEGY.md, lessons_learned.md
STEP 2 — DECIDE: rotation, language rotation, number variety
STEP 3 — PICK TOPIC: from queued, no duplicates
STEP 4 — CREATE & RENDER: verify visually before publishing
STEP 5 — PUBLISH: python publish_carousel.py
STEP 6 — UPDATE TRACKING: posts.tsv + CONTENT_STRATEGY.md
STEP 7 — COMMIT
```

## File Tree
```
coding-tips-pro/
├── CLAUDE.md                    ← Master instructions + SOTA awareness
├── CONTENT_STRATEGY.md          ← Topic backlog, content pillars, algorithm priorities
├── posts.tsv                    ← ALL published posts
├── insights.py                  ← Analytics CLI
├── publish_carousel.py          ← Publish carousels AND reels
├── memory/
│   ├── MEMORY.md
│   ├── project_context.md
│   ├── lessons_learned.md       ← Rendering rules, cron rules, growth mechanics
│   ├── design_v2.md             ← Approved visual system
│   └── v3_render_engine.md      ← THIS FILE
├── carousel_engine/
│   ├── render.py                ← V1 renderer (HTML templates)
│   ├── render_v2.py             ← V2 renderer (inline HTML, no templates)
│   ├── render_v3.py             ← V3 renderer (flexible canvas, percentage-based)
│   └── templates/
│       ├── snippet_battle.html  ← V1 template
│       └── tutorial_reveal.html ← V1 template
├── reel_engine/
│   ├── render.py                ← PIL-based reel renderer (dark mode)
│   └── music/                   ← 4 background tracks
├── content/
│   ├── post_*.json              ← V1 post content files
│   ├── carousel_*/              ← V1 rendered PNGs
│   ├── reel_*/                  ← Reel rendered MP4s + frames
│   ├── v2/                      ← V2 rendered outputs + grid comparison PNGs
│   └── v3/                      ← V3 post JSONs + rendered outputs
├── grid_preview/                ← React grid simulator app
│   ├── src/
│   │   ├── App.tsx              ← Side-by-side grid comparison
│   │   ├── data/posts.ts        ← 24 post definitions (mockup data)
│   │   └── components/
│   │       ├── Slide.tsx        ← Slide renderer (React)
│   │       ├── Grid.tsx         ← Mockup grid
│   │       ├── RenderedGrid.tsx ← Rendered PNG grid
│   │       ├── PostModal.tsx    ← Carousel modal (mockup)
│   │       └── RenderedModal.tsx← Carousel modal (rendered PNGs)
│   └── public/rendered → ../content/v2/  ← Symlink
├── reel_remotion/               ← Remotion project (5 test reels)
├── existing_content/            ← 2022 original posts (4 posts, reference)
└── .env                         ← API tokens
```

## What's NOT Done Yet
- Reels format not finalized — need audio-synced approach
- V3 renderer needs Monaco Editor integration for code blocks
- V3 percentage property names need "Pct" suffix everywhere
- 4 complete reference posts not finished (only structuredClone started)
- Inner slide designs need work — current output doesn't match the quality bar
- Grid simulator needs the 4 reference posts added at top
- No ad data from IG-backed account (act_827274515197451) — API blocked

## What IS Done
- 29 posts published on Instagram
- 595 followers
- Growth engine cron (session-only, needs re-setup each session)
- Ad account connected (act_2362500660494705 readable via API)
- India targeting added to boosts (6x cheaper CPM)
- Content strategy updated with SOTA awareness
- Visual system approved (3 content types, color coding, fonts)
- Grid preview React app with 24 posts (mockup + rendered comparison)
