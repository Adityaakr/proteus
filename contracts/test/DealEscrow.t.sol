// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DealEscrow} from "../src/DealEscrow.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract DealEscrowTest is Test {
    DealEscrow escrow;
    MockUSDC usdc;

    uint256 buyerPk = 0xB0B;
    uint256 sellerPk = 0x5E11;
    uint256 strangerPk = 0x5713;
    address buyer;
    address seller;
    address payee = address(0xBEEF);
    address owner = address(0x0A11CE);
    address arbiter = address(0xA1B1);

    uint256 constant PREPAID = 1_440_000_000; // $1,440 in micro-USDC
    uint64 start;
    uint64 end;
    uint64 grace = 3 days;

    function setUp() public {
        buyer = vm.addr(buyerPk);
        seller = vm.addr(sellerPk);
        usdc = new MockUSDC();
        escrow = new DealEscrow(address(usdc), owner, arbiter);
        usdc.mint(buyer, 10_000_000_000);
        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);
        start = uint64(block.timestamp);
        end = start + 30 days;
    }

    /* ----------------------------- helpers ----------------------------- */

    function terms(uint256 dealId) internal view returns (DealEscrow.Terms memory t) {
        t = DealEscrow.Terms({
            dealId: dealId,
            buyer: buyer,
            seller: seller,
            payee: payee,
            usdc: address(usdc),
            productId: keccak256("order-support"),
            unitNum: 960_000,
            unitDen: 1,
            maxUnits: 1500,
            prepaid: PREPAID,
            start: start,
            end: end,
            grace: grace,
            publicTermsHash: keccak256("public terms"),
            nonce: 1,
            expiry: uint64(block.timestamp + 1 hours)
        });
    }

    function sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function fund(uint256 dealId) internal returns (DealEscrow.Terms memory t) {
        t = terms(dealId);
        bytes32 digest = escrow.hashTerms(t);
        escrow.createAndFundDeal(t, sign(buyerPk, digest), sign(sellerPk, digest));
    }

    function acceptance(uint256 dealId, uint256 amount, uint256 units, uint256 nonce) internal view returns (DealEscrow.Acceptance memory a, DealEscrow.Delivery memory d) {
        DealEscrow.Deal memory deal = escrow.getDeal(dealId);
        bytes32 root = keccak256(abi.encode("receipts", nonce));
        a = DealEscrow.Acceptance({dealId: dealId, termsHash: deal.termsHash, cumulativeAmount: amount, cumulativeUnits: units, receiptsRoot: root, nonce: nonce, expiry: uint64(block.timestamp + 1 hours)});
        d = DealEscrow.Delivery({dealId: dealId, receiptsRoot: root, cumulativeUnits: units});
    }

    function settle(uint256 dealId, uint256 amount, uint256 units, uint256 nonce) internal {
        (DealEscrow.Acceptance memory a, DealEscrow.Delivery memory d) = acceptance(dealId, amount, units, nonce);
        escrow.settleAcceptedUsage(dealId, a, sign(buyerPk, escrow.hashAcceptance(a)), d, sign(sellerPk, escrow.hashDelivery(d)));
    }

    /* ----------------------------- funding ----------------------------- */

    function test_fund_happyPath() public {
        fund(1);
        (uint256 dep, uint256 set, uint256 ref, uint256 rem) = escrow.balances(1);
        assertEq(dep, PREPAID);
        assertEq(set, 0);
        assertEq(ref, 0);
        assertEq(rem, PREPAID);
        assertEq(usdc.balanceOf(address(escrow)), PREPAID);
        assertEq(uint256(escrow.getDeal(1).status), uint256(DealEscrow.Status.Funded));
    }

    function test_fund_rejectsForgedSellerSignature() public {
        DealEscrow.Terms memory t = terms(1);
        bytes32 digest = escrow.hashTerms(t);
        vm.expectRevert(DealEscrow.BadSignature.selector);
        escrow.createAndFundDeal(t, sign(buyerPk, digest), sign(strangerPk, digest));
    }

    function test_fund_rejectsTamperedPayee() public {
        DealEscrow.Terms memory t = terms(1);
        bytes32 digest = escrow.hashTerms(t);
        bytes memory bs = sign(buyerPk, digest);
        bytes memory ss = sign(sellerPk, digest);
        t.payee = address(0xDEAD); // seller tries to redirect after signing
        vm.expectRevert(DealEscrow.BadSignature.selector);
        escrow.createAndFundDeal(t, bs, ss);
    }

    function test_fund_rejectsReplayAndDuplicateDealId() public {
        DealEscrow.Terms memory t = fund(1);
        bytes32 digest = escrow.hashTerms(t);
        vm.expectRevert(DealEscrow.WrongStatus.selector);
        escrow.createAndFundDeal(t, sign(buyerPk, digest), sign(sellerPk, digest));
    }

    function test_fund_rejectsExpiredTerms() public {
        DealEscrow.Terms memory t = terms(1);
        t.expiry = uint64(block.timestamp - 1);
        bytes32 digest = escrow.hashTerms(t);
        vm.expectRevert(DealEscrow.Expired.selector);
        escrow.createAndFundDeal(t, sign(buyerPk, digest), sign(sellerPk, digest));
    }

    function test_fund_rejectsWrongUsdc() public {
        DealEscrow.Terms memory t = terms(1);
        t.usdc = address(0x1234);
        bytes32 digest = escrow.hashTerms(t);
        vm.expectRevert(DealEscrow.BadTerms.selector);
        escrow.createAndFundDeal(t, sign(buyerPk, digest), sign(sellerPk, digest));
    }

    function test_fund_signatureDoesNotReplayAcrossContracts() public {
        DealEscrow other = new DealEscrow(address(usdc), owner, arbiter);
        vm.prank(buyer);
        usdc.approve(address(other), type(uint256).max);
        DealEscrow.Terms memory t = terms(1);
        bytes32 digest = escrow.hashTerms(t); // signed for `escrow`, submitted to `other`
        vm.expectRevert(DealEscrow.BadSignature.selector);
        other.createAndFundDeal(t, sign(buyerPk, digest), sign(sellerPk, digest));
    }

    /* ---------------------------- settlement --------------------------- */

    function test_settle_cumulativeIncrements() public {
        fund(1);
        settle(1, 96_000_000, 100, 1); // 100 units
        assertEq(usdc.balanceOf(payee), 96_000_000);
        settle(1, 240_000_000, 250, 2); // cumulative 250 units
        assertEq(usdc.balanceOf(payee), 240_000_000);
        (, uint256 set,, uint256 rem) = escrow.balances(1);
        assertEq(set, 240_000_000);
        assertEq(rem, PREPAID - 240_000_000);
    }

    function test_settle_rejectsNonceReplayAndDecrease() public {
        fund(1);
        settle(1, 96_000_000, 100, 1);
        (DealEscrow.Acceptance memory a, DealEscrow.Delivery memory d) = acceptance(1, 96_000_000, 100, 1);
        bytes memory bs1 = sign(buyerPk, escrow.hashAcceptance(a));
        bytes memory ss1 = sign(sellerPk, escrow.hashDelivery(d));
        vm.expectRevert(DealEscrow.NonceNotIncreasing.selector);
        escrow.settleAcceptedUsage(1, a, bs1, d, ss1);
        (a, d) = acceptance(1, 50_000_000, 50, 2);
        bytes memory bs2 = sign(buyerPk, escrow.hashAcceptance(a));
        bytes memory ss2 = sign(sellerPk, escrow.hashDelivery(d));
        vm.expectRevert(DealEscrow.AmountOutOfRange.selector);
        escrow.settleAcceptedUsage(1, a, bs2, d, ss2);
    }

    function test_settle_rejectsOverDeposit() public {
        fund(1);
        (DealEscrow.Acceptance memory a, DealEscrow.Delivery memory d) = acceptance(1, PREPAID + 1, 1500, 1);
        bytes memory bs3 = sign(buyerPk, escrow.hashAcceptance(a));
        bytes memory ss3 = sign(sellerPk, escrow.hashDelivery(d));
        vm.expectRevert(DealEscrow.AmountOutOfRange.selector);
        escrow.settleAcceptedUsage(1, a, bs3, d, ss3);
    }

    function test_settle_rejectsOverMaxUnits() public {
        fund(1);
        (DealEscrow.Acceptance memory a, DealEscrow.Delivery memory d) = acceptance(1, 100, 1501, 1);
        bytes memory bs4 = sign(buyerPk, escrow.hashAcceptance(a));
        bytes memory ss4 = sign(sellerPk, escrow.hashDelivery(d));
        vm.expectRevert(DealEscrow.UnitsOutOfRange.selector);
        escrow.settleAcceptedUsage(1, a, bs4, d, ss4);
    }

    function test_settle_rejectsSellerOnlyForgedAcceptance() public {
        fund(1);
        (DealEscrow.Acceptance memory a, DealEscrow.Delivery memory d) = acceptance(1, PREPAID, 1500, 1);
        // compromised agent/seller signs both sides
        bytes memory bs5 = sign(sellerPk, escrow.hashAcceptance(a));
        bytes memory ss5 = sign(sellerPk, escrow.hashDelivery(d));
        vm.expectRevert(DealEscrow.BadSignature.selector);
        escrow.settleAcceptedUsage(1, a, bs5, d, ss5);
    }

    function test_settle_rejectsMismatchedDelivery() public {
        fund(1);
        (DealEscrow.Acceptance memory a, DealEscrow.Delivery memory d) = acceptance(1, 96_000_000, 100, 1);
        d.cumulativeUnits = 101;
        bytes memory bs6 = sign(buyerPk, escrow.hashAcceptance(a));
        bytes memory ss6 = sign(sellerPk, escrow.hashDelivery(d));
        vm.expectRevert(DealEscrow.TermsMismatch.selector);
        escrow.settleAcceptedUsage(1, a, bs6, d, ss6);
    }

    function test_settle_rejectsExpiredAcceptanceAndAfterGrace() public {
        fund(1);
        (DealEscrow.Acceptance memory a, DealEscrow.Delivery memory d) = acceptance(1, 96_000_000, 100, 1);
        bytes memory bs = sign(buyerPk, escrow.hashAcceptance(a));
        bytes memory ss = sign(sellerPk, escrow.hashDelivery(d));
        vm.warp(a.expiry + 1);
        vm.expectRevert(DealEscrow.Expired.selector);
        escrow.settleAcceptedUsage(1, a, bs, d, ss);
        vm.warp(uint256(end) + uint256(grace) + 1);
        (a, d) = acceptance(1, 96_000_000, 100, 1);
        bytes memory bs7 = sign(buyerPk, escrow.hashAcceptance(a));
        bytes memory ss7 = sign(sellerPk, escrow.hashDelivery(d));
        vm.expectRevert(DealEscrow.Expired.selector);
        escrow.settleAcceptedUsage(1, a, bs7, d, ss7);
    }

    function test_settle_alwaysPaysOriginalPayee() public {
        fund(1);
        settle(1, 96_000_000, 100, 1);
        assertEq(usdc.balanceOf(payee), 96_000_000);
        assertEq(usdc.balanceOf(seller), 0);
        assertEq(escrow.getDeal(1).payee, payee);
    }

    /* ------------------------------ refunds ---------------------------- */

    function test_refund_tooEarlyThenAfterGrace() public {
        fund(1);
        settle(1, 96_000_000, 100, 1);
        vm.expectRevert(DealEscrow.TooEarly.selector);
        escrow.refundUnused(1);
        vm.warp(uint256(end) + uint256(grace));
        uint256 before = usdc.balanceOf(buyer);
        escrow.refundUnused(1);
        assertEq(usdc.balanceOf(buyer), before + PREPAID - 96_000_000);
        (uint256 dep, uint256 set, uint256 ref, uint256 rem) = escrow.balances(1);
        assertEq(dep, set + ref);
        assertEq(rem, 0);
        assertEq(uint256(escrow.getDeal(1).status), uint256(DealEscrow.Status.Closed));
        vm.expectRevert(DealEscrow.WrongStatus.selector);
        escrow.refundUnused(1);
    }

    function test_refund_afterSellerClosesTerm() public {
        fund(1);
        settle(1, 96_000_000, 100, 1);
        vm.prank(seller);
        escrow.sellerCloseTerm(1);
        escrow.refundUnused(1);
        (,,, uint256 rem) = escrow.balances(1);
        assertEq(rem, 0);
    }

    function test_refund_noSettlementAfterClose() public {
        fund(1);
        vm.prank(seller);
        escrow.sellerCloseTerm(1);
        escrow.refundUnused(1);
        (DealEscrow.Acceptance memory a, DealEscrow.Delivery memory d) = acceptance(1, 96_000_000, 100, 1);
        bytes memory bs8 = sign(buyerPk, escrow.hashAcceptance(a));
        bytes memory ss8 = sign(sellerPk, escrow.hashDelivery(d));
        vm.expectRevert(DealEscrow.WrongStatus.selector);
        escrow.settleAcceptedUsage(1, a, bs8, d, ss8);
    }

    function test_refundSettleRace_neverDoublePays() public {
        fund(1);
        vm.warp(uint256(end) + uint256(grace) - 1);
        settle(1, 96_000_000, 100, 1);
        vm.warp(uint256(end) + uint256(grace));
        escrow.refundUnused(1);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(usdc.balanceOf(payee) + (usdc.balanceOf(buyer) - (10_000_000_000 - PREPAID)), PREPAID);
    }

    /* ------------------------------- pause ----------------------------- */

    function test_pause_blocksNewDealsOnly() public {
        fund(1);
        vm.prank(owner);
        escrow.pauseNewDeals();
        DealEscrow.Terms memory t = terms(2);
        bytes32 digest = escrow.hashTerms(t);
        vm.expectRevert();
        escrow.createAndFundDeal(t, sign(buyerPk, digest), sign(sellerPk, digest));
        // settlement and refunds still work
        settle(1, 96_000_000, 100, 1);
        vm.prank(seller);
        escrow.sellerCloseTerm(1);
        escrow.refundUnused(1);
    }

    function test_owner_cannotMoveFunds() public {
        fund(1);
        // There is no sweep/withdraw. Owner's only effect on funds is none; check balances untouched after admin ops.
        vm.startPrank(owner);
        escrow.pauseNewDeals();
        escrow.unpauseNewDeals();
        escrow.setArbiter(address(0xA2));
        vm.stopPrank();
        assertEq(usdc.balanceOf(owner), 0);
        assertEq(usdc.balanceOf(address(escrow)), PREPAID);
    }

    /* ------------------------------ disputes --------------------------- */

    function test_dispute_arbiterSplitsOnlyRemaining() public {
        fund(1);
        settle(1, 96_000_000, 100, 1);
        vm.prank(buyer);
        escrow.openDispute(1, keccak256("quality"));
        (,,, uint256 rem) = escrow.balances(1);
        vm.prank(arbiter);
        vm.expectRevert(DealEscrow.ExceedsRemaining.selector);
        escrow.resolveDispute(1, rem, 1);
        vm.prank(arbiter);
        escrow.resolveDispute(1, rem / 2, rem - rem / 2);
        (uint256 dep, uint256 set, uint256 ref, uint256 rem2) = escrow.balances(1);
        assertEq(rem2, 0);
        assertEq(dep, set + ref);
        assertEq(uint256(escrow.getDeal(1).status), uint256(DealEscrow.Status.Closed));
    }

    function test_dispute_onlyPartiesAndArbiter() public {
        fund(1);
        vm.prank(address(0x999));
        vm.expectRevert(DealEscrow.NotParty.selector);
        escrow.openDispute(1, keccak256("x"));
        vm.prank(buyer);
        escrow.openDispute(1, keccak256("x"));
        vm.prank(owner);
        vm.expectRevert(DealEscrow.NotArbiter.selector);
        escrow.resolveDispute(1, 0, 0);
    }

    /* ------------------------------ fuzz ------------------------------- */

    function testFuzz_settleNeverExceedsDeposit(uint256 a1, uint256 a2) public {
        fund(1);
        a1 = bound(a1, 0, PREPAID);
        a2 = bound(a2, a1, PREPAID);
        settle(1, a1, 10, 1);
        settle(1, a2, 20, 2);
        (uint256 dep, uint256 set,, uint256 rem) = escrow.balances(1);
        assertEq(set, a2);
        assertEq(dep, set + rem);
        assertEq(usdc.balanceOf(payee), a2);
    }
}
