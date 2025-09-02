"use client";

import {
  useMiniKit,
  useAddFrame,
  useOpenUrl,
} from "@coinbase/onchainkit/minikit";
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);

  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  }, [addFrame]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <button
          type="button"
          onClick={handleAddFrame}
          className="text-[var(--app-accent)] p-4 text-sm"
        >
          Save Frame
        </button>
      );
    }

    if (frameAdded) {
      return (
        <div className="text-sm font-medium text-[#0052FF] animate-fade-out">Saved</div>
      );
    }

    return null;
  }, [context, frameAdded, handleAddFrame]);

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme bg-[var(--app-background)]">
      <div className="container-app py-4">
        <header className="flex justify-between items-center mb-3 h-11">
          <div>
            <div className="flex items-center space-x-2">
              <Wallet className="z-10">
                <ConnectWallet>
                  <Name className="text-inherit" />
                </ConnectWallet>
                <WalletDropdown>
                  <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                    <Avatar />
                    <Name />
                    <Address />
                    <EthBalance />
                  </Identity>
                  <WalletDropdownDisconnect />
                </WalletDropdown>
              </Wallet>
            </div>
          </div>
          <div>{saveFrameButton}</div>
        </header>

        <main className="flex-1">
          <div className="mb-4">
            <div className="card overflow-hidden mb-3">
              <Image src="/Grovehero.png" alt="Grove Builder Platform" width={800} height={128} className="w-full h-32 object-cover" />
            </div>
            <h1 className="text-xl font-semibold">Base Builder Quest</h1>
           </div>
          <div className="space-y-3">
            <Link href="/quests" className="btn btn-primary w-full text-center">Explore Base Builder Quest</Link>
            <Link href="/create" className="btn btn-outline w-full text-center">Plant a Challenge</Link>
          </div>

          <div className="mt-4 space-y-3">
            <div className="card">
              <div className="card-header"><div className="card-title">How it works</div></div>
              <div className="card-content">
                <ul className="list-disc pl-4 text-sm space-y-1">
                  <li>Plant a challenge by setting a prize and deadline.</li>
                  <li>Builders submit their work to grow in the Grove. You review entries as they come in.</li>
                  <li>Select winners after the deadline and help the Grove flourish.</li>
                </ul>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">What you get</div></div>
              <div className="card-content">
                <ul className="list-disc pl-4 text-sm space-y-1">
                  <li>Onchain transparency on Base for trust-minimized rewards.</li>
                  <li>One-tap Farcaster sharing so challenges reach more builders in the Grove.</li>
                  <li>A thriving ecosystem where builders support each other&apos;s growth.</li>
                </ul>
               </div>
            </div>
          </div>
        </main>

        <footer className="mt-2 pt-4 flex justify-center">
          <button
            type="button"
            className="text-[var(--ock-text-foreground-muted)] text-xs"
            onClick={() => openUrl("https://base.org/builders/minikit")}
          >
            Built on Base with MiniKit
          </button>
        </footer>
      </div>
    </div>
  );
}
