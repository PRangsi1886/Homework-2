# Homework 2 — Final Project Video Reel Agent

**Course:** Generative AI and Social Media (Summer 2026)  
**Repo:** Capital Syndicate Act 1 demo + PydanticAI reel agent

This repository contains:

1. **project_proposal.md** — final project proposal (input to the agent)
2. **reel_agent.py** — PydanticAI agent that turns the proposal into a short video reel
3. **Playable game demo** — Capital Syndicate Act 1 (browser shooter the reel pitches)

## Play the game

**Use this link only (commit-pinned — skips stale caches):**  
https://rawcdn.githack.com/PRangsi1886/Homework-2/be0328162722d652d55e3ef376212517f3172d19/index.html

You must see **OPENING v3** in the bottom-left of the intro, plus Agent Zlisto / Princess Lisa stills with captions.

Do **not** use raw.githack.com main-branch bookmarks — that host can keep serving the old Clideo intro forever.

Or locally: `python3 -m http.server 8080` then open http://localhost:8080

## Submit on the grading website (Canvas)

1. Repo URL: `https://github.com/PRangsi1886/Homework-2`
2. Upload `reel.mp4` (~42 seconds) — generate with `python reel_agent.py` or use your local `output/reel.mp4`

## Agent requirements (HW2)

| Requirement | Implementation |
| --- | --- |
| LLM | `gpt-5.6-luna` via PydanticAI (`openai:gpt-5.6-luna`) |
| TTS | OpenAI `tts-1-hd` |
| Slide plan | Structured Pydantic `SlidePlan` → `ai_grading/slide_plan.json` |
| HTML slides | `slides/slide_XX.html` (at least one rich HTML/CSS/SVG visual) |
| Critique + revise | Parallel per-slide critique → revised HTML/narration → `ai_grading/critique_feedback.json` |
| Parallelization | `asyncio.gather` across slides; revise HTML and TTS run together per slide |
| Video reel | `ffmpeg` stitch → `output/reel.mp4` (**upload to grading site**, not required on GitHub) |
| Flow diagram | `ai_grading/agent_flow.png` |

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium

cp .env.example .env
# put OPENAI_API_KEY in .env  (never commit .env)
```

## Run the reel agent

```bash
python reel_agent.py
```

Optional:

```bash
python reel_agent.py --skip-video          # slides + audio + grading JSON only
python reel_agent.py --flow-only           # regenerate agent_flow.png
python reel_agent.py --proposal project_proposal.md
```

Outputs:

```
slides/                  # draft + final HTML slides
audio/                   # per-slide mp3 (gitignored)
output/frames/           # PNG frames
output/reel.mp4          # stitched reel (gitignored; upload to grading website)
ai_grading/
  slide_plan.json
  critique_feedback.json
  agent_flow.png
```

## Required submission layout

```
your-repo/
├── README.md
├── requirements.txt
├── .gitignore          # includes .env and __pycache__
├── project_proposal.md
├── reel_agent.py
├── slides/
└── ai_grading/
    ├── slide_plan.json
    ├── critique_feedback.json
    └── agent_flow.png
```

Upload **`reel.mp4`** on the grading website (do not rely on GitHub for the video).

## Game controls (demo)

| Input | Action |
| --- | --- |
| Mouse / WASD | Move |
| Hold click | Fire |
| Space @ 100% laser | Super laser |
| `1`–`4` | Weapons |
| `0` twice | Self-destruct |
| `M` | Mute |

## Stack

- **Agent:** Python, PydanticAI, OpenAI TTS, Playwright, ffmpeg  
- **Game:** Vanilla HTML / CSS / Canvas / ES modules (no build step)
