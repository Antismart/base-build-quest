"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { encodeFunctionData } from "viem";
import { QUESTBOARD_ABI } from "@/lib/abi/QuestBoard";
import { QUESTBOARD_ADDRESS } from "@/lib/chain";
import { useMiniKit, useComposeCast } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";
import {
  Transaction,
  TransactionButton,
  TransactionError,
  TransactionResponse,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
} from "@coinbase/onchainkit/transaction";

export default function CreateQuest() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prize, setPrize] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const { composeCast } = useComposeCast();
  const { setFrameReady } = useMiniKit();
  const { address } = useAccount();
  const isValidTitle = useMemo(() => title.trim().length > 2, [title]);
  const isValidDescription = useMemo(() => description.trim().length > 5, [description]);
  const isValidPrize = useMemo(() => {
    const n = parseFloat(prize);
    return Number.isFinite(n) && n > 0;
  }, [prize]);
  const isValidDeadline = useMemo(() => {
    if (!deadline) return false;
    const t = new Date(deadline).getTime();
    return Number.isFinite(t) && t > Date.now() + 60_000; // at least 1 min in future
  }, [deadline]);
  const canSubmit = isValidTitle && isValidDescription && isValidPrize && isValidDeadline && !loading;

  const minDeadlineValue = useMemo(() => {
    const d = new Date(Date.now() + 60_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${y}-${m}-${day}T${h}:${min}`;
  }, []);


  // Ensure frame is marked ready once on mount
  useEffect(() => {
    setFrameReady();
  }, [setFrameReady]);

  const [transactionCalls, setTransactionCalls] = useState<{ to: `0x${string}`; data: `0x${string}`; value: bigint }[]>([]);

  const handlePrepareTransaction = useCallback(async () => {
    try {
      if (!canSubmit || !address) return;
      setLoading(true);
      
      const meta = { title, description };
      const pin = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meta),
      }).then((r) => r.json());
      if (!pin.cid) throw new Error(pin.error || "pin failed");

      const seconds = Math.floor(new Date(deadline).getTime() / 1000);
      const data = encodeFunctionData({
        abi: QUESTBOARD_ABI,
        functionName: "createQuest",
        args: [pin.cid, BigInt(seconds)],
      });

      const eth = parseFloat(prize);
      if (!Number.isFinite(eth) || eth <= 0) throw new Error("Invalid prize amount");
      
      const valueWei = BigInt(Math.floor(eth * 1e18));
      
      console.log('Creating quest with prize:', eth, 'ETH =', valueWei.toString(), 'wei');
      
      setTransactionCalls([{
        to: QUESTBOARD_ADDRESS as `0x${string}`,
        data: data as `0x${string}`,
        value: valueWei,
      }]);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, [canSubmit, address, title, description, deadline, prize]);

  const handleTransactionSuccess = useCallback(async (response: TransactionResponse) => {
    setLoading(false);
    const transactionHash = response.transactionReceipts[0].transactionHash;
    console.log(`Quest created successfully: ${transactionHash}`);
    
    composeCast({
      text: `New Quest: ${title} — join now!`,
      embeds: [typeof window !== "undefined" ? window.location.origin : ""],
    });
    
    // Show success message and redirect to quests page
    alert(`Quest "${title}" created successfully! 🎉`);
    router.push("/quests");
  }, [composeCast, title, router]);

  const handleTransactionError = useCallback((error: TransactionError) => {
    console.error("Transaction failed:", error);
    setLoading(false);
    setTransactionCalls([]);
  }, []);

  return (
    <div className="container-app py-4 space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost" onClick={() => router.back()}>← Back</button>
        <h1 className="text-xl font-semibold">Create Quest</h1>
      </div>
      <div className="card">
        <div className="card-content space-y-3">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="textarea" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prize (ETH)</label>
              <input
                className="input"
                placeholder="0.10"
                value={prize}
                onChange={(e) => setPrize(e.target.value)}
                type="number"
                step="0.0001"
                min="0"
                inputMode="decimal"
              />
              {!isValidPrize && prize !== "" && (
                <div className="text-xs text-[var(--ock-text-error)] mt-1">Enter a positive amount.</div>
              )}
            </div>
            <div>
              <label className="label">Deadline</label>
              <input
                className="input"
                type="datetime-local"
                value={deadline}
                min={minDeadlineValue}
                onChange={(e) => setDeadline(e.target.value)}
              />

              {!isValidDeadline && deadline !== "" && (
                <div className="text-xs text-[var(--ock-text-error)] mt-1">Pick a future date/time.</div>
              )}
            </div>
          </div>
          <div className="pt-1">
            {!address ? (
              <div className="text-center text-[var(--ock-text-error)]">
                Connect your wallet to create a quest
              </div>
            ) : transactionCalls.length > 0 ? (
              <Transaction
                calls={transactionCalls}
                onSuccess={handleTransactionSuccess}
                onError={handleTransactionError}
              >
                <TransactionButton className="btn btn-primary w-full" />
                <TransactionStatus>
                  <TransactionStatusAction />
                  <TransactionStatusLabel />
                </TransactionStatus>
              </Transaction>
            ) : (
              <button
                type="button"
                onClick={handlePrepareTransaction}
                disabled={!canSubmit}
                className="btn btn-primary w-full"
              >
                {loading ? "Preparing…" : "Create Quest"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
