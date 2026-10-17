// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {DealEscrow} from "../src/DealEscrow.sol";

/**
 * Deploy DealEscrow to Arc testnet.
 *   USDC_ADDRESS   ERC-20 USDC interface (Arc testnet: 0x3600000000000000000000000000000000000000)
 *   ESCROW_OWNER   owner (pause only), defaults to deployer
 *   ESCROW_ARBITER arbiter for disputes, defaults to deployer
 * Run: arc-forge script script/Deploy.s.sol --rpc-url $ARC_TESTNET_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast
 */
contract Deploy is Script {
    function run() external {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        address owner = vm.envOr("ESCROW_OWNER", deployer);
        address arbiter = vm.envOr("ESCROW_ARBITER", deployer);
        vm.startBroadcast();
        DealEscrow escrow = new DealEscrow(usdc, owner, arbiter);
        vm.stopBroadcast();
        console2.log("DealEscrow deployed at", address(escrow));
        string memory json = string.concat('{"dealEscrow":"', vm.toString(address(escrow)), '","usdc":"', vm.toString(usdc), '","chainId":', vm.toString(block.chainid), "}");
        vm.writeFile("deployments/latest.json", json);
        vm.writeFile(string.concat("deployments/", vm.toString(block.chainid), ".json"), json);
    }
}
