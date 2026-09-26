# Frontend validation — 2026-09-26

This is worker-produced evidence, not an independent security review, IPFS publication, or publication attestation. The current rebuild leaves contracts, chain configuration, `prototype/`, `web/public/game.html`, and `web/scripts/adapt-game.py` unchanged.

## Delivered behavior

The prototype’s art, original MP3, scene, movement, aiming, automatic pee pad, throne and pizza climb remain. Its value simulation is replaced by a shared viem transaction engine under a React/wagmi/RainbowKit shell. The scene and accessible controls use the same engine. Wallet balances, pots, price and ticket state are chain reads; all gameplay prizes are local points. Paid pees require a matching confirmed `TankFilled` event. A replacement/cancellation receipt without that event grants no credit. Confirmed throne tickets grant local free bursts. Winning rolls alone prompt draw, with a separate retry control.

The runtime deployment file is `dist/imd-deployment.json`. It carries all handoff identity fields, the exact two contracts and ABI hashes, the unchanged supplied network object, the exact add-chain parameters, pool parameters and every exported asset’s SHA-256. Both implementation ABI hashes match the arrays obtained from source commit `e145493b7c3079519d397de3823834c0bf773060` with `git show`. Asset paths are relative. The manifest excludes itself.

## Executed checks

Run from `web/` on 2026-09-26. The clean install used `/tmp/pepes-armed-npm-cache` because the managed default npm cache is read-only; no cache is part of this release. Details and exact test names are preserved in `docs/frontend/`.

| Check | Result |
| --- | --- |
| `npm ci --cache /tmp/pepes-armed-npm-cache` | Passed; npm emitted existing peer/deprecation warnings. The unqualified first attempt failed only because the host default cache is read-only. |
| `npm run typecheck` | Passed; strict TypeScript includes source, config, scripts and test fixtures. |
| `npm test` | 11 passed; ABI binding, PoolId, both swap directions, player hookData, settlement encoding, slippage, draw boundaries, exact roll, winner set, chain add fallback, and path validation. |
| `npm run build` | Passed; pinned implementation ABI hashes verified, Vite emitted the relative-base static export, and the final manifest was generated afterward. Vite retained local `./fonts.css` for runtime resolution and reported third-party directive/comment warnings. |
| `npm run check:export` | Passed; exact handoff/network/pool/ABI binding, exhaustive inventory, SHA-256, and size bounds. It found 19 assets totaling 5,349,476 bytes before the manifest. |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/pepe-browsers npm run test:browser` | Did not execute page tests: Chromium installed to `/tmp`, but the managed host lacks required shared libraries (`libatk`, `libatspi`, `libxcomposite`, `libxdamage`, `libxfixes`, `libxrandr`, `libgbm`, and `libasound`). All 14 entries in `frontend/browser-results.json` are launch failures, not site failures. |

The browser-report JSON reflects the current failed-to-launch attempt. The screenshots, live-chain observations, and formerly passing browser report described below are historical worker evidence from 2026-09-25, not a claim that a browser session ran on 2026-09-26.

Browser coverage includes: missing wallet, connected live read presentation, wrong network and 4902 add-chain fallback, exact ERC-20 and Permit2 approval recipients/amounts, router payload decoding and player identity, native value without approvals, B+2 winning draw, losing roll with no draw, tank fill and local decrement/restoration, insufficient funds, invalid tank size, user rejection, router simulation revert before signing, missing code, reduced motion, music keyboard control, rules, quote expiry and replacement receipts without expected events. A test-only response instrumentation exposes original scene closure functions to exercise fridge collision and local-point credit. No test hook is shipped in the export.

Evidence: `frontend/typecheck.txt`, `frontend/unit-tests.txt`, `frontend/build.txt`, `frontend/export-check.txt`, `frontend/browser-results.json`, `frontend/desktop.png`, `frontend/mobile.png`, `frontend/live-chain.json`, `frontend/live-browser.json`, `frontend/live-quotes.json`, and `frontend/dependency-audit.json`. Screenshots use explicitly mocked balances/pots; those numbers are not live-chain evidence.

## Live-chain observations and limits

At the recorded read time, the ETH/ICE PoolId was `0x8a4279952ebfdc5be1698760df0bdd8f7643720415c0244cff84acf64a3249df`. Both pots were zero. StateView returned sqrtPriceX96 `560227709747861399187319382274582` and zero current active liquidity. All three RPCs agreed. This is a live price, not the manifest’s historical initial price.

Zero current liquidity does not imply no usable position: Quoter successfully crossed into the one-sided liquidity for 0.001, 0.005 and 0.01 ETH inputs. The observed outputs were approximately 49,130.8448, 245,593.8927 and 491,037.0408 ICE. The reverse 100 ICE quote reverted with `0x6190b2b0` at that state. The UI relies on actual quotes/simulation, shows reverts, and does not invent a price-derived guaranteed output or permanently lock the first buy because liquidity is zero at the current tick.

No real wallet approval, swap, tank fill or draw was broadcast. Wallet interactions, successful receipts, losses/wins, cancellation handling and account UI were exercised with mocks. Live router settlement, real wallet extension compatibility, proposer behavior, chain reorgs and payouts after real transactions remain untested by this worker. Chromium is the tested browser; Safari, Firefox, physical devices, hardware wallets and screen-reader traversal were not run. No site was published and no fixed-CID/named-entrypoint control-plane checks were claimed.

The client keeps recent tickets (up to 20 from the last 256 blocks). Local pees, free bursts and points are per-wallet browser state, not transferable on-chain entitlements. Clearing local storage loses them; simultaneous tabs can race local gameplay state. Pending transactions can be recovered on reconnect, but clearing storage during confirmation loses local recovery information. Chain reads use public RPC fallback; if all RPCs fail or verification becomes stale, write controls fail closed.

The production JS bundle includes wallet-library code and is roughly 2.5 MB uncompressed (about 0.5 MB gzip). Vite reports its size warning and third-party annotation/directive notices. The original required MP3 is preserved byte-for-byte. Assets are local, fonts are Latin subsets, music is not preloaded, and the export remains well within the HTTP body budget. The dependency audit’s remaining moderate entries propagate through optional connector packages, including UUID buffer handling and malformed URI decoding advisories. Only the injected connector is configured and no WalletConnect credentials are supplied. No claim is made that unused connector code has been independently audited; `frontend/dependency-audit.json` preserves the full report.

## Vercel Web Interface Guidelines review

Rules fetched again on 2026-09-26 from <https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md>. Retrieval metadata and the source SHA-256 are in `frontend/guidelines-source.json`; the 7,760-byte source remains SHA-256 `5a775e6411f790f518dbc9c1fa7c50a89e6873502d9a3530a6eb223a590bcfe8`. Review covered `web/src/main.tsx`, `web/src/style.css`, `web/src/engine.ts`, `web/src/config.ts`, `web/src/protocol.ts`, shared fonts, and the generated export. Source inspection found no new applicable issue; the current environment could not perform the browser portion because Chromium cannot launch with the host libraries available.

Applicable findings and fixes:

- `web/src/main.tsx:40` — added a keyboard-visible skip link and semantic page/section headings; native buttons and links expose wallet and contract actions outside the scaled scene.
- `web/src/main.tsx:48` — added touch and keyboard equivalents for game controls, plus a persistent pause/resume control. Input handling releases pointer-captured movement on cancellation.
- `web/src/main.tsx:51` — asynchronous messages use a polite status region; transaction links, retry guidance and wrong-network switching stay visible.
- `web/src/main.tsx:61` — slippage and amount controls have labels and names. Tank input has numeric input mode, bounds, inline invalid-state text and focus on invalid submission. Paste remains available.
- `web/src/main.tsx:70` — transaction review identifies exact approvals, minimum output, gas requirements, quote lifetime and deadline; signing is disabled for missing wallet, wrong chain, unverified/stale state or an in-flight action. In-game quotes move focus to the review region.
- `web/src/style.css:18` — visible focus rings, hover feedback and native dark input colors; no browser zoom restriction. Values use tabular numerals, containers wrap addresses, controls have 44 px minimum height and safe-area padding is included.
- `web/src/style.css:1` — moved `color-scheme: dark` onto `html`, so the document, browser chrome, and native controls consistently use the dark scheme.
- `web/public/game.html:713` — the original small artwork remains, including the greek key ground, and keeps the prototype's own focus styles (no added outline around the pepe); the in-game status message sits at the top center; initial ETH HUD positioning was corrected to avoid the medallion. Decorative SVG elements are hidden from assistive technology (SVGs inside CSS data URIs are left untouched), heading levels normalized and the throne is a nonmodal region.
- `web/public/game.html:1627` — game shortcuts no longer intercept modifier shortcuts or editable controls; buttons release focus after a click, as in the prototype, so the keyboard keeps steering the pepe.
- `web/public/game.html:2539` — the scene runs as in the prototype, which already stills meteors and star twinkle under reduced motion; the persistent pause control stops the simulation and decorative CSS loops. The animation loop skips hidden documents.
- `web/public/game.html:2670` — original music plays as in the prototype (from the first click or key press, as browsers allow) and supports its named button/M shortcut. No lyrics or spoken narrative need transcription.
- `web/public/fonts.css:1` — original font families are served locally with `font-display: swap`; fonts and embedded medallion no longer require external runtime asset hosts. OFL notices accompany the fonts.

Remaining UI limitations: the preserved platform scene is a fixed-ratio miniature at narrow widths, so its fine text and sprites become small. Equivalent primary contract actions and large touch controls remain outside it. Original decorative art uses some filter/position animations that are not compositor-only; the pause control provides an alternative. The skill-based platform game itself was not made a screen-reader game. The ticket board and all value actions are available through semantic controls. The rules panel supports a `#rules` deep link; transient quotes and wallet state are intentionally not persisted in URLs.

Swap encoding was cross-checked with Uniswap’s official guide: <https://docs.uniswap.org/contracts/v4/guides/swap-routing>. This review and local testing do not establish protected workflow acceptance or an independent security assessment.

## Submission packaging

The final static export contains 19 assets totaling 5,349,476 bytes before its small manifest. Every asset is below 8 MiB, and the export leaves ample room within the immutable/named HTTP verification budget. Source/public copies retain the required music, fonts and raw ABIs; no runtime deliverable was dropped for size.

The managed checkout mounts `.git` read-only. `git add -- web dist docs` failed with `Unable to create .git/index.lock: Read-only file system`, so this worker could not stage or commit the checkout. All requested files remain on disk for the contributor control plane to collect. No publication was attempted. `scripts/check-bundle.py` creates a disposable bare clone under the explicitly permitted `test/scratch/`, stages only allowed paths into a validation snapshot and measures a complete-history Git bundle there; it does not change the managed checkout or submit that disposable commit. `frontend/bundle-check.json` records the measured bundle budget, scope, absence of submodules and dependency-cache exclusions. The scratch clone/bundle are excluded from delivery. The current complete-history validation bundle measured 5,531,480 bytes, below the 8,388,608-byte limit. Missing historical blobs in the partial checkout are fetched read-only into the disposable clone, never into the managed `.git`.
