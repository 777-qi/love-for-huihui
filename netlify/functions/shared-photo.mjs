import { randomUUID } from 'node:crypto';
import {
  assertConfiguration,
  authorized,
  json,
  parseBody,
  preflight,
  supabase,
  validateId,
  validateKind
} from './_lib/shared.mjs';

const mimeExtensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export async function handler(event) {
  try {
    const corsResponse = preflight(event);
    if (corsResponse) return corsResponse;
    assertConfiguration();
    if (!authorized(event)) return json(401, { error: '登录已过期，请重新输入密码' });
    if (event.httpMethod !== 'POST') return json(405, { error: '请求方式不支持' });
    const { kind: rawKind, recordId: rawRecordId, dataUrl } = parseBody(event);
    const kind = validateKind(rawKind);
    const recordId = validateId(rawRecordId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const match = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/);
    if (!match) return json(400, { error: '照片格式无效，请使用 JPG、PNG 或 WebP' });
    const mimeType = match[1];
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > 2 * 1024 * 1024) return json(400, { error: '单张照片不能超过 2MB' });
    const path = `${kind}/${recordId}/${randomUUID()}.${mimeExtensions[mimeType]}`;
    await supabase(`/storage/v1/object/love-photos/${path}`, {
      method: 'POST',
      headers: { 'content-type': mimeType, 'x-upsert': 'false' },
      body: bytes
    });
    return json(200, { path });
  } catch (error) {
    return json(500, { error: error.message });
  }
}
