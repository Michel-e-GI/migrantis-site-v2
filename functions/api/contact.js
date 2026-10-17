const ALLOWED_ORIGINS = new Set([
  'https://migrantis-site-v2.pages.dev',
  'https://migrantis.com.br',
  'https://www.migrantis.com.br'
]);
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
function clean(value, max) { return String(value ?? '').trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max); }
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origem não autorizada.' }, 403);
  if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) return json({ error: 'Formato inválido.' }, 415);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Não foi possível ler o formulário.' }, 400); }
  // Honeypot: silently accept bot submissions without sending email.
  if (clean(body?.website, 200)) return json({ message: 'Mensagem recebida. Obrigado.' });
  const name = clean(body?.name, 100);
  const email = clean(body?.email, 160);
  const subject = clean(body?.subject || 'Contato pelo site Migrantis', 120);
  const message = clean(body?.message, 3000);
  if (!body?.consent) return json({ error: 'É necessário autorizar o uso dos dados para responder à mensagem.' }, 400);
  if (name.length < 2) return json({ error: 'Informe seu nome.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Informe um e-mail válido.' }, 400);
  if (message.length < 10) return json({ error: 'Escreva uma mensagem um pouco mais completa.' }, 400);
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.CONTACT_TO) {
    console.error('Contact form not configured: RESEND_API_KEY, MAIL_FROM or CONTACT_TO missing');
    return json({ error: 'O formulário ainda está sendo configurado. Por favor, tente novamente mais tarde ou use outro canal de contato.' }, 503);
  }
  const safeSubject = subject.replace(/[\r\n]/g, ' ').slice(0, 120);
  const emailText = [
    'Nova mensagem recebida pelo site Migrantis',
    '',
    `Nome: ${name}`,
    `E-mail para resposta: ${email}`,
    `Assunto: ${safeSubject}`,
    '',
    'Mensagem:',
    message,
    '',
    'A pessoa marcou a autorização de uso dos dados para resposta ao contato.'
  ].join('\n');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [env.CONTACT_TO],
        reply_to: email,
        subject: `Migrantis | ${safeSubject}`,
        text: emailText
      })
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      console.error('Contact email provider failed', { status: response.status, message: String(details?.message || details?.name || 'No provider details').slice(0, 300) });
      return json({ error: 'Não foi possível enviar sua mensagem agora. Tente novamente mais tarde.' }, 502);
    }
    return json({ message: 'Sua mensagem foi enviada. Obrigado por entrar em contato com a Migrantis.' });
  } catch (error) {
    console.error('Contact email connection failed', String(error?.message || error).slice(0, 300));
    return json({ error: 'Falha temporária no envio. Tente novamente mais tarde.' }, 502);
  }
}
export async function onRequestGet() { return json({ error: 'Método não permitido.' }, 405); }
