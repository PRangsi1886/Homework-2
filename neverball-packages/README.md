# Neverball Packages (Java)

A **playable Neverball-inspired** tilt-and-roll ball game in pure Java, plus an addon **packages** layout modeled on [Neverball/packages](https://github.com/Neverball/packages).

Neverball itself is written in C and ships Quake-style `.map` / `.sol` levels. This project does **not** recompile that engine. Instead it gives you:

1. A desktop Java game you can build with `javac` (no Maven required)
2. Human-editable level packs under `packages/` (same *idea* as the official addon repo: sets, maps, shots, set metadata)
3. Classic Neverball rules: tilt the floor, collect coins to unlock the goal, beat the clock, don’t fall

Upstream inspiration: [neverball.org](https://neverball.org) · [Neverball/packages](https://github.com/Neverball/packages)

## Play in the browser

**Commit-pinned play link:**  
https://rawcdn.githack.com/PRangsi1886/Homework-2/2e03c2a9a9d0d889b553dafcf40846663495d4db/neverball-packages/play.html

Or open `play.html` locally after cloning.

## Requirements

- JDK 17+ (tested on OpenJDK 21)
- A display (Swing UI)

## Build & run

```bash
cd neverball-packages
./build.sh
./run.sh
```

Or manually:

```bash
javac -d bin $(find src -name '*.java')
java -cp bin:packages org.neverball.game.Main
```

Headless smoke test (no window):

```bash
./build.sh
java -cp bin:packages org.neverball.game.SmokeTest
```

## Controls

| Key | Action |
| --- | --- |
| Arrow keys / WASD | Tilt the floor |
| R | Restart level |
| N | Next level (when goal unlocked / won) |
| Esc | Quit to title / exit |
| Enter | Start / continue |

## Packages layout

Mirrors the official addon repository shape:

```
packages/
  set-tutorial/
    set-tutorial.txt      # set title, difficulty, author, map list
    maps/                 # playable .nbl levels (Java format)
    shots/                # optional preview notes
  set-challenge/
    ...
```

Official Neverball packs use `.map` + compiled `.sol` binaries for the C engine. Our `.nbl` files are a small text format the Java game loads directly so you can author levels without the Neverball map compiler.

### `.nbl` format (example)

```
name: Meadow Start
time: 60
goalCoins: 5
message: Tilt gently. Collect coins. Reach the goal.

platform  -6 -6  12 12
spawn      0  0
coin       3  2  1
coin      -3  2  1
coin       0  4  5
goal       0  5  1.4
```

- `platform x z width depth` — walkable rectangle on the XZ plane  
- `coin x z value` — `1` yellow, `5` red, `10` blue  
- `goal x z radius` — exit (opens after `goalCoins`)  
- `wall x z width depth` — solid blocker  
- `hazard x z width depth` — instant fall zone on the platform  

## Relation to Neverball/packages

| Official packages | This repo |
| --- | --- |
| Addon source for in-game package manager | Level packs for the Java player |
| `.map` / `.sol` | `.nbl` text maps |
| `set-*.txt` metadata | Same idea (`set-tutorial.txt`, …) |
| C Neverball client | Java Swing client |

If you later want real Neverball addons, keep contributing to [Neverball/packages](https://github.com/Neverball/packages). This tree is a **learning / portable** spin that stays easy to edit and run.

## License

Game code in this folder is provided for coursework / demo use. Neverball™ names and original assets belong to their respective authors; this is an independent tribute implementation with original code and levels.
