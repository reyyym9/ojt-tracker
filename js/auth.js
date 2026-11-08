import { SUPABASE_URL, SUPABASE_KEY, GOOGLE_WEB_CLIENT_ID, DRIVE_SCOPE } from './config.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const nativeLogin = window.Capacitor?.Plugins?.SocialLogin;
const TOKEN_KEY = 'ojt-drive-token';

function rememberToken(token, seconds = 3300) {
  if (token) sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expires: Date.now() + seconds * 1000 }));
}

export function getDriveToken() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY));
    return saved && saved.expires > Date.now() ? saved.token : null;
  } catch { return null; }
}

const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');

async function signInAndroid() {
  await nativeLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID, mode: 'online' } });
  const rawNonce = hex(crypto.getRandomValues(new Uint8Array(32)));
  const hashedNonce = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce)));
  const { result } = await nativeLogin.login({
    provider: 'google',
    options: { scopes: ['email', 'profile', DRIVE_SCOPE], nonce: hashedNonce },
  });
  const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token: result.idToken, nonce: rawNonce });
  if (error) throw error;
  rememberToken(result.accessToken);
}

async function signInWeb() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: new URL('settings.html', location.href).href },
  });
  if (error) throw error;
}

function connectDriveWeb() {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_WEB_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: response => {
        if (response.error) return reject(new Error(response.error));
        rememberToken(response.access_token, response.expires_in - 60);
        resolve(response.access_token);
      },
      error_callback: reject,
    });
    client.requestAccessToken({ prompt: '' });
  });
}

export const signIn = () => (nativeLogin ? signInAndroid() : signInWeb());
export const connectDrive = () => (nativeLogin ? signInAndroid() : connectDriveWeb());
export const getUser = async () => (await sb.auth.getSession()).data.session?.user ?? null;

export async function signOut() {
  sessionStorage.removeItem(TOKEN_KEY);
  await sb.auth.signOut();
}

export async function driveFetch(url, options = {}) {
  const token = getDriveToken();
  if (!token) throw new Error('drive-auth');
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    throw new Error('drive-auth');
  }
  return response;
}