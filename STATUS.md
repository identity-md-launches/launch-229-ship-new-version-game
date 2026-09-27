## Phase: DEPLOY
## Checkpoint C: approved (Lobby, 2026-09-27 02:35)
## Checkpoint B: approved (Lobby, 2026-09-27 02:34)
## Checkpoint A: approved (Lobby, 2026-09-27 02:34)
# STATUS.md

## State
- Last Action: 2026-09-27 13:10 - Background play shipped to the gitlawb fork (main). Cloudflare hosting dropped at Lobby's call; the live site is republished only by an IMD site job.
- Blocker: live site https://pepes-armed.site.identitymd.eth.limo still serves the old build until IMD runs a site job for our fork's main (no publishing access from this project).
- Updated: 2026-09-27 13:10

## Repository
- Fork (ours): https://gitlawb.com/z6MkiyAV9MAfGzqLQpFtAxD2KzY7TyBTSD2bQUWioZSeXaqa/pepes-armed-with-ai
- Upstream (IMD): https://gitlawb.com/z6Mkv7pA7hyFtdSQPPrkRb1ffGQM8818MvqXFHkGtTJkzLmi/pepes-armed-with-ai
- Fork point: a27372f (upstream main, 2026-09-26). The arcade-wallet commit (0b3c386) was never pushed upstream; pull it from `upstream` once IMD pushes it.
- gitlawb CLI and identity live in git-ignored `.tools/` and `.gitlawb/`; usage notes in KEYS.md.
