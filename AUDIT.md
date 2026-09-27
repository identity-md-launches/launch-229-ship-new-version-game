# AUDIT.md

Task records for the "clean top" change (PLAN.md T1–T6, DESIGN.md R1–R8, shipped in 0c0e42b) and background play (PLAN.md T7–T14, DESIGN.md R9–R17). Evidence paths are project-relative; `test/scratch/` is git-ignored.

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

### F3: Pre-existing flaky browser tests (root cause found; test-side fix applied; engine fix in T10)
- Symptom: runs 2 and 3 failed 4–5 tests that call the shared `open()` helper ("Quote Fridge Swap" stayed disabled for 5 s after Connect Wallet) and once the expired-quote test saw "Swap confirmed" instead of "Quote expired".
- Control: the unmodified baseline (commit 488f373, run in a temporary worktree) failed 5 of 14 with the same `open()` timeout (`test/scratch/pw-base1.log`). The flake predates this change.
- Root cause 1 (engine race in `web/src/engine.ts`, fixed in T10: the guard is now keyed by the connect epoch): `Engine.refresh()` returns immediately when `this.refreshing` is true, and `Engine.connect()` bumps `session` so the in-flight refresh discards its result. Clicking Connect while the initial `verify()` → `refresh()` is still reading the chain therefore leaves `ready:false` until the 12 s interval fires. On this slow host the initial reads often outlast the test's click. A real user can hit the same window: connect within the first seconds and the Wallet Move panel stays locked for up to 12 s. Not fixed here because it is outside the clean-top scope; proposed two-line fix: key the `refreshing` guard by session (`if(this.refreshing===this.session)return; this.refreshing=this.session;` and clear only when the session still matches).
- Root cause 2 (test race): the expired-quote test shifted `Date.now` by +31 s before the quote's `created` timestamp was taken, so on a slow host the quote was created with the shifted clock and did not expire.
- Fix (tests only, `web/tests/arcade.spec.ts`): `open()` waits for `.poolline` to contain `Block ` (initial verification done) before clicking Connect Wallet; the expired-quote test waits for the Confirm Swap button before shifting the clock.

### F4: Plan criteria corrected before verification
- T1 hook-title count is 9, not 7 (DESIGN.md budget and PLAN.md aligned before Gate C).
- T3 style grep narrowed to `\.network[{ ,]` / `\.dot[{ ,.]` so the kept `.network-alert` rule does not match.
- T5 statusbar wording allows the new test's `toHaveCount(0)` absence assertion.
- T4 bounding-box criterion is verified inside the new browser test, which sets the viewport to 1440×1100 for the box check and 390×844 for the overflow check.

### F5: Page error while wagmi restores a saved connection (fixed in T13)
- Symptom: `s?.getProvider is not a function` as an unhandled rejection after a reload or in a second tab; surfaced by the T13 suite-wide `pageerror` check (earlier suites did not collect page errors in those tests).
- Root cause: during reconnect, `useAccount().connector` is the persisted plain object (`id`, `name`, `type`, `uid`) until wagmi hydrates it, so the provider effect in `web/src/main.tsx` called a missing method. The line predates background play (unchanged since 0c0e42b).
- Fix: the effect calls `getProvider` only when it is a function and otherwise connects without a provider; the effect reruns with the hydrated connector, and `GameEngine.connect` then picks up the provider.

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
- Engine race from F3 was reported here and fixed in T10.

## Background play (T7–T14)

Design decisions (Lobby, 2026-09-27): session permissions; key re-derived from a signature each visit; ETH top-up plus optional ICE move, ERC-7715 auto-refill where supported; fridge hits swap instantly; old per-step flow removed; stay in DEVELOP (design gate declined, A/B/C not reset). The MetaMask Smart Accounts Kit is not used because it sends analytics by default; ERC-7715 is called through raw EIP-1193 requests.

### Evidence

| Task | Check | Result |
|---|---|---|
| T7 | `npm run typecheck` | exit 0 |
| T7 | `npm test` | 14 passed (3 new: redemption encoding with a 120-byte ICE execution and a 52-byte native one, checksummed DelegationManager, presets and uint caps) |
| T8 | `npm run typecheck` | exit 0 |
| T8 | `npm test` | 19 passed (5 new: exact session message; same signature → same key and address, 64-byte / foreign / zero signatures refused; 11 allowlisted calls accepted; 18 off-list calls blocked; Web Lock held once per player, no-op without `navigator.locks`) |
| T8 | `grep -c "localStorage\|sessionStorage\|console\." web/src/session.ts` | 0 |
| T9 | `npm run typecheck` | exit 0 |
| T9 | `npm test` | 24 passed (5 new: support detection incl. missing type / wrong chain / thrown error; exact two-item request with 7-day expiry and optional redeemer/payee rules, granted ICE amount read back from the response; 7 malformed grants and an empty response refused, wallet rejection (4001) propagated, dependencies accepted when the player has code; storage round-trip, expired and malformed grants removed; ETH and ICE pulls pass `checkSessionCall`) |
| T10 | `npx tsc --noEmit` | engine, session and refill modules clean; the 11 remaining errors are all in `src/main.tsx`, which still calls the removed `prepareSwap` / `prepareTank` / `advance` / `intent` (T11) |
| T10 | `npm test` | 24 passed |
| T10 | `grep -c "intent\|prepareSwap\|prepareTank\|advance(" web/src/engine.ts` | 0; `checkSessionCall(` has one call site (`broadcast`); all 22 M10 message texts present verbatim |
| T10+T11 | `npm run typecheck && npm test && npm run build` | exit 0; 24 unit tests passed; `✓ built in 6.64s`, manifest 19 assets (log `test/scratch/t11-verify.log`). The rebuilt `dist/` is left unstaged for T14 |
| T11 | `grep -c "Quote Fridge Swap\|Review Tank Fill\|Cancel Review\|Review & Confirm\|intent" web/src/main.tsx` | 0 |
| T11 | `style.css` | 4 `.review-panel .session-*` rules added; `.review-panel .quote` / `.review-panel ol` count 0 |
| T11 | `python3 scripts/adapt-game.py` twice | same sha1 both runs (`eefa7a1a…`); `grep -c "intent\|Review your quote" public/game.html` = 0; `Still confirming the last move` = 1; `git status -- prototype` clean |
| T12 | `npm run typecheck` | exit 0 |
| T12 | Node smoke: real `GameEngine` against the fixture (`test/scratch/fixture-smoke.mts`, log `fixture-smoke.log`) | 27/27 PASS: game-wallet address equals the Node-side derivation; start + top-up + Move ICE = 3 prompts, then ICE sale, tank fill, throne buy and the B+2 auto-draw add 0 prompts (all `eth_sendRawTransaction` from the game wallet, 3 warm-up approvals with consecutive nonces); grant = 1 prompt, a 1,000-pee fill pulls ICE under the cap, the next one gets the used-up message; withdraw returns all ICE and all but 84,000 wei; no stored value holds the key; 64-byte and rejected signatures refused; without ERC-7715 the short-ICE / short-ETH / no-gas cases give the Move ICE / Top Up messages; a router revert blocks signing; unmocked methods throw -32601 |
| T13 | `npx playwright test` (run 1, `test/scratch/t13-run1.log`) | 18 passed, 3 failed — all three on the new suite-wide `pageerror` check: `s?.getProvider is not a function` after a reload or in a second tab (F5) |
| T13 | `npx playwright test` after the F5 fix (runs 2–4, `t13-run2..4.log`) | 21 passed, 0 failed, three runs in a row (35.5 s / 36.9 s / 39.6 s); no `pageerror` in any test |
| T13 | Suite content | 21 tests, names identical to M13 (5 kept with `Quote Fridge Swap` → `Swap Now` / `Start Background Play` renames, 9 rewritten, 7 new); the expired-quote test is gone. Prompt count unchanged across 3 moves in manual mode and 3 auto-refill swaps; every `Swap Now` click reaches `eth_sendRawTransaction` in < 3 s (asserted per click); no storage value holds the key hex; the same game-wallet address after reload and a new signature; no horizontal overflow at 390 px with a session open |
| T13 | `npm test` | 24 passed |
| T14 | `npm run typecheck && npm test && npm run build && npm run check:export && npm run test:browser` (log `test/scratch/t14-chain.log`) | exit 0; 24 unit tests passed; `✓ built in 6.48s`; `PASS: exact handoff, network, pinned ABI hashes, 19 assets, 5370024 export bytes.`; 21 browser tests passed (34.8 s) |
| T14 | `grep -rl "Quote Fridge Swap\|Cancel Review\|Review your quote" dist/` | no output |
| T14 | `git status --short` | changes only under `web/`, `dist/`, `docs/frontend/`, AUDIT.md, DESIGN.md, PLAN.md, STATUS.md; `prototype/` clean; the Anvil test keys appear in no file under `dist/` or `web/src/` |
| T14 | `git show --stat HEAD` | `a54dffa` "Add background play with a session game wallet and auto-refill": 25 files, 1357 insertions, 427 deletions; source under `web/src/`, `web/tests/`, `web/scripts/`, `web/public/` and the rebuilt `dist/` (new asset hashes, `game.html`, `index.html`, `imd-deployment.json`) in one commit |

## Scene redesign (T15–T19)

Decisions (Lobby, 2026-09-27): scene matches `genkiai-page1.html` (SHA-1 `f528db33…`; a second upload was byte-identical); the page below the game stays; the wallet dropdown and chips show mainnet $ICE / $IMD read-only while play stays on Sepolia; mainnet play is a separate design next.

T17 notes: wallet rejections are detected by a shared `rejected()` in `protocol.ts` (same rule `errorMessage` already used); a rejected network switch says "network switch cancelled" (DESIGN M17 updated). A click on the page outside the scene closes the dropdown through the scene window's `blur`. Scratch scripts run under `tsx` need a `window.__name` shim before the fixture's init script; the Playwright runner does not.

### Redesign evidence

| Task | Check | Result |
|---|---|---|
| T15 | `sha1sum prototype/index.html` | `f528db33d762c012c622dc0aa451298b9106aeaf` |
| T15 | `python3 web/scripts/adapt-game.py` twice, `sha1sum web/public/game.html` | `3cf729ee…` both runs; `grep -c 'bgmData\|eth_requestAccounts\|id="soundBtn"'` = 0; one `assets/bgm.mp3` loader; embedded music SHA-256 `48c660ac…` equals `prototype/assets/bgm.mp3` |
| T15 | `diff` of old vs new `game.html` | only Lobby's edits (brandmark 20/20, wallet pill, docked start, climb dumpster stats, hero x=400, throne timing, no speaker) plus the adapt changes (chip labels `$IMD`, mainnet aria labels, `.sound` override removed) |
| T15 | Playwright on `web/public/game.html` at 1280×720 | `docked: true`, no `#soundBtn`, `#imdBal .tk` = "$IMD", pill at x 1139–1237 / y 38 (top-right), brandmark at 49/36; no page errors |
| T15 | `npm run typecheck && npm test` (log `test/scratch/t15.log`) | exit 0; 24 tests, 24 pass |
| T16 | `npm run typecheck && npm test` (log `test/scratch/t16.log`) | exit 0; 26 tests, 26 pass (new: checksummed tokens and HTTPS RPCs; stub client returns all three values, a failing `balanceOf` leaves only `imd` undefined with one `console.warn`) |
| T16 | live read-only `readHoldings(0x…dEaD)` against the real mainnet RPCs | `{"eth":"12640615121762768233863","ice":"0","imd":"0"}` |
| T17 | `grep -rn "wallet-controls\|rainbowkit\|ConnectButton" web/src web/package.json` | no output (exit 1) |
| T17 | `npm uninstall @rainbow-me/rainbowkit` (log `test/scratch/t17-npm.log`) | lockfile: 102 packages removed, 0 added, 0 version changes; JS bundle 2,564,547 → 627,481 bytes |
| T17 | `python3 web/scripts/adapt-game.py` twice | `game.html` sha1 `3aa07a46…` both runs; new anchors use `once()` (fail when missing) |
| T17 | `npm run typecheck && npm test && npm run build` (log `test/scratch/t17-chain.log`) | exit 0; 27 tests, 27 pass (new: `showHoldings` "—" / "…" / "?" / truncated 4 decimals); `✓ built in 5.98s` |
| T17 | scratch Playwright on built `dist/` with the T12 wallet fixture and a stubbed mainnet RPC (`test/scratch/t17-smoke.mts`, log `t17-smoke.log`) | 18 PASS, 0 FAIL: pill "connect" → `0xf39F…2266`; chips `1,234.5` / `42`, aria "Mainnet $ICE balance 1,234.5"; dropdown "Sepolia · on Ethereum mainnet · ETH 1.5 / $ICE 1,234.5 / $IMD 42 · the arcade plays on Sepolia for now"; opening refreshes; Escape and a click on the page close it; disconnect resets chips to "—"; pill 28.0 px at 390 px; wrong network → "switch to Sepolia" (red); failed reads → "?"; no wallet → bubble text, cleared after 6 s; no page errors |
| T18 | fixture (`web/tests/wallet-fixture.ts`) | mainnet RPCs (`MAINNET_RPCS`) answered: player holds 1.5 ETH, 1,234.5 $ICE, 42 $IMD; every other non-local host is aborted and recorded in `fx.external` (asserted empty in the subpath and redesign tests) |
| T18 | spec (`web/tests/arcade.spec.ts`) | helpers connect through the in-scene pill; new "scene redesign" test (docked brand at 20/20, chips top-left, pill top 22.5 / right 14 scene units, no `#soundBtn`, dropdown ETH 1.5 / $ICE 1,234.5 / $IMD 42, Escape and outside click close, disconnect resets, pill ≥ 28 px at 390 px); wrong network switches from the pill; music test toggles with M (media spy sees `pause` then `playing`); no-wallet text in the pill bubble |
| T18 | `npm run test:browser`, twice (logs `test/scratch/t18-run1.log`, `t18-run2.log`) | `22 passed (37.5s)`, `22 passed (37.4s)`; 0 failed, 0 flaky; desktop screenshot shows docked brand, "— $ICE" / "— $IMD" chips, "connect" pill with the no-wallet bubble |
| T19 | `npm run typecheck && npm test && npm run build && npm run check:export && npm run test:browser` from `web/` (log `test/scratch/t19-chain.log`) | exit 0; 27 tests, 27 pass; `✓ built in 5.89s`; `PASS: exact handoff, network, pinned ABI hashes, 19 assets, 3414059 export bytes.` (was 5,370,024); `22 passed (37.3s)` |
| T19 | `git status --short` | changes only under `prototype/`, `web/`, `dist/`, `docs/frontend/` and the project docs; `dist/game.html` equals `web/public/game.html`; `KEYS.md` and `.gitlawb/identity.pem` still ignored |
