"use client";
// Client-only provider tree: TanStack Query → Sui Client → Wallet.
// dApp Kit hooks (useCurrentAccount, useSignAndExecuteTransaction, etc.)
// need all three above them in the tree.
//
// We use Sui's public fullnodes for client-side reads (free, no auth).
// All sensitive / server-side calls still flow through /api/sui → Tatum.

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider, createNetworkConfig } from "@mysten/dapp-kit";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import "@mysten/dapp-kit/dist/index.css";

const { networkConfig } = createNetworkConfig({
  testnet: { network: "testnet", url: getJsonRpcFullnodeUrl("testnet") },
  mainnet: { network: "mainnet", url: getJsonRpcFullnodeUrl("mainnet") },
});

export default function Providers({ children }: { children: ReactNode }) {
  // Stable per-mount client so cross-render queries de-dupe correctly.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
