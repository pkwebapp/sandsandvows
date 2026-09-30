/**
 * Enquiry mailer for sandsandvows.com (Lambda Function URL, Node 20, no dependencies).
 *
 * POST JSON (sent as text/plain so browsers skip the CORS preflight; application/json also works):
 *   { name, phone, date, email?, type?, city?, notes?, replyVia?, details?: [{label, value}],
 *     page?, source?, elapsedMs, hp }
 * Responses: 200 {ok:true} | 4xx/5xx {ok:false, error, fields?}
 *
 * Privacy: logs contain only an outcome/reason code and the occasion type. Never names,
 * phone numbers, emails, message text, IP addresses or secrets.
 */
import type { LambdaFunctionURLEvent, LambdaFunctionURLResult } from 'aws-lambda';

export const LIMITS = {
  maxBodyBytes: 10_000,
  minElapsedMs: 3_000,
  rateLimit: 5,
  rateWindowMs: 10 * 60 * 1000,
  resendTimeoutMs: 8_000,
} as const;

const DEFAULT_ORIGINS = ['https://sandsandvows.com', 'https://www.sandsandvows.com'];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

type Env = Record<string, string | undefined>;
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
interface Deps { fetch?: FetchLike; env?: Env; now?: () => number }

interface Enquiry {
  name: string; phone: string; date: string; email: string; type: string; city: string;
  notes: string; replyVia: string; details: { label: string; value: string }[]; page: string; source: string;
}

/* ---------------- helpers ---------------- */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(v: unknown, multiline = false): string {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  let s = String(v).replace(CONTROL, '');
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n') : s.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ');
  return s.trim();
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function header(event: LambdaFunctionURLEvent, name: string): string | undefined {
  const h = event.headers || {};
  const key = Object.keys(h).find(k => k.toLowerCase() === name);
  return key ? h[key] : undefined;
}

export function allowedOrigin(origin: string | undefined, env: Env): string | null {
  if (!origin) return null;
  const extra = (env.ENQUIRY_ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  return DEFAULT_ORIGINS.includes(origin) || extra.includes(origin) || LOCAL_ORIGIN.test(origin) ? origin : null;
}

function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d && y >= 2020 && y <= 2100;
}

const EMAIL = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\]{2,}$/;

export function formatIST(ms: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(ms)) + ' IST';
}

/* ---------------- validation ---------------- */
type FieldErrors = Record<string, string>;

export function validate(data: Record<string, unknown>): { value?: Enquiry; errors?: FieldErrors } {
  const errors: FieldErrors = {};
  const field = (key: string, max: number, opts: { required?: boolean; multiline?: boolean } = {}) => {
    const v = clean(data[key], opts.multiline);
    if (opts.required && !v) errors[key] = 'required';
    else if (v.length > max) errors[key] = 'too_long';
    return v;
  };
  const name = field('name', 100, { required: true });
  const phone = field('phone', 30, { required: true });
  const date = field('date', 10, { required: true });
  const email = field('email', 254);
  const type = field('type', 80);
  const city = field('city', 100);
  const notes = field('notes', 2000, { multiline: true });
  const replyVia = field('replyVia', 40);
  const page = field('page', 500);
  const source = field('source', 500);

  if (phone && !errors.phone && !/^\+?\d{10,15}$/.test(phone.replace(/[\s().-]/g, ''))) errors.phone = 'invalid';
  if (date && !errors.date && !isValidDate(date)) errors.date = 'invalid';
  if (email && !errors.email && !EMAIL.test(email)) errors.email = 'invalid';

  const details: { label: string; value: string }[] = [];
  if (data.details !== undefined) {
    if (!Array.isArray(data.details) || data.details.length > 40) errors.details = 'invalid';
    else for (const item of data.details) {
      if (!item || typeof item !== 'object') { errors.details = 'invalid'; break; }
      const label = clean((item as Record<string, unknown>).label);
      const value = clean((item as Record<string, unknown>).value, true);
      if (!label || !value) continue;
      if (label.length > 80 || value.length > 500) { errors.details = 'too_long'; break; }
      details.push({ label, value });
    }
  }
  const url = (u: string) => (/^https?:\/\//i.test(u) || u.startsWith('/') ? u : '');
  if (Object.keys(errors).length) return { errors };
  return { value: { name, phone, date, email, type, city, notes, replyVia, details, page: url(page), source: url(source) } };
}

/* ---------------- email ---------------- */
export function buildEmail(e: Enquiry, receivedMs: number) {
  const when = formatIST(receivedMs);
  const rows: [string, string][] = [
    ['Name', e.name], ['Phone / WhatsApp', e.phone], ['Email', e.email || '–'], ['Planning', e.type || '–'], ['Date', e.date],
    ...e.details.map(d => [d.label, d.value] as [string, string]),
    ['Travelling from', e.city || '–'], ['Best way to reply', e.replyVia || '–'], ['Notes', e.notes || '–'],
    ['Submitted on', e.page || '–'], ['Started from', e.source || '–'], ['Received', when],
  ];
  const subject = `New enquiry · ${e.type || 'Goa'} · ${e.name} · ${e.date}`.replace(/[\r\n]+/g, ' ').slice(0, 200);
  const text = ['New enquiry from sandsandvows.com', '', ...rows.map(([k, v]) => `${k}: ${v}`), '',
    e.email ? 'Reply to this email to answer the visitor directly.' : 'No email given: reply on WhatsApp or phone.'].join('\n');
  const waDigits = e.phone.replace(/[^\d]/g, '');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f2ece1;font-family:Arial,Helvetica,sans-serif;color:#1b1916">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fbf6ee;border:1px solid #e0d6c5">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e0d6c5"><div style="font-family:Georgia,serif;font-size:22px">New enquiry · Sands &amp; Vows</div>
<div style="font-size:13px;color:#7d7264;margin-top:4px">${escapeHtml(when)}</div></td></tr>
<tr><td style="padding:8px 24px 20px"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.5">
${rows.map(([k, v]) => `<tr><td style="padding:8px 16px 8px 0;color:#7d7264;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:8px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`).join('\n')}
</table>
${waDigits ? `<p style="margin:16px 0 0;font-size:14px"><a href="https://wa.me/${waDigits}" style="color:#9c5a2e">Open a WhatsApp chat with this number</a></p>` : ''}
</td></tr></table></body></html>`;
  return { subject, text, html };
}

/* ---------------- rate limiting (best effort, per warm Lambda instance) ---------------- */
const hits = new Map<string, number[]>();
export function rateLimited(ip: string, now: number): boolean {
  if (!ip) return false;
  const recent = (hits.get(ip) || []).filter(t => now - t < LIMITS.rateWindowMs);
  const limited = recent.length >= LIMITS.rateLimit;
  if (!limited) recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return limited;
}
export function _resetRateLimit() { hits.clear(); }

/* ---------------- handler ---------------- */
function log(outcome: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ evt: 'enquiry', outcome, ...extra }));
}

export function createHandler(deps: Deps = {}) {
  return async (event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> => {
    const env = deps.env || process.env;
    const now = (deps.now || Date.now)();
    const doFetch = (deps.fetch || (globalThis.fetch as unknown as FetchLike));
    const method = event.requestContext?.http?.method?.toUpperCase() || 'GET';
    const origin = allowedOrigin(header(event, 'origin'), env);
    const cors: Record<string, string> = origin ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
    } : {};
    const reply = (statusCode: number, body: Record<string, unknown> | null): LambdaFunctionURLResult => ({
      statusCode,
      headers: { ...cors, Vary: 'Origin', 'Cache-Control': 'no-store', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : '',
    });

    if (method === 'OPTIONS') return origin ? reply(204, null) : reply(403, { ok: false, error: 'origin_not_allowed' });
    if (method !== 'POST') return reply(405, { ok: false, error: 'method_not_allowed' });
    if (!origin) { log('rejected', { reason: 'origin' }); return reply(403, { ok: false, error: 'origin_not_allowed' }); }

    const declared = Number(header(event, 'content-length') || 0);
    let raw = event.body || '';
    if (declared > LIMITS.maxBodyBytes || raw.length > LIMITS.maxBodyBytes * 2) return reply(413, { ok: false, error: 'payload_too_large' });
    if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
    if (Buffer.byteLength(raw, 'utf8') > LIMITS.maxBodyBytes) return reply(413, { ok: false, error: 'payload_too_large' });

    if (rateLimited(event.requestContext?.http?.sourceIp || '', now)) { log('rejected', { reason: 'rate_limit' }); return reply(429, { ok: false, error: 'rate_limited' }); }

    let data: unknown;
    try { data = JSON.parse(raw); } catch { return reply(400, { ok: false, error: 'invalid_json' }); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, { ok: false, error: 'invalid_json' });
    const body = data as Record<string, unknown>;

    // Spam traps: answer like a success so bots learn nothing, but send nothing.
    if (clean(body.hp)) { log('dropped', { reason: 'honeypot' }); return reply(200, { ok: true }); }
    const elapsed = Number(body.elapsedMs);
    if (!Number.isFinite(elapsed) || elapsed < LIMITS.minElapsedMs) { log('dropped', { reason: 'too_fast' }); return reply(200, { ok: true }); }

    const { value, errors } = validate(body);
    if (!value) { log('rejected', { reason: 'validation', fields: Object.keys(errors || {}) }); return reply(422, { ok: false, error: 'validation_failed', fields: errors }); }

    const key = env.RESEND_API_KEY;
    const from = env.ENQUIRY_FROM || 'Sands & Vows Enquiries <enquiries@sandsandvows.com>';
    const to = env.ENQUIRY_TO || 'sandsandvows@pkphotography.in';
    if (!key) { log('error', { reason: 'not_configured' }); return reply(500, { ok: false, error: 'not_configured' }); }

    const mail = buildEmail(value, now);
    const payload: Record<string, unknown> = { from, to: to.split(',').map(s => s.trim()).filter(Boolean), subject: mail.subject, text: mail.text, html: mail.html };
    if (value.email) payload.reply_to = value.email;

    try {
      const res = await doFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(LIMITS.resendTimeoutMs),
      });
      if (!res.ok) { log('error', { reason: 'resend_status', status: res.status, type: value.type }); return reply(502, { ok: false, error: 'send_failed' }); }
      log('sent', { type: value.type });
      return reply(200, { ok: true });
    } catch (err) {
      log('error', { reason: (err as Error)?.name === 'TimeoutError' ? 'resend_timeout' : 'resend_network', type: value.type });
      return reply(502, { ok: false, error: 'send_failed' });
    }
  };
}

export const handler = createHandler();
