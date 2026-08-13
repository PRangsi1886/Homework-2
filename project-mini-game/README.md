# Project Mini Game

**Capital Syndicate — Operation Ferrum Wings**

Standalone browser minigame (vanilla HTML / CSS / Canvas). No build step.

## Play

```bash
cd project-mini-game
python3 -m http.server 8080
```

Open http://localhost:8080

## Controls

| Input | Action |
| --- | --- |
| Mouse / WASD | Move |
| Hold click | Fire |
| Space @ 100% laser | Super laser |
| `1`–`4` | Weapons |
| `0` twice | Self-destruct |
| `M` | Mute |

## Layout

```
project-mini-game/
├── README.md
├── index.html
├── css/
├── js/
└── assets/
```

## Make this its own GitHub repo

This folder currently lives in `PRangsi1886/Homework-2`. To publish it as **`project-mini-game`**:

```bash
cd project-mini-game
git init
git add .
git commit -m "Initial commit: Project Mini Game"
gh repo create PRangsi1886/project-mini-game --public --source=. --remote=origin --push
```

## Board of Realities drop-in

Copy this folder to:

```text
Final-Project-board-of-realities/minigames/capital-syndicate/
```

Source package in Homework-2: `minigames/capital-syndicate/`
