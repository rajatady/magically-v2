#!/usr/bin/env python3
"""
Publish content to @coding_tips_pro — carousels AND reels.

Usage:
  python publish_carousel.py content/post_xyz.json              # Carousel (auto-detected)
  python publish_carousel.py content/reel_css_has.json          # Reel (auto-detected from "scenes" key)
  python publish_carousel.py content/reel_css_has/final.mp4     # Reel from MP4 directly
  python publish_carousel.py content/carousel_xyz/              # Carousel from pre-rendered PNGs
  python publish_carousel.py content/post_xyz.json --dry-run
  python publish_carousel.py content/post_xyz.json --caption "Override"
"""

import argparse
import glob
import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

BLOB_TOKEN = os.environ.get("BLOB_READ_WRITE_TOKEN")
ACCESS_TOKEN = os.environ.get("IG_CT_ACCESS_TOKEN")
IG_ACCOUNT_ID = os.environ.get("IG_CT_ACCOUNT_ID")
API = "https://graph.instagram.com/v25.0"
POSTS_TSV = Path(__file__).parent / "posts.tsv"


# ─── Blob Storage ───

def upload_to_blob(filepath: str, content_type: str = None) -> str:
    """Upload a file to Vercel Blob. Auto-detects content type from extension."""
    ext = os.path.splitext(filepath)[1].lower()
    if content_type is None:
        content_type = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".mp4": "video/mp4",
        }.get(ext, "application/octet-stream")

    filename = f"ctp_{int(time.time())}_{os.path.basename(filepath)}"
    with open(filepath, "rb") as f:
        resp = requests.put(
            f"https://blob.vercel-storage.com/{filename}",
            headers={
                "Authorization": f"Bearer {BLOB_TOKEN}",
                "x-api-version": "7",
                "Content-Type": content_type,
            },
            data=f,
        )
    if resp.status_code != 200:
        print(f"  ERROR: Blob upload failed: {resp.status_code} {resp.text[:200]}")
        return None
    return resp.json()["url"]


def delete_blobs(urls: list):
    if not urls:
        return
    resp = requests.post(
        "https://blob.vercel-storage.com/delete",
        headers={
            "Authorization": f"Bearer {BLOB_TOKEN}",
            "x-api-version": "7",
            "Content-Type": "application/json",
        },
        json={"urls": urls},
    )
    print(f"  Cleaned up {len(urls)} blobs." if resp.status_code == 200 else f"  Blob cleanup warning: {resp.status_code}")


# ─── Instagram API ───

def create_child_container(image_url: str) -> str:
    resp = requests.post(f"{API}/{IG_ACCOUNT_ID}/media", data={
        "image_url": image_url,
        "is_carousel_item": "true",
        "access_token": ACCESS_TOKEN,
    })
    data = resp.json()
    if "id" not in data:
        print(f"  ERROR creating child: {data}")
        return None
    return data["id"]


def create_carousel_container(child_ids: list, caption: str) -> str:
    resp = requests.post(f"{API}/{IG_ACCOUNT_ID}/media", data={
        "media_type": "CAROUSEL",
        "children": ",".join(child_ids),
        "caption": caption,
        "access_token": ACCESS_TOKEN,
    })
    data = resp.json()
    if "id" not in data:
        print(f"  ERROR creating carousel: {data}")
        return None
    return data["id"]


def create_reel_container(video_url: str, caption: str, cover_url: str = None, share_to_feed: bool = True) -> str:
    payload = {
        "media_type": "REELS",
        "video_url": video_url,
        "caption": caption,
        "share_to_feed": str(share_to_feed).lower(),
        "access_token": ACCESS_TOKEN,
    }
    if cover_url:
        payload["cover_url"] = cover_url
    resp = requests.post(f"{API}/{IG_ACCOUNT_ID}/media", data=payload)
    data = resp.json()
    if "id" not in data:
        print(f"  ERROR creating reel container: {data}")
        return None
    return data["id"]


def wait_for_processing(container_id: str, max_attempts: int = 60) -> bool:
    for i in range(max_attempts):
        resp = requests.get(f"{API}/{container_id}", params={
            "fields": "status_code,status",
            "access_token": ACCESS_TOKEN,
        })
        data = resp.json()
        status = data.get("status_code", "UNKNOWN")
        if status == "FINISHED":
            print(f"  Processing complete.")
            return True
        elif status == "ERROR":
            print(f"  ERROR: {data.get('status', '')}")
            return False
        print(f"  Processing... ({i+1}/{max_attempts}) [{status}]", end="\r")
        time.sleep(5)
    print(f"\n  Timed out.")
    return False


def publish_container(container_id: str) -> str:
    resp = requests.post(f"{API}/{IG_ACCOUNT_ID}/media_publish", data={
        "creation_id": container_id,
        "access_token": ACCESS_TOKEN,
    })
    data = resp.json()
    if "id" not in data:
        print(f"  ERROR publishing: {data}")
        return None
    return data["id"]


# ─── Helpers ───

def get_slide_pngs(path: str) -> list:
    pngs = sorted(glob.glob(os.path.join(path, "slide_*.png")))
    if not pngs:
        pngs = sorted(glob.glob(os.path.join(path, "*.png")))
    return pngs


def detect_content_type(input_path: Path, content_json: dict = None) -> str:
    """Detect whether this is a carousel or reel.
    Returns 'reel' or 'carousel'.
    """
    # MP4 file → reel
    if input_path.suffix == ".mp4":
        return "reel"

    # JSON with "scenes" key → reel
    if content_json and "scenes" in content_json:
        return "reel"

    # JSON with "template" key → carousel
    if content_json and "template" in content_json:
        return "carousel"

    # Directory with final.mp4 → reel
    if input_path.is_dir() and (input_path / "final.mp4").exists():
        return "reel"

    # Default: carousel
    return "carousel"


def find_reel_mp4(topic: str, input_path: Path) -> Path:
    """Find the rendered MP4 for a reel topic."""
    # Check content/reel_{topic}/final.mp4
    reel_dir = Path(__file__).parent / "content" / f"reel_{topic}"
    mp4 = reel_dir / "final.mp4"
    if mp4.exists():
        return mp4

    # Check if input is already an MP4
    if input_path.suffix == ".mp4" and input_path.exists():
        return input_path

    # Check if input is a directory with final.mp4
    if input_path.is_dir():
        mp4 = input_path / "final.mp4"
        if mp4.exists():
            return mp4

    return None


# ─── Publish Flows ───

def publish_carousel(slide_paths: list, caption: str, dry_run: bool) -> str:
    """Carousel publish flow: upload PNGs → child containers → carousel → publish."""
    print(f"  Uploading {len(slide_paths)} slides...")
    blob_urls = []
    for i, path in enumerate(slide_paths):
        url = upload_to_blob(path)
        if not url:
            delete_blobs(blob_urls)
            sys.exit(1)
        blob_urls.append(url)
        print(f"    {i+1}/{len(slide_paths)} uploaded")

    print(f"\n  Creating child containers...")
    child_ids = []
    for i, url in enumerate(blob_urls):
        cid = create_child_container(url)
        if not cid:
            delete_blobs(blob_urls)
            sys.exit(1)
        child_ids.append(cid)
        print(f"    Child {i+1}: {cid}")

    print(f"\n  Creating carousel...")
    container_id = create_carousel_container(child_ids, caption)
    if not container_id:
        delete_blobs(blob_urls)
        sys.exit(1)
    print(f"  Container: {container_id}")

    if not wait_for_processing(container_id):
        delete_blobs(blob_urls)
        sys.exit(1)

    ig_id = None
    if dry_run:
        print(f"\n  DRY RUN — ready but not published: {container_id}")
    else:
        ig_id = publish_container(container_id)
        if ig_id:
            print(f"\n  PUBLISHED CAROUSEL! Media ID: {ig_id}")
            print(f"  https://www.instagram.com/coding_tips_pro/")
        else:
            print(f"\n  Publish failed.")

    delete_blobs(blob_urls)
    return ig_id


def publish_reel(mp4_path: Path, caption: str, dry_run: bool, cover_url: str = None) -> str:
    """Reel publish flow: upload MP4 → reel container → publish."""
    size_mb = mp4_path.stat().st_size / (1024 * 1024)
    print(f"  Uploading reel: {mp4_path.name} ({size_mb:.1f} MB)...")
    blob_url = upload_to_blob(str(mp4_path))
    if not blob_url:
        sys.exit(1)
    print(f"  Uploaded: {blob_url[:60]}...")

    print(f"\n  Creating reel container...")
    container_id = create_reel_container(blob_url, caption, cover_url)
    if not container_id:
        delete_blobs([blob_url])
        sys.exit(1)
    print(f"  Container: {container_id}")

    # Reels take longer to process than carousels
    if not wait_for_processing(container_id, max_attempts=60):
        delete_blobs([blob_url])
        sys.exit(1)

    ig_id = None
    if dry_run:
        print(f"\n  DRY RUN — ready but not published: {container_id}")
    else:
        ig_id = publish_container(container_id)
        if ig_id:
            print(f"\n  PUBLISHED REEL! Media ID: {ig_id}")
            print(f"  https://www.instagram.com/coding_tips_pro/")
        else:
            print(f"\n  Publish failed.")

    delete_blobs([blob_url])
    return ig_id


# ─── Main ───

def main():
    parser = argparse.ArgumentParser(description="Publish content to @coding_tips_pro (carousels & reels)")
    parser.add_argument("input", help="Content JSON, directory with PNGs, or MP4 file")
    parser.add_argument("--caption", "-c", help="Override caption")
    parser.add_argument("--dry-run", action="store_true", help="Upload + create container but don't publish")
    parser.add_argument("--type", choices=["carousel", "reel"], help="Force content type (auto-detected if omitted)")
    args = parser.parse_args()

    for var, name in [(BLOB_TOKEN, "BLOB_READ_WRITE_TOKEN"), (ACCESS_TOKEN, "IG_CT_ACCESS_TOKEN"), (IG_ACCOUNT_ID, "IG_CT_ACCOUNT_ID")]:
        if not var:
            print(f"Error: {name} not set in .env")
            sys.exit(1)

    input_path = Path(args.input)
    content_json = None
    caption = args.caption or ""
    topic = "post"

    # Load JSON if provided
    if input_path.suffix == ".json" and input_path.exists():
        with open(input_path) as f:
            content_json = json.load(f)
        topic = content_json.get("topic", "post")
        caption = args.caption or content_json.get("caption", "")

    # Detect content type
    content_type = args.type or detect_content_type(input_path, content_json)
    print(f"\n  Mode: {content_type.upper()}")

    if not caption:
        print("Error: No caption. Use --caption or include in JSON.")
        sys.exit(1)

    if content_type == "reel":
        # ── REEL FLOW ──
        mp4_path = find_reel_mp4(topic, input_path)
        if not mp4_path:
            print(f"\n  No MP4 found for topic '{topic}'.")
            print(f"  Render first: python reel_engine/render.py {args.input}")
            sys.exit(1)

        print(f"  Topic: {topic}")
        print(f"  Video: {mp4_path}\n")
        ig_id = publish_reel(mp4_path, caption, args.dry_run)

    else:
        # ── CAROUSEL FLOW ──
        slide_paths = []

        if content_json:
            expected_dir = Path(__file__).parent / "content" / f"carousel_{topic}"
            if expected_dir.exists() and get_slide_pngs(str(expected_dir)):
                slide_paths = get_slide_pngs(str(expected_dir))
                print(f"  Topic: {topic} (pre-rendered)")
                print(f"  Slides: {len(slide_paths)} from {expected_dir}\n")
            else:
                print(f"\n  No pre-rendered slides found at {expected_dir}")
                print(f"  Run: python carousel_engine/render.py {args.input}")
                sys.exit(1)

        elif input_path.is_dir():
            slide_paths = get_slide_pngs(str(input_path))
            topic = input_path.name
            if not slide_paths:
                print(f"Error: No PNGs in {input_path}")
                sys.exit(1)
            print(f"  Publishing from: {input_path} ({len(slide_paths)} slides)\n")

        else:
            print(f"Error: {args.input} not a JSON, directory, or MP4")
            sys.exit(1)

        ig_id = publish_carousel(slide_paths, caption, args.dry_run)

    print(f"\n  Done.\n")


if __name__ == "__main__":
    main()
