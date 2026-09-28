const TOKEN_KEY = "karaoke_token";
const NAME_KEY = "karaoke_name";
const HOST_KEY_PREFIX = "karaoke_host_";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getDeviceToken(): string {
  if (typeof window === "undefined") return "";
  let token = window.localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = randomId();
    window.localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export function getSavedName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function saveName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NAME_KEY, name);
}

export function saveHostToken(code: string, token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HOST_KEY_PREFIX + code.toUpperCase(), token);
}

export function getHostToken(code: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(HOST_KEY_PREFIX + code.toUpperCase());
}

export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function makeToken(): string {
  return randomId();
}
