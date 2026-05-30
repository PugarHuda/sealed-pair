// Sui network registry. Tatum gateway URLs from the hackathon brief.
export type SuiNetwork = "mainnet" | "testnet" | "devnet";

export type NetworkConfig = {
  name: string;
  rpcUrl: string;
  explorerUrl: string;
};

export const NETWORKS: Record<SuiNetwork, NetworkConfig> = {
  mainnet: {
    name: "Sui Mainnet",
    rpcUrl: "https://sui-mainnet.gateway.tatum.io",
    explorerUrl: "https://suiscan.xyz/mainnet",
  },
  testnet: {
    name: "Sui Testnet",
    rpcUrl: "https://sui-testnet.gateway.tatum.io",
    explorerUrl: "https://suiscan.xyz/testnet",
  },
  devnet: {
    name: "Sui Devnet",
    rpcUrl: "https://sui-devnet.gateway.tatum.io",
    explorerUrl: "https://suiscan.xyz/devnet",
  },
};

export const DEFAULT_NETWORK: SuiNetwork =
  (process.env.SUI_NETWORK as SuiNetwork) || "mainnet";

export function parseNetwork(input: string | null | undefined): SuiNetwork {
  if (input === "testnet" || input === "devnet" || input === "mainnet") return input;
  return DEFAULT_NETWORK;
}
