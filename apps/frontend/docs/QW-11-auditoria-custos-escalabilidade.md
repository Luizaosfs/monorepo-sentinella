# QW-11 — Auditoria de Custos, Limites e Escalabilidade Financeira

> **Tipo:** Análise técnico-financeira
> **Status:** Concluído (diagnóstico)
> **Sistema:** SaaS multi-tenant — prefeituras

---

## 1. Mapa de Consumo de Recursos

### 1.1 Edge Functions — inventário completo

| Function | Gatilho | Frequência | Recurso externo | Custo variável |
|----------|---------|-----------|----------------|----------------|
| `sla-marcar-vencidos` | cron `*/15 * * * *` | 2.880/mês | — | Supabase invocações |
| `sla-push-critico` | cron `0 * * * *` | 720/mês | Web Push VAPID | Supabase invocações |
| `pluvio-risco-daily` | cron diário | 30/mês por região | API clima externa | Supabase invocações |
| `cnes-sync` | cron `0 3 * * *` + manual | 30+/mês | ElastiCNES (DATASUS) | Supabase invocações |
| `resumo-diario` | cron `0 18 * * *` | 30/mês | **Claude Haiku** + Web Push | Anthropic API |
| `relatorio-semanal` | cron `0 8 * * 1` | 4/mês | **Resend** | Resend emails |
| `triagem-ia-pos-voo` | manual (pós-voo) | ~4–20/mês | **Claude Haiku** | Anthropic API |
| `identify-larva` | manual (por imagem) | variável | **Claude Haiku Vision** | Anthropic API |
| `cloudinary-upload-image` | upload de usuário | ~200–2.000/mês | Cloudinary | Storage + bandwidth |
| `cloudinary-delete-image` | soft delete / QW-10B | baixo | Cloudinary | — |
| `cloudinary-cleanup-orfaos` | manual (QW-10B) | mensal | Cloudinary | — |
| `limpeza-retencao-logs` | cron `0 2 * * *` | 30/mês | — | Supabase invocações |
| `geocode-regioes` | manual (admin) | baixo | API geocodificação | — |

**Total invocações agendadas/mês (sistema único):** ~3.900
**Para N clientes (relatório-semanal, resumo-diário, cnes-sync):** 3.900 + N × 64

---

### 1.2 Banco de dados — tabelas que mais crescem

| Tabela | Driver de crescimento | Linhas/mês estimadas (por cliente médio) | Retenção |
|--------|-----------------------|------------------------------------------|----------|
| `foco_risco_historico` | Toda transição de estado de foco | ~5.000 | PERMANENTE |
| `levantamento_item_status_historico` | Toda mudança de status de item | ~3.000 | PERMANENTE |
| `vistorias` | Vistorias de agentes | ~1.000 | PERMANENTE |
| `vistoria_depositos` | 7 linhas por vistoria (PNCD A1-E) | ~7.000 | PERMANENTE |
| `levantamento_itens` | Itens YOLO + manuais + denúncias | ~2.000 | PERMANENTE |
| `sla_operacional` | 1 por item P1/P2/P3 | ~1.500 | PERMANENTE |
| `foco_risco_historico` | Ledger de focos | ~5.000 | PERMANENTE |
| `offline_sync_log` | Falhas de sync offline | ~500 | 90 dias ✓ |
| `unidades_saude_sync_log` | Log linha-a-linha CNES | ~10.000 | 90 dias ✓ |
| `casos_notificados` | Notificações epidemiológicas | ~200 | PERMANENTE |
| `canal_cidadao_denuncias` | Denúncias via QR | variável | PERMANENTE |

**Crescimento do banco por cliente médio:** ~35.000–50.000 linhas/mês → **≈ 5–8 MB/mês**

**Índices PostGIS:** 94 ocorrências de `ST_DWithin`/`ST_MakePoint`. Há índices GIST em `casos_notificados` e `levantamento_itens`. O trigger `trg_cruzar_caso_focos` faz varredura em `levantamento_itens` a cada INSERT em `casos_notificados` — **impacto cresce com volume de itens por cliente**.

---

### 1.3 Storage de imagens

#### Caminhos de upload identificados

| Origem | Storage | Tamanho médio | Compressão |
|--------|---------|--------------|-----------|
| Evidências de atendimento (operador) | **Cloudinary** (via `cloudinary-upload-image`) | 500 KB–2 MB | ❌ Nenhuma — upload raw |
| Foto de foco (manual) | **Cloudinary** (via `uploadImage` em `OperadorNovoItemManual`) | 1–3 MB | ❌ Nenhuma — upload raw |
| Foto de vistoria sem acesso | **Cloudinary** (via fila offline) | 300 KB–2 MB | ❌ Nenhuma |
| Assinatura do responsável | **Cloudinary** | 50–100 KB | ❌ Nenhuma |
| Foto de denúncia cidadão | **Cloudinary** | 300 KB–2 MB | ❌ Nenhuma |
| Evidências de operação (conclusão SLA) | **Supabase Storage** (`ConcluirSlaDialog`) | 500 KB–2 MB | ❌ Nenhuma |
| Imagens de drone (YOLO) | **Cloudinary** (pipeline Python) | 2–10 MB | ❌ Nenhuma |

> ⚠️ **Não há compressão nem resize em nenhum caminho de upload.** Imagens de câmera mobile chegam com 3–8 MB originais. Imagens de drone chegam com 2–10 MB.

#### Volume estimado por cliente/mês

| Tipo de uso | Baixo | Médio | Alto |
|-------------|-------|-------|------|
| Imagens de campo | 50 imagens × 500 KB | 300 imagens × 1 MB | 1.500 imagens × 1,5 MB |
| Imagens de drone | 0 | 400 × 3 MB | 2.000 × 3 MB |
| **Storage adicionado/mês** | **25 MB** | **1,5 GB** | **8,25 GB** |
| **Bandwidth (3 visualizações/img)** | **75 MB** | **4,5 GB** | **24,75 GB** |

---

## 2. Custos por Plataforma

### 2.1 Supabase

| Recurso | Free | Pro ($25/mês base) |
|---------|------|--------------------|
| Banco de dados | 500 MB | 8 GB (+$0,125/GB extra) |
| Storage | 1 GB | 100 GB (+$0,021/GB extra) |
| Bandwidth | 2 GB | 250 GB (+$0,09/GB extra) |
| Edge Functions invocações | 500K/mês | 2M/mês (+$2/M extra) |
| Edge Functions runtime | 50h CPU/mês | 200h CPU (+$2/h extra) |
| pg_cron | ❌ | ✅ |
| Realtime | 200 conexões | 500 conexões |

**Para 10 clientes:** ~40.000 invocações/mês → dentro do Pro (2M). Banco: ~0,5 GB/mês por cliente → Pro cobre ~16 clientes antes de pagar extra.

**Para 50 clientes:** ~80 GB banco acumulado em 1 ano → ~$9/mês extra em storage de banco.

### 2.2 Cloudinary

| Recurso | Free | Plus ($89/mês) |
|---------|------|----------------|
| Storage | 25 GB | 225 GB |
| Bandwidth | 25 GB/mês | 225 GB/mês |
| Transformações | 25K/mês | 225K/mês |

**Estimativa:**
- **1 cliente médio:** 1,5 GB storage/mês, 4,5 GB bandwidth/mês
- **Free tier esgota com ~4 clientes médios** em poucos meses
- **Plano Plus cobre ~50 clientes médios** de bandwidth; 15 clientes de storage acumulado/ano

**Risco crítico:** Storage Cloudinary cresce permanentemente (sem limpeza automática de imagens de registros ativos). Apenas órfãos são limpos pelo QW-10B.

### 2.3 Anthropic API (Claude Haiku 4.5)

Preços atuais: **$0,80/MTok entrada** | **$4,00/MTok saída**

| Use case | Tokens/chamada | Chamadas/cliente/mês (médio) | Custo/cliente/mês |
|----------|---------------|------------------------------|-------------------|
| `resumo-diario` | ~800 tok entrada + ~400 tok saída | 30 | ~$0,07 |
| `triagem-ia-pos-voo` | ~1.500 tok entrada + ~600 tok saída | 8 | ~$0,03 |
| `identify-larva` (vision) | ~1.000 tok + imagem | variável (≤5) | ~$0,02–$0,10 |
| **Total estimado** | | | **~$0,12–$0,20/cliente/mês** |

**Para 50 clientes:** ~$6–$10/mês na Anthropic. Custo muito baixo.
**Pico de risco:** `identify-larva` com visão de imagem — se usado intensivamente em muitas imagens de drone (ex: 200 imagens/voo × 10 voos = 2.000 chamadas/mês), pode chegar a **$4–$8/cliente/mês**.

### 2.4 Resend

| Plano | Limite | Custo |
|-------|--------|-------|
| Free | 3.000/mês | $0 |
| Pro | 50.000/mês | $20/mês |

**Volume atual:** 1 email/cliente/semana = 4 emails/cliente/mês.
- 50 clientes: 200 emails/mês → **free tier suficiente**
- 100 clientes: 400 emails/mês → ainda free

**Risco:** Zero a médio prazo. Só se expandir notificações transacionais individuais por agente.

---

## 3. Modelo de Custo por Cliente

### 3.1 Perfis de uso

| Parâmetro | Baixo uso | Uso médio | Alto uso |
|-----------|-----------|-----------|----------|
| Imóveis cadastrados | 2.000 | 10.000 | 50.000 |
| Agentes de campo | 3 | 15 | 50 |
| Vistorias/mês | 200 | 1.000 | 5.000 |
| Voos de drone/mês | 0 | 4 | 20 |
| Imagens upload/mês | 50 | 300 | 1.500 |
| Imagens drone/mês | 0 | 400 | 2.000 |
| Casos notificados/mês | 10 | 60 | 300 |

### 3.2 Custo mensal por cliente (estimativa)

| Componente | Baixo | Médio | Alto |
|-----------|-------|-------|------|
| Supabase (proporcional ao banco) | ~$1,50 | ~$4 | ~$15 |
| Cloudinary storage acumulado | ~$0,50 | ~$6 | ~$30 |
| Cloudinary bandwidth | ~$0,20 | ~$2 | ~$12 |
| Anthropic Claude | ~$0,05 | ~$0,15 | ~$0,80 |
| Resend | $0 | $0 | $0 |
| **Total estimado/cliente/mês** | **~$2,25** | **~$12** | **~$58** |

> Estes valores são proporcionais — o custo de Supabase é compartilhado pela plataforma. Para fins de precificação, o custo incremental por cliente adicional é o que importa.

---

## 4. Gargalos Financeiros Identificados

### 4.1 Crítico — Imagens sem compressão ⚠️

**Problema:** Nenhum caminho de upload comprime a imagem antes de enviar ao Cloudinary ou Supabase Storage. Câmeras mobile produzem 3–8 MB por foto.

**Impacto:** Um cliente médio com 300 uploads/mês consome 300–900 MB/mês apenas em storage. Em 2 anos: 7–21 GB por cliente. O free tier Cloudinary (25 GB total) esgota com 2–4 clientes em menos de 1 ano.

**Solução:** Redimensionar no cliente antes do upload (ex: máx 1920px, qualidade 0.75 via canvas API). Redução estimada: **70–80% do volume de storage**.

```typescript
// Em src/lib/cloudinary.ts — adicionar antes do upload
async function comprimirImagem(file: File, maxDim = 1920, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(new File([blob!], file.name, { type: 'image/jpeg' })), 'image/jpeg', quality);
    };
    img.src = URL.createObjectURL(file);
  });
}
```

### 4.2 Alto — Cloudinary storage cresce sem limite para registros ativos

**Problema:** QW-10B só limpa imagens de registros soft-deleted ou deletados. Imagens de registros ativos (focos, vistorias) nunca são removidas. Um foco resolvido há 2 anos ainda ocupa storage Cloudinary.

**Risco:** Storage acumulado cresce proporcionalmente ao histórico de clientes, sem purga.

**Solução:** Criar política de archive — após 2 anos de resolução, mover para storage de menor custo (Cloudinary tem transformações de arquivamento). Ou estender QW-10B para incluir registros com `status='resolvido'` há mais de N anos.

### 4.3 Alto — `identify-larva` com Claude Vision pode escalar

**Problema:** `identify-larva` usa Claude Haiku Vision. Se usado em todas as imagens de um voo (ex: 500 imagens), o custo por voo pode ser $4–$10 por cliente.

**Solução:** Aplicar `identify-larva` apenas em imagens com score YOLO acima de threshold (ex: ≥ 0.45), reduzindo chamadas em 60–70%. O pré-filtro YOLO já existe no pipeline Python; a chamada à Claude deve ser condicional.

### 4.4 Médio — Trigger PostGIS `trg_cruzar_caso_focos` sem particionamento

**Problema:** A cada INSERT em `casos_notificados`, o trigger faz um `ST_DWithin` contra **toda** a tabela `levantamento_itens` do cliente. Com 100.000+ itens, o PostgreSQL usará o índice GIST (já existe), mas o custo cresce com volume.

**Risco:** Em clientes grandes com muitos casos diários, o trigger pode gerar lentidão visível. Não é custo financeiro direto, mas pode forçar upgrade de plano Supabase.

**Solução:** Filtrar por `created_at > now() - interval '6 months'` no trigger — focos antigos raramente são relevantes para cruzamento.

### 4.5 Médio — `sla-marcar-vencidos` a cada 15 minutos

**Problema:** 2.880 invocações/mês desnecessariamente frequentes. O SLA de 4h não exige verificação a cada 15 minutos.

**Solução:** Mudar para `0 * * * *` (hourly). Redução: **75% das invocações** — de 2.880 para 720/mês.

### 4.6 Baixo — `resumo-diario` com Claude por cliente todo dia

**Problema:** 30 chamadas Claude/mês por cliente ativo, mesmo quando não há atividade no dia.

**Solução:** Adicionar guard: só chamar Claude se `total > 0` no resumo. Para dias sem atividade, pular a chamada e usar texto fixo. Redução estimada: 30–50% das chamadas.

---

## 5. Riscos Classificados

### Risco real (impacto agora ou em < 6 meses)

| # | Risco | Probabilidade | Impacto financeiro |
|---|-------|--------------|-------------------|
| R1 | Free tier Cloudinary esgota com 3–5 clientes | ALTA | $89/mês (Plus) |
| R2 | Storage Cloudinary cresce sem compressão | ALTA | $0,021/GB/mês extra |
| R3 | Banco Supabase excede 8 GB com 10+ clientes | MÉDIA | $0,125/GB/mês extra |

### Risco futuro (impacto em 6–18 meses)

| # | Risco | Probabilidade | Impacto financeiro |
|---|-------|--------------|-------------------|
| R4 | `identify-larva` usado em escala de voo | MÉDIA | $4–10/cliente/voo |
| R5 | Trigger PostGIS lento com >100K itens | BAIXA | Upgrade compute |
| R6 | Supabase invocações excedem 2M/mês | BAIXA | $2/M extras |
| R7 | Resend ultrapassa 3.000/mês com alertas transacionais | BAIXA | $20/mês |

### Otimizações possíveis (ganho imediato)

| # | Otimização | Economia estimada | Esforço |
|---|-----------|-------------------|---------|
| O1 | Comprimir imagens no cliente (canvas) | **70–80% storage/bandwidth Cloudinary** | Baixo |
| O2 | `sla-marcar-vencidos` → horário | **75% menos invocações** | Trivial |
| O3 | `resumo-diario` — guard sem atividade | **30–50% menos chamadas Claude** | Baixo |
| O4 | `identify-larva` — condicional por score | **60–70% menos chamadas Claude Vision** | Médio |
| O5 | Filtrar trigger PostGIS por data | Reduz CPU em clientes grandes | Médio |
| O6 | Cloudinary `upload_preset` com `quality: auto` | **30–50% storage sem perda visual** | Baixo |

---

## 6. Recomendações de Arquitetura

### 6.1 Compressão de imagem — prioridade máxima

Implementar resize + compressão em `src/lib/cloudinary.ts` antes de qualquer upload. Usar `image/webp` onde suportado. Definir `upload_preset` com `quality: auto, fetch_format: auto` no Cloudinary para transformações automáticas.

### 6.2 Cloudinary `upload_preset` com transformações eager

Configurar um preset no Cloudinary Dashboard que aplique:
- `width: 1920, crop: limit` (não amplia, só reduz)
- `quality: auto:good`
- `format: auto` (serve webp para browsers que suportam)

Isso não exige mudança de código — apenas configuração no Dashboard Cloudinary.

### 6.3 Política de archive para imagens antigas

Após N anos de resolução de um foco/vistoria, mover a imagem para Cloudinary Backup Storage (custo menor) ou simplesmente deletar imagens de registros com mais de 3 anos e sem valor probatório ativo.

### 6.4 Separar `sla-marcar-vencidos` em dois jobs

- Verificação de urgência (5min): só itens com prazo em < 2h
- Verificação geral (60min): todos os pendentes

Reduz volume sem perder responsividade.

### 6.5 Cache de resultados de triagem IA

`triagem-ia-pos-voo` já persiste em `levantamento_analise_ia`. Verificar antes de re-invocar — se já existe análise para o `levantamento_id`, retornar o cache em vez de chamar Claude novamente.

---

## 7. Sumário Executivo

| Categoria | Estado atual | Risco | Ação recomendada |
|-----------|-------------|-------|-----------------|
| Banco de dados | Cresce ~5–8 MB/cliente/mês | BAIXO | Purga QW-10C já implementada |
| Cloudinary storage | Sem compressão, crescimento ilimitado | **ALTO** | Comprimir imagens no cliente |
| Cloudinary bandwidth | Proporcional ao storage | **ALTO** | `quality:auto` no upload_preset |
| Edge Functions | 3.900 invocações/mês → escalável | BAIXO | Reduzir `sla-marcar-vencidos` |
| Claude API | $0,12–$0,20/cliente/mês típico | BAIXO | Guard sem atividade no resumo |
| Claude Vision | Variável, risco em uso intensivo | MÉDIO | Condicionar por score YOLO |
| Resend | Dentro do free tier | MUITO BAIXO | — |
| PostGIS triggers | OK com índices GIST | MÉDIO futuro | Filtrar por data no trigger |

**Custo operacional estimado (10 clientes médios):**
- Supabase Pro: $25/mês fixo + ~$10 extras = **$35/mês**
- Cloudinary Plus: $89/mês (necessário com 10 clientes médios)
- Anthropic: ~$1,50/mês
- Resend: $0
- **Total: ~$126/mês para 10 clientes** → R$12–15/cliente/mês de custo infra

**Com compressão de imagens implementada (O1 + O6):**
- Cloudinary free tier cobre até ~20 clientes médios
- **Total com otimização: ~$36/mês para 10 clientes** → R$3–4/cliente/mês
