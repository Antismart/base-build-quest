"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMiniKit, useAddFrame } from "@coinbase/onchainkit/minikit";
import { createPublicClient, http } from "viem";
import { getActiveChain, QUESTBOARD_ADDRESS } from "@/lib/chain";
import { QUESTBOARD_ABI } from "@/lib/abi/QuestBoard";
import Link from "next/link";

function useQuests() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const client = createPublicClient({ chain: getActiveChain(), transport: http() });
        const count = (await client.readContract({ address: QUESTBOARD_ADDRESS, abi: QUESTBOARD_ABI, functionName: "questCount" })) as bigint;
        const arr: any[] = [];
        const max = Number(count);
        const ids = Array.from({ length: max }, (_, i) => BigInt(i));
        for (const id of ids) {
          const q = await client.readContract({ address: QUESTBOARD_ADDRESS, abi: QUESTBOARD_ABI, functionName: "getQuest", args: [id] });
          const [creator, cid, prize, deadline, cancelled, finalized, participantsCount] = q as any;
          arr.push({ id, creator, cid, prize, deadline: Number(deadline), cancelled, finalized, participantsCount: Number(participantsCount) });
        }
        if (mounted) setItems(arr.filter((q) => !q.cancelled));
      } catch (e: any) {
        setError(e?.message || "failed to load quests");
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
  const { loading, error, items } = useQuests();

  useEffect(() => { if (!isFrameReady) setFrameReady(); }, [setFrameReady, isFrameReady]);

  const handleAddFrame = useCallback(async () => {
    const ok = await addFrame();
    setFrameAdded(Boolean(ok));
  }, [addFrame]);

  return (
    <div className="flex flex-col min-h-screen mini-app-theme text-[var(--app-foreground)] bg-[var(--app-background)]">
      <div className="container-app py-4">
        <header className="flex justify-between items-center mb-4 h-11">
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost" onClick={() => router.back()}>← Back</button>
            <h1 className="text-xl font-semibold">Quests</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/create" className="btn btn-outline">Create</Link>
            <button className="btn btn-ghost text-[var(--app-accent)]" onClick={handleAddFrame}>{frameAdded ? "Saved" : "Save Frame"}</button>
          </div>
        </header>
        <main className="space-y-3">
          {loading && (
            <div className="space-y-2">
              <div className="h-16 skeleton" />
              <div className="h-16 skeleton" />
              <div className="h-16 skeleton" />
            </div>
          )}
          {error && <div className="text-sm text-red-500">{error}</div>}
          <div className="space-y-2">
            {items.map((q) => (
              <Link key={q.id.toString()} href={`/quest/${q.id}`} className="card block">
                <div className="card-content">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Quest #{q.id.toString()}</div>
                    <div className="badge badge-primary">{(Number(q.prize) / 1e18).toFixed(4)} ETH</div>
                  </div>
                  <div className="mt-1 text-xs text-[var(--app-foreground-muted)]">Deadline: {new Date(q.deadline * 1000).toLocaleString()}</div>
                </div>
              </Link>
            ))}
            {!loading && items.length === 0 && (
              <div className="card">
                <div className="card-content text-sm text-[var(--app-foreground-muted)]">No quests yet. Be the first to create one.</div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
