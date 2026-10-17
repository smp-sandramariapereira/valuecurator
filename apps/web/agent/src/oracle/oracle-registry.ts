import { isProviderId, type ProviderId } from "@valuecurator/oracle-contracts";
import { fetchChainlinkEvidence } from "./adapters/chainlink.adapter.js";
import { fetchPythHermesEvidence } from "./adapters/pyth-hermes.adapter.js";
import { fetchPythProEvidence, type AdapterFetchInput } from "./adapters/pyth-pro.adapter.js";
import { fetchRedstoneEvidence } from "./adapters/redstone.adapter.js";
import { fetchSwitchboardEvidence } from "./adapters/switchboard.adapter.js";

export type RegisteredProvider = {
  providerId: ProviderId;
  enabled: boolean;
  credentialRequired: boolean;
  fetchEvidence: (input: AdapterFetchInput) => Promise<unknown>;
};

const providers: Record<ProviderId, RegisteredProvider> = {
  "pyth-pro": {
    providerId: "pyth-pro",
    enabled: true,
    credentialRequired: true,
    fetchEvidence: fetchPythProEvidence,
  },
  "pyth-hermes": {
    providerId: "pyth-hermes",
    enabled: true,
    credentialRequired: false,
    fetchEvidence: fetchPythHermesEvidence,
  },
  chainlink: {
    providerId: "chainlink",
    enabled: false,
    credentialRequired: true,
    fetchEvidence: fetchChainlinkEvidence,
  },
  switchboard: {
    providerId: "switchboard",
    enabled: false,
    credentialRequired: true,
    fetchEvidence: fetchSwitchboardEvidence,
  },
  redstone: {
    providerId: "redstone",
    enabled: false,
    credentialRequired: true,
    fetchEvidence: fetchRedstoneEvidence,
  },
};

export function getProvider(providerId: string): RegisteredProvider {
  if (!isProviderId(providerId)) throw new Error("oracle provider is not registered");
  return providers[providerId];
}

export function listProviders(): readonly RegisteredProvider[] {
  return Object.values(providers);
}
