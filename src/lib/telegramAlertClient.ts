"use client";

export const TELEGRAM_CONNECTION_STORAGE_KEY = "onchain-pulse:telegram-alert-connection";

export interface StoredTelegramConnection {
  chatId: string;
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
