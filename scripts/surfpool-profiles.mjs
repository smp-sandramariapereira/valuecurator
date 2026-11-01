// Isolated Surfpool profiles: no deploy, no private keys, no global Solana CLI configuration changes.
export const LOCAL_RPC = "http://127.0.0.1:8899";
export const DEVNET_RPC = "https://api.devnet.solana.com";

export function surfpoolArgs(profile) {
  const base = ["start", "--host", "127.0.0.1", "--port", "8899", "--ws-port", "8900", "--no-deploy"];
  if (profile === "local") return [...base, "--offline"];
  if (profile === "devnet-fork") return [...base, "--network", "devnet"];
  throw new Error(`Unknown simulator profile: ${profile}`);
}

export function rpcEndpoint(profile) {
  if (profile === "local" || profile === "devnet-fork") return LOCAL_RPC;
  if (profile === "devnet") return DEVNET_RPC;
  throw new Error(`Unknown RPC profile: ${profile}`);
}

export function rpcRequest(method, id = 1) {
  if (method !== "getVersion" && method !== "getGenesisHash") throw new Error("Read-only RPC method required");
  return { jsonrpc: "2.0", id, method };
}
