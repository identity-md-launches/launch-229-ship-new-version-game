# PLAN.md

## Meta
- Design: DESIGN.md (R1..R25)
- Updated: 2026-09-27 13:30

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

### T7: Session protocol helpers and shared transport [S]
- Goal: `DELEGATION_MANAGER`, `SESSION`, `delegationManagerAbi`, `MAX_UINT160/48`, `SINGLE_DEFAULT_MODE`, `encodeRedeem` exist; `Runtime` exposes `transport`.
- Modules: `web/src/chain.mjs`, `web/src/protocol.ts`, `web/src/config.ts`, `web/tests/core.test.ts`
- Requirements: R10, R12, R16
- Acceptance:
  - [x] `chain.mjs` exports `DELEGATION_MANAGER = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3'` and `SESSION` with exactly the M7 values, each with a one-line comment.
  - [x] `protocol.ts` exports `delegationManagerAbi`, `MAX_UINT160`, `MAX_UINT48`, `SINGLE_DEFAULT_MODE` and `encodeRedeem(context,target,value,callData)` as specified in M7.
  - [x] `loadDeployment()` returns `transport`, the same instance passed to `createPublicClient`.
  - [x] `npm test` includes the 3 new M7 cases (redeem round-trip with 120-byte ICE execution, checksummed manager address, presets parse) and exits 0; `npm run typecheck` exits 0.
- Verify: `npm run typecheck && npm test` from `web/`.

### T8: Session key, tab lock and call allowlist [M]
- Goal: `web/src/session.ts` derives the game wallet from one signature, locks one tab per player, and blocks every call outside the allowlist.
- Modules: `web/src/session.ts` (new), `web/tests/core.test.ts`
- Requirements: R9, R14, R16
- Acceptance:
  - [x] `sessionMessage(11155111, player)` returns the exact M8 text with the checksummed player.
  - [x] `sessionKeyFromSignature` returns the same key for the same signature, and refuses a 64-byte signature and another account's signature with `Session play needs a wallet that signs with a regular account key.`
  - [x] `checkSessionCall` accepts each of the 6 allowlist branches in M8 and throws `Blocked an unexpected game-wallet call.` for each blocked case listed in M8's budget (≥ 9 cases).
  - [x] `acquireTabLock` returns a release function, returns `null` while the lock is held, and returns a no-op release without `navigator.locks`.
  - [x] `session.ts` never touches storage or logs (`grep -c "localStorage\|sessionStorage\|console\." web/src/session.ts` = 0); `npm run typecheck` and `npm test` exit 0.
- Verify: `npm run typecheck && npm test` from `web/`; grep above.

### T9: Auto-refill grant request, validation and redemption calls [M]
- Goal: `web/src/refill.ts` detects ERC-7715 support, requests and validates the daily ETH + ICE grant, persists its public parts and builds redemption calls.
- Modules: `web/src/refill.ts` (new), `web/tests/core.test.ts`
- Requirements: R12, R16
- Acceptance:
  - [x] `refillSupport` returns the shared rule types when both periodic types list `0xaa36a7`, and `undefined` when a type is missing, the chain is absent or the call throws.
  - [x] `requestRefill` sends one `wallet_requestExecutionPermissions` with two items matching M9 (amounts from `SESSION`, 86400 s period, 7-day expiry, redeemer/payee only when supported) and returns the granted amounts read from the response.
  - [x] A response with a foreign `delegationManager`, a foreign `to`, an empty `context` or unmet `dependencies` throws `The wallet returned an auto-refill grant this arcade cannot use. Use manual top-ups.`
  - [x] `saveGrant`/`loadGrant` round-trip under `pepe:grant:<chainId>:<player>:<session>`; expired grants load as `undefined` and are removed.
  - [x] `redeemCall` for ICE and ETH produce calls that pass `checkSessionCall`; `npm run typecheck` and `npm test` exit 0 (≥ 4 new cases).
- Verify: `npm run typecheck && npm test` from `web/`.

### T10: Engine plays every move from the game wallet [L]
- Goal: `GameEngine` gains the session API of M10, funds the game wallet (refill or manual), runs approvals once, and loses the intent/review flow.
- Modules: `web/src/engine.ts`
- Requirements: R9, R10, R11, R12, R13, R14, R15, R16
- Acceptance:
  - [x] `Snapshot` has `session?:SessionView` and no `intent`; `engine.ts` exports no `Intent`; `grep -c "intent\|prepareSwap\|prepareTank\|advance(" web/src/engine.ts` = 0.
  - [x] Public methods `startSession`, `endSession`, `allowRefill`, `topUp`, `moveIce`, `withdraw`, `swap`, `fillTank`, `draw` exist with the M10 signatures; the session account lives only in a private field (never in `state`, never stored).
  - [x] Every game-wallet transaction goes through one signing path (`broadcast`, used by `sendSession` and the approval batch) that calls `checkSessionCall` before signing; `TankFilled` crediting compares with the payer; the pending record carries `from`.
  - [x] Funding (`ensureFunds`), approvals (`ensureApprovals`, `warmUp`), busy message, tab-lock message and signature-mismatch warning use the exact M10 texts.
  - [x] The `refreshing` guard is keyed by the connect epoch (renamed from `session`; AUDIT F3 fix).
  - [x] `npm run typecheck` exits 0 once T11 lands (T10 and T11 may be verified together because `main.tsx` calls the removed methods); `npm test` exits 0.
- Verify: `npm run typecheck && npm test` from `web/` (after T11); grep above.

### T11: Session panel, instant controls and scene copy [M]
- Goal: panel 03 becomes "03 · Session / Background Play"; fridge, throne and tank act immediately; the scene no longer waits on `intent`.
- Modules: `web/src/main.tsx`, `web/src/style.css`, `web/scripts/adapt-game.py`, `web/public/game.html`
- Requirements: R10, R11, R12, R14, R15
- Acceptance:
  - [x] Panel 03 renders the M11 JSX: status line unchanged, Start Background Play (no session) or game-wallet line, refill line, Allow Auto-Refill (when available), Top Up 0.005/0.01/0.05 ETH, Move ICE 1,000/10,000 ICE, Withdraw to Wallet, End Session.
  - [x] Fridge button reads `Swap Now`, throne buttons and `Fill Tank` call the engine directly; `locked` requires a session; `window.pepe.swap` calls `engine.swap` without scrolling.
  - [x] Rules copy replaced as in M11; `grep -c "Quote Fridge Swap\|Review Tank Fill\|Cancel Review\|Review & Confirm\|intent" web/src/main.tsx` = 0.
  - [x] `style.css` has the 4 M11 rules and no `.review-panel .quote` / `.review-panel ol` rules.
  - [x] After `python3 scripts/adapt-game.py`: `grep -c "intent\|Review your quote" public/game.html` = 0, `grep -c "Still confirming the last move" public/game.html` = 1; a second run leaves `game.html` unchanged; `prototype/` untouched.
  - [x] `npm run typecheck`, `npm test` and `npm run build` exit 0.
- Verify: grep commands, `python3 scripts/adapt-game.py` twice, `npm run typecheck && npm test && npm run build` from `web/`.

### T12: Session-aware wallet fixture [M]
- Goal: the Playwright fixture signs for a real test player, runs game-wallet raw transactions, mocks ERC-7715 and counts wallet prompts.
- Modules: `web/tests/wallet-fixture.ts`
- Requirements: R17
- Acceptance:
  - [x] `player` is Anvil test account #0; `session` is derived Node-side from its signature of `sessionMessage`; `badSignature` returns a 64-byte signature.
  - [x] Per-address ETH/ICE balances and allowances; `eth_sendRawTransaction` decoded with `parseTransaction` + `recoverTransactionAddress` and recorded in `raw` with timestamps.
  - [x] `eth_getTransactionCount`, `eth_estimateGas`, `eth_maxPriorityFeePerGas`, `eth_gasPrice` answered; unknown methods still throw -32601.
  - [x] `permissions` option mocks both `wallet_*ExecutionPermissions` methods; `redeemDelegations` moves player funds to the game wallet within the granted cap and reverts above it.
  - [x] `prompts` counts exactly `personal_sign`, `eth_sendTransaction` and `wallet_requestExecutionPermissions`; `npm run typecheck` exits 0.
- Verify: `npm run typecheck` from `web/`; exercised by T13.

### T13: Browser tests for background play [L]
- Goal: the Playwright suite proves zero-prompt play, refills, withdraw, the tab lock and the refusals.
- Modules: `web/tests/arcade.spec.ts`
- Requirements: R9, R10, R11, R12, R13, R14, R15, R16, R17
- Acceptance:
  - [x] The suite contains the 21 tests named in M13 (5 kept, 9 rewritten, 7 new); the expired-quote test is gone.
  - [x] After session start and funding, the prompt count stays unchanged across ≥ 3 background moves, and each Swap Now click reaches `eth_sendRawTransaction` within 3 s.
  - [x] No localStorage or sessionStorage value contains the session key hex; the same game-wallet address appears after a reload and a new signature.
  - [x] `npm run test:browser` reports 21 passed, 0 failed, and `npm test` exits 0.
- Verify: `npm test && npm run test:browser` from `web/` (PLAYWRIGHT_BROWSERS_PATH as in AUDIT F1).

### T14: Rebuild the export and commit background play [S]
- Goal: `dist/` matches the changed source; source, export and docs committed together.
- Modules: `dist/`, `docs/frontend/`
- Requirements: R17
- Acceptance:
  - [x] `cd web && npm run typecheck && npm test && npm run build && npm run check:export` exits 0 and prints `PASS: … N assets, B export bytes.` with N ≤ 128 and B < 31457280.
  - [x] `grep -rl "Quote Fridge Swap\|Cancel Review\|Review your quote" dist/` prints nothing.
  - [x] `git status --short` lists changes only under `web/`, `dist/`, `docs/frontend/` and the project docs; `prototype/` unchanged.
  - [x] Source and `dist/` committed together.
- Verify: command chain and grep above from `web/`; `git show --stat HEAD`.

### T15: Ship Lobby's scene through the adapt pipeline [M]
- Goal: `game.html` is Lobby's redesigned scene with the arcade's Sepolia value layer.
- Modules: `prototype/index.html`, `web/scripts/adapt-game.py`, `web/public/game.html`
- Requirements: R18, R19, R22, R23, R24
- Acceptance:
  - [ ] `sha1sum prototype/index.html` prints `f528db33d762c012c622dc0aa451298b9106aeaf`.
  - [ ] `python3 web/scripts/adapt-game.py` runs twice with an identical `game.html`; it contains no `bgmData`, no `eth_requestAccounts` and no `soundBtn` element, and loads `assets/bgm.mp3`.
  - [ ] In a browser at 1280×720, `game.html` shows the docked brand block top-left and the wallet pill top-right on first paint, with no speaker button; the `#imdBal` chip reads "$IMD".
  - [ ] `npm run typecheck` and `npm test` exit 0.
- Verify: adapt twice + `sha1sum web/public/game.html`; grep; Playwright screenshot of `/game.html`.

### T16: Mainnet holdings reader [S]
- Goal: read-only mainnet ETH, $ICE and $IMD for an address.
- Modules: `web/src/holdings.ts`, `web/tests/core.test.ts`
- Requirements: R21
- Acceptance:
  - [ ] `holdings.ts` exports `MAINNET_RPCS`, `MAINNET_TOKENS` and `readHoldings` per M16; token addresses are checksummed.
  - [ ] Unit tests: a stub client returns all three values; a failing `balanceOf` leaves only that field undefined and logs a warning.
  - [ ] `npm run typecheck` and `npm test` exit 0.
- Verify: `npm run typecheck && npm test` from `web/`.

### T17: Wire the in-scene wallet pill to the shell [M]
- Goal: the pill and dropdown connect, switch, disconnect and show mainnet holdings; the old overlay and RainbowKit are gone.
- Modules: `web/src/main.tsx`, `web/src/style.css`, `web/package.json`, `web/scripts/adapt-game.py`, `web/public/game.html`
- Requirements: R20, R21
- Acceptance:
  - [ ] `grep -rn "wallet-controls\|rainbowkit\|ConnectButton" web/src web/package.json` prints nothing.
  - [ ] Scene bridge `pepeScene.wallet(view)` and `parent.pepe.wallet.{connect,disconnect,switchChain,refresh}` exist per M17; the chips show holdings, not Sepolia balances.
  - [ ] `npm run typecheck`, `npm test` and `npm run build` exit 0.
- Verify: grep; `npm run typecheck && npm test && npm run build` from `web/`.

### T18: Browser tests for the redesign [M]
- Goal: the Playwright suite proves R18–R25.
- Modules: `web/tests/wallet-fixture.ts`, `web/tests/arcade.spec.ts`
- Requirements: R18, R19, R20, R21, R22, R23, R25
- Acceptance:
  - [ ] The fixture answers the three mainnet RPC hosts; no test reaches the network.
  - [ ] "scene redesign" test: brand block docked at load, pill top-right, no speaker, dropdown shows ETH 1.5 / $ICE 1,234.5 / $IMD 42 and closes on Escape, chips show the same $ICE / $IMD, pill ≥ 28 px tall at 390 px width.
  - [ ] The music test toggles with the M key; all helpers connect through the pill.
  - [ ] `npm run test:browser` reports all tests passed, 0 failed.
- Verify: `npm run test:browser` from `web/` (PLAYWRIGHT_BROWSERS_PATH as in AUDIT F1).

### T19: Rebuild the export and commit the redesign [S]
- Goal: `dist/` matches the changed source; source, export and docs committed together.
- Modules: `dist/`, `docs/frontend/`
- Requirements: R25
- Acceptance:
  - [ ] `cd web && npm run typecheck && npm test && npm run build && npm run check:export && npm run test:browser` exits 0 and `check:export` prints PASS with N ≤ 128 assets and B < 31457280 bytes.
  - [ ] `git status --short` lists changes only under `prototype/`, `web/`, `dist/`, `docs/frontend/` and the project docs.
  - [ ] Source and `dist/` committed together.
- Verify: command chain from `web/`; `git show --stat HEAD`.
