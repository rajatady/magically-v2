#!/usr/bin/env python3
"""
Word-by-word transcription of all MP4s in the dreamer folder.
Uses openai-whisper with word-level timestamps.
Output: one JSON per video + a combined TXT with word timings.
"""

import whisper
import json
import os
import sys
from pathlib import Path

DREAMER_DIR = Path.home() / "dreamer"
MODEL_SIZE = "large-v3"  # best quality; change to "turbo" for speed

VIDEOS = [
    ("dreamer-platform.mp4", "Dreamer Platform"),
    ("home.mp4", "Home"),
    ("sidekick.mp4", "Sidekick"),
    ("gallery-tools.mp4", "Gallery & Tools"),
    ("build-section.mp4", "Build (section)"),
    ("remix.mp4", "Remix"),
    ("build-mobile.mp4", "Build (mobile)"),
    ("calendar-hero.mp4", "Calendar Hero"),
    ("superdo.mp4", "SuperDo"),
    ("smartgroceries.mp4", "SmartGroceries"),
    ("health-coach.mp4", "Health Coach"),
    ("attain-finance.mp4", "Attain Finance"),
]


def format_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def transcribe_video(model, video_path: Path, title: str):
    print(f"\n{'='*60}")
    print(f"Transcribing: {title} ({video_path.name})")
    print(f"{'='*60}")

    result = model.transcribe(
        str(video_path),
        word_timestamps=True,
        verbose=False,
        language="en",
    )

    # Save full JSON
    json_path = video_path.with_suffix(".json")
    with open(json_path, "w") as f:
        json.dump(result, f, indent=2)

    # Save word-by-word TXT
    txt_path = video_path.with_suffix(".words.txt")
    with open(txt_path, "w") as f:
        f.write(f"# {title}\n\n")
        for seg in result.get("segments", []):
            words = seg.get("words", [])
            for w in words:
                start = format_time(w["start"])
                end = format_time(w["end"])
                word = w["word"].strip()
                f.write(f"[{start} --> {end}]  {word}\n")

    print(f"  Saved: {json_path.name}")
    print(f"  Saved: {txt_path.name}")

    # Print a preview
    all_words = [
        w for seg in result.get("segments", []) for w in seg.get("words", [])
    ]
    print(f"  Total words: {len(all_words)}")
    print(f"  Preview (first 10 words):")
    for w in all_words[:10]:
        print(f"    [{format_time(w['start'])}]  {w['word'].strip()}")

    return result


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else None

    print(f"Loading Whisper model: {MODEL_SIZE}")
    model = whisper.load_model(MODEL_SIZE)
    print("Model loaded.")

    for filename, title in VIDEOS:
        if target and target.lower() not in filename.lower():
            continue

        video_path = DREAMER_DIR / filename
        if not video_path.exists():
            print(f"  SKIP (not downloaded yet): {filename}")
            continue

        # Skip if already transcribed
        json_path = video_path.with_suffix(".json")
        if json_path.exists():
            print(f"  SKIP (already transcribed): {filename}")
            continue

        transcribe_video(model, video_path, title)

    print("\nAll done!")


if __name__ == "__main__":
    main()
