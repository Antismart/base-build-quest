import { base, baseSepolia } from "wagmi/chains";

export const QUESTBOARD_ADDRESS =
  (process.env.NEXT_PUBLIC_QUESTBOARD_ADDRESS as `0x${string}` | undefined) ||
  ("0x24F1380D389Eb506dC8E19C777fB3078C31617a4" as const);

export function getActiveChain() {
  const env = process.env.NEXT_PUBLIC_CHAIN || "base-sepolia";
  if (env === "base" || env === "mainnet") return base;
  return baseSepolia;
}
