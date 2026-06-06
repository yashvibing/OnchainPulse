import { addCuratedNews } from "@/lib/news";
import { getServerRedisClient } from "@/lib/serverCache";
import { getErrorMessage, logServerEvent } from "@/lib/serverLog";
import { listConnectedTelegramChatIds, sendTelegramMessage } from "@/services/telegramAlerts";

interface TrackedAccount {
  username: string;
  priority: number;
}

interface XUser {
  id: string;
  username: string;
  name?: string;
}

interface XTweet {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    repost_count?: number;
    reply_count?: number;
    quote_count?: number;
  };
}

interface StoredTweet {
  id: string;
  username: string;
  text: string;
  url: string;
  createdAt: string;
  score: number;
  publishedAt?: number;
  telegramSentAt?: number;
}

const X_API_BASE = "https://api.x.com/2";
const TRACKED_USER_PREFIX = "onchain-pulse:x:user:";
const SINCE_ID_PREFIX = "onchain-pulse:x:since:";
const TWEET_PREFIX = "onchain-pulse:x:tweet:";
const TWEET_IDS_KEY = "onchain-pulse:x:tweets";
const TELEGRAM_SENT_KEY = "onchain-pulse:x:telegram-sent";
const MAX_ACCOUNTS_PER_RUN = 15;
const MAX_RESULTS_PER_ACCOUNT = 5;
const MAX_NEWS_PER_RUN = 5;
const MAX_TELEGRAM_PER_RUN = 3;
const NEWS_SCORE_THRESHOLD = 4;
const TELEGRAM_SCORE_THRESHOLD = 7;
const USER_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const TWEET_STORAGE_TTL_SECONDS = 30 * 24 * 60 * 60;

const memoryUsers = new Map<string, XUser>();
const memorySinceIds = new Map<string, string>();
const memoryTweets = new Map<string, StoredTweet>();
const memoryTweetIds = new Set<string>();
const memoryTelegramSent = new Set<string>();

function getXBearerToken() {
  return process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || "";
}

function parseTrackedAccounts() {
  return (process.env.X_TRACKED_ACCOUNTS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry): TrackedAccount => {
      const [rawUsername, rawPriority] = entry.split(":");
      return {
        username: rawUsername.replace(/^@/u, "").trim().toLowerCase(),
        priority: Math.min(Math.max(Number(rawPriority || 1) || 1, 1), 5),
      };
    })
    .filter((account) => account.username.length > 0)
    .slice(0, MAX_ACCOUNTS_PER_RUN);
}

async function xFetch<T>(path: string) {
  const token = getXBearerToken();
  if (!token) throw new Error("X_BEARER_TOKEN is not configured");

  const response = await fetch(`${X_API_BASE}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`X API ${response.status}: ${body.slice(0, 180)}`);
  }

  return response.json() as Promise<T>;
}

function userKey(username: string) {
  return `${TRACKED_USER_PREFIX}${username}`;
}

function sinceKey(username: string) {
  return `${SINCE_ID_PREFIX}${username}`;
}

function tweetKey(tweetId: string) {
  return `${TWEET_PREFIX}${tweetId}`;
}

async function readUser(username: string) {
  const cached = memoryUsers.get(username);
  if (cached) return cached;

  const redis = getServerRedisClient();
  if (!redis) return null;
  const user = await redis.get<XUser>(userKey(username));
  if (user) memoryUsers.set(username, user);
  return user;
}

async function writeUser(username: string, user: XUser) {
  memoryUsers.set(username, user);
  const redis = getServerRedisClient();
  if (redis) await redis.set(userKey(username), user, { ex: USER_CACHE_TTL_SECONDS });
}

async function readSinceId(username: string) {
  const local = memorySinceIds.get(username);
  if (local) return local;

  const redis = getServerRedisClient();
  if (!redis) return undefined;
  const sinceId = await redis.get<string>(sinceKey(username));
  if (sinceId) memorySinceIds.set(username, sinceId);
  return sinceId || undefined;
}

async function writeSinceId(username: string, sinceId: string) {
  memorySinceIds.set(username, sinceId);
  const redis = getServerRedisClient();
  if (redis) await redis.set(sinceKey(username), sinceId);
}

async function hasSeenTweet(tweetId: string) {
  if (memoryTweetIds.has(tweetId)) return true;
  const redis = getServerRedisClient();
  if (!redis) return false;
  const seen = await redis.sismember(TWEET_IDS_KEY, tweetId);
  if (seen) memoryTweetIds.add(tweetId);
  return Boolean(seen);
}

async function storeTweet(tweet: StoredTweet) {
  memoryTweetIds.add(tweet.id);
  memoryTweets.set(tweet.id, tweet);

  const redis = getServerRedisClient();
  if (!redis) return;
  await redis.sadd(TWEET_IDS_KEY, tweet.id);
  await redis.set(tweetKey(tweet.id), tweet, { ex: TWEET_STORAGE_TTL_SECONDS });
}

async function markTelegramSent(tweetId: string) {
  memoryTelegramSent.add(tweetId);
  const redis = getServerRedisClient();
  if (redis) await redis.sadd(TELEGRAM_SENT_KEY, tweetId);
}

async function hasTelegramSent(tweetId: string) {
  if (memoryTelegramSent.has(tweetId)) return true;
  const redis = getServerRedisClient();
  if (!redis) return false;
  const sent = await redis.sismember(TELEGRAM_SENT_KEY, tweetId);
  if (sent) memoryTelegramSent.add(tweetId);
  return Boolean(sent);
}

async function resolveUser(username: string) {
  const cached = await readUser(username);
  if (cached) return cached;

  const response = await xFetch<{ data?: XUser }>(
    `/users/by/username/${encodeURIComponent(username)}?user.fields=name,username`
  );
  if (!response.data?.id) throw new Error(`X user not found: ${username}`);
  await writeUser(username, response.data);
  return response.data;
}

async function fetchNewTweets(user: XUser, sinceId?: string) {
  const params = new URLSearchParams({
    max_results: String(MAX_RESULTS_PER_ACCOUNT),
    exclude: "retweets,replies",
    "tweet.fields": "created_at,public_metrics",
  });
  if (sinceId) params.set("since_id", sinceId);

  const response = await xFetch<{ data?: XTweet[]; meta?: { newest_id?: string } }>(
    `/users/${user.id}/tweets?${params.toString()}`
  );

  return {
    tweets: Array.isArray(response.data) ? response.data : [],
    newestId: response.meta?.newest_id,
  };
}

function tweetUrl(username: string, tweetId: string) {
  return `https://x.com/${username}/status/${tweetId}`;
}

function scoreTweet(tweet: XTweet, account: TrackedAccount) {
  const text = tweet.text.toLowerCase();
  let score = Math.max(0, account.priority - 3);

  const criticalKeywords = [
    "exploit",
    "vulnerability",
    "security",
    "incident",
    "pause",
    "maintenance",
    "downtime",
  ];
  const strongKeywords = [
    "launch",
    "mainnet",
    "integration",
    "partnership",
    "airdrop",
    "claim",
    "migration",
    "listing",
    "funding",
    "testnet",
    "monad",
    "evm",
    "research",
    "paper",
    "protocol",
    "compliance",
    "institution",
  ];
  const lowSignalWords = ["gm", "gn", "meme", "vibes"];

  score += criticalKeywords.filter((keyword) => text.includes(keyword)).length * 3;
  score += strongKeywords.filter((keyword) => text.includes(keyword)).length * 2;
  if (/https?:\/\//u.test(tweet.text)) score += 1;
  if (lowSignalWords.some((word) => text === word || text.startsWith(`${word} `))) score -= 2;

  const metrics = tweet.public_metrics;
  if (metrics) {
    const engagement =
      (metrics.like_count || 0) +
      (metrics.repost_count || 0) * 2 +
      (metrics.reply_count || 0) +
      (metrics.quote_count || 0) * 2;
    if (engagement >= 100) score += 2;
    else if (engagement >= 25) score += 1;
  }

  return score;
}

function titleForTweet(tweet: StoredTweet) {
  const clean = tweet.text.replace(/\s+/g, " ").trim();
  const clipped = clean.length > 84 ? `${clean.slice(0, 81).trimEnd()}...` : clean;
  return `@${tweet.username}: ${clipped}`;
}

function telegramMessageForTweet(tweet: StoredTweet) {
  return [
    "Important Monad ecosystem update",
    `@${tweet.username}`,
    "",
    tweet.text,
    "",
    tweet.url,
  ].join("\n");
}

async function publishTweetToLatestNews(tweet: StoredTweet) {
  await addCuratedNews({
    url: tweet.url,
    title: titleForTweet(tweet),
    summary: tweet.text,
    source: `X / @${tweet.username}`,
    topic: "Monad",
    publishedAt: tweet.createdAt,
  });
}

async function sendTweetToTelegram(tweet: StoredTweet) {
  if (await hasTelegramSent(tweet.id)) return 0;
  const chatIds = await listConnectedTelegramChatIds();
  let sent = 0;

  for (const chatId of chatIds) {
    try {
      await sendTelegramMessage(chatId, telegramMessageForTweet(tweet));
      sent += 1;
    } catch (error) {
      logServerEvent("warn", "x.telegram_send_failed", {
        tweetId: tweet.id,
        error: getErrorMessage(error),
      });
    }
  }

  if (sent > 0) await markTelegramSent(tweet.id);
  return sent;
}

function newestTweetId(tweets: XTweet[], fallback?: string) {
  const ids = tweets.map((tweet) => tweet.id).filter(Boolean);
  if (fallback) ids.push(fallback);
  if (ids.length === 0) return undefined;

  return ids.sort((a, b) => {
    const left = BigInt(a);
    const right = BigInt(b);
    if (left === right) return 0;
    return left > right ? -1 : 1;
  })[0];
}

export async function ingestTrackedXTweets() {
  const accounts = parseTrackedAccounts();
  const configured = Boolean(getXBearerToken());

  if (!configured || accounts.length === 0) {
    return {
      configured,
      accounts: accounts.length,
      fetched: 0,
      newTweets: 0,
      published: 0,
      telegramSent: 0,
    };
  }

  let fetched = 0;
  let newTweets = 0;
  let published = 0;
  let telegramSent = 0;
  let publishedThisRun = 0;
  let telegramThisRun = 0;

  for (const account of accounts) {
    try {
      const user = await resolveUser(account.username);
      const sinceId = await readSinceId(account.username);
      const result = await fetchNewTweets(user, sinceId);
      fetched += result.tweets.length;

      const newestId = newestTweetId(result.tweets, result.newestId);
      if (newestId) await writeSinceId(account.username, newestId);

      for (const tweet of result.tweets.reverse()) {
        if (await hasSeenTweet(tweet.id)) continue;

        const stored: StoredTweet = {
          id: tweet.id,
          username: user.username || account.username,
          text: tweet.text.trim(),
          url: tweetUrl(user.username || account.username, tweet.id),
          createdAt: tweet.created_at || new Date().toISOString(),
          score: scoreTweet(tweet, account),
        };

        await storeTweet(stored);
        newTweets += 1;

        if (stored.score >= NEWS_SCORE_THRESHOLD && publishedThisRun < MAX_NEWS_PER_RUN) {
          await publishTweetToLatestNews(stored);
          stored.publishedAt = Date.now();
          await storeTweet(stored);
          published += 1;
          publishedThisRun += 1;
        }

        if (stored.score >= TELEGRAM_SCORE_THRESHOLD && telegramThisRun < MAX_TELEGRAM_PER_RUN) {
          telegramSent += await sendTweetToTelegram(stored);
          telegramThisRun += 1;
        }
      }
    } catch (error) {
      logServerEvent("warn", "x.account_ingest_failed", {
        username: account.username,
        error: getErrorMessage(error),
      });
    }
  }

  logServerEvent("info", "x.ingest_complete", {
    accounts: accounts.length,
    fetched,
    newTweets,
    published,
    telegramSent,
  });

  return {
    configured,
    accounts: accounts.length,
    fetched,
    newTweets,
    published,
    telegramSent,
  };
}
