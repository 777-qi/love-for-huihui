import {
  assertConfiguration,
  authorized,
  json,
  parseBody,
  storagePathFromPhoto,
  supabase,
  validateId,
  validateKind,
  withSignedPhotos
} from './_lib/shared.mjs';

function queryValue(event, name) {
  return event.queryStringParameters?.[name] || '';
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
    assertConfiguration();
    if (!authorized(event)) return json(401, { error: '登录已过期，请重新输入密码' });

    if (event.httpMethod === 'GET') {
      const kind = validateKind(queryValue(event, 'kind'));
      const rows = await supabase(`/rest/v1/love_memories?kind=eq.${encodeURIComponent(kind)}&select=id,payload,created_at&order=created_at.desc`, {
        headers: { accept: 'application/json' }
      });
      const records = await Promise.all(rows.map(row => withSignedPhotos({ ...row.payload, id: row.id })));
      return json(200, { records });
    }

    if (event.httpMethod === 'POST') {
      const { kind: rawKind, record } = parseBody(event);
      const kind = validateKind(rawKind);
      const id = validateId(record?.id);
      const payload = { ...record };
      delete payload.id;
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
    const status = /无效|不支持|不是有效/.test(error.message) ? 400 : 500;
    return json(status, { error: error.message });
  }
}
