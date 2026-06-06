import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { getServerRedisClient } from "@/lib/serverCache";
import { loadLatestNews } from "@/lib/news";
import { getErrorMessage, logServerEvent, shortHash } from "@/lib/serverLog";
import {
  fetchCombinedYieldOpportunities,
  getOpportunityAssetSymbols,
  type YieldOpportunity,
} from "@/services/yields-aggregator";

export type AlertKind =
  | "apr_above"
  | "apr_below"
  | "best_market_change"
  | "new_market"
  | "daily_digest"
  | "daily_news_brief";

export interface TelegramAlert {
  id: string;
  kind: AlertKind;
  chatId: string;
  tokenSymbol: string;
  protocolKey?: string;
  protocolLabel?: string;
  thresholdApr?: number;
  status: "active" | "paused";
  createdAt: number;
  updatedAt: number;
  lastTriggeredAt?: number;
  state: {
    conditionMet?: boolean;
    lastApr?: number;
    lastOpportunityId?: string;
    lastBestOpportunityId?: string;
    knownOpportunityIds?: string[];
    lastDigestDay?: string;
  };
}

export interface TelegramConnectSession {
  code: string;
  createdAt: number;
  expiresAt: number;
  chatId?: string;
  telegramUserId?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    from?: {
      id?: number | string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    chat?: {
      id?: number | string;
    };
  };
}

export interface TelegramLoginPayload {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number | string;
  hash?: string;
}

export interface TelegramUserConnection {
  userId: string;
  chatId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  updatedAt: number;
}

export interface TelegramNotificationPreferences {
  defiRateAlerts: boolean;
  dailyDefiBrief: boolean;
  latestNewsBrief: boolean;
  ecosystemUpdates: boolean;
  securityUpdates: boolean;
}

const ALERT_REGISTRY_KEY = "onchain-pulse:alerts:registry";
const ALERT_ITEM_PREFIX = "onchain-pulse:alerts:item:";
const CONNECT_PREFIX = "onchain-pulse:telegram-connect:";
const TELEGRAM_USER_PREFIX = "onchain-pulse:telegram-user:";
const TELEGRAM_LOGIN_SESSION_PREFIX = "onchain-pulse:telegram-login-session:";
const CONNECTED_CHATS_KEY = "onchain-pulse:telegram:connected-chats";
const TELEGRAM_PREFERENCES_PREFIX = "onchain-pulse:telegram-preferences:";
const TELEGRAM_OFFSET_KEY = "onchain-pulse:telegram:update-offset";
const WEEKLY_ECOSYSTEM_UPDATE_KEY = "onchain-pulse:telegram:weekly-ecosystem-update";
const WEEKLY_ECOSYSTEM_SENT_PREFIX = "onchain-pulse:telegram:weekly-ecosystem-sent:";
const CONNECT_TTL_SECONDS = 15 * 60;
const LOGIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const TELEGRAM_LOGIN_MAX_AGE_SECONDS = 60 * 60 * 24;
const DAILY_RATES_DIGEST_HOUR_IST = 11;
const DAILY_NEWS_BRIEF_HOUR_IST = 23;
const WEEKLY_ECOSYSTEM_TITLE = "This week's ecosystem updates are out";

const memoryAlerts = new Map<string, TelegramAlert>();
const memoryConnectSessions = new Map<string, TelegramConnectSession>();
const memoryTelegramUsers = new Map<string, TelegramUserConnection>();
const memoryTelegramLoginSessions = new Map<string, { userId: string; expiresAt: number }>();
const memoryConnectedChats = new Set<string>();
const memoryTelegramPreferences = new Map<string, TelegramNotificationPreferences>();
let memoryWeeklyEcosystemUpdate: WeeklyEcosystemUpdate | null = null;
const memoryWeeklyEcosystemSent = new Set<string>();
let memoryTelegramOffset = 0;

const DEFAULT_TELEGRAM_NOTIFICATION_PREFERENCES: TelegramNotificationPreferences = {
  defiRateAlerts: true,
  dailyDefiBrief: true,
  latestNewsBrief: true,
  ecosystemUpdates: true,
  securityUpdates: true,
};

export interface WeeklyEcosystemUpdate {
  title: string;
  twitterUrl: string;
  updatedAt: number;
}

function alertKey(id: string) {
  return `${ALERT_ITEM_PREFIX}${id}`;
}

function connectKey(code: string) {
  return `${CONNECT_PREFIX}${code}`;
}

function telegramUserKey(userId: string) {
  return `${TELEGRAM_USER_PREFIX}${userId}`;
}

function telegramLoginSessionKey(token: string) {
  return `${TELEGRAM_LOGIN_SESSION_PREFIX}${token}`;
}

function telegramPreferencesKey(chatId: string) {
  return `${TELEGRAM_PREFERENCES_PREFIX}${chatId}`;
}

function normalizeTokenSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function normalizeProtocolKey(protocol: string) {
  return protocol.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

function getTelegramBotUsername() {
  return (process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "")
    .replace(/^@/u, "")
    .trim();
}

export function getTelegramAlertConfig() {
  const botUsername = getTelegramBotUsername();
  return {
    configured: Boolean(getTelegramBotToken() && botUsername),
    botUsername,
  };
}

async function readTelegramUser(userId: string) {
  const redis = getServerRedisClient();
  if (!redis) return memoryTelegramUsers.get(userId) || null;
  return redis.get<TelegramUserConnection>(telegramUserKey(userId));
}

async function writeTelegramUser(user: TelegramUserConnection) {
  memoryTelegramUsers.set(user.userId, user);
  const redis = getServerRedisClient();
  if (!redis) return;
  await redis.set(telegramUserKey(user.userId), user);
}

async function createTelegramLoginSession(userId: string) {
  const token = randomUUID().replace(/-/g, "");
  const expiresAt = Date.now() + LOGIN_SESSION_TTL_SECONDS * 1000;
  memoryTelegramLoginSessions.set(token, { userId, expiresAt });
  const redis = getServerRedisClient();
  if (redis) await redis.set(telegramLoginSessionKey(token), { userId, expiresAt }, { ex: LOGIN_SESSION_TTL_SECONDS });
  return token;
}

async function readTelegramLoginSession(token: string) {
  if (!token) return null;
  const redis = getServerRedisClient();
  const session = redis
    ? await redis.get<{ userId: string; expiresAt: number }>(telegramLoginSessionKey(token))
    : memoryTelegramLoginSessions.get(token) || null;

  if (!session || session.expiresAt < Date.now()) return null;
  return session;
}

function normalizeTelegramPreferences(
  preferences?: Partial<TelegramNotificationPreferences> | null
): TelegramNotificationPreferences {
  return {
    ...DEFAULT_TELEGRAM_NOTIFICATION_PREFERENCES,
    ...(preferences || {}),
  };
}

export async function getTelegramNotificationPreferences(chatId: string) {
  if (!chatId) throw new Error("Telegram chat is required");

  const redis = getServerRedisClient();
  const stored = redis
    ? await redis.get<TelegramNotificationPreferences>(telegramPreferencesKey(chatId))
    : memoryTelegramPreferences.get(chatId);

  return normalizeTelegramPreferences(stored);
}

export async function updateTelegramNotificationPreferences(
  chatId: string,
  changes: Partial<TelegramNotificationPreferences>
) {
  if (!chatId) throw new Error("Telegram chat is required");

  const current = await getTelegramNotificationPreferences(chatId);
  const next: TelegramNotificationPreferences = {
    ...current,
    defiRateAlerts: typeof changes.defiRateAlerts === "boolean" ? changes.defiRateAlerts : current.defiRateAlerts,
    dailyDefiBrief: typeof changes.dailyDefiBrief === "boolean" ? changes.dailyDefiBrief : current.dailyDefiBrief,
    latestNewsBrief: typeof changes.latestNewsBrief === "boolean" ? changes.latestNewsBrief : current.latestNewsBrief,
    ecosystemUpdates: typeof changes.ecosystemUpdates === "boolean" ? changes.ecosystemUpdates : current.ecosystemUpdates,
    securityUpdates: typeof changes.securityUpdates === "boolean" ? changes.securityUpdates : current.securityUpdates,
  };

  memoryTelegramPreferences.set(chatId, next);
  const redis = getServerRedisClient();
  if (redis) await redis.set(telegramPreferencesKey(chatId), next);

  return next;
}

async function deleteTelegramNotificationPreferences(chatId: string) {
  memoryTelegramPreferences.delete(chatId);
  const redis = getServerRedisClient();
  if (redis) await redis.del(telegramPreferencesKey(chatId));
}

function preferenceKeyForAlertKind(kind: AlertKind): keyof TelegramNotificationPreferences {
  if (kind === "daily_digest") return "dailyDefiBrief";
  if (kind === "daily_news_brief") return "latestNewsBrief";
  return "defiRateAlerts";
}

export async function isTelegramNotificationCategoryEnabled(
  chatId: string,
  category: keyof TelegramNotificationPreferences
) {
  const preferences = await getTelegramNotificationPreferences(chatId);
  return preferences[category];
}

function timingSafeHexEqual(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifyTelegramLoginPayload(payload: TelegramLoginPayload) {
  const token = getTelegramBotToken();
  if (!token) throw new Error("Telegram bot token is not configured");
  if (!payload.id || !payload.auth_date || !payload.hash) {
    throw new Error("Telegram login payload is incomplete");
  }

  const authDate = Number(payload.auth_date);
  if (!Number.isFinite(authDate)) throw new Error("Telegram login auth date is invalid");
  if (Date.now() / 1000 - authDate > TELEGRAM_LOGIN_MAX_AGE_SECONDS) {
    throw new Error("Telegram login expired. Try again.");
  }

  const data = {
    id: String(payload.id),
    first_name: payload.first_name,
    last_name: payload.last_name,
    username: payload.username,
    photo_url: payload.photo_url,
    auth_date: String(payload.auth_date),
  };

  const dataCheckString = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHash("sha256").update(token).digest();
  const computed = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!timingSafeHexEqual(computed, String(payload.hash))) {
    throw new Error("Telegram login signature is invalid");
  }

  return {
    userId: String(payload.id),
    username: payload.username?.trim() || undefined,
    firstName: payload.first_name?.trim() || undefined,
    lastName: payload.last_name?.trim() || undefined,
    photoUrl: payload.photo_url?.trim() || undefined,
  };
}

export async function verifyTelegramLogin(payload: TelegramLoginPayload) {
  const identity = verifyTelegramLoginPayload(payload);
  const existing = await readTelegramUser(identity.userId);
  const user: TelegramUserConnection = {
    ...existing,
    userId: identity.userId,
    username: identity.username || existing?.username,
    firstName: identity.firstName || existing?.firstName,
    lastName: identity.lastName || existing?.lastName,
    photoUrl: identity.photoUrl || existing?.photoUrl,
    updatedAt: Date.now(),
  };

  await writeTelegramUser(user);
  const loginToken = await createTelegramLoginSession(user.userId);

  return {
    loginToken,
    user,
  };
}

function matchesToken(opp: YieldOpportunity, tokenSymbol: string) {
  if (tokenSymbol === "ANY") return true;
  const selected = normalizeTokenSymbol(tokenSymbol);
  return getOpportunityAssetSymbols(opp).some((symbol) => normalizeTokenSymbol(symbol) === selected);
}

function matchesProtocol(opp: YieldOpportunity, protocolKey?: string) {
  if (!protocolKey || protocolKey === "all") return true;
  return normalizeProtocolKey(opp.protocol) === protocolKey;
}

function opportunityLabel(opp: YieldOpportunity) {
  const assets = getOpportunityAssetSymbols(opp).join(" / ") || "Market";
  return `${assets} on ${opp.protocol}`;
}

function relevantOpportunities(
  opportunities: YieldOpportunity[],
  alert: Pick<TelegramAlert, "tokenSymbol" | "protocolKey">
) {
  return opportunities
    .filter((opp) => opp.action === "LEND")
    .filter((opp) => matchesToken(opp, alert.tokenSymbol))
    .filter((opp) => matchesProtocol(opp, alert.protocolKey))
    .filter((opp) => opp.apr > 0)
    .sort((a, b) => b.apr - a.apr);
}

function findAlreadyMetThresholdAlert(
  opportunities: YieldOpportunity[],
  kind: AlertKind,
  tokenSymbol: string,
  protocolKey: string | undefined,
  thresholdApr?: number
) {
  if ((kind !== "apr_above" && kind !== "apr_below") || typeof thresholdApr !== "number") {
    return undefined;
  }

  const relevant = relevantOpportunities(opportunities, { tokenSymbol, protocolKey });

  if (kind === "apr_above") {
    return relevant.find((opp) => opp.apr >= thresholdApr);
  }

  return relevant
    .filter((opp) => opp.apr <= thresholdApr)
    .sort((a, b) => a.apr - b.apr)[0];
}

async function readAlert(id: string): Promise<TelegramAlert | null> {
  const redis = getServerRedisClient();
  if (!redis) return memoryAlerts.get(id) || null;
  return redis.get<TelegramAlert>(alertKey(id));
}

function publicAlert(alert: TelegramAlert) {
  return {
    id: alert.id,
    kind: alert.kind,
    tokenSymbol: alert.tokenSymbol,
    protocolKey: alert.protocolKey,
    protocolLabel: alert.protocolLabel,
    thresholdApr: alert.thresholdApr,
    status: alert.status,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
    lastTriggeredAt: alert.lastTriggeredAt,
    lastApr: alert.state.lastApr,
  };
}

type PublicTelegramAlert = ReturnType<typeof publicAlert>;

async function writeAlert(alert: TelegramAlert) {
  memoryAlerts.set(alert.id, alert);
  const redis = getServerRedisClient();
  if (!redis) return;
  await redis.set(alertKey(alert.id), alert);
  await redis.sadd(ALERT_REGISTRY_KEY, alert.id);
}

async function listAlertIds() {
  const redis = getServerRedisClient();
  if (!redis) return [...memoryAlerts.keys()];
  const ids = await redis.smembers(ALERT_REGISTRY_KEY);
  return Array.isArray(ids) ? ids.map(String) : [];
}

async function listActiveAlerts() {
  const ids = await listAlertIds();
  const alerts = await Promise.all(ids.map(readAlert));
  return alerts.filter((alert): alert is TelegramAlert => Boolean(alert && alert.status === "active"));
}

async function registerTelegramChat(chatId: string) {
  if (!chatId) return;
  memoryConnectedChats.add(chatId);
  const redis = getServerRedisClient();
  if (!redis) return;
  await redis.sadd(CONNECTED_CHATS_KEY, chatId);
}

export async function listConnectedTelegramChatIds() {
  const redis = getServerRedisClient();
  const connected = redis
    ? (await redis.smembers(CONNECTED_CHATS_KEY)).map(String)
    : [...memoryConnectedChats];
  const ids = await listAlertIds();
  const alerts = await Promise.all(ids.map(readAlert));
  const fromAlerts = alerts
    .filter((alert): alert is TelegramAlert => Boolean(alert?.chatId))
    .map((alert) => alert.chatId);

  return [...new Set([...connected, ...fromAlerts])];
}

export async function listTelegramAlertsForChat(chatId: string) {
  const ids = await listAlertIds();
  const alerts = await Promise.all(ids.map(readAlert));
  return alerts
    .filter((alert): alert is TelegramAlert => Boolean(alert && alert.chatId === chatId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(publicAlert);
}

export async function updateTelegramAlert(
  id: string,
  chatId: string,
  changes: Partial<Pick<TelegramAlert, "status" | "thresholdApr">>
) {
  const alert = await readAlert(id);
  if (!alert || alert.chatId !== chatId) throw new Error("Alert not found");

  const updated: TelegramAlert = {
    ...alert,
    status: changes.status || alert.status,
    thresholdApr: changes.thresholdApr ?? alert.thresholdApr,
    updatedAt: Date.now(),
  };
  await writeAlert(updated);
  return publicAlert(updated);
}

export async function deleteTelegramAlert(id: string, chatId: string) {
  const alert = await readAlert(id);
  if (!alert || alert.chatId !== chatId) throw new Error("Alert not found");

  memoryAlerts.delete(id);
  const redis = getServerRedisClient();
  if (redis) {
    await redis.del(alertKey(id));
    await redis.srem(ALERT_REGISTRY_KEY, id);
  }
}

async function deleteTelegramAlertsForChat(chatId: string) {
  const ids = await listAlertIds();
  const alerts = await Promise.all(ids.map(readAlert));
  const ownedIds = alerts
    .filter((alert): alert is TelegramAlert => Boolean(alert && alert.chatId === chatId))
    .map((alert) => alert.id);

  ownedIds.forEach((id) => memoryAlerts.delete(id));
  const redis = getServerRedisClient();
  if (redis && ownedIds.length > 0) {
    await Promise.all(ownedIds.map((id) => redis.del(alertKey(id))));
    await redis.srem(ALERT_REGISTRY_KEY, ...ownedIds);
  }

  return ownedIds.length;
}

export async function disconnectTelegramChat(chatId: string, loginToken?: string) {
  if (!chatId) throw new Error("Telegram chat is required");

  const deletedAlerts = await deleteTelegramAlertsForChat(chatId);
  await deleteTelegramNotificationPreferences(chatId);
  memoryConnectedChats.delete(chatId);

  const redis = getServerRedisClient();
  if (redis) {
    await redis.srem(CONNECTED_CHATS_KEY, chatId);
  }

  const loginSession = loginToken ? await readTelegramLoginSession(loginToken) : null;
  if (loginSession) {
    const existing = await readTelegramUser(loginSession.userId);
    if (existing?.chatId === chatId) {
      await writeTelegramUser({
        ...existing,
        chatId: undefined,
        updatedAt: Date.now(),
      });
    }
  }

  logServerEvent("info", "alerts.telegram_disconnected", {
    chatId: shortHash(chatId),
    deletedAlerts,
  });

  return { deletedAlerts };
}

async function writeConnectSession(session: TelegramConnectSession) {
  memoryConnectSessions.set(session.code, session);
  const redis = getServerRedisClient();
  if (!redis) return;
  await redis.set(connectKey(session.code), session, { ex: CONNECT_TTL_SECONDS });
}

async function readConnectSession(code: string) {
  const redis = getServerRedisClient();
  if (!redis) return memoryConnectSessions.get(code) || null;
  return redis.get<TelegramConnectSession>(connectKey(code));
}

function createConnectionCode() {
  return `ocp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function createTelegramConnectSession(loginToken?: string) {
  const config = getTelegramAlertConfig();
  if (!config.configured) {
    throw new Error("Telegram bot is not configured");
  }
  const loginSession = loginToken ? await readTelegramLoginSession(loginToken) : null;

  const now = Date.now();
  const session: TelegramConnectSession = {
    code: createConnectionCode(),
    createdAt: now,
    expiresAt: now + CONNECT_TTL_SECONDS * 1000,
    telegramUserId: loginSession?.userId,
  };

  await writeConnectSession(session);

  return {
    ...session,
    botUsername: config.botUsername,
    deepLink: `https://t.me/${config.botUsername}?start=${session.code}`,
  };
}

async function getTelegramUpdates() {
  const token = getTelegramBotToken();
  if (!token) throw new Error("Telegram bot token is not configured");

  const redis = getServerRedisClient();
  const storedOffset = redis ? await redis.get<number>(TELEGRAM_OFFSET_KEY) : memoryTelegramOffset;
  const offset = Number(storedOffset || 0);
  const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  if (offset > 0) url.searchParams.set("offset", String(offset));
  url.searchParams.set("timeout", "0");
  url.searchParams.set("allowed_updates", JSON.stringify(["message"]));

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Telegram getUpdates failed with ${response.status}`);

  const body = await response.json() as { ok?: boolean; result?: TelegramUpdate[] };
  const updates = Array.isArray(body.result) ? body.result : [];
  const latest = updates.reduce((max, update) => Math.max(max, update.update_id), offset - 1);
  const nextOffset = latest + 1;

  if (nextOffset > offset) {
    memoryTelegramOffset = nextOffset;
    if (redis) await redis.set(TELEGRAM_OFFSET_KEY, nextOffset);
  }

  return updates;
}

export async function claimTelegramConnectSession(code: string) {
  const session = await readConnectSession(code);
  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Connection code expired. Create a new one and try again.");
  }

  if (session.chatId) return session;

  const updates = await getTelegramUpdates();
  const match = updates.find((update) => {
    const text = update.message?.text || "";
    return text === `/start ${code}` || text.includes(code);
  });
  const chatId = match?.message?.chat?.id;
  if (!chatId) {
    throw new Error("Telegram message not found yet. Open the bot link, tap Start, then try again.");
  }

  const connected = { ...session, chatId: String(chatId) };
  await writeConnectSession(connected);
  await registerTelegramChat(String(chatId));
  if (connected.telegramUserId) {
    const existing = await readTelegramUser(connected.telegramUserId);
    await writeTelegramUser({
      ...existing,
      userId: connected.telegramUserId,
      chatId: String(chatId),
      updatedAt: Date.now(),
    });
  }
  await sendTelegramMessage(
    String(chatId),
    "Onchain Pulse alerts are connected. You can now create DeFi rate alerts from the app."
  );

  return connected;
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const token = getTelegramBotToken();
  if (!token) throw new Error("Telegram bot token is not configured");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed with ${response.status}: ${body.slice(0, 180)}`);
  }
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function getWeeklyEcosystemUpdate() {
  const redis = getServerRedisClient();
  if (!redis) return memoryWeeklyEcosystemUpdate;
  const update = await redis.get<WeeklyEcosystemUpdate>(WEEKLY_ECOSYSTEM_UPDATE_KEY);
  memoryWeeklyEcosystemUpdate = update || null;
  return memoryWeeklyEcosystemUpdate;
}

export async function setWeeklyEcosystemUpdate(input: {
  twitterUrl: string;
  title?: string;
}) {
  const twitterUrl = input.twitterUrl.trim();
  if (!isValidHttpUrl(twitterUrl)) {
    throw new Error("Add a valid Twitter/X URL.");
  }

  const update: WeeklyEcosystemUpdate = {
    title: input.title?.trim() || WEEKLY_ECOSYSTEM_TITLE,
    twitterUrl,
    updatedAt: Date.now(),
  };

  memoryWeeklyEcosystemUpdate = update;
  const redis = getServerRedisClient();
  if (redis) await redis.set(WEEKLY_ECOSYSTEM_UPDATE_KEY, update);
  return update;
}

function getIstWeekKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const istDateUtc = Date.UTC(value("year"), value("month") - 1, value("day"));
  const dayIndex = (new Date(istDateUtc).getUTCDay() + 6) % 7;
  const weekStartUtc = istDateUtc - dayIndex * 86_400_000;
  return new Date(weekStartUtc).toISOString().slice(0, 10);
}

export function getWeeklyEcosystemWeekKeyForTest(date: Date) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("getWeeklyEcosystemWeekKeyForTest is only available in tests");
  }

  return getIstWeekKey(date);
}

function weeklyEcosystemSentKey(chatId: string, weekKey: string) {
  return `${WEEKLY_ECOSYSTEM_SENT_PREFIX}${weekKey}:${shortHash(chatId)}`;
}

async function hasSentWeeklyEcosystemUpdate(chatId: string, weekKey: string) {
  const key = weeklyEcosystemSentKey(chatId, weekKey);
  const redis = getServerRedisClient();
  if (!redis) return memoryWeeklyEcosystemSent.has(key);
  return Boolean(await redis.get(key));
}

async function markWeeklyEcosystemUpdateSent(chatId: string, weekKey: string) {
  const key = weeklyEcosystemSentKey(chatId, weekKey);
  memoryWeeklyEcosystemSent.add(key);
  const redis = getServerRedisClient();
  if (!redis) return;
  await redis.set(key, "1", { ex: 60 * 60 * 24 * 21 });
}

export async function sendWeeklyEcosystemUpdateIfNeeded() {
  const update = await getWeeklyEcosystemUpdate();
  if (!update?.twitterUrl) return { checked: 0, sent: 0 };

  const chatIds = await listConnectedTelegramChatIds();
  const weekKey = getIstWeekKey();
  let sent = 0;

  for (const chatId of chatIds) {
    try {
      if (await hasSentWeeklyEcosystemUpdate(chatId, weekKey)) continue;
      if (!(await isTelegramNotificationCategoryEnabled(chatId, "ecosystemUpdates"))) continue;
      await sendTelegramMessage(chatId, `${update.title}\n${update.twitterUrl}`);
      await markWeeklyEcosystemUpdateSent(chatId, weekKey);
      sent += 1;
    } catch (error) {
      logServerEvent("warn", "alerts.weekly_ecosystem_failed", {
        chatId: shortHash(chatId),
        error: getErrorMessage(error),
      });
    }
  }

  return { checked: chatIds.length, sent };
}

function buildInitialState(
  kind: AlertKind,
  opportunities: YieldOpportunity[],
  tokenSymbol: string,
  protocolKey: string | undefined,
  thresholdApr?: number
): TelegramAlert["state"] {
  const relevant = relevantOpportunities(opportunities, { tokenSymbol, protocolKey });
  const best = relevant[0];

  if (kind === "apr_above") {
    return {
      conditionMet: best ? best.apr >= Number(thresholdApr || 0) : false,
      lastApr: best?.apr,
      lastOpportunityId: best?.id,
    };
  }

  if (kind === "apr_below") {
    return {
      conditionMet: best ? best.apr <= Number(thresholdApr || 0) : false,
      lastApr: best?.apr,
      lastOpportunityId: best?.id,
    };
  }

  if (kind === "best_market_change") {
    return {
      lastBestOpportunityId: best?.id,
      lastApr: best?.apr,
    };
  }

  if (kind === "daily_digest" || kind === "daily_news_brief") {
    const sendHour =
      kind === "daily_news_brief" ? DAILY_NEWS_BRIEF_HOUR_IST : DAILY_RATES_DIGEST_HOUR_IST;
    return {
      lastDigestDay: getInitialDailyDigestDay(undefined, sendHour),
    };
  }

  return {
    knownOpportunityIds: relevant.map((opp) => opp.id),
  };
}

export async function createTelegramAlert(input: {
  kind: AlertKind;
  chatId: string;
  tokenSymbol?: string;
  protocolKey?: string;
  protocolLabel?: string;
  thresholdApr?: number;
}) {
  if (!input.chatId) throw new Error("Telegram is not connected");
  if ((input.kind === "apr_above" || input.kind === "apr_below") && typeof input.thresholdApr !== "number") {
    throw new Error("APR threshold is required");
  }

  const needsOpportunities = input.kind !== "daily_digest" && input.kind !== "daily_news_brief";
  const opportunities = needsOpportunities ? await fetchCombinedYieldOpportunities() : [];
  const tokenSymbol = normalizeTokenSymbol(input.tokenSymbol || "ANY");
  const protocolKey = input.protocolKey && input.protocolKey !== "all" ? normalizeProtocolKey(input.protocolKey) : undefined;
  const alreadyMet = findAlreadyMetThresholdAlert(
    opportunities,
    input.kind,
    tokenSymbol,
    protocolKey,
    input.thresholdApr
  );
  if (alreadyMet) {
    throw new Error(
      `Alert condition already exists: ${opportunityLabel(alreadyMet)} is ${alreadyMet.apr.toFixed(2)}% APR.`
    );
  }

  const now = Date.now();
  const alert: TelegramAlert = {
    id: randomUUID(),
    kind: input.kind,
    chatId: input.chatId,
    tokenSymbol,
    protocolKey,
    protocolLabel: protocolKey ? input.protocolLabel : undefined,
    thresholdApr: input.thresholdApr,
    status: "active",
    createdAt: now,
    updatedAt: now,
    state: buildInitialState(input.kind, opportunities, tokenSymbol, protocolKey, input.thresholdApr),
  };

  await writeAlert(alert);
  await registerTelegramChat(alert.chatId);
  logServerEvent("info", "alerts.created", {
    alertId: shortHash(alert.id),
    kind: alert.kind,
    tokenSymbol: alert.tokenSymbol,
    protocolKey: alert.protocolKey || "all",
  });
  return alert;
}

function alertTitle(alert: TelegramAlert) {
  if (alert.kind === "apr_above") return `${alert.tokenSymbol} APR crossed above ${alert.thresholdApr}%`;
  if (alert.kind === "apr_below") return `${alert.tokenSymbol} APR dropped below ${alert.thresholdApr}%`;
  if (alert.kind === "best_market_change") return `${alert.tokenSymbol} best market changed`;
  if (alert.kind === "daily_digest") return alert.tokenSymbol === "ANY" ? "Daily DeFi rates digest" : `Daily ${alert.tokenSymbol} rates digest`;
  if (alert.kind === "daily_news_brief") return "Daily latest news brief";
  return alert.tokenSymbol === "ANY" ? "New DeFi market detected" : `New ${alert.tokenSymbol} market detected`;
}

function getDigestDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    day: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour") || 0),
  };
}

export function getInitialDailyDigestDay(createdAt = new Date(), sendHour = DAILY_RATES_DIGEST_HOUR_IST) {
  const { day, hour } = getDigestDateParts(createdAt);
  return hour >= sendHour ? day : undefined;
}

function buildDigestMessage(alert: TelegramAlert, opportunities: YieldOpportunity[]) {
  const relevant = relevantOpportunities(opportunities, alert).slice(0, 5);
  const scope = alert.tokenSymbol === "ANY" ? "watched markets" : alert.tokenSymbol;

  if (relevant.length === 0) {
    return `${alertTitle(alert)}\nNo matching displayed rates found for ${scope} today.`;
  }

  const lines = relevant.map((opp, index) => {
    return `${index + 1}. ${opportunityLabel(opp)} - ${opp.apr.toFixed(2)}% APR`;
  });

  return `${alertTitle(alert)}\nTop displayed rates for ${scope}:\n${lines.join("\n")}`;
}

async function buildLatestNewsBriefMessage() {
  const news = await loadLatestNews();
  const items = news.items.slice(0, 5);

  if (items.length === 0) {
    return "Daily latest news brief\nNo curated news has been added yet.";
  }

  const lines = items.map((item, index) => {
    const summary = item.summary.trim();
    const link = item.link.trim();
    return [
      `${index + 1}. ${item.title}`,
      summary ? `Summary: ${summary}` : "",
      link ? `Source: ${link}` : "",
    ].filter(Boolean).join("\n");
  });

  return `Daily latest news brief\n${lines.join("\n\n")}`;
}

async function maybeTriggerAlert(alert: TelegramAlert, opportunities: YieldOpportunity[]) {
  const relevant = relevantOpportunities(opportunities, alert);
  const best = relevant[0];
  const nextState = { ...alert.state };
  let message = "";

  if (alert.kind === "apr_above") {
    const threshold = Number(alert.thresholdApr || 0);
    const conditionMet = Boolean(best && best.apr >= threshold);
    if (conditionMet && !alert.state.conditionMet && best) {
      message = `${alertTitle(alert)}\n${opportunityLabel(best)} is now ${best.apr.toFixed(2)}% APR.`;
    }
    nextState.conditionMet = conditionMet;
    nextState.lastApr = best?.apr;
    nextState.lastOpportunityId = best?.id;
  }

  if (alert.kind === "apr_below") {
    const threshold = Number(alert.thresholdApr || 0);
    const conditionMet = Boolean(best && best.apr <= threshold);
    if (conditionMet && !alert.state.conditionMet && best) {
      message = `${alertTitle(alert)}\n${opportunityLabel(best)} is now ${best.apr.toFixed(2)}% APR.`;
    }
    nextState.conditionMet = conditionMet;
    nextState.lastApr = best?.apr;
    nextState.lastOpportunityId = best?.id;
  }

  if (alert.kind === "best_market_change") {
    if (best && alert.state.lastBestOpportunityId && best.id !== alert.state.lastBestOpportunityId) {
      message = `${alertTitle(alert)}\nNew top displayed place: ${opportunityLabel(best)} at ${best.apr.toFixed(2)}% APR.`;
    }
    nextState.lastBestOpportunityId = best?.id;
    nextState.lastApr = best?.apr;
  }

  if (alert.kind === "new_market") {
    const known = new Set(alert.state.knownOpportunityIds || []);
    const fresh = relevant.filter((opp) => !known.has(opp.id));
    if (fresh.length > 0) {
      const topFresh = fresh.sort((a, b) => b.apr - a.apr)[0];
      message = `${alertTitle(alert)}\n${opportunityLabel(topFresh)} is showing ${topFresh.apr.toFixed(2)}% APR.`;
    }
    nextState.knownOpportunityIds = relevant.map((opp) => opp.id);
  }

  if (alert.kind === "daily_digest") {
    const { day, hour } = getDigestDateParts();
    const shouldSend = hour >= DAILY_RATES_DIGEST_HOUR_IST && alert.state.lastDigestDay !== day;
    if (shouldSend) {
      message = buildDigestMessage(alert, opportunities);
      nextState.lastDigestDay = day;
    }
  }

  if (alert.kind === "daily_news_brief") {
    const { day, hour } = getDigestDateParts();
    const shouldSend = hour >= DAILY_NEWS_BRIEF_HOUR_IST && alert.state.lastDigestDay !== day;
    if (shouldSend) {
      message = await buildLatestNewsBriefMessage();
      nextState.lastDigestDay = day;
    }
  }

  const categoryEnabled = message
    ? await isTelegramNotificationCategoryEnabled(alert.chatId, preferenceKeyForAlertKind(alert.kind))
    : true;

  const updated: TelegramAlert = {
    ...alert,
    updatedAt: Date.now(),
    lastTriggeredAt: message && categoryEnabled ? Date.now() : alert.lastTriggeredAt,
    state: nextState,
  };

  if (message) {
    if (categoryEnabled) {
      await sendTelegramMessage(alert.chatId, message);
      logServerEvent("info", "alerts.triggered", {
        alertId: shortHash(alert.id),
        kind: alert.kind,
        tokenSymbol: alert.tokenSymbol,
      });
    } else {
      logServerEvent("info", "alerts.trigger_suppressed_by_preferences", {
        alertId: shortHash(alert.id),
        kind: alert.kind,
        tokenSymbol: alert.tokenSymbol,
      });
    }
  }

  await writeAlert(updated);
  return Boolean(message);
}

export async function checkTelegramAlerts() {
  await processTelegramBotCommands().catch((error) => {
    logServerEvent("warn", "alerts.commands_failed", {
      error: getErrorMessage(error),
    });
  });

  const weeklyEcosystem = await sendWeeklyEcosystemUpdateIfNeeded().catch((error) => {
    logServerEvent("warn", "alerts.weekly_ecosystem_check_failed", {
      error: getErrorMessage(error),
    });
    return { checked: 0, sent: 0 };
  });

  const alerts = await listActiveAlerts();
  if (alerts.length === 0) {
    return { checked: 0, triggered: 0, weeklyEcosystem };
  }

  const hasMarketAlerts = alerts.some((alert) => alert.kind !== "daily_news_brief");
  let opportunities: YieldOpportunity[] = [];
  let alertsToCheck = alerts;

  if (hasMarketAlerts) {
    try {
      opportunities = await fetchCombinedYieldOpportunities();
    } catch (error) {
      const newsOnlyAlerts = alerts.filter((alert) => alert.kind === "daily_news_brief");
      if (newsOnlyAlerts.length === 0) throw error;

      alertsToCheck = newsOnlyAlerts;
      logServerEvent("warn", "alerts.market_fetch_failed_news_continues", {
        error: getErrorMessage(error),
      });
    }
  }

  let triggered = 0;

  for (const alert of alertsToCheck) {
    try {
      if (await maybeTriggerAlert(alert, opportunities)) triggered += 1;
    } catch (error) {
      logServerEvent("warn", "alerts.check_failed", {
        alertId: shortHash(alert.id),
        kind: alert.kind,
        error: getErrorMessage(error),
      });
    }
  }

  return { checked: alerts.length, triggered, weeklyEcosystem };
}

async function findAlertForCommand(chatId: string, prefix: string) {
  const ids = await listAlertIds();
  const alerts = await Promise.all(ids.map(readAlert));
  return alerts.find((alert) => alert?.chatId === chatId && alert.id.startsWith(prefix)) || null;
}

function commandAlertLabel(alert: PublicTelegramAlert) {
  const suffix = alert.thresholdApr ? ` ${alert.thresholdApr}%` : "";
  return `${alert.id.slice(0, 8)} - ${alert.kind.replace(/_/g, " ")} ${alert.tokenSymbol}${suffix} (${alert.status})`;
}

async function handleBotCommand(chatId: string, text: string) {
  const normalized = text.trim();
  const [command, arg] = normalized.split(/\s+/u);

  if (command === "/help" || command === "/start") {
    await sendTelegramMessage(
      chatId,
      [
        "Onchain Pulse alert commands:",
        "/alerts - list your alerts",
        "/pause <alert id> - pause an alert",
        "/resume <alert id> - resume an alert",
        "/help - show this message",
      ].join("\n")
    );
    return;
  }

  if (command === "/alerts") {
    const alerts = await listTelegramAlertsForChat(chatId);
    if (alerts.length === 0) {
      await sendTelegramMessage(chatId, "No alerts yet. Create one from the Onchain Pulse Alerts page.");
      return;
    }
    await sendTelegramMessage(
      chatId,
      `Your alerts:\n${alerts.map(commandAlertLabel).join("\n")}`
    );
    return;
  }

  if ((command === "/pause" || command === "/resume") && arg) {
    const alert = await findAlertForCommand(chatId, arg);
    if (!alert) {
      await sendTelegramMessage(chatId, "Alert not found. Use /alerts to see alert IDs.");
      return;
    }
    const status = command === "/pause" ? "paused" : "active";
    await updateTelegramAlert(alert.id, chatId, { status });
    await sendTelegramMessage(chatId, `Alert ${alert.id.slice(0, 8)} is now ${status}.`);
  }
}

async function processTelegramBotCommands() {
  if (!getTelegramBotToken()) return;

  const updates = await getTelegramUpdates();
  for (const update of updates) {
    const text = update.message?.text?.trim();
    const chatId = update.message?.chat?.id;
    if (!text || !chatId) continue;

    const startCode = text.match(/^\/start\s+(ocp_[a-z0-9]+)/iu)?.[1];
    if (startCode) {
      const session = await readConnectSession(startCode);
      if (session && session.expiresAt >= Date.now()) {
        const chatIdString = String(chatId);
        await writeConnectSession({ ...session, chatId: String(chatId) });
        await registerTelegramChat(chatIdString);
        if (session.telegramUserId) {
          const existing = await readTelegramUser(session.telegramUserId);
          await writeTelegramUser({
            ...existing,
            userId: session.telegramUserId,
            chatId: chatIdString,
            username: update.message?.from?.username || existing?.username,
            firstName: update.message?.from?.first_name || existing?.firstName,
            lastName: update.message?.from?.last_name || existing?.lastName,
            updatedAt: Date.now(),
          });
        }
        await sendTelegramMessage(
          chatIdString,
          "Onchain Pulse alerts are connected. Return to the app and press Confirm."
        );
      }
      continue;
    }

    if (text.startsWith("/")) {
      await handleBotCommand(String(chatId), text);
    }
  }
}
