const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

async function supabase(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : null,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

async function hashPass(pass) {
  const enc = new TextEncoder().encode(pass);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const path = event.path.replace('/api/bet', '').replace('/.netlify/functions/bet', '');
  const method = event.httpMethod;

  try {
    // GET /api/bet/:id — bahis + katılımcıları getir
    if (method === 'GET' && path.match(/^\/[a-z0-9]+$/i)) {
      const id = path.slice(1);
      const bet = await supabase(`/bets?id=eq.${id}&select=*`);
      if (!bet.ok || !bet.data?.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Bahis bulunamadı' }) };
      const parts = await supabase(`/participants?bet_id=eq.${id}&select=*&order=joined_at.asc`);
      const result = { ...bet.data[0], participants: parts.data || [] };
      // admin hash'i asla gönderme
      delete result.admin_hash;
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // POST /api/bet — yeni bahis oluştur
    if (method === 'POST' && path === '') {
      const b = JSON.parse(event.body);
      const { title, description, opt_a_name, opt_a_odds, opt_b_name, opt_b_odds, admin_pass } = b;
      if (!title || !opt_a_name || !opt_b_name || !admin_pass) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Eksik alan' }) };
      const admin_hash = await hashPass(admin_pass);
      const res = await supabase('/bets', 'POST', { title, description, opt_a_name, opt_a_odds, opt_b_name, opt_b_odds, admin_hash });
      if (!res.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Oluşturulamadı' }) };
      const created = Array.isArray(res.data) ? res.data[0] : res.data;
      delete created.admin_hash;
      return { statusCode: 201, headers, body: JSON.stringify(created) };
    }

    // POST /api/bet/:id/join — bahise katıl
    if (method === 'POST' && path.match(/^\/[a-z0-9]+\/join$/i)) {
      const id = path.split('/')[1];
      const { nickname, choice, amount } = JSON.parse(event.body);
      if (!nickname || !choice || !amount) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Eksik alan' }) };

      // Bahis açık mı?
      const bet = await supabase(`/bets?id=eq.${id}&select=status`);
      if (!bet.data?.length || bet.data[0].status !== 'open') return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bahis kapalı' }) };

      const res = await supabase('/participants', 'POST', { bet_id: id, nickname, choice, amount });
      if (!res.ok) return { statusCode: 409, headers, body: JSON.stringify({ error: 'Bu nickname alınmış veya hata oluştu' }) };
      return { statusCode: 201, headers, body: JSON.stringify({ ok: true }) };
    }

    // POST /api/bet/:id/resolve — kazananı belirle
    if (method === 'POST' && path.match(/^\/[a-z0-9]+\/resolve$/i)) {
      const id = path.split('/')[1];
      const { winner, admin_pass } = JSON.parse(event.body);
      if (!winner || !admin_pass) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Eksik alan' }) };

      const bet = await supabase(`/bets?id=eq.${id}&select=admin_hash`);
      if (!bet.data?.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Bahis bulunamadı' }) };

      const hash = await hashPass(admin_pass);
      if (hash !== bet.data[0].admin_hash) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Yanlış şifre' }) };

      await supabase(`/bets?id=eq.${id}`, 'PATCH', { status: 'resolved', winner });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
