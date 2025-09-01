import { base, baseSepolia } from "wagmi/chains";

export const QUESTBOARD_ADDRESS =
  (process.env.NEXT_PUBLIC_QUESTBOARD_ADDRESS as `0x${string}` | undefined) ||
  ("0x401b7123A40B86F7Cfc0A29C43A481DFe971c3Ac" as const);

export function getActiveChain() {
  const env = process.env.NEXT_PUBLIC_CHAIN || "base-sepolia";
  if (env === "base" || env === "mainnet") return base;
  return baseSepolia;
}
