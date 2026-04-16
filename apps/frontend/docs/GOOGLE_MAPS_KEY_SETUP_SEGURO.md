# Google Maps API Key — Configuração Segura

## Por que a chave é pública no browser

A variável `VITE_GOOGLE_MAPS_API_KEY` é incorporada ao bundle JavaScript pelo Vite
em tempo de build. **Qualquer pessoa que abrir o DevTools pode lê-la.** Isso é
normal e esperado para chaves de browser — o Google foi projetado para isso.

A proteção real não está em esconder a chave, mas em **restringir o que ela pode
fazer e de onde ela pode ser usada**.

---

## Configuração no Google Cloud Console

### 1. Acessar Credentials

Google Cloud Console → APIs & Services → Credentials → selecionar a chave.

### 2. Restringir por HTTP Referrer (Application Restrictions)

Selecionar **"HTTP referrers (web sites)"** e adicionar:

| Ambiente     | Referrer                                    |
|--------------|---------------------------------------------|
| Produção     | `https://app.sentinella.com.br/*`           |
| Homologação  | `https://homolog.sentinella.com.br/*`       |
| Dev local    | `http://localhost:5173/*`                   |
| Dev local    | `http://localhost:4173/*` (preview do Vite) |

Com essa restrição, a chave só funciona quando a requisição origina nesses domínios.
Qualquer uso fora deles recebe `REQUEST_DENIED`.

### 3. Restringir por API (API Restrictions)

Selecionar **"Restrict key"** e habilitar **somente**:

- ✅ **Geocoding API** — usada em `NotificadorRegistroCaso.tsx`

Deixar desabilitado tudo mais (Maps JavaScript API, Places API, etc.) a menos que
seja adicionado no código.

---

## Como configurar no projeto

### Desenvolvimento local

Copiar `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

Preencher:

```env
VITE_GOOGLE_MAPS_API_KEY=AIza...sua-chave-dev
```

### Produção / Homologação

Configurar a variável de ambiente na plataforma de deploy (Vercel, Netlify, etc.)
ou no CI/CD. **Nunca commitar `.env.local` ou `.env.production`.**

---

## Como a chave é usada no código

Arquivo: `src/pages/notificador/NotificadorRegistroCaso.tsx`

- Lida via `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`
- Usada exclusivamente para chamadas à **Geocoding API**
  (`https://maps.googleapis.com/maps/api/geocode/json`)
- Se a chave não estiver configurada, o formulário exibe aviso e libera entrada
  manual de coordenadas (fallback gracioso)

---

## Checklist de segurança

- [ ] Chave de produção tem HTTP Referrer restrito ao domínio oficial
- [ ] Chave de produção tem API Restriction: apenas Geocoding API
- [ ] Chave de dev/homologação é diferente da chave de produção
- [ ] Chave de dev tem referrer `http://localhost:5173/*`
- [ ] Monitoramento de quota habilitado no Google Cloud Console
- [ ] Alertas de billing configurados (evitar surpresas se a chave vazar)
