# Contrato Funcional — Consolidação de Vistoria

**Fonte da verdade:** banco de dados (tabela `vistorias`, colunas de consolidação)
**Versão:** baseada nas migrations 20270222/23/24 e código real em 2026-04-14

---

## O que é a consolidação

A consolidação é o processo automático que analisa os dados de uma vistoria e produz um diagnóstico de prioridade de ação. Ela roda via trigger no banco toda vez que dados relevantes da vistoria são inseridos ou atualizados. O resultado é gravado diretamente em colunas da tabela `vistorias`.

---

## Campos produzidos pela consolidação

### `prioridade_final` — `'P1' | 'P2' | 'P3' | 'P4' | 'P5' | null`

O nível de prioridade da vistoria, calculado pela função `fn_consolidar_vistoria()`.

- `P1` — crítico, ação imediata (ex.: risco vetorial crítico + vulnerabilidade alta)
- `P2` — alto
- `P3` — médio (padrão geral)
- `P4` — baixo
- `P5` — monitoramento
- `null` — ainda não consolidado (trigger não rodou ou não há dados suficientes)

**Na UI:** exibido como badge colorido (`PrioridadeBadge`). P1 = vermelho, P2 = laranja, P3 = amarelo, P4 = verde, P5 = cinza.

---

### `dimensao_dominante` — `string | null`

A dimensão que mais contribuiu para a prioridade final. Valores possíveis:

| Valor | Significado |
|---|---|
| `alerta_saude` | Sinais de saúde na vistoria foram determinantes |
| `risco_vetorial` | Depósitos com potencial vetorial foram determinantes |
| `vulnerabilidade_domiciliar` | Condições do domicílio foram determinantes |
| `risco_socioambiental` | Contexto social/ambiental foi determinante |
| `resultado_operacional` | Sem acesso repetido foi determinante |

**Na UI:** exibido como texto secundário no `ConsolidacaoBlock variant="full"`.

---

### `vulnerabilidade_domiciliar` — `'baixa' | 'media' | 'alta' | 'critica' | 'inconclusivo' | null`

Nível de vulnerabilidade do domicílio calculado a partir de variáveis como presença de grávidas, idosos, crianças menores de 7 anos, condições sanitárias.

---

### `alerta_saude` — `'nenhum' | 'atencao' | 'urgente' | 'inconclusivo' | null`

Nível de alerta de saúde calculado a partir de sintomas registrados na vistoria.

- `urgente` — sintomas graves reportados
- `atencao` — sintomas leves reportados
- `nenhum` — sem sintomas

---

### `risco_socioambiental` — `'baixo' | 'medio' | 'alto' | 'inconclusivo' | null`

Risco socioambiental do imóvel calculado a partir de condições estruturais e contexto do domicílio.

---

### `risco_vetorial` — `'baixo' | 'medio' | 'alto' | 'critico' | 'inconclusivo' | null`

Risco de proliferação vetorial calculado a partir de tipos e quantidade de depósitos com água identificados.

---

### `consolidacao_incompleta` — `boolean` (default `false`)

`true` quando a consolidação rodou mas detectou ausência de dados obrigatórios para calcular uma ou mais dimensões. O resultado ainda é válido, mas deve ser revisado.

**Na UI:** exibido como ícone de alerta âmbar com texto "Incompleto".

---

### `consolidacao_resumo` — `string | null`

Texto técnico gerado pela função descrevendo o raciocínio da consolidação. Usado para auditoria e debug. Visível apenas no `ConsolidacaoBlock variant="full"` expandido.

---

### `consolidado_em` — `timestamptz | null`

Timestamp da última consolidação. `null` = nunca consolidado.

---

### `versao_regra_consolidacao` — `string | null`
### `versao_pesos_consolidacao` — `string | null`

Identificam qual versão das regras e pesos foi usada na consolidação. Permitem rastrear mudanças de critério ao longo do tempo.

---

## Como os dados chegam até a UI

```
vistorias (banco)
  └── trigger automático → fn_consolidar_vistoria()
        └── grava colunas em vistorias
              └── lido via api.vistorias.listByImovel / listConsolidadas
                    └── hook useVistoriasByImovel / useVistoriasConsolidadas
                          └── componentes de UI
```

**Nunca calcular prioridade no frontend.** O banco é a fonte da verdade.

---

## Componentes visuais disponíveis

| Componente | Caminho | Uso |
|---|---|---|
| `PrioridadeBadge` | `@/components/consolidacao/PrioridadeBadge` | Badge P1–P5 com tamanhos sm/md/lg |
| `DimensoesBadges` | `@/components/consolidacao/DimensoesBadges` | Linha de badges das 4 dimensões |
| `ConsolidacaoBlock` | `@/components/consolidacao/ConsolidacaoBlock` | Bloco completo, expandível, variant compact/full |

---

## Padrão visual canonico nas telas (definido na Fase 4.5)

```
[card com borda vermelha/laranja se P1/P2]
  cabeçalho: data  ·  "Sem acesso"(se aplicável)  ·  [PrioridadeBadge]
  corpo: [DimensoesBadges]  [⚠ Incompleto se aplicável]
```

Aplicado em: `GestorFocoDetalhe.tsx` (tab Inspeções), `CentralOperacional.tsx` (seção Vistorias por prioridade), `FichaImovel360.tsx` (Visitas recentes).

---

## O que NÃO está na consolidação

- Cruzamento com casos notificados — feito por trigger separado (`trg_cruzar_caso_focos`)
- SLA — calculado separadamente por `fn_iniciar_sla_ao_confirmar_foco`
- Score territorial do imóvel — calculado por `trg_recalcular_score_prioridade`
