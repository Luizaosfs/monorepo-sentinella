# Publicar o site na Hostinger

Este projeto é uma **SPA** (React + Vite) que usa **Supabase** como backend. Na Hostinger você publica só o frontend (arquivos estáticos).

---

## O que você precisa

1. **Conta na Hostinger** com plano de hospedagem (Shared ou superior).
2. **Domínio** apontando para a Hostinger (ou subdomínio).
3. **Supabase** já configurado (o projeto já usa; não precisa hospedar backend na Hostinger).

---

## Opção A: Hospedagem compartilhada (File Manager / FTP)

### 1. Gerar o build

No computador, na pasta do projeto:

```bash
npm install
npm run build
```

Isso gera a pasta **`dist`** com o site pronto para produção.

### 2. Enviar os arquivos

- Acesse o **Painel Hostinger** → **Gerenciador de Arquivos** (File Manager).
- Vá até **`public_html`** (pasta raiz do seu domínio).
- **Apague** o conteúdo antigo de `public_html` (se houver), mas **não** apague a própria pasta.
- **Envie** todo o **conteúdo** da pasta **`dist`** (não a pasta `dist` em si) para dentro de `public_html`.

Ou use um cliente **FTP** (FileZilla, etc.): conecte no FTP da Hostinger e envie o conteúdo de `dist` para `public_html`.

### 3. Rotas (React Router)

O arquivo **`.htaccess`** já está na pasta `public` do projeto e é copiado para `dist` no build. Ele faz o Apache redirecionar todas as rotas para `index.html`, para o React Router funcionar. Se mesmo assim der 404 em rotas como `/login` ou `/dashboard`, crie manualmente em `public_html` um `.htaccess` com:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### 4. Variáveis de ambiente (opcional)

O projeto já tem valores padrão para Supabase em código. Se quiser usar um projeto Supabase diferente em produção:

- Crie no Supabase (ou use o mesmo) e pegue **URL** e **Chave anônima (anon key)**.
- Antes do `npm run build`, crie um arquivo **`.env`** na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

Depois rode de novo `npm run build` e envie de novo o conteúdo de `dist` para a Hostinger.

---

## Opção B: Hostinger com suporte a Node/Vite (Cloud / Front-end)

Se seu plano for **Cloud** ou tiver “Front-end / Node”:

1. No painel Hostinger, use a opção de **deploy de aplicação front-end**.
2. Conecte o **repositório GitHub** do projeto (ou envie um ZIP do código).
3. Configure:
   - **Comando de build:** `npm run build`
   - **Pasta de saída:** `dist`
4. Faça o deploy. A Hostinger vai rodar o build e publicar a pasta `dist`.

Nesse caso você não precisa enviar manualmente os arquivos; o deploy é automático a cada push (se configurar assim).

---

## Resumo rápido

| Etapa | Ação |
|-------|------|
| 1 | `npm install` e `npm run build` |
| 2 | Enviar **conteúdo** da pasta **`dist`** para **`public_html`** na Hostinger |
| 3 | Garantir que o `.htaccess` está em `public_html` (já vem no build) |
| 4 | (Opcional) Configurar `.env` com Supabase e gerar novo build |

Depois disso, acesse seu domínio e o site deve abrir. O backend continua no Supabase; a Hostinger só serve os arquivos estáticos do frontend.
