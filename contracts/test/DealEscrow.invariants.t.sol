// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DealEscrow} from "../src/DealEscrow.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @dev Handler drives random funding, settlement, closing and refunds across several deals.
contract Handler is Test {
    DealEscrow public escrow;
    MockUSDC public usdc;
    uint256 constant BUYER_PK = 0xB0B;
    uint256 constant SELLER_PK = 0x5E11;
    address public buyer;
    address public seller;
    address public payee = address(0xBEEF);

    uint256 public nextDeal = 1;
    uint256[] public dealIds;
    mapping(uint256 => uint256) public nonces;
    uint256 public totalFunded;
    uint256 public totalPaid;
    uint256 public totalRefunded;

    constructor(DealEscrow e, MockUSDC u) {
        escrow = e;
        usdc = u;
        buyer = vm.addr(BUYER_PK);
        seller = vm.addr(SELLER_PK);
        usdc.mint(buyer, type(uint128).max);
        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function fundDeal(uint256 prepaid, uint64 term) external {
        prepaid = bound(prepaid, 1, 1_000_000_000_000);
        term = uint64(bound(term, 1 hours, 90 days));
        uint256 id = nextDeal++;
        DealEscrow.Terms memory t = DealEscrow.Terms({
            dealId: id,
            buyer: buyer,
            seller: seller,
            payee: payee,
            usdc: address(usdc),
            productId: keccak256("p"),
            unitNum: 1,
            unitDen: 1,
            maxUnits: type(uint128).max,
            prepaid: prepaid,
            start: uint64(block.timestamp),
            end: uint64(block.timestamp) + term,
            grace: 1 days,
            publicTermsHash: bytes32(id),
            nonce: id,
            expiry: uint64(block.timestamp + 1 hours)
        });
        bytes32 digest = escrow.hashTerms(t);
        escrow.createAndFundDeal(t, sign(BUYER_PK, digest), sign(SELLER_PK, digest));
        dealIds.push(id);
        totalFunded += prepaid;
    }

    function settle(uint256 idx, uint256 amount) external {
        if (dealIds.length == 0) return;
        uint256 id = dealIds[idx % dealIds.length];
        DealEscrow.Deal memory d = escrow.getDeal(id);
        if (d.status != DealEscrow.Status.Funded) return;
        if (block.timestamp > uint256(d.end) + uint256(d.grace)) return;
        amount = bound(amount, d.settled, d.deposit);
        uint256 nonce = ++nonces[id];
        bytes32 root = keccak256(abi.encode(id, nonce));
        DealEscrow.Acceptance memory a = DealEscrow.Acceptance({dealId: id, termsHash: d.termsHash, cumulativeAmount: amount, cumulativeUnits: amount, receiptsRoot: root, nonce: nonce, expiry: uint64(block.timestamp + 1 hours)});
        DealEscrow.Delivery memory del = DealEscrow.Delivery({dealId: id, receiptsRoot: root, cumulativeUnits: amount});
        uint256 before = usdc.balanceOf(payee);
        escrow.settleAcceptedUsage(id, a, sign(BUYER_PK, escrow.hashAcceptance(a)), del, sign(SELLER_PK, escrow.hashDelivery(del)));
        totalPaid += usdc.balanceOf(payee) - before;
    }

    function closeAndRefund(uint256 idx) external {
        if (dealIds.length == 0) return;
        uint256 id = dealIds[idx % dealIds.length];
        DealEscrow.Deal memory d = escrow.getDeal(id);
        if (d.status != DealEscrow.Status.Funded) return;
        vm.prank(seller);
        escrow.sellerCloseTerm(id);
        if (d.deposit - d.settled - d.refunded == 0) return;
        uint256 before = usdc.balanceOf(buyer);
        escrow.refundUnused(id);
        totalRefunded += usdc.balanceOf(buyer) - before;
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 0, 10 days));
    }

    function dealCount() external view returns (uint256) {
        return dealIds.length;
    }
}

contract DealEscrowInvariants is Test {
    DealEscrow escrow;
    MockUSDC usdc;
    Handler handler;
    address owner = address(0x0A11CE);

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new DealEscrow(address(usdc), owner, address(0xA1B1));
        handler = new Handler(escrow, usdc);
        targetContract(address(handler));
    }

    /// funded == paid + refunded + escrow balance, across all deals.
    function invariant_conservation() public view {
        assertEq(handler.totalFunded(), handler.totalPaid() + handler.totalRefunded() + usdc.balanceOf(address(escrow)));
    }

    /// Per deal: deposit == settled + refunded + remaining, and nothing negative.
    function invariant_perDealAccounting() public view {
        uint256 n = handler.dealCount();
        uint256 sumRemaining;
        for (uint256 i = 0; i < n; i++) {
            uint256 id = handler.dealIds(i);
            (uint256 dep, uint256 set, uint256 ref, uint256 rem) = escrow.balances(id);
            assertEq(dep, set + ref + rem);
            assertLe(set + ref, dep);
            sumRemaining += rem;
            assertEq(escrow.getDeal(id).payee, handler.payee());
        }
        assertEq(sumRemaining, usdc.balanceOf(address(escrow)));
    }

    /// Owner never accumulates funds.
    function invariant_ownerHoldsNothing() public view {
        assertEq(usdc.balanceOf(owner), 0);
    }
}
