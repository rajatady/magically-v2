#!/usr/bin/env python3
"""
Render posts by having Playwright open the React app's grid,
click each post, and screenshot the slides at full resolution.

The trick: we render a standalone page per slide at 1080x1080 viewport
using the React app's public/rendered path.

But actually — the right approach is simpler:
We open the React app, click each post in the LEFT mockup grid,
then for each slide in the modal, we find the inner 1080px canvas div
and screenshot it directly (not the modal, but the actual slide content).
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path(__file__).parent
REACT_URL = "http://localhost:3456"
NUM_POSTS = 24


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 1400})
        page.goto(REACT_URL, wait_until="networkidle")
        page.wait_for_timeout(5000)

        for post_idx in range(NUM_POSTS):
            post_dir = OUT_DIR / f"rendered_{post_idx + 1:02d}"
            post_dir.mkdir(parents=True, exist_ok=True)
            print(f"\n  Post {post_idx + 1}/{NUM_POSTS}...")

            # Click the post in the LEFT grid (first grid)
            page.evaluate(f"""
                const grids = document.querySelectorAll('[style*="grid-template-columns"]');
                if (grids[0]) grids[0].children[{post_idx}]?.click();
            """)
            page.wait_for_timeout(600)

            slide_idx = 0
            max_slides = 20  # safety limit

            while slide_idx < max_slides:
                # Find the slide's inner 1080px canvas (the scaled div)
                canvas = page.evaluate("""(() => {
                    const modal = document.querySelector('[style*="position: fixed"]');
                    if (!modal) return null;
                    const all = modal.querySelectorAll('div');
                    for (const d of all) {
                        if (d.style.width === '1080px' && d.style.height === '1080px') {
                            return true;
                        }
                    }
                    return null;
                })()""")

                if canvas is None and slide_idx == 0:
                    print(f"    No modal/canvas found")
                    break

                # Screenshot the modal's slide content
                # The modal overlay has position:fixed. Inside it there's a white
                # rounded container, and inside that the slide carousel.
                # We need to find the carousel's visible slide area.
                box = page.evaluate("""(() => {
                    // Find the fixed overlay
                    const overlay = document.querySelector('[style*="position: fixed"][style*="z-index: 1000"]');
                    if (!overlay) return null;
                    // Inside the overlay, find the white container
                    const container = overlay.querySelector('[style*="border-radius: 12px"]');
                    if (!container) return null;
                    // Find the carousel viewport (overflow hidden + aspect-ratio 1)
                    const carousel = container.querySelector('[style*="overflow: hidden"][style*="aspect-ratio"]');
                    if (!carousel) return null;
                    const r = carousel.getBoundingClientRect();
                    return { x: r.x, y: r.y, width: r.width, height: r.height };
                })()""")

                if box and box['width'] > 0:
                    # Hide nav arrows before screenshot
                    page.evaluate("""(() => {
                        const overlay = document.querySelector('[style*="position: fixed"][style*="z-index: 1000"]');
                        if (!overlay) return;
                        const btns = overlay.querySelectorAll('button');
                        for (const b of btns) {
                            if (b.textContent.trim() === '‹' || b.textContent.trim() === '›') {
                                b.style.opacity = '0';
                            }
                        }
                    })()""")
                    page.wait_for_timeout(100)

                    path = str(post_dir / f"slide_{slide_idx + 1}.png")
                    page.screenshot(
                        path=path,
                        clip=box,
                    )

                    # Show nav arrows again
                    page.evaluate("""(() => {
                        const overlay = document.querySelector('[style*="position: fixed"][style*="z-index: 1000"]');
                        if (!overlay) return;
                        const btns = overlay.querySelectorAll('button');
                        for (const b of btns) {
                            if (b.textContent.trim() === '‹' || b.textContent.trim() === '›') {
                                b.style.opacity = '1';
                            }
                        }
                    })()""")

                    print(f"    Slide {slide_idx + 1}")
                    slide_idx += 1
                else:
                    if slide_idx == 0:
                        print(f"    No slide container found in modal")
                    break

                # Click next arrow via JS — hide arrows first, then click
                has_next = page.evaluate("""(() => {
                    const overlay = document.querySelector('[style*="position: fixed"][style*="z-index: 1000"]');
                    if (!overlay) return false;
                    // Hide all nav buttons before screenshot (they'll reappear on next frame)
                    const btns = overlay.querySelectorAll('button');
                    let nextBtn = null;
                    for (const b of btns) {
                        if (b.textContent.trim() === '›') nextBtn = b;
                    }
                    if (nextBtn) {
                        nextBtn.click();
                        return true;
                    }
                    return false;
                })()""")
                if has_next:
                    page.wait_for_timeout(500)
                else:
                    break

            # Close modal
            page.evaluate("""
                const btns = document.querySelectorAll('button');
                for (const b of btns) {
                    if (b.textContent.trim() === '✕') { b.click(); break; }
                }
            """)
            page.wait_for_timeout(300)

        browser.close()
        print(f"\n  Done! Processed {NUM_POSTS} posts.")


if __name__ == "__main__":
    main()
