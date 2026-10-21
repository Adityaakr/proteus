// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ProteusPolicyRegistry, IERC8004Identity} from "../src/ProteusPolicyRegistry.sol";

/// @dev Minimal stand-in for the ERC-8004 IdentityRegistry (v2.0.0) surface the registry reads.
contract MockIdentity is IERC8004Identity {
    mapping(uint256 => address) public owners;
    mapping(uint256 => mapping(address => bool)) public operators;
    mapping(uint256 => mapping(string => bytes)) public meta;

    function setOwner(uint256 id, address o) external { owners[id] = o; }
    function setOperator(uint256 id, address op, bool on) external { operators[id][op] = on; }
    function setMeta(uint256 id, string calldata k, bytes calldata v) external { meta[id][k] = v; }

    function ownerOf(uint256 id) external view returns (address) { return owners[id]; }
    function isAuthorizedOrOwner(address spender, uint256 id) external view returns (bool) { return spender == owners[id] || operators[id][spender]; }
    function getMetadata(uint256 id, string calldata k) external view returns (bytes memory) { return meta[id][k]; }
}

contract ProteusPolicyRegistryTest is Test {
    MockIdentity id;
    ProteusPolicyRegistry reg;

    uint256 constant AGENT = 42;
    bytes32 constant PRODUCT = keccak256("invoice-processing");
    address owner = makeAddr("owner");
    address relayer = makeAddr("relayer");
    uint256 signerPk = 0xA11CE;
    address signer;

    event PolicyCommitted(uint256 indexed agentId, bytes32 indexed productId, uint64 indexed version, bytes32 commitment, address authorizedBy);

    function setUp() public {
        id = new MockIdentity();
        reg = new ProteusPolicyRegistry(id);
        signer = vm.addr(signerPk);
        id.setOwner(AGENT, owner);
        id.setMeta(AGENT, "proteus.signer", abi.encodePacked(signer));
    }

    function _sig(uint256 pk, uint64 version, bytes32 c, uint64 deadline) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, reg.commitDigest(AGENT, PRODUCT, version, c, deadline));
        return abi.encodePacked(r, s, v);
    }

    function test_ownerCommits() public {
        vm.expectEmit(true, true, true, true);
        emit PolicyCommitted(AGENT, PRODUCT, 1, keccak256("p1"), owner);
        vm.prank(owner);
        reg.commit(AGENT, PRODUCT, 1, keccak256("p1"));
        ProteusPolicyRegistry.Commitment memory c = reg.policyOf(AGENT, PRODUCT, 1);
        assertEq(c.commitment, keccak256("p1"));
        assertEq(c.committedAt, block.timestamp);
        assertEq(c.authorizedBy, owner);
        assertEq(reg.latestVersion(AGENT, PRODUCT), 1);
    }

    function test_approvedOperatorCommits() public {
        address op = makeAddr("op");
        id.setOperator(AGENT, op, true);
        vm.prank(op);
        reg.commit(AGENT, PRODUCT, 1, keccak256("p1"));
        assertEq(reg.latestVersion(AGENT, PRODUCT), 1);
    }

    function test_publishedSignerCommitsDirectly() public {
        vm.prank(signer);
        reg.commit(AGENT, PRODUCT, 1, keccak256("p1"));
        assertEq(reg.policyOf(AGENT, PRODUCT, 1).authorizedBy, signer);
    }

    function test_strangerCannotCommit() public {
        vm.prank(relayer);
        vm.expectRevert(ProteusPolicyRegistry.NotAuthorized.selector);
        reg.commit(AGENT, PRODUCT, 1, keccak256("p1"));
    }

    function test_relayerSubmitsSignerSignature() public {
        uint64 deadline = uint64(block.timestamp + 600);
        bytes memory sig = _sig(signerPk, 1, keccak256("p1"), deadline);
        vm.prank(relayer);
        reg.commitBySig(AGENT, PRODUCT, 1, keccak256("p1"), deadline, sig);
        assertEq(reg.policyOf(AGENT, PRODUCT, 1).authorizedBy, signer);
    }

    function test_signatureFromOtherKeyRejected() public {
        uint64 deadline = uint64(block.timestamp + 600);
        bytes memory sig = _sig(0xB0B, 1, keccak256("p1"), deadline);
        vm.expectRevert(ProteusPolicyRegistry.BadSignature.selector);
        reg.commitBySig(AGENT, PRODUCT, 1, keccak256("p1"), deadline, sig);
    }

    function test_signatureBoundToCommitment() public {
        uint64 deadline = uint64(block.timestamp + 600);
        bytes memory sig = _sig(signerPk, 1, keccak256("p1"), deadline);
        vm.expectRevert(ProteusPolicyRegistry.BadSignature.selector);
        reg.commitBySig(AGENT, PRODUCT, 1, keccak256("tampered"), deadline, sig);
    }

    function test_expiredSignatureRejected() public {
        uint64 deadline = uint64(block.timestamp + 60);
        bytes memory sig = _sig(signerPk, 1, keccak256("p1"), deadline);
        vm.warp(block.timestamp + 61);
        vm.expectRevert(ProteusPolicyRegistry.SignatureExpired.selector);
        reg.commitBySig(AGENT, PRODUCT, 1, keccak256("p1"), deadline, sig);
    }

    function test_replayRejected() public {
        uint64 deadline = uint64(block.timestamp + 600);
        bytes memory sig = _sig(signerPk, 1, keccak256("p1"), deadline);
        reg.commitBySig(AGENT, PRODUCT, 1, keccak256("p1"), deadline, sig);
        vm.expectRevert(abi.encodeWithSelector(ProteusPolicyRegistry.VersionNotIncreasing.selector, uint64(1), uint64(1)));
        reg.commitBySig(AGENT, PRODUCT, 1, keccak256("p1"), deadline, sig);
    }

    function test_rotatedSignerInvalidatesOldKey() public {
        uint64 deadline = uint64(block.timestamp + 600);
        bytes memory sig = _sig(signerPk, 1, keccak256("p1"), deadline);
        id.setMeta(AGENT, "proteus.signer", abi.encodePacked(makeAddr("newSigner")));
        vm.expectRevert(ProteusPolicyRegistry.BadSignature.selector);
        reg.commitBySig(AGENT, PRODUCT, 1, keccak256("p1"), deadline, sig);
    }

    function test_noPublishedSigner() public {
        id.setMeta(AGENT, "proteus.signer", "");
        vm.expectRevert(ProteusPolicyRegistry.NoSignerPublished.selector);
        reg.commitBySig(AGENT, PRODUCT, 1, keccak256("p1"), uint64(block.timestamp + 60), hex"");
    }

    function test_emptyCommitmentRejected() public {
        vm.prank(owner);
        vm.expectRevert(ProteusPolicyRegistry.EmptyCommitment.selector);
        reg.commit(AGENT, PRODUCT, 1, bytes32(0));
    }

    function test_commitmentsImmutableAndVersionsIncrease() public {
        vm.startPrank(owner);
        reg.commit(AGENT, PRODUCT, 1, keccak256("p1"));
        reg.commit(AGENT, PRODUCT, 3, keccak256("p3"));
        vm.expectRevert(abi.encodeWithSelector(ProteusPolicyRegistry.VersionNotIncreasing.selector, uint64(3), uint64(2)));
        reg.commit(AGENT, PRODUCT, 2, keccak256("p2"));
        vm.stopPrank();
        assertEq(reg.policyOf(AGENT, PRODUCT, 1).commitment, keccak256("p1"));
        assertEq(reg.policyOf(AGENT, PRODUCT, 3).commitment, keccak256("p3"));
        assertEq(reg.policyOf(AGENT, PRODUCT, 2).commitment, bytes32(0));
    }

    function test_productsAreIndependent() public {
        vm.startPrank(owner);
        reg.commit(AGENT, PRODUCT, 5, keccak256("a"));
        reg.commit(AGENT, keccak256("other"), 1, keccak256("b"));
        vm.stopPrank();
        assertEq(reg.latestVersion(AGENT, PRODUCT), 5);
        assertEq(reg.latestVersion(AGENT, keccak256("other")), 1);
    }

    /// Versions only ever move forward, whatever order commits are attempted in.
    function testFuzz_versionsMonotonic(uint64[8] memory vs) public {
        uint64 latest;
        vm.startPrank(owner);
        for (uint256 i; i < vs.length; i++) {
            bytes32 c = keccak256(abi.encode(i, vs[i]));
            if (vs[i] > latest) {
                reg.commit(AGENT, PRODUCT, vs[i], c);
                latest = vs[i];
            } else {
                vm.expectRevert(abi.encodeWithSelector(ProteusPolicyRegistry.VersionNotIncreasing.selector, latest, vs[i]));
                reg.commit(AGENT, PRODUCT, vs[i], c);
            }
            assertEq(reg.latestVersion(AGENT, PRODUCT), latest);
        }
        vm.stopPrank();
    }
}
