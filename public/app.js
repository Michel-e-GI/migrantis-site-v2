(() => {
  'use strict';
  // Configure seu WhatsApp no formato internacional, somente números. Ex.: 5511999999999
  const WHATSAPP_NUMBER = '';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  $('#year').textContent = String(new Date().getFullYear());

  const menuToggle = $('#menuToggle');
  const mainNav = $('#mainNav');
  menuToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  });
  $$('#mainNav a').forEach(link => link.addEventListener('click', () => {
    mainNav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }));

  const whatsappLink = $('#whatsappLink');
  if (WHATSAPP_NUMBER) {
    whatsappLink.href = `https://wa.me/${WHATSAPP_NUMBER}`;
    whatsappLink.target = '_blank';
    whatsappLink.rel = 'noopener noreferrer';
    $('small', whatsappLink).textContent = 'Atendimento pelo WhatsApp';
  } else {
    whatsappLink.href = '#contato';
    whatsappLink.addEventListener('click', event => {
      event.preventDefault();
      $('#contactName').focus();
      $('#contactForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const chatForm = $('#chatForm');
  const chatInput = $('#chatInput');
  const chatMessages = $('#chatMessages');
  const chatError = $('#chatError');
  const suggestions = $$('.suggestion');
  let requestPending = false;

  function addMessage(text, type, sources = []) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${type === 'user' ? 'user-message' : 'bot-message'}`;
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    wrapper.appendChild(paragraph);
    if (type !== 'user' && sources.length) {
      const sourceBox = document.createElement('div');
      sourceBox.className = 'source-list';
      const heading = document.createElement('strong');
      heading.textContent = 'Fontes oficiais para consulta';
      sourceBox.appendChild(heading);
      sources.forEach(source => {
        try {
          const url = new URL(source.url);
          if (url.protocol !== 'https:') return;
          const a = document.createElement('a');
          a.href = url.href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = String(source.title || url.hostname).slice(0, 180);
          sourceBox.appendChild(a);
        } catch { /* Ignora URLs inválidas */ }
      });
      if (sourceBox.querySelector('a')) wrapper.appendChild(sourceBox);
    }
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return wrapper;
  }

  async function askChat(question) {
    if (requestPending) return;
    const normalized = String(question || '').trim();
    if (normalized.length < 3) {
      chatError.hidden = false;
      chatError.textContent = 'Digite uma pergunta um pouco mais completa.';
      return;
    }
    requestPending = true;
    chatError.hidden = true;
    suggestions.forEach(button => { button.disabled = true; });
    $('#chatForm button[type="submit"]').disabled = true;
    addMessage(normalized, 'user');
    const pending = addMessage('Consultando informações disponíveis. Isso pode levar alguns segundos…', 'bot');
    pending.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: normalized })
      });
      const data = await response.json().catch(() => ({}));
      pending.remove();
      if (!response.ok) {
        const friendly = response.status === 429
          ? 'Muitas perguntas em pouco tempo. Aguarde um instante e tente novamente.'
          : 'Não foi possível consultar o assistente agora. Tente novamente mais tarde ou use o formulário de contato.';
        addMessage(friendly, 'bot');
        return;
      }
      addMessage(String(data.answer || 'Não encontrei uma resposta clara. Consulte os canais oficiais.'), 'bot', Array.isArray(data.sources) ? data.sources : []);
    } catch {
      pending.remove();
      addMessage('Não foi possível conectar ao assistente. Verifique sua conexão e tente novamente.', 'bot');
    } finally {
      requestPending = false;
      suggestions.forEach(button => { button.disabled = false; });
      $('#chatForm button[type="submit"]').disabled = false;
      chatInput.focus();
    }
  }
  chatForm.addEventListener('submit', event => {
    event.preventDefault();
    const question = chatInput.value;
    chatInput.value = '';
    askChat(question);
  });
  suggestions.forEach(button => button.addEventListener('click', () => askChat(button.textContent)));

  const contactForm = $('#contactForm');
  const contactStatus = $('#contactStatus');
  contactForm.addEventListener('submit', async event => {
    event.preventDefault();
    contactStatus.className = 'form-status';
    contactStatus.textContent = '';
    const submit = $('.form-submit', contactForm);
    if (!$('#privacyConsent').checked) {
      contactStatus.classList.add('error');
      contactStatus.textContent = 'Marque a autorização para tratamento dos dados antes de enviar.';
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Enviando…';
    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData.entries());
    payload.consent = $('#privacyConsent').checked;
    try {
      const response = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a mensagem.');
      contactStatus.classList.add('success');
      contactStatus.textContent = data.message || 'Mensagem recebida. Obrigado por entrar em contato.';
      contactForm.reset();
    } catch (error) {
      contactStatus.classList.add('error');
      contactStatus.textContent = error.message === 'Failed to fetch'
        ? 'Não foi possível conectar ao serviço de envio. Tente novamente mais tarde.'
        : (error.message || 'Não foi possível enviar. Tente novamente mais tarde.');
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Enviar mensagem <span>↗</span>';
    }
  });
})();
