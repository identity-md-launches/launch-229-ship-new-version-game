# PLAN.md

## Meta
- Design: DESIGN.md (R1..R8)
- Updated: 2026-09-27 12:10

## Tasks

### T1: Adapt the scene: drop the status overlay, move the speaker bottom-right [S]
- Goal: `web/public/game.html` regenerated from `web/scripts/adapt-game.py` with no `#chainMessage` and the speaker at bottom-right; prototype untouched.
- Modules: `web/scripts/adapt-game.py`, `web/public/game.html`, `web/public/assets/medallion.webp` (rewritten identical)
- Requirements: R2, R5, R6
- Acceptance:
  - [x] In `adapt-game.py`, the injected style block no longer contains the `#chainMessage{position:absolute;…}` line and contains the line `.sound{top:auto;bottom:26px}`.
  - [x] In `adapt-game.py`, the `<p id="chainMessage" …>` injection statement and the `var msg=document.getElementById('chainMessage');msg.textContent=state.message;` line are deleted; `h1.hook-title`, `fitTitle`, `dockBrand` untouched.
  - [x] After `cd web && python3 scripts/adapt-game.py`: `grep -c chainMessage public/game.html` prints 0; `grep -c "\.sound{top:auto;bottom:26px}" public/game.html` prints 1; `grep -c "hook-title" public/game.html` prints 9.
  - [x] `git diff --stat` shows changes only in `web/scripts/adapt-game.py` and `web/public/game.html`; `git diff --quiet -- prototype web/public/assets/medallion.webp` exits 0.
  - [x] Running `python3 scripts/adapt-game.py` a second time leaves `git diff --stat web/public/game.html` unchanged (byte-reproducible).
- Verify: the grep/diff commands above from `web/`.

### T2: Give engine messages a home in the Wallet Move panel and drop the ready copy [S]
- Goal: `#review .status` line exists and carries `state.message` + the View Transaction link; the engine sets an empty message when the arcade becomes ready.
- Modules: `web/src/main.tsx`, `web/src/style.css`, `web/src/engine.ts`
- Requirements: R2, R3
- Acceptance:
  - [x] `main.tsx`: directly after `<h2>Review & Confirm</h2>` there is `<p className="status" role="status" aria-live="polite">{state.message}{state.tx&&<a href={`${d.network.explorer}/tx/${state.tx}`} target="_blank" rel="noreferrer">View Transaction ↗</a>}</p>`, rendered unconditionally.
  - [x] `style.css` contains `.review-panel .status{min-height:20px;margin:0 0 14px;font-size:13px;line-height:1.5;color:var(--gold);overflow-wrap:anywhere}`, `.review-panel .status:empty{min-height:0;margin:0}`, `.review-panel .status a{margin-left:8px;font-size:13px}`.
  - [x] `engine.ts` ready transition reads `else if(this.state.message==='Checking deployment and pool…')this.message('');`.
  - [x] `grep -rn "Sepolia arcade ready" web/src` prints nothing; `cd web && npm run typecheck` exits 0.
- Verify: grep and `npm run typecheck` from `web/`.

### T3: Remove the page header and the status bar [S]
- Goal: nothing renders above the game region except the skip link and the sr-only h1; the status bar under the game is gone.
- Modules: `web/src/main.tsx`, `web/src/style.css`
- Requirements: R1, R3
- Acceptance:
  - [x] `main.tsx` no longer contains `<header className="topbar">`, `className="wordmark"`, `className="network"`, the `Rules` anchor, or `<div className="statusbar"`; the `<details id="rules">` panel and `rules` state remain.
  - [x] `style.css` no longer contains rules for `.topbar`, `.wordmark`, `.network`, `.statusbar`, `.dot` (base or media blocks): `grep -cE "\.topbar|\.wordmark|\.network[{ ,]|\.statusbar|\.dot[{ ,.]" web/src/style.css` prints 0 (`.network-alert` is kept and must not match).
  - [x] `<a className="skip" href="#moves">Skip to Wallet Controls</a>` and `<h1 className="sr-only">Pepe’s Sepolia Arcade</h1>` are unchanged and remain the only elements before `<main>`.
  - [x] `cd web && npm run typecheck` exits 0.
- Verify: grep commands and `npm run typecheck` from `web/`.

### T4: Place the wallet controls inside the game window, top-left [S]
- Goal: `.scene` wrapper around the iframe with an absolutely positioned `.wallet-controls` overlay carrying the former header wallet buttons.
- Modules: `web/src/main.tsx`, `web/src/style.css`
- Requirements: R4
- Acceptance:
  - [x] `main.tsx` game region contains `<div className="scene"><iframe …unchanged attributes… /><div className="wallet-controls">…</div></div>` where the overlay content is exactly: connected → `ConnectButton.Custom` address chip (`aria-label="Open wallet account"`, text `{address.slice(0,6)}…{address.slice(-4)}`) + `<button className="quiet" onClick={()=>disconnect()}>Disconnect</button>`; disconnected → `<button disabled={walletBusy} onClick={()=>void connectWallet()}>{walletBusy?'Connecting…':'Connect Wallet'}</button>`. No Rules link.
  - [x] `style.css` contains, verbatim: `.scene{position:relative}`; `.wallet-controls{position:absolute;top:10px;left:12px;z-index:2;display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);pointer-events:none}`; `.wallet-controls>*{pointer-events:auto}`; `.wallet-controls button{min-height:34px;padding:0 12px;font-size:13px;border-radius:9px;background:rgba(8,15,58,.86);border:1px solid rgba(227,190,96,.7);color:var(--gold);box-shadow:0 4px 12px rgba(3,6,26,.5);white-space:nowrap}`; `.wallet-controls button.quiet{background:rgba(8,15,58,.6)}`; `.wallet-controls button:hover:enabled{background:rgba(21,34,104,.95);border-color:var(--gold)}`; and inside `@media(max-width:600px)`: `.wallet-controls{top:8px;left:10px;gap:6px}` and `.wallet-controls button{min-height:30px;padding:0 9px;font-size:12px}`.
  - [x] `cd web && npm run typecheck` exits 0 and `npm run build` exits 0.
  - [x] In the built page at 1440px width the overlay's bounding box top-left is within 16px horizontally and 14px vertically of the iframe's top-left corner; at 390px width `document.documentElement.scrollWidth <= innerWidth`.
- Verify: grep for the CSS strings; `npm run typecheck && npm run build` from `web/`; bounding-box check via the Playwright test in T5 or a `genki-web` preview screenshot.

### T5: Update the browser tests and the live check for the new layout [M]
- Goal: Playwright suite covers the clean top; live check no longer depends on the status bar.
- Modules: `web/tests/arcade.spec.ts`, `web/scripts/check-browser-live.mjs`
- Requirements: R7
- Acceptance:
  - [x] In the test "scene runs like the prototype; pause, rules and music are keyboard accessible", `page.getByRole('link',{name:'Rules',exact:true}).click()` is replaced by `page.getByText('Rules of the Arcade',{exact:true}).click()`; the "Block proposers can influence" expectation stays.
  - [x] A new test `clean top: no header or status bar, wallet inside the scene, speaker bottom-right` exists and asserts: `page.locator('header')` count 0; `page.locator('.statusbar')` count 0; `page.getByText('Test Value Only')` count 0; `.scene .wallet-controls` "Connect Wallet" button visible with bounding box within 16px (x) and 14px (y) of the iframe's top-left; inside the frame `#chainMessage` count 0 and `h1.hook-title` has text "pepes armed with ai"; `#soundBtn` bottom and right edges are `26*scale ± 3px` from the `.slide` bottom and right edges where `scale = slideBox.width/1280`; the first `[role=status]` on the page is inside `#review`.
  - [x] `check-browser-live.mjs` waits with `document.querySelector('.poolline')?.textContent?.includes('Block ')` and reads `result.status` from `#review .status`; `grep -rn "Sepolia arcade ready" web/tests web/scripts` prints nothing and `grep -rn statusbar web/scripts` prints nothing; the only `statusbar` mention left under web/tests is the new test's absence assertion (`toHaveCount(0)`).
  - [x] `cd web && npm test` exits 0.
  - [x] `cd web && npx playwright install chromium && npm run test:browser` reports 15 passed, 0 failed. If the browser download fails on this host, the exact error is recorded in AUDIT.md and the layout assertions are verified by hand via a `genki-web` preview screenshot at 1440px and 390px.
- Verify: `npm test` and `npm run test:browser` from `web/`; grep command above.

### T6: Rebuild and verify the tracked export [S]
- Goal: `dist/` matches the changed source and the manifest.
- Modules: `dist/`, `docs/frontend/desktop.png`, `docs/frontend/mobile.png` (if regenerated)
- Requirements: R7, R8
- Acceptance:
  - [x] `cd web && npm run typecheck && npm test && npm run build && npm run check:export` exits 0 and the last line matches `PASS: exact handoff, network, pinned ABI hashes, N assets, B export bytes.` with N ≤ 128 and B < 31457280.
  - [x] `grep -rl "Sepolia arcade ready\|Test Value Only\|chainMessage" dist/` prints nothing.
  - [x] `git status --short` lists changes only under `web/`, `dist/`, `docs/frontend/` and the project docs (DESIGN.md, PLAN.md, AUDIT.md, STATUS.md); `prototype/` unchanged.
  - [x] Source and `dist/` are committed together in one commit.
- Verify: the command chain and greps above from `web/`; `git show --stat HEAD`.
