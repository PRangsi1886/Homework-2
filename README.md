# Capital Syndicate Act 1: Operation Ferrum Wings

Arcade top-scrolling space shooter inspired by [Chromium B.S.U.](https://github.com/midzer/chromium-bsu) mechanics and [Ikaruga](https://en.wikipedia.org/wiki/Ikaruga)'s high-contrast geometric art style.

You command robotic fighters escorting a freighter across **four sectors**. Clear waves and bosses to deliver the cargo. Sectors 1–3 end with a boss; sector 4 ends with the final blockade commander.

## Play

Open `index.html` in a modern browser, or serve locally:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

**Shareable build (latest commit on this branch):** see the pull request description for the live CDN link.

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

Procedural file BGM loads from `assets/bgm.mp3` when present (falls back to synth). An intro video plays from `assets/cutscenes/intro.mp4` after Launch Sortie.

**Pickup sprites:** Animated strips live in `assets/pickups/` (`shield`, `repair`, `super`, `rocket`, `ammo`, plus optional `*_alt` variants). Horizontal sheets; frame size = sheet height. Replace those PNGs with your own to swap art.

**Enemy sprites:** Animated strips in `assets/enemies/` (`scout`, `dart`, `lancer`, `heavy`, `boss`, `finalBoss`, plus `*_alt` variants). Same horizontal-strip format — drop in replacements to use your originals.

**Player / weapons / FX:** Sheets in `assets/player/` (`hero`, `gun`, `ion`, `plasma`, `rocket`, `muzzle`, `thrust`, `spark`, `shield_fx`). Replace those PNGs to swap art.

## Signature mechanics (Chromium B.S.U.–style)

- **Ramming** — collisions damage both ships.
- **Limited special ammo** — ion pierces; plasma hits hard and spends fast.
- **Strategic suicide** — self-destruct clears the screen and ejects ammo for the next fighter.
- **Launch burst** — deploying a new fighter damages nearby hostiles.
- **Power-ups** — shield, hull repair, super shields. Letting a super shield pass grants an extra fighter; other pickups award bonus score if ignored.

## Stack

Vanilla HTML / CSS / Canvas / ES modules. No build step.
