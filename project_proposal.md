# Final Project Proposal: Capital Syndicate — Operation Ferrum Wings

**Student:** Poom Rangsi  
**Course:** Generative AI and Social Media (Summer 2026)  
**Format:** Browser-based interactive narrative arcade game + generative content pipeline

## Problem

Short-form social platforms reward bold visuals and story hooks, but most student game demos are either unfinished prototypes or silent screen recordings. Creators need a **playable, shareable experience** with a clear narrative pitch that can also be turned into a short reel for Instagram / TikTok / YouTube Shorts without a full film crew.

## Audience

- Course peers and graders who need a quick, story-first understanding of the project
- Casual players who discover the game through a 30–60s reel and click through to play in-browser
- Portfolio reviewers looking for a complete interactive demo (mechanics + narrative + polish)

## Solution

**Capital Syndicate Act 1: Operation Ferrum Wings** is a vanilla HTML/CSS/Canvas top-scrolling shooter with:

1. **Playable core** — four sectors, Chromium B.S.U.–style ramming / ammo economy / strategic self-destruct, boss fights, and a super-laser charge system  
2. **Narrative framing** — intro cutscene (Agent Zlisto / Princess Lisa) that establishes stakes before combat  
3. **Audio identity** — looping BGM, per-weapon SFX, and ducked music under cutscenes  
4. **Distribution** — one stable browser link (no install), plus this Homework 2 **PydanticAI reel agent** that turns this proposal into a graded video reel

## Scope of work (feasible for remaining course weeks)

| In scope | Out of scope |
| --- | --- |
| Polish Act 1 combat + HUD + cutscene | Multiplayer / accounts |
| Weapon SFX, BGM ducking, juice FX | Native mobile apps |
| Public playable link + README | Full Act 2 campaign |
| HW2 reel agent (`reel_agent.py`) that plans slides, critiques, TTS, and stitches `reel.mp4` | Paid ad campaigns |

## Why this fits the course

The project pairs **interactive media** with a **generative production agent**: the same proposal document feeds a structured slide plan, HTML/CSS/SVG visuals (no stock photos / image models), narration via `tts-1-hd`, parallel critique/revision, and a short social-style reel. That mirrors how GenAI can accelerate social content pipelines from a single brief.

## Success criteria

- Game remains playable from the documented public URL  
- Proposal → reel agent run produces `ai_grading/` artifacts and a ~30–60s MP4  
- Reel clearly communicates problem, audience, mechanics, and call-to-play  
- All LLM steps use `gpt-5.6-luna`; all TTS uses `tts-1-hd`
