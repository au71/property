import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../api/client';

/**
 * On a device, tokens live in the platform keychain/keystore rather than
 * AsyncStorage: AsyncStorage is plain files, readable on a rooted or jailbroken
 * handset and included in device backups.
 *
 * expo-secure-store has no web implementation — calling it there throws
 * "getValueWithKeyAsync is not a function" and takes the whole auth provider
 * down with it. The web target (`npm run web`, and Expo's own preview) falls
 * back to localStorage, which is the best a browser offers anyway. Native is
 * the shipping target; web is for development.
 */
const ACCESS_KEY = 'property.access';
const REFRESH_KEY = 'property.refresh';

const isWeb = Platform.OS === 'web';

async function readItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      // Private mode and blocked site data both throw on access.
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function writeItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* nothing useful to do if storage is unavailable */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* as above */
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getAccessToken(): Promise<string | undefined> {
  return (await readItem(ACCESS_KEY)) ?? undefined;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await readItem(REFRESH_KEY)) ?? undefined;
}

export async function saveSession(accessToken: string, refreshToken?: string): Promise<void> {
  await writeItem(ACCESS_KEY, accessToken);
  if (refreshToken) await writeItem(REFRESH_KEY, refreshToken);
}

export async function clearSession(): Promise<void> {
  await Promise.all([removeItem(ACCESS_KEY), removeItem(REFRESH_KEY)]);
}

/**
 * Exchanges the refresh token for a new pair. Returns the new access token, or
 * undefined when the session is genuinely over.
 *
 * Deliberately does not go through apiFetch: that would recurse on a 401.
 */
export async function refreshSession(): Promise<string | undefined> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return undefined;

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client': 'mobile' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      // The API revokes a whole token family when it detects reuse, so a
      // rejected refresh means the stored pair is dead, not retryable.
      await clearSession();
      return undefined;
    }
    const payload = (await response.json()) as { accessToken?: string; refreshToken?: string };
    if (!payload.accessToken) return undefined;
    await saveSession(payload.accessToken, payload.refreshToken);
    return payload.accessToken;
  } catch {
    // A network failure is not an expired session; keep the tokens.
    return undefined;
  }
}
