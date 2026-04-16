# QW-15 — Billing, Planos e Base de Cobrança SaaS

**Status:** Planejamento
**Data:** 2026-03-26
**Escopo:** Modelo de monetização e estrutura técnica para billing

---

## 1. Proposta de Modelo de Planos

### 1.1 Filosofia de precificação para municípios

Prefeituras têm características distintas de empresas SaaS comuns:
- Contrato público — compra via licitação ou dispensa, não auto-serviço
- Orçamento fixo — não há "cartão de crédito" — pagamento por empenho
- Volume previsível — ciclos de dengue definem sazonalidade, não crescimento orgânico livre
- Política pública — não se pode bloquear operação por inadimplência durante surto

**Consequência:** o modelo de billing deve ser baseado em **contrato anual com faixas de capacidade**, não em cobrança automática variável por uso.

### 1.2 Estrutura de planos sugerida

#### Plano Básico
**Perfil:** Município pequeno, até 50 mil habitantes, 1–3 agentes, operação manual predominante

| Recurso | Limite |
|---|---|
| Usuários ativos | até 10 |
| Imóveis cadastrados | até 2.000 |
| Vistorias por mês | até 500 |
| Levantamentos por mês | até 5 |
| Imagens armazenadas | até 5 GB |
| Chamadas IA | até 100/mês |
| Denúncias canal cidadão | até 200/mês |
| Relatórios automáticos | 1 (semanal) |
| Integrações | e-SUS Notifica |
| Drone | não incluído |
| SLA avançado | não incluído |
| Suporte | e-mail |

**Referência de preço:** R$ 800–1.200/mês

#### Plano Profissional
**Perfil:** Município médio, 50–200 mil habitantes, 5–20 agentes, uso de drone

| Recurso | Limite |
|---|---|
| Usuários ativos | até 30 |
| Imóveis cadastrados | até 10.000 |
| Vistorias por mês | até 3.000 |
| Levantamentos por mês | até 20 |
| Imagens armazenadas | até 30 GB |
| Chamadas IA | até 500/mês |
| Denúncias canal cidadão | ilimitado |
| Relatórios automáticos | semanal + mensal |
| Integrações | e-SUS + CNES |
| Drone | incluído (até 3 drones) |
| SLA avançado | incluído |
| Suporte | e-mail + chat |

**Referência de preço:** R$ 2.500–4.000/mês

#### Plano Enterprise
**Perfil:** Município grande, >200 mil habitantes, múltiplas equipes, integração com secretaria de saúde

| Recurso | Limite |
|---|---|
| Usuários ativos | ilimitado |
| Imóveis cadastrados | ilimitado |
| Vistorias por mês | ilimitado |
| Levantamentos por mês | ilimitado |
| Imagens armazenadas | 100 GB + excedente cobrado |
| Chamadas IA | ilimitado |
| Denúncias canal cidadão | ilimitado |
| Relatórios automáticos | todos + personalizados |
| Integrações | todas + webhook personalizado |
| Drone | ilimitado |
| SLA avançado | incluído + personalizado |
| Observabilidade avançada | painel dedicado |
| Suporte | SLA garantido 4h úteis |
| Backup dedicado | incluído |

**Referência de preço:** R$ 6.000–12.000/mês (negociado por contrato)

---

## 2. Métricas de Uso por Cliente

### 2.1 Métricas de volume mensal

| Métrica | Tabela/Fonte | Forma de Cálculo |
|---|---|---|
| `vistorias_mes` | `vistorias` | COUNT WHERE created_at >= início_mês |
| `levantamentos_mes` | `levantamentos` | COUNT WHERE created_at >= início_mês |
| `imagens_enviadas_mes` | `levantamento_itens` | COUNT WHERE imagem_url IS NOT NULL AND created_at >= início_mês |
| `denuncias_mes` | `canal_cidadao` | COUNT WHERE created_at >= início_mês |
| `chamadas_ia_mes` | `levantamento_analise_ia` | COUNT WHERE created_at >= início_mês |
| `usuarios_ativos_mes` | `usuarios` (último login) | COUNT WHERE last_sign_in >= início_mês |
| `relatorios_gerados_mes` | `sistema_logs` job relatorio-semanal | COUNT eventos do mês |
| `syncs_cnes_mes` | `unidades_saude_sync_log` | COUNT WHERE created_at >= início_mês |
| `notificacoes_esus_mes` | `item_notificacoes_esus` | COUNT WHERE enviado_em >= início_mês |
| `focos_criados_mes` | `levantamento_itens` | COUNT WHERE created_at >= início_mês |
| `casos_notificados_mes` | `casos_notificados` | COUNT WHERE created_at >= início_mês |

### 2.2 Métricas de capacidade total

| Métrica | Tabela/Fonte | Cálculo |
|---|---|---|
| `storage_total_gb` | `client_quotas` + Cloudinary API | Calculado mensalmente |
| `imoveis_total` | `imoveis` WHERE ativo=true | COUNT |
| `usuarios_ativos_total` | `usuarios` WHERE ativo=true | COUNT |
| `drones_cadastrados` | `drones` WHERE cliente_id | COUNT |
| `regioes_cadastradas` | `regioes` WHERE cliente_id | COUNT |

### 2.3 Métricas de custo interno (para precificação)

| Custo | Fonte | Estimativa |
|---|---|---|
| Cloudinary storage | API Cloudinary | ~R$ 0,10/GB/mês |
| Cloudinary transformações | API Cloudinary | ~R$ 0,005/imagem |
| Supabase compute | Dashboard Supabase | compartilhado |
| Claude Haiku (IA) | Anthropic billing | ~US$ 0,25/1M tokens input |
| Resend emails | Dashboard Resend | R$ 0,01/email |
| Supabase Edge Functions invocações | Dashboard | ~gratuito abaixo de 2M |

---

## 3. Fontes de Verdade e Gaps

### 3.1 O que já existe

| Dado | Status | Tabela |
|---|---|---|
| Quota por cliente | Existe | `cliente_quotas` |
| Uso mensal de imagens | Existe (QW-11) | aggregado em `cliente_quotas` |
| Log de jobs | Existe (QW-13) | `job_queue` |
| Log de sync CNES | Existe | `unidades_saude_sync_log` |
| Log de notificações e-SUS | Existe | `item_notificacoes_esus` |

### 3.2 O que falta

| Dado | Gap | Solução |
|---|---|---|
| Snapshot mensal de uso | Não existe — só cálculo em tempo real | Criar `billing_usage_snapshot` |
| Plano contratado do cliente | Não existe | Criar `planos` + `cliente_plano` |
| Histórico de faturas | Não existe | Criar `billing_ciclo` |
| Contagem de usuários ativos | Não existe | Agregar via `auth.users` + `usuarios` |
| Storage total por cliente | Parcial em `cliente_quotas` | Complementar com Cloudinary API |

---

## 4. Estrutura Técnica Mínima

### 4.1 Tabelas propostas

```sql
-- Catálogo de planos
CREATE TABLE planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,                        -- 'basico', 'profissional', 'enterprise'
  descricao text,
  preco_mensal numeric(10,2),
  limite_usuarios int,
  limite_imoveis int,
  limite_vistorias_mes int,
  limite_levantamentos_mes int,
  limite_storage_gb numeric(10,2),
  limite_chamadas_ia_mes int,
  limite_denuncias_mes int,
  drone_habilitado boolean DEFAULT false,
  sla_avancado boolean DEFAULT false,
  integracoes_habilitadas text[],            -- ['esus', 'cnes', 'webhook']
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Plano contratado por cliente
CREATE TABLE cliente_plano (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES planos(id),
  data_inicio date NOT NULL,
  data_fim date,                             -- NULL = sem prazo definido
  status text NOT NULL DEFAULT 'ativo',      -- 'ativo', 'suspenso', 'cancelado', 'inadimplente'
  limites_personalizados jsonb,              -- override de limites do plano base
  contrato_ref text,                         -- número do contrato público
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id)                        -- apenas 1 plano ativo por cliente
);
ALTER TABLE cliente_plano ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON cliente_plano (cliente_id);

-- Ciclo de cobrança mensal
CREATE TABLE billing_ciclo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  cliente_plano_id uuid NOT NULL REFERENCES cliente_plano(id),
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  status text NOT NULL DEFAULT 'aberto',     -- 'aberto', 'fechado', 'faturado', 'pago', 'inadimplente'
  valor_base numeric(10,2),
  valor_excedente numeric(10,2) DEFAULT 0,
  valor_total numeric(10,2),
  nota_fiscal_ref text,
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE billing_ciclo ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON billing_ciclo (cliente_id, periodo_inicio);

-- Snapshot mensal de uso (imutável após fechamento)
CREATE TABLE billing_usage_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  billing_ciclo_id uuid REFERENCES billing_ciclo(id),
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  vistorias_mes int NOT NULL DEFAULT 0,
  levantamentos_mes int NOT NULL DEFAULT 0,
  imagens_enviadas_mes int NOT NULL DEFAULT 0,
  denuncias_mes int NOT NULL DEFAULT 0,
  chamadas_ia_mes int NOT NULL DEFAULT 0,
  usuarios_ativos_mes int NOT NULL DEFAULT 0,
  relatorios_mes int NOT NULL DEFAULT 0,
  syncs_cnes_mes int NOT NULL DEFAULT 0,
  notificacoes_esus_mes int NOT NULL DEFAULT 0,
  storage_total_gb numeric(10,3) NOT NULL DEFAULT 0,
  imoveis_total int NOT NULL DEFAULT 0,
  focos_criados_mes int NOT NULL DEFAULT 0,
  payload_detalhado jsonb,                   -- dados brutos para auditoria
  calculado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, periodo_inicio)
);
ALTER TABLE billing_usage_snapshot ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON billing_usage_snapshot (cliente_id, periodo_inicio);

-- Eventos de consumo para recursos com billing by event (futuro)
CREATE TABLE billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  tipo text NOT NULL,                        -- 'ia_call', 'storage_upload', 'report_generated'
  quantidade numeric NOT NULL DEFAULT 1,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON billing_events (cliente_id, created_at, tipo);
```

### 4.2 RPC para cálculo de uso mensal

```sql
CREATE OR REPLACE FUNCTION calcular_uso_mensal(
  p_cliente_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date
)
RETURNS billing_usage_snapshot
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_snapshot billing_usage_snapshot;
BEGIN
  SELECT INTO v_snapshot
    p_cliente_id as cliente_id,
    p_periodo_inicio,
    p_periodo_fim,
    (SELECT COUNT(*) FROM vistorias
     WHERE cliente_id = p_cliente_id
       AND created_at BETWEEN p_periodo_inicio AND p_periodo_fim + 1) as vistorias_mes,
    (SELECT COUNT(*) FROM levantamentos
     WHERE cliente_id = p_cliente_id
       AND created_at BETWEEN p_periodo_inicio AND p_periodo_fim + 1) as levantamentos_mes,
    -- ... demais contagens
    now() as calculado_em;

  RETURN v_snapshot;
END;
$$;
```

### 4.3 Edge Function — fechamento mensal

```
supabase/functions/billing-snapshot/index.ts
- Cron: 1º dia de cada mês, 04:00 UTC
- Para cada cliente: chama calcular_uso_mensal()
- Persiste em billing_usage_snapshot
- Fecha billing_ciclo do mês anterior
- Detecta excedentes
- Envia alerta por email para admin plataforma
```

---

## 5. Regras de Cobrança

### 5.1 Estrutura de cobrança

| Tipo | Regra |
|---|---|
| Mensalidade base | Valor fixo do plano contratado |
| Excedente | Só para storage acima do limite (R$ 0,15/GB excedente) |
| Overage de IA | Cobrado por bloco de 100 chamadas acima do limite |
| Cobrança | Manual via nota fiscal para empenho municipal |
| Renovação | Anual por contrato — não há auto-renovação |

### 5.2 Status de cliente e bloqueios

| Status | Comportamento |
|---|---|
| `ativo` | Operação normal |
| `suspenso` | Aviso no sistema, leitura permitida, escrita bloqueada para novos dados |
| `inadimplente` | Aviso urgente, somente leitura, login ainda permitido |
| `cancelado` | Login bloqueado, dados retidos por 90 dias conforme LGPD |

**Regra crítica:** operação de campo (vistorias, checkin) NUNCA é bloqueada por status financeiro durante ciclo ativo de dengue — apenas dados administrativos novos (novos usuários, novos drones, relatórios extras).

### 5.3 Upgrade/downgrade

- Realizado pelo admin plataforma via `AdminClientes.tsx`
- Nova entrada em `cliente_plano` com data de início
- Snapshot de uso calculado na data da mudança
- Sem cobrança automática — gestão manual

---

## 6. Integração Futura com Sistemas de Pagamento

| Integração | Prioridade | Justificativa |
|---|---|---|
| Boleto bancário via banco conveniado | ALTA | Padrão para empenho municipal |
| Mercado Pago (invoice) | MÉDIA | Simplifica para municípios sem convênio bancário |
| Stripe | BAIXA | Não é padrão no setor público brasileiro |
| ERP/TOTVS via webhook | MÉDIA | Municípios maiores têm ERP interno |
| NF-e automática | FUTURA | Requer certificado A1 e integração SEFAZ |

**Para QW-15:** apenas estruturar as tabelas e o cálculo de uso. A integração com pagamento fica para fase futura.

---

## 7. Proposta de Implementação Incremental

### Fase 1 — Essencial agora (QW-15)
- [ ] Criar tabelas `planos`, `cliente_plano`, `billing_usage_snapshot`
- [ ] Criar RPC `calcular_uso_mensal()`
- [ ] Criar Edge Function `billing-snapshot` (cron mensal)
- [ ] Seed dos 3 planos base
- [ ] Campo `plano_id` visível em `AdminClientes.tsx`
- [ ] Painel de uso atual em `AdminSaudeSistema.tsx`

### Fase 2 — Próximo trimestre
- [ ] Criar `billing_ciclo` com fechamento mensal
- [ ] Dashboard de billing para admin plataforma
- [ ] Alertas de excedente (email automático)
- [ ] Export de relatório de uso por cliente (CSV)

### Fase 3 — Fase futura
- [ ] Integração com sistema de emissão de boleto
- [ ] Integração com ERP via webhook
- [ ] Auto-upgrade de plano por limite excedido
- [ ] Portal do cliente com histórico de faturas

---

## 8. Riscos e Complexidades

| Risco | Mitigação |
|---|---|
| Cálculo retroativo difícil | Fazer snapshot incremental desde o início — não esperar acumular |
| Contagem duplicada em retry/offline | Usar timestamps e idempotency keys |
| Seasonalidade dengue distorce métricas | Documentar isso nos relatórios de uso |
| Bloqueio de operação em surto | Regra explícita: nunca bloquear vistorias |
| Discordância de valores com cliente | Manter log imutável de cada evento de uso |
| Contrato público impede cobrança automática | Sempre cobrança manual — billing é só medição |
