# Correções de Segurança P1 — Aplicadas em 2026-04-11

Este documento registra as três correções de segurança prioritárias aplicadas
após auditoria. Todas as mudanças são pequenas, diretas e não alteram arquitetura.

---

## S1 — CORS Restritivo nas Edge Functions

### Problema

Cinco Edge Functions internas (usadas apenas por cron ou pelo próprio app)
tinham `Access-Control-Allow-Origin: *`, aceitando requisições de qualquer origem.

### Solução aplicada

Substituição por `Deno.env.get('APP_ORIGIN') ?? 'https://app.sentinella.com.br'`
em todas as funções afetadas.

### Arquivos alterados

| Arquivo | Linha modificada |
|---|---|
| `supabase/functions/limpeza-retencao-logs/index.ts` | `corsHeaders['Access-Control-Allow-Origin']` |
| `supabase/functions/pluvio-risco-daily/index.ts` | `corsHeaders["Access-Control-Allow-Origin"]` |
| `supabase/functions/resumo-diario/index.ts` | `corsHeaders['Access-Control-Allow-Origin']` |
| `supabase/functions/sla-marcar-vencidos/index.ts` | `corsHeaders["Access-Control-Allow-Origin"]` |
| `supabase/functions/upload-evidencia/index.ts` | `CORS['Access-Control-Allow-Origin']` |

### Deploy obrigatório

Após o deploy das funções, configurar o secret:

```bash
npx supabase secrets set APP_ORIGIN=https://app.sentinella.com.br
```

Para homologação, usar o domínio correspondente.

### Notas

- O tratamento de `OPTIONS` (preflight) continua funcionando — o header é aplicado
  da mesma forma para as respostas OPTIONS.
- O fallback `'https://app.sentinella.com.br'` garante que, mesmo sem o secret
  configurado, a função não aceita origens arbitrárias.
- Funções que já tinham autenticação por `CRON_SECRET` ou `Authorization: Bearer`
  continuam com essa camada intacta.

---

## S2 — Content Security Policy no Frontend

### Problema

O `index.html` não possuía CSP, deixando o browser sem restrições sobre quais
recursos podiam ser carregados.

### Solução aplicada

Adicionada `<meta http-equiv="Content-Security-Policy">` no `index.html`.

### Arquivo alterado

`index.html` — tag `<meta>` inserida antes das PWA meta tags.

### Diretivas e justificativas

| Diretiva | Valor | Motivo |
|---|---|---|
| `default-src` | `'self'` | Fallback seguro |
| `script-src` | `'self' 'unsafe-inline'` | Vite HMR em dev + build modules |
| `style-src` | `'self' 'unsafe-inline' fonts.googleapis.com` | CSS-in-JS (shadcn/Radix) + Google Fonts |
| `font-src` | `'self' fonts.gstatic.com data:` | Google Fonts + fontes inline |
| `img-src` | `'self' data: blob: *.cloudinary.com *.tile.openstreetmap.org maps.gstatic.com maps.googleapis.com` | Evidências, assinatura digital, tiles OSM, Google Maps estático |
| `connect-src` | `'self' *.supabase.co wss://*.supabase.co maps.googleapis.com` | REST + Realtime Supabase + Geocoding Google Maps |
| `worker-src` | `'self' blob:` | Service Worker do PWA |
| `frame-src` | `'none'` | Nenhum iframe esperado |
| `object-src` | `'none'` | Bloqueia Flash/plugins |
| `base-uri` | `'self'` | Previne injeção de `<base>` |

### Nota sobre `'unsafe-inline'`

`'unsafe-inline'` em `script-src` é mantido porque o Vite injeta scripts inline
durante o desenvolvimento (HMR). Em produção, o build do Vite gera apenas módulos
externos, então este valor poderia ser removido de `script-src` no servidor de
produção via header HTTP (mais restritivo que meta tag). Deixado inclusivo aqui
para não quebrar o ambiente de desenvolvimento.

---

## S3 — Google Maps API Key

### Problema

A chave `VITE_GOOGLE_MAPS_API_KEY` estava documentada de forma genérica no
`.env.example`, sem instrução clara sobre como protegê-la no Google Cloud Console.

### Solução aplicada

- `.env.example` atualizado com instruções inline sobre HTTP Referrer Restriction
- Criada documentação detalhada: `docs/GOOGLE_MAPS_KEY_SETUP_SEGURO.md`
- Secret `APP_ORIGIN` documentado no `.env.example` e adicionado ao comando `secrets set`

### Arquivos alterados / criados

| Arquivo | Ação |
|---|---|
| `.env.example` | Comentários de segurança + documentação de `APP_ORIGIN` |
| `docs/GOOGLE_MAPS_KEY_SETUP_SEGURO.md` | Novo — guia completo de configuração segura |

### Ação necessária pelo time

A proteção real depende de configuração no Google Cloud Console — ver
`docs/GOOGLE_MAPS_KEY_SETUP_SEGURO.md` para o passo a passo completo.

---

## Checklist de aceite

### S1 — CORS
- [x] Nenhuma das 5 funções tem `Access-Control-Allow-Origin: *`
- [x] Todas usam `APP_ORIGIN` com fallback `https://app.sentinella.com.br`
- [x] Preflight OPTIONS continua funcionando (header aplicado da mesma forma)
- [ ] Secret `APP_ORIGIN` configurado via `supabase secrets set` *(ação de deploy)*

### S2 — CSP
- [x] `index.html` tem CSP explícita
- [x] Cobre Supabase REST e Realtime (WSS)
- [x] Cobre Cloudinary, OSM, Google Maps Geocoding
- [x] Compatível com PWA (worker-src blob:)
- [x] Compatível com Vite dev e build de produção

### S3 — Google Maps
- [x] `VITE_GOOGLE_MAPS_API_KEY` documentada com aviso de exposição no bundle
- [x] `.env.example` explica HTTP Referrer Restriction e API Restriction
- [x] `docs/GOOGLE_MAPS_KEY_SETUP_SEGURO.md` criado com passo a passo
- [ ] Chave de produção restrita por HTTP Referrer no Google Cloud Console *(ação de deploy)*
- [ ] Chave de produção restrita a Geocoding API *(ação de deploy)*
