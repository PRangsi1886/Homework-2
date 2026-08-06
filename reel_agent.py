#!/usr/bin/env python3
"""
Homework 2 — Final Project Video Reel Agent

Reads project_proposal.md, plans 4–6 slides with PydanticAI (gpt-5.6-luna),
generates HTML slides + TTS (tts-1-hd), critiques/revises in parallel,
stitches a ~30–60s reel, and writes ai_grading/ artifacts.

Usage:
  python reel_agent.py
  python reel_agent.py --proposal project_proposal.md --skip-video
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic import BaseModel, Field, field_validator
from pydantic_ai import Agent, RunContext
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SLIDES_DIR = ROOT / "slides"
AUDIO_DIR = ROOT / "audio"
FRAMES_DIR = ROOT / "output" / "frames"
OUTPUT_DIR = ROOT / "output"
GRADING_DIR = ROOT / "ai_grading"
REEL_PATH = OUTPUT_DIR / "reel.mp4"

LLM_MODEL = "openai:gpt-5.6-luna"
TTS_MODEL = "tts-1-hd"
TTS_VOICE = "nova"
MAX_SLIDES = 6
MIN_SLIDES = 4


# ---------------------------------------------------------------------------
# Pydantic schemas (structured LLM output)
# ---------------------------------------------------------------------------


class SlideSpec(BaseModel):
    """One slide in the reel plan."""

    id: int = Field(ge=1, le=MAX_SLIDES)
    title: str
    description: str = Field(
        description="What appears on screen: text, layout, and visuals (HTML/CSS/SVG)."
    )
    narration: str = Field(
        description="Spoken narration for this slide (~8–15 seconds when spoken)."
    )
    visual_style: str = Field(
        description="Layout style, e.g. title card, infographic, SVG illustration, CTA poster."
    )

    @field_validator("narration")
    @classmethod
    def narration_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 20:
            raise ValueError("narration too short")
        return v


class SlidePlan(BaseModel):
    """4–6 slide plan for the project reel."""

    project_title: str
    slides: list[SlideSpec]

    @field_validator("slides")
    @classmethod
    def slide_count(cls, v: list[SlideSpec]) -> list[SlideSpec]:
        if not (MIN_SLIDES <= len(v) <= MAX_SLIDES):
            raise ValueError(f"need {MIN_SLIDES}–{MAX_SLIDES} slides, got {len(v)}")
        return v


class HtmlSlideOut(BaseModel):
    """Full HTML document for one vertical (9:16) reel slide."""

    html: str = Field(description="Complete HTML document with inline CSS and optional SVG.")


class SlideCritique(BaseModel):
    """Critique + revision guidance for one slide."""

    slide_id: int
    strengths: list[str]
    weaknesses: list[str]
    improvement_suggestions: list[str]
    revised_description: str
    revised_narration: str
    visual_revision_notes: str


class RevisedHtmlOut(BaseModel):
    html: str
    change_summary: str = Field(description="What changed vs the draft slide/narration.")


# ---------------------------------------------------------------------------
# Agents (all LLM calls → gpt-5.6-luna) — lazy so --flow-only works without a key
# ---------------------------------------------------------------------------

_planner_agent = None
_html_agent = None
_critique_agent = None
_revise_agent = None


def get_planner_agent():
    global _planner_agent
    if _planner_agent is None:
        _planner_agent = Agent(
            LLM_MODEL,
            output_type=SlidePlan,
            system_prompt=(
                "You are a short-form social video producer for student project reels. "
                "Given a final project proposal, produce a tight 4–6 slide plan for a "
                "30–60 second vertical reel. Each slide needs an on-screen description "
                "(text + visuals) and narration that can be spoken in under 15 seconds. "
                "At least one slide MUST be a rich HTML/CSS/SVG visual (infographic, "
                "poster, or illustration)—not plain text with a tiny icon. "
                "No stock photos. No image-generation models. Match the proposal closely. "
                "Use the read_proposal_excerpt tool when you need to re-check the brief."
            ),
        )

        @_planner_agent.tool
        async def read_proposal_excerpt(ctx: RunContext[None], max_chars: int = 2000) -> str:
            """Read the project_proposal.md brief (truncated) to ground the slide plan."""
            path = ROOT / "project_proposal.md"
            text = path.read_text(encoding="utf-8")
            return text[: max(200, min(max_chars, 8000))]

        @_planner_agent.tool
        async def count_words(ctx: RunContext[None], text: str) -> dict[str, int]:
            """Count words/characters to keep narration under ~15 seconds (~35–45 words)."""
            words = [w for w in text.strip().split() if w]
            return {"words": len(words), "chars": len(text)}

    return _planner_agent


def get_html_agent():
    global _html_agent
    if _html_agent is None:
        _html_agent = Agent(
            LLM_MODEL,
            output_type=HtmlSlideOut,
            system_prompt=(
                "You write self-contained HTML slides for a 1080x1920 vertical video reel. "
                "Return ONE complete HTML document with inline <style>. "
                "Use expressive typography, gradients/patterns, and—when asked—inline SVG "
                "or pure CSS art as the main visual. No external images, no <img> to remote URLs, "
                "no stock photos. Dark cinematic palette with cyan/magenta accents fits a "
                "space-shooter pitch. Keep text large and readable. Body fills the viewport."
            ),
        )
    return _html_agent


def get_critique_agent():
    global _critique_agent
    if _critique_agent is None:
        _critique_agent = Agent(
            LLM_MODEL,
            output_type=SlideCritique,
            system_prompt=(
                "You are a creative director reviewing one reel slide. Critique the on-screen "
                "description, HTML design intent, and narration for clarity, visual punch, and "
                "timing (narration must stay under ~15 seconds spoken). Give concrete improvement "
                "suggestions and produce revised_description + revised_narration."
            ),
        )
    return _critique_agent


def get_revise_agent():
    global _revise_agent
    if _revise_agent is None:
        _revise_agent = Agent(
            LLM_MODEL,
            output_type=RevisedHtmlOut,
            system_prompt=(
                "You revise an HTML reel slide using critique feedback. Return improved complete "
                "HTML (inline CSS, optional SVG) and a short change_summary. Keep 1080x1920 vertical "
                "layout. No remote images."
            ),
        )
    return _revise_agent


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def ensure_dirs() -> None:
    for d in (SLIDES_DIR, AUDIO_DIR, FRAMES_DIR, OUTPUT_DIR, GRADING_DIR):
        d.mkdir(parents=True, exist_ok=True)


def load_proposal(path: Path) -> str:
    text = path.read_text(encoding="utf-8").strip()
    if len(text) < 200:
        raise SystemExit(f"Proposal too short: {path}")
    return text


def strip_code_fences(html: str) -> str:
    html = html.strip()
    if html.startswith("```"):
        html = re.sub(r"^```(?:html)?\s*", "", html)
        html = re.sub(r"\s*```$", "", html)
    return html.strip()


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def wav_duration_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as wf:
        return wf.getnframes() / float(wf.getframerate())


async def synthesize_tts(client: AsyncOpenAI, text: str, out_path: Path) -> Path:
    """OpenAI TTS → mp3 (tts-1-hd)."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Keep clips short for cost/control
    clipped = text.strip()
    if len(clipped) > 450:
        clipped = clipped[:447].rsplit(" ", 1)[0] + "..."

    async with client.audio.speech.with_streaming_response.create(
        model=TTS_MODEL,
        voice=TTS_VOICE,
        input=clipped,
        response_format="mp3",
    ) as response:
        await response.stream_to_file(out_path)
    return out_path


def render_html_to_png(html_path: Path, png_path: Path, width: int = 1080, height: int = 1920) -> None:
    """Render a local HTML file to PNG via Playwright Chromium."""
    from playwright.sync_api import sync_playwright

    png_path.parent.mkdir(parents=True, exist_ok=True)
    uri = html_path.resolve().as_uri()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
        page.goto(uri, wait_until="networkidle")
        page.screenshot(path=str(png_path), full_page=False)
        browser.close()


def build_agent_flow_diagram(out_path: Path) -> None:
    """Draw ai_grading/agent_flow.png with Pillow (no external diagram service)."""
    w, h = 1400, 1000
    img = Image.new("RGB", (w, h), "#0b1020")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
        font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
    except OSError:
        font = font_sm = font_title = ImageFont.load_default()

    draw.text((40, 28), "HW2 Reel Agent Flow", fill="#4de8ff", font=font_title)
    draw.text(
        (40, 72),
        "LLM: gpt-5.6-luna   ·   TTS: tts-1-hd   ·   Parallel per-slide enhance",
        fill="#9eb3d1",
        font=font_sm,
    )

    nodes = [
        (100, 140, 280, 100, "INPUT\nproject_proposal.md", "#1a2744"),
        (520, 140, 320, 100, "plan_slides()\nAgent → SlidePlan", "#243656"),
        (100, 320, 360, 120, "PARALLEL per slide\nHTML + critique + revise + TTS", "#2a1f3d"),
        (560, 320, 300, 120, "render_html_to_png()\nPlaywright Chromium", "#1f3d36"),
        (100, 520, 320, 110, "stitch_reel()\nffmpeg → reel.mp4", "#3d2a1f"),
        (520, 520, 360, 110, "ai_grading/\nslide_plan.json\ncritique_feedback.json\nagent_flow.png", "#1f3d2a"),
    ]

    for x, y, bw, bh, label, fill in nodes:
        draw.rounded_rectangle((x, y, x + bw, y + bh), radius=16, fill=fill, outline="#4de8ff", width=2)
        draw.multiline_text((x + 18, y + 22), label, fill="#f4f7ff", font=font, spacing=6)

    arrows = [
        ((240, 240), (240, 320)),
        ((380, 190), (520, 190)),
        ((680, 240), (680, 320)),
        ((280, 440), (280, 520)),
        ((710, 440), (710, 520)),
        ((420, 575), (520, 575)),
        ((460, 380), (560, 380)),
    ]
    for (x1, y1), (x2, y2) in arrows:
        draw.line((x1, y1, x2, y2), fill="#ff4fd8", width=4)
        # arrow head
        draw.polygon([(x2, y2), (x2 - 8, y2 - 12), (x2 + 8, y2 - 12)], fill="#ff4fd8")

    draw.text(
        (40, 700),
        "Tools / I/O",
        fill="#ffe66d",
        font=font,
    )
    draw.multiline_text(
        (40, 740),
        "• planner_agent / html_agent / critique_agent / revise_agent  →  structured Pydantic outputs\n"
        "• synthesize_tts (OpenAI Audio API, tts-1-hd)  →  audio/slide_XX.mp3\n"
        "• render_html_to_png (Playwright)  →  output/frames/slide_XX.png\n"
        "• stitch_reel (ffmpeg)  →  output/reel.mp4  (upload to grading site; not required on GitHub)\n"
        "• asyncio.gather  →  slide HTML, critique/revise, and TTS run in parallel across slides",
        fill="#c8d4e8",
        font=font_sm,
        spacing=8,
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"Wrote {out_path}")


def stitch_reel(frame_audio: list[tuple[Path, Path, float]], out_mp4: Path) -> Path:
    """Stitch PNG frames + MP3 narration into reel.mp4 via ffmpeg."""
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    work = OUTPUT_DIR / "_segments"
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)

    segment_files: list[Path] = []
    for i, (png, mp3, _) in enumerate(frame_audio, start=1):
        seg = work / f"seg_{i:02d}.mp4"
        # Pad/trim video to audio length; vertical 1080x1920
        cmd = [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(png),
            "-i",
            str(mp3),
            "-c:v",
            "libx264",
            "-tune",
            "stillimage",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-pix_fmt",
            "yuv420p",
            "-shortest",
            "-vf",
            "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
            str(seg),
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        segment_files.append(seg)

    concat_list = work / "concat.txt"
    concat_list.write_text("".join(f"file '{p.resolve()}'\n" for p in segment_files), encoding="utf-8")
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_list),
        "-c",
        "copy",
        str(out_mp4),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"Wrote {out_mp4}")
    return out_mp4


# ---------------------------------------------------------------------------
# Parallel per-slide pipeline
# ---------------------------------------------------------------------------


async def enhance_one_slide(
    client: AsyncOpenAI,
    slide: SlideSpec,
    proposal_excerpt: str,
    executor: ThreadPoolExecutor,
) -> dict[str, Any]:
    """Generate HTML → critique → revise HTML/narration → TTS (critique+TTS overlapped)."""
    sid = slide.id
    print(f"[slide {sid}] drafting HTML…")
    draft = await get_html_agent().run(
        f"Project context (excerpt):\n{proposal_excerpt[:2500]}\n\n"
        f"Create slide {sid}: {slide.title}\n"
        f"On-screen description: {slide.description}\n"
        f"Visual style: {slide.visual_style}\n"
        f"Narration (for pacing reference): {slide.narration}\n"
        f"{'IMPORTANT: This slide must feature a bold HTML/CSS/SVG illustration or infographic as the main visual—not just text.' if sid in (2, 3) else ''}"
    )
    draft_html = strip_code_fences(draft.output.html)
    draft_path = SLIDES_DIR / f"slide_{sid:02d}_draft.html"
    draft_path.write_text(draft_html, encoding="utf-8")

    print(f"[slide {sid}] critiquing…")
    critique_result = await get_critique_agent().run(
        f"Slide id: {sid}\nTitle: {slide.title}\n"
        f"Description: {slide.description}\n"
        f"Narration: {slide.narration}\n"
        f"Visual style: {slide.visual_style}\n"
        f"Draft HTML (truncated):\n{draft_html[:5000]}"
    )
    critique = critique_result.output
    critique.slide_id = sid

    # Parallel: revise HTML + synthesize TTS on revised narration
    print(f"[slide {sid}] revising HTML + synthesizing TTS in parallel…")

    async def revise() -> RevisedHtmlOut:
        result = await get_revise_agent().run(
            f"Original description: {slide.description}\n"
            f"Original narration: {slide.narration}\n"
            f"Revised description: {critique.revised_description}\n"
            f"Revised narration: {critique.revised_narration}\n"
            f"Suggestions: {critique.improvement_suggestions}\n"
            f"Visual notes: {critique.visual_revision_notes}\n"
            f"Draft HTML:\n{draft_html}"
        )
        return result.output

    audio_path = AUDIO_DIR / f"slide_{sid:02d}.mp3"

    revised, _ = await asyncio.gather(
        revise(),
        synthesize_tts(client, critique.revised_narration, audio_path),
    )

    final_html = strip_code_fences(revised.html)
    final_path = SLIDES_DIR / f"slide_{sid:02d}.html"
    final_path.write_text(final_html, encoding="utf-8")

    # Render PNG in thread pool (Playwright sync API)
    png_path = FRAMES_DIR / f"slide_{sid:02d}.png"
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(executor, render_html_to_png, final_path, png_path)

    # Duration from ffprobe if available
    duration = 8.0
    try:
        probe = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(audio_path),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        duration = float(probe.stdout.strip())
    except Exception:
        pass

    print(f"[slide {sid}] done ({duration:.1f}s audio)")
    return {
        "slide": slide,
        "critique": critique,
        "change_summary": revised.change_summary,
        "draft_html_path": str(draft_path.relative_to(ROOT)),
        "final_html_path": str(final_path.relative_to(ROOT)),
        "audio_path": str(audio_path.relative_to(ROOT)),
        "png_path": png_path,
        "mp3_path": audio_path,
        "duration": duration,
        "final_narration": critique.revised_narration,
        "final_description": critique.revised_description,
    }


async def run_pipeline(proposal_path: Path, skip_video: bool = False) -> None:
    load_dotenv(ROOT / ".env")
    if not os.getenv("OPENAI_API_KEY"):
        raise SystemExit(
            "OPENAI_API_KEY missing. Copy .env.example → .env and add your key."
        )

    ensure_dirs()
    build_agent_flow_diagram(GRADING_DIR / "agent_flow.png")

    proposal = load_proposal(proposal_path)
    print("Planning slides with gpt-5.6-luna…")
    plan_result = await get_planner_agent().run(
        f"Create the slide plan for this final project proposal:\n\n{proposal}"
    )
    plan = plan_result.output

    # Persist slide plan for graders (description + narration per slide)
    slide_plan_payload = {
        "model": "gpt-5.6-luna",
        "project_title": plan.project_title,
        "slides": [
            {
                "id": s.id,
                "title": s.title,
                "description": s.description,
                "narration": s.narration,
                "visual_style": s.visual_style,
            }
            for s in plan.slides
        ],
    }
    write_json(GRADING_DIR / "slide_plan.json", slide_plan_payload)
    print(f"Wrote {GRADING_DIR / 'slide_plan.json'} ({len(plan.slides)} slides)")

    client = AsyncOpenAI()
    excerpt = proposal[:3000]

    # Parallelize across slides
    with ThreadPoolExecutor(max_workers=min(4, len(plan.slides))) as executor:
        results = await asyncio.gather(
            *[enhance_one_slide(client, s, excerpt, executor) for s in plan.slides]
        )

    # Sort by slide id
    results = sorted(results, key=lambda r: r["slide"].id)

    critique_payload = {
        "model": "gpt-5.6-luna",
        "tts_model": TTS_MODEL,
        "slides": [
            {
                "slide_id": r["critique"].slide_id,
                "title": r["slide"].title,
                "original_description": r["slide"].description,
                "original_narration": r["slide"].narration,
                "strengths": r["critique"].strengths,
                "weaknesses": r["critique"].weaknesses,
                "improvement_suggestions": r["critique"].improvement_suggestions,
                "revised_description": r["critique"].revised_description,
                "revised_narration": r["critique"].revised_narration,
                "visual_revision_notes": r["critique"].visual_revision_notes,
                "change_summary": r["change_summary"],
                "draft_html": r["draft_html_path"],
                "final_html": r["final_html_path"],
            }
            for r in results
        ],
    }
    write_json(GRADING_DIR / "critique_feedback.json", critique_payload)
    print(f"Wrote {GRADING_DIR / 'critique_feedback.json'}")

    # Also refresh slide_plan.json narrations to revised versions used in the reel
    slide_plan_payload["slides_revised_for_reel"] = [
        {
            "id": r["slide"].id,
            "title": r["slide"].title,
            "description": r["final_description"],
            "narration": r["final_narration"],
        }
        for r in results
    ]
    write_json(GRADING_DIR / "slide_plan.json", slide_plan_payload)

    total = sum(r["duration"] for r in results)
    print(f"Total narration ≈ {total:.1f}s")

    if skip_video:
        print("Skipping ffmpeg stitch (--skip-video).")
        return

    frame_audio = [(r["png_path"], r["mp3_path"], r["duration"]) for r in results]
    stitch_reel(frame_audio, REEL_PATH)
    # Convenience copy at repo root for local preview (gitignored via *.mp4)
    root_copy = ROOT / "reel.mp4"
    shutil.copy2(REEL_PATH, root_copy)
    print(f"Also copied to {root_copy}")
    print("Upload reel.mp4 to the grading website (do not require it on GitHub).")


def main() -> None:
    parser = argparse.ArgumentParser(description="HW2 Final Project Video Reel Agent")
    parser.add_argument(
        "--proposal",
        type=Path,
        default=ROOT / "project_proposal.md",
        help="Path to project proposal markdown",
    )
    parser.add_argument(
        "--skip-video",
        action="store_true",
        help="Generate slides/audio/grading JSON but skip ffmpeg stitch",
    )
    parser.add_argument(
        "--flow-only",
        action="store_true",
        help="Only regenerate ai_grading/agent_flow.png",
    )
    args = parser.parse_args()

    if args.flow_only:
        ensure_dirs()
        build_agent_flow_diagram(GRADING_DIR / "agent_flow.png")
        return

    asyncio.run(run_pipeline(args.proposal, skip_video=args.skip_video))


if __name__ == "__main__":
    main()
