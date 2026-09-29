import { PublicKey, type AccountMeta } from "@solana/web3.js";

export const JUPITER_V6_PROGRAM_ID = new PublicKey(
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
);

type JupiterInstruction = {
  programId: string;
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  data: string;
};

type SwapInstructionsResponse = {
  swapInstruction?: JupiterInstruction;
  setupInstructions?: JupiterInstruction[];
  tokenLedgerInstruction?: JupiterInstruction | null;
  error?: string;
};

export type JupiterExecutableQuote = {
  inputAmount: bigint;
  expectedAmountOut: bigint;
  minimumAmountOut: bigint;
  priceImpactPct: number;
  routeHops: number;
};

type RequestedQuote = JupiterExecutableQuote & { response: unknown };

export type JupiterSwap = {
  instructionData: Buffer;
  remainingAccounts: AccountMeta[];
  minimumAmountOut: bigint;
  expectedAmountOut: bigint;
  priceImpactPct: number;
  routeHops: number;
};

async function checkedJson(response: Response, operation: string): Promise<any> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Jupiter ${operation} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function requestJupiterQuote(params: {
  apiUrl: string;
  apiKey: string | undefined;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: bigint;
  slippageBps: number;
  maxAccounts: number;
  signal?: AbortSignal;
}): Promise<RequestedQuote> {
  if (params.amount <= 0n) throw new Error("Jupiter quote amount must be positive");
  const headers: Record<string, string> = {};
  if (params.apiKey) headers["x-api-key"] = params.apiKey;

  const quoteUrl = new URL("/swap/v1/quote", params.apiUrl);
  if (quoteUrl.protocol !== "https:" && quoteUrl.hostname !== "localhost" && quoteUrl.hostname !== "127.0.0.1") {
    throw new Error("Jupiter API must use HTTPS");
  }
  quoteUrl.searchParams.set("inputMint", params.inputMint.toBase58());
  quoteUrl.searchParams.set("outputMint", params.outputMint.toBase58());
  quoteUrl.searchParams.set("amount", params.amount.toString());
  quoteUrl.searchParams.set("swapMode", "ExactIn");
  quoteUrl.searchParams.set("slippageBps", params.slippageBps.toString());
  quoteUrl.searchParams.set("restrictIntermediateTokens", "true");
  quoteUrl.searchParams.set("allowDynamicSwap", "false");
  quoteUrl.searchParams.set("maxAccounts", params.maxAccounts.toString());

  const requestInit: RequestInit = { headers };
  requestInit.signal = params.signal ?? AbortSignal.timeout(15_000);
  const response = await checkedJson(await fetch(quoteUrl, requestInit), "quote");
  if (response.inputMint !== params.inputMint.toBase58() || response.outputMint !== params.outputMint.toBase58()) {
    throw new Error("Jupiter quote mints do not match the configured strategy");
  }
  if (BigInt(response.inAmount) !== params.amount) {
    throw new Error("Jupiter quote is not exact-input for the requested vault amount");
  }
  const expectedAmountOut = BigInt(response.outAmount);
  const minimumAmountOut = BigInt(response.otherAmountThreshold);
  const priceImpactPct = Number.parseFloat(response.priceImpactPct ?? "0");
  const routeHops = Array.isArray(response.routePlan) ? response.routePlan.length : 0;
  if (!Number.isFinite(priceImpactPct) || priceImpactPct < 0) throw new Error("Jupiter returned invalid price impact");
  if (routeHops < 1) throw new Error("Jupiter returned an empty route");
  if (expectedAmountOut <= 0n || minimumAmountOut <= 0n || minimumAmountOut > expectedAmountOut) {
    throw new Error("Jupiter returned invalid output amounts");
  }
  return {
    response,
    inputAmount: params.amount,
    expectedAmountOut,
    minimumAmountOut,
    priceImpactPct,
    routeHops,
  };
}

export async function fetchJupiterExecutableQuote(params: {
  apiUrl: string;
  apiKey: string | undefined;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: bigint;
  slippageBps: number;
  maxAccounts: number;
  signal?: AbortSignal;
}): Promise<JupiterExecutableQuote> {
  const { response: _response, ...quote } = await requestJupiterQuote(params);
  return quote;
}

export async function buildJupiterSwap(params: {
  apiUrl: string;
  apiKey: string | undefined;
  inputMint: PublicKey;
  outputMint: PublicKey;
  userPublicKey: PublicKey;
  amount: bigint;
  slippageBps: number;
  maxAccounts: number;
}): Promise<JupiterSwap> {
  const requested = await requestJupiterQuote(params);
  const headers: Record<string, string> = {};
  if (params.apiKey) headers["x-api-key"] = params.apiKey;

  const instructions = await checkedJson(
    await fetch(new URL("/swap/v1/swap-instructions", params.apiUrl), {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        quoteResponse: requested.response,
        userPublicKey: params.userPublicKey.toBase58(),
        wrapAndUnwrapSol: false,
        useSharedAccounts: false,
        useTokenLedger: false,
        dynamicComputeUnitLimit: false,
        skipUserAccountsRpcCalls: false,
      }),
      signal: AbortSignal.timeout(15_000),
    }),
    "instruction build",
  ) as SwapInstructionsResponse;

  if (!instructions.swapInstruction) {
    throw new Error(`Jupiter did not return a swap instruction: ${instructions.error ?? "unknown error"}`);
  }
  if ((instructions.setupInstructions?.length ?? 0) > 0 || instructions.tokenLedgerInstruction) {
    throw new Error("Jupiter route requires unsupported setup or token-ledger instructions");
  }
  if (instructions.swapInstruction.programId !== JUPITER_V6_PROGRAM_ID.toBase58()) {
    throw new Error("Jupiter response used an unexpected router program");
  }

  return {
    instructionData: Buffer.from(instructions.swapInstruction.data, "base64"),
    remainingAccounts: instructions.swapInstruction.accounts.map((account) => ({
      pubkey: new PublicKey(account.pubkey),
      isSigner: account.pubkey === params.userPublicKey.toBase58(),
      isWritable: account.isWritable,
    })),
    minimumAmountOut: requested.minimumAmountOut,
    expectedAmountOut: requested.expectedAmountOut,
    priceImpactPct: requested.priceImpactPct,
    routeHops: requested.routeHops,
  };
}

export function quoteUsdPriceMicros(options: {
  usdInputAmount: bigint;
  assetOutputAmount: bigint;
  usdDecimals: number;
  assetDecimals: number;
}): bigint {
  return quoteScaledUsdPriceMicros({ ...options, multiplierNano: 1_000_000_000n });
}

export function quoteScaledUsdPriceMicros(options: {
  usdInputAmount: bigint;
  assetOutputAmount: bigint;
  usdDecimals: number;
  assetDecimals: number;
  multiplierNano: bigint;
}): bigint {
  if (options.usdInputAmount <= 0n || options.assetOutputAmount <= 0n) {
    throw new Error("Jupiter price amounts must be positive");
  }
  if (options.multiplierNano <= 0n) throw new Error("xStocks multiplier must be positive");
  if (!Number.isInteger(options.usdDecimals) || options.usdDecimals < 0 || options.usdDecimals > 18 ||
      !Number.isInteger(options.assetDecimals) || options.assetDecimals < 0 || options.assetDecimals > 18) {
    throw new Error("token decimals must be integers between 0 and 18");
  }
  const numerator = options.usdInputAmount * (10n ** BigInt(options.assetDecimals)) *
    1_000_000n * 1_000_000_000n;
  const denominator = options.assetOutputAmount * (10n ** BigInt(options.usdDecimals)) *
    options.multiplierNano;
  return numerator / denominator;
}
