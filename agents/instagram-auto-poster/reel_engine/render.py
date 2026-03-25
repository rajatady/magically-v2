#!/usr/bin/env python3
"""
Reel Engine v2 — @coding_tips_pro
Dark mode. Apple aesthetic. Every pixel intentional.

PIL-based frame rendering → FFmpeg MP4 mux.

Scene types:
  hook        — Full-screen bait text. Stop the thumb.
  code        — Terminal-style code block, types in character by character
  text        — Large centered text with staggered reveal
  brand       — Minimal end card

Usage:
  python reel_engine/render.py content/reel_xyz.json
"""

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ─── Dimensions ───
W, H = 1080, 1920
FPS = 30

# ─── Dark Mode Palette (Apple-inspired) ───
BG = (8, 8, 12)                    # Near black
BG_CARD = (18, 18, 24)             # Slightly lighter for cards
WHITE = (245, 245, 247)            # Not pure white — soft
DIM = (120, 120, 130)              # Muted text
FAINT = (60, 60, 68)               # Very subtle
ACCENT = (99, 102, 241)            # Indigo — primary accent
ACCENT2 = (168, 85, 247)           # Purple — secondary
GREEN = (34, 197, 94)              # Terminal green
RED = (239, 68, 68)                # Warning red
AMBER = (251, 191, 36)             # Highlight

# Syntax highlighting
SYN_KW = (197, 134, 192)
SYN_STR = (206, 145, 120)
SYN_NUM = (181, 206, 168)
SYN_TYPE = (78, 201, 176)
SYN_FN = (220, 220, 170)
SYN_COMMENT = (106, 153, 85)
SYN_DEFAULT = (212, 212, 212)
SYN_PROP = (156, 220, 254)

# ─── Fonts ───
FONT_DIR = os.path.expanduser("~/Library/Fonts")
FONTS = {
    "headline": os.path.join(FONT_DIR, "Newsreader-VariableFont_opsz,wght.ttf"),
    "headline_i": os.path.join(FONT_DIR, "Newsreader-Italic-VariableFont_opsz,wght.ttf"),
    "body": os.path.join(FONT_DIR, "DMSans-VariableFont_opsz,wght.ttf"),
    "mono": os.path.join(FONT_DIR, "JetBrainsMono-Bold.ttf"),
    "mono_r": os.path.join(FONT_DIR, "JetBrainsMono-Regular.ttf"),
    "mono_m": os.path.join(FONT_DIR, "JetBrainsMono-Medium.ttf"),
}
for k in ["mono_r", "mono_m"]:
    if not os.path.exists(FONTS[k]):
        FONTS[k] = FONTS["mono"]

# ─── Music ───
MUSIC_DIR = Path(__file__).parent / "music"
MUSIC_MAP = {
    "epic": "kornevmusic-epic-478847.mp3",
    "motivation": "paulyudin-motivation-485931.mp3",
    "energetic": "alexgrohl-energetic-action-sport-500409.mp3",
    "cinematic": "the_mountain-cinematic-cinematic-music-489998.mp3",
}


def font(name, size):
    path = FONTS.get(name, FONTS["headline"])
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


# ─── Easing ───
def ease_out(t):
    t = min(max(t, 0), 1)
    return 1 - (1 - t) ** 3

def ease_in_out(t):
    t = min(max(t, 0), 1)
    return 3 * t * t - 2 * t * t * t


# ─── Drawing ───
def color_alpha(c, a):
    return (*c[:3], int(min(max(a, 0), 255)))

def draw_centered(draw, text, y, fnt, color, img_w=W):
    bbox = draw.textbbox((0, 0), text, font=fnt)
    tw = bbox[2] - bbox[0]
    x = (img_w - tw) // 2
    draw.text((x, y), text, font=fnt, fill=color)
    return bbox[3] - bbox[1]

def wrap_text(draw, text, fnt, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = f"{cur} {w}".strip()
        if draw.textbbox((0, 0), test, font=fnt)[2] > max_w and cur:
            lines.append(cur)
            cur = w
        else:
            cur = test
    if cur:
        lines.append(cur)
    return lines

def draw_glow(img, cx, cy, radius, color, intensity=0.2):
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r in range(radius, 0, -4):
        a = int(intensity * 255 * (r / radius) ** 0.5 * (1 - r / radius))
        a = max(0, min(255, a))
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color_alpha(color, a))
    img.alpha_composite(glow)

def tokenize_js(code):
    tokens = []
    patterns = [
        (r'//.*$', SYN_COMMENT),
        (r'/\*[\s\S]*?\*/', SYN_COMMENT),
        (r"'[^']*'", SYN_STR),
        (r'"[^"]*"', SYN_STR),
        (r'`[^`]*`', SYN_STR),
        (r'\b\d+\.?\d*\b', SYN_NUM),
        (r'\b(?:const|let|var|function|return|if|else|for|while|new|class|import|export|from|async|await|typeof|using|yield|try|catch|throw)\b', SYN_KW),
        (r'\b(?:Array|Object|String|Number|Boolean|Promise|Map|Set|console|document|null|undefined|true|false|this)\b', SYN_TYPE),
        (r'\b([a-zA-Z_$][\w$]*)\s*(?=\()', SYN_FN),
        (r'(?<=\.)([a-zA-Z_$][\w$]*)', SYN_PROP),
        (r'=>', SYN_KW),
        (r'[{}()\[\];,.:?!<>=+\-*/&|^~%]', SYN_DEFAULT),
    ]
    pos = 0
    while pos < len(code):
        best, best_start, best_color = None, len(code), SYN_DEFAULT
        for pat, col in patterns:
            m = re.search(pat, code[pos:], re.MULTILINE)
            if m and (pos + m.start()) < best_start:
                best, best_start, best_color = m, pos + m.start(), col
        if best is None:
            tokens.append((code[pos:], SYN_DEFAULT))
            break
        if best_start > pos:
            tokens.append((code[pos:best_start], SYN_DEFAULT))
        tokens.append((best.group(), best_color))
        pos = best_start + len(best.group())
    return tokens


# ─── Scene Renderers ───

def render_scene(scene, scene_idx, total_scenes, badge_text=None):
    hold = scene.get("hold", 3.0)
    fade_in = scene.get("fade_in", 0.4)
    total_dur = fade_in + hold
    num_frames = int(total_dur * FPS)
    frames = []
    stype = scene.get("type", "text")

    for fi in range(num_frames):
        t = fi / FPS
        progress = min(t / fade_in, 1.0) if fade_in > 0 else 1.0
        anim_t = t / total_dur

        img = Image.new("RGBA", (W, H), (*BG, 255))
        draw = ImageDraw.Draw(img)

        if stype == "hook":
            _hook(draw, img, scene, progress, anim_t, t)
        elif stype == "code":
            _code(draw, img, scene, progress, anim_t, t)
        elif stype == "text":
            _text(draw, img, scene, progress, anim_t)
        elif stype == "brand":
            _brand(draw, img, scene, progress, anim_t)
        else:
            _text(draw, img, scene, progress, anim_t)

        frames.append(img.convert("RGB"))
    return frames


def _hook(draw, img, scene, progress, anim_t, t):
    """Full-screen bait. Massive text. Nothing else."""
    lines = scene.get("lines", [])
    color_map = {
        "white": WHITE, "dim": DIM, "accent": ACCENT,
        "green": GREEN, "red": RED, "amber": AMBER,
        "purple": ACCENT2,
    }

    # Subtle background glow — centered, breathing
    glow_pulse = 0.15 + 0.05 * math.sin(t * 1.5)
    draw_glow(img, W // 2, H // 2, 500, ACCENT, glow_pulse * ease_out(progress))

    # Calculate layout — vertically centered
    total_h = 0
    specs = []
    for line in lines:
        size = line.get("size", 96)
        fnt = font("headline", size)
        wrapped = wrap_text(draw, line.get("text", ""), fnt, W - 120)
        line_h = (size + 16) * len(wrapped)
        specs.append((wrapped, size, line.get("color", "white"), line_h))
        total_h += line_h + 24

    cy = (H - total_h) // 2
    for i, (wrapped, size, col, lh) in enumerate(specs):
        lp = ease_out(max(0, min(1, (progress - i * 0.12) / 0.5)))
        if lp <= 0:
            cy += lh + 24
            continue
        alpha = int(lp * 255)
        offset = int((1 - lp) * 40)
        fnt = font("headline", size)
        c = color_map.get(col, WHITE)
        for j, wl in enumerate(wrapped):
            draw_centered(draw, wl, cy + offset + j * (size + 16), fnt, color_alpha(c, alpha))
        cy += lh + 24

    # Thin accent line
    lp2 = ease_out(max(0, (progress - 0.5) / 0.4))
    if lp2 > 0:
        lw = int(260 * lp2)
        lx = (W - lw) // 2
        draw.rounded_rectangle([lx, cy + 10, lx + lw, cy + 14], radius=2,
                               fill=color_alpha(ACCENT, int(lp2 * 180)))

    # Handle — bottom, subtle
    hp = ease_out(max(0, (progress - 0.6) / 0.3))
    if hp > 0:
        draw_centered(draw, "@coding_tips_pro", H - 120,
                      font("mono_r", 18), color_alpha(FAINT, int(hp * 180)))


def _code(draw, img, scene, progress, anim_t, t):
    """Terminal-style code. Dark card, typing animation, green prompt."""
    title = scene.get("title", "")
    code = scene.get("code", "")
    lang = scene.get("lang", "javascript")
    note = scene.get("note", "")

    CODE_SIZE = 24
    LINE_H = 36

    code_lines = code.strip().split('\n')
    total_lines = len(code_lines)
    code_fnt = font("mono_r", CODE_SIZE)

    # Card dimensions — generous, fills most of frame
    pad_x, pad_y = 60, 80
    card_x = 40
    card_w = W - 80
    card_content_h = 60 + total_lines * LINE_H + 40  # dots + code + bottom pad
    card_h = max(card_content_h, 400)

    # Vertically center the card in the frame
    title_h = 80 if title else 0
    note_h = 80 if note else 0
    total_block = title_h + card_h + note_h
    card_y = (H - total_block) // 2 + title_h

    # Title above card
    if title:
        tp = ease_out(min(progress * 2, 1))
        ta = int(tp * 255)
        ty = card_y - 70
        title_fnt = font("body", 22)
        draw_centered(draw, title.upper(), ty, title_fnt,
                      color_alpha(DIM, ta))

    # Card background
    card_alpha = int(ease_out(max(0, (progress - 0.05) / 0.3)) * 255)
    if card_alpha > 0:
        draw.rounded_rectangle(
            [card_x, card_y, card_x + card_w, card_y + card_h],
            radius=16,
            fill=color_alpha(BG_CARD, card_alpha),
            outline=color_alpha(FAINT, card_alpha // 4),
        )

        # Window dots
        dots_y = card_y + 24
        for i, dc in enumerate([(255, 95, 87), (255, 189, 46), (39, 201, 63)]):
            dx = card_x + pad_x + i * 24
            draw.ellipse([dx - 6, dots_y - 6, dx + 6, dots_y + 6],
                         fill=color_alpha(dc, min(card_alpha, 160)))

        # Badge (lang)
        badge = scene.get("label", lang.upper())
        badge_fnt = font("mono_r", 13)
        bbox = draw.textbbox((0, 0), badge, font=badge_fnt)
        bw = bbox[2] - bbox[0] + 16
        bx = card_x + card_w - pad_x - bw
        draw.rounded_rectangle(
            [bx, dots_y - 10, bx + bw, dots_y + 10],
            radius=4,
            fill=color_alpha(FAINT, card_alpha // 2),
        )
        draw.text((bx + 8, dots_y - 8), badge, font=badge_fnt,
                  fill=color_alpha(DIM, card_alpha))

        # Code — character-by-character typing
        code_y_start = dots_y + 36
        full_text = code.strip()
        total_chars = len(full_text)

        # Characters visible — types through over time
        type_start = 0.15  # start typing at 15% of fade_in
        type_progress = max(0, (progress - type_start) / (1 - type_start))
        # During hold, continue typing
        hold_frac = scene.get("fade_in", 0.4) / (scene.get("fade_in", 0.4) + scene.get("hold", 3.0))
        hold_prog = max(0, anim_t - hold_frac) / (1 - hold_frac) if hold_frac < 1 else 0
        chars_frac = type_progress * 0.3 + hold_prog * 0.7
        chars_visible = min(total_chars, int(chars_frac * total_chars * 1.5))
        chars_visible = min(chars_visible, total_chars)

        # Render visible text with syntax highlighting
        visible_text = full_text[:chars_visible]
        vis_lines = visible_text.split('\n')

        for li, line in enumerate(vis_lines):
            tokens = tokenize_js(line) if lang in ("javascript", "js", "typescript", "ts") else [(line, SYN_DEFAULT)]
            cx = card_x + pad_x
            for tok_text, tok_color in tokens:
                if not tok_text:
                    continue
                bbox = draw.textbbox((0, 0), tok_text, font=code_fnt)
                tw = bbox[2] - bbox[0]
                draw.text((cx, code_y_start + li * LINE_H), tok_text,
                          font=code_fnt, fill=color_alpha(tok_color, card_alpha))
                cx += tw

        # Blinking cursor
        if chars_visible < total_chars:
            cursor_on = math.sin(t * 5) > 0
            if cursor_on:
                last_line = vis_lines[-1] if vis_lines else ""
                bbox = draw.textbbox((0, 0), last_line, font=code_fnt)
                cur_x = card_x + pad_x + bbox[2] - bbox[0] + 2
                cur_y = code_y_start + (len(vis_lines) - 1) * LINE_H
                draw.rectangle([cur_x, cur_y, cur_x + 12, cur_y + CODE_SIZE + 4],
                               fill=color_alpha(ACCENT, card_alpha))

    # Note below card
    if note:
        np = ease_out(max(0, (anim_t - 0.65) / 0.25))
        na = int(np * 200)
        ny = card_y + card_h + 30
        note_fnt = font("headline_i", 26)
        wrapped = wrap_text(draw, note, note_fnt, W - 120)
        for i, wl in enumerate(wrapped):
            draw_centered(draw, wl, ny + i * 38, note_fnt, color_alpha(DIM, na))

    # Handle
    hp = ease_out(max(0, (progress - 0.7) / 0.2))
    if hp > 0:
        draw_centered(draw, "@coding_tips_pro", H - 100,
                      font("mono_r", 16), color_alpha(FAINT, int(hp * 140)))


def _text(draw, img, scene, progress, anim_t):
    """Large centered text. Staggered reveal. Fills the frame."""
    lines = scene.get("lines", [])
    color_map = {
        "white": WHITE, "dim": DIM, "accent": ACCENT,
        "green": GREEN, "red": RED, "amber": AMBER,
        "purple": ACCENT2,
    }

    total_h = 0
    for line in lines:
        size = line.get("size", 56)
        total_h += size + 28

    cy = (H - total_h) // 2
    for i, line in enumerate(lines):
        lp = ease_out(max(0, min(1, (progress - i * 0.12) / 0.4)))
        if lp <= 0:
            cy += line.get("size", 56) + 28
            continue
        text = line.get("text", "")
        size = line.get("size", 56)
        col = color_map.get(line.get("color", "white"), WHITE)
        fnt_name = line.get("font", "headline")
        fnt = font(fnt_name, size)
        alpha = int(lp * 255)
        offset = int((1 - lp) * 30)

        wrapped = wrap_text(draw, text, fnt, W - 120)
        for j, wl in enumerate(wrapped):
            draw_centered(draw, wl, cy + offset + j * (size + 12), fnt, color_alpha(col, alpha))
        cy += size + 28

    # Handle
    hp = ease_out(max(0, (progress - 0.6) / 0.3))
    if hp > 0:
        draw_centered(draw, "@coding_tips_pro", H - 100,
                      font("mono_r", 16), color_alpha(FAINT, int(hp * 140)))


def _brand(draw, img, scene, progress, anim_t):
    """Minimal end card. Handle + subtle CTA. Nothing more."""
    alpha = int(ease_out(progress) * 255)

    # Soft glow
    draw_glow(img, W // 2, H // 2 - 40, 300, ACCENT, 0.1 * ease_out(progress))

    # Handle
    hp = ease_out(max(0, (progress - 0.1) / 0.4))
    ha = int(hp * 255)
    handle_fnt = font("mono", 30)
    draw_centered(draw, "@coding_tips_pro", H // 2 - 40, handle_fnt,
                  color_alpha(WHITE, ha))

    # Thin line
    lp = ease_out(max(0, (progress - 0.3) / 0.3))
    if lp > 0:
        lw = int(180 * lp)
        lx = (W - lw) // 2
        ly = H // 2 + 20
        draw.rounded_rectangle([lx, ly, lx + lw, ly + 2], radius=1,
                               fill=color_alpha(ACCENT, int(lp * 120)))

    # Tagline
    tp = ease_out(max(0, (progress - 0.4) / 0.3))
    ta = int(tp * 180)
    tagline = scene.get("tagline", "follow for 10x developer tips")
    draw_centered(draw, tagline, H // 2 + 50, font("body", 22),
                  color_alpha(DIM, ta))

    # Teaser
    teaser = scene.get("teaser", "")
    if teaser:
        tep = ease_out(max(0, (progress - 0.55) / 0.35))
        tea = int(tep * 160)
        # Subtle card
        teaser_fnt = font("headline_i", 24)
        wrapped = wrap_text(draw, teaser, teaser_fnt, W - 200)
        ty = H // 2 + 130
        for i, wl in enumerate(wrapped):
            draw_centered(draw, wl, ty + i * 36, teaser_fnt, color_alpha(FAINT, tea))


# ─── Pipeline ───

def generate_reel(content, out_dir=None):
    topic = content.get("topic", "reel")
    scenes = content.get("scenes", [])
    badge_text = content.get("badge", None)
    music_key = content.get("music", "epic")
    music_start = content.get("music_start", 5)

    if out_dir is None:
        out_dir = Path(__file__).parent.parent / "content" / f"reel_{topic}"
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = out_dir / "frames"
    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    frames_dir.mkdir()

    print(f"\n  Generating reel: {topic}")
    print(f"  Music: {music_key} (start={music_start}s)")

    all_frames = []
    for i, scene in enumerate(scenes):
        sf = render_scene(scene, i, len(scenes), badge_text)
        all_frames.extend(sf)
        dur = scene.get("hold", 3.0) + scene.get("fade_in", 0.4)
        print(f"    Scene {i + 1}/{len(scenes)}: {len(sf)} frames ({dur:.1f}s) [{scene.get('type', 'text')}]")

    for i, frame in enumerate(all_frames):
        frame.save(frames_dir / f"frame_{i:05d}.png")

    total_dur = len(all_frames) / FPS
    print(f"  Total: {len(all_frames)} frames ({total_dur:.1f}s)")

    final_path = out_dir / "final.mp4"
    music_file = MUSIC_MAP.get(music_key)
    music_path = MUSIC_DIR / music_file if music_file else None

    if music_path and music_path.exists():
        fade_in_dur = 1.5
        fade_out_dur = 2.5
        fade_out_start = max(0, total_dur - fade_out_dur)
        audio_filter = (
            f"afade=t=in:st=0:d={fade_in_dur},"
            f"afade=t=out:st={fade_out_start:.2f}:d={fade_out_dur}"
        )
        cmd = [
            "ffmpeg", "-y", "-framerate", str(FPS),
            "-i", str(frames_dir / "frame_%05d.png"),
            "-ss", str(music_start), "-t", str(total_dur),
            "-i", str(music_path),
            "-af", audio_filter,
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-shortest",
            str(final_path),
        ]
    else:
        cmd = [
            "ffmpeg", "-y", "-framerate", str(FPS),
            "-i", str(frames_dir / "frame_%05d.png"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            str(final_path),
        ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ffmpeg error: {result.stderr[-500:]}")
        return None

    size_kb = final_path.stat().st_size / 1024
    print(f"  Output: {final_path} ({size_kb:.0f} KB)")
    return final_path


def main():
    parser = argparse.ArgumentParser(description="Reel Engine v2 — @coding_tips_pro")
    parser.add_argument("content", help="Content JSON file")
    parser.add_argument("--out", "-o", help="Output directory")
    args = parser.parse_args()

    with open(args.content) as f:
        content = json.load(f)

    out_dir = Path(args.out) if args.out else None
    final = generate_reel(content, out_dir)
    if not final:
        sys.exit(1)
    print("\n  Done.")


if __name__ == "__main__":
    main()
