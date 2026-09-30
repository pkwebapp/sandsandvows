import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, _resetRateLimit, escapeHtml, formatIST, LIMITS } from '../amplify/functions/enquiry/handler.ts';

const ORIGIN = 'https://sandsandvows.com';
const NOW = Date.UTC(2026, 8, 29, 19, 30); // 30 Sep 2026, 1:00 am IST
const env = { RESEND_API_KEY: 're_test_dummy', ENQUIRY_TO: 'hello@sandsandvows.com', ENQUIRY_FROM: 'Sands & Vows Enquiries <enquiries@sandsandvows.com>' };

function mockResend(status = 200) {
  const calls: { url: string; init: any }[] = [];
  const fetch = async (url: string, init: any) => { calls.push({ url, init }); return { ok: status < 300, status, json: async () => ({ id: 'email_123' }) }; };
  return { calls, fetch };
}
function event(body: unknown, opts: { method?: string; origin?: string | null; ip?: string; raw?: boolean; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'content-type': 'text/plain;charset=UTF-8', ...(opts.headers || {}) };
  if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
  return {
    headers, isBase64Encoded: false, body: opts.raw ? (body as string) : JSON.stringify(body),
    requestContext: { http: { method: opts.method || 'POST', sourceIp: opts.ip || '203.0.113.7' } },
  } as any;
}
const valid = () => ({
  name: '  Test <b>Person</b> ', phone: '+91 98765 43210', date: '2027-01-22', email: 'guest@example.com', type: 'Destination wedding',
  city: 'Mumbai', notes: 'Beach wedding\nabout 150 guests <script>alert(1)</script>', replyVia: 'WhatsApp',
  details: [{ label: 'Number of days', value: '2' }, { label: 'Functions to cover', value: 'Haldi, Sangeet' }],
  page: 'https://sandsandvows.com/availability.html', source: '/weddings.html', elapsedMs: 42_000, hp: '',
});
const json = (r: any) => JSON.parse(r.body);

beforeEach(() => _resetRateLimit());

test('valid enquiry is sent through Resend with escaped HTML, reply_to and IST timestamp', async () => {
  const m = mockResend(); const h = createHandler({ fetch: m.fetch, env, now: () => NOW });
  const logs: string[] = []; const orig = console.log; console.log = (s: string) => logs.push(s);
  const r = await h(event(valid())); console.log = orig;
  assert.equal(r.statusCode, 200); assert.deepEqual(json(r), { ok: true });
  assert.equal(r.headers!['Access-Control-Allow-Origin'], ORIGIN);
  assert.equal(m.calls.length, 1);
  assert.equal(m.calls[0].url, 'https://api.resend.com/emails');
  assert.equal(m.calls[0].init.headers.Authorization, 'Bearer re_test_dummy');
  const p = JSON.parse(m.calls[0].init.body);
  assert.deepEqual(p.to, ['hello@sandsandvows.com']);
  assert.equal(p.from, env.ENQUIRY_FROM);
  assert.equal(p.reply_to, 'guest@example.com');
  assert.match(p.subject, /^New enquiry · Destination wedding · Test <b>Person<\/b> · 2027-01-22$/);
  assert.match(p.text, /Name: Test <b>Person<\/b>/);
  assert.match(p.text, /Number of days: 2/);
  assert.match(p.text, /Submitted on: https:\/\/sandsandvows.com\/availability.html/);
  assert.match(p.text, /Received: 30 Sept? 2026, 1:00 am IST/i);
  assert.ok(!p.html.includes('<script>'), 'script tag must be escaped');
  assert.ok(p.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(p.html.includes('Test &lt;b&gt;Person&lt;/b&gt;'));
  // logs never contain personal data or secrets
  const all = logs.join('\n');
  for (const s of ['Test', '98765', 'guest@example.com', 're_test_dummy', '203.0.113.7', 'Mumbai']) assert.ok(!all.includes(s), `log leaked ${s}`);
});

test('no email given → no reply_to', async () => {
  const m = mockResend(); const h = createHandler({ fetch: m.fetch, env, now: () => NOW });
  const r = await h(event({ ...valid(), email: '' }));
  assert.equal(r.statusCode, 200); assert.equal(JSON.parse(m.calls[0].init.body).reply_to, undefined);
});

test('missing required fields → 422 with field codes, nothing sent', async () => {
  const m = mockResend(); const h = createHandler({ fetch: m.fetch, env, now: () => NOW });
  const r = await h(event({ elapsedMs: 9000, hp: '', name: '   ', phone: '', date: '' }));
  assert.equal(r.statusCode, 422);
  assert.deepEqual(json(r), { ok: false, error: 'validation_failed', fields: { name: 'required', phone: 'required', date: 'required' } });
  assert.equal(m.calls.length, 0);
});

test('bad formats and length limits → 422', async () => {
  const m = mockResend(); const h = createHandler({ fetch: m.fetch, env, now: () => NOW });
  const r = await h(event({ ...valid(), phone: '12345', date: '2027-02-30', email: 'not-an-email', notes: 'x'.repeat(2001) }));
  assert.equal(r.statusCode, 422);
  assert.deepEqual(json(r).fields, { phone: 'invalid', date: 'invalid', email: 'invalid', notes: 'too_long' });
  assert.equal(m.calls.length, 0);
});

test('honeypot filled → silent 200, nothing sent', async () => {
  const m = mockResend(); const h = createHandler({ fetch: m.fetch, env, now: () => NOW });
  const r = await h(event({ ...valid(), hp: 'https://spam.example' }));
  assert.equal(r.statusCode, 200); assert.deepEqual(json(r), { ok: true }); assert.equal(m.calls.length, 0);
});

test('submitted too fast (or no timing) → silent 200, nothing sent', async () => {
  const m = mockResend(); const h = createHandler({ fetch: m.fetch, env, now: () => NOW });
  assert.equal((await h(event({ ...valid(), elapsedMs: LIMITS.minElapsedMs - 1 }))).statusCode, 200);
  const { elapsedMs, ...noTiming } = valid();
  assert.equal((await h(event(noTiming))).statusCode, 200);
  assert.equal(m.calls.length, 0);
});

test('oversized body → 413 before parsing', async () => {
  const m = mockResend(); const h = createHandler({ fetch: m.fetch, env, now: () => NOW });
  const r = await h(event({ ...valid(), notes: 'x'.repeat(LIMITS.maxBodyBytes) }));
  assert.equal(r.statusCode, 413); assert.equal(json(r).error, 'payload_too_large'); assert.equal(m.calls.length, 0);
  const r2 = await h(event('{}', { raw: true, headers: { 'content-length': '999999' } }));
  assert.equal(r2.statusCode, 413);
});

test('bad JSON → 400', async () => {
  const h = createHandler({ fetch: mockResend().fetch, env, now: () => NOW });
  assert.deepEqual(json(await h(event('{"name": "x"', { raw: true }))), { ok: false, error: 'invalid_json' });
  assert.equal((await h(event('[1,2]', { raw: true }))).statusCode, 400);
});

test('CORS preflight: allowed origins get 204 + headers; others 403', async () => {
  const h = createHandler({ fetch: mockResend().fetch, env, now: () => NOW });
  for (const o of ['https://sandsandvows.com', 'https://www.sandsandvows.com', 'http://localhost:8765', 'http://127.0.0.1:3000']) {
    const r = await h(event(null, { method: 'OPTIONS', origin: o, raw: true }));
    assert.equal(r.statusCode, 204, o);
    assert.equal(r.headers!['Access-Control-Allow-Origin'], o);
    assert.match(r.headers!['Access-Control-Allow-Methods'], /POST/);
    assert.match(r.headers!['Access-Control-Allow-Headers'], /content-type/);
  }
  const bad = await h(event(null, { method: 'OPTIONS', origin: 'https://evil.example', raw: true }));
  assert.equal(bad.statusCode, 403); assert.equal(bad.headers!['Access-Control-Allow-Origin'], undefined);
});

test('POST from a disallowed or missing origin → 403, nothing sent', async () => {
  const m = mockResend(); const h = createHandler({ fetch: m.fetch, env, now: () => NOW });
  assert.equal((await h(event(valid(), { origin: 'https://sandsandvows.com.evil.example' }))).statusCode, 403);
  assert.equal((await h(event(valid(), { origin: null }))).statusCode, 403);
  assert.equal(m.calls.length, 0);
});

test('extra origin via ENQUIRY_ALLOWED_ORIGINS', async () => {
  const m = mockResend(); const h = createHandler({ fetch: m.fetch, env: { ...env, ENQUIRY_ALLOWED_ORIGINS: 'https://main.d123.amplifyapp.com' }, now: () => NOW });
  assert.equal((await h(event(valid(), { origin: 'https://main.d123.amplifyapp.com' }))).statusCode, 200);
});

test('GET → 405', async () => {
  const h = createHandler({ fetch: mockResend().fetch, env, now: () => NOW });
  assert.equal((await h(event(null, { method: 'GET', raw: true }))).statusCode, 405);
});

test('rate limit: 6th request from one IP within 10 min → 429', async () => {
  const m = mockResend(); const h = createHandler({ fetch: m.fetch, env, now: () => NOW });
  for (let i = 0; i < LIMITS.rateLimit; i++) assert.equal((await h(event(valid(), { ip: '198.51.100.1' }))).statusCode, 200);
  const r = await h(event(valid(), { ip: '198.51.100.1' }));
  assert.equal(r.statusCode, 429); assert.equal(json(r).error, 'rate_limited');
  assert.equal((await h(event(valid(), { ip: '198.51.100.2' }))).statusCode, 200);
});

test('Resend error → 502 send_failed; missing key → 500 not_configured', async () => {
  const h = createHandler({ fetch: mockResend(422).fetch, env, now: () => NOW });
  assert.deepEqual(json(await h(event(valid()))), { ok: false, error: 'send_failed' });
  const h2 = createHandler({ fetch: mockResend().fetch, env: { ...env, RESEND_API_KEY: '' }, now: () => NOW });
  const r = await h2(event(valid())); assert.equal(r.statusCode, 500); assert.equal(json(r).error, 'not_configured');
  const h3 = createHandler({ fetch: async () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }); }, env, now: () => NOW });
  assert.equal((await h3(event(valid()))).statusCode, 502);
});

test('base64-encoded body (Function URL) is decoded', async () => {
  const m = mockResend(); const h = createHandler({ fetch: m.fetch, env, now: () => NOW });
  const e = event(valid()); e.body = Buffer.from(e.body).toString('base64'); e.isBase64Encoded = true;
  assert.equal((await h(e)).statusCode, 200); assert.equal(m.calls.length, 1);
});

test('helpers', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.match(formatIST(NOW), /IST$/);
});
