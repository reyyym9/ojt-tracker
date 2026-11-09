import { SUPABASE_URL, SUPABASE_KEY, GOOGLE_WEB_CLIENT_ID, DRIVE_SCOPE } from './config.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const nativeLogin = window.Capacitor?.Plugins?.SocialLogin;
const TOKEN_KEY = 'ojt-drive-token', NOT_CONNECTED_KEY = 'ojt-drive-not-connected', STATE_KEY = 'ojt-drive-state';
const NOT_CONNECTED_WAIT = 5 * 60 * 1000;                            // how long to wait before asking the server again

const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');

// ---- sign-in ----
async function signInAndroid() {
  await nativeLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID, mode: 'online' } });
  const rawNonce = hex(crypto.getRandomValues(new Uint8Array(32)));
  const hashedNonce = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce)));
  const { result } = await nativeLogin.login({
    provider: 'google',
    options: { scopes: ['email', 'profile'], nonce: hashedNonce },
  });
  const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token: result.idToken, nonce: rawNonce });
  if (error) throw error;
}

async function signInWeb() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: new URL('settings.html', location.href).href },
  });
  if (error) throw error;
}

export const signIn = () => (nativeLogin ? signInAndroid() : signInWeb());
export const getUser = async () => (await sb.auth.getSession()).data.session?.user ?? null;

export async function signOut() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(NOT_CONNECTED_KEY);
  await sb.auth.signOut();
}

// ---- Google Drive: the drive-token Edge Function keeps the connection alive ----
function rememberToken(token, seconds = 3300) {
  sessionStorage.removeItem(NOT_CONNECTED_KEY);
  if (token) sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expires: Date.now() + seconds * 1000 }));
}

export function getDriveToken() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY));
    return saved && saved.expires > Date.now() ? saved.token : null;
  } catch { return null; }
}

async function callDriveFunction(body) {
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new Error('drive-auth');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/drive-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'drive-function-failed');
  return result;
}

const askedRecently = () => Date.now() - Number(sessionStorage.getItem(NOT_CONNECTED_KEY) || 0) < NOT_CONNECTED_WAIT;

// Returns a working Drive token, asking the server for a new one when needed. Null means not connected.
let pendingToken = null;
export function ensureDriveToken() {
  const saved = getDriveToken();
  if (saved) return Promise.resolve(saved);
  if (navigator.onLine === false || askedRecently()) return Promise.resolve(null);
  if (!pendingToken) {
    pendingToken = callDriveFunction({ action: 'token' })
      .then(result => {
        if (result.access_token) { rememberToken(result.access_token, result.expires_in - 60); return result.access_token; }
        sessionStorage.setItem(NOT_CONNECTED_KEY, String(Date.now()));
        return null;
      })
      .catch(() => null)
      .finally(() => { pendingToken = null; });
  }
  return pendingToken;
}

const driveRedirectUri = () => new URL('settings.html', location.href).href;

async function connectDriveWeb() {
  const state = hex(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(STATE_KEY, state);
  const user = await getUser();
  const params = new URLSearchParams({
    client_id: GOOGLE_WEB_CLIENT_ID, redirect_uri: driveRedirectUri(), response_type: 'code', scope: DRIVE_SCOPE,
    access_type: 'offline', prompt: 'consent', state, login_hint: user?.email || '',
  });
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  return new Promise(() => {});                                      // the page is leaving for Google
}

async function connectDriveAndroid() {
  await nativeLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID, mode: 'offline' } });
  const { result } = await nativeLogin.login({ provider: 'google', options: { scopes: [DRIVE_SCOPE], forceRefreshToken: true } });
  const connected = await callDriveFunction({ action: 'exchange', code: result.serverAuthCode, redirectUri: '' });
  rememberToken(connected.access_token, connected.expires_in - 60);
}

export const connectDrive = () => (nativeLogin ? connectDriveAndroid() : connectDriveWeb());

// Finishes connecting after Google sends the browser back to settings.html. Returns true if it connected.
export async function finishDriveConnect() {
  const params = new URLSearchParams(location.search);
  const state = params.get('state'), code = params.get('code'), error = params.get('error');
  if (!state || (!code && !error)) return false;
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  history.replaceState(null, '', location.pathname);                 // removes the one-time code from the address bar
  if (state !== expected) throw new Error('Could not verify the Google response. Please tap Connect again.');
  if (error) throw new Error(error === 'access_denied' ? 'Google Drive was not connected.' : 'Google could not connect Drive. Please try again.');
  const connected = await callDriveFunction({ action: 'exchange', code, redirectUri: driveRedirectUri() });
  rememberToken(connected.access_token, connected.expires_in - 60);
  return true;
}

export async function driveFetch(url, options = {}, retry = true) {
  const token = await ensureDriveToken();
  if (!token) throw new Error('drive-auth');
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
  if (response.status !== 401) return response;
  sessionStorage.removeItem(TOKEN_KEY);                              // token no longer valid: get a new one once
  if (retry) return driveFetch(url, options, false);
  throw new Error('drive-auth');
}
