// Sincronização + cópias de segurança — Parcelamentos + Mercado
// Guarda tudo no Upstash Redis (via REST). Sem dependências externas.

const crypto = require('node:crypto');

const PREFIX = 'parcelamentos-sync:';
const BACKUP_PREFIX = 'parcelamentos-backup:';
const MIN_KEY = 8;
const MAX_BACKUPS = 7;

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
function hash(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 40);
}
function idFor(key) { return PREFIX + hash(key); }
function backupIdFor(key) { return BACKUP_PREFIX + hash(key); }

function lerJson(raw, padrao) {
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return o == null ? padrao : o;
  } catch (e) { return padrao; }
}

function resumoDe(data) {
  const p = Array.isArray(data.planos) ? data.planos : [];
  const c = Array.isArray(data.contas) ? data.contas : [];
  const m = Array.isArray(data.mercado) ? data.mercado : [];
  return {
    parcelamentos: p.length,
    contasPagar: c.filter(x => (x.tipo || 'pagar') === 'pagar').length,
    contasReceber: c.filter(x => x.tipo === 'receber').length,
    mercado: m.length,
  };
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
      const tipo = String((req.query && req.query.tipo) || 'dados');

      if (tipo === 'backup') {
        const dia = String((req.query && req.query.dia) || '');
        let lista = lerJson(await redis(['GET', backupIdFor(key)]), []);
        if (!Array.isArray(lista)) lista = [];
        lista = lista.filter(x => x && x.dia);
        if (dia) {
          const b = lista.find(x => x.dia === dia);
          if (!b) { res.status(200).json({ vazio: true }); return; }
          res.status(200).json(b);
          return;
        }
        lista.sort((a, b) => (a.dia < b.dia ? 1 : -1));
        res.status(200).json({
          backups: lista.map(x => ({ dia: x.dia, updatedAt: x.updatedAt, device: x.device, resumo: x.resumo || null })),
        });
        return;
      }

      const raw = await redis(['GET', idFor(key)]);
      if (!raw) { res.status(200).json({ vazio: true }); return; }
      const obj = lerJson(raw, null);
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
      const tipo = String(body.tipo || 'dados');

      if (tipo === 'backup') {
        const dia = String(body.dia || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) { res.status(400).json({ error: 'dia_invalido' }); return; }
        if (!body.data || typeof body.data !== 'object') { res.status(400).json({ error: 'sem_dados' }); return; }
        const str = JSON.stringify(body.data);
        if (str.length > 900000) { res.status(413).json({ error: 'dados_grandes_demais' }); return; }

        let lista = lerJson(await redis(['GET', backupIdFor(key)]), []);
        if (!Array.isArray(lista)) lista = [];
        lista = lista.filter(x => x && x.dia && x.dia !== dia);
        lista.push({
          dia,
          updatedAt: Date.now(),
          device: String(body.device || '').slice(0, 60),
          resumo: resumoDe(body.data),
          data: body.data,
        });
        lista.sort((a, b) => (a.dia < b.dia ? 1 : -1));
        lista = lista.slice(0, MAX_BACKUPS);

        await redis(['SET', backupIdFor(key), JSON.stringify(lista)]);
        res.status(200).json({ ok: true, dia, guardadas: lista.length, dias: lista.map(x => x.dia) });
        return;
      }

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
