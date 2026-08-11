# Level authoring

Each `set-*` folder mirrors [Neverball/packages](https://github.com/Neverball/packages):

- `set-NAME.txt` — title on line 1, then metadata / map ids
- `maps/*.nbl` — playable courses for the Java game
- `shots/` — previews (text notes here; official packs use JPG)

## Commands

| Command | Meaning |
| --- | --- |
| `name:` | Level title |
| `time:` | Seconds |
| `goalCoins:` | Coins required to open exit |
| `message:` | Tip shown at start |
| `platform x z w d` | Floor rectangle |
| `wall x z w d` | Solid blocker |
| `hazard x z w d` | Hole / instant fall |
| `spawn x z` | Ball start |
| `coin x z value` | 1 / 5 / 10 |
| `goal x z radius` | Exit disc |

Coordinates are on the XZ ground plane; +Z is “forward” on screen when the camera is behind the ball.
