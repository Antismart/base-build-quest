// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {QuestBoard} from "../src/QuestBoard.sol";

contract QuestBoardTest is Test {
    QuestBoard qb;
    address creator = address(0xBEEF);
    address user1 = address(0xA11CE);
    address user2 = address(0xB0B);

    function setUp() public {
        qb = new QuestBoard();
    }

    function testCreateSubmitAndSelectWinners() public {
        vm.startPrank(creator);
        uint64 deadline = uint64(block.timestamp + 1 days);
        uint256 questId = qb.createQuest{value: 1 ether}("ipfs://quest", deadline);
        vm.stopPrank();

        vm.startPrank(user1);
        qb.submit(questId, "ipfs://sub1");
        vm.stopPrank();

        vm.startPrank(user2);
        qb.submit(questId, "ipfs://sub2");
        vm.stopPrank();

        vm.warp(block.timestamp + 2 days);

        vm.deal(address(qb), 0); // ensure contract balance relied on prize only

        vm.prank(creator);
        address[] memory winners = new address[](2);
        winners[0] = user1;
        winners[1] = user2;
        qb.selectWinners(questId, winners);

        // No state assertions beyond events because payouts happen; check balances
        // Each winner should have received 0.5 ether.
        assertEq(user1.balance, 0.5 ether);
        assertEq(user2.balance, 0.5 ether);
    }
}
