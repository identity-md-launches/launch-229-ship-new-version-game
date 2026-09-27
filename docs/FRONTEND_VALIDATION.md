# Frontend validation — frozen `pepes-armed` release, 2026-09-27

This release changes only this documentation. The requested payload is the existing committed `dist/`, preserved byte-for-byte. No build, scene adaptation, manifest generation, contract change, or chain change was performed. The release-specific prohibition on rebuilding takes precedence over the general build acceptance criterion.

## Release identity and publication status

| Item | Verified value |
| --- | --- |
| Requested site name | `pepes-armed` |
| Base commit (`git rev-parse HEAD`) | `69a783ada11610ce366dc8d0fc4a35de9991ad0f` |
| Export tree (`git rev-parse HEAD:dist`) | `552c0b57d0d11983a605a6d054e05e7a5a12be8e` |
| Payload | Repository-root `dist/`: 20 files, 3,418,335 bytes including `imd-deployment.json` |
| Gameplay network | Sepolia, chain ID `11155111` |
| PepeIce | `0xf3dab52ca75b7abeb31ecd0136b01a45a5c48f37` |
| JackpotHook | `0xd08e759d3d89eed2de3f03006a6e21ae341d4088` |
| Deployment input | `web/deployment/handoff.json`, unchanged |

**Publication remains pending.** This session exposes shell and browser tools, but no IdentityMD site-job or IPFS pinning/name-update tool; no `ipfs` executable is installed. An accessible publishing job/provider was requested. No upload, pin, CID, site-record update, gateway verification, or publication attestation is claimed. The documented target is `https://pepes-armed.site.identitymd.eth.limo`; its currently served content was not verified.

The publishing service must use the directory contents identified by the export tree above, retain their paths, pin the resulting directory CID and update the `pepes-armed` name record. It must not rebuild or regenerate `dist/`. After publication, record the provider/job receipt, CID and resolved named entrypoint, and compare every served file with this committed export. The Git tree hash above is an integrity identifier, **not an IPFS CID**.

## Checks performed for this release

Environment: Node `v24.9.0`, npm `11.6.0`. The two npm commands below ran from `web/`.

| Check | Actual result |
| --- | --- |
| `npm ci --ignore-scripts --cache /tmp/pepes-armed-release-npm-cache --no-audit --no-fund` | Exit 0; 561 packages installed. Existing React peer and transitive deprecation warnings. Lifecycle scripts were disabled; no manifest or lockfile changed. Dependencies remain ignored and the cache is outside the repository. |
| `npm run check:export` | Exit 0; exact output reproduced below. Checks handoff identity, network, contract addresses, canonical ABI hashes, complete asset inventory, SHA-256 hashes and export size bounds. |
| Committed export integrity | Independently recomputed Git blob hashes for every file against `git ls-tree -r HEAD dist`; all 20 matched, with no extra files or symlinks. `git diff --exit-code HEAD -- dist web prototype` passed. |
| Static hosting source check | `dist/index.html` references `./fonts.css`, `./assets/index-CgZZiCFQ.js` and `./assets/index-eKXOXgw0.css`; Vite declares `base: './'`. Source, package manifest, lockfile and complete export are already tracked. This is source/integrity evidence, not a gateway test. |
| Assigned browser tool | Could not launch: `Browser "chrome-for-testing" is not installed; expected executable at /home/seat/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome`. No tool-managed preview descriptor was present at `test/scratch/browser/preview.json`. |
| Production build, typecheck, unit and interaction suites | Not rerun in this frozen-export release. The assignment and inherited `AUDIT.md:122` report the maintainer run: typecheck, 27 unit tests, production build, export check and 22 browser tests passed. Those are inherited results, not executions by this worker. |

```text
> pepes-armed-release@1.0.0 check:export
> node scripts/check-export.mjs

PASS: exact handoff, network, pinned ABI hashes, 19 assets, 3414059 export bytes.
```

The checker counts 19 assets excluding the 4,276-byte deployment manifest. No new rendered screenshots, keyboard interaction, console/resource observations, live RPC checks, wallet signing or transactions were performed. Historical evidence below and existing `docs/frontend/` artifacts are not fresh verification of this release.

## Better Interface review of the frozen source

Read the pinned workflow, the core principles of all six domains and the design-documentation section in `.imd/reads/skills/better-interface/REFERENCE.md`. Review covered the React shell, wallet/holdings bridge, scene markup and styles, local fonts, relative export entrypoint and existing design documentation. The scope permits findings and documentation, not source corrections.

| Domain | Coverage and evidence | Unperformed checks |
| --- | --- | --- |
| Accessibility | Checked in source: native buttons, skip link, iframe name, touch/keyboard equivalents, labelled inputs and live status (`web/src/main.tsx:56`, `:59`, `:61`, `:78`, `:82`); focus rings and reduced-motion CSS (`web/src/style.css:18`, `:97`); named wallet dialog, expanded state and Escape handler (`web/public/game.html:850`, `:856`, `:2635`). See findings below. | Actual tab order, focus visibility/return, screen-reader traversal, target geometry, forced colors, automated accessibility scan and native 200% zoom. |
| Layout | Checked in source: 1280:720 scene, 1440px content maximum, wrapping controls, three/two/one-column panels and two-column mobile balances (`web/src/style.css:23`, `:27`, `:35`, `:75`, `:81`); scene wallet scale targets a minimum 28px height (`web/public/game.html:1536`). | Desktop, intermediate, 390px and 320px rendered reflow/overflow; physical devices. RTL/localization variants are not implemented. |
| Writing | Checked labels, network distinctions, help, ticket empty state and recoverable errors (`web/src/main.tsx:63`, `:74`, `:79`, `:95`, `:116`). Wallet dropdown labels holdings as Ethereum mainnet and gameplay as Sepolia (`web/public/game.html:858`, `:862`). Rules copy conflicts with that distinction; see finding W1. | No rendered copy observations; source evidence establishes W1. |
| Typography | Checked local WOFF2 declarations with `font-display: swap` (`web/public/fonts.css:1`), shell font roles, heading sizes, unitless paragraph leading, tabular balances and address wrapping (`web/src/style.css:2`, `:33`, `:37`, `:39`, `:55`). | Font loading, actual weights, wrapping, clipping and small scene-text legibility at mobile widths. |
| Colors | Checked existing hex tokens and calculated three declared opaque foreground/background pairs: `#f3f1e8` / `#03061a` = 17.76:1; `#b2bee5` / `#0a1231` = 9.96:1; `#111833` / `#f7e1a0` = 13.50:1. Calculations use sRGB relative luminance and WCAG contrast. | These are source calculations, not measured rendered contrast. Translucent wallet surfaces, gradients, art and focus adjacency remain unverified. Alternate themes are not implemented. |
| UI | Checked hover, press, disabled, wallet busy/wrong-network states, holding placeholders (`—`, `…`, `?`), explicit transition properties and pause/reduced-motion support (`web/src/style.css:11`, `:14`, `:97`; `web/public/game.html:449`; `web/src/holdings.ts:21`; `web/src/main.tsx:60`). | Rendered loading/error/empty states, dropdown interactions, animation timing, slow-motion inspection, touch and music behavior. |

Findings remain open because the user explicitly freezes `dist/`, `web/` and `prototype/`:

- **W1 — Medium, writing:** `web/src/main.tsx:97` says “There is no mainnet token connection and no $IMD in this release.” This contradicts `web/src/holdings.ts:13` and the wallet dropdown. Users opening Rules receive inconsistent information about the displayed balances. A later source release should say that mainnet ETH/$ICE/$IMD holdings are read-only and gameplay remains on Sepolia. No correction was made to the frozen export.
- **A1 — Medium, accessibility:** `web/src/main.tsx:52` clears wallet connection/network errors after six seconds without dismissal. This gives readers limited time to read recovery information (the scene displays it through `web/public/game.html:2657`). A later release should retain errors until dismissed or superseded. Source-confirmed timer; rendered timing was not observed.
- **A2 — Medium, accessibility:** `web/public/game.html:2626` explicitly blurs the wallet trigger, while `walletOpen` at `:2621` and Escape at `:2635` do not move/restore focus. A later release should preserve keyboard focus and return it when closing the dropdown. The missing focus management is source-confirmed; its exact browser/assistive-technology impact is unverified.

No visual compliance verdict is claimed. The fixed-ratio scene's mobile text, zoom behavior and primary interaction usability still depend on the maintainers' earlier browser validation and require fresh rendered review when tooling is available.

## Implemented design record and documentation limits

Root `DESIGN.md` already records the redesign and wallet behavior, and root `README.md` already describes install, preview, rebuild and IPFS publication. Both are outside this release's docs-only change scope. Their historical implementation notes are not instructions to rebuild. The following source-derived supplement records current design facts without editing those files:

- **Tokens and type:** shell `web/src/style.css:2` uses `#03061a` background, `#f3f1e8` text, `--gold: #f7e1a0`, `--muted: #b2bee5`, IBM Plex Sans/system sans and Sniglet headings. Scene `web/public/game.html:11` defines lapis `#03061A` / `#0B1550` / `#152268`, line `#2B3C8C` / `#1C2A66`, gold `#E3BE60` / `#F7E1A0`, brass `#A87C33`, jade `#8FC2A4`, pink `#E38AA8`, azure `#4A79DC`, cloud `#F3F1E8`, muted `#93A0D4` and club `#62C79C`. Its display/body/mono/heavy families are Sniglet, IBM Plex Sans, IBM Plex Mono and Archivo, with CSS fallbacks. Local font faces also include Big Shoulders Display and Patrick Hand; actual font loading was not observed.
- **Hierarchy and layout:** shell headings are 26px, subheads 17px, panel copy 14px/1.6 and balances 28px (24px below 1000px), with tabular digits. Panels have 24px padding and 16px gaps; below 600px padding is 20px and page margins are 14px. Above 1000px panels have three columns, through 1000px two columns with Session spanning the row, and through 600px one column. The iframe retains its 1280:720 ratio.
- **Components and surfaces:** `Arcade` in `web/src/main.tsx` composes the scene, pause/touch controls, balances, fridge/throne/session panels, ticket list, Rules disclosure and footer. Shell buttons have 9px radii and 44px minimum height; panels have 14px radii and dark gradients; the scene frame has an 18px radius (10px on mobile). The scene wallet pill uses a 17px radius, gold border and translucent lapis fill; its 12px-radius dropdown adds a shadow and textual network state. These are existing component patterns, not a new shared library.

Future design documentation should reconcile the root document's historical plans with these final source values. This release does not claim that the root document has been rewritten to the pinned guide's full format. Guidance attribution: Jakub Krehel, Better Interface, MIT, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`; documentation method: Paul Bakaus, Impeccable, Apache-2.0, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`.

## Packaging result and remaining blocker

The export itself is 3,418,335 bytes. Tracked-path checks found no nested `node_modules`, npm/Vite caches, dependency archives or Git submodules. No ignore file changed; no required music, fonts, ABIs, source or runtime assets were removed.

However, `git bundle create test/scratch/release/base.bundle HEAD` followed by `git bundle verify` produced a valid **complete-history base bundle of 12,334,352 bytes**, exceeding the **8,388,608-byte** submission limit before this documentation change. Repacking a disposable bare clone with compression 9, window 250 and depth 50 still produced a complete-history base bundle of **12,296,700 bytes**. The managed `.git` was not modified. This is an inherited history-size blocker, not an asset-size pass; the historical 5,531,480-byte figure below does not describe this base commit. A smaller incremental bundle or history-stripped snapshot is not claimed as a complete-history submission.

The publishing/submission service must resolve the history packaging constraint before an under-budget complete-history release can be claimed. Scratch bundles/clones live only in `test/scratch/` and are not deliverables. Publication and the complete Git bundle budget remain unmet; this documentation preserves the verified payload and records the limitations without dropping files or rewriting history.

---

## Historical validation — 2026-09-26 (retained unchanged)

The remainder is inherited evidence from an earlier build. Its counts, UI descriptions, browser results, packaging measurements and publication status are historical; the release record above supersedes them for this frozen export.

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
