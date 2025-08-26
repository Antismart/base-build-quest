import { QUESTBOARD_ABI } from "./abi/QuestBoard";
import { QUESTBOARD_ADDRESS } from "./chain";

export const QUESTBOARD = {
  address: QUESTBOARD_ADDRESS,
  abi: QUESTBOARD_ABI,
} as const;

export type Quest = {
  id: bigint;
  creator: `0x${string}`;
  cid: string;
  prize: bigint;
  deadline: number;
  cancelled: boolean;
  finalized: boolean;
  participantsCount: number;
  winners: `0x${string}`[];
};

export function encodeCreateQuestArgs(cid: string, deadline: number) {
  return [cid, BigInt(deadline)] as const;
}

export function encodeSubmitArgs(questId: bigint, submissionCid: string) {
  return [questId, submissionCid] as const;
}

export function encodeSelectWinnersArgs(
  questId: bigint,
  winners: `0x${string}`[],
) {
  return [questId, winners] as const;
}
