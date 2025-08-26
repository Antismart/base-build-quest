// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Web3 Quest Board
/// @notice Minimal quest board for Base Builder Quest 9
/// @dev Stores offchain metadata CIDs, emits events for submissions, and escrows prize funds
contract QuestBoard {
    /// ---------------------------------------------------------------------
    /// Errors
    /// ---------------------------------------------------------------------
    error NotCreator();
    error InvalidDeadline();
    
    error QuestNotActive();
    error QuestAlreadyFinalized();
    error AlreadySubmitted();
    error NoWinners();
    error TransferFailed();

    /// ---------------------------------------------------------------------
    /// Reentrancy Guard (minimal)
    /// ---------------------------------------------------------------------
    uint256 private _status;
    modifier nonReentrant() {
        require(_status != 2, "REENTRANCY");
        _status = 2;
        _;
        _status = 1;
    }

    constructor() {
        _status = 1;
    }

    /// ---------------------------------------------------------------------
    /// Types
    /// ---------------------------------------------------------------------
    struct Quest {
        address creator;
        string cid; // IPFS CID for quest metadata
        uint256 prize; // total escrowed prize (wei)
        uint64 deadline; // unix seconds
        bool cancelled;
        bool finalized;
        uint32 participantsCount;
        address[] winners;
    }

    /// questId => submitter => submitted?
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;

    /// All quests (1-based id for convenience in UIs if desired)
    mapping(uint256 => Quest) private _quests;
    uint256 public questCount;

    /// ---------------------------------------------------------------------
    /// Events
    /// ---------------------------------------------------------------------
    event QuestCreated(
        uint256 indexed questId,
        address indexed creator,
        string cid,
        uint256 prize,
        uint64 deadline
    );
    event QuestCancelled(uint256 indexed questId);
    event SubmissionCreated(
        uint256 indexed questId,
        address indexed submitter,
        string submissionCid
    );
    event WinnersSelected(
        uint256 indexed questId,
        address[] winners,
        uint256 payoutPerWinner
    );

    /// ---------------------------------------------------------------------
    /// Create / Read
    /// ---------------------------------------------------------------------
    function createQuest(string calldata cid, uint64 deadline) external payable returns (uint256 questId) {
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (msg.value == 0) revert NoWinners(); // reuse as invalid prize

        unchecked { questId = ++questCount; }

        Quest storage q = _quests[questId];
        q.creator = msg.sender;
        q.cid = cid;
        q.prize = msg.value;
        q.deadline = deadline;

        emit QuestCreated(questId, msg.sender, cid, msg.value, deadline);
    }

    function getQuest(uint256 questId)
        external
        view
        returns (
            address creator,
            string memory cid,
            uint256 prize,
            uint64 deadline,
            bool cancelled,
            bool finalized,
            uint32 participantsCount,
            address[] memory winners
        )
    {
        Quest storage q = _quests[questId];
        return (
            q.creator,
            q.cid,
            q.prize,
            q.deadline,
            q.cancelled,
            q.finalized,
            q.participantsCount,
            q.winners
        );
    }

    /// ---------------------------------------------------------------------
    /// Submissions
    /// ---------------------------------------------------------------------
    function submit(uint256 questId, string calldata submissionCid) external {
        Quest storage q = _quests[questId];
        if (q.creator == address(0) || q.cancelled || block.timestamp > q.deadline) revert QuestNotActive();
        if (q.finalized) revert QuestAlreadyFinalized();
        if (hasSubmitted[questId][msg.sender]) revert AlreadySubmitted();

        hasSubmitted[questId][msg.sender] = true;
        unchecked { q.participantsCount += 1; }

        emit SubmissionCreated(questId, msg.sender, submissionCid);
    }

    /// ---------------------------------------------------------------------
    /// Admin (creator) actions
    /// ---------------------------------------------------------------------
    function cancelQuest(uint256 questId) external nonReentrant {
        Quest storage q = _quests[questId];
        if (msg.sender != q.creator) revert NotCreator();
        if (q.cancelled || q.finalized) revert QuestAlreadyFinalized();
        // allow cancel before deadline only
        if (block.timestamp >= q.deadline) revert QuestAlreadyFinalized();

        q.cancelled = true;
        uint256 amount = q.prize;
        q.prize = 0;

        (bool ok, ) = q.creator.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit QuestCancelled(questId);
    }

    function selectWinners(uint256 questId, address[] calldata winners_) external nonReentrant {
        Quest storage q = _quests[questId];
        if (msg.sender != q.creator) revert NotCreator();
        if (q.cancelled || q.finalized) revert QuestAlreadyFinalized();
        // after deadline only
        if (block.timestamp <= q.deadline) revert InvalidDeadline();
        if (winners_.length == 0) revert NoWinners();

        q.finalized = true;
        // store winners
        q.winners = winners_;

        uint256 total = q.prize;
        q.prize = 0;
        uint256 per = total / winners_.length;
        uint256 len = winners_.length;
        for (uint256 i = 0; i < len; ) {
            (bool ok, ) = winners_[i].call{value: per}("");
            if (!ok) revert TransferFailed();
            unchecked { i++; }
        }

        emit WinnersSelected(questId, winners_, per);
    }
}
