# project-mini-game

Working copy of Tah’s Board of Realities. **Game files live in `repo/` after a pull** (that directory is gitignored from Homework-2 so you can push edits to your own GitHub repo).

This Cloud Agent cannot clone https://github.com/Tah-KMTS/Final-Project-board-of-realities (private). Do one of the following.

## On your laptop (works if you can open Tah’s repo in the browser)

```bash
./project-mini-game/bootstrap.sh
```

That clones Tah’s repo, creates **https://github.com/PRangsi1886/project-mini-game**, and pushes it. Then reply to the agent with that URL.

## Daily pull / edit / push

```bash
./project-mini-game/pull.sh    # fetch Tah → project-mini-game/repo/
# edit files in project-mini-game/repo/
./project-mini-game/push.sh    # push to PRangsi1886/project-mini-game
```

To push into Tah’s repo instead (only if you are a collaborator with write access):

```bash
PROJECT_MINI_GAME_PUSH_URL=https://github.com/Tah-KMTS/Final-Project-board-of-realities.git ./project-mini-game/push.sh
```
