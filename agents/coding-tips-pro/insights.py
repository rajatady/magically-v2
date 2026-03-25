#!/usr/bin/env python3
"""
Fetch and store Instagram analytics for @coding_tips_pro.

Usage:
  python insights.py                # Overview (free)
  python insights.py --reel <id>    # Single reel/post detail
  python insights.py --account      # Account insights (reach, profile views)
  python insights.py --growth       # Growth from stored snapshots
  python insights.py --no-save      # Skip saving to SQLite
"""

import argparse
import os
import sys
import sqlite3
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

ACCESS_TOKEN = os.environ.get("IG_CT_ACCESS_TOKEN")
IG_ACCOUNT_ID = os.environ.get("IG_CT_ACCOUNT_ID")
API = "https://graph.instagram.com/v25.0"
DB_PATH = Path(__file__).parent / "analytics.db"

REEL_METRICS = "reach,saved,shares,comments,likes,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time,views"
CAROUSEL_METRICS = "reach,saved,shares,likes,comments,total_interactions"


def get_db():
    db = sqlite3.connect(DB_PATH)
    db.execute("""CREATE TABLE IF NOT EXISTS ig_snapshots (
        ts DATETIME DEFAULT CURRENT_TIMESTAMP,
        followers INTEGER, media_count INTEGER)""")
    db.execute("""CREATE TABLE IF NOT EXISTS ig_media_snapshots (
        ts DATETIME DEFAULT CURRENT_TIMESTAMP,
        media_id TEXT, caption_start TEXT,
        views INTEGER, reach INTEGER, likes INTEGER, comments INTEGER,
        shares INTEGER, saves INTEGER, avg_watch_ms INTEGER, total_watch_ms INTEGER)""")
    return db


def fmt(n):
    if n is None: return "—"
    if isinstance(n, float): return f"{n:.1f}"
    if n >= 1_000_000: return f"{n/1_000_000:.1f}M"
    if n >= 1_000: return f"{n/1_000:.1f}K"
    return str(n)


def fmt_ms(ms):
    if not ms: return "0s"
    s = ms / 1000
    return f"{int(s//60)}m {int(s%60)}s" if s >= 60 else f"{s:.1f}s"


# ─── Instagram API calls ───

def get_account_info():
    resp = requests.get(f"{API}/me", params={
        "fields": "id,username,account_type,media_count,followers_count,follows_count",
        "access_token": ACCESS_TOKEN,
    })
    return resp.json()


def get_all_media():
    media, url = [], f"{API}/me/media"
    params = {
        "fields": "id,caption,timestamp,media_type,media_product_type,like_count,comments_count",
        "limit": 50,
        "access_token": ACCESS_TOKEN,
    }
    while url:
        resp = requests.get(url, params=params)
        data = resp.json()
        media.extend(data.get("data", []))
        url = data.get("paging", {}).get("next")
        params = {}  # next URL includes params
    return media


def get_media_insights(media_id, media_type="VIDEO"):
    metrics = CAROUSEL_METRICS if media_type == "CAROUSEL_ALBUM" else REEL_METRICS
    resp = requests.get(f"{API}/{media_id}/insights", params={
        "metric": metrics,
        "access_token": ACCESS_TOKEN,
    })
    data = resp.json()
    if "error" in data:
        return {"error": data["error"]["message"][:200]}
    result = {}
    for m in data.get("data", []):
        val = m["values"][0]["value"] if m.get("values") else m.get("total_value", {}).get("value", 0)
        result[m["name"]] = val
    return result


# ─── Overview ───

def print_overview(save=False):
    print("\n═══ @coding_tips_pro (Instagram) — Overview ═══\n")
    acct = get_account_info()

    if "error" in acct:
        print(f"  Error: {acct['error'].get('message', 'Unknown')}")
        return

    followers = acct.get("followers_count", 0)
    following = acct.get("follows_count", 0)
    media_count = acct.get("media_count", 0)
    print(f"  Followers: {fmt(followers)}  |  Following: {fmt(following)}  |  Posts: {media_count}")
    print()

    media = get_all_media()
    if not media:
        print("  No media found.")
        return

    print(f"  {'#':>3} {'TYPE':>5} {'DATE':>12} {'VIEWS':>8} {'REACH':>8} {'LIKES':>6} {'SAVES':>6} {'AVG WATCH':>10} {'SCORE':>7} {'CAPTION':<45}")
    print("  " + "─" * 136)

    total_views, total_reach, total_likes, total_comments = 0, 0, 0, 0
    db = get_db() if save else None
    all_rows = []

    if save:
        db.execute("INSERT INTO ig_snapshots (followers, media_count) VALUES (?, ?)", (followers, media_count))

    for i, m in enumerate(media):
        mt = m.get("media_type", "VIDEO")
        insights = get_media_insights(m["id"], mt)
        if "error" in insights:
            # Still show basic info from media object
            caption = (m.get("caption") or "")[:45].replace("\n", " ")
            type_label = "CAR" if mt == "CAROUSEL_ALBUM" else "IMG" if mt == "IMAGE" else "REEL"
            print(f"  {i+1:>3} {type_label:>5} {m['timestamp'][:10]:>12} {'—':>8} {'—':>8} {fmt(m.get('like_count', 0)):>6} {'—':>6} {'—':>10} {'—':>7} {caption:<45}")
            continue

        is_carousel = mt == "CAROUSEL_ALBUM"
        is_image = mt == "IMAGE"
        views = insights.get("views", 0)
        reach = insights.get("reach", 0)
        likes = insights.get("likes", 0)
        comments = insights.get("comments", 0)
        shares = insights.get("shares", 0)
        saves = insights.get("saved", 0)
        avg_watch = insights.get("ig_reels_avg_watch_time", 0)
        total_watch = insights.get("ig_reels_video_view_total_time", 0)
        caption = (m.get("caption") or "")[:45].replace("\n", " ")

        total_views += views
        total_reach += reach
        total_likes += likes
        total_comments += comments

        type_label = "CAR" if is_carousel else "IMG" if is_image else "REEL"

        all_rows.append({
            "idx": i + 1, "ts": m["timestamp"][:10], "views": views, "reach": reach,
            "likes": likes, "comments": comments, "shares": shares, "saves": saves,
            "avg_watch": avg_watch, "total_watch": total_watch, "caption": caption,
            "media_id": m["id"], "type": type_label,
        })

        if save:
            db.execute("""INSERT INTO ig_media_snapshots
                (media_id, caption_start, views, reach, likes, comments, shares, saves, avg_watch_ms, total_watch_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (m["id"], caption[:80], views, reach, likes, comments, shares, saves, avg_watch, total_watch))

    # Compute engagement score
    max_views = max((r["views"] for r in all_rows), default=1) or 1
    max_watch = max((r["avg_watch"] for r in all_rows), default=1) or 1

    for r in all_rows:
        norm_views = r["views"] / max_views
        norm_watch = r["avg_watch"] / max_watch
        score = ((norm_views ** 0.4) * (norm_watch ** 0.6)) * 100 if r["views"] > 0 and r["avg_watch"] > 0 else 0
        r["score"] = score

    all_rows.sort(key=lambda r: -r["score"])

    for r in all_rows:
        score_str = f"{r['score']:.0f}" if r["score"] > 0 else "—"
        watch_str = fmt_ms(r["avg_watch"]) if r["type"] == "REEL" else "—"
        views_str = fmt(r["views"]) if r["type"] == "REEL" else "—"
        print(f"  {r['idx']:>3} {r['type']:>5} {r['ts']:>12} {views_str:>8} {fmt(r['reach']):>8} {fmt(r['likes']):>6} {fmt(r['saves']):>6} {watch_str:>10} {score_str:>7} {r['caption']:<45}")

    print("  " + "─" * 136)
    print(f"  {'':>3} {'':>5} {'TOTAL':>12} {fmt(total_views):>8} {fmt(total_reach):>8} {fmt(total_likes):>6}")
    print()

    if save:
        db.commit()
        db.close()
        print("  Snapshot saved to analytics.db")


# ─── Reel detail ───

def print_reel_detail(media_id):
    print(f"\n═══ Media Detail: {media_id} ═══\n")
    resp = requests.get(f"{API}/{media_id}", params={
        "fields": "id,caption,timestamp,media_type,like_count,comments_count,permalink",
        "access_token": ACCESS_TOKEN,
    })
    meta = resp.json()
    if "error" in meta:
        print(f"  Error: {meta['error']['message']}")
        return
    print(f"  Posted: {meta.get('timestamp', '?')}")
    print(f"  Type: {meta.get('media_type', '?')}")
    print(f"  Caption: {(meta.get('caption') or '')[:200]}")
    print(f"  Link: {meta.get('permalink', '?')}")
    print()
    mt = meta.get("media_type", "VIDEO")
    insights = get_media_insights(media_id, mt)
    if "error" in insights:
        print(f"  Error: {insights['error']}")
        return
    for key in ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time"]:
        val = insights.get(key, 0)
        if val or key in ["views", "reach", "likes"]:
            label = key.replace("ig_reels_", "").replace("_", " ").title()
            display = fmt_ms(val) if "time" in key else fmt(val)
            print(f"  {label:25s} {display}")
    print()


# ─── Account insights ───

def print_account_insights():
    print("\n═══ @coding_tips_pro — Account Insights ═══\n")
    # The IG API (non-Facebook) has limited account insights
    # Let's show what we can
    acct = get_account_info()
    print(f"  Username: @{acct.get('username', '?')}")
    print(f"  Followers: {fmt(acct.get('followers_count', 0))}")
    print(f"  Following: {fmt(acct.get('follows_count', 0))}")
    print(f"  Posts: {acct.get('media_count', 0)}")
    print()


# ─── Growth ───

def print_growth():
    db = get_db()
    db.row_factory = sqlite3.Row

    print("\n═══ Growth Over Time (from stored snapshots) ═══\n")

    rows = db.execute("SELECT ts, followers, media_count FROM ig_snapshots ORDER BY ts").fetchall()
    if rows:
        print("  Instagram @coding_tips_pro:")
        for r in rows:
            print(f"    {r['ts'][:19]} | {r['followers']} followers | {r['media_count']} posts")
        if len(rows) >= 2:
            first, last = rows[0], rows[-1]
            print(f"    Growth: {first['followers']} → {last['followers']} followers ({last['followers'] - first['followers']:+d})")
    else:
        print("  No snapshots yet (run insights.py to start collecting)")

    print("\n  Top posts by view growth (latest vs earliest snapshot):")
    rows = db.execute("""
        SELECT media_id, caption_start,
               MIN(views) as first_views, MAX(views) as last_views,
               MAX(views) - MIN(views) as growth,
               COUNT(*) as snapshots
        FROM ig_media_snapshots
        GROUP BY media_id
        HAVING snapshots >= 2
        ORDER BY growth DESC
        LIMIT 10
    """).fetchall()
    for r in rows:
        print(f"    +{r['growth']:>6} views | {r['caption_start']}")

    db.close()
    print()


# ─── Main ───

def main():
    parser = argparse.ArgumentParser(description="Analytics for @coding_tips_pro")
    parser.add_argument("--reel", help="Media detail by ID")
    parser.add_argument("--account", action="store_true", help="Account insights")
    parser.add_argument("--growth", action="store_true", help="Growth from stored snapshots")
    parser.add_argument("--no-save", action="store_true", help="Skip saving to analytics.db")
    args = parser.parse_args()

    if args.growth:
        print_growth()
    elif args.reel:
        print_reel_detail(args.reel)
    elif args.account:
        print_account_insights()
    else:
        print_overview(save=not args.no_save)


if __name__ == "__main__":
    main()
