"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicClient, http, encodeFunctionData } from "viem";
import { getActiveChain, QUESTBOARD_ADDRESS } from "@/lib/chain";
import { QUESTBOARD_ABI } from "@/lib/abi/QuestBoard";
import { ipfsCidUrl } from "@/lib/ipfs";
import { useMiniKit, useComposeCast } from "@coinbase/onchainkit/minikit";
import {
  Transaction,
  TransactionButton,
  TransactionError,
  TransactionResponse,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
} from "@coinbase/onchainkit/transaction";

interface QuestData {
  questId: bigint;
  creator: `0x${string}`;
  cid: string;
  prize: bigint;
  prizeEth: number;
  deadline: number;
  cancelled: boolean;
  finalized: boolean;
  participantsCount: number;
  winners: readonly `0x${string}`[];
}

interface QuestMetadata {
  title?: string;
  description?: string;
}

function useQuest(questId: bigint) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quest, setQuest] = useState<QuestData | null>(null);
  const [metadata, setMetadata] = useState<QuestMetadata | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        console.log(`Loading quest ${questId}...`);
        const client = createPublicClient({ chain: getActiveChain(), transport: http() });
        const q = await client.readContract({
          address: QUESTBOARD_ADDRESS,
          abi: QUESTBOARD_ABI,
          functionName: "getQuest",
          args: [questId],
        });
        console.log("Raw quest data:", q);
        if (!mounted) return;
        const [creator, cid, prize, deadline, cancelled, finalized, participantsCount, winners] = q as readonly [`0x${string}`, string, bigint, bigint, boolean, boolean, number, readonly `0x${string}`[]];
        console.log("Parsed quest data:", {
          creator,
          cid, 
          prize: prize.toString(),
          deadline: Number(deadline),
          cancelled,
          finalized,
          participantsCount: Number(participantsCount)
        });
        const prizeEth = Number(prize) / 1e18;
        setQuest({ questId, creator, cid, prize, prizeEth, deadline: Number(deadline), cancelled, finalized, participantsCount, winners });
        if (cid) {
          console.log(`Fetching metadata from IPFS: ${cid}`);
          const r = await fetch(ipfsCidUrl(cid));
          if (r.ok) {
            const meta = await r.json();
            console.log("Metadata:", meta);
            setMetadata(meta);
          }
        }
      } catch (e: unknown) {
        console.error("Error loading quest:", e);
        const errorMessage = e instanceof Error ? e.message : "failed to load quest";
        setError(errorMessage);
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

export default function QuestDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [link, setLink] = useState("");
  const [showSubmissionSuccess, setShowSubmissionSuccess] = useState(false);
  const [submissionCountdown, setSubmissionCountdown] = useState(3);
  const [transactionCalls, setTransactionCalls] = useState<{ to: `0x${string}`; data: `0x${string}` }[]>([]);
  const { composeCast } = useComposeCast();
  const { context, setFrameReady } = useMiniKit();
  
  const id = resolvedParams ? BigInt(resolvedParams.id) : BigInt(0);
  const { loading, error, quest, metadata } = useQuest(id);
  
  useEffect(() => {
    async function resolveParams() {
      const resolved = await Promise.resolve(params);
      setResolvedParams(resolved);
    }
    resolveParams();
  }, [params]);

  useEffect(() => {
    setFrameReady();
  }, [setFrameReady]);

  // Determine creator by comparing connected wallet address in context.wallets[0]?.address if present
  const isCreator = useMemo(() => {
    const contextData = context as { wallets?: Array<{ address?: string }> };
    const addr = contextData?.wallets?.[0]?.address;
    return !!(addr && quest?.creator && quest.creator.toLowerCase() === addr.toLowerCase());
  }, [context, quest?.creator]);
  const afterDeadline = useMemo(() => quest && Math.floor(Date.now() / 1000) > quest.deadline, [quest]);

  const handlePrepareSubmission = useCallback(async () => {
    try {
      if (!link.trim()) return;
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
      
      setTransactionCalls([{
        to: QUESTBOARD_ADDRESS as `0x${string}`,
        data: data as `0x${string}`,
      }]);
    } catch (e) {
      console.error(e);
      setSubmitting(false);
    }
  }, [link, id]);

  const handleSubmissionSuccess = useCallback(async (response: TransactionResponse) => {
    setSubmitting(false);
    const transactionHash = response.transactionReceipts[0].transactionHash;
    console.log(`Submission successful: ${transactionHash}`);
    
    composeCast({
      text: `I planted my project in Grove Challenge #${id}! 🌱`,
      embeds: [typeof window !== "undefined" ? window.location.href : ""],
    });
    
    // Show success modal
    setShowSubmissionSuccess(true);
    setSubmissionCountdown(3);
    setTransactionCalls([]);
    setLink("");
    
    // Start countdown timer
    const timer = setInterval(() => {
      setSubmissionCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowSubmissionSuccess(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [composeCast, id]);

  const handleSubmissionError = useCallback((error: TransactionError) => {
    console.error("Submission failed:", error);
    setSubmitting(false);
    setTransactionCalls([]);
  }, []);

  // Show loading while params are being resolved
  if (!resolvedParams) {
    return (
      <div className="container-app py-4">
        <div className="h-24 skeleton" />
      </div>
    );
  }

  // Check if quest ID is valid (should be >= 1) - after all hooks
  if (id <= 0) {
    return (
      <div className="container-app py-4">
        <div className="card">
          <div className="card-content text-center">
            <h1 className="text-xl font-semibold text-red-500">Invalid Challenge ID</h1>
            <p className="mt-2 text-[var(--app-foreground-muted)]">Challenge ID must be a positive number.</p>
            <button className="btn btn-primary mt-4" onClick={() => router.push('/quests')}>
              Explore Grove
            </button>
          </div>
        </div>
      </div>
    );
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
      const ethereum = (window as unknown as { ethereum?: { request?: (params: { method: string; params: unknown[] }) => Promise<unknown> } }).ethereum;
      const txResp = await ethereum?.request?.({
        method: "eth_sendTransaction",
        params: [{ to: QUESTBOARD_ADDRESS, data }],
      });
      if (txResp) {
  composeCast({
          text: `Harvest time! Winners announced for Grove Challenge #${id}! 🎆 Congrats ${winners.join(", ")}`,
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) return <div className="container-app py-4"><div className="h-24 skeleton" /></div>;
  if (error) return <div className="container-app py-4 text-sm text-red-500">{error}</div>;

  return (
    <>
      {/* Submission Success Modal */}
      {showSubmissionSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--app-card-bg)] rounded-2xl p-8 mx-4 max-w-md w-full shadow-2xl animate-modal-in border border-[var(--app-card-border)]">
            <div className="text-center space-y-6">
              {/* Success Icon */}
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto animate-success-bounce animate-pulse-slow">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              
              {/* Success Message */}
              <div className="space-y-3">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--app-foreground)] mb-2">Submission Complete! 🚀</h2>
                  <p className="text-[var(--app-foreground-muted)] mb-3">
                    Your project has been planted in the Grove! Watch it grow with community feedback.
                  </p>
                </div>
                
                <div className="bg-[var(--app-accent-light)] rounded-lg p-3 border border-[var(--app-accent)]/20">
                  <p className="text-sm text-[var(--app-accent)] font-medium">
                    Auto-closing in <span className="inline-block w-4 text-center font-bold">{submissionCountdown}</span> second{submissionCountdown !== 1 ? 's' : ''}...
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowSubmissionSuccess(false)}
                  className="btn btn-primary flex-1"
                >
                  Continue
                </button>
                <button 
                  onClick={() => router.push("/quests")}
                  className="btn btn-ghost flex-1"
                >
                  Explore Grove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container-app py-4 space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <button className="btn btn-ghost" onClick={() => router.back()}>
            ← Back to Grove
          </button>
          <div className="flex items-center gap-2">
            {quest?.finalized && (
              <div className="badge badge-success">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Finalized
              </div>
            )}
            {quest?.cancelled && (
              <div className="badge badge-danger">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Cancelled
              </div>
            )}
            {!quest?.finalized && !quest?.cancelled && afterDeadline && (
              <div className="badge badge-warning">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Ended
              </div>
            )}
            {!quest?.finalized && !quest?.cancelled && !afterDeadline && (
              <div className="badge badge-success animate-pulse">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Open
              </div>
            )}
          </div>
        </div>

        {/* Hero Section */}
        <div className="card">
          <div className="card-content">
            <div className="text-center space-y-4">
              {/* Quest Icon */}
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--app-accent)] to-purple-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              
              {/* Title and Description */}
              <div>
                <h1 className="text-3xl font-bold text-[var(--app-foreground)] mb-3">
                  {metadata?.title || `Grove Challenge #${resolvedParams.id}`}
                </h1>
                {metadata?.description && (
                  <p className="text-lg text-[var(--app-foreground-muted)] leading-relaxed max-w-2xl mx-auto">
                    {metadata.description}
                  </p>
                )}
              </div>
              
              {/* Prize Highlight */}
              <div className="bg-gradient-to-r from-[var(--app-accent-light)] to-purple-100 rounded-xl p-6 border border-[var(--app-accent)]/20">
                <div className="text-center">
                  <div className="text-sm font-medium text-[var(--app-accent)] mb-1">Total Prize Pool</div>
                  <div className="text-4xl font-bold text-[var(--app-accent)] flex items-center justify-center gap-2">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.51-1.31c-.562-.649-1.413-1.076-2.353-1.253V5z" clipRule="evenodd" />
                    </svg>
                    {quest ? quest.prizeEth.toFixed(5) : "0.00000"} ETH
                  </div>
                  <div className="text-xs text-[var(--app-accent)] mt-1">
                    {quest?.participantsCount ? `Split among winners` : "Waiting for participants"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quest Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deadline Card */}
          <div className="card">
            <div className="card-content">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[var(--app-foreground)]">Deadline</div>
                  <div className="text-sm text-[var(--app-foreground-muted)]">
                    {quest ? new Date(quest.deadline * 1000).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : "-"}
                  </div>
                  {quest && !afterDeadline && (
                    <div className="text-xs text-orange-600 font-medium mt-1">
                      {Math.ceil((quest.deadline * 1000 - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Participants Card */}
          <div className="card">
            <div className="card-content">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[var(--app-foreground)]">Participants</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {quest?.participantsCount ?? 0}
                  </div>
                  <div className="text-xs text-[var(--app-foreground-muted)] mt-1">
                    {quest?.participantsCount === 0 ? "Be the first to join!" : "builders joined"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submission Section */}
        {!quest?.finalized && !quest?.cancelled && !afterDeadline && (
          <div className="card border-2 border-dashed border-[var(--app-accent)]/30 bg-gradient-to-br from-[var(--app-accent-light)]/30 to-purple-50/30">
            <div className="card-content">
              <div className="text-center space-y-4">
                {/* Submit Icon */}
                <div className="w-14 h-14 bg-gradient-to-r from-[var(--app-accent)] to-purple-500 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold text-[var(--app-foreground)] mb-2">Ready to Submit?</h3>
                  <p className="text-[var(--app-foreground-muted)] mb-4">
                    Share your project link and join the competition for the prize pool!
                  </p>
                </div>

                {/* Submission Form */}
                <div className="max-w-md mx-auto space-y-4">
                  <div className="relative">
                    <input
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      className="input pr-12 text-center"
                      placeholder="https://github.com/yourproject or demo URL..."
                      type="url"
                    />
                    {link.trim() && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {transactionCalls.length > 0 ? (
                    <Transaction
                      calls={transactionCalls}
                      onSuccess={handleSubmissionSuccess}
                      onError={handleSubmissionError}
                    >
                      <TransactionButton className="btn btn-primary w-full text-lg py-3" />
                      <TransactionStatus>
                        <TransactionStatusAction />
                        <TransactionStatusLabel />
                      </TransactionStatus>
                    </Transaction>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePrepareSubmission}
                      disabled={!link.trim() || submitting}
                      className="btn btn-primary w-full text-lg py-3 disabled:opacity-50"
                    >
                      {submitting ? (
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Preparing Submission...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Submit Your Project
                        </div>
                      )}
                    </button>
                  )}
                  
                  {!link.trim() && (
                    <p className="text-xs text-[var(--app-foreground-muted)]">
                      💡 Tip: Include a GitHub repo, live demo, or detailed project description
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Closed Quest Message */}
        {!quest?.finalized && !quest?.cancelled && afterDeadline && (
          <div className="card border-2 border-yellow-200 bg-yellow-50">
            <div className="card-content text-center">
              <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Submission Period Ended</h3>
              <p className="text-yellow-700">
                The growing season for this challenge has ended. The creator will now select which projects have flourished.
              </p>
            </div>
          </div>
        )}

        {/* Finalized Quest Message */}
        {quest?.finalized && (
          <div className="card border-2 border-green-200 bg-green-50">
            <div className="card-content text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">Challenge Complete! 🌱</h3>
              <p className="text-green-700 mb-4">
                This challenge has reached fruition! Winners have been selected and the harvest has been distributed.
              </p>
              {quest.winners.length > 0 && (
                <div className="text-sm text-green-600">
                  <strong>Winners:</strong> {quest.winners.slice(0, 3).join(", ")}
                  {quest.winners.length > 3 && ` and ${quest.winners.length - 3} more`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cancelled Quest Message */}
        {quest?.cancelled && (
          <div className="card border-2 border-red-200 bg-red-50">
            <div className="card-content text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Challenge Cancelled</h3>
              <p className="text-red-700">
                This challenge has been cancelled by the creator. The seed funding has been returned.
              </p>
            </div>
          </div>
        )}

        {/* Creator Actions */}
        {isCreator && afterDeadline && !quest?.finalized && (
          <div className="card border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
            <div className="card-content">
              <div className="text-center space-y-4">
                {/* Crown Icon for Creator */}
                <div className="w-14 h-14 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold text-purple-800 mb-2">Grove Gardener Actions</h3>
                  <p className="text-purple-700 mb-4">
                    The submission period has ended. Review submissions and select the winners to distribute the prize pool.
                  </p>
                </div>

                <div className="bg-white/70 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center justify-center gap-3 text-sm text-purple-700 mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span><strong>{quest?.participantsCount || 0}</strong> participants submitted their work</span>
                  </div>
                  <div className="flex items-center justify-center gap-3 text-sm text-purple-700">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.51-1.31c-.562-.649-1.413-1.076-2.353-1.253V5z" clipRule="evenodd" />
                    </svg>
                    <span><strong>{quest?.prizeEth.toFixed(5)} ETH</strong> ready to distribute</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSelectWinners}
                  className="btn btn-primary w-full text-lg py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Select Winners & Distribute Prize
                  </div>
                </button>

                <p className="text-xs text-purple-600">
                  💡 Tip: You can select multiple winners to split the prize pool equally
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
