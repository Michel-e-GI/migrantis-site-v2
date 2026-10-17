# Migrantis — site institucional e assistente migratório

Site estático em HTML, CSS e JavaScript, preparado para Cloudflare Pages e Pages Functions. Não exige build nem dependências npm.

## Estrutura

- `public/`: site público (HTML, CSS, JS, favicon).
- `functions/api/chat.js`: endpoint `POST /api/chat`, que consulta Gemini no servidor e retorna links oficiais disponíveis.
- `functions/api/contact.js`: endpoint `POST /api/contact`, que envia o formulário por Resend.
- `wrangler.toml`: configuração de Cloudflare Pages e modelo Gemini.

## Publicar com segurança sem afetar o site atual

1. Baixe/extraia este projeto para uma pasta local.
2. Crie um **repositório novo** no GitHub, por exemplo `migrantis-site-v2`. Use esse nome para que o endereço de teste seja `https://migrantis-site-v2.pages.dev`. Não sobrescreva o repositório antigo nesta fase.
3. Envie todos os arquivos e pastas mantendo exatamente a estrutura acima, incluindo a pasta `functions` na raiz.
4. No Cloudflare, vá a **Workers & Pages → Create application → Pages → Connect to Git** e conecte o novo repositório.
5. Configure: branch `main`, Build command vazio e Build output directory `public`. Se o painel mostrar Root directory, deixe `/`.
6. Publique e use o endereço `https://NOME-DO-NOVO-PROJETO.pages.dev` para testar. Não altere DNS nem domínios personalizados ainda.
7. Em Settings → Variables and Secrets, configure os segredos listados abaixo para o ambiente Production (e Preview se necessário). Faça um novo deploy depois de salvar.

## Variáveis e segredos

**Segredos (tipo Secret, nunca no código):**

- `GEMINI_API_KEY`: sua chave existente do Google AI Studio. Não a compartilhe nem a cole em arquivos do repositório.
- `RESEND_API_KEY`: chave do serviço Resend, necessária para o envio de e-mail.

**Variáveis de ambiente não secretas:**

- `GEMINI_MODEL`: já definido em `wrangler.toml` como `gemini-2.5-flash`; só altere se confirmar que outro modelo está disponível para sua chave.
- `MAIL_FROM`: remetente verificado no Resend, por exemplo `Migrantis <site@migrantis.com.br>` somente depois de verificar o domínio/remetente no Resend.
- `CONTACT_TO`: e-mail que receberá as mensagens. Defina o endereço correto de destino no painel Cloudflare. Confirme se deseja `contato@migrantis.com.br` ou `contact@migrantes.com.br` antes de configurar.

Não use o mesmo nome para Secret e Variable. As chaves só são lidas no backend; não são inseridas no navegador.

## Chatbot Gemini

O endpoint usa `GEMINI_API_KEY` no servidor e a ferramenta Google Search do Gemini. Os links mostrados ao visitante são filtrados para HTTPS em domínios `gov.br` ou subdomínios. Isso reduz fontes não oficiais, mas não garante que toda frase esteja correta ou que toda resposta tenha fonte; confira o texto e os links. Erros detalhados do provedor ficam apenas nos logs do servidor; a resposta pública é genérica.

Se o chatbot retornar erro 502:
1. confirme se `GEMINI_API_KEY` está como Secret no projeto Pages correto;
2. confirme se a API Gemini está disponível para a chave/projeto e se há cota;
3. veja Logs/Observability do Pages Function para a mensagem `Gemini API request failed`;
4. não compartilhe a chave ao pedir ajuda. Compartilhe apenas status HTTP e mensagem de erro, removendo dados privados.

## Formulário de contato

O formulário usa Resend. Ele **não envia e-mail até** que `RESEND_API_KEY`, `MAIL_FROM` e `CONTACT_TO` estejam configurados. O remetente `MAIL_FROM` precisa estar autorizado/verificado no Resend. A validação do formulário e o campo honeypot são medidas básicas, não substituem rate limiting e proteção antiabuso em produção; considere Cloudflare Turnstile e monitoramento de abuso antes de anunciar o site amplamente.

## Domínio e CORS

O domínio personalizado não é alterado por este projeto. Os endpoints aceitam origens de `migrantis-site-v2.pages.dev`, `migrantis.com.br` e `www.migrantis.com.br`. Se você escolher outro nome para o projeto Pages de teste, acrescente a origem exata em `ALLOWED_ORIGINS` nos dois arquivos de função e publique novamente. Não vincule `migrantis.com.br` até concluir os testes.

## WhatsApp

No início de `public/app.js`, configure `WHATSAPP_NUMBER` com o telefone em formato internacional, apenas dígitos (por exemplo, código do país + DDD + número). Deixe vazio se ainda não quiser publicar um número.

## Privacidade e LGPD — checklist antes de produção

- Publicar aviso/política de privacidade real, com identidade do controlador, finalidade, base legal, retenção, direitos dos titulares e canal de contato.
- Confirmar e documentar a base legal e a necessidade de cada dado coletado.
- Evitar solicitar passaporte, CPF, documentos ou dados sensíveis no chatbot/formulário inicial.
- Limitar acesso aos e-mails recebidos, definir prazo de retenção e procedimento para atender solicitações dos titulares.
- Revisar termos dos fornecedores (Cloudflare, Google e Resend), transferências internacionais e configurações de logs.
- Configurar proteção contra abuso/rate limit, monitorar custos e testar erros sem revelar segredos.
- Não anunciar que há atendimento profissional/representação jurídica incluídos sem confirmar o escopo real dos serviços.

## Testes mínimos antes de conectar o domínio

- Página abre em desktop e celular.
- Menu funciona no celular.
- Chat responde pergunta geral e mostra somente links HTTPS de fontes governamentais quando houver fontes retornadas.
- Pergunta inválida mostra mensagem apropriada.
- Formulário retorna mensagem de configuração pendente até o e-mail ser configurado; após configuração, enviar um teste e confirmar recebimento.
- Conferir console e logs de Functions; nenhuma chave aparece no código-fonte ou nas requisições do navegador.
- Revisar política de privacidade, WhatsApp e endereço de e-mail antes de produção.
