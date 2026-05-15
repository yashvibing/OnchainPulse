import { isValidEvmAddress } from "@/lib/format";

export interface SavedAddress {
  address: string;
  label: string;
  savedAt: number;
}

const STORAGE_KEY = "onchainpulse:saved-addresses";
const LAST_ADDRESS_KEY = "onchainpulse:last-address";

function fallbackLabel(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function loadSavedAddresses(): SavedAddress[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && isValidEvmAddress(String(item.address || "")))
      .map((item) => ({
        address: String(item.address),
        label: String(item.label || fallbackLabel(String(item.address))),
        savedAt: Number(item.savedAt || Date.now()),
      }));
  } catch {
    return [];
  }
}

export function saveAddress(address: string, label?: string) {
  if (typeof window === "undefined" || !isValidEvmAddress(address)) return [];

  const normalized = address;
  const nextAddress = {
    address: normalized,
    label: label || fallbackLabel(normalized),
    savedAt: Date.now(),
  };
  const withoutDuplicate = loadSavedAddresses().filter(
    (item) => item.address.toLowerCase() !== normalized.toLowerCase()
  );
  const next = [nextAddress, ...withoutDuplicate].slice(0, 8);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.localStorage.setItem(LAST_ADDRESS_KEY, normalized);
  return next;
}

export function removeSavedAddress(address: string) {
  if (typeof window === "undefined") return [];

  const next = loadSavedAddresses().filter(
    (item) => item.address.toLowerCase() !== address.toLowerCase()
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getLastAddress() {
  if (typeof window === "undefined") return "";
  const address = window.localStorage.getItem(LAST_ADDRESS_KEY) || "";
  return isValidEvmAddress(address) ? address : "";
}
