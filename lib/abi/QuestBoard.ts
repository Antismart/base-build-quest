// ABI for QuestBoard contract deployed to Base networks
// Source: forge create output
export const QUESTBOARD_ABI =  [
    { "type": "constructor", "inputs": [], "stateMutability": "nonpayable" },
    {
      "type": "function",
      "name": "cancelQuest",
      "inputs": [
        { "name": "questId", "type": "uint256", "internalType": "uint256" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "createQuest",
      "inputs": [
        { "name": "cid", "type": "string", "internalType": "string" },
        { "name": "deadline", "type": "uint64", "internalType": "uint64" }
      ],
      "outputs": [
        { "name": "questId", "type": "uint256", "internalType": "uint256" }
      ],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "getQuest",
      "inputs": [
        { "name": "questId", "type": "uint256", "internalType": "uint256" }
      ],
      "outputs": [
        { "name": "creator", "type": "address", "internalType": "address" },
        { "name": "cid", "type": "string", "internalType": "string" },
        { "name": "prize", "type": "uint256", "internalType": "uint256" },
        { "name": "deadline", "type": "uint64", "internalType": "uint64" },
        { "name": "cancelled", "type": "bool", "internalType": "bool" },
        { "name": "finalized", "type": "bool", "internalType": "bool" },
        {
          "name": "participantsCount",
          "type": "uint32",
          "internalType": "uint32"
        },
        { "name": "winners", "type": "address[]", "internalType": "address[]" }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "hasSubmitted",
      "inputs": [
        { "name": "", "type": "uint256", "internalType": "uint256" },
        { "name": "", "type": "address", "internalType": "address" }
      ],
      "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "questCount",
      "inputs": [],
      "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "selectWinners",
      "inputs": [
        { "name": "questId", "type": "uint256", "internalType": "uint256" },
        { "name": "winners_", "type": "address[]", "internalType": "address[]" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "submit",
      "inputs": [
        { "name": "questId", "type": "uint256", "internalType": "uint256" },
        { "name": "submissionCid", "type": "string", "internalType": "string" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "QuestCancelled",
      "inputs": [
        {
          "name": "questId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "QuestCreated",
      "inputs": [
        {
          "name": "questId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "creator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "cid",
          "type": "string",
          "indexed": false,
          "internalType": "string"
        },
        {
          "name": "prize",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "deadline",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "SubmissionCreated",
      "inputs": [
        {
          "name": "questId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "submitter",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "submissionCid",
          "type": "string",
          "indexed": false,
          "internalType": "string"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "WinnersSelected",
      "inputs": [
        {
          "name": "questId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "winners",
          "type": "address[]",
          "indexed": false,
          "internalType": "address[]"
        },
        {
          "name": "payoutPerWinner",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    { "type": "error", "name": "AlreadySubmitted", "inputs": [] },
    { "type": "error", "name": "InvalidDeadline", "inputs": [] },
    { "type": "error", "name": "NoWinners", "inputs": [] },
    { "type": "error", "name": "NotCreator", "inputs": [] },
    { "type": "error", "name": "QuestAlreadyFinalized", "inputs": [] },
    { "type": "error", "name": "QuestNotActive", "inputs": [] },
    { "type": "error", "name": "TransferFailed", "inputs": [] }
  ] as const;

export type QuestBoardAbi = typeof QUESTBOARD_ABI;
