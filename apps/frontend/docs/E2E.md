# Testes E2E (Playwright)

Os testes e2e cobrem login, navegação, rotas protegidas e páginas públicas.

## Como rodar

### Opção 1: Servidor iniciado pelo Playwright (padrão)

```bash
npm run test:e2e
```

O Playwright sobe `npm run dev` e espera o app em http://localhost:8080 (até 2 min). Se o servidor já estiver rodando na porta 8080, ele será reutilizado.

### Opção 2: Servidor já rodando

Em um terminal:

```bash
npm run dev
```

Em outro:

```bash
$env:SERVER_URL="http://localhost:8080"; npx playwright test --project=chromium
```

No PowerShell use `$env:SERVER_URL="http://localhost:8080"`. No Bash: `SERVER_URL=http://localhost:8080 npx playwright test --project=chromium`.

### Apenas Chromium (mais rápido)

```bash
npx playwright test --project=chromium
```

### Interface gráfica

```bash
npm run test:e2e:ui
```

## Estrutura dos testes

| Arquivo | O que testa |
|---------|-------------|
| `e2e/login.spec.ts` | Formulário de login, erro de credenciais, "Esqueci minha senha" |
| `e2e/navigation.spec.ts` | Redirecionamento para /login ao acessar /, /levantamentos, /mapa, /admin; página 404 |
| `e2e/install.spec.ts` | Página /install (PWA) |
| `e2e/reset-password.spec.ts` | Página /reset-password (carrega; link inválido) |
| `e2e/trocar-senha.spec.ts` | /trocar-senha sem auth → /login |
| `e2e/operador.spec.ts` | /operador sem auth → /login |
| `e2e/login-links.spec.ts` | Link "Instalar" na login leva a /install |

## Requisitos

- Node e npm instalados
- Browser Chromium (instalado com `npx playwright install chromium` na primeira vez)

## Relatório após falha

```bash
npx playwright show-report
```

Abra a pasta `playwright-report` (gerada após uma execução) para ver traces e screenshots.
