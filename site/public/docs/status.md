# What is live today · Proteus AI docs

Source: <https://app.proteus.co.in/docs/status> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_Each capability, the network it is proven on, and the transaction that shows it._

| Capability | Proven on | Evidence |
|---|---|---|
| Full escrow loop: approve, fund, settle, close, refund (team funds, 0.60 USDC) | ✓ Arc mainnet | [fund](https://explorer.arc.io/tx/0xe527f3c4d6d5d2bebeb25dbd67dcc429b99827deac6349a81f7a88c3f75efe9d) · [settle](https://explorer.arc.io/tx/0xce2caa88fa3a2b136a85771573f2b5ce269be2ea2182da91f78cd9a2243153b0) · [refund](https://explorer.arc.io/tx/0x70d68aa16db7588b90f172ccb68d20bb4f95ca099650a2755ee1a3436481c94d) |
| A real business registers its agent from its own wallet (Shoonya Store, ERC-8004 Agent #2695) | ✓ Arc mainnet | [register](https://explorer.arc.io/tx/0x45921b0f981908b7d704b79119863781c21e71498c812965d90db1787bd24e55) |
| Pricing policies committed on chain (4 Shoonya products, version 1) | ✓ Arc mainnet | [commit 1](https://explorer.arc.io/tx/0x59065079ffdc03ddc1e7ab3d257210ff743076e6522d1013e67b0bf901cdd165) · [commit 2](https://explorer.arc.io/tx/0x525f8578c6f8c039aaf5ad32cd16b91f5d176d966e54e29050ff0c735ee0c977) · [commit 3](https://explorer.arc.io/tx/0xe88e372b98cd6a8532b5c8294d9e6a03953821c4a543054cf1102960fe591947) · [commit 4](https://explorer.arc.io/tx/0xece7b7615eabe2605eba03127341da4749c06f2bc775bec22278aa2f26c4ff8f) |
| Paid order from an outside buyer | Not yet | The first Shoonya order is next. |
| Gasless funding with a USDC permit (permit and createAndFundDeal in one Multicall3 transaction) | ✓ Arc testnet | [fund](https://explorer.testnet.arc.io/tx/0xcfc87ca9ab00adcafbd9468a17eb203d2e89e870b874f47d1e4e7610a7065d7d) · [settle](https://explorer.testnet.arc.io/tx/0x0601dc6e0ccf3bfbabe1dabbb2a57fef109c5b16ddf782f44a66fcbe126afac3) |
| Seller-confirmed delivery, then settlement | ✓ Arc testnet | [fund](https://explorer.testnet.arc.io/tx/0x280207802e1d34e8e8731abaab31fd31333ff3d8559867f6776eae04af1f3c73) · [settle](https://explorer.testnet.arc.io/tx/0x63aeb139848a1067eedb1961ed0721ef00024e44b4e9ec1e46cc2cdbb7eb8b45) |
| An AI agent (Claude) negotiates, funds and settles through MCP within a mandate | ✓ Arc testnet | [transcript and transactions](https://github.com/Adityaakr/proteus/blob/main/docs/evidence/2026-10-23-claude-mcp-kitbox.md) |
| x402 pay per call (exact, through Circle's facilitator) | ✓ Arc testnet | [payment](https://explorer.testnet.arc.io/tx/0x3d5c48a9a3fb765d5821479d0f46d4c94b8a17fc6763048fedb6f323f28de9f8) |
| x402 through Circle Gateway batching (transfer 18395b90-7bfa-4cc2-b655-a2f4c7219be1) | ✓ Arc testnet | [deposit](https://explorer.testnet.arc.io/tx/0x2e048bf4ca99132f730503acc952d90b66b1843e008fdc6e373192939c1a8eb7) |
| Disputes (open from the wallet, arbiter splits the unspent balance) | Off-chain test | [disputes.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/disputes.ts) |
| Catalog sync from the seller's own endpoint (tested against a local sample feed) | Off-chain test | [catalog-sync.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/catalog-sync.ts) |
