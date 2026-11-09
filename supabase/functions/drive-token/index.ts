// DRIVE TOKEN: keeps Google Drive connected without asking the user again.
// The browser and app cannot safely hold the Google client secret or a long-lived Google token,
// so this function keeps them on the server and hands out short-lived Drive tokens.
//   action "exchange": turns Google's one-time code into tokens and stores the refresh token (encrypted)
//   action "token"   : returns a fresh short-lived Drive token, or { connected: false }
// Secrets to set: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DRIVE_TOKEN_KEY (32 random bytes, base64)

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const ALLOWED_ORIGINS = ['https://reyyym9.github.io', 'http://localhost:5500', 'https://localhost'];
// Web pages Google may return to. The Android app sends an empty redirect address.
const ALLOWED_REDIRECTS = ['https://reyyym9.github.io/ojt-tracker/settings.html', 'http://localhost:5500/settings.html', ''];

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret: ${name}`);
  return value;
};

// New projects expose secret keys as a JSON list; older projects use the service role key
function serverKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    const key = JSON.parse(keys).default;
    if (key) return key;
  }
  return env('SUPABASE_SERVICE_ROLE_KEY');
}

function serverHeaders(): Record<string, string> {
  const key = serverKey();
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

// ---- who is calling? ----
async function userIdFrom(request: Request): Promise<string | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: serverKey(), Authorization: authorization },
  });
  if (!response.ok) return null;
  return (await response.json()).id ?? null;
}

// ---- encryption, so a database leak alone does not expose Google access ----
const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const encryptionKey = (usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', fromBase64(env('DRIVE_TOKEN_KEY')), 'AES-GCM', false, [usage]);

async function encrypt(text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey('encrypt'), new TextEncoder().encode(text));
  return `${toBase64(iv)}.${toBase64(new Uint8Array(data))}`;
}

async function decrypt(stored: string): Promise<string> {
  const [iv, data] = stored.split('.').map(fromBase64);
  const text = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await encryptionKey('decrypt'), data);
  return new TextDecoder().decode(text);
}

// ---- the private table (only this function can reach it) ----
const tableUrl = () => `${env('SUPABASE_URL')}/rest/v1/drive_tokens`;

async function saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const response = await fetch(tableUrl(), {
    method: 'POST',
    headers: { ...serverHeaders(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: userId, refresh_token: await encrypt(refreshToken), updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Could not save token (${response.status})`);
}

async function loadRefreshToken(userId: string): Promise<string | null> {
  const response = await fetch(`${tableUrl()}?user_id=eq.${encodeURIComponent(userId)}&select=refresh_token`, { headers: serverHeaders() });
  if (!response.ok) throw new Error(`Could not read token (${response.status})`);
  const rows = await response.json();
  return rows[0] ? decrypt(rows[0].refresh_token) : null;
}

async function forgetRefreshToken(userId: string): Promise<void> {
  const response = await fetch(`${tableUrl()}?user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers: serverHeaders() });
  if (!response.ok) throw new Error(`Could not remove token (${response.status})`);
}

// ---- Google ----
async function askGoogle(fields: Record<string, string>) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), ...fields }),
  });
  return { ok: response.ok, body: await response.json().catch(() => ({})) };
}

async function exchange(userId: string, code: unknown, redirectUri: unknown) {
  if (typeof code !== 'string' || !code || typeof redirectUri !== 'string' || !ALLOWED_REDIRECTS.includes(redirectUri)) {
    return { status: 400, body: { error: 'bad_request' } };
  }
  const google = await askGoogle({ code, grant_type: 'authorization_code', redirect_uri: redirectUri });
  if (!google.ok) return { status: 400, body: { error: 'google_rejected_code' } };
  if (!String(google.body.scope || '').split(' ').includes(DRIVE_SCOPE)) return { status: 400, body: { error: 'drive_permission_missing' } };
  if (!google.body.refresh_token) return { status: 400, body: { error: 'no_refresh_token' } };
  await saveRefreshToken(userId, google.body.refresh_token);
  return { status: 200, body: { connected: true, access_token: google.body.access_token, expires_in: google.body.expires_in } };
}

async function freshToken(userId: string) {
  const refreshToken = await loadRefreshToken(userId);
  if (!refreshToken) return { status: 200, body: { connected: false } };
  const google = await askGoogle({ refresh_token: refreshToken, grant_type: 'refresh_token' });
  if (google.body.error === 'invalid_grant') {                      // the user removed access, or Google expired it
    await forgetRefreshToken(userId);
    return { status: 200, body: { connected: false } };
  }
  if (!google.ok) return { status: 502, body: { error: 'google_unavailable' } };
  if (google.body.refresh_token) await saveRefreshToken(userId, google.body.refresh_token);
  return { status: 200, body: { connected: true, access_token: google.body.access_token, expires_in: google.body.expires_in } };
}

// ---- the request ----
Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Vary: 'Origin',
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': origin } : {}),
  };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: allowedOrigin ? 204 : 403,
      headers: { ...headers, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    });
  }
  if (!allowedOrigin) return reply(403, { error: 'origin_not_allowed' });
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  try {
    const userId = await userIdFrom(request);
    if (!userId) return reply(401, { error: 'not_signed_in' });
    const input = await request.json().catch(() => ({}));
    if (input.action === 'exchange') {
      const result = await exchange(userId, input.code, input.redirectUri);
      return reply(result.status, result.body);
    }
    if (input.action === 'token') {
      const result = await freshToken(userId);
      return reply(result.status, result.body);
    }
    return reply(400, { error: 'unknown_action' });
  } catch (error) {
    console.error('drive-token failed:', error instanceof Error ? error.message : 'unknown error');
    return reply(500, { error: 'server_error' });
  }
});
