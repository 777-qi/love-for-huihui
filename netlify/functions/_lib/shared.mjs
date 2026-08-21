import { createHmac, timingSafeEqual } from 'node:crypto';

const allowedKinds = new Set(['firsts', 'plans', 'capsules', 'daily', 'wheel']);

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': 'https://777-qi.github.io',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      vary: 'Origin'
    },
    body: JSON.stringify(body)
  };
}

export function preflight(event) {
  return event.httpMethod === 'OPTIONS' ? json(200, { ok: true }) : null;
}

export function assertConfiguration() {
  const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'LOVE_PASSWORD', 'SESSION_SECRET'];
  const missing = names.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`服务端尚未配置：${missing.join(', ')}`);
}

function sign(value) {
  return createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('base64url');
}

export function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || !token.includes('.')) return false;
  const [payload, providedSignature] = token.split('.');
  const expectedSignature = sign(payload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

export function authorized(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  return verifySessionToken(header.replace(/^Bearer\s+/i, ''));
}

export function safePasswordMatch(value) {
  const provided = Buffer.from(String(value || ''));
  const expected = Buffer.from(String(process.env.LOVE_PASSWORD || ''));
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function validateKind(kind) {
  if (!allowedKinds.has(kind)) throw new Error('不支持的数据类型');
  return kind;
}

export function validateId(id) {
  const value = String(id || '');
  if (!value || value.length > 180) throw new Error('数据编号无效');
  return value;
}

export async function supabase(path, options = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase 请求失败（${response.status}）：${detail.slice(0, 500)}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    throw new Error('请求内容不是有效 JSON');
  }
}

export function storagePathFromPhoto(photo) {
  if (typeof photo === 'string') return photo;
  return photo && typeof photo.path === 'string' ? photo.path : '';
}

export async function signedPhoto(path) {
  const cleanPath = String(path).replace(/^\/+/, '');
  const result = await supabase(`/storage/v1/object/sign/love-photos/${cleanPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600 })
  });
  const signed = result.signedURL || result.signedUrl;
  if (!signed) throw new Error('Supabase 未返回照片签名地址');
  const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
  const url = signed.startsWith('http')
    ? signed
    : (signed.startsWith('/storage/v1') ? `${baseUrl}${signed}` : `${baseUrl}/storage/v1${signed}`);
  return {
    path: cleanPath,
    url
  };
}

export async function withSignedPhotos(payload) {
  if (!Array.isArray(payload?.photos) || !payload.photos.length) return payload;
  const photos = await Promise.all(payload.photos.map(photo => signedPhoto(storagePathFromPhoto(photo))));
  return { ...payload, photos };
}
