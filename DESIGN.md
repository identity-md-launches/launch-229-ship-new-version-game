# DESIGN.md

Project: pepes armed with ai (our fork). Live code: `web/` (Vite + React shell around the prototype game scene), `prototype/` (MIT original, never edited), `dist/` (tracked static export).

## Requirements

### Clean top: problem
The game page stacks a page header (wordmark, network label, wallet buttons, Rules link) above the game window, shows a persistent status sentence at the top of the game window, and repeats engine messages in a status bar under the game. The team wants a clean top: the game window is the first thing on the page, wallet controls sit inside it, the speaker sits in its bottom-right corner, and the "ready" sentence is gone. Smallest valuable change: remove those three page-level elements, relocate the two controls that must survive (wallet, speaker), and give engine messages one home.

### Clean top: requirements (shipped in 0c0e42b)
- R1. No header above the game window. The wordmark "pepes armed with ai", the label "Sepolia · Test Value Only", the Rules link and the header wallet buttons are absent from the page DOM. The game window is the first visible element of the page (only the visually hidden skip link and h1 precede it).
- R2. No status overlay inside the game window. The strings "Sepolia arcade ready. Connect your wallet to play for test value." and "Connect your wallet below to play for test value." appear nowhere in `web/src`, `web/public/game.html` or `dist/`.
- R3. No status bar under the game window. Engine messages (errors, confirmations, progress) and the "View Transaction ↗" link are shown in one status line inside the "03 · Wallet Move" panel; the line is empty when the engine has no message.
- R4. Wallet controls live inside the game window, top-left, at every viewport width from 320px up: "Connect Wallet" (or "Connecting…") when disconnected; the address chip (opens the account dialog) and "Disconnect" when connected. No auto-connect on play. Superseded by R20 (scene redesign).
- R5. The music (speaker) button sits in the bottom-right corner of the game window, 26 game-units from the bottom and right edges, with unchanged labels ("Mute music" / "Play music"), title, M-key behaviour and reduced-motion handling. Superseded by R22 (scene redesign).
- R6. The in-game neon title "pepes armed with ai" (upper right of the scene) is unchanged.
- R7. Everything else is unchanged: game play, keyboard and touch controls, pause, panels, tickets, the Rules panel, footer, chain bindings and the deployment manifest. `npm run typecheck`, `npm test`, `npm run build`, `npm run check:export` and the Playwright suite pass.
- R8. The tracked `dist/` export is rebuilt from the changed source and `npm run check:export` prints PASS.

### Clean top: success criteria
- Desktop (1440×1100) and phone (390×844) screenshots show: no header, no status bar, wallet controls top-left inside the game frame, speaker bottom-right inside the frame, neon title still present.
- All checks in R7 green; `dist/` committed in the same change as the source.

### Clean top: constraints
- `prototype/index.html` stays byte-identical (MIT original). Scene changes go through `web/scripts/adapt-game.py`; `web/public/game.html` must stay byte-reproducible by running that script.
- No new dependencies. No contract, chain, manifest or hosting changes.
- Build on the current fork (upstream a27372f). IMD's unpublished "arcade wallet" commit is out of scope.

### Clean top: non-goals
- Auto-connecting the wallet when the player wakes the pepe.
- Toast/overlay notifications inside the game window.
- A phone-specific layout beyond keeping the same controls usable.
- Publishing the result (the live site stays under IMD's name until we host our own).

### Background play: problem
Every fridge hit opens a chain of wallet prompts: an ICE sale needs `ICE.approve(Permit2)`, `Permit2.approve(router)` and the router swap as three separate confirmations (each after a fresh quote), and a winning ticket adds a fourth for the draw. The team wants play to feel instant: moves happen in the background without the player approving each one (Lobby, 2026-09-27). Decisions taken with Lobby: session permissions rather than per-move prompts; the session key is re-derived from a signature on every visit and never stored; funding by ETH top-up plus an optional ICE move, with ERC-7715 auto-refill where the wallet supports it; fridge hits swap immediately; the old sign-every-step flow is removed.

### Background play: requirements
- R9. Session start. Once per visit the connected player signs one fixed text message (`personal_sign`, text in M8). The arcade derives an in-tab game wallet (session key) from that signature. The key exists only in memory: it is never written to localStorage, sessionStorage, IndexedDB, cookies, URLs or logs. The same player wallet derives the same game wallet on every visit. A signature that is not a 65-byte ECDSA signature recovering to the player is refused with "Session play needs a wallet that signs with a regular account key."
- R10. Background moves. With an active session, fridge swaps (scene hit or "Swap Now"), throne buys, tank fills, winning-ticket draws and withdrawals are signed by the game wallet and broadcast with zero wallet prompts. Tickets and jackpot payouts go to the player's wallet (`hookData` = player). From hit to broadcast takes ≤ 3 s on a funded, approved game wallet (measured on the test fixture).
- R11. Manual funding. Panel 03 offers Top Up (0.005 / 0.01 / 0.05 Sepolia ETH, a player transaction to the game wallet) and Move ICE (1,000 / 10,000 ICE, a player `ICE.transfer` to the game wallet), one wallet prompt each. A game wallet without ETH for gas asks for a top-up before its first move.
- R12. Auto-refill. When the wallet reports ERC-7715 support for both `native-token-periodic` and `erc20-token-periodic` on Sepolia, panel 03 offers "Allow Auto-Refill". One prompt lets the game wallet pull up to 0.02 Sepolia ETH and 10,000 ICE per day from the player's wallet for 7 days (the wallet may let the player adjust the amounts; the granted values are shown). Short game-wallet balances are then refilled in the background without prompts. Without wallet support, panel 03 says so and manual funding stays available.
- R13. One move at a time. A hit or button press while a game-wallet move is still confirming broadcasts nothing; the status line shows "Still confirming the last move. Try again in a moment."
- R14. Withdraw, end and tab lock. "Withdraw to Wallet" sends all game-wallet ICE, and all ETH above the gas needed for that transfer, back to the player without prompts. "End Session" forgets the key in this tab (funds stay in the game wallet; the same signature restores it). A second tab of the same player cannot start background play while another tab holds it: "Background play is open in another tab. End it there first."
- R15. Old flow removed. The per-move review is gone: quote card, "Approve ICE for Permit2", "Approve Router in Permit2", "Confirm Swap", "Approve ICE for Tank", "Confirm Tank Fill", "Cancel Review" and the 30-second quote expiry. The player's wallet never signs swaps, approvals, tank fills or draws. Panel 03 becomes "03 · Session" / "Background Play".
- R16. Safety rails. The game wallet signs only calls on a fixed allowlist (M8). Anything else is refused before signing with "Blocked an unexpected game-wallet call." Auto-refill grants are accepted only when they name the game wallet, Sepolia and the pinned DelegationManager.
- R17. Checks. `npm run typecheck`, `npm test`, `npm run build`, `npm run check:export` and the Playwright suite pass; the suite proves zero wallet prompts for background moves after setup; `dist/` is rebuilt and committed with the source.

### Background play: success criteria
- Wallet prompts per visit (returning player): 1 (the session signature). Per move afterwards: 0. Before: 3 per ICE sale, 1 per ETH swap or tank step, plus 1 per winning draw.
- First visit: auto-refill path = 3 prompts (signature, grant, first ETH top-up for gas); manual path = 2 prompts (signature, ETH top-up) plus 1 optional ICE move.
- The browser suite asserts the prompt counts above and the ≤ 3 s hit-to-broadcast budget.

### Background play: constraints
- No new npm dependencies. ERC-7715 is called through raw EIP-1193 requests and encoded with viem. The MetaMask Smart Accounts Kit is not used: by default it sends analytics to `mm-sdk-analytics.api.cx.metamask.io`.
- No contract, manifest, chain or hosting changes; no backend, bundler or paymaster. The game wallet pays its own gas with plain transactions.
- Sepolia (11155111) only; test value only. Scene changes still go through `web/scripts/adapt-game.py`.

### Background play: non-goals
- Gas sponsorship. Without a paymaster, the first ETH top-up stays a wallet prompt.
- Storing the session key anywhere, or recovering it without the signature (Lobby's choice).
- Background play for smart-contract wallets (ERC-1271 signatures) and wallets with non-deterministic signatures. The first is refused; the second gets a warning (M10).
- Several moves in flight at once.
- Auto-refill on wallets without ERC-7715 support. Support is detected at runtime, so wallets that add it later work unchanged.
- Mainnet.

### Background play: accepted risks
- Any site that obtains the same signature can derive the same key. Exposure is bounded by the game-wallet balance plus the remaining daily refill allowance until the grant expires (at most 7 days × daily cap). The signed text names the arcade and warns against signing elsewhere. Test value only. Grants can be revoked in MetaMask and expire on their own.
- Auto-refill upgrades the player's account to an EIP-7702 smart account (MetaMask prompts for it during the grant). This is the wallet's standard flow; the arcade does not ask for it separately.

### Scene redesign: problem
Lobby redesigned the game scene (`genkiai-page1.html`, SHA-1 `f528db33d762c012c622dc0aa451298b9106aeaf`, 2026-09-27). The arcade scene must match its layout and placement. The page below the game stays (Lobby, 2026-09-27). Lobby also chose to show the player's real Ethereum mainnet $ICE and $IMD read-only while play stays on Sepolia; moving the game itself to mainnet is a separate design that comes next.

### Scene redesign: requirements
- R18. Scene source. `prototype/index.html` is Lobby's file byte-for-byte. `web/public/game.html` is regenerated from it by `adapt-game.py`. The file's inline music (byte-identical to `assets/bgm.mp3`) is served from the asset file, and the file's own MetaMask script (Ethereum mainnet, MetaMask only) is not shipped: the shell drives the wallet.
- R19. Brand block. From first paint the small logo, the "pepes armed with ai" headline and the two balance chips sit docked top-left (brandmark at 20/20 scene units) with no intro animation, as in the file. The block stays visible during the pizza climb on a solid plate.
- R20. Wallet pill. The wallet control lives inside the scene, top-right (scene units: top 22.5, right 14), styled as in the file. Disconnected: wallet icon and "connect". Connected on Sepolia: green dot and short address; a click toggles a dropdown under the pill with the short address, the network ("Sepolia"), mainnet ETH / $ICE / $IMD rows, the note "the arcade plays on Sepolia for now" and "disconnect". Other network: red pill "switch to Sepolia"; a click switches (adding the chain if needed). Busy: dimmed. Escape or a click outside closes the dropdown. Wallet errors (no wallet, rejected, switch failed) show in the bubble under the pill. On screen the pill is never shorter than 28 CSS px (scaled up from its top-right corner when the scene is small). The top-left "Connect Wallet" / address / "Disconnect" overlay and the RainbowKit account modal are removed.
- R21. Mainnet holdings, read-only. While a wallet is connected, the arcade reads that address's Ethereum mainnet ETH, $ICE (`0x64914921E03069dA66823F84fFcfB9931F05281A`, "Initial Compute Event") and $IMD (`0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7`, "Identity.md") through public mainnet RPCs, whatever network the wallet is on. They show in the dropdown and in the two chips ("$ICE", "$IMD"): "—" when disconnected, "…" while loading, "?" when a read fails. Reads run on connect, on account change and each time the dropdown opens. Nothing is signed or sent on mainnet. Sepolia wallet ICE / ETH stay in the stats row below the game.
- R22. No speaker button. The music button is removed; M still toggles music.
- R23. Climb layout. In the pizza climb the stats HUD and the cash-out button are hidden (C cashes out); the jackpot pool shows on a mini marquee on the enlarged dumpster, with the golden-bladder free-burst row under it; the hero starts at x = 400; the chips stay in the top-left block.
- R24. Throne timing. The golden throne rises together with the jackpot sign, not after the parade.
- R25. Everything else is unchanged: the page below the game, all Sepolia game logic, background play, keyboard and touch controls. `npm run typecheck`, `npm test`, `npm run build`, `npm run check:export` and the Playwright suite pass; `dist/` is rebuilt and committed with the source.

### Scene redesign: non-goals
- Playing on mainnet (contracts, pool, Chainlink VRF, funding, security review): the next, separate design.
- The file's MetaMask-only detection: any injected wallet keeps working.
- Balances for other networks or tokens in the dropdown.

## Architecture

### Existing system (unchanged parts)
- `web/src/main.tsx` — React 19 shell. `Arcade` renders: skip link, page h1 (sr-only), game region (iframe `./game.html` + key legend/pause row + touch controls), network alert, live balances, pool line, three panels (Jackpot Fridge, Golden Throne, Wallet Move = `section#review.review-panel`), ticket board, Rules `<details>`, footer. It exposes `window.pepe` to the iframe (snapshot, consumePee, consumeBurst, addPoints, message, swap, flip) and pushes every state change into `iframe.contentWindow.pepeScene.update(state)`.
- `web/src/engine.ts` — `GameEngine`: chain reads/writes, `Snapshot` state (`message`, `tx`, `ready`, …), `message()` setter. Ready transition at the end of `refresh()`.
- `web/src/protocol.ts`, `config.ts`, `chain.mjs`, `canonical.mjs` — chain protocol and deployment loading. Untouched.
- `web/src/style.css` — shell styles (single file, ~110 lines).
- Scene pipeline: `prototype/index.html` → `python3 web/scripts/adapt-game.py` → `web/public/game.html` (committed; currently byte-reproducible). The scene is a 1280×720 `.slide` scaled by `fit()` to the iframe; in-scene pixels scale with the frame width (s ≈ frameWidth/1280).
- Export pipeline: `npm run build` = `scripts/prepare.mjs` (pins ABIs from `handoff.sourceCommit` e145493b, present in our clone) → `vite build` → `scripts/manifest.mjs` → `dist/` (tracked). `npm run check:export` verifies `dist/` against the manifest.
- Tests: `web/tests/core.test.ts` (node), `web/tests/arcade.spec.ts` (Playwright, 15 tests after the clean-top change, mock wallet fixture, server `tests/server.mjs` on 4173), `web/scripts/check-browser-live.mjs` (read-only live check writing `docs/frontend/live-browser.json`).
- Tech stack: inherited (React 19.3, Vite 7, wagmi/viem/RainbowKit, TanStack Query via wagmi). House default deviation (no TanStack Router) is inherited from upstream; no change in this feature.
- Hosting: the live site https://pepes-armed.site.identitymd.eth.limo is published from the tracked `dist/` by an IMD site job (IMD's IPFS pinning provider and the `pepes-armed` name record under identitymd.eth; README "Sepolia site"). This project has no access to that pipeline, so a release is handed to IMD as our fork URL plus the commit to publish; `dist/` is published as-is, without a rebuild. No other hosting.

### Clean top: page layout (top to bottom)
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

### Background play: architecture
```
Player wallet (EOA; MetaMask upgrades it to an EIP-7702 smart account when auto-refill is granted)
  │ 1× personal_sign per visit ─────────────► session key = keccak256(signature), memory only (M8)
  │ 1× wallet_requestExecutionPermissions   ─► daily ETH + ICE pull rights for the game wallet, 7 days (M9)
  │ 1× ETH top-up (gas bootstrap), optional ICE move (player transactions)
  ▼
Game wallet (session EOA in this tab; signs locally, broadcasts through the public RPC transport)
  ├─ DelegationManager.redeemDelegations  → pulls ETH / ICE from the player within the daily caps
  ├─ ICE.approve(Permit2 | hook, max), Permit2.approve(ICE, router, max, max)   one-time, lazily
  ├─ UniversalRouter.execute(V4_SWAP, hookData = player)  → ticket to the player; output to the game wallet
  ├─ JackpotHook.fillTank(key, pees)                      → TankFilled(player = game wallet)
  ├─ JackpotHook.draw(id, ticket)                         → payout to the ticket's player (the player)
  └─ ICE.transfer / ETH transfer → player                  (Withdraw to Wallet)
```
- Contract facts relied on (`src/JackpotHook.sol`, unchanged): `beforeSwap` issues the ticket to `abi.decode(hookData,(address))` when `hookData` is 32 bytes; `draw` may be called by anyone and always pays `entry.player`; `fillTank` pulls ICE from and emits `TankFilled` for `msg.sender`.
- Moves run strictly one at a time (`state.busy`); the game wallet's nonce is `max(pending nonce on chain, last local nonce + 1)`. Only the one-time approvals are broadcast back to back with consecutive nonces.
- Funding order before a move: if the game wallet is short, redeem a refill chunk (auto-refill) or stop with a manual-funding message; then run any missing approval; then the move.
- The per-player local record keeps its current role (tank, free bursts, points, pending hash). Session material is limited to public data: the grant (contexts and amounts) and the last game-wallet address.

### Background play: wallet support (researched 2026-09-27)
- ERC-7715 Advanced Permissions ship in production only in the MetaMask browser extension (stable ≥ 13.23.0). MetaMask Mobile, Rabby and Rainbow do not support them; Coinbase Wallet uses its own spend-permission model (not used here). Other wallets get manual top-ups and still play without per-move prompts.
- Permission types move tokens only (native / ERC-20: periodic, stream, allowance). There is no generic contract-call permission, which is why moves are signed by a game wallet funded through these pulls rather than by the player's account.
- RPC methods: `wallet_getSupportedExecutionPermissions` → `Record<type,{chainIds:Hex[],ruleTypes:string[]}>`; `wallet_requestExecutionPermissions` (params below); `wallet_getGrantedExecutionPermissions` (not used).
- Request item: `{chainId:Hex, from:player, to:session, permission:{type, isAdjustmentAllowed:true, data:{tokenAddress?, periodAmount:Hex, periodDuration:86400, startTime, justification}}, rules:[{type:'expiry',data:{timestamp}}, {type:'redeemer',data:{addresses:[session]}}?, {type:'payee',data:{addresses:[session]}}?]}`. Redeemer and payee rules are sent only when listed in `ruleTypes`. Response items add `context:Hex`, `delegationManager:Address`, `dependencies:{factory,factoryData}[]`.
- Redemption is a plain transaction from the game wallet: `DelegationManager.redeemDelegations([context],[0x00…00 (single, default mode)],[encodePacked(address target,uint256 value,bytes callData)])`. ERC-20 pull: target = ICE, value 0, callData = `transfer(session, amount)`. Native pull: target = session, value = amount, callData `0x`.
- Sepolia DelegationManager `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3`; EIP7702StatelessDeleGatorImpl `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B`.

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

#### M7: Session protocol helpers — changed
- Purpose: chain constants, ABI and encoder the game wallet needs; expose the RPC transport so a local-account wallet client can share it (R10, R12, R16).
- Location: `web/src/chain.mjs`, `web/src/protocol.ts`, `web/src/config.ts`, `web/tests/core.test.ts`.
- Interface:
  ```js
  // chain.mjs
  export const DELEGATION_MANAGER = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3';
  export const SESSION = { ethChunk: '0.005', iceChunk: '1000', gasReserve: '0.002', refillEth: '0.02', refillIce: '10000',
    refillPeriod: 86400, refillDays: 7, topUps: ['0.005', '0.01', '0.05'], iceMoves: ['1000', '10000'] };
  ```
  ```ts
  // protocol.ts
  export const delegationManagerAbi=parseAbi(['function redeemDelegations(bytes[] permissionContexts,bytes32[] modes,bytes[] executionCallDatas)']);
  export const MAX_UINT160=(1n<<160n)-1n; export const MAX_UINT48=(1n<<48n)-1n;
  export const SINGLE_DEFAULT_MODE=`0x${'00'.repeat(32)}` as Hex;
  export function encodeRedeem(context:Hex,target:Address,value:bigint,callData:Hex):Hex; // redeemDelegations([context],[SINGLE_DEFAULT_MODE],[encodePacked(['address','uint256','bytes'],[target,value,callData])])
  // config.ts: loadDeployment() returns {d,abis,chain,client,transport}; `transport` is the same fallback(http…) instance `client` uses.
  ```
- Internals: 1) add the constants with a one-line comment each, in the style of `POOL`; 2) add the ABI, constants and `encodeRedeem` next to `permitAbi`; 3) hoist the fallback transport into a `const transport` in `loadDeployment` and return it; 4) unit tests below.
- Edge & error policy: pure helpers, no I/O. `encodeRedeem` does not validate; `checkSessionCall` (M8) does.
- Budgets: `npm test` adds ≥ 3 cases: `encodeRedeem` round-trips through `decodeFunctionData` (1 context, mode = 32 zero bytes, packed execution length = 20 + 32 + callData bytes, i.e. 120 bytes for an ICE `transfer`); `DELEGATION_MANAGER` is a checksummed address; `SESSION` presets parse with `parseUnits`.
- Covers: R10, R12, R16 · Depends on: none.

#### M8: Session key and allowlist — new
- Purpose: derive the game wallet from one signature, keep a single tab in charge, and refuse any call outside the allowlist (R9, R14, R16).
- Location: `web/src/session.ts` (new), `web/tests/core.test.ts`.
- Interface:
  ```ts
  export function sessionMessage(chainId:number,player:Address):string;
  export async function sessionKeyFromSignature(signature:Hex,message:string,player:Address):Promise<Hex>;
  export type SessionContext={player:Address;session:Address;token:Address;hook:Address;permit2:Address;router:Address;key:PoolKey;tokenAbi:Abi;hookAbi:Abi};
  export function checkSessionCall(call:{to:Address;data:Hex;value:bigint},c:SessionContext):void; // throws Error('Blocked an unexpected game-wallet call.')
  export async function acquireTabLock(player:Address,locks:LockManager|null=navigator.locks??null):Promise<(()=>void)|null>; // null = held by another tab; `locks` is a test seam
  ```
- Internals:
  1. `sessionMessage` returns exactly (`getAddress` checksum, `\n` line breaks):
     ```
     pepes armed with ai · session key v1
     Chain: <chainId>
     Player: <checksummed player>

     Signing creates the game wallet that plays your background moves in this tab. It can only spend what you send it or allow it to pull. Only sign this on the pepes armed with ai arcade.
     ```
  2. `sessionKeyFromSignature`: reject unless `/^0x[0-9a-fA-F]{130}$/` and `recoverMessageAddress({message,signature})` equals the player (case-insensitive); error text `Session play needs a wallet that signs with a regular account key.` Key = `keccak256(signature)`; while the key is 0 or ≥ secp256k1 n, key = `keccak256(key)`.
  3. `checkSessionCall` accepts only:
     - to = token, value 0: `approve(spender,…)` with spender ∈ {permit2, hook}; `transfer(to,…)` with to = player.
     - to = permit2, value 0: `approve(token',spender,…,…)` with token' = token and spender = router (decoded with `permitAbi`).
     - to = router, any value: `execute(commands,inputs,…)` with commands = `0x10`, one input, whose actions are `0x060c0f` and whose first param decodes to a pool key equal to `c.key` and `hookData = playerData(player)`.
     - to = hook, value 0: `fillTank(key',…)` with key' = `c.key`; `draw(id,…)` with id = `poolId(c.key)`.
     - to = `DELEGATION_MANAGER`, value 0: `redeemDelegations` with one context, mode `SINGLE_DEFAULT_MODE`, one execution that is either (target = token, value 0, callData = `transfer(session,…)`) or (target = session, callData `0x`).
     - to = player, data `0x`: plain ETH transfer.
     Addresses compare case-insensitively; decoding failures count as blocked.
  4. `acquireTabLock`: `navigator.locks.request('pepe-session:'+player.toLowerCase(),{ifAvailable:true},…)`; when granted, hold the lock until the returned release function runs; when `navigator.locks` is missing, return a no-op release.
- Edge & error policy: no storage, no network. The key is returned to the engine only; nothing here logs.
- Budgets: `npm test` adds ≥ 6 cases: same signature → same key and address; a 64-byte signature and a signature from another account are refused with the exact message; each allowlist branch accepts its valid call; blocked: ICE `transfer` to a stranger, ICE `approve` to a stranger, Permit2 approve for another spender, ETH to a stranger, ETH with data to the player, router `execute` with commands ≠ `0x10` or `hookData` ≠ player, `fillTank` with another key, redemption paying a stranger, unknown target.
- Covers: R9, R14 (lock), R16 · Depends on: M7.

#### M9: Auto-refill grants — new
- Purpose: detect ERC-7715 support, request and validate the daily pull grant, persist its public parts, and build redemption calls (R12, R16).
- Location: `web/src/refill.ts` (new), `web/tests/core.test.ts`.
- Interface:
  ```ts
  export type Grant={eth:{context:Hex;periodAmount:bigint};ice:{context:Hex;periodAmount:bigint};expiry:number};
  export async function refillSupport(provider:EIP1193Provider,chainId:number):Promise<string[]|undefined>; // rule types supported by both types; undefined = unsupported
  export async function requestRefill(provider:EIP1193Provider,o:{player:Address;session:Address;chainId:number;token:Address;decimals:number;ruleTypes:string[];now:number;hasCode:(a:Address)=>Promise<boolean>}):Promise<Grant>;
  export function loadGrant(chainId:number,player:Address,session:Address,now:number):Grant|undefined;
  export function saveGrant(chainId:number,player:Address,session:Address,grant:Grant):void;
  export function clearGrant(chainId:number,player:Address,session:Address):void;
  export function redeemCall(grant:Grant,kind:'eth'|'ice',o:{token:Address;session:Address},amount:bigint):{to:Address;data:Hex;value:bigint};
  ```
- Internals:
  1. `refillSupport`: `wallet_getSupportedExecutionPermissions`; supported only if both `native-token-periodic` and `erc20-token-periodic` list `toHex(chainId)` in `chainIds` (case-insensitive); returns the intersection of their `ruleTypes`; any thrown error or other shape → `undefined`.
  2. `requestRefill`: one `wallet_requestExecutionPermissions` call with two items as in "wallet support" above: ETH `periodAmount = parseEther(SESSION.refillEth)`, ICE `periodAmount = parseUnits(SESSION.refillIce, decimals)` with `tokenAddress = token`; `periodDuration = SESSION.refillPeriod`; `startTime = now`; expiry rule timestamp `now + SESSION.refillDays*86400`; justifications `Refill the pepes arcade game wallet with Sepolia ETH for gas and swaps.` / `Refill the pepes arcade game wallet with ICE for fridge swaps and tank fills.`
  3. Validate each response item, matched by `permission.type`: `context` is non-empty hex; `delegationManager` = `DELEGATION_MANAGER`; `chainId` numerically equals the chain; `to`, when present, equals the session; granted `periodAmount` > 0 (read from the response, since adjustment is allowed); ICE `tokenAddress`, when present, equals the token; `dependencies` empty or `await hasCode(player)`. Expiry = the returned expiry rule timestamp if present, else the requested one. Any failure throws `The wallet returned an auto-refill grant this arcade cannot use. Use manual top-ups.`
  4. Storage key `pepe:grant:<chainId>:<player lowercase>:<session lowercase>`; bigints as decimal strings. `loadGrant` returns `undefined` for missing, malformed or expired (`expiry <= now`) grants and removes the malformed and expired ones.
  5. `redeemCall`: ICE → `encodeRedeem(ice.context, token, 0n, transfer(session, amount))`; ETH → `encodeRedeem(eth.context, session, amount, '0x')`; `to = DELEGATION_MANAGER`, `value = 0n`.
- Edge & error policy: a wallet rejection (code 4001) propagates to the engine, whose `errorMessage` renders "Wallet said no…". Storage failures are swallowed (the grant then lasts for the tab only).
- Budgets: `npm test` adds ≥ 4 cases: support detection (both types → rule types; one type missing, wrong chain or thrown error → undefined); a response with a foreign `delegationManager` or session is refused; a valid response round-trips through save/load; `redeemCall` for ICE and ETH passes `checkSessionCall`.
- Covers: R12, R16 · Depends on: M7, M8.

#### M10: Engine background moves — changed
- Purpose: run every value move from the game wallet, fund it, and drop the review flow (R9–R16).
- Location: `web/src/engine.ts`.
- Interface:
  ```ts
  export type SessionView={address:Address;eth?:bigint;ice?:bigint;refill:'checking'|'available'|'unavailable'|'granted';grant?:{eth:bigint;ice:bigint;expiry:number}};
  // Snapshot: `intent` removed; `session?:SessionView` added. `Intent` type removed.
  startSession():Promise<void>; endSession(message?:string):void; allowRefill():Promise<void>;
  topUp(eth:string):Promise<void>; moveIce(ice:string):Promise<void>; withdraw():Promise<void>;
  swap(ethIn:boolean,amount:string,throne?:boolean):Promise<void>; fillTank(pees:number):Promise<void>; draw(id:string):Promise<void>;
  // removed: prepareSwap, prepareTank, advance. setSlippage no longer touches intent.
  ```
- Internals:
  1. `startSession`: guard (account, chain, ready, not busy) → `acquireTabLock`; null → message `Background play is open in another tab. End it there first.` → `personal_sign` of `sessionMessage` via the provider (message `Sign the session message in your wallet.`) → `sessionKeyFromSignature` → `privateKeyToAccount` kept in a private field (never in `state`, never stored). Compare with the public `pepe:session:<chainId>:<player>` address; on mismatch warn `This wallet signed differently than last visit, so this is a new game wallet. Withdraw to Wallet before you leave.`; then store the new address. Load the grant (M9); if none, detect support (`refill` = `available` / `unavailable`). Set `session`, refresh, then `warmUp()` if the game wallet holds ETH. Final message `Background play is on.` plus ` Top up the game wallet with a little Sepolia ETH to start.` when it holds no ETH. On any failure, release the lock.
  2. `endSession(message)`: drop the key and grant from memory, release the lock, clear `session`; default message `Background play ended. Funds stay in the game wallet until you withdraw.` `connect()` calls it (silently) before any account or chain change.
  3. `sendSession(call,credit?)`: `broadcast(call)` — the single signing point, also used by the approval batch — encodes → `checkSessionCall` → `simulateContract` with the session account → nonce rule (architecture section) → `createWalletClient({account,chain,transport:runtime.transport}).sendTransaction({to,data,value,nonce})` → for credited moves (swap, throne, tank) save `pending:{hash,kind,pees,from:session}` → `waitForTransactionReceipt` (120 s) → `applyReceipt(receipt,kind,pees,session)`. Approvals, refills, draws and withdrawals keep no pending record. A session ended mid-move fails with `Start background play in panel 03 first.`
  4. `applyReceipt(receipt,kind,pees,payer)`: the `TankFilled` player must equal `payer` (was: the connected account). Ticket crediting (player via hookData) is unchanged. `recover()` passes `pending.from ?? account`.
  5. `ensureFunds({eth,ice})` for the move's own value, plus `SESSION.gasReserve` ETH while auto-refill is on (without a grant a gas shortfall surfaces as the Top Up message from the failed send): when short and a grant exists, redeem `max(shortfall, chunk)` (`SESSION.ethChunk` / `SESSION.iceChunk`); if that simulation fails, redeem exactly the shortfall; if that fails too: `Auto-refill is used up for today or your wallet is short. Top up by hand or wait for the next period.` Without a grant: `The game wallet needs more ICE. Use Move ICE in panel 03.` / `The game wallet needs more Sepolia ETH. Use Top Up in panel 03.` Message during a pull: `Refilling the game wallet…`.
  6. Approvals: `ensureApprovals('swap')` needs ICE→Permit2 allowance ≥ amount and a Permit2 (ICE→router) amount ≥ amount with expiration > now + 300 s; `ensureApprovals('tank')` needs ICE→hook allowance ≥ amount. Missing ones are sent as `approve(permit2, maxUint256)`, `approve(token, router, MAX_UINT160, MAX_UINT48)`, `approve(hook, maxUint256)`. `warmUp()` sends all missing approvals back to back with consecutive nonces, then waits for every receipt (message `Setting up the game wallet (one-time approvals)…` → `Game wallet ready.`).
  7. `swap`: busy → message `Still confirming the last move. Try again in a moment.` and return; guard (adds `Start background play in panel 03 first.` when there is no session); parse and validate the amount as today; `ensureFunds`; ICE-in → `ensureApprovals('swap')`; quote (`quoteExactInputSingle`, `hookData = playerData(player)`); `minimumOut`; `sendSession(router,'execute',['0x10',[swapInput(key,ethIn,amount,minimum,player)],now+300], ethIn?amount:0n, throne?'throne':'swap')`. Messages `Swapping in the background…` → `Swap sent. Waiting for confirmation…` → `Swap confirmed. Waiting for the ticket’s future block…` (throne: `Throne buy confirmed. Five free climb bursts added.`).
  8. `fillTank(pees)`: validate 1–1000 as today; amount = pees × `ICE_PER_PEE`; `ensureFunds`; `ensureApprovals('tank')`; `sendSession(hook,'fillTank',[key,pees],0n,'tank',pees)`; message `Tank filled. Each pee uses one local charge.`
  9. `draw(id)`: same ticket checks as today, then `ensureFunds({})` when auto-refill is on, then `sendSession(hook,'draw',…)`. Auto-draw in `updateTickets` runs only while a session is active and not busy.
  10. `topUp(eth)` and `moveIce(ice)`: player transactions through the existing `send` path (one prompt each): `sendTransaction({to:session,value})` and `ICE.transfer(session,amount)`. After a top-up confirms, `warmUp()`.
  11. `withdraw()`: game-wallet ICE > 0 → `transfer(player, all)`; then ETH: keep `21000 × maxFeePerGas × 2`, send the rest to the player if > 0. `Nothing to withdraw.` when both are zero; else `Withdrawn to your wallet.`
  12. `refresh()` also reads the game wallet's ETH and ICE into `session`; the `refreshing` guard is keyed by the connect epoch (renamed from `session`, fixes AUDIT F3): `if(this.refreshing===this.epoch)return;` and only the matching refresh clears it.
  13. `allowRefill()`: `requestRefill` with `hasCode = getCode(player) !== '0x'`, then `saveGrant`, `refill = 'granted'`, message `Auto-refill is on.`
- Edge & error policy: every message ≤ 240 characters through `errorMessage`. Insufficient-funds errors from the game wallet map to the Top Up message. A reload during a pending game-wallet move restores its credit through `recover()` (the pending record carries `from`). Wallet or account changes end the session before anything else runs.
- Budgets: from a Swap Now click to `eth_sendRawTransaction` ≤ 3 s on the fixture with a funded, approved game wallet; 0 wallet prompts for swaps, throne buys, tank fills, draws, refills and withdrawals; `grep -c "intent\|prepareSwap\|prepareTank\|advance(" web/src/engine.ts` = 0.
- Covers: R9–R16 · Depends on: M7, M8, M9.

#### M11: Session panel, shell and scene copy — changed
- Purpose: replace the review panel with the session panel, make fridge/throne/tank controls instant, update the copy (R10, R11, R12, R14, R15).
- Location: `web/src/main.tsx`, `web/src/style.css`, `web/scripts/adapt-game.py`, `web/public/game.html` (regenerated).
- Interface (panel 03, keeps `id="review"` and the status line):
  ```tsx
  <section id="review" tabIndex={-1} className="panel review-panel" aria-label="Background play"><span className="eyebrow">03 · Session</span><h2>Background Play</h2>
   <p className="status" role="status" aria-live="polite">…unchanged…</p>
   {!session?<><p>Sign once per visit to open a game wallet in this tab. Swaps, tank fills and prize claims then run without wallet pop-ups.</p>
     <button className="primary" disabled={!address||wrong||!state.ready||state.busy} onClick={()=>void engine.startSession()}>Start Background Play</button>
     <p className="help">The game wallet key is never stored. Signing the same message next visit restores it.</p></>
   :<><p className="session-line">Game wallet <a href={explorer/address}>0x1234…abcd ↗</a> · {eth} ETH · {ice} ICE</p>
     <p className="session-line">{refill line}</p>
     {session.refill==='available'&&<div className="session-group"><button disabled={locked} onClick={allowRefill}>Allow Auto-Refill</button></div>}
     <div className="session-group"><span>Top Up</span>{SESSION.topUps → <button>{a} ETH</button>}</div>
     <div className="session-group"><span>Move ICE</span>{SESSION.iceMoves → <button>{1,000} ICE</button>}</div>
     <div className="session-group"><button className="quiet" disabled={locked}>Withdraw to Wallet</button><button className="quiet" disabled={state.busy}>End Session</button></div></>}
   <p className="help">Winning tickets are claimed automatically. Tickets and payouts always go to your wallet.</p>
  </section>
  ```
  Refill line: granted → `Auto-refill on · up to {eth} ETH and {ice} ICE a day from your wallet until {date}.`; available → `Auto-refill is off. Allow it once to skip top-ups for 7 days.`; unavailable → `Auto-refill needs the MetaMask browser extension. Top up by hand below.`; checking → `Checking auto-refill support…`.
- Internals:
  1. `locked` also requires `state.session`. Fridge button `Quote Fridge Swap` → `Swap Now` calling `engine.swap(ethIn, ethIn?ethAmount:'100')`; help when there is no session: `Start background play in panel 03 to use the fridge and tank.` (replaces the connect-only help when connected). Throne buttons call `engine.swap(true,amount,true)`. `Review Tank Fill` → `Fill Tank` calling `engine.fillTank(n)`. Direction flip and amount/slippage selects no longer touch `intent`.
  2. `window.pepe.swap` → `void engine.swap(native,amount,throne)` (sets the direction as today, no scroll or focus); `window.pepe.flip` → `setEthIn(native)` only.
  3. Remove the `intent`/`label` logic and all review JSX (quote, step list, Confirm and Cancel Review buttons, "Approvals and swaps each have their own wallet confirmation…", "Winning tickets prompt a separate draw confirmation…").
  4. Rules copy: replace `The auto-pee pad prepares each swap for review; each transaction still requires your wallet confirmation.` with `Background play: one signature per visit opens a game wallet in this tab. It signs your moves without pop-ups and can only spend what you send it or allow it to pull. Its key is never stored.`; replace `a rejected draw can be retried here before expiry` with `a failed draw can be retried here before expiry`.
  5. CSS: add `.review-panel .session-line{margin:0 0 12px;font-size:14px;line-height:1.5;color:#c1cbed;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}`, `.review-panel .session-group{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 12px}`, `.review-panel .session-group>span{min-width:76px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}`, `.review-panel .session-group button{margin:0}`; delete the now unused `.review-panel .quote` and `.review-panel ol` rules.
  6. `adapt-game.py`: `jackpotSwap` shows the busy message instead of returning silently (`if(JS.busy){if(bridge())bridge().message('Still confirming the last move. Try again in a moment.');return;}`); `autoViable` becomes `live().tank>0 && !live().busy`; the auto-pad wait line drops `||live().intent`; throne copy `Review your quote below the game.` → `Buying ICE in the background.`; `quote ICE output` → `instant ICE buy`; `· live quote below` is dropped from the throne header. Regenerate `game.html`.
- Edge & error policy: while `state.busy`, all value buttons stay disabled (scene hits still reach the engine and get the busy message). The explorer link opens in a new tab with `rel="noreferrer"`.
- Budgets: `grep -c "Quote Fridge Swap\|Review Tank Fill\|Cancel Review\|Review & Confirm\|intent" web/src/main.tsx` = 0; `grep -c "intent\|Review your quote" web/public/game.html` = 0; panel 03 fits its grid cell with no horizontal overflow at 390 px.
- Covers: R10, R11, R12, R14, R15 · Depends on: M10.

#### M12: Session-aware wallet fixture — changed
- Purpose: let the browser suite exercise real signatures, game-wallet transactions, refills and prompt counts (R17).
- Location: `web/tests/wallet-fixture.ts`.
- Interface: `fixture(page,{wallet,wrong,poor,roll,missingCode,permissions=false,badSignature=false})` returns `{calls,sent,raw,prompts,tank,balance(address,'eth'|'ice'),fund(address,{eth,ice}),session,sessionKey,setBlock,reject(value=true),revert,dropLogs,hold,release}`; `sessionWallet()` is exported for the same derivation outside a page. `hold()` keeps new receipts pending; `release()` publishes them and advances one block.
- Internals:
  1. `player` becomes Anvil test account #0 (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`, its public test key); `session` = the address derived Node-side from the player's signature of `sessionMessage` (exported for assertions).
  2. `personal_sign` is forwarded by the page provider, like every other non-account call, to the Node-side RPC mock, which signs with the test key (or returns a 64-byte signature when `badSignature`) and records a prompt.
  3. Per-address ETH and ICE balances, ICE allowances per (owner, spender) and Permit2 allowances per owner. Player transactions (`eth_sendTransaction`: plain ETH transfer, ICE `transfer`, and today's calls) record a prompt. `eth_sendRawTransaction` is decoded with `parseTransaction` and `recoverTransactionAddress`, applies the same effects for its sender and is recorded in `raw` with a timestamp; it is not a prompt. Its nonce must equal the sender's next nonce, and `value + gas × maxFeePerGas` must be covered (gas is checked, not charged, so balance assertions stay exact). Mined calls apply atomically; a revert yields a `0x0` receipt and no state change.
  4. Answer `eth_getTransactionCount` (per sender), `eth_estimateGas` (runs the `eth_call` path, returns `0x5208` for plain transfers and `0x30000` otherwise), `eth_getTransactionByHash` (for receipt polling while held), `eth_maxPriorityFeePerGas` (`0x1`) and `eth_gasPrice` (`0x2`).
  5. `wallet_getSupportedExecutionPermissions` returns both periodic types for `0xaa36a7` with rule types `expiry`, `redeemer`, `payee` when `permissions`, else error -32601. `wallet_requestExecutionPermissions` records a prompt and echoes the request with `context`, `delegationManager = DELEGATION_MANAGER`, `dependencies: []`. `redeemDelegations` applies the player → game-wallet transfer within the granted `periodAmount` per context, and reverts over the cap.
  6. Router `execute` from the game wallet: debits its input, credits the quoted output to the game wallet, issues the ticket to the `hookData` player. `fillTank` debits the sender's ICE and emits `TankFilled` with the sender.
- Edge & error policy: any unmocked method still throws -32601, so a new RPC dependency shows up as a failing test instead of a silent pass.
- Budgets: fixture stays one file; no network access.
- Covers: R17 · Depends on: M10 (behaviour it mirrors).

#### M13: Browser tests for background play — changed
- Purpose: prove the zero-prompt flow and the safety rails end to end (R9–R17).
- Location: `web/tests/arcade.spec.ts`.
- Interface / Internals: helpers `open(page)` (unchanged contract) and `startSession(page)` (clicks Start Background Play, waits for the `Game wallet` line). Tests:
  1. Kept as is: static subpath; clean top; unknown network; missing deployed code; scene runs like the prototype.
  2. Rewritten: `background ICE sale: one-time approvals, router payload with player hookData, no wallet prompt`; `golden throne buy is instant; winning draw by the game wallet at B+2; free bursts after receipt`; `losing roll shows outcome without broadcasting draw`; `tank fill from the game wallet credits local pees and survives reload`; `short game wallet and invalid tank range give actionable messages`; `wallet rejection of the session signature or a top-up changes nothing`; `router simulation revert prevents game-wallet signing`; `fridge collision swaps in the background`; `a receipt without TankFilled cannot create local pees`.
  3. New: `session start: one signature, key never stored, same game wallet after reload`; `auto-refill: one grant, then fridge swaps pull ICE with zero prompts`; `manual mode: top up and move ICE, then play with zero prompts`; `a non-ECDSA signature is refused`; `one move at a time: a second hit during a pending swap is skipped with a message`; `withdraw to wallet returns ICE and ETH to the player`; `a second tab cannot start background play`.
  4. Deleted: `expired quote prevents signing and requires a fresh review`.
  5. Prompt assertions: after `startSession` + top-up, the prompt count stays unchanged across ≥ 3 moves; `raw` holds those moves. Key assertion: no value in localStorage or sessionStorage contains the session key hex (without `0x`).
- Edge & error policy: tests use Playwright's auto-waiting only; no fixed sleeps.
- Budgets: suite = 21 tests, all pass; no `pageerror`.
- Covers: R9–R17 · Depends on: M11, M12.

#### M14: Export rebuild for background play — changed
- Purpose: keep `dist/` equal to the source (R17).
- Location: `dist/`, `docs/frontend/*.png`, `docs/frontend/browser-results.json`.
- Interface: from `web/`: `npm run typecheck && npm test && npm run build && npm run check:export && npm run test:browser`.
- Internals: 1) run the chain; 2) `git status` shows changes only under `web/`, `dist/`, `docs/frontend/` and the project docs; 3) commit source and `dist/` together.
- Edge & error policy: same as M6; never hand-edit `dist/`.
- Budgets: `check:export` prints PASS with N ≤ 128 assets and B < 31457280 bytes; `grep -rl "Quote Fridge Swap\|Cancel Review" dist/` prints nothing.
- Covers: R17 · Depends on: M7–M13.

#### M15: Scene source and adaptation — changed
- Purpose: ship Lobby's scene through the existing pipeline (R18, R19, R22, R23, R24).
- Location: `prototype/index.html` (replaced), `web/scripts/adapt-game.py`, `web/public/game.html` (regenerated).
- Interface: `python3 web/scripts/adapt-game.py` stays idempotent; the scene bridge gains `pepeScene.wallet(view)` (M17).
- Internals: 1) copy the file verbatim into `prototype/index.html`; 2) in adapt: drop the `<script type="text/plain" id="bgmData">` block and restore the asset loader `audio.src='assets/bgm.mp3'`; 3) drop the file's "MetaMask connect" script; keep the wallet markup and CSS; 4) scope the `$IMD` → `Sepolia ETH` rewrite so the `#imdBal` chip and the dropdown row keep "$IMD"; 5) keep the file's docked start (`docked=true` plus the instant `dockBrand` on `document.fonts.ready`) inside the replaced balance block; 6) remove the `.sound` override; 7) add the pill minimum-size rule to `fit()` (M17).
- Edge & error policy: every anchor the adapt script edits must exist once; a missing anchor fails the script.
- Covers: R18, R19, R22, R23, R24 · Depends on: none.

#### M16: Mainnet holdings reader — new
- Purpose: read-only mainnet ETH, $ICE and $IMD for the connected address (R21).
- Location: `web/src/holdings.ts`.
- Interface: `MAINNET_RPCS: string[]`, `MAINNET_TOKENS: {ice: Address; imd: Address}`, `type Holdings = {eth?: bigint; ice?: bigint; imd?: bigint}`, `readHoldings(address: Address, client?: PublicClient): Promise<Holdings>`.
- Internals: viem `createPublicClient({chain: mainnet, transport: fallback(MAINNET_RPCS.map(url => http(url, {timeout: 10000, retryCount: 1})))})`, created once; `getBalance` plus two `balanceOf` reads via `Promise.allSettled`; both tokens use 18 decimals (verified on-chain 2026-09-27). RPCs: `ethereum-rpc.publicnode.com`, `1rpc.io/eth`, `eth.drpc.org` (all CORS `*`, checked 2026-09-27).
- Edge & error policy: a failed field stays undefined and is logged with `console.warn('mainnet holdings read failed', {field, error})`; never throws.
- Covers: R21 · Depends on: none.

#### M17: In-scene wallet wired to the shell — changed
- Purpose: the scene's pill drives the shell's wagmi wallet (R20, R21).
- Location: `web/src/main.tsx`, `web/src/style.css`, `web/scripts/adapt-game.py` (scene side).
- Interface: shell → scene `pepeScene.wallet({account?, wrong, busy, network, holdings: {eth, ice, imd}, message?})` with display strings; scene → shell `parent.pepe.wallet.{connect(), disconnect(), switchChain(), refresh()}`.
- Internals: 1) remove the `.wallet-controls` overlay, the `ConnectButton` / `RainbowKitProvider` usage, its stylesheet import and the `@rainbow-me/rainbowkit` dependency; 2) keep `connectWallet` / `switchChain` / `disconnect`, sending their errors to the pill bubble (6 s) instead of the status line; 3) a `useEffect` reads holdings on connect / account change and on `refresh()`, and pushes the view on every change and on iframe load; 4) scene: pill click → connect / switchChain / toggle dropdown; dropdown open → `refresh()`; Escape and outside click close it; chips show `$ICE` / `$IMD` holdings; `update(state)` no longer writes the chips; 5) `fit()` sets `.wallet` `transform: scale(max(1, 28 / (34 * s)))` with origin top right.
- Edge & error policy: no wallet → "No browser wallet found. Install an injected wallet, then reload."; a rejected request → "connection cancelled"; holdings reads never block play.
- Covers: R20, R21 · Depends on: M15, M16.

#### M18: Browser tests for the redesign — changed
- Purpose: prove R18–R25 in the suite.
- Location: `web/tests/wallet-fixture.ts`, `web/tests/arcade.spec.ts`, `web/tests/core.test.ts`.
- Internals: 1) the fixture answers the three mainnet RPC hosts (ETH 1.5, $ICE 1234.5, $IMD 42 for the player); 2) helpers connect through the in-scene pill; 3) the clean-top test becomes "scene redesign": brand block docked at load, pill top-right, no speaker, dropdown shows the mainnet rows and closes on Escape, chips show the mainnet values, pill ≥ 28 px at 390 px width; 4) the music test uses the M key; 5) unit tests for `holdings.ts` (checksummed constants, a failed field stays undefined).
- Covers: R18–R25 · Depends on: M15–M17.

#### M19: Export rebuild for the redesign — changed
- Purpose: keep `dist/` equal to the source (R25).
- Location: `dist/`, `docs/frontend/*.png`, `docs/frontend/browser-results.json`.
- Internals: same chain as M14; commit source and `dist/` together.
- Budgets: `check:export` PASS with N ≤ 128 assets and B < 31457280 bytes.
- Covers: R25 · Depends on: M15–M18.

### Impact analysis
| Removed / changed | Referenced by | Decision |
|---|---|---|
| `header.topbar` (wordmark, network label, wallet buttons, Rules link) | `style.css` rules + 2 media blocks; `arcade.spec.ts` Rules-link click; skip link text | CSS deleted (M1); test opens the Rules summary instead (M5); skip link kept unchanged |
| `.statusbar` | `style.css` (+ media); `check-browser-live.mjs` wait/result; 11 test assertions on `getByRole('status').first()` | CSS deleted (M1); script waits on `.poolline` (M5); assertions unchanged, now resolve to the `#review .status` line (M3) |
| "Sepolia arcade ready…" copy | `engine.ts` ready transition; `check-browser-live.mjs` | engine sets empty message (M3); script no longer looks for it (M5) |
| `#chainMessage` (scene) | `adapt-game.py` ×3; `game.html`; `dist/game.html` | removed at the source (M4); export rebuilt (M6) |
| `.sound` position | `game.html` CSS; test focuses "Mute music" (position-agnostic) | override injected by adapt (M4) |
| `docs/frontend/*.png` | regenerated by the static Playwright test | commit regenerated files with the change (M6) |
| `Intent`, `prepareSwap`, `prepareTank`, `advance`, 30 s quote expiry | review JSX in `main.tsx`; `window.pepe.swap` / `flip`; scene `live().intent` guards (`adapt-game.py`); 6 browser tests | removed (M10, M11); scene guards drop `intent` (M11); tests rewritten or deleted (M13) |
| Player approvals (ICE→Permit2, Permit2→router, ICE→hook) | `engine.advance` | replaced by one-time game-wallet max approvals (M10) |
| `window.pepe.swap` bridge | scene fridge hit and throne buy | calls `engine.swap` directly, no scroll to panel 03 (M11) |
| `TankFilled` player check | `applyReceipt`, `recover` | compared with the paying address stored in the pending record (M10) |
| `draw` / auto-draw | ticket board Claim button, `updateTickets` | signed by the game wallet; auto-draw only with an active session (M10) |
| Panel 03 copy ("Wallet Move", "Review & Confirm") and Rules copy | `arcade.spec.ts`; `check-browser-live.mjs` reads `#review .status` | status line and `#review` id kept; copy replaced (M11); live check unchanged |
| Fixture `player` `0x…1234` (no key) | every browser test; ticket logs | Anvil test account #0 with a real key (M12) |
| localStorage | `pepe:<launchId>:<player>` (tank, points, pending) | pending gains `from`; new public keys `pepe:grant:…` and `pepe:session:…`; the session key is never stored (M9, M10) |
| `Runtime` shape | `engine.ts`, tests | gains `transport` (M7) |
| `prototype/index.html` | `adapt-game.py` anchors; "prototype unchanged" checks in T6/T14 | replaced by Lobby's file on purpose (M15); adapt anchors updated |
| Top-left `.wallet-controls` overlay, RainbowKit | `main.tsx`, `style.css`, `package.json`, browser helpers that click "Connect Wallet" | replaced by the in-scene pill (M17); helpers updated (M18) |
| Speaker button `#soundBtn` | `adapt-game.py` `.sound` override; browser music test | override removed (M15); test uses the M key (M18) |
| Chips `#balance` / `#imdBal` (Sepolia ICE / ETH) | `pepeScene.update` | now mainnet $ICE / $IMD from M16; Sepolia balances stay in the stats row (M17) |
| Climb HUD `#chFuel`, `#chBank`, `#chBalSlot` moves | scene climb script only | removed or unused in the file; nothing else references them |

### Dependency topology
- Clean top (shipped): M3 → M1 → M2 (message home first, then remove the bar and header, then place the overlay) ; M4 independent of M1–M3 ; M5 after M1–M4 ; M6 last. Plan order: M4, M3, M1, M2, M5, M6.
- Background play: M7 → M8 → M9 → M10 → M11 ; M12 mirrors M10 ; M13 after M11 and M12 ; M14 last. Plan order: M7 (T7), M8 (T8), M9 (T9), M10 (T10), M11 (T11), M12 (T12), M13 (T13), M14 (T14). Until T13 lands, `npm run test:browser` is expected to fail on the rewritten flows; each earlier task gates on typecheck and `npm test`.
- Scene redesign: M15 → M16 → M17 → M18 → M19. Plan order: T15 (M15), T16 (M16), T17 (M17), T18 (M18), T19 (M19). Between T15 and T18 the browser tests that click "Connect Wallet" are expected to fail.
- Rollback: revert the background-play commit(s). Grants already given expire after 7 days and can be revoked in MetaMask; funds left in a game wallet stay reachable with the same signature once the feature returns.

### File layout touched
```
web/scripts/adapt-game.py        (M4)   web/public/game.html (regenerated, M4)
web/src/engine.ts                (M3)   web/src/main.tsx (M1, M2, M3)
web/src/style.css                (M1, M2, M3)
web/tests/arcade.spec.ts         (M5)   web/scripts/check-browser-live.mjs (M5)
dist/**                          (M6)   docs/frontend/desktop.png, mobile.png (M6)
web/src/chain.mjs                (M7)   web/src/protocol.ts (M7)   web/src/config.ts (M7)
web/src/session.ts (new, M8)            web/src/refill.ts (new, M9)
web/src/engine.ts                (M10)  web/src/main.tsx, style.css (M11)
web/scripts/adapt-game.py        (M11)  web/public/game.html (regenerated, M11)
web/tests/core.test.ts           (M7, M8, M9)
web/tests/wallet-fixture.ts      (M12)  web/tests/arcade.spec.ts (M13)
dist/**, docs/frontend/**        (M14)
prototype/index.html (replaced, M15)   web/scripts/adapt-game.py, web/public/game.html (M15, M17)
web/src/holdings.ts (new, M16)          web/src/main.tsx, style.css, package.json (M17)
web/tests/*                      (M18)  dist/**, docs/frontend/** (M19)
```
