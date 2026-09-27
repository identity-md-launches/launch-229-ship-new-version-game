# VERIFY.md

Release: background play (R9–R17) on top of the clean-top page (R1–R8).
Source: `1a5b2c5` on `main`, pushed to the gitlawb fork (origin/main = `1a5b2c5`).
Verified: 2026-09-27, JST.

## Checks run

| Check | Result |
|-------|--------|
| `npm run typecheck` | clean |
| `npm test` | 24 tests, 24 pass, 0 fail |
| `npm run build` | `✓ built in 6.86s`; `dist/` byte-identical to the committed export (no diff after the rebuild) |
| `npm run check:export` | `PASS: exact handoff, network, pinned ABI hashes, 19 assets, 5370024 export bytes.` |
| `npm run test:browser` | 21 passed (35.8s) |

Log: `test/scratch/verify-chain.log` (git-ignored). Browser tests run against the built `dist/`, with a mocked
EIP-1193 wallet and a mocked Sepolia RPC (`web/tests/wallet-fixture.ts`) that keeps per-address ETH/ICE balances,
enforces nonces and counts wallet prompts.

## Requirement trace

| Req | Evidence | Status |
|-----|----------|--------|
| R1 | browser: "clean top: no header or status bar, wallet inside the scene, speaker bottom-right" | Pass |
| R2 | browser: clean top test; `grep` for both strings in `web/src`, `web/public/game.html`, `dist/` finds nothing | Pass |
| R3 | browser: clean top test (status line in panel 03, empty without a message) | Pass |
| R4 | browser: clean top test (wallet controls top-left in the scene at 1440px and 390px; no auto-connect). 320px is not in the suite | Pass (390px and up) |
| R5 | browser: clean top test; "scene runs like the prototype; pause, rules and music are keyboard accessible" | Pass |
| R6 | browser: "scene runs like the prototype…" | Pass |
| R7 | full check chain above; browser: static subpath, unknown network, missing deployed code, scene tests | Pass |
| R8 | `check:export` PASS; rebuild leaves `dist/` unchanged | Pass |
| R9 | browser: "session start: one signature, key never stored, same game wallet after reload", "wallet rejection of the session signature or a top-up changes nothing", "a non-ECDSA signature is refused"; unit: session message, same signature → same wallet, compact/foreign signatures refused | Pass |
| R10 | browser: "background ICE sale…no wallet prompt", "golden throne buy is instant…", "tank fill from the game wallet…", "fridge collision swaps in the background" (hit to broadcast < 3s) | Pass |
| R11 | browser: "manual mode: top up and move ICE, then play with zero prompts", "short game wallet and invalid tank range give actionable messages" | Pass |
| R12 | browser: "auto-refill: one grant, then fridge swaps pull ICE with zero prompts"; unit: support detection, request shape, grant validation, public-only storage, refill calls pass the allowlist | Pass (mocked wallet; see limits) |
| R13 | browser: "one move at a time: a second hit during a pending swap is skipped with a message" | Pass |
| R14 | browser: "withdraw to wallet returns ICE and ETH to the player", "a second tab cannot start background play"; unit: one tab holds the lock | Pass |
| R15 | `grep -rl "Quote Fridge Swap\|Cancel Review\|Review your quote" dist/` finds nothing; browser tests drive only the new controls | Pass |
| R16 | unit: allowlist accepts each arcade call and blocks everything else; foreign manager/wallet/chain grants refused; browser: "router simulation revert prevents game-wallet signing" | Pass |
| R17 | full check chain above; the prompt counter proves zero wallet prompts for background moves; source and `dist/` committed together in `a54dffa` | Pass |

## Not verified here

- A real MetaMask ERC-7715 grant (R12) and real game-wallet transactions on Sepolia. Both are covered only by the
  mocked wallet and RPC. They need a manual pass with a real wallet on the deployed site.
- Wallets other than MetaMask: auto-refill is expected to show as unavailable, with manual Top Up as the path.
