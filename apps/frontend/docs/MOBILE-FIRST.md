# Abordagem Mobile First — Sentinella Map

A aplicação e os módulos estão configurados para **mobile first**: o layout base é pensado para telas pequenas e, em seguida, ajustado para tablets e desktop com os breakpoints do Tailwind.

## Confirmação

### 1. Viewport e PWA (`index.html`)
- `width=device-width, initial-scale=1.0` — viewport responsivo.
- `apple-mobile-web-app-capable`, `theme-color` — suporte a PWA em mobile.
- Ícones e meta para instalação no celular.

### 2. Tailwind (mobile first por padrão)
- **Base (sem prefixo)** = estilos para mobile.
- **sm:** (640px+), **md:** (768px+), **lg:** (1024px+) = progressão para telas maiores.
- Não há uso de `max-sm`/`max-md` (que seriam desktop first).

### 3. Layout principal (`AppLayout`)
- **Sidebar**: oculta no mobile (`-translate-x-full`), visível em `lg:`; botão de menu só em mobile (`lg:hidden`).
- **Conteúdo**: `pb-16 lg:pb-0` — espaço para a barra inferior no mobile.
- **Bottom nav**: visível só no mobile (fixa no rodapé); em desktop a navegação fica na sidebar.

### 4. Páginas e componentes
- **Login**: `flex-col lg:flex-row` — coluna no mobile, linha em desktop.
- **Dashboard**: `grid-cols-2 lg:grid-cols-4` (StatsGrid), `grid gap-4 lg:grid-cols-2` (gráficos).
- **Levantamentos**: `flex-col gap-3 sm:flex-row` nos filtros; lista adaptada.
- **Admin (Clientes, Voos, Plúvio, etc.)**: 
  - Barra de ações: `flex-col gap-3 sm:flex-row`, botões `flex-1 sm:flex-auto`.
  - Tabelas: `hidden md:block` (tabela) e `md:hidden` (lista em cards) — tabela em desktop, cards no mobile.
- **Mapa**: controles com `h-7 sm:h-8 md:h-9`, `touch-manipulation` em botões; painel lateral com Sheet no mobile.

### 5. Toque e interação
- `touch-manipulation` em botões do mapa e do painel para melhor resposta ao toque.
- Componentes como Sheet/Drawer para painéis no mobile em vez de coluna fixa.

### 6. Tipografia e espaçamento
- Uso consistente de `text-sm lg:text-base`, `p-4 lg:p-6`, `gap-3 sm:gap-4` — menor no mobile, maior no desktop.

## Resumo

| Área           | Mobile first |
|----------------|--------------|
| Viewport / PWA | Sim          |
| Tailwind       | Sim (padrão) |
| AppLayout      | Sim          |
| Login          | Sim          |
| Dashboard      | Sim          |
| Levantamentos  | Sim          |
| Mapa           | Sim          |
| Admin (todas)  | Sim          |
| Tabelas → Cards no mobile | Sim (MobileListCard) |

A aplicação está configurada de forma **mobile first** em todos os módulos analisados.
