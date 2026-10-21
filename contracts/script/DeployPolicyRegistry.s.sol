// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {ProteusPolicyRegistry, IERC8004Identity} from "../src/ProteusPolicyRegistry.sol";

/**
 * Deploy ProteusPolicyRegistry, pointed at the ERC-8004 IdentityRegistry of the chain it runs on.
 *   Arc mainnet (5042):     IdentityRegistry 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 *   Arc testnet (5042002):  IdentityRegistry 0x8004A818BFB912233c491871b3d84c89A494BD9e
 * Writes deployments/policy-registry-<chainId>.json; DealEscrow's deployment files are not touched.
 * Run: arc-forge script script/DeployPolicyRegistry.s.sol --rpc-url <rpc> --private-key $DEPLOYER_PRIVATE_KEY --broadcast
 */
contract DeployPolicyRegistry is Script {
    function identityFor(uint256 chainId) internal pure returns (address) {
        if (chainId == 5042) return 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
        if (chainId == 5042002) return 0x8004A818BFB912233c491871b3d84c89A494BD9e;
        revert("unsupported chain: Arc mainnet 5042 or Arc testnet 5042002 only");
    }

    function run() external {
        address identity = identityFor(block.chainid);
        require(identity.code.length > 0, "IdentityRegistry has no code on this chain");
        vm.startBroadcast();
        ProteusPolicyRegistry reg = new ProteusPolicyRegistry(IERC8004Identity(identity));
        vm.stopBroadcast();
        console2.log("ProteusPolicyRegistry deployed at", address(reg));
        string memory json = string.concat(
            '{"policyRegistry":"', vm.toString(address(reg)), '","identityRegistry":"', vm.toString(identity), '","chainId":', vm.toString(block.chainid), "}"
        );
        vm.writeFile(string.concat("deployments/policy-registry-", vm.toString(block.chainid), ".json"), json);
    }
}
