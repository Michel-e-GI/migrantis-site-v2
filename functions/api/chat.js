const ALLOWED_ORIGINS = new Set([
  'https://migrantis-site-v2.pages.dev',
  'https://migrantis.com.br',
  'https://www.migrantis.com.br'
]);
const MAX_QUESTION_LENGTH = 1200;
const OFFICIAL_DOMAINS = ['gov.br'];

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
function originAllowed(request) {
  const origin = request.headers.get('Origin');
  // Requests without Origin are not rejected solely on that basis; the endpoint
  // still validates content, length and API configuration.
  return !origin || ALLOWED_ORIGINS.has(origin);
}
function isOfficialUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && OFFICIAL_DOMAINS.some(domain =>
      url.hostname.toLowerCase() === domain || url.hostname.toLowerCase().endsWith(`.${domain}`)
    );
  } catch { return false; }
}
function uniqueOfficialSources(chunks) {
  const sources = [];
  for (const chunk of chunks || []) {
    const web = chunk && chunk.web;
    if (!web || !web.uri || !isOfficialUrl(web.uri)) continue;
    try {
      const url = new URL(web.uri);
      sources.push({ title: String(web.title || url.hostname).slice(0, 180), url: url.href });
    } catch { /* Ignore malformed source */ }
  }
  return [...new Map(sources.map(source => [source.url, source])).values()].slice(0, 8);
}

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return json({ error: 'Origem não autorizada.' }, 403);
  if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
    return json({ error: 'Formato de solicitação inválido.' }, 415);
  }
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Não foi possível ler a pergunta.' }, 400); }
  const question = String(body?.question || '').trim();
  if (question.length < 3) return json({ error: 'Digite uma pergunta mais completa.' }, 400);
  if (question.length > MAX_QUESTION_LENGTH) return json({ error: 'A pergunta ultrapassa o limite permitido.' }, 413);
  if (!env.GEMINI_API_KEY) {
    console.error('Configuração ausente: GEMINI_API_KEY');
    return json({ error: 'O assistente ainda não está configurado. Entre em contato com a equipe.' }, 503);
  }

  const systemInstruction = `Você é o Assistente Migrantis, um assistente de informação inicial sobre imigração e nacionalidade no Brasil. Responda em português brasileiro, com linguagem clara, respeitosa e organizada. Seja prudente: não prometa resultados, não invente prazos, taxas, formulários, requisitos ou garantias. Priorize pesquisa e fontes oficiais do governo brasileiro, especialmente domínios gov.br, Polícia Federal, Ministério da Justiça e Relações Exteriores. Use a ferramenta de pesquisa na web quando disponível para verificar informações atuais. Ao explicar procedimentos, diferencie informação geral de análise individual. Quando a informação depender de circunstâncias pessoais ou houver dúvida, diga isso expressamente e indique o órgão oficial competente para confirmação. Não se apresente como advogado nem substitua aconselhamento jurídico individual. Não peça dados pessoais sensíveis, número de passaporte, CPF, endereço, senha ou documentos. Se não conseguir confirmar uma informação em fonte oficial, deixe clara essa limitação. Mantenha a resposta concisa, com etapas práticas quando útil.`;

  try {
    const model = String(env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
      })
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      // Keep the detailed provider error in server logs, never return API details to visitors.
      console.error('Gemini API request failed', {
        status: upstream.status,
        message: String(result?.error?.message || 'No provider details').slice(0, 400),
        model
      });
      return json({ error: 'Não foi possível consultar o assistente agora. Tente novamente mais tarde.' }, 502);
    }
    const candidate = result?.candidates?.[0];
    const answer = (candidate?.content?.parts || []).map(part => part.text || '').join('').trim();
    const sources = uniqueOfficialSources(candidate?.groundingMetadata?.groundingChunks || []);
    if (!answer) {
      console.warn('Gemini returned no text candidate', { model, finishReason: candidate?.finishReason || 'unknown' });
      return json({ error: 'O assistente não conseguiu formular uma resposta. Tente reformular sua pergunta.' }, 502);
    }
    return json({ answer, sources });
  } catch (error) {
    console.error('Gemini connection failed', String(error?.message || error).slice(0, 400));
    return json({ error: 'Falha temporária ao consultar o assistente. Tente novamente mais tarde.' }, 502);
  }
}
export async function onRequestGet() {
  return json({ error: 'Método não permitido.' }, 405);
}
