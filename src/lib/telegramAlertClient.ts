"use client";

export const TELEGRAM_CONNECTION_STORAGE_KEY = "onchain-pulse:telegram-alert-connection";
export const TELEGRAM_IDENTITY_STORAGE_KEY = "onchain-pulse:telegram-alert-identity";

export interface StoredTelegramConnection {
  chatId: string;
  connectedAt: number;
}

export interface StoredTelegramIdentity {
  id: string;
  loginToken: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  connectedAt: number;
}

export function readStoredTelegramConnection(): StoredTelegramConnection | null {
  const raw = window.localStorage.getItem(TELEGRAM_CONNECTION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredTelegramConnection>;
    if (!parsed.chatId) return null;
    return {
      chatId: String(parsed.chatId),
      connectedAt: Number(parsed.connectedAt || Date.now()),
    };
  } catch {
    window.localStorage.removeItem(TELEGRAM_CONNECTION_STORAGE_KEY);
    return null;
  }
}

export function saveStoredTelegramConnection(connection: StoredTelegramConnection) {
  window.localStorage.setItem(TELEGRAM_CONNECTION_STORAGE_KEY, JSON.stringify(connection));
}

export function readStoredTelegramIdentity(): StoredTelegramIdentity | null {
  const raw = window.localStorage.getItem(TELEGRAM_IDENTITY_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredTelegramIdentity>;
    if (!parsed.id) return null;
    if (!parsed.loginToken) return null;
    return {
      id: String(parsed.id),
      loginToken: String(parsed.loginToken),
      username: parsed.username ? String(parsed.username) : undefined,
      firstName: parsed.firstName ? String(parsed.firstName) : undefined,
      lastName: parsed.lastName ? String(parsed.lastName) : undefined,
      photoUrl: parsed.photoUrl ? String(parsed.photoUrl) : undefined,
      connectedAt: Number(parsed.connectedAt || Date.now()),
    };
  } catch {
    window.localStorage.removeItem(TELEGRAM_IDENTITY_STORAGE_KEY);
    return null;
  }
}

export function saveStoredTelegramIdentity(identity: StoredTelegramIdentity) {
  window.localStorage.setItem(TELEGRAM_IDENTITY_STORAGE_KEY, JSON.stringify(identity));
}
