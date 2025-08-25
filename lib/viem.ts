import { createPublicClient, http } from "viem";
import { getActiveChain } from "./chain";

export const publicClient = createPublicClient({
  chain: getActiveChain(),
  transport: http(),
});
