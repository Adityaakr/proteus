// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

/// @dev Golden vector: Solidity abi.encode must equal packages/domain policyCommitment() (packages/domain/test/policy.test.ts asserts the same hash).
contract PolicyCommitmentTest is Test {
    function test_goldenVectorMatchesDomainPackage() public pure {
        bytes32 typeHash = keccak256(
            "ProteusPolicy(bytes32 productId,uint64 version,uint32 minMarginBps,uint32 maxDiscountBps,uint256 approvalThreshold,uint256 prepaidMinimum,uint256 availableCapacityUnits,uint32 quoteTtlSeconds,bool allowNonPositiveContribution,bytes32 salt)"
        );
        bytes32 h = keccak256(
            abi.encode(
                typeHash, keccak256("invoice-processing"), uint64(3), uint32(2500), uint32(1500), uint256(500_000_000), uint256(50_000_000), uint256(10_000), uint32(21600), false, bytes32(uint256(0xBEEF))
            )
        );
        assertEq(h, 0x6efc66ef2885839b175f24716f1b25436f7a027dd72f76fb15d642324ae8b66d);
    }
}
