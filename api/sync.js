// Sincronização na nuvem — Parcelamentos + Mercado
// Guarda um JSON por "código de sincronização" no Upstash Redis (via REST).
// Sem dependências externas: usa o fetch nativo do Node.

const crypto = require('node:crypto');

const PREFIX = 'parcelamentos-sync:';
const MIN_KEY = 8;

function envUrl() {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
}
function envToken() {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
}

// Executa um comando no Upstash pela API REST.
async function redis(cmd) {
  const url = envUrl();
  const token = envToken();
  if (!url || !token) throw new Error('armazenamento_nao_configurado');
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
  const txt = await r.text();
  let j = null;
  try { j = JSON.parse(txt); } catch (e) {}
  if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
  return j ? j.result : null;
}

// O código nunca é guardado cru: vira um hash.
function idFor(key) {
  return PREFIX + crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 40);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    if (req.method === 'GET') {
      const key = String((req.query && req.query.key) || '');
      if (key.length < MIN_KEY) { res.status(400).json({ error: 'codigo_curto' }); return; }
      const raw = await redis(['GET', idFor(key)]);
      if (!raw) { res.status(200).json({ vazio: true }); return; }
      let obj = null;
      try { obj = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) {}
      if (!obj || !obj.data) { res.status(200).json({ vazio: true }); return; }
      res.status(200).json(obj);
      return;
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
      if (!body || typeof body !== 'object') { res.status(400).json({ error: 'sem_corpo' }); return; }
      const key = String(body.key || '');
      if (key.length < MIN_KEY) { res.status(400).json({ error: 'codigo_curto' }); return; }
      if (!body.data || typeof body.data !== 'object') { res.status(400).json({ error: 'sem_dados' }); return; }

      const payload = {
        data: body.data,
        updatedAt: Date.now(),
        device: String(body.device || '').slice(0, 60),
      };
      const str = JSON.stringify(payload);
      if (str.length > 900000) { res.status(413).json({ error: 'dados_grandes_demais' }); return; }

      await redis(['SET', idFor(key), str]);
      res.status(200).json({ ok: true, updatedAt: payload.updatedAt });
      return;
    }

    res.status(405).json({ error: 'metodo' });
  } catch (e) {
    res.status(500).json({ error: 'falha', detalhe: String((e && e.message) || e) });
  }
};
