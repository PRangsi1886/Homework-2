# Ferrum Wing

Arcade top-scrolling space shooter inspired by [Chromium B.S.U.](https://github.com/midzer/chromium-bsu) mechanics and [Ikaruga](https://en.wikipedia.org/wiki/Ikaruga)'s high-contrast geometric art style.

You command robotic fighters escorting a freighter across **four sectors**. Clear waves and bosses to deliver the cargo. Sectors 1–3 end with a boss; sector 4 ends with the final blockade commander. An animated cutscene plays after Launch Sortie, and another after the final victory.

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
| `1` `2` `3` `4` | Gun / Ion / Plasma / Rockets |
| `0` or Enter twice | Self-destruct (eject ammo, clear sky) |
| Right-click twice | Self-destruct |
| `P` / Esc | Pause |
| `M` | Mute / unmute |
| Volume slider (bottom-left) | Adjust master volume (SFX + BGM) |

**Custom BGM:** On the title screen, use **Load BGM** or drop an audio file onto the drop zone. It loops from game start and respects mute/volume. The track is saved in your browser (IndexedDB) for later visits. You can also place `assets/bgm.mp3` (or `.ogg` / `.wav` / `.m4a`) in the repo.

If chat file upload fails, use the in-game loader — do not rely on dragging audio into the agent chat.

Procedural synthwave BGM is the fallback when no custom track is loaded.

## Signature mechanics (Chromium B.S.U.–style)

- **Ramming** — collisions damage both ships.
- **Limited special ammo** — ion pierces; plasma hits hard and spends fast.
- **Strategic suicide** — self-destruct clears the screen and ejects ammo for the next fighter.
- **Launch burst** — deploying a new fighter damages nearby hostiles.
- **Power-ups** — shield, hull repair, super shields. Letting a super shield pass grants an extra fighter; other pickups award bonus score if ignored.

## Stack

Vanilla HTML / CSS / Canvas / ES modules. No build step.
