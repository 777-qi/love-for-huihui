// 本地开发服务器：用与 Netlify Functions 相同的 API 形状，
// 在本机完整预览与测试网站，不连接线上 Supabase。
// 用法：node dev-server.mjs  →  http://localhost:8787
// 登录密码默认 love-dev-password，可用 LOVE_PASSWORD 环境变量覆盖。
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const PASSWORD = process.env.LOVE_PASSWORD || 'love-dev-password';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-do-not-use-in-production';
const DATA_FILE = join(ROOT, '.dev-data', 'memories.json');
const PHOTO_DIR = join(ROOT, '.dev-data', 'photos');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

async function readStore() {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf8'));
  } catch (_) {
    return {};
  }
}

async function writeStore(store) {
  await mkdir(join(ROOT, '.dev-data'), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

function sign(payload) {
  return createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}

function makeToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 7 * 86400000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function tokenValid(token) {
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (sign(payload) !== signature) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp > Date.now();
  } catch (_) {
    return false;
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch (_) {
    return {};
  }
}

async function serveStatic(res, urlPath) {
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
  const target = normalize(join(ROOT, relative));
  if (!target.startsWith(ROOT)) return false;
  try {
    const info = await stat(target);
    if (!info.isFile()) return false;
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
    return true;
  } catch (_) {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (url.pathname === '/api/login') {
    if (req.method === 'GET') {
      return tokenValid(auth) ? json(res, 200, { valid: true }) : json(res, 401, { error: '登录已过期' });
    }
    if (req.method === 'POST') {
      const { password } = await readBody(req);
      if (password !== PASSWORD) return json(res, 401, { error: '密码不对哦（本地开发密码见 dev-server.mjs 顶部）' });
      return json(res, 200, { token: makeToken() });
    }
    return json(res, 405, { error: '请求方式不支持' });
  }

  // 与线上一致：只有 API 需要登录，页面与静态资源直接可访问
  if (url.pathname.startsWith('/api/') && !tokenValid(auth)) {
    return json(res, 401, { error: '登录已过期，请重新输入密码' });
  }

  if (url.pathname === '/api/data') {
    const store = await readStore();
    const kind = url.searchParams.get('kind') || '';

    if (req.method === 'GET') {
      const records = (store[kind] || []).map(record => ({
        ...record,
        photos: (record.photos || []).map(path => ({
          path,
          url: `/dev-photo/${encodeURIComponent(path)}`
        }))
      }));
      return json(res, 200, { records });
    }

    if (req.method === 'POST') {
      const { kind: bodyKind, record } = await readBody(req);
      store[bodyKind] = store[bodyKind] || [];
      const index = store[bodyKind].findIndex(item => item.id === record.id);
      const { id, ...payload } = record;
      if (index >= 0) store[bodyKind][index] = { ...store[bodyKind][index], ...payload };
      else store[bodyKind].push({ ...payload, id });
      await writeStore(store);
      return json(res, 200, { saved: true });
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      store[kind] = (store[kind] || []).filter(item => item.id !== id);
      await writeStore(store);
      return json(res, 200, { deleted: true });
    }
    return json(res, 405, { error: '请求方式不支持' });
  }

  if (url.pathname === '/api/photo' && req.method === 'POST') {
    const { kind, recordId, dataUrl } = await readBody(req);
    const match = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/);
    if (!match) return json(res, 400, { error: '照片格式无效' });
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[match[1]];
    const safeId = String(recordId || 'item').replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = `${kind}/${safeId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    await mkdir(join(PHOTO_DIR, `${kind}/${safeId}`), { recursive: true });
    await writeFile(join(PHOTO_DIR, path), Buffer.from(match[2], 'base64'));
    return json(res, 200, { path });
  }

  if (url.pathname.startsWith('/dev-photo/')) {
    const relative = decodeURIComponent(url.pathname.replace(/^\/dev-photo\//, ''));
    const target = normalize(join(PHOTO_DIR, relative));
    if (!target.startsWith(PHOTO_DIR)) return json(res, 403, { error: 'forbidden' });
    try {
      const body = await readFile(target);
      res.writeHead(200, { 'content-type': MIME[extname(target).toLowerCase()] || 'image/jpeg' });
      return res.end(body);
    } catch (_) {
      return json(res, 404, { error: 'photo not found' });
    }
  }

  if (await serveStatic(res, url.pathname)) return;
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`本地预览已启动: http://localhost:${PORT}`);
  console.log(`开发密码: ${PASSWORD}（仅本地，与线上无关）`);
  console.log('数据保存在 .dev-data/ 目录，测试产生的记录不会进入线上。');
});
