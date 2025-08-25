// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {QuestBoard} from "../src/QuestBoard.sol";

contract DeployQuestBoard is Script {
    function run() external returns (QuestBoard qb) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        qb = new QuestBoard();
        vm.stopBroadcast();
    }
}
