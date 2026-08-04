# Ferrum Wing

Arcade top-scrolling space shooter inspired by [Chromium B.S.U.](https://github.com/midzer/chromium-bsu).

You command robotic fighters escorting a freighter. Destroy every hostile before they cross the freighter line at the bottom of the screen.

## Play

Open `index.html` in a modern browser, or serve locally:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Controls

| Input | Action |
| --- | --- |
| Mouse / WASD / Arrows | Move fighter |
| Hold Left Click / Space | Fire |
| `1` `2` `3` | Gun / Ion / Plasma |
| `0` or Enter twice | Self-destruct (eject ammo, clear sky) |
| Right-click twice | Self-destruct |
| `P` / Esc | Pause |

## Signature mechanics (Chromium B.S.U.–style)

- **No escapes** — enemies that pass the bottom cost a fighter.
- **Ramming** — collisions damage both ships.
- **Limited special ammo** — ion pierces; plasma hits hard and spends fast.
- **Strategic suicide** — self-destruct clears the screen and ejects ammo for the next fighter.
- **Launch burst** — deploying a new fighter damages nearby hostiles.
- **Power-ups** — shield, hull repair, super shields. Letting a super shield pass grants an extra fighter; other pickups award bonus score if ignored.

## Stack

Vanilla HTML / CSS / Canvas / ES modules. No build step.
