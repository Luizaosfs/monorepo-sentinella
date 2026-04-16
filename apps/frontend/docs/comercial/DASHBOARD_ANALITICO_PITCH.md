# Dashboard Analítico Estratégico — Pitch Comercial

> Versão: P8.2 | Data: 2026-04-14
> Público: gestores municipais, secretarias de saúde, coordenadores de vigilância epidemiológica

---

## O problema que resolve

Supervisores e gestores sabem que há imóveis de risco — mas **não sabem qual dimensão está puxando esse risco**. O imóvel está em P1 por causa de larvas? Por vulnerabilidade social? Por sintomas de dengue nos moradores? Sem essa leitura, a resposta é sempre a mesma: "vai lá de novo".

O Dashboard Analítico muda isso.

---

## O que entrega

### 1. Leitura macro em 4 KPIs

Ao abrir a tela, o gestor vê imediatamente:

- **Quantas vistorias** foram realizadas e qual a **taxa de acesso real**
- **Quantos imóveis P1 e P2** existem no território
- **Quantos alertas de saúde urgentes** foram identificados (≥50% dos moradores com sintomas dengue-like)
- **Quantos imóveis com vulnerabilidade alta ou crítica** — famílias com grávidas, idosos, crianças ou incapacitados

### 2. Risco territorial por bairro

Tabela com semáforo por bairro:

| Bairro | Vistorias | P1+P2 | Vetorial ↑ | Vulnerável | Alertas | Sem acesso |
|---|---|---|---|---|---|---|
| Centro | 148 | **12 (8%)** | 9 | 14 | 3 | 11 |
| Vila Nova | 92 | 4 (4%) | 3 | 6 | 0 | 8 |

O gestor identifica em segundos qual bairro exige atenção coordenada — e por qual motivo.

### 3. Distribuições analíticas (3 gráficos)

- **Vulnerabilidade domiciliar**: quantos domicílios em cada nível (Baixa / Média / Alta / Crítica)
- **Alertas de saúde**: proporção de vistorias com sintomas (Nenhum / Atenção / Urgente)
- **Resultado operacional**: visitado vs sem acesso (1ª vez vs retorno)

Filtrável por bairro — o gestor seleciona um bairro e todos os gráficos atualizam.

### 4. Lista de imóveis críticos (P1/P2) com todas as dimensões

Para cada imóvel de alto risco, o dashboard exibe:

- Endereço e bairro
- Prioridade (P1 ou P2)
- Risco vetorial, vulnerabilidade, alerta de saúde
- Se o agente conseguiu entrar (resultado operacional)
- Data da última vistoria

---

## Diferenciais frente à visão padrão

| Visão padrão | Dashboard Analítico |
|---|---|
| Badges coloridos (resumo) | Distribuição completa por dimensão |
| Lista de focos por status | Território mapeado por tipo de risco |
| Prioridade como resultado | Prioridade explicada por componente |
| Operação do dia | Diagnóstico estratégico do município |

---

## Quem usa e quando

| Papel | Quando usar |
|---|---|
| **Supervisor** | Reunião semanal de análise territorial; decisão de reforço de equipe por bairro |
| **Secretário de saúde / admin** | Relatório para prefeito; planejamento de campanha |
| **Analista regional** | Comparação entre municípios; identificação de padrões de risco |

---

## Sem sobrecarga no banco

Os dados já estão gravados em cada vistoria pela função de consolidação automática (`fn_consolidar_vistoria`). O dashboard **não recalcula nada** — apenas lê e agrega. Performance proporcional ao volume de vistorias, sem queries adicionais.

---

## Frase de impacto para apresentação

> "Com o Dashboard Analítico, a prefeitura passa de 'sabemos que há risco' para 'sabemos exatamente qual é o risco, em qual bairro, e por qual motivo — antes de enviar o agente'."
