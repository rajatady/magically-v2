# @coding_tips_pro — Automated Instagram Publisher

Autonomous carousel publishing pipeline for the @coding_tips_pro Instagram account. Pro-level programming tips, A/B code quizzes, and cheat sheets.

## Quick Start

```bash
cd coding_tips_pro

# 1. Create content JSON
# (see content/post_*.json for examples)

# 2. Render + publish in one command
python publish_carousel.py content/post_xyz.json

# 3. Check analytics
python insights.py
```

## Project Structure

```
coding_tips_pro/
├── .env                        # API tokens (never commit)
├── posts.tsv                   # ALL posts tracked — READ THIS FIRST
├── CONTENT_STRATEGY.md         # What to post, topic backlog, rules
├── README.md                   # This file
├── insights.py                 # Analytics CLI (free)
├── publish_carousel.py         # Publish CLI
├── analytics.db                # Timestamped metric snapshots
├── carousel_engine/
│   ├── render.py               # JSON → HTML → Playwright → PNGs
│   └── templates/
│       └── coding_tips.html    # Carousel template (cream/amber/code)
├── content/
│   ├── post_*.json             # Content definitions
│   └── carousel_*/             # Rendered PNGs per post
└── existing_content/           # Downloaded slides from original 4 posts
```

## IMPORTANT: Before Creating Content

**Always read `posts.tsv` first** to avoid duplicating topics:

```bash
cat posts.tsv | column -t -s $'\t'
```

The `topic` and `notes` columns tell you what's been posted. The `lang` column shows language coverage.

Also check `CONTENT_STRATEGY.md` for the topic backlog and queued ideas.

## Content JSON Format

Each post is a JSON file with slides:

```json
{
  "topic": "short_topic_name",
  "caption": "Instagram caption with hashtags...",
  "slides": [
    {
      "type": "ab_question",
      "question": "Which is <em>better</em>?",
      "subtitle": "Context line",
      "badge": "JS · 2026",
      "option_a": { "label": "Option A name", "code": "code here" },
      "option_b": { "label": "Option B name", "code": "code here" },
      "cta": "Pick one. Then swipe."
    },
    {
      "type": "reveal",
      "title": "B wins. <em>Every time.</em>",
      "cards": [
        { "verdict": "loser", "label": "OPTION A", "title": "Why it's worse", "text": "..." },
        { "verdict": "winner", "label": "OPTION B", "title": "Why it's better", "text": "..." }
      ],
      "takeaway": "Italic takeaway line"
    },
    {
      "type": "code_showcase",
      "title": "How <em>it works</em>",
      "intro": "Short intro",
      "code": "actual code here",
      "explanation": "What this does. <strong>Bold</strong> for emphasis."
    },
    {
      "type": "save_card",
      "title": "Cheat <em>sheet</em>",
      "items": [
        { "icon": "✅", "text": "Point one" },
        { "icon": "⚠️", "text": "Point two" }
      ],
      "prompt": "Question for comments? 👇"
    },
    {
      "type": "follow_cta",
      "teaser": "Next: <em>topic teaser</em> for next post",
      "tagline": "Pro snippets. Zero fluff. Daily."
    }
  ]
}
```

### Slide Types

| Type | Purpose | When to Use |
|------|---------|-------------|
| `ab_question` | A/B code quiz hook | Always slide 1 — the hook |
| `reveal` | Answer with verdict cards | Slide 2 — the answer |
| `code_showcase` | Code block with explanation | Slide 3 — deeper dive |
| `save_card` | Saveable reference/cheat sheet | Slide 4 — save trigger |
| `follow_cta` | Teaser for next post + handle | Last slide — follow trigger |

### Syntax Highlighting in Code

The template auto-highlights:
- **Keywords**: `const`, `let`, `var`, `function`, `return`, `if`, `else`, `new`, `async`, `await`, `class`, `using`, etc.
- **Strings**: Single/double/backtick quoted
- **Numbers**: Integer and float
- **Types**: PascalCase words (`Date`, `Map`, `Promise`, etc.)
- **Functions**: `.methodName(` pattern
- **Comments**: `// comment`

Use `<em>text</em>` in titles for amber/italic accent.

## CLI Reference

### Publish a Carousel

```bash
# From JSON (renders + publishes)
python publish_carousel.py content/post_xyz.json

# From pre-rendered directory
python publish_carousel.py content/carousel_xyz/

# Dry run (renders + uploads but doesn't publish)
python publish_carousel.py content/post_xyz.json --dry-run

# Override caption
python publish_carousel.py content/post_xyz.json --caption "Custom caption"
```

### Render Only (no publish)

```bash
python carousel_engine/render.py content/post_xyz.json
# Output: content/carousel_<topic>/slide_*.png
```

### Check Analytics

```bash
python insights.py              # Overview with engagement scores
python insights.py --reel <id>  # Single post detail
python insights.py --account    # Account stats
python insights.py --growth     # Growth from stored snapshots
python insights.py --no-save    # Don't save snapshot
```

## Posts Tracking (posts.tsv)

| Column | Description |
|--------|-------------|
| `id` | Instagram media ID |
| `date` | Published date |
| `topic` | Short topic name (for dedup) |
| `caption_start` | First ~60 chars of caption |
| `media_type` | `carousel`, `reel`, or `image` |
| `slides` | Number of slides (carousels only) |
| `views` | Play count (reels) or 0 (carousels) |
| `reach` | Unique accounts reached |
| `likes` | Like count |
| `saves` | Save count (key metric) |
| `shares` | Share count |
| `comments` | Comment count |
| `avg_watch_s` | Average watch time in seconds (reels only) |
| `status` | `live`, `deleted`, `draft` |
| `notes` | Free text — format, strategy notes, what worked |
| `lang` | Primary language: `javascript`, `typescript`, `react`, `rust`, `python`, `cpp`, `ml` |

## Token Setup

The `.env` file needs:

```env
IG_CT_ACCESS_TOKEN=<Instagram Graph API token>
IG_CT_ACCOUNT_ID=<Instagram account ID>
BLOB_READ_WRITE_TOKEN=<Vercel Blob token for temp image hosting>
FB_APP_SECRET=<Meta app secret — for token refresh>
```

### Token Refresh

The IG token lasts ~60 days. To refresh:

```bash
curl "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=$IG_CT_ACCESS_TOKEN"
```

This returns a new token valid for another 60 days. Update `.env` with the new value.

## Content Strategy

See [CONTENT_STRATEGY.md](CONTENT_STRATEGY.md) for:
- Content pillars and formats
- Language coverage priorities
- Topic backlog (what to post next)
- Posting rules and cadence
- Metrics that matter
