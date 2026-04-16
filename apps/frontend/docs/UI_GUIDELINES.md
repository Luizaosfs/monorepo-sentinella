# UI Guidelines - Sentinella

## Objetivo
Este documento define o padrão visual e estrutural das telas do Sentinella.
Toda nova tela, modal, card, formulário, tabela ou dashboard deve seguir estas regras para manter consistência visual, melhor experiência do usuário e facilidade de manutenção.

---

## Princípios do sistema
- Interface limpa, objetiva e com foco operacional.
- Priorizar leitura rápida em campo e uso por operadores, supervisores e administradores.
- Manter consistência entre telas desktop e mobile.
- Evitar excesso de cores, bordas pesadas e elementos decorativos desnecessários.
- Sempre priorizar usabilidade, acessibilidade e padronização.

---

## Identidade visual geral

### Estilo visual
- Visual moderno, limpo e profissional.
- Bordas suaves.
- Espaçamentos bem definidos.
- Hierarquia clara entre título, subtítulo, conteúdo e ações.
- Componentes com aparência leve, sem poluição visual.

### Cores
- Utilizar cores padronizadas do sistema.
- Evitar muitas cores na mesma tela.
- Cores de destaque apenas para:
  - ação principal
  - status
  - alertas
  - risco
  - sucesso
  - erro

### Títulos
- Títulos de página devem ter destaque visual.
- Subtítulos devem ser discretos, porém legíveis.
- Títulos de cards e seções devem seguir o mesmo padrão em toda aplicação.

#### Padrão sugerido
- Título da página: `text-2xl font-semibold tracking-tight`
- Subtítulo: `text-sm text-muted-foreground`
- Título de seção/card: `text-base font-semibold`
- Label de campo: `text-sm font-medium`

---

## Layout padrão das telas

### Container principal
Toda tela deve usar container com respiro lateral e vertical.

#### Desktop
- largura máxima centralizada
- padding horizontal confortável
- espaçamento vertical entre seções

#### Mobile
- padding reduzido, mas sem ficar apertado
- empilhamento vertical dos blocos
- ações principais sempre visíveis

#### Exemplo Tailwind
```tsx
<div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-6 md:py-6 lg:px-8">
  ...
</div>
```

---

## Espaçamentos

### Regra geral
Utilizar escala consistente de espaçamento.
Evitar valores aleatórios.

### Escala recomendada
- `gap-2` = espaçamento entre **campos** (inputs no mesmo bloco)
- `gap-3` = espaçamento pequeno
- `gap-4` = espaçamento entre **cards** e seções
- `gap-6` = espaçamento entre blocos maiores / áreas principais
- `gap-8` = espaçamento entre regiões de layout muito distintas

### Regras práticas
- Entre label e input: pequeno
- Entre campos do mesmo bloco: `gap-2`
- Entre cards empilhados (um embaixo do outro): `space-y-4` ou `gap-4`
- Entre seções maiores: `gap-4`
- Entre header e conteúdo: `mb-4`
- Entre cards em grid: `gap-4`

---

## Grid e responsividade

### Formulários
- No mobile: 1 coluna
- No tablet: 2 colunas quando fizer sentido
- No desktop: até 3 ou 4 colunas, sem comprometer leitura

### Exemplo padrão
```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
  ...
</div>
```

### Regras
- Nunca deixar campos apertados demais.
- Campos longos devem ocupar mais colunas.
- Campos críticos devem aparecer primeiro no mobile.
- Evitar rolagem horizontal.

---

## Padrão de cards

### Uso
Cards devem ser usados para:
- resumo de indicadores
- agrupamento de informações
- ações rápidas
- blocos de formulário
- agrupamento de filtros no mobile

### Aparência do card
- fundo limpo
- borda suave
- sombra discreta
- cantos arredondados
- padding interno consistente

### Exemplo Tailwind
```tsx
<div className="rounded-md border bg-card p-4 shadow-sm md:p-6">
  ...
</div>
```

### Regras
- Não exagerar em sombra.
- Não usar borda escura pesada.
- Cards no mobile devem ocupar 100% da largura.
- Cards com ações devem ter boa separação entre conteúdo e botões.

---

## Padrão de formulários

### Estrutura
Cada campo deve seguir a ordem:
1. label
2. campo
3. descrição opcional
4. mensagem de erro

### Labels
- Sempre acima do campo
- Claras e objetivas
- Mesmo tamanho em toda aplicação

### Inputs
- Altura consistente
- Bordas arredondadas
- Padding interno adequado
- Estado visual claro para focus, erro, disabled

### Exemplo de input
```tsx
<input className="h-10 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50" />
```

### Regra de arredondamento
- Inputs, selects e textareas: `rounded-sm` (borda mais discreta / menos arredondada)
- Botões pequenos: `rounded-md` ou `rounded-lg`, conforme componente
- Cards e modais: `rounded-xl`

### Textarea
- altura mínima confortável
- resize controlado se necessário

### Selects e combobox
- mesma altura visual dos inputs
- mesmo arredondamento
- mesmo padding lateral

### Mensagens de erro
- abaixo do campo
- discretas, mas visíveis
- usar tom sem exagero visual

---

## Padrão de botões

### Tipos
- Primário
- Secundário
- Outline
- Ghost
- Danger

### Regras
- Tela deve ter apenas uma ação primária principal
- Não usar muitos botões com mesmo peso visual
- No mobile, botões importantes devem ter boa área de toque
- Botões de salvar/cadastrar devem ter destaque claro

### Tamanhos
- padrão: altura média
- ícone: compacto
- ação principal mobile: largura total quando necessário

### Exemplo
```tsx
<button className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition">
  Salvar
</button>
```

---

## Padrão de tabelas

### Desktop
- tabelas com cabeçalho fixo quando possível
- espaçamento confortável nas linhas
- ações ao final da linha
- status com badges

### Mobile
- evitar tabela tradicional
- transformar registros em cards
- cada card mostra os principais campos
- ações em menu ou rodapé do card

### Regra
Se a tabela ficar ruim no mobile, usar card responsivo em vez de insistir em tabela horizontal.

---

## Padrão mobile

### Diretrizes
- Priorizar empilhamento vertical
- Filtros podem colapsar
- Tabelas devem virar cards
- Botões principais podem ocupar largura total
- Evitar muitos elementos na mesma linha
- Espaçamento de toque confortável

### Cards no mobile
Estrutura sugerida:
- título
- status
- informações resumidas
- ações rápidas
- detalhes opcionais recolhíveis

### Exemplo de grid responsivo
```tsx
<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
  ...
</div>
```

---

## Padrão de modais e drawers

### Modal
Usar para:
- criação rápida
- edição simples
- confirmação
- detalhes curtos

### Drawer lateral
Usar para:
- filtros
- detalhes extensos
- formulários que exigem mais espaço no mobile

### Estilo
- cantos arredondados
- header com título e subtítulo
- footer com ações
- espaçamento interno consistente

---

## Padrão de títulos de janela/seção

### Janela principal
```tsx
<h1 className="text-2xl font-semibold tracking-tight text-foreground">
  Título da tela
</h1>
<p className="text-sm text-muted-foreground">
  Texto de apoio da tela
</p>
```

### Seção interna
```tsx
<h2 className="text-base font-semibold text-foreground">
  Dados do levantamento
</h2>
```

### Regra de cor
- usar `text-foreground` para títulos principais
- usar `text-muted-foreground` para subtítulos e textos auxiliares
- evitar cores fortes em títulos comuns
- reservar cor forte para alertas e indicadores específicos

---

## Padrão de badges e status

### Uso
Badges devem representar:
- status
- risco
- situação
- SLA
- prioridade

### Regra
- cores consistentes por significado
- tamanho discreto
- fácil leitura

Exemplos:
- sucesso
- alerta
- erro
- neutro
- informativo

---

## Padrão de ícones

### Regras
- usar poucos ícones
- sempre com função clara
- manter tamanho consistente
- alinhar com texto corretamente
- não usar ícones apenas decorativos em excesso

---

## Padrão de sombras, bordas e profundidade

### Bordas
- suaves
- discretas
- sem contraste exagerado

### Sombras
- leves
- usadas para destacar cards, dropdowns e modais
- evitar sombra pesada em excesso

### Arredondamento
- input: `rounded-md`
- botão: `rounded-xl`
- card/modal: `rounded-xl`

---

## Acessibilidade
- Garantir contraste adequado
- Focus visível em todos os campos
- Não depender apenas de cor para comunicar estado
- Labels sempre presentes
- Botões com texto claro
- Alvos de toque confortáveis no mobile

---

## Padrão Tailwind do projeto

### Preferências
- Usar classes utilitárias sem exagero
- Extrair componentes reutilizáveis quando houver repetição
- Criar variantes com `cn()` ou utilitário equivalente
- Não inventar estilos isolados por tela
- Sempre reutilizar tokens visuais do projeto

### Tokens recomendados
- `bg-background`
- `bg-card`
- `text-foreground`
- `text-muted-foreground`
- `border-border`
- `ring-primary`
- `text-primary`

### Evitar
- valores arbitrários sem necessidade
- cores soltas fora do padrão
- componentes com estilos muito diferentes do restante da aplicação

---

## Componentes que devem ser padronizados
Criar ou reutilizar componentes base para:
- PageHeader
- SectionHeader
- FormField
- Input
- Textarea
- Select
- Combobox
- Button
- Card
- StatusBadge
- EmptyState
- LoadingState
- DataCardMobile
- FilterPanel
- Modal padrão
- Drawer padrão

---

## Exemplo de estrutura de tela padrão

```tsx
<div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-6 md:py-6 lg:px-8">
  <div className="mb-6">
    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
      Levantamentos
    </h1>
    <p className="text-sm text-muted-foreground">
      Gerencie os levantamentos e acompanhe o andamento das inspeções.
    </p>
  </div>

  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      Card 1
    </div>
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      Card 2
    </div>
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      Card 3
    </div>
  </div>

  <div className="mt-4 rounded-xl border bg-card p-4 shadow-sm md:p-4">
    Conteúdo principal
  </div>
</div>
```

---

## Checklist antes de finalizar uma tela
Antes de entregar qualquer tela, validar:

- A tela segue o mesmo padrão visual das demais?
- Os espaçamentos estão consistentes?
- Os títulos seguem o padrão?
- Inputs, selects e textareas têm mesma altura e arredondamento?
- No mobile a tela continua funcional?
- Tabela no mobile virou card quando necessário?
- Existe apenas uma ação principal em destaque?
- Focus e acessibilidade estão corretos?
- As cores seguem o padrão do sistema?
- Houve reaproveitamento de componentes já existentes?

---

## Regra obrigatória para IA (Cursor / Claude / ChatGPT)
Ao criar ou alterar qualquer tela do Sentinella, seguir obrigatoriamente este guia.
Não criar estilos isolados sem necessidade.
Priorizar reutilização de componentes existentes.
Garantir consistência visual entre telas, modais, cards, tabelas e formulários.
Sempre pensar em desktop e mobile.