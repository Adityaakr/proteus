// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @notice The parts of the ERC-8004 IdentityRegistry (v2.0.0) this contract reads. Nothing here writes to it.
interface IERC8004Identity {
    function ownerOf(uint256 agentId) external view returns (address);
    function isAuthorizedOrOwner(address spender, uint256 agentId) external view returns (bool);
    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory);
}

/**
 * @title ProteusPolicyRegistry
 * @notice Append-only, on-chain log of each seller's pricing-policy commitments, keyed by the seller's ERC-8004 agent.
 *
 *         Every Proteus AI deal is quoted under one version of a seller's policy (margin floor, maximum discount, tiers,
 *         capacity). The policy itself stays private: what is recorded here is a salted commitment to it. The deal's
 *         signed Terms carry `publicTermsHash`, whose preimage names `{sellerAgentId, productId, policyVersion,
 *         policyCommit}`, so a third party can check that a funded deal points at a commitment that existed on chain
 *         before the deal was funded.
 *
 *         Authority comes from ERC-8004, not from this contract:
 *          - the agent's owner (or an operator the owner approved) may commit directly, or
 *          - anyone may submit a commitment signed (EIP-712) by the address the owner published under the agent's
 *            `proteus.signer` metadata key. This lets a relayer pay the gas while the seller's signer authorizes.
 *
 *         Properties (each enforced below and covered by test/ProteusPolicyRegistry.t.sol):
 *          - Commitments are immutable once written; there is no update or delete.
 *          - Versions per (agentId, productId) strictly increase.
 *          - A signature is valid for one exact (agentId, productId, version, commitment) before its deadline, and
 *            cannot be replayed on another chain or another registry deployment (EIP-712 domain).
 *          - There is no owner, no admin, no pause and no upgrade path. The contract holds no funds.
 *
 *         What it does NOT prove: that the off-chain pricing engine obeyed the committed policy. It proves which policy
 *         version the seller committed to, and when (non-repudiation).
 */
contract ProteusPolicyRegistry is EIP712 {
    /// @notice ERC-8004 metadata key under which the seller's owner publishes its delegated Terms signer (20 raw bytes).
    string public constant SIGNER_KEY = "proteus.signer";

    bytes32 public constant POLICY_COMMIT_TYPEHASH =
        keccak256("PolicyCommit(uint256 agentId,bytes32 productId,uint64 version,bytes32 commitment,uint64 deadline)");

    struct Commitment {
        bytes32 commitment;
        uint64 committedAt;
        address authorizedBy;
    }

    /// @notice The ERC-8004 IdentityRegistry on this chain.
    IERC8004Identity public immutable identity;

    /// @dev agentId => productId => version => commitment.
    mapping(uint256 => mapping(bytes32 => mapping(uint64 => Commitment))) private _commitments;
    /// @dev agentId => productId => latest committed version (0 = none).
    mapping(uint256 => mapping(bytes32 => uint64)) public latestVersion;

    event PolicyCommitted(uint256 indexed agentId, bytes32 indexed productId, uint64 indexed version, bytes32 commitment, address authorizedBy);

    error NotAuthorized();
    error VersionNotIncreasing(uint64 latest, uint64 given);
    error EmptyCommitment();
    error SignatureExpired();
    error BadSignature();
    error NoSignerPublished();

    constructor(IERC8004Identity identity_) EIP712("ProteusPolicyRegistry", "1") {
        identity = identity_;
    }

    /// @notice Commit directly, as the agent's owner or an operator the owner approved in the IdentityRegistry.
    function commit(uint256 agentId, bytes32 productId, uint64 version, bytes32 commitment) external {
        if (!identity.isAuthorizedOrOwner(msg.sender, agentId) && msg.sender != publishedSigner(agentId)) revert NotAuthorized();
        _write(agentId, productId, version, commitment, msg.sender);
    }

    /// @notice Commit with an EIP-712 signature from the agent's published `proteus.signer` (EOA or ERC-1271). Anyone may submit.
    function commitBySig(uint256 agentId, bytes32 productId, uint64 version, bytes32 commitment, uint64 deadline, bytes calldata signature) external {
        if (block.timestamp > deadline) revert SignatureExpired();
        address signer = publishedSigner(agentId);
        if (signer == address(0)) revert NoSignerPublished();
        bytes32 digest = commitDigest(agentId, productId, version, commitment, deadline);
        if (!SignatureChecker.isValidSignatureNow(signer, digest, signature)) revert BadSignature();
        _write(agentId, productId, version, commitment, signer);
    }

    /// @notice The EIP-712 digest a `proteus.signer` signs for `commitBySig`.
    function commitDigest(uint256 agentId, bytes32 productId, uint64 version, bytes32 commitment, uint64 deadline) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(POLICY_COMMIT_TYPEHASH, agentId, productId, version, commitment, deadline)));
    }

    /// @notice The delegated signer the agent's owner published under `proteus.signer`, or address(0) if none.
    function publishedSigner(uint256 agentId) public view returns (address) {
        bytes memory v = identity.getMetadata(agentId, SIGNER_KEY);
        if (v.length != 20) return address(0);
        return address(bytes20(v));
    }

    /// @notice The commitment for one policy version (zero values if never committed).
    function policyOf(uint256 agentId, bytes32 productId, uint64 version) external view returns (Commitment memory) {
        return _commitments[agentId][productId][version];
    }

    function _write(uint256 agentId, bytes32 productId, uint64 version, bytes32 commitment, address authorizedBy) private {
        if (commitment == bytes32(0)) revert EmptyCommitment();
        uint64 latest = latestVersion[agentId][productId];
        if (version <= latest) revert VersionNotIncreasing(latest, version);
        _commitments[agentId][productId][version] = Commitment(commitment, uint64(block.timestamp), authorizedBy);
        latestVersion[agentId][productId] = version;
        emit PolicyCommitted(agentId, productId, version, commitment, authorizedBy);
    }
}
