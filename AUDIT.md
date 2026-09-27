# AUDIT.md

Task record for the "clean top" change (PLAN.md T1–T6, DESIGN.md R1–R8). Evidence paths are project-relative; `test/scratch/` is git-ignored.

## Scope delivered

- Page header (wordmark, "Sepolia · Test Value Only", Rules link, wallet buttons) removed from `web/src/main.tsx`; status bar under the game removed.
- In-scene `#chainMessage` overlay removed and the speaker moved to the bottom-right corner, both through `web/scripts/adapt-game.py`; `web/public/game.html` regenerated (byte-reproducible; `prototype/` and `medallion.webp` untouched).
- Wallet controls (Connect Wallet / address chip / Disconnect) now live inside the game window, top-left, as an absolutely positioned `.wallet-controls` overlay on a `.scene` wrapper. Buttons only, no auto-prompt.
- Engine messages and the View Transaction link render as `#review .status` inside the Wallet Move panel; the "Sepolia arcade ready…" copy is gone (engine sets an empty message when the arcade becomes ready).
- Browser tests and the live check updated; `dist/` rebuilt.

## Findings during verification

### F1: Browser suite could not launch on this host (resolved)
- Symptom: all Playwright tests failed at `browserType.launch` (missing shared libraries) after `npx playwright install chromium`.
- Fix: host libraries installed with Space-owner approval via the sudo helper: `apt-get install -y libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libatspi2.0-0t64 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libcairo2 libpango-1.0-0 libasound2t64` (log `test/scratch/apt-libs.log`, exit 0). Browsers live in `/var/cache/genki-units/gk-p-27/ms-playwright`.

### F2: New test matched Rules panel copy (resolved)
- `page.getByText('Test Value Only')` is case-insensitive and matched "Sepolia test value only" in the Rules panel, which stays by design.
- Fix: the assertion uses the case-sensitive regex `getByText(/Test Value Only/)`.

### F3: Pre-existing flaky browser tests (root cause found; test-side fix applied)
- Symptom: runs 2 and 3 failed 4–5 tests that call the shared `open()` helper ("Quote Fridge Swap" stayed disabled for 5 s after Connect Wallet) and once the expired-quote test saw "Swap confirmed" instead of "Quote expired".
- Control: the unmodified baseline (commit 488f373, run in a temporary worktree) failed 5 of 14 with the same `open()` timeout (`test/scratch/pw-base1.log`). The flake predates this change.
- Root cause 1 (engine race, still present in `web/src/engine.ts`): `Engine.refresh()` returns immediately when `this.refreshing` is true, and `Engine.connect()` bumps `session` so the in-flight refresh discards its result. Clicking Connect while the initial `verify()` → `refresh()` is still reading the chain therefore leaves `ready:false` until the 12 s interval fires. On this slow host the initial reads often outlast the test's click. A real user can hit the same window: connect within the first seconds and the Wallet Move panel stays locked for up to 12 s. Not fixed here because it is outside the clean-top scope; proposed two-line fix: key the `refreshing` guard by session (`if(this.refreshing===this.session)return; this.refreshing=this.session;` and clear only when the session still matches).
- Root cause 2 (test race): the expired-quote test shifted `Date.now` by +31 s before the quote's `created` timestamp was taken, so on a slow host the quote was created with the shifted clock and did not expire.
- Fix (tests only, `web/tests/arcade.spec.ts`): `open()` waits for `.poolline` to contain `Block ` (initial verification done) before clicking Connect Wallet; the expired-quote test waits for the Confirm Swap button before shifting the clock.

### F4: Plan criteria corrected before verification
- T1 hook-title count is 9, not 7 (DESIGN.md budget and PLAN.md aligned before Gate C).
- T3 style grep narrowed to `\.network[{ ,]` / `\.dot[{ ,.]` so the kept `.network-alert` rule does not match.
- T5 statusbar wording allows the new test's `toHaveCount(0)` absence assertion.
- T4 bounding-box criterion is verified inside the new browser test, which sets the viewport to 1440×1100 for the box check and 390×844 for the overflow check.

## Verification evidence (2026-09-27, from `web/`, log `test/scratch/t6-chain.log`)

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0 |
| `npm run build` | exit 0; new `dist/assets/index-B7a0ls84.css`, `index-DAJijZFj.js`; old bundles deleted |
| `npm run check:export` | `PASS: exact handoff, network, pinned ABI hashes, 19 assets, 5348448 export bytes.` |
| `npm run test:browser` | 15 passed, 0 failed (16.8 s); JSON in `docs/frontend/browser-results.json` |
| `grep -rl "Sepolia arcade ready\|Test Value Only\|chainMessage" dist/` | empty |
| `grep -rn "Sepolia arcade ready" web/src web/tests web/scripts` | empty |
| `grep -cE "\.topbar\|\.wordmark\|\.network[{ ,]\|\.statusbar\|\.dot[{ ,.]" web/src/style.css` | 0 |
| `grep -c chainMessage web/public/game.html` / `.sound{top:auto;bottom:26px}` / `hook-title` | 0 / 1 / 9 |
| `git diff --quiet -- prototype web/public/assets/medallion.webp` | unchanged |
| `git status --short` | only `web/`, `dist/`, `docs/frontend/`, PLAN.md, AUDIT.md, STATUS.md |

Layout facts asserted by the new browser test: no `header`, no `.statusbar`, wallet controls within 16 px (x) / 14 px (y) of the iframe's top-left at 1440 px, no horizontal overflow at 390 px, `#chainMessage` absent, neon title text unchanged, speaker 26 scene units from the bottom and right edges (±3 px), first `[role=status]` inside `#review`.

## Open items

- T6 last criterion met: source, `dist/` and docs committed together on Lobby's go-ahead (2026-09-27).
- Engine race from F3 is reported, not fixed.
