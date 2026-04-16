# Métricas do Piloto — Queries SQL

Queries para acompanhar o uso durante o piloto. Rodar no SQL Editor do Supabase.
Substituir `'<cliente_id>'` pelo UUID real do cliente.

---

## 1. Visão geral de focos por status

```sql
SELECT
  status,
  count(*)                          AS total,
  count(*) FILTER (WHERE prioridade = 'P1') AS p1,
  count(*) FILTER (WHERE prioridade = 'P2') AS p2,
  count(*) FILTER (WHERE prioridade = 'P3') AS p3
FROM focos_risco
WHERE cliente_id = '<cliente_id>'
  AND deleted_at IS NULL
GROUP BY status
ORDER BY status;
```

---

## 2. Funil operacional

```sql
SELECT
  count(*) FILTER (WHERE status NOT IN ('resolvido','descartado'))  AS ativos,
  count(*) FILTER (WHERE status = 'em_triagem')                     AS em_triagem,
  count(*) FILTER (WHERE status = 'aguarda_inspecao')               AS aguardando_inspecao,
  count(*) FILTER (WHERE status = 'em_inspecao')                    AS em_inspecao,
  count(*) FILTER (WHERE status = 'confirmado')                     AS confirmados,
  count(*) FILTER (WHERE status = 'em_tratamento')                  AS em_tratamento,
  count(*) FILTER (WHERE status = 'resolvido')                      AS resolvidos,
  count(*) FILTER (WHERE status = 'descartado')                     AS descartados
FROM focos_risco
WHERE cliente_id = '<cliente_id>'
  AND deleted_at IS NULL;
```

---

## 3. Tempo médio entre etapas (em horas)

```sql
SELECT
  round(avg(extract(epoch FROM (em_triagem_em   - suspeita_em))   / 3600)::numeric, 1) AS h_suspeita_para_triagem,
  round(avg(extract(epoch FROM (inspecao_em     - em_triagem_em)) / 3600)::numeric, 1) AS h_triagem_para_inspecao,
  round(avg(extract(epoch FROM (confirmado_em   - inspecao_em))   / 3600)::numeric, 1) AS h_inspecao_para_confirmado,
  round(avg(extract(epoch FROM (resolvido_em    - confirmado_em)) / 3600)::numeric, 1) AS h_confirmado_para_resolvido
FROM focos_risco
WHERE cliente_id = '<cliente_id>'
  AND deleted_at IS NULL
  AND resolvido_em IS NOT NULL;
```

---

## 4. Produtividade por agente

```sql
SELECT
  u.nome                                                       AS agente,
  count(f.id)                                                  AS focos_atribuidos,
  count(f.id) FILTER (WHERE f.status = 'resolvido')           AS resolvidos,
  count(f.id) FILTER (WHERE f.status = 'descartado')          AS descartados,
  round(avg(extract(epoch FROM (f.resolvido_em - f.confirmado_em)) / 3600)::numeric, 1)
                                                               AS h_medio_resolucao
FROM focos_risco f
JOIN usuarios u ON u.id = f.responsavel_id
WHERE f.cliente_id = '<cliente_id>'
  AND f.deleted_at IS NULL
GROUP BY u.id, u.nome
ORDER BY focos_atribuidos DESC;
```

---

## 5. Uso do sistema — eventos de piloto (últimos 7 dias)

```sql
SELECT
  tipo,
  count(*)                    AS total,
  count(DISTINCT usuario_id)  AS usuarios_distintos,
  max(created_at)             AS ultimo_evento
FROM piloto_eventos
WHERE cliente_id = '<cliente_id>'
  AND created_at >= now() - interval '7 days'
GROUP BY tipo
ORDER BY total DESC;
```

---

## 6. Distribuição por triagem — supervisor

```sql
SELECT
  date_trunc('day', created_at) AS dia,
  count(*) FILTER (WHERE tipo = 'triagem_distribuicao_individual') AS dist_individual,
  count(*) FILTER (WHERE tipo = 'triagem_distribuicao_lote')       AS dist_lote,
  count(*) FILTER (WHERE tipo = 'triagem_modo_alternado')          AS mudancas_modo
FROM piloto_eventos
WHERE cliente_id = '<cliente_id>'
  AND tipo IN ('triagem_distribuicao_individual','triagem_distribuicao_lote','triagem_modo_alternado')
  AND created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;
```

---

## 7. SLA — focos vencidos ativos

```sql
SELECT
  prioridade,
  sla_status,
  count(*)   AS total
FROM focos_risco
WHERE cliente_id = '<cliente_id>'
  AND deleted_at IS NULL
  AND status NOT IN ('resolvido','descartado')
  AND sla_status IN ('vencido','critico')
GROUP BY prioridade, sla_status
ORDER BY prioridade;
```

---

## 8. Focos por origem

```sql
SELECT
  origem_tipo,
  count(*)                                            AS total,
  count(*) FILTER (WHERE status = 'resolvido')        AS resolvidos,
  round(
    count(*) FILTER (WHERE status = 'resolvido') * 100.0 / count(*), 1
  )                                                   AS pct_resolucao
FROM focos_risco
WHERE cliente_id = '<cliente_id>'
  AND deleted_at IS NULL
GROUP BY origem_tipo
ORDER BY total DESC;
```
