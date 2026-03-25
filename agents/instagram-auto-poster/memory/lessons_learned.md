# Lessons Learned

## SOTA Awareness (Updated 2026-03-20)
- Your knowledge is STALE. AI moves faster than your training data. Always research before creating.
- "AI builds an app" is 2024 content. Table stakes. Nobody is impressed.
- SOTA in March 2026: autonomous AI agent workforce — swarm intelligence, agent orchestration, agents controlling browsers/robots, 100K-star agent frameworks appearing in a single week.
- Before ANY reel creation: fetch GitHub trending weekly, search latest AI news, verify assumptions.

## Growth Mechanics
- SHARES are the #1 growth signal for reels, not saves, not comments.
- Saves are #1 for CAROUSELS (reference/utility content people bookmark).
- "Comment X to get Y" is engagement bait — Instagram detects and deprioritizes it.
- Content spreads within peer clusters: 18-year-old shares with other 18-year-olds. Design for the group chat.
- The group chat test: "Would an 18-year-old send this to their developer group chat?" If you can't write the message they'd send with it, the reel won't spread.
- Prompted/identical comments are worthless — they select for freebie-seekers, not followers.

## Reel Philosophy
- A reel is NOT an animated carousel. If the content works as static slides, it should be a carousel.
- The video format must be essential to the content — motion, timing, or demonstration.
- Represent, don't literally demo. The audience needs to FEEL what's remarkable in 2 seconds. Abstract representation > literal screen recording.
- BAIT (1-2s) → CONTEXT (2-3s) → REVEAL (3-5s) → PAYOFF (2-3s)
- The hook doesn't need to be related to the content. Its only job is to stop the thumb.

## CRITICAL BUG: Tutorial Reveal Number Repetition
- Claude's training data defaults to "5 things" for every listicle. This is a deeply ingrained pattern.
- EVERY tutorial_reveal post so far used the number 5. Python one-liners: 5. React hooks: 5. TS Decorators: 5. JS Array Methods: 5. Agent repos: 5. This makes the grid look like a bot.
- BEFORE creating any tutorial_reveal: run `grep tutorial_reveal posts.tsv` and extract the numbers used. Pick a DIFFERENT number. Valid options: 3, 4, 6, 7, 8, 10.
- DO NOT USE 5 for the next several tutorial_reveal posts. The number 5 is banned until the grid has variety.
- This is not a guideline. This is a hard rule. If the post has 5 items, rewrite it with a different count before rendering.

## Rendering Quality
- ALWAYS read an existing rendered slide (e.g., content/carousel_*/slide_1.png) BEFORE creating new content to match the visual style
- The `-c` continuation mode once produced inconsistent colors/formatting — the cron prompt must explicitly load templates and verify renders visually before publishing
- Never publish without reading the rendered PNG to verify it looks correct

## Reel Design Rules
- Keep reels SHORT: 12-18 seconds max, not 27s
- Center all text vertically and horizontally — no floating text in empty space
- Faster pacing — hook must land in 2 seconds, not 4
- Fill the 1080x1920 frame — no excessive whitespace
- Audio: smooth fade-in (2s) and fade-out (3s) on music
- Code blocks should be large and fill most of the width

## Cron Execution Rules
- Every cron run must: read posts.tsv → read CONTENT_STRATEGY.md → check insights → create → render → VERIFY visually → publish → update posts.tsv → update CONTENT_STRATEGY.md → git commit
- Alternate post types: snippet_battle → tutorial_reveal → reel → repeat
- Rotate languages for CAROUSELS — never repeat the last carousel's language
- Reels CAN repeat language — reels focus on Claude Code tips, 10x developer content, and "code behind everything" stories
- Reel topics: pick from "Reel Ideas" section in CONTENT_STRATEGY.md
- Never duplicate a topic from posts.tsv
- After publishing, commit changes to git

## Publishing
- publish_carousel.py handles BOTH carousels and reels (auto-detected)
- Reels: JSON with "scenes" key → auto-detected as reel
- Carousels: JSON with "template" key → auto-detected as carousel
- Always verify the media ID is returned before updating posts.tsv
