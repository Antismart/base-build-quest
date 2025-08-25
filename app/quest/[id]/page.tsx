"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicClient, http, encodeFunctionData } from "viem";
import { getActiveChain, QUESTBOARD_ADDRESS } from "@/lib/chain";
import { QUESTBOARD_ABI } from "@/lib/abi/QuestBoard";
import { ipfsCidUrl } from "@/lib/ipfs";
import { useMiniKit, useComposeCast } from "@coinbase/onchainkit/minikit";

function useQuest(questId: bigint) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quest, setQuest] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const client = createPublicClient({ chain: getActiveChain(), transport: http() });
        const q = await client.readContract({
          address: QUESTBOARD_ADDRESS,
          abi: QUESTBOARD_ABI,
          functionName: "getQuest",
          args: [questId],
        });
        if (!mounted) return;
        const [creator, cid, prize, deadline, cancelled, finalized, participantsCount, winners] = q as any;
        setQuest({ questId, creator, cid, prize, deadline: Number(deadline), cancelled, finalized, participantsCount: Number(participantsCount), winners });
        if (cid) {
          const r = await fetch(ipfsCidUrl(cid));
          if (r.ok) setMetadata(await r.json());
        }
      } catch (e: any) {
        setError(e?.message || "failed to load quest");
      } finally {
        setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [questId]);

  return { loading, error, quest, metadata };
}

export default function QuestDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = BigInt(params.id);
  const { loading, error, quest, metadata } = useQuest(id);
  const [submitting, setSubmitting] = useState(false);
  const [link, setLink] = useState("");
  const { composeCast } = useComposeCast();
  const { context, setFrameReady } = useMiniKit();

  useEffect(() => {
    setFrameReady();
  }, [setFrameReady]);

  // Determine creator by comparing connected wallet address in context.wallets[0]?.address if present
  const isCreator = useMemo(() => {
    const addr = (context as any)?.wallets?.[0]?.address as string | undefined;
    return !!(addr && quest?.creator && quest.creator.toLowerCase() === addr.toLowerCase());
  }, [context, quest?.creator]);
  const afterDeadline = useMemo(() => quest && Math.floor(Date.now() / 1000) > quest.deadline, [quest]);

  async function handleSubmit() {
    try {
      setSubmitting(true);
      const pinRes = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link }),
      }).then((r) => r.json());
      if (!pinRes.cid) throw new Error(pinRes.error || "pin failed");
      const data = encodeFunctionData({
        abi: QUESTBOARD_ABI,
        functionName: "submit",
        args: [id, pinRes.cid],
      });
      // Trigger OnchainKit transaction via a custom scheme: we reuse existing Transaction component patterns
      // For simplicity, use the Frame SDK compose cast after onchain success by asking user to share manually
      const txResp = await (window as any).ethereum?.request?.({
        method: "eth_sendTransaction",
        params: [{ to: QUESTBOARD_ADDRESS, data }],
      });
      if (txResp) {
        composeCast({
          text: `I submitted my project to Quest #${id} on the Web3 Quest Board!`,
          embeds: [typeof window !== "undefined" ? window.location.href : ""],
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSelectWinners() {
    const addrList = prompt("Enter winner addresses comma separated");
    if (!addrList) return;
    const winners = addrList.split(",").map((s) => s.trim()) as `0x${string}`[];
    try {
      const data = encodeFunctionData({
        abi: QUESTBOARD_ABI,
        functionName: "selectWinners",
        args: [id, winners],
      });
      const txResp = await (window as any).ethereum?.request?.({
        method: "eth_sendTransaction",
        params: [{ to: QUESTBOARD_ADDRESS, data }],
      });
      if (txResp) {
  composeCast({
          text: `Winners announced for Quest #${id}! Congrats ${winners.join(", ")}`,
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) return <div className="container-app py-4"><div className="h-24 skeleton" /></div>;
  if (error) return <div className="container-app py-4 text-sm text-red-500">{error}</div>;

  return (
    <div className="container-app py-4 space-y-4">
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost" onClick={() => router.back()}>← Back</button>
      </div>
      <div className="card">
        <div className="card-content">
          <h1 className="text-xl font-semibold">{metadata?.title || `Quest #${params.id}`}</h1>
          {metadata?.description && (
            <p className="mt-1 text-[var(--app-foreground-muted)]">{metadata?.description}</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="label">Prize</div>
              <div className="badge badge-primary">{quest ? (Number(quest.prize) / 1e18).toFixed(4) : "-"} ETH</div>
            </div>
            <div>
              <div className="label">Deadline</div>
              <div>{quest ? new Date(quest.deadline * 1000).toLocaleString() : "-"}</div>
            </div>
            <div>
              <div className="label">Participants</div>
              <div>{quest?.participantsCount ?? 0}</div>
            </div>
            <div>
              <div className="label">Status</div>
              <div>{quest?.finalized ? "Finalized" : quest?.cancelled ? "Cancelled" : afterDeadline ? "Ended" : "Open"}</div>
            </div>
          </div>
        </div>
      </div>

      {!quest?.finalized && !quest?.cancelled && (
        <div className="card">
          <div className="card-header"><div className="card-title">Submit your work</div></div>
          <div className="card-content space-y-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="input"
              placeholder="GitHub repo, demo URL, etc."
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!link || submitting}
              className="btn btn-primary"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      )}

      {isCreator && afterDeadline && !quest?.finalized && (
        <div className="card">
          <div className="card-content">
            <button
              type="button"
              onClick={handleSelectWinners}
              className="btn btn-outline"
            >
              Select Winners & Payout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
