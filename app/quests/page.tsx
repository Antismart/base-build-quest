"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMiniKit, useAddFrame } from "@coinbase/onchainkit/minikit";
import { createPublicClient, http } from "viem";
import { getActiveChain, QUESTBOARD_ADDRESS } from "@/lib/chain";
import { QUESTBOARD_ABI } from "@/lib/abi/QuestBoard";
import { ipfsCidUrl } from "@/lib/ipfs";
import Link from "next/link";

interface QuestItem {
  id: bigint;
  creator: string;
  cid: string;
  prize: bigint;
  prizeEth: number;
  deadline: number;
  cancelled: boolean;
  finalized: boolean;
  participantsCount: number;
  title: string;
  description: string;
}

function useQuests() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<QuestItem[]>([]);
  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const client = createPublicClient({ chain: getActiveChain(), transport: http() });
        const count = (await client.readContract({ address: QUESTBOARD_ADDRESS, abi: QUESTBOARD_ABI, functionName: "questCount" })) as bigint;
        console.log(`Grove challenges count: ${count.toString()}`);
        const arr: QuestItem[] = [];
        const max = Number(count);
        const ids = Array.from({ length: max }, (_, i) => BigInt(i + 1));
        console.log(`Quest IDs to fetch: ${ids.map(id => id.toString()).join(", ")}`);
        for (const id of ids) {
          const q = await client.readContract({ address: QUESTBOARD_ADDRESS, abi: QUESTBOARD_ABI, functionName: "getQuest", args: [id] });
          const [creator, cid, prize, deadline, cancelled, finalized, participantsCount] = q as readonly [`0x${string}`, string, bigint, bigint, boolean, boolean, number, readonly `0x${string}`[]];
          
          // Fetch metadata from IPFS
          let metadata = null;
          if (cid) {
            try {
              const metaRes = await fetch(ipfsCidUrl(cid));
              if (metaRes.ok) {
                metadata = await metaRes.json();
              }
            } catch (e) {
              console.warn(`Failed to fetch metadata for quest ${id}:`, e);
            }
          }
          
          const prizeEth = Number(prize) / 1e18;
          console.log(`Quest ${id}: prize = ${prize.toString()} wei = ${prizeEth} ETH`);
          
          arr.push({ 
            id, 
            creator, 
            cid, 
            prize, 
            prizeEth,
            deadline: Number(deadline), 
            cancelled, 
            finalized, 
            participantsCount,
            title: metadata?.title || `Quest #${id}`,
            description: metadata?.description || ""
          });
        }
        if (mounted) setItems(arr.filter((q) => !q.cancelled));
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "failed to load quests";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, []);
  return { loading, error, items };
}

export default function QuestsPage() {
  const router = useRouter();
  const { setFrameReady, isFrameReady } = useMiniKit();
  const addFrame = useAddFrame();
  const [frameAdded, setFrameAdded] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'ended' | 'finalized'>('all');
  const { loading, error, items } = useQuests();

  useEffect(() => { if (!isFrameReady) setFrameReady(); }, [setFrameReady, isFrameReady]);

  const handleAddFrame = useCallback(async () => {
    const ok = await addFrame();
    setFrameAdded(Boolean(ok));
  }, [addFrame]);

  // Filter quests based on status
  const filteredQuests = items.filter(quest => {
    const now = Math.floor(Date.now() / 1000);
    const isOpen = !quest.finalized && !quest.cancelled && quest.deadline > now;
    const isEnded = !quest.finalized && !quest.cancelled && quest.deadline <= now;
    const isFinalized = quest.finalized;
    
    switch (filter) {
      case 'open': return isOpen;
      case 'ended': return isEnded;
      case 'finalized': return isFinalized;
      default: return !quest.cancelled; // Show all except cancelled
    }
  });

  const getQuestStatus = (quest: QuestItem) => {
    const now = Math.floor(Date.now() / 1000);
    if (quest.cancelled) return { text: 'Cancelled', color: 'badge-danger' };
    if (quest.finalized) return { text: 'Finalized', color: 'badge-success' };
    if (quest.deadline <= now) return { text: 'Ended', color: 'badge-warning' };
    return { text: 'Open', color: 'badge-success' };
  };

  const getTimeRemaining = (deadline: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = deadline - now;
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (24 * 60 * 60));
    const hours = Math.floor((diff % (24 * 60 * 60)) / (60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    return 'Ending soon';
  };

  return (
    <div className="flex flex-col min-h-screen mini-app-theme text-[var(--app-foreground)] bg-[var(--app-background)]">
      <div className="container-app py-4 space-y-6">
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button className="btn btn-ghost" onClick={() => router.back()}>
              ← Back
            </button>
            <button className="btn btn-ghost text-[var(--app-accent)] text-xs" onClick={handleAddFrame}>
              {frameAdded ? "✓ Saved" : "Save Frame"}
            </button>
          </div>
          
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-r from-[var(--app-accent)] to-purple-500 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--app-foreground)] mb-2">Grove Challenges</h1>
              <p className="text-[var(--app-foreground-muted)]">
                Where builders grow together • Plant challenges, harvest innovation
              </p>
            </div>
            
            {/* Stats Row */}
            <div className="flex justify-center gap-6 text-sm">
              <div className="text-center">
                <div className="font-bold text-[var(--app-foreground)]">{items.length}</div>
                <div className="text-[var(--app-foreground-muted)]">Challenges</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-[var(--app-foreground)]">
                  {items.filter(q => !q.finalized && !q.cancelled && q.deadline > Math.floor(Date.now() / 1000)).length}
                </div>
                <div className="text-[var(--app-foreground-muted)]">Active</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-[var(--app-foreground)]">
                  {items.reduce((sum, q) => sum + q.prizeEth, 0).toFixed(3)}
                </div>
                <div className="text-[var(--app-foreground-muted)]">ETH Prizes</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(['all', 'open', 'ended', 'finalized'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-[var(--app-accent)] text-white'
                    : 'bg-[var(--app-gray)] text-[var(--app-foreground-muted)] hover:bg-[var(--app-gray-dark)]'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)} ({
                  f === 'all' ? items.filter(q => !q.cancelled).length :
                  f === 'open' ? items.filter(q => !q.finalized && !q.cancelled && q.deadline > Math.floor(Date.now() / 1000)).length :
                  f === 'ended' ? items.filter(q => !q.finalized && !q.cancelled && q.deadline <= Math.floor(Date.now() / 1000)).length :
                  items.filter(q => q.finalized).length
                })
              </button>
            ))}
          </div>
          
          <Link 
            href="/create" 
            className="btn btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Plant Challenge
          </Link>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card">
                <div className="card-content">
                  <div className="flex items-start justify-between mb-3">
                    <div className="skeleton h-4 w-32"></div>
                    <div className="skeleton h-6 w-16"></div>
                  </div>
                  <div className="skeleton h-3 w-full mb-2"></div>
                  <div className="skeleton h-3 w-2/3"></div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="skeleton h-3 w-20"></div>
                    <div className="skeleton h-3 w-24"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="card border-2 border-red-200 bg-red-50">
            <div className="card-content text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-red-800 mb-1">Failed to Load Grove</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Quest Cards Grid */}
        {!loading && !error && (
          <div className="grid gap-4">
            {filteredQuests.map((quest) => {
              const status = getQuestStatus(quest);
              const timeRemaining = getTimeRemaining(quest.deadline);
              
              return (
                <Link key={quest.id.toString()} href={`/quest/${quest.id}`} className="card block hover:shadow-lg transition-shadow">
                  <div className="card-content">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[var(--app-foreground)] text-sm leading-tight mb-1">
                          {quest.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <div className={`badge ${status.color} text-xs`}>
                            {status.text}
                          </div>
                          {status.text === 'Open' && (
                            <div className="badge badge-muted text-xs">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {timeRemaining}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="badge badge-primary text-sm font-semibold">
                          {quest.prizeEth.toFixed(5)} ETH
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {quest.description && (
                      <p className="text-xs text-[var(--app-foreground-muted)] line-clamp-2 mb-3">
                        {quest.description}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-[var(--app-foreground-muted)]">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {quest.participantsCount} participants
                        </div>
                      </div>
                      <div>
                        Quest #{quest.id.toString()}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Empty State */}
            {filteredQuests.length === 0 && items.length > 0 && (
              <div className="card border-2 border-dashed border-[var(--app-card-border)]">
                <div className="card-content text-center py-8">
                  <div className="w-12 h-12 bg-[var(--app-gray)] rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-[var(--app-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-[var(--app-foreground)] mb-1">No {filter} quests found</h3>
                  <p className="text-sm text-[var(--app-foreground-muted)]">
                    Try a different filter or create a new quest
                  </p>
                </div>
              </div>
            )}

            {/* No Quests Ever */}
            {items.length === 0 && !loading && (
              <div className="card border-2 border-dashed border-[var(--app-card-border)]">
                <div className="card-content text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-[var(--app-accent-light)] to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-[var(--app-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--app-foreground)] mb-2">No Quests Yet</h3>
                  <p className="text-[var(--app-foreground-muted)] mb-4">
                    Be the first to create a quest and start building the Web3 community!
                  </p>
                  <Link href="/create" className="btn btn-primary">
                    Create Your First Quest
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
