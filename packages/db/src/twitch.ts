import { decrypt, encrypt } from "./crypto";

// Twitch OAuth token bundle, stored AES-GCM-encrypted in settings.*TokenEnc.
// Shape matches @twurple/auth's AccessToken so the worker can hand it straight
// to RefreshingAuthProvider (db package stays twurple-free).
export interface StoredTwitchToken {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  obtainmentTimestamp: number;
  scope: string[];
}

export function encodeToken(t: StoredTwitchToken): string {
  return encrypt(JSON.stringify(t));
}

export function decodeToken(blob: string): StoredTwitchToken {
  return JSON.parse(decrypt(blob)) as StoredTwitchToken;
}
