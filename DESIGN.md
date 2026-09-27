# DESIGN.md

Project: pepes armed with ai (our fork). Live code: `web/` (Vite + React shell around the prototype game scene), `prototype/` (MIT original, never edited), `dist/` (tracked static export).

## Requirements

### Problem
The game page stacks a page header (wordmark, network label, wallet buttons, Rules link) above the game window, shows a persistent status sentence at the top of the game window, and repeats engine messages in a status bar under the game. The team wants a clean top: the game window is the first thing on the page, wallet controls sit inside it, the speaker sits in its bottom-right corner, and the "ready" sentence is gone. Smallest valuable change: remove those three page-level elements, relocate the two controls that must survive (wallet, speaker), and give engine messages one home.

### Requirements
- R1. No header above the game window. The wordmark "pepes armed with ai", the label "Sepolia · Test Value Only", the Rules link and the header wallet buttons are absent from the page DOM. The game window is the first visible element of the page (only the visually hidden skip link and h1 precede it).
- R2. No status overlay inside the game window. The strings "Sepolia arcade ready. Connect your wallet to play for test value." and "Connect your wallet below to play for test value." appear nowhere in `web/src`, `web/public/game.html` or `dist/`.
- R3. No status bar under the game window. Engine messages (errors, confirmations, progress) and the "View Transaction ↗" link are shown in one status line inside the "03 · Wallet Move" panel; the line is empty when the engine has no message.
- R4. Wallet controls live inside the game window, top-left, at every viewport width from 320px up: "Connect Wallet" (or "Connecting…") when disconnected; the address chip (opens the account dialog) and "Disconnect" when connected. No auto-connect on play.
- R5. The music (speaker) button sits in the bottom-right corner of the game window, 26 game-units from the bottom and right edges, with unchanged labels ("Mute music" / "Play music"), title, M-key behaviour and reduced-motion handling.
- R6. The in-game neon title "pepes armed with ai" (upper right of the scene) is unchanged.
- R7. Everything else is unchanged: game play, keyboard and touch controls, pause, panels, tickets, the Rules panel, footer, chain bindings and the deployment manifest. `npm run typecheck`, `npm test`, `npm run build`, `npm run check:export` and the Playwright suite pass.
- R8. The tracked `dist/` export is rebuilt from the changed source and `npm run check:export` prints PASS.

### Success criteria
- Desktop (1440×1100) and phone (390×844) screenshots show: no header, no status bar, wallet controls top-left inside the game frame, speaker bottom-right inside the frame, neon title still present.
- All checks in R7 green; `dist/` committed in the same change as the source.

### Constraints
- `prototype/index.html` stays byte-identical (MIT original). Scene changes go through `web/scripts/adapt-game.py`; `web/public/game.html` must stay byte-reproducible by running that script.
- No new dependencies. No contract, chain, manifest or hosting changes.
- Build on the current fork (upstream a27372f). IMD's unpublished "arcade wallet" commit is out of scope.

### Non-goals
- Auto-connecting the wallet when the player wakes the pepe.
- Toast/overlay notifications inside the game window.
- A phone-specific layout beyond keeping the same controls usable.
- Publishing the result (the live site stays under IMD's name until we host our own).

## Architecture

### Existing system (unchanged parts)
- `web/src/main.tsx` — React 19 shell. `Arcade` renders: skip link, page h1 (sr-only), game region (iframe `./game.html` + key legend/pause row + touch controls), network alert, live balances, pool line, three panels (Jackpot Fridge, Golden Throne, Wallet Move = `section#review.review-panel`), ticket board, Rules `<details>`, footer. It exposes `window.pepe` to the iframe (snapshot, consumePee, consumeBurst, addPoints, message, swap, flip) and pushes every state change into `iframe.contentWindow.pepeScene.update(state)`.
- `web/src/engine.ts` — `GameEngine`: chain reads/writes, `Snapshot` state (`message`, `tx`, `ready`, …), `message()` setter. Ready transition at the end of `refresh()`.
- `web/src/protocol.ts`, `config.ts`, `chain.mjs`, `canonical.mjs` — chain protocol and deployment loading. Untouched.
- `web/src/style.css` — shell styles (single file, ~110 lines).
- Scene pipeline: `prototype/index.html` → `python3 web/scripts/adapt-game.py` → `web/public/game.html` (committed; currently byte-reproducible). The scene is a 1280×720 `.slide` scaled by `fit()` to the iframe; in-scene pixels scale with the frame width (s ≈ frameWidth/1280).
- Export pipeline: `npm run build` = `scripts/prepare.mjs` (pins ABIs from `handoff.sourceCommit` e145493b, present in our clone) → `vite build` → `scripts/manifest.mjs` → `dist/` (tracked). `npm run check:export` verifies `dist/` against the manifest.
- Tests: `web/tests/core.test.ts` (node), `web/tests/arcade.spec.ts` (Playwright, 14 tests, mock wallet fixture, server `tests/server.mjs` on 4173), `web/scripts/check-browser-live.mjs` (read-only live check writing `docs/frontend/live-browser.json`).
- Tech stack: inherited (React 19.3, Vite 7, wagmi/viem/RainbowKit, TanStack Query via wagmi). House default deviation (no TanStack Router, no Cloudflare deploy yet) is inherited from upstream; no change in this feature.

### Layout after the change (page, top to bottom)
```
[skip link, sr-only h1]
.scene (position:relative)
  ├─ iframe game.html  ── in-scene: speaker bottom-right (26u), neon title unchanged, no #chainMessage
  └─ .wallet-controls (absolute, top-left)  Connect Wallet | 0x1234…abcd  Disconnect
.game-tools (key legend + Pause)          ← unchanged
.touch-controls                           ← unchanged
.network-alert (only when wrong network)  ← unchanged
.balances / .poolline                     ← unchanged
.panels: 01 Fridge | 02 Throne | 03 Wallet Move ── new .status line under its h2
tickets / rules / footer                  ← unchanged
```

### Module Specs

#### M1: Header and status-bar removal — changed
- Purpose: delete the page header and the under-game status bar (R1, R3 first half).
- Location: `web/src/main.tsx` (Arcade JSX), `web/src/style.css`.
- Interface: no new interface. Removes JSX: the whole `<header className="topbar">…</header>` element; the whole `<div className="statusbar" role="status" aria-live="polite">…</div>` element. Removes CSS rules: `.topbar`, `.wordmark`, `.wordmark em`, `.network`, `.statusbar`, `.statusbar a`, `.dot`, `.dot.live`, and their occurrences inside the `@media(max-width:1000px)` and `@media(max-width:600px)` blocks (`.topbar`, `.wordmark`, `.statusbar`, `.statusbar a`, `.statusbar .dot`). `.wallet-controls` rules are replaced by M2, not kept.
- Internals: 1) delete the header JSX; 2) delete the statusbar JSX; 3) delete the listed CSS rules; 4) keep `<a className="skip" href="#moves">Skip to Wallet Controls</a>` and `<h1 className="sr-only">` as they are; 5) `Rules` link is dropped, the `<details id="rules">` panel and its `rules` state stay (still opened by `location.hash==='#rules'`).
- Edge & error policy: none (static markup). The `wrong`-network alert keeps its position (first element after the game region).
- Budgets: `grep -c "topbar\|statusbar\|wordmark\|className=\"network\"" web/src/main.tsx web/src/style.css` = 0 in both files; `dist/index.html`+bundle contain no "Test Value Only" (Rules panel copy "Sepolia test value only" is lower-case and stays).
- Covers: R1, R3 · Depends on: M3 (message home must exist before the bar goes).

#### M2: In-game wallet overlay — new
- Purpose: show the wallet controls inside the game window, top-left, page-sized (they do not scale with the scene) (R4).
- Location: `web/src/main.tsx` (game region JSX), `web/src/style.css`.
- Interface: JSX inside `<section className="game-region">`:
  ```tsx
  <div className="scene">
    <iframe ref={scene} title="…unchanged…" src="./game.html" onLoad={syncScene}/>
    <div className="wallet-controls">
      {address
        ? <><ConnectButton.Custom>{({openAccountModal})=><button onClick={openAccountModal} aria-label="Open wallet account">{address.slice(0,6)}…{address.slice(-4)}</button>}</ConnectButton.Custom>
           <button className="quiet" onClick={()=>disconnect()}>Disconnect</button></>
        : <button disabled={walletBusy} onClick={()=>void connectWallet()}>{walletBusy?'Connecting…':'Connect Wallet'}</button>}
    </div>
  </div>
  ```
  (button markup and handlers are the former header's, moved verbatim; only the Rules link is dropped.)
- Internals (CSS, exact values):
  1. `.scene{position:relative}`; the existing `iframe` rule is unchanged.
  2. `.wallet-controls{position:absolute;top:10px;left:12px;z-index:2;display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);pointer-events:none}`
  3. `.wallet-controls>*{pointer-events:auto}`
  4. `.wallet-controls button{min-height:34px;padding:0 12px;font-size:13px;border-radius:9px;background:rgba(8,15,58,.86);border:1px solid rgba(227,190,96,.7);color:var(--gold);box-shadow:0 4px 12px rgba(3,6,26,.5);white-space:nowrap}`
  5. `.wallet-controls button.quiet{background:rgba(8,15,58,.6)}`
  6. `.wallet-controls button:hover:enabled{background:rgba(21,34,104,.95);border-color:var(--gold)}`
  7. inside `@media(max-width:600px)`: `.wallet-controls{top:8px;left:10px;gap:6px}` and `.wallet-controls button{min-height:30px;padding:0 9px;font-size:12px}`
  8. Placement rationale (fixed, not to be re-decided): the scene's brand mark starts at 46 game-units from the top; at frame width ≥ 1232px the 10–44px control row clears it. On narrower frames the row overlaps the top of the medallion; this is accepted (the medallion is decorative).
- Edge & error policy: `connectWallet()` already routes "No browser wallet found…" and rejections through `engine.message()`, which now lands in M3's status line. Long addresses are truncated to `0x1234…abcd` (10 characters + ellipsis). The overlay never blocks scene input outside its own buttons (pointer-events rule).
- Budgets: overlay height 34px desktop / 30px ≤600px; horizontal footprint ≤ 60% of the frame width at 390px viewport (Connect Wallet ≈ 128px; chip + Disconnect ≈ 215px of 362px); no horizontal page overflow at 390px (`scrollWidth <= innerWidth`); keyboard reachable: Tab from the skip link reaches the wallet button before the iframe.
- Covers: R4 · Depends on: M1 (former markup removed), M3.

#### M3: Wallet Move status line — new
- Purpose: one home for engine messages and the transaction link after the status bar is gone; drop the "ready" copy (R2 part, R3).
- Location: `web/src/main.tsx` (review panel JSX), `web/src/style.css`, `web/src/engine.ts` (one line).
- Interface: in `section#review.review-panel`, directly after `<h2>Review & Confirm</h2>`:
  ```tsx
  <p className="status" role="status" aria-live="polite">{state.message}{state.tx&&<a href={`${d.network.explorer}/tx/${state.tx}`} target="_blank" rel="noreferrer">View Transaction ↗</a>}</p>
  ```
  Engine: in `refresh()`, the line
  `else if(this.state.message==='Checking deployment and pool…')this.message('Sepolia arcade ready. Connect your wallet to play for test value.');`
  becomes
  `else if(this.state.message==='Checking deployment and pool…')this.message('');`
- Internals: 1) add the `<p>` (always rendered so the live region exists before the first message); 2) CSS `.review-panel .status{min-height:20px;margin:0 0 14px;font-size:13px;line-height:1.5;color:var(--gold);overflow-wrap:anywhere}` `.review-panel .status:empty{min-height:0;margin:0}` `.review-panel .status a{margin-left:8px;font-size:13px}`; 3) engine change above; 4) `window.pepe.message` stays the same function, so scene messages ("Tank empty…") also land here.
- Edge & error policy: message may be up to 240 characters (`errorMessage` cap); wraps inside the panel. `state.tx` without a message shows the link alone. The "Checking deployment and pool…" startup text shows in this line until the first successful refresh, then clears.
- Budgets: exactly one `[role="status"]` element in the page DOM after startup (Playwright `getByRole('status').first()` keeps resolving to it); `grep -rn "Sepolia arcade ready" web/src web/scripts web/tests web/public dist` = 0 hits.
- Covers: R2 (shell side), R3 · Depends on: none.

#### M4: Scene adaptation — changed
- Purpose: remove the in-scene status overlay and move the speaker to the bottom-right corner, via the adapt script so `game.html` stays reproducible (R2, R5, R6).
- Location: `web/scripts/adapt-game.py` (source of truth), `web/public/game.html` (regenerated output), `web/public/assets/medallion.webp` (rewritten byte-identical by the script).
- Interface: `python3 scripts/adapt-game.py` run from `web/`; output must equal the committed `game.html` after the change.
- Internals (edits to `adapt-game.py`):
  1. In the `s.replace('</style>', ''' … ''',1)` block: delete the line starting with `#chainMessage{position:absolute;…}` and add the line `.sound{top:auto;bottom:26px}` (keep the `.slide:not(.docked)…#imdBal` and `.paused` lines).
  2. Delete the statement `s=s.replace('<div class="hero dormant"', '<p id="chainMessage" …>Connect your wallet below to play for test value.</p><div class="hero dormant"')`.
  3. In the injected `window.pepeScene.update` body: delete the line `var msg=document.getElementById('chainMessage');msg.textContent=state.message;`.
  4. Do not touch `h1.hook-title`, `fitTitle`, `dockBrand` or anything else.
  5. Run the script; `git diff --stat web/public` must show only `game.html` changed (medallion.webp identical).
- Edge & error policy: the script asserts nothing new; if the prototype ever changes, the same three edits still apply because they only touch injected text. `.sound.waiting` nudge animation and `@media(prefers-reduced-motion)` rule are position-independent and keep working.
- Budgets: `grep -c chainMessage web/public/game.html` = 0; `grep -c "\.sound{top:auto;bottom:26px}" web/public/game.html` = 1; `grep -c "hook-title" web/public/game.html` unchanged (9); rerunning the script produces a zero-line diff.
- Covers: R2 (scene side), R5, R6 · Depends on: none.

#### M5: Test and live-check updates — changed
- Purpose: keep the suites truthful for the new layout (R7).
- Location: `web/tests/arcade.spec.ts`, `web/scripts/check-browser-live.mjs`.
- Interface / Internals:
  1. Test "scene runs like the prototype; pause, rules and music are keyboard accessible": replace `await page.getByRole('link',{name:'Rules',exact:true}).click();` with `await page.getByText('Rules of the Arcade',{exact:true}).click();` (opens the `<details>` via its summary); keep the following "Block proposers can influence" expectation.
  2. Add one test `'clean top: no header or status bar, wallet inside the scene, speaker bottom-right'`: `await fixture(page,{wallet:false}); await page.goto('/ipfs/test/');` then assert `page.locator('header')` count 0, `page.locator('.statusbar')` count 0, `page.getByText('Test Value Only')` count 0, `page.locator('.scene .wallet-controls').getByRole('button',{name:'Connect Wallet',exact:true})` visible, the wallet-controls bounding box is inside the iframe bounding box with `x - frame.x <= 16` and `y - frame.y <= 14`; inside the frame: `frame.locator('#chainMessage')` count 0, `frame.locator('h1.hook-title')` has text `pepes armed with ai`, and for `#soundBtn` (bounding box `b`) with the `.slide` bounding box `f`: `Math.abs((f.y+f.height)-(b.y+b.height) - 26*scale) <= 3` and `Math.abs((f.x+f.width)-(b.x+b.width) - 26*scale) <= 3` where `scale = f.width/1280`. Also assert the first `[role=status]` on the page is inside `#review`.
  3. `check-browser-live.mjs`: replace the `.statusbar` wait with `await page.waitForFunction(()=>document.querySelector('.poolline')?.textContent?.includes('Block '),{},{timeout:45000});` and `result.status=await page.locator('#review .status').innerText();` (expected empty string when idle).
- Edge & error policy: if `npx playwright install chromium` cannot download browsers on this host, record the failure verbatim in AUDIT.md and verify the layout assertions by hand through the `genki-web` preview instead; the node tests, typecheck, build and export check are never optional.
- Budgets: Playwright suite = 15 tests, 15 pass; node tests pass; no `pageerror` in the static test.
- Covers: R7 · Depends on: M1–M4.

#### M6: Export rebuild — changed
- Purpose: keep the tracked static export equal to the source (R8).
- Location: `dist/` (root), `docs/frontend/desktop.png` and `docs/frontend/mobile.png` when the Playwright static test regenerates them.
- Interface: from `web/`: `npm ci && npm run typecheck && npm test && npm run build && npm run check:export`.
- Internals: 1) run the chain above; 2) `git status` must show changes only under `web/`, `dist/`, `docs/frontend/` (plus the design docs); 3) commit source + dist together.
- Edge & error policy: `prepare.mjs` needs commit e145493b in the clone (verified present). If `npm ci` fails for network reasons, stop and report; do not hand-edit `dist/`.
- Budgets: `check:export` prints `PASS: exact handoff, network, pinned ABI hashes, N assets, B export bytes.` with N ≤ 128 and B < 31457280.
- Covers: R8 · Depends on: M1–M5.

### Impact analysis
| Removed / changed | Referenced by | Decision |
|---|---|---|
| `header.topbar` (wordmark, network label, wallet buttons, Rules link) | `style.css` rules + 2 media blocks; `arcade.spec.ts` Rules-link click; skip link text | CSS deleted (M1); test opens the Rules summary instead (M5); skip link kept unchanged |
| `.statusbar` | `style.css` (+ media); `check-browser-live.mjs` wait/result; 11 test assertions on `getByRole('status').first()` | CSS deleted (M1); script waits on `.poolline` (M5); assertions unchanged, now resolve to the `#review .status` line (M3) |
| "Sepolia arcade ready…" copy | `engine.ts` ready transition; `check-browser-live.mjs` | engine sets empty message (M3); script no longer looks for it (M5) |
| `#chainMessage` (scene) | `adapt-game.py` ×3; `game.html`; `dist/game.html` | removed at the source (M4); export rebuilt (M6) |
| `.sound` position | `game.html` CSS; test focuses "Mute music" (position-agnostic) | override injected by adapt (M4) |
| `docs/frontend/*.png` | regenerated by the static Playwright test | commit regenerated files with the change (M6) |

### Dependency topology
M3 → M1 → M2 (message home first, then remove the bar and header, then place the overlay) ; M4 independent of M1–M3 ; M5 after M1–M4 ; M6 last. Plan order: M4, M3, M1, M2, M5, M6.

### File layout touched
```
web/scripts/adapt-game.py        (M4)   web/public/game.html (regenerated, M4)
web/src/engine.ts                (M3)   web/src/main.tsx (M1, M2, M3)
web/src/style.css                (M1, M2, M3)
web/tests/arcade.spec.ts         (M5)   web/scripts/check-browser-live.mjs (M5)
dist/**                          (M6)   docs/frontend/desktop.png, mobile.png (M6)
```
