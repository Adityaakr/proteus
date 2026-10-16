// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title DealEscrow
 * @notice One vault, many deals. A buyer prepays USDC (ERC-20 interface, 6 decimals) against terms that
 *         both buyer and seller signed (EIP-712). The seller is paid only for usage the buyer countersigned
 *         (cumulative, monotonic, capped by the deposit) together with a seller-signed delivery digest.
 *         After the term plus a grace window, anyone can trigger the refund of the unused balance to the buyer.
 *
 *         Trust assumptions (also documented in docs/settlement-model.md):
 *          - The contract verifies signatures and arithmetic, not service quality. Quality disputes go to
 *            the arbiter path, which can only split the remaining balance between the two parties.
 *          - The owner can pause NEW deals only. The owner cannot move funds. There is no sweep function.
 *          - The payee is fixed in the signed terms and cannot change afterwards.
 *
 *         Money is always the 6-decimal ERC-20 USDC amount. `msg.value` (18-decimal native USDC on Arc) is never used.
 */
contract DealEscrow is EIP712, ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    /* ---------------------------------------------------------------- */
    /* Types                                                              */
    /* ---------------------------------------------------------------- */

    struct Terms {
        uint256 dealId;
        address buyer;
        address seller;
        address payee;
        address usdc;
        bytes32 productId;
        uint256 unitNum;
        uint256 unitDen;
        uint256 maxUnits;
        uint256 prepaid;
        uint64 start;
        uint64 end;
        uint64 grace;
        bytes32 publicTermsHash;
        uint256 nonce;
        uint64 expiry;
    }

    struct Acceptance {
        uint256 dealId;
        bytes32 termsHash;
        uint256 cumulativeAmount;
        uint256 cumulativeUnits;
        bytes32 receiptsRoot;
        uint256 nonce;
        uint64 expiry;
    }

    struct Delivery {
        uint256 dealId;
        bytes32 receiptsRoot;
        uint256 cumulativeUnits;
    }

    enum Status {
        None,
        Funded,
        Disputed,
        Closed
    }

    struct Deal {
        address buyer;
        address seller;
        address payee;
        bytes32 termsHash;
        uint256 deposit;
        uint256 settled;
        uint256 refunded;
        uint256 acceptedNonce;
        uint256 acceptedUnits;
        uint256 maxUnits;
        uint64 end;
        uint64 grace;
        bool sellerClosed;
        Status status;
    }

    bytes32 public constant TERMS_TYPEHASH = keccak256(
        "Terms(uint256 dealId,address buyer,address seller,address payee,address usdc,bytes32 productId,uint256 unitNum,uint256 unitDen,uint256 maxUnits,uint256 prepaid,uint64 start,uint64 end,uint64 grace,bytes32 publicTermsHash,uint256 nonce,uint64 expiry)"
    );
    bytes32 public constant ACCEPTANCE_TYPEHASH = keccak256(
        "Acceptance(uint256 dealId,bytes32 termsHash,uint256 cumulativeAmount,uint256 cumulativeUnits,bytes32 receiptsRoot,uint256 nonce,uint64 expiry)"
    );
    bytes32 public constant DELIVERY_TYPEHASH = keccak256("Delivery(uint256 dealId,bytes32 receiptsRoot,uint256 cumulativeUnits)");

    IERC20 public immutable USDC;
    address public arbiter;

    mapping(uint256 => Deal) private _deals;
    mapping(bytes32 => bool) public usedTermsDigest;

    /* ---------------------------------------------------------------- */
    /* Events                                                             */
    /* ---------------------------------------------------------------- */

    event DealFunded(uint256 indexed dealId, address indexed buyer, address indexed seller, address payee, uint256 deposit, bytes32 termsHash, uint64 end, uint64 grace);
    event UsageAccepted(uint256 indexed dealId, uint256 cumulativeAmount, uint256 cumulativeUnits, bytes32 receiptsRoot, uint256 nonce);
    event SellerSettled(uint256 indexed dealId, address indexed payee, uint256 amount, uint256 totalSettled);
    event DisputeOpened(uint256 indexed dealId, address indexed by, bytes32 reasonHash);
    event DisputeResolved(uint256 indexed dealId, uint256 toSeller, uint256 toBuyer);
    event SellerClosedTerm(uint256 indexed dealId);
    event RefundIssued(uint256 indexed dealId, address indexed buyer, uint256 amount);
    event DealClosed(uint256 indexed dealId);
    event ArbiterChanged(address indexed previous, address indexed current);

    /* ---------------------------------------------------------------- */
    /* Errors                                                             */
    /* ---------------------------------------------------------------- */

    error BadTerms();
    error Expired();
    error WrongStatus();
    error BadSignature();
    error Replay();
    error NonceNotIncreasing();
    error AmountOutOfRange();
    error UnitsOutOfRange();
    error TermsMismatch();
    error NotParty();
    error TooEarly();
    error NotArbiter();
    error ExceedsRemaining();
    error NothingToRefund();

    constructor(address usdc, address initialOwner, address initialArbiter) EIP712("ProteusDealEscrow", "1") Ownable(initialOwner) {
        if (usdc == address(0) || initialArbiter == address(0)) revert BadTerms();
        USDC = IERC20(usdc);
        arbiter = initialArbiter;
    }

    /* ---------------------------------------------------------------- */
    /* Views                                                              */
    /* ---------------------------------------------------------------- */

    function getDeal(uint256 dealId) external view returns (Deal memory) {
        return _deals[dealId];
    }

    function balances(uint256 dealId) public view returns (uint256 deposit, uint256 settled, uint256 refunded, uint256 remaining) {
        Deal storage d = _deals[dealId];
        deposit = d.deposit;
        settled = d.settled;
        refunded = d.refunded;
        remaining = deposit - settled - refunded;
    }

    function hashTerms(Terms calldata t) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(TERMS_TYPEHASH, t.dealId, t.buyer, t.seller, t.payee, t.usdc, t.productId, t.unitNum, t.unitDen, t.maxUnits, t.prepaid, t.start, t.end, t.grace, t.publicTermsHash, t.nonce, t.expiry)));
    }

    function hashAcceptance(Acceptance calldata a) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(ACCEPTANCE_TYPEHASH, a.dealId, a.termsHash, a.cumulativeAmount, a.cumulativeUnits, a.receiptsRoot, a.nonce, a.expiry)));
    }

    function hashDelivery(Delivery calldata d) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(DELIVERY_TYPEHASH, d.dealId, d.receiptsRoot, d.cumulativeUnits)));
    }

    function refundableAt(uint256 dealId) public view returns (uint256) {
        Deal storage d = _deals[dealId];
        if (d.sellerClosed) return block.timestamp;
        return uint256(d.end) + uint256(d.grace);
    }

    /* ---------------------------------------------------------------- */
    /* Funding                                                            */
    /* ---------------------------------------------------------------- */

    /**
     * @notice Create and fund a deal from identical terms signed by buyer and seller.
     *         Pulls `prepaid` ERC-20 USDC from the buyer (buyer must have approved this contract).
     *         Callable by anyone (buyer, seller, or a relayer); the signatures carry the authority.
     */
    function createAndFundDeal(Terms calldata t, bytes calldata buyerSig, bytes calldata sellerSig) external whenNotPaused nonReentrant {
        if (t.usdc != address(USDC)) revert BadTerms();
        if (t.buyer == address(0) || t.seller == address(0) || t.payee == address(0)) revert BadTerms();
        if (t.prepaid == 0 || t.unitDen == 0 || t.maxUnits == 0 || t.end <= t.start) revert BadTerms();
        if (block.timestamp > t.expiry) revert Expired();
        if (_deals[t.dealId].status != Status.None) revert WrongStatus();

        bytes32 digest = hashTerms(t);
        if (usedTermsDigest[digest]) revert Replay();
        usedTermsDigest[digest] = true;

        if (!SignatureChecker.isValidSignatureNow(t.buyer, digest, buyerSig)) revert BadSignature();
        if (!SignatureChecker.isValidSignatureNow(t.seller, digest, sellerSig)) revert BadSignature();

        _deals[t.dealId] = Deal({
            buyer: t.buyer,
            seller: t.seller,
            payee: t.payee,
            termsHash: digest,
            deposit: t.prepaid,
            settled: 0,
            refunded: 0,
            acceptedNonce: 0,
            acceptedUnits: 0,
            maxUnits: t.maxUnits,
            end: t.end,
            grace: t.grace,
            sellerClosed: false,
            status: Status.Funded
        });

        USDC.safeTransferFrom(t.buyer, address(this), t.prepaid);
        emit DealFunded(t.dealId, t.buyer, t.seller, t.payee, t.prepaid, digest, t.end, t.grace);
    }

    /* ---------------------------------------------------------------- */
    /* Settlement                                                         */
    /* ---------------------------------------------------------------- */

    /**
     * @notice Settle the increment between the buyer-accepted cumulative amount and what was already settled.
     *         Requires the buyer's signature over Acceptance and the seller's over Delivery with matching
     *         receipts root and units. Settlement is not pausable so a paused platform cannot starve a seller.
     */
    function settleAcceptedUsage(uint256 dealId, Acceptance calldata a, bytes calldata buyerSig, Delivery calldata d, bytes calldata sellerSig) external nonReentrant {
        Deal storage deal = _deals[dealId];
        if (deal.status != Status.Funded) revert WrongStatus();
        if (a.dealId != dealId || d.dealId != dealId) revert TermsMismatch();
        if (a.termsHash != deal.termsHash) revert TermsMismatch();
        if (d.receiptsRoot != a.receiptsRoot || d.cumulativeUnits != a.cumulativeUnits) revert TermsMismatch();
        if (block.timestamp > a.expiry) revert Expired();
        if (block.timestamp > uint256(deal.end) + uint256(deal.grace)) revert Expired();
        if (a.nonce <= deal.acceptedNonce) revert NonceNotIncreasing();
        if (a.cumulativeAmount < deal.settled || a.cumulativeAmount > deal.deposit) revert AmountOutOfRange();
        if (a.cumulativeUnits < deal.acceptedUnits || a.cumulativeUnits > deal.maxUnits) revert UnitsOutOfRange();

        if (!SignatureChecker.isValidSignatureNow(deal.buyer, hashAcceptance(a), buyerSig)) revert BadSignature();
        if (!SignatureChecker.isValidSignatureNow(deal.seller, hashDelivery(d), sellerSig)) revert BadSignature();

        uint256 payout = a.cumulativeAmount - deal.settled;
        deal.settled = a.cumulativeAmount;
        deal.acceptedNonce = a.nonce;
        deal.acceptedUnits = a.cumulativeUnits;

        emit UsageAccepted(dealId, a.cumulativeAmount, a.cumulativeUnits, a.receiptsRoot, a.nonce);
        if (payout > 0) {
            USDC.safeTransfer(deal.payee, payout);
            emit SellerSettled(dealId, deal.payee, payout, deal.settled);
        }
    }

    /// @notice Seller voluntarily ends the term early, making the unused balance refundable immediately.
    function sellerCloseTerm(uint256 dealId) external {
        Deal storage deal = _deals[dealId];
        if (deal.status != Status.Funded) revert WrongStatus();
        if (msg.sender != deal.seller) revert NotParty();
        deal.sellerClosed = true;
        emit SellerClosedTerm(dealId);
    }

    /**
     * @notice Refund the unused balance to the buyer after end + grace (or once the seller closed the term).
     *         Not pausable: a paused platform must still let buyers recover unused funds.
     */
    function refundUnused(uint256 dealId) external nonReentrant {
        Deal storage deal = _deals[dealId];
        if (deal.status != Status.Funded) revert WrongStatus();
        if (block.timestamp < refundableAt(dealId)) revert TooEarly();
        uint256 remaining = deal.deposit - deal.settled - deal.refunded;
        if (remaining == 0) revert NothingToRefund();
        deal.refunded += remaining;
        deal.status = Status.Closed;
        USDC.safeTransfer(deal.buyer, remaining);
        emit RefundIssued(dealId, deal.buyer, remaining);
        emit DealClosed(dealId);
    }

    /* ---------------------------------------------------------------- */
    /* Disputes                                                           */
    /* ---------------------------------------------------------------- */

    function openDispute(uint256 dealId, bytes32 reasonHash) external {
        Deal storage deal = _deals[dealId];
        if (deal.status != Status.Funded) revert WrongStatus();
        if (msg.sender != deal.buyer && msg.sender != deal.seller) revert NotParty();
        deal.status = Status.Disputed;
        emit DisputeOpened(dealId, msg.sender, reasonHash);
    }

    /// @notice The arbiter can only split the remaining balance between the two parties of the deal.
    function resolveDispute(uint256 dealId, uint256 toSeller, uint256 toBuyer) external nonReentrant {
        if (msg.sender != arbiter) revert NotArbiter();
        Deal storage deal = _deals[dealId];
        if (deal.status != Status.Disputed) revert WrongStatus();
        uint256 remaining = deal.deposit - deal.settled - deal.refunded;
        if (toSeller + toBuyer > remaining) revert ExceedsRemaining();
        deal.settled += toSeller;
        deal.refunded += toBuyer;
        deal.status = (deal.deposit - deal.settled - deal.refunded == 0) ? Status.Closed : Status.Funded;
        if (toSeller > 0) USDC.safeTransfer(deal.payee, toSeller);
        if (toBuyer > 0) USDC.safeTransfer(deal.buyer, toBuyer);
        emit DisputeResolved(dealId, toSeller, toBuyer);
        if (deal.status == Status.Closed) emit DealClosed(dealId);
    }

    /* ---------------------------------------------------------------- */
    /* Admin (no fund access)                                             */
    /* ---------------------------------------------------------------- */

    function pauseNewDeals() external onlyOwner {
        _pause();
    }

    function unpauseNewDeals() external onlyOwner {
        _unpause();
    }

    function setArbiter(address next) external onlyOwner {
        if (next == address(0)) revert BadTerms();
        emit ArbiterChanged(arbiter, next);
        arbiter = next;
    }
}
