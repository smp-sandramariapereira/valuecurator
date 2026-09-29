import { PublicKey } from "@solana/web3.js";

export const DEFAULT_XSTOCKS_API_URL = "https://api.xstocks.fi/api/v2";

export type XStockAsset = {
  id: string;
  symbol: string;
  name: string;
  underlyingSymbol: string;
  solanaMint: PublicKey;
  tradingHalted: boolean;
  supportsAtomicSwaps: boolean;
};

export type XStockMultiplier = {
  currentMultiplierNano: bigint;
  newMultiplierNano: bigint | null;
  activationTimeMs: number | null;
  reason: string | null;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`invalid ${label}`);
  return value as UnknownRecord;
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`invalid ${label}`);
  return value;
}

function checkedBaseUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("xStocks API must use HTTPS");
  }
  return url;
}

function checkedSymbol(value: string): string {
  const symbol = value.trim();
  if (!/^[A-Za-z0-9.-]{1,32}$/.test(symbol)) throw new Error("invalid xStocks symbol");
  return symbol;
}

function endpoint(apiUrl: string, path: string): URL {
  const base = checkedBaseUrl(apiUrl);
  return new URL(path, base.href.endsWith("/") ? base : `${base.href}/`);
}

async function checkedResponse(response: Response, label: string): Promise<UnknownRecord> {
  if (!response.ok) {
    const body = (await response.text()).slice(0, 240);
    throw new Error(`xStocks ${label} request failed (${response.status}): ${body}`);
  }
  return record(await response.json(), `xStocks ${label} response`);
}

function requestInit(signal?: AbortSignal): RequestInit {
  const init: RequestInit = { headers: { accept: "application/json" } };
  if (signal) init.signal = signal;
  return init;
}

function multiplierNano(value: unknown, label: string): bigint {
  if (typeof value !== "number" && typeof value !== "string") throw new Error(`invalid ${label}`);
  const parsed = typeof value === "number" ? value : Number(value);
  const scaled = Math.round(parsed * 1_000_000_000);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isSafeInteger(scaled) || scaled <= 0) {
    throw new Error(`invalid ${label}`);
  }
  return BigInt(scaled);
}

function activationTimeMs(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || value === 0 || value === "0") return null;
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) throw new Error("invalid multiplier activation time");
    return numeric < 1_000_000_000_000 ? numeric * 1_000 : numeric;
  }
  if (typeof value !== "string") throw new Error("invalid multiplier activation time");
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("invalid multiplier activation time");
  return parsed;
}

function isNoPendingMultiplier(value: unknown): boolean {
  return value === null || value === undefined || value === "" || value === 0 || value === "0";
}

export async function fetchXStockAsset(options: {
  apiUrl?: string;
  symbol: string;
  signal?: AbortSignal;
}): Promise<XStockAsset> {
  const symbol = checkedSymbol(options.symbol);
  const url = endpoint(options.apiUrl ?? DEFAULT_XSTOCKS_API_URL, `public/assets/${encodeURIComponent(symbol)}`);
  const body = await checkedResponse(await fetch(url, requestInit(options.signal)), "asset");
  const deployments = body.deployments;
  if (!Array.isArray(deployments)) throw new Error("invalid xStocks deployments");
  const solana = deployments
    .map((item) => record(item, "xStocks deployment"))
    .find((item) => item.network === "Solana");
  if (!solana) throw new Error(`xStocks asset ${symbol} has no Solana deployment`);
  const address = nonEmpty(solana.address, "Solana deployment address");
  let solanaMint: PublicKey;
  try {
    solanaMint = new PublicKey(address);
  } catch {
    throw new Error("invalid Solana deployment address");
  }

  const underlying = record(body.underlying, "xStocks underlying");
  return {
    id: nonEmpty(body.id, "xStocks id"),
    symbol: nonEmpty(body.symbol, "xStocks symbol"),
    name: nonEmpty(body.name, "xStocks name"),
    underlyingSymbol: nonEmpty(underlying.symbol, "underlying symbol"),
    solanaMint,
    tradingHalted: body.isTradingHalted === true,
    supportsAtomicSwaps: solana.supportsAtomicSwaps === true,
  };
}

export async function fetchXStockMultiplier(options: {
  apiUrl?: string;
  symbol: string;
  signal?: AbortSignal;
}): Promise<XStockMultiplier> {
  const symbol = checkedSymbol(options.symbol);
  const url = endpoint(
    options.apiUrl ?? DEFAULT_XSTOCKS_API_URL,
    `public/assets/${encodeURIComponent(symbol)}/multiplier?network=Solana`,
  );
  const body = await checkedResponse(await fetch(url, requestInit(options.signal)), "multiplier");
  return {
    currentMultiplierNano: multiplierNano(body.currentMultiplier, "current multiplier"),
    newMultiplierNano: isNoPendingMultiplier(body.newMultiplier)
      ? null
      : multiplierNano(body.newMultiplier, "new multiplier"),
    activationTimeMs: activationTimeMs(body.activationDateTime),
    reason: typeof body.reason === "string" && body.reason.trim() ? body.reason : null,
  };
}
