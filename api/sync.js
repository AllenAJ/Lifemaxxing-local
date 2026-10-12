// Lifemax cloud sync: one JSON blob per sync code, stored in Upstash Redis.
// The code is the only secret. Redis keys are sha256(code), so the database never holds codes.
// Writes are compare-and-set on a revision number, so two devices can't silently overwrite each other.
import { createHash } from 'node:crypto';

// Vercel's Upstash integration may prefix the vars (e.g. lifemax_KV_REST_API_URL), so match by suffix.
const env = suffix => Object.entries(process.env).find(([k]) => k === suffix || k.endsWith('_' + suffix))?.[1];
const REDIS_URL = env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL');
const REDIS_TOKEN = env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN');
const CODE_RE = /^[a-z]+-[a-z]+-[a-z2-9]{5}-[a-z2-9]{5}$/;
const MAX_BYTES = 2_000_000;
const CAS = `local rev = tonumber(redis.call('GET', KEYS[2]) or '0')
if tonumber(ARGV[1]) ~= rev then return {0, rev} end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], rev + 1)
return {1, rev + 1}`;

async function redis(cmd) {
  const r = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}` }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(503).json({ error: 'storage not configured' });
  const code = String(req.headers['x-sync-code'] || '').trim().toLowerCase();
  if (!CODE_RE.test(code)) return res.status(400).json({ error: 'bad code' });
  const id = 'lm:' + createHash('sha256').update(code).digest('hex');
  try {
    if (req.method === 'GET') {
      const [data, rev] = await redis(['MGET', id + ':data', id + ':rev']);
      if (data == null) return res.status(404).json({ error: 'not found' });
      return res.status(200).json({ rev: Number(rev || 0), data: JSON.parse(data) });
    }
    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body?.data?.v !== 1 || typeof body.data.log !== 'object') return res.status(400).json({ error: 'bad data' });
      const json = JSON.stringify(body.data);
      if (json.length > MAX_BYTES) return res.status(413).json({ error: 'too large' });
      const [ok, rev] = await redis(['EVAL', CAS, '2', id + ':data', id + ':rev', String(Number(body.baseRev) || 0), json]);
      return res.status(ok ? 200 : 409).json({ rev });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(502).json({ error: 'storage error' });
  }
}
