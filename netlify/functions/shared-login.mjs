import {
  assertConfiguration,
  authorized,
  createSessionToken,
  json,
  parseBody,
  preflight,
  safePasswordMatch
} from './_lib/shared.mjs';

export async function handler(event) {
  try {
    const corsResponse = preflight(event);
    if (corsResponse) return corsResponse;
    assertConfiguration();
    if (event.httpMethod === 'GET') {
      return authorized(event) ? json(200, { valid: true }) : json(401, { error: '登录已过期，请重新输入密码' });
    }
    if (event.httpMethod !== 'POST') return json(405, { error: '请求方式不支持' });
    const { password } = parseBody(event);
    if (!safePasswordMatch(password)) return json(401, { error: '密码不对哦，再想想这个特别的日子 💕' });
    return json(200, { token: createSessionToken() });
  } catch (error) {
    return json(500, { error: error.message });
  }
}
