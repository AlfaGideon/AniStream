import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

export const VK_CLIENT_ID = '54855208';
const VAULT_KEY = 'anistream-vk-oauth-v1';
const AUTH_BASE = 'https://id.vk.ru';
let vault = { session: null, pending: null };
let initPromise = null;
let authWaiter = null;
let openUrlListener = null;
let browserFinishedListener = null;

const isNative = () => Capacitor.isNativePlatform();
const base64Url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const randomString = (length=48) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base64Url(bytes).slice(0, length);
};
const decodeBase64 = value => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
};

async function saveVault() {
  if (!isNative()) return;
  await SecureStoragePlugin.set({ key: VAULT_KEY, value: JSON.stringify(vault) });
}
async function loadVault() {
  if (!isNative()) return;
  try {
    const saved = await SecureStoragePlugin.get({ key: VAULT_KEY });
    const value = JSON.parse(saved.value || '{}');
    vault = { session: value.session || null, pending: value.pending || null };
  } catch { vault = { session: null, pending: null }; }
}
async function removeVault() {
  vault = { session: null, pending: null };
  if (isNative()) {
    try { await SecureStoragePlugin.remove({ key: VAULT_KEY }); } catch { /* nothing stored */ }
  }
}

function parseCallback(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== `vk${VK_CLIENT_ID}:` || url.hostname !== 'vk.ru') return null;
  const params = new URLSearchParams(url.search);
  const candidates = [params.get('payload'), params.get('data'), url.hash.slice(1)].filter(Boolean);
  let payload = {};
  for (const candidate of candidates) {
    try {
      const decoded = candidate.startsWith('{') ? candidate : decodeBase64(candidate);
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === 'object') { payload = parsed; break; }
    } catch { /* callback may use ordinary query fields */ }
  }
  for (const [key, value] of params) if (payload[key] == null) payload[key] = value;
  return {
    code: payload.code || params.get('code') || '',
    deviceId: payload.device_id || payload.deviceId || params.get('device_id') || params.get('deviceId') || '',
    state: payload.state || params.get('state') || '',
    error: payload.error_description || payload.error || params.get('error_description') || params.get('error') || '',
  };
}

function responseJson(data) {
  if (data && typeof data === 'object') return data;
  try { return JSON.parse(String(data || '{}')); } catch { return {}; }
}
async function postVkAuth(form) {
  const data = new URLSearchParams(form).toString();
  const response = await CapacitorHttp.post({
    url: `${AUTH_BASE}/oauth2/auth`,
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    data,
    responseType: 'json',
  });
  const body = responseJson(response.data);
  if (response.status < 200 || response.status >= 300 || body.error) {
    throw new Error(body.error_description || body.error || `VK ID ответил ${response.status}`);
  }
  return body;
}

async function finishCallback(rawUrl) {
  const callback = parseCallback(rawUrl);
  if (!callback) return false;
  let pending = vault.pending;
  if (!pending && isNative()) {
    await loadVault();
    pending = vault.pending;
  }
  if (!pending) return true;
  if (callback.error) throw new Error(`Авторизация VK отменена или отклонена: ${callback.error}`);
  if (!callback.code || !callback.deviceId || callback.state !== pending.state) {
    throw new Error('VK вернул неполный или неподтверждённый ответ авторизации. Попробуйте подключить VK ещё раз.');
  }
  if (authWaiter) authWaiter.handling = true;
  const tokenData = await postVkAuth({
    grant_type: 'authorization_code',
    client_id: VK_CLIENT_ID,
    code: callback.code,
    code_verifier: pending.codeVerifier,
    device_id: callback.deviceId,
    redirect_uri: pending.redirectUri,
    state: pending.state,
  });
  if (!tokenData.access_token) throw new Error('VK ID не вернул access token.');
  const lifetime = Math.max(Number(tokenData.expires_in) || 3600, 300);
  vault = {
    session: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || '',
      deviceId: callback.deviceId,
      expiresAt: Date.now() + lifetime * 1000,
      state: pending.state,
    },
    pending: null,
  };
  await saveVault();
  try { await Browser.close(); } catch { /* Browser may already be closed */ }
  authWaiter?.resolve(true);
  authWaiter = null;
  return true;
}

export function initializeVkAuth() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await loadVault();
    openUrlListener = await App.addListener('appUrlOpen', ({ url }) => {
      finishCallback(url).catch(error => {
        vault.pending = null;
        saveVault().catch(() => {});
        try { Browser.close(); } catch { /* ignore */ }
        authWaiter?.reject(error);
        authWaiter = null;
      });
    });
    browserFinishedListener = await Browser.addListener('browserFinished', () => {
    if (authWaiter && !authWaiter.handling) {
      authWaiter.reject(new Error('Окно VK ID закрыто до завершения авторизации.'));
        authWaiter = null;
        vault.pending = null;
        saveVault().catch(() => {});
      }
    });
    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) await finishCallback(launch.url);
    } catch { /* a normal app launch has no deep link */ }
    return Boolean(vault.session?.accessToken);
  })();
  return initPromise;
}

export async function connectVk() {
  await initializeVkAuth();
  if (!isNative()) throw new Error('Авторизация VK ID доступна в Android-приложении.');
  const codeVerifier = randomString(64);
  const challenge = base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier)));
  const state = randomString(48);
  const scope = 'vkid.personal_info video';
  const scopeParam = btoa(`scope=${scope}`);
  const redirectUri = `vk${VK_CLIENT_ID}://vk.ru/blank.html?oauth2_params=${encodeURIComponent(scopeParam)}`;
  const pending = { codeVerifier, state, redirectUri };
  vault.pending = pending;
  await saveVault();
  const authorize = new URL(`${AUTH_BASE}/authorize`);
  authorize.search = new URLSearchParams({
    client_id: VK_CLIENT_ID,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    redirect_uri: redirectUri,
    lang_id: '0',
    scheme: 'space_gray',
    prompt: 'consent',
  }).toString();
  return new Promise((resolve, reject) => {
    authWaiter = { resolve, reject };
    Browser.open({ url: authorize.toString() }).catch(error => {
      authWaiter = null;
      vault.pending = null;
      saveVault().catch(() => {});
      reject(error);
    });
  });
}

async function refreshCurrentVkSession({disconnectOnError=true}={}) {
  if (!vault.session?.refreshToken) throw new Error('VK ID не выдал refresh token. Переподключите VK в настройках.');
  try {
    const tokenData = await postVkAuth({
      grant_type: 'refresh_token',
      client_id: VK_CLIENT_ID,
      refresh_token: vault.session.refreshToken,
      device_id: vault.session.deviceId,
      state: vault.session.state || randomString(48),
    });
    if (!tokenData.access_token) throw new Error('VK ID не обновил access token.');
    const lifetime = Math.max(Number(tokenData.expires_in) || 3600, 300);
    vault.session = {
      ...vault.session,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || vault.session.refreshToken,
      expiresAt: Date.now() + lifetime * 1000,
    };
    await saveVault();
    return vault.session.accessToken;
  } catch (error) {
    if (disconnectOnError) await disconnectVk();
    throw new Error(`Не удалось обновить авторизацию VK: ${error.message}`);
  }
}

export async function getVkAccessToken() {
  await initializeVkAuth();
  if (!vault.session?.accessToken) return '';
  if (vault.session.expiresAt > Date.now() + 60_000) return vault.session.accessToken;
  if (!vault.session.refreshToken) {
    await disconnectVk();
    throw new Error('Срок авторизации VK истёк. Подключите VK заново в настройках.');
  }
  return refreshCurrentVkSession();
}

export async function refreshVkAccessToken() {
  await initializeVkAuth();
  if (!vault.session?.refreshToken) throw new Error('VK ID не выдал refresh token. Переподключите VK в настройках.');
  return refreshCurrentVkSession({ disconnectOnError: false });
}

export async function disconnectVk() {
  await removeVault();
}

export function isVkConnected() {
  return Boolean(vault.session?.accessToken || vault.session?.refreshToken);
}
