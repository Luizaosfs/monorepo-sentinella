# Relatório Executivo Padrão — Estrutura Canônica

> Versão: P8.3 | Data: 2026-04-14

---

## Objetivo

Definir o formato padrão do relatório analítico executivo gerado pelo Sentinella.
Leitura para: secretário de saúde, prefeito, coordenador de vigilância, parceiros externos.

---

## Seções obrigatórias

### 1. Capa

| Campo | Origem |
|---|---|
| Nome do sistema | "Sentinella — Monitoramento Epidemiológico" |
| Município | `clientes.nome` + `clientes.cidade`/`uf` |
| Período | `p_periodo_inicio` → `p_periodo_fim` |
| Data de geração | `now()` |

---

### 2. Resumo executivo

**Indicadores principais:**

| Indicador | Cálculo |
|---|---|
| Total de vistorias | `COUNT(*)` no período |
| P1 (crítico) | `COUNT(*) FILTER prioridade_final = 'P1'` |
| P2 (alto) | `COUNT(*) FILTER prioridade_final = 'P2'` |
| P3 + P4 | Restante |
| Taxa de acesso | `% visitado / total com resultado_operacional` |
| Alertas urgentes | `COUNT(*) FILTER alerta_saude = 'urgente'` |

**Texto situacional (gerado):**
- Se P1 > 0: "Existem imóveis em situação crítica exigindo intervenção imediata."
- Se alertas_urgentes > 0: "Foram identificados domicílios com sinais de dengue em ≥50% dos moradores."
- Se taxa_acesso < 70%: "A taxa de acesso está abaixo do ideal — revisar estratégia de campo."

---

### 3. Situação territorial

Tabela de bairros ordenada por criticidade:

| Bairro | Vistorias | Críticos (P1+P2) | % Críticos | Vetorial ↑ | Vulnerável | Alertas |
|---|---|---|---|---|---|---|

---

### 4. Vulnerabilidade domiciliar

Distribuição por nível (Baixa / Média / Alta / Crítica) com totais e percentuais.

**Destaques:**
- Alta + Crítica acima de 10%: chamar atenção
- Crítica > 0: destacar explicitamente

---

### 5. Alertas de saúde

Distribuição por nível (Nenhum / Atenção / Urgente).

**Destaques:**
- Urgente > 0: destacar com aviso especial
- Atenção > 20%: mencionar

---

### 6. Eficiência operacional

| Indicador | Dado |
|---|---|
| Visitados | `visitados_count` |
| Sem acesso (1ª vez) | `sem_acesso` |
| Sem acesso (retorno) | `sem_acesso_retorno` |
| Taxa de acesso | `taxa_acesso_pct` |

---

### 7. Problemas estruturais

- Imóveis com sem acesso recorrente (resultado = `sem_acesso_retorno`)
- Bairros com maior percentual de sem acesso

---

### 8. Lista de imóveis críticos (P1/P2)

Tabela com até 30 imóveis ordenados por:
1. Número de dimensões críticas (score 0-4)
2. Prioridade (P1 antes de P2)

Colunas: Endereço, Bairro, Prioridade, Vetorial, Vulnerabilidade, Saúde, Acesso

---

## Critérios de qualidade

- **Sem linguagem técnica** — falar em resultados, não em campos
- **Nomes de campos nunca aparecem** — usar rótulos operacionais
- **Números destacados** — críticos e urgentes em vermelho/laranja
- **Máximo 4 páginas** — relatório executivo é conciso
- **Assinatura de geração** — data, hora, nome do sistema

---

## Dados usados

Fonte: `rpc_gerar_relatorio_analitico(p_cliente_id, p_periodo_inicio, p_periodo_fim)`

A RPC agrega diretamente de `vistorias` + `imoveis` com filtro de período — sem recalcular lógica de consolidação.

---

## Arquivos envolvidos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/relatorioAnaliticoPdf.ts` | Geração do PDF via jsPDF |
| `src/pages/gestor/GestorRelatorios.tsx` | Tela de seleção e preview |
| `src/services/api.ts` → `api.dashboardAnalitico.relatorio()` | Chamada à RPC |
| `supabase/migrations/20270302000000_relatorio_analitico.sql` | Tabela + RPC |
