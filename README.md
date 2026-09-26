# pepes armed with ai

A small browser game: a pepe walks a starry stage, pees on a fridge to swap tokens,
rolls for a jackpot, buys compute at a golden throne and climbs a pizza tower.

`prototype/` is the working game. Everything in it runs in the browser: balances, swaps,
prices and dice rolls are simulated. `SPEC.md` describes the on-chain version: a Uniswap v4
hook that feeds a jackpot from every swap, a token, and the site that plays against them
on Sepolia.

## Sepolia site — `pepes-armed`

The shippable IPFS/static-hosting release is the repository-root `dist/` directory. It is a
relative-base Vite export of `web/`, bound to the Sepolia `PepeIce` contract at
`0xf3dab52ca75b7abeb31ecd0136b01a45a5c48f37` and `JackpotHook` at
`0xd08e759d3d89eed2de3f03006a6e21ae341d4088`. It keeps the original arcade scene, including
the Greek-key ground and unoutlined Pepe sprite; it does not change contracts or chain setup.

Install, validate, rebuild, and preview from `web/` (Node 22+):

```sh
cd web
npm ci
npm run typecheck
npm test
npm run build
npm run check:export
npm run preview
```

Publish the already-built directory under the site name `pepes-armed` with the selected IPFS
pinning provider, for example `ipfs add -r ../dist`. Pin the resulting CID, then configure the
provider's `pepes-armed` site/name record to that CID. Do not rewrite paths or rebuild during
publication: `dist/index.html` refers only to `./` relative assets and works at a gateway
subpath. The exact release checks, interaction-test limitation, and UI-guideline review are in
[`docs/FRONTEND_VALIDATION.md`](docs/FRONTEND_VALIDATION.md).

## Run the prototype

Serve the folder over HTTP (the music is loaded from `assets/`):

```sh
cd prototype && python3 -m http.server 8000
# open http://localhost:8000
```

Left and right arrows move and Up jumps. Space or `X` swings, pees (hold to aim, release to fire) or fires the climb jets. `T` flips the swap direction, `E` opens the golden throne (`1`-`3` buy, `Esc` closes), `C` cashes out of the climb, and `M` mutes the music.

## Build the contracts

The Foundry toolchain is fixed and vendored: `foundry.toml` (solc 0.8.26, cancun), `remappings.txt` and `lib/`
(forge-std, OpenZeppelin, solmate, Uniswap v4-core) are ordinary files, so `forge build` and `forge test` work
offline. Contracts go in `src/`, tests in `test/`; leave the toolchain files as they are.

## Status

- Prototype: complete, off-chain.
- Contracts: PepeIce and JackpotHook implemented with offline Foundry tests. See
  [contract and deployment documentation](docs/CONTRACTS.md), [security assumptions](docs/SECURITY.md),
  [launch manifest](launch.json) and [ABI exports](docs/abi/).
- Source publication, independent release review, attestation, admission, Sepolia deployment and
  the live-contract frontend are subsequent IdentityMD service stages.

## License

MIT, see `LICENSE`. Vendored libraries under `lib/` keep their own licenses.
