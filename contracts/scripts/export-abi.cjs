// Re-exports the DealEscrow ABI subset to server/src/chain/abi.ts and packages/domain/src/abi/escrow.ts after `arc-forge build`.
const fs = require("fs");
const path = require("path");
const a = require("../out/DealEscrow.sol/DealEscrow.json").abi;
const keep = a.filter((x) => x.type === "event" || x.type === "error" || (x.type === "function" && ["createAndFundDeal","settleAcceptedUsage","refundUnused","sellerCloseTerm","balances","getDeal","hashTerms","hashAcceptance","hashDelivery","refundableAt","paused","USDC","arbiter","owner","openDispute","resolveDispute"].includes(x.name)));
const erc20 = [{"type":"function","name":"transfer","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},{"type":"function","name":"approve","stateMutability":"nonpayable","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},{"type":"function","name":"allowance","stateMutability":"view","inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"account","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"type":"function","name":"decimals","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint8"}]}];
const out = "// Generated from contracts/out/DealEscrow.sol/DealEscrow.json. Do not edit by hand; rerun `node scripts/export-abi.cjs`.\nexport const dealEscrowAbi = " + JSON.stringify(keep, null, 2) + " as const;\n\nexport const erc20Abi = " + JSON.stringify(erc20, null, 2) + " as const;\n";
fs.writeFileSync(path.join(__dirname, "../../server/src/chain/abi.ts"), out);
fs.writeFileSync(path.join(__dirname, "../../packages/domain/src/abi/escrow.ts"), out);
console.log("abi exported");
