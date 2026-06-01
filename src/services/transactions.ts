import { formatUnits, getAddress } from "viem";
import { fetchJsonWithRetry } from "@/lib/sourceFetch";

const BLOCKVISION_ACCOUNT_ACTIVITIES_URL =
  "https://api.blockvision.org/v2/monad/account/activities";
const BLOCKVISION_ACCOUNT_TRANSACTIONS_URL =
  "https://api.blockvision.org/v2/monad/account/transactions";

type RawRecord = Record<string, unknown>;

export interface WalletTransaction {
  hash: string;
  timestamp: number | null;
  method: string;
  from: string;
  to: string;
  direction: "in" | "out" | "self" | "unknown";
  amount: string;
  symbol: string;
  valueUsd: number | null;
  status: "success" | "failed" | "unknown";
}

export interface WalletTransactionHistory {
  address: string;
  transactions: WalletTransaction[];
  nextCursor: string;
  fetchedAt: number;
}

function getNested(record: RawRecord, path: string[]) {
  let value: unknown = record;
  for (const part of path) {
    value = value && typeof value === "object" ? (value as RawRecord)[part] : undefined;
  }
  return value;
}

function getNestedString(record: RawRecord, paths: string[][]) {
  for (const path of paths) {
    const value = getNested(record, path);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "bigint") return value.toString();
  }
  return "";
}

function getNestedNumber(record: RawRecord, paths: string[][]) {
  const raw = getNestedString(record, paths).replace(/,/g, "");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function findRecords(payload: unknown): RawRecord[] {
  const candidates = [
    payload,
    (payload as RawRecord | undefined)?.result,
    (payload as RawRecord | undefined)?.data,
    ((payload as RawRecord | undefined)?.result as RawRecord | undefined)?.data,
    ((payload as RawRecord | undefined)?.data as RawRecord | undefined)?.data,
    ((payload as RawRecord | undefined)?.result as RawRecord | undefined)?.items,
    ((payload as RawRecord | undefined)?.data as RawRecord | undefined)?.items,
    ((payload as RawRecord | undefined)?.result as RawRecord | undefined)?.activities,
    ((payload as RawRecord | undefined)?.data as RawRecord | undefined)?.activities,
    ((payload as RawRecord | undefined)?.result as RawRecord | undefined)?.transactions,
    ((payload as RawRecord | undefined)?.data as RawRecord | undefined)?.transactions,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as RawRecord[];
  }

  return [];
}

function findCursor(payload: unknown) {
  const record = payload as RawRecord | undefined;
  const result = record?.result as RawRecord | undefined;
  const data = record?.data as RawRecord | undefined;
  return (
    getNestedString(record || {}, [["nextCursor"], ["cursor"], ["nextPageCursor"]]) ||
    getNestedString(result || {}, [["nextCursor"], ["cursor"], ["nextPageCursor"]]) ||
    getNestedString(data || {}, [["nextCursor"], ["cursor"], ["nextPageCursor"]])
  );
}

function parseTimestamp(record: RawRecord) {
  const raw = getNestedString(record, [
    ["timestamp"],
    ["time"],
    ["blockTimestamp"],
    ["block_time"],
    ["createdAt"],
    ["date"],
  ]);
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAddress(value: string) {
  if (!/^0x[a-fA-F0-9]{40}$/u.test(value)) return "";
  try {
    return getAddress(value);
  } catch {
    return value;
  }
}

function parseDirection(from: string, to: string, owner: string): WalletTransaction["direction"] {
  const normalizedOwner = owner.toLowerCase();
  const fromOwner = from.toLowerCase() === normalizedOwner;
  const toOwner = to.toLowerCase() === normalizedOwner;
  if (fromOwner && toOwner) return "self";
  if (toOwner) return "in";
  if (fromOwner) return "out";
  return "unknown";
}

function parseStatus(record: RawRecord): WalletTransaction["status"] {
  const raw = getNestedString(record, [
    ["status"],
    ["txStatus"],
    ["transactionStatus"],
    ["receiptStatus"],
  ]).toLowerCase();

  if (["1", "success", "successful", "confirmed"].includes(raw)) return "success";
  if (["0", "fail", "failed", "reverted"].includes(raw)) return "failed";
  return "unknown";
}

function parseAmount(record: RawRecord) {
  const decimals =
    getNestedNumber(record, [
      ["decimals"],
      ["tokenDecimals"],
      ["token", "decimals"],
      ["contract", "decimals"],
    ]) ?? 18;

  const rawAmount = getNestedString(record, [
    ["amountRaw"],
    ["rawAmount"],
    ["valueRaw"],
    ["rawValue"],
    ["tokenAmountRaw"],
    ["token", "amountRaw"],
    ["transfer", "amountRaw"],
  ]).replace(/,/g, "");

  if (/^\d+$/u.test(rawAmount)) {
    const formatted = Number(formatUnits(BigInt(rawAmount), decimals));
    if (Number.isFinite(formatted)) return trimAmount(formatted);
  }

  const amount = getNestedString(record, [
    ["amount"],
    ["value"],
    ["quantity"],
    ["tokenAmount"],
    ["tokenValue"],
    ["transfer", "amount"],
    ["transfer", "value"],
  ]).replace(/,/g, "");

  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return "";
  if (amount.length > 15 && Number.isInteger(parsed) && decimals > 0) {
    const formatted = Number(formatUnits(BigInt(amount), decimals));
    if (Number.isFinite(formatted)) return trimAmount(formatted);
  }

  return trimAmount(parsed);
}

function trimAmount(value: number) {
  if (value === 0) return "0";
  if (Math.abs(value) < 0.0001) return "<0.0001";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 1 ? 4 : 6,
  });
}

function normalizeTransaction(record: RawRecord, owner: string): WalletTransaction | null {
  const hash = getNestedString(record, [
    ["hash"],
    ["txHash"],
    ["transactionHash"],
    ["transaction_hash"],
    ["txnHash"],
  ]);
  if (!hash) return null;

  const from = normalizeAddress(
    getNestedString(record, [
      ["from"],
      ["fromAddress"],
      ["sender"],
      ["addressFrom"],
      ["transaction", "from"],
    ])
  );
  const to = normalizeAddress(
    getNestedString(record, [
      ["to"],
      ["toAddress"],
      ["receiver"],
      ["recipient"],
      ["addressTo"],
      ["transaction", "to"],
    ])
  );
  const symbol =
    getNestedString(record, [
      ["symbol"],
      ["tokenSymbol"],
      ["assetSymbol"],
      ["token", "symbol"],
      ["contract", "symbol"],
    ]) || "MON";
  const method =
    getNestedString(record, [
      ["method"],
      ["methodName"],
      ["functionName"],
      ["type"],
      ["action"],
      ["activityType"],
    ]) || "Transaction";

  return {
    hash,
    timestamp: parseTimestamp(record),
    method,
    from,
    to,
    direction: parseDirection(from, to, owner),
    amount: parseAmount(record),
    symbol,
    valueUsd: getNestedNumber(record, [
      ["valueUsd"],
      ["usdValue"],
      ["amountUsd"],
      ["token", "valueUsd"],
    ]),
    status: parseStatus(record),
  };
}

async function fetchBlockVisionPayload(url: string, walletAddress: string, limit: number, cursor: string) {
  const params = new URLSearchParams({
    address: walletAddress,
    limit: String(Math.min(Math.max(limit, 1), 50)),
    ascendingOrder: "false",
  });
  if (cursor) params.set("cursor", cursor);

  return fetchJsonWithRetry<unknown>(`${url}?${params.toString()}`, {
    headers: {
      accept: "application/json",
      "x-api-key": process.env.BLOCKVISION_API_KEY || "",
    },
    retries: 1,
    timeoutMs: 8_000,
    sourceName: url.includes("/activities")
      ? "blockvision-account-activities"
      : "blockvision-account-transactions",
  });
}

export async function fetchWalletTransactionHistory(
  address: `0x${string}`,
  options: { limit?: number; cursor?: string } = {}
): Promise<WalletTransactionHistory> {
  if (!process.env.BLOCKVISION_API_KEY) {
    throw new Error("BLOCKVISION_API_KEY is not configured.");
  }

  const walletAddress = getAddress(address);
  const limit = options.limit || 20;
  const cursor = options.cursor || "";

  const activitiesPayload = await fetchBlockVisionPayload(
    BLOCKVISION_ACCOUNT_ACTIVITIES_URL,
    walletAddress,
    limit,
    cursor
  );
  let records = findRecords(activitiesPayload);
  let nextCursor = findCursor(activitiesPayload);

  if (records.length === 0) {
    const transactionsPayload = await fetchBlockVisionPayload(
      BLOCKVISION_ACCOUNT_TRANSACTIONS_URL,
      walletAddress,
      limit,
      cursor
    );
    records = findRecords(transactionsPayload);
    nextCursor = findCursor(transactionsPayload);
  }

  return {
    address: walletAddress,
    transactions: records
      .map((record) => normalizeTransaction(record, walletAddress))
      .filter((record): record is WalletTransaction => Boolean(record))
      .slice(0, limit),
    nextCursor,
    fetchedAt: Date.now(),
  };
}
