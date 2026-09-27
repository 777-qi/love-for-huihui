import {
  assertConfiguration,
  authorized,
  json,
  parseBody,
  preflight,
  storagePathFromPhoto,
  supabase,
  validateId,
  validateKind,
  withSignedPhotos
} from './_lib/shared.mjs';

function queryValue(event, name) {
  return event.queryStringParameters?.[name] || '';
}

// 每日一问：双方都提交前，不向浏览器下发任何一方的答案内容，
// 只保留“已提交”状态供前端展示封存面板。
function redactDailyRows(rows) {
  const answeredByDate = new Map();
  rows.forEach(row => {
    const payload = row.payload || {};
    if (!payload.date || !payload.person || !payload.answer) return;
    if (!answeredByDate.has(payload.date)) answeredByDate.set(payload.date, new Set());
    answeredByDate.get(payload.date).add(payload.person);
  });
  const isRevealed = date =>
    ['tianqi', 'huihui'].every(person => answeredByDate.get(date)?.has(person));
  return rows.map(row => {
    const payload = row.payload || {};
    if (payload.date && isRevealed(payload.date)) return payload;
    return { ...payload, answer: '', submitted: Boolean(payload.answer) };
  });
}

// 文本长度兜底：正常记录远小于这些上限，超限基本是异常请求
const MAX_TEXT_LENGTH = 6000;
function validateRecordSize(payload) {
  const oversized = Object.entries(payload || {})
    .find(([, value]) => typeof value === 'string' && value.length > MAX_TEXT_LENGTH);
  if (oversized) throw new Error('记录内容过长');
  if (JSON.stringify(payload || {}).length > 120000) throw new Error('记录内容过长');
}

async function removePhotos(payload) {
  const paths = Array.isArray(payload?.photos)
    ? payload.photos.map(storagePathFromPhoto).filter(Boolean)
    : [];
  await Promise.all(paths.map(path =>
    supabase(`/storage/v1/object/love-photos/${String(path).replace(/^\/+/, '')}`, { method: 'DELETE' }).catch(() => null)
  ));
}

export async function handler(event) {
  try {
    const corsResponse = preflight(event);
    if (corsResponse) return corsResponse;
    assertConfiguration();
    if (!authorized(event)) return json(401, { error: '登录已过期，请重新输入密码' });

    if (event.httpMethod === 'GET') {
      const kind = validateKind(queryValue(event, 'kind'));
      const rows = await supabase(`/rest/v1/love_memories?kind=eq.${encodeURIComponent(kind)}&select=id,payload,created_at&order=created_at.desc`, {
        headers: { accept: 'application/json' }
      });
      const payloads = kind === 'daily' ? redactDailyRows(rows) : rows.map(row => row.payload);
      const records = await Promise.all(rows.map((row, index) => withSignedPhotos({ ...payloads[index], id: row.id })));
      return json(200, { records });
    }

    if (event.httpMethod === 'POST') {
      const { kind: rawKind, record } = parseBody(event);
      const kind = validateKind(rawKind);
      const id = validateId(record?.id);
      const payload = { ...record };
      delete payload.id;
      validateRecordSize(payload);
      await supabase('/rest/v1/love_memories?on_conflict=kind,id', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({
          kind,
          id,
          payload,
          created_at: new Date(Number(record.createdAt) || Date.now()).toISOString(),
          updated_at: new Date().toISOString()
        })
      });
      return json(200, { saved: true });
    }

    if (event.httpMethod === 'DELETE') {
      const kind = validateKind(queryValue(event, 'kind'));
      const id = validateId(queryValue(event, 'id'));
      const rows = await supabase(`/rest/v1/love_memories?kind=eq.${encodeURIComponent(kind)}&id=eq.${encodeURIComponent(id)}&select=payload`, {
        headers: { accept: 'application/json' }
      });
      if (rows[0]) await removePhotos(rows[0].payload);
      await supabase(`/rest/v1/love_memories?kind=eq.${encodeURIComponent(kind)}&id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { prefer: 'return=minimal' }
      });
      return json(200, { deleted: true });
    }

    return json(405, { error: '请求方式不支持' });
  } catch (error) {
    const status = /无效|不支持|不是有效|过长/.test(error.message) ? 400 : 500;
    return json(status, { error: error.message });
  }
}
