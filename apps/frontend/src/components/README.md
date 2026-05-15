# Padrão de componentização — frontend Sentinella

Camada de apresentação padronizada, inspirada no `manfrota-mobile`, aplicada **incrementalmente** (strangler) sem big bang.

## Estrutura

```
src/components/
├── ui/        # primitivos shadcn/Radix — fonte da verdade dos átomos. NÃO duplicar.
├── layout/    # família de layout reutilizável: AppShell, PageHeader, RoleNav, PageState
├── shared/    # moléculas de domínio reutilizáveis de fato (só consolidar duplicados REAIS)
└── <feature>/ # componentes de domínio (foco, levantamentos, map-v3, ...)
```

## Regras

- **Lógica em hooks** (`src/hooks/`), nunca inline na página. Componentes são prop-driven.
- **Pureza Vite Fast Refresh**: um arquivo de componente exporta só componente(s). Funções puras/utilitários → `src/lib/`.
- `clienteId` sempre via `useClienteAtivo()`; HTTP via `@sentinella/api-client`.
- **Não fundir por nome.** Só consolidar quando o contrato (props + comportamento) for de fato o mesmo. Nomes iguais ≠ duplicado.
- Ao extrair/mover, manter o caminho antigo re-exportando (shim) até o último consumidor migrar; remover shim só com `grep` do import antigo == 0.
- Sem redesign visual — componentização é estrutural.

## Página "componentizada" (critério de aceite)

1. Container fino: só hooks + composição (sem `fetch`/lógica de negócio inline).
2. Header / navegação / estados (loading/empty/error) via `layout/*`.
3. Sem funções puras exportadas junto de componente (Fast Refresh).
