# QW-10 — Auditoria de Backup, Retenção, Recuperação e LGPD

> **Tipo:** Diagnóstico técnico-operacional
> **Status:** Concluído (diagnóstico)
> **Escopo:** Banco de dados Supabase/PostgreSQL · Cloudinary · Supabase Storage · dados pessoais · saúde pública
> **Sistema:** SaaS multi-tenant para prefeituras — dados de saúde pública (dengue, vigilância epidemiológica)

---

## 1. Como está hoje o backup

### 1.1 Banco de dados

O banco é gerenciado pelo **Supabase (plano pago)**. A plataforma oferece:

| Recurso | Plano Free | Plano Pro+ |
|---------|-----------|-----------|
| Backup diário | ❌ | ✅ 7 dias de retenção |
| PITR (Point-in-Time Recovery) | ❌ | ✅ (add-on, até 7 dias) |
| Backup manual (export) | ✅ pg_dump | ✅ pg_dump |
| RTO estimado | — | Horas (restore de snapshot) |
| RPO com PITR | — | Minutos |
| RPO sem PITR | — | 24h (último backup diário) |

**Estado atual constatado:**
O projeto **não tem nenhum procedimento documentado de restore**. O `config.toml` configura apenas duas Edge Functions (cron). Não há script de `pg_dump` agendado nem workflow de backup externo.

**Risco:** Se o projeto está em plano Free, **não existe backup automático**. Se está em Pro sem PITR ativo, o RPO é 24h.

---

### 1.2 Backup de arquivos e imagens

O sistema usa **dois storages distintos** para imagens:

| Storage | Uso | Configuração | Backup |
|---------|-----|-------------|--------|
| **Cloudinary** | Fotos de focos, evidências de operadores, imagens de ítens de levantamento, fotos de denúncias cidadão | `VITE_CLOUDINARY_CLOUD_NAME` + `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary Free: sem backup automático. Paid plans têm backup opcional. |
| **Supabase Storage** | Evidências de conclusão de SLA (`bucket: evidencias`) | `ConcluirSlaDialog.tsx` usa `supabase.storage.from('evidencias')` | Segue o mesmo plano do banco Supabase. |

**Colunas que guardam URLs de imagem:**

| Tabela | Coluna | Storage | Deletado com o registro? |
|--------|--------|---------|--------------------------|
| `levantamento_itens` | `imagem_url` | Cloudinary | **NÃO** — URL fica órfã |
| `levantamento_item_evidencias` | `image_url` | Cloudinary | **NÃO** — CASCADE deleta DB mas não o arquivo |
| `operacoes` | `foto_url`, `foto_externa_url`, `assinatura_responsavel_url` | Cloudinary | **NÃO** |
| `operacoes_evidencias` | `image_url` | Cloudinary | **NÃO** — CASCADE deleta DB mas não o arquivo |
| `sla_operacional` (evidências via dialog) | URL salva no payload ou coluna vinculada | Supabase Storage | **NÃO** |
| `canal_cidadao_denuncias` | `foto_url` | Cloudinary | **NÃO** |
| `focos_risco` | imagens via operacoes associadas | Cloudinary | **NÃO** |

**Conclusão:** Nenhum mecanismo de limpeza de imagens está implementado. Deletar qualquer registro deixa arquivos órfãos no Cloudinary e no Storage.

---

## 2. Riscos de perda de dados

### RISCO CRÍTICO — Sem soft delete em nenhuma tabela

O projeto **não usa `deleted_at`** em nenhuma tabela. O padrão adotado é `ativo boolean` em algumas tabelas e DELETE físico com CASCADE em outras.

**Consequência:** Um DELETE executado por engano (via script, botão errado, ou bug) é **irreversível** sem restore de backup. Não existe "lixeira".

### RISCO ALTO — CASCADE em cadeia a partir de `cliente_id`

Deletar um cliente (prefeitura) cascadeia para:

```
clientes
├── levantamentos → levantamento_itens → levantamento_item_evidencias (CASCADE)
│                                      → levantamento_item_status_historico (CASCADE)
├── planejamento
├── imoveis → vistorias → vistoria_depositos (CASCADE)
│                       → vistoria_sintomas (CASCADE)
│                       → vistoria_riscos (CASCADE)
├── focos_risco → foco_risco_historico (CASCADE)
├── sla_operacional → sla_operacional_log (CASCADE)
├── casos_notificados
├── unidades_saude
├── sla_erros_criacao (CASCADE)
├── offline_sync_log (CASCADE)
├── levantamento_analise_ia (CASCADE)
├── canal_cidadao_denuncias (CASCADE)
├── push_subscriptions (CASCADE)
└── ... ~20 outras tabelas
```

**Cenário de risco:** Um admin deleta um cliente por engano → toda a história operacional e epidemiológica daquela prefeitura é destruída em milissegundos.

### RISCO ALTO — Tabelas sem proteção de DELETE

| Tabela | Proteção | Observação |
|--------|----------|------------|
| `vistorias` | `ON DELETE RESTRICT` via `imovel_id` | ✅ Protege deleção de imóvel com vistorias |
| `casos_notificados` | `ON DELETE RESTRICT` via `unidade_saude_id` | ✅ Protege unidade com casos |
| `levantamentos` | Sem RESTRICT | ❌ Pode ser deletado diretamente |
| `focos_risco` | Sem RESTRICT | ❌ Deletável mesmo com histórico |
| `clientes` | Sem RESTRICT | ❌ CASCADE total |

### RISCO MÉDIO — Logs crescem indefinidamente sem retenção

Tabelas de log sem política de retenção:

| Tabela | Crescimento estimado | Risco |
|--------|---------------------|-------|
| `foco_risco_historico` | Alto (toda transição de estado) | Crescimento de GB em 1 ano |
| `levantamento_item_status_historico` | Médio | Acumulação indefinida |
| `sla_erros_criacao` | Baixo | Negligível, mas sem limpeza |
| `unidades_saude_sync_log` | Médio (cron diário) | ~365 runs/ano por cliente |
| `offline_sync_log` | Variável (campo) | Depende do número de agentes |
| `sla_config_audit` | Baixo | Apenas mudanças manuais |

---

## 3. Riscos de LGPD

### 3.1 Mapeamento de dados pessoais

| Categoria | Tabela | Campo(s) | Base Legal Sugerida | Sensível? |
|-----------|--------|----------|--------------------|-----------|
| **Endereço residencial** | `imoveis` | `logradouro`, `numero`, `complemento`, `bairro`, `quarteirao` | Interesse público (vigilância epidemiológica) | SIM |
| **Geolocalização** | `imoveis` | `latitude`, `longitude` | Interesse público | SIM |
| **Geolocalização de caso** | `casos_notificados` | `latitude`, `longitude` | Lei 6.259/1975 (notificação compulsória) | SIM — Saúde pública |
| **Endereço de caso** | `casos_notificados` | `endereco_paciente`, `bairro` | Lei 6.259/1975 | SIM — Saúde pública |
| **Dados de saúde** | `casos_notificados` | `doenca`, `data_inicio_sintomas` | Lei 6.259/1975 | **ALTAMENTE SENSÍVEL** |
| **Assinatura digital** | `operacoes` | `assinatura_responsavel_url` | Consentimento do titular | SIM |
| **Foto externa imóvel** | `operacoes`, `canal_cidadao_denuncias` | `foto_externa_url`, `foto_url` | Interesse público | SIM |
| **Dados de saúde (sintomas)** | `vistoria_sintomas` | `febre`, `manchas_vermelhas`, `dor_articulacoes` | Interesse público | **ALTAMENTE SENSÍVEL** |
| **Contato do proprietário** | `imoveis` | `contato_proprietario` | Não especificada | SIM |
| **Dados do cidadão-denunciante** | `canal_cidadao_denuncias` | `nome`, `telefone`, `email` (se coletados) | Consentimento | SIM |
| **E-mail de contato** | `clientes` | `contato_email` | Execução contratual | Não-pessoal (CNPJ) |
| **Nome do agente** | `usuarios` | `nome`, `email` | Execução contratual | SIM |
| **Geolocalização do agente** | `vistorias` | `lat_chegada`, `lng_chegada` | Consentimento / contrato de trabalho | SIM |
| **Payload e-SUS** | `item_notificacoes_esus` | `payload_enviado`, `resposta_api` | Lei 6.259/1975 | **ALTAMENTE SENSÍVEL** |

### 3.2 Dados que o CLAUDE.md já documenta como protegidos (LGPD)

O `CLAUDE.md` registra: `casos_notificados` **NÃO armazena nome, CPF, data de nascimento ou qualquer identificador direto do paciente** — apenas endereço e bairro.

**Situação atual:** Correto. Não foi encontrado CPF, nome completo de paciente ou RG em nenhuma tabela de casos.

### 3.3 Dados que saem do sistema (externalização)

| Destino externo | Dados transmitidos | Governança |
|----------------|-------------------|-----------|
| **e-SUS Notifica / RNDS** | Tipo de agravo, semana epidemiológica, código IBGE, CNES, payload completo | Regulado pela SVS/MS — já coberto pela Lei 6.259/1975 |
| **Cloudinary** | Fotos de imóveis, evidências, assinaturas | Cloudinary é processador de dados — precisa de DPA (Data Processing Agreement) |
| **Resend** | E-mail do cliente (relatório semanal) | Resend é processador — precisa de DPA |
| **API Clima** | Coordenadas de regiões (não pessoal) | Dados não-pessoais |

### 3.4 Riscos LGPD identificados

| Risco | Gravidade | Situação atual |
|-------|-----------|---------------|
| Dados de saúde (`vistoria_sintomas`, `casos_notificados`) sem policy de retenção | ALTA | Sem política definida |
| Assinaturas digitais em Cloudinary sem prazo de exclusão | ALTA | Indefinido |
| Geolocalização do agente em `vistorias` sem base legal documentada | MÉDIA | Presumida contratual |
| `payload_enviado` em `item_notificacoes_esus` guarda resposta bruta da API e-SUS | MÉDIA | Sem retenção |
| Fotos de imóveis com rostos ou placas de veículos (secundário) | MÉDIA | Sem controle |
| Direito ao esquecimento: sem mecanismo de exclusão do cidadão-denunciante | ALTA | Sem implementação |
| DPA com Cloudinary e Resend pode não estar formalmente estabelecido | ALTA | Desconhecido |

---

## 4. Tabelas com soft delete e sem soft delete

### Soft delete implementado (`ativo` boolean)

| Tabela | Flag | Observação |
|--------|------|-----------|
| `clientes` | `ativo` | Prefeituras inativadas permanecem no banco |
| `imoveis` | `ativo` | Imóveis inativados preservados |
| `drones` | `ativo` | Drones inativos preservados |
| `unidades_saude` | `ativo` | Unidades inativadas pelo sync CNES nunca são deletadas fisicamente |
| `sla_config` | `ativo` | Configs inativas preservadas |
| `levantamentos` | `ativo` | ✅ Levantamentos inativos preservados |

**Nota:** `ativo = false` não é soft delete completo — não há timestamp de desativação nem histórico de "quem desativou quando".

### Sem qualquer soft delete (DELETE físico com CASCADE)

| Tabela | ON DELETE | Risco de perda |
|--------|-----------|---------------|
| `levantamento_itens` | CASCADE via `levantamento_id` | ALTO — cada foco identificado |
| `levantamento_item_evidencias` | CASCADE | ALTO — evidências fotográficas |
| `focos_risco` | CASCADE via `cliente_id` | ALTO — todo o histórico de focos |
| `foco_risco_historico` | CASCADE | ALTO — rastreabilidade de estado |
| `vistorias` | RESTRICT via `imovel_id` | MÉDIO — protegido por RESTRICT |
| `vistoria_depositos` | CASCADE via `vistoria_id` | ALTO |
| `vistoria_sintomas` | CASCADE via `vistoria_id` | **CRÍTICO** — dados de saúde |
| `casos_notificados` | CASCADE via `cliente_id` | **CRÍTICO** — dados epidemiológicos |
| `caso_foco_cruzamento` | CASCADE | MÉDIO |
| `sla_operacional` | CASCADE via `cliente_id` | ALTO |
| `canal_cidadao_denuncias` | CASCADE via `cliente_id` | ALTO |
| `operacoes` | Sem CASCADE explícito | MÉDIO |
| `item_notificacoes_esus` | CASCADE via `cliente_id` | ALTO |
| `offline_sync_log` | CASCADE via implícito | BAIXO |

---

## 5. Dados que deveriam ter retenção definida

| Dado | Retenção recomendada | Justificativa |
|------|---------------------|---------------|
| `foco_risco_historico` | 5 anos | Vigilância epidemiológica — histórico sanitário |
| `casos_notificados` | 5 anos | SINAN exige notificações por 5 anos |
| `vistoria_sintomas` | 2 anos | Dados de saúde pública |
| `sla_operacional_log` | 2 anos | Auditoria de SLA e atendimento público |
| `levantamento_item_status_historico` | 2 anos | Rastreabilidade operacional |
| `offline_sync_log` | 90 dias | Log operacional — sem valor após resolução |
| `unidades_saude_sync_log` | 90 dias | Log técnico de integração CNES |
| `sla_erros_criacao` | 90 dias | Log de erro técnico |
| `item_notificacoes_esus` | 5 anos | Registro de notificação compulsória |
| Imagens Cloudinary (focos, evidências) | 2 anos após resolução | Evidência sanitária |
| Assinaturas digitais | 2 anos | Comprovante de atendimento |
| Fotos de denúncias cidadão | 1 ano | Uso operacional |
| `push_subscriptions` | Até logout/renovação | Dado técnico sem valor histórico |
| `pluvio_operacional_run` + `item` | 1 ano | Dados meteorológicos históricos |

---

## 6. Dados que podem ser anonimizados

| Dado | Momento de anonimização | Técnica |
|------|------------------------|---------|
| `imoveis.contato_proprietario` | Após 1 ano sem visita | Truncar ou substituir por hash |
| `vistorias.lat_chegada`, `vistorias.lng_chegada` | Após 90 dias | Reduzir precisão para 2 casas decimais (~1km) |
| `casos_notificados.endereco_paciente` | Após 2 anos | Manter apenas bairro |
| `casos_notificados.latitude`, `latitude` | Após 2 anos | Reduzir precisão ou substituir por centroide do bairro |
| `vistoria_sintomas` (associado ao morador) | Após 1 ano | Manter apenas contagem agregada por ciclo |
| `operacoes.assinatura_responsavel_url` | Após 2 anos | Deletar arquivo + nullificar URL |
| Fotos com rostos/placas (Cloudinary) | Imediato | Moderação automática ou revisão manual |
| `canal_cidadao_denuncias` campos pessoais | Após 6 meses | Anonimizar nome/telefone, manter localização |

---

## 7. Proposta de políticas

### 7.1 Política de backup

**Imediato (sem implementação, apenas configuração):**
- [ ] Confirmar plano Supabase atual — verificar se backup diário está ativo
- [ ] Ativar PITR se plano permitir
- [ ] Documentar procedimento de restore em `docs/runbooks/restore-banco.md`
- [ ] Testar restore em ambiente de staging pelo menos 1x/trimestre

**Curto prazo:**
- [ ] Criar script de `pg_dump` agendado (GitHub Actions ou cron externo) para backup externo diário
- [ ] Criar script de export Cloudinary ou ativar backup automático no plano Cloudinary
- [ ] Definir RTO: ≤4h para banco, ≤24h para imagens
- [ ] Definir RPO: ≤1h com PITR, ≤24h sem

### 7.2 Política de retenção

**Migration de limpeza agendada (cron Edge Function):**

```sql
-- Limpeza de logs técnicos — rodar mensalmente
DELETE FROM offline_sync_log    WHERE criado_em < now() - interval '90 days';
DELETE FROM sla_erros_criacao   WHERE criado_em < now() - interval '90 days';
DELETE FROM unidades_saude_sync_log WHERE criado_em < now() - interval '90 days';

-- Retenção longa — histórico operacional
-- NÃO deletar automaticamente:
-- foco_risco_historico, casos_notificados, item_notificacoes_esus
-- Esses requerem decisão jurídica da prefeitura
```

### 7.3 Política de anonimização

**Fase 1 (alta prioridade):**
- Coordenadas de checkin de agente (`lat_chegada`, `lng_chegada`) após 90 dias → reduzir precisão
- `contato_proprietario` em imóveis → remover após 1 ano sem atividade

**Fase 2:**
- Endereço de paciente em `casos_notificados` → manter apenas bairro após 2 anos
- Assinaturas digitais → deletar arquivo Cloudinary + nullificar coluna após 2 anos

### 7.4 Política de exclusão segura

**Soft delete para tabelas críticas (proposta):**

```sql
-- Prioridade 1: tabelas com dados de saúde pública
ALTER TABLE casos_notificados     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE focos_risco           ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE levantamento_itens    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE vistorias             ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Atualizar RLS para filtrar deleted_at IS NULL
-- Criar função de purge periódica para soft-deleted > 5 anos
```

**Exclusão de imagens Cloudinary:**
Criar trigger ou hook em `api.cloudinary.deleteImage()` chamado antes do DELETE de registros com URLs.

**Direito ao esquecimento (LGPD Art. 18):**
Criar procedimento documentado para:
1. Identificar todos os dados do cidadão (por `canal_cidadao_denuncias.telefone` ou localização)
2. Anonimizar campos pessoais
3. Deletar arquivos Cloudinary vinculados
4. Registrar a solicitação e execução em tabela de auditoria LGPD

### 7.5 Política de recuperação de erro humano

| Cenário | Hoje | Proposta |
|---------|------|---------|
| Levantamento deletado | ❌ Irrecuperável sem restore | Soft delete + janela de 30 dias |
| Foco deletado | ❌ Irrecuperável | Soft delete |
| Vistoria deletada | ⚠️ RESTRICT protege de deleção acidental | Soft delete adicional |
| Evidência substituída | ❌ URL anterior perdida | Histórico de URLs em coluna JSONB |
| SLA encerrado indevidamente | ✅ RPC `reabrir_sla` permite reverter | OK — já implementado (QW-06) |
| Cliente deletado | ❌ Catástrofe total | Adicionar RESTRICT + confirmação dupla na UI |

---

## 8. Classificação consolidada de achados

### Problemas reais (impacto imediato)

| # | Problema | Impacto |
|---|---------|---------|
| P1 | Sem soft delete em tabelas críticas (`focos_risco`, `casos_notificados`, `levantamento_itens`) | Dados de saúde pública irrecuperáveis se deletados |
| P2 | Imagens Cloudinary não deletadas quando registro é removido | Acumulação infinita de dados pessoais (fotos, assinaturas) sem prazo |
| P3 | Sem procedimento documentado de restore de banco | RTO indefinido — equipe não sabe como recuperar em caso de falha |
| P4 | Logs sem retenção | Crescimento ilimitado; possível exposição de dados operacionais |
| P5 | DELETE em `clientes` cascadeia ~20 tabelas sem confirmação de segurança | Um erro humano pode destruir toda a história de uma prefeitura |

### Riscos potenciais (sem impacto imediato)

| # | Risco | Probabilidade |
|---|------|--------------|
| R1 | DPA com Cloudinary e Resend não formalizado | MÉDIA — exigência legal para SaaS com dados pessoais |
| R2 | Payload bruto e-SUS armazenado sem retenção | BAIXA — dado técnico, mas contém informações de agravo |
| R3 | Backup Free Supabase sem confirmação | MÉDIA — se não foi contratado Pro+, não há backup automático |
| R4 | Geolocalização de agente (checkin) sem base legal documentada | BAIXA — presumida contratual |
| R5 | Direito ao esquecimento sem implementação | MÉDIA — LGPD Art. 18 exige mecanismo |
| R6 | Fotos de imóveis com rostos/placas sem moderação | BAIXA — improvável, mas possível |

### Melhorias futuras (sem urgência)

| # | Melhoria |
|---|---------|
| M1 | Implementar `deleted_at` em tabelas críticas |
| M2 | Painel de LGPD para admin: listar dados pessoais por cliente |
| M3 | Trigger de limpeza de imagens Cloudinary no delete |
| M4 | Função de anonimização agendada para dados antigos |
| M5 | Runbook de restore documentado e testado |
| M6 | Edge Function `limpeza-logs-retencao` (cron mensal) |
| M7 | Confirmação dupla no UI antes de deletar levantamento ou cliente |

---

## Apêndice — Árvore de CASCADE completa

```
clientes (ativo=false preferível ao DELETE)
│
├── levantamentos (ativo flag)
│   └── levantamento_itens ──────────────────────── DELETE CASCADE
│       ├── levantamento_item_evidencias ─────────── DELETE CASCADE
│       ├── levantamento_item_status_historico ────── DELETE CASCADE
│       ├── levantamento_item_recorrencia ─────────── (ref SET NULL)
│       ├── focos_risco.origem_levantamento_item_id ─ SET NULL
│       ├── yolo_feedback ─────────────────────────── DELETE CASCADE
│       ├── caso_foco_cruzamento ──────────────────── DELETE CASCADE
│       └── item_notificacoes_esus ────────────────── SET NULL
│
├── imoveis (ativo flag)
│   └── vistorias ──────────────────────────────────── RESTRICT (protegido)
│       ├── vistoria_depositos ──────────────────────── DELETE CASCADE
│       ├── vistoria_sintomas ───────────────────────── DELETE CASCADE
│       ├── vistoria_riscos ─────────────────────────── DELETE CASCADE
│       └── vistoria_calhas ─────────────────────────── DELETE CASCADE
│
├── focos_risco ─────────────────────────────────────── DELETE CASCADE via cliente_id
│   └── foco_risco_historico ────────────────────────── DELETE CASCADE
│
├── casos_notificados ───────────────────────────────── DELETE CASCADE via cliente_id
│   └── caso_foco_cruzamento ────────────────────────── DELETE CASCADE
│
├── sla_operacional ─────────────────────────────────── DELETE CASCADE via cliente_id
│   └── sla_operacional_log ─────────────────────────── DELETE CASCADE
│
├── operacoes ──────────────────────────────────────────── (sem CASCADE explícito)
│   └── operacoes_evidencias ────────────────────────── DELETE CASCADE
│
├── canal_cidadao_denuncias ─────────────────────────── DELETE CASCADE via cliente_id
├── levantamento_analise_ia ─────────────────────────── DELETE CASCADE via cliente_id
├── unidades_saude ──────────────────────────────────── (sem CASCADE — RESTRICT em casos_notificados)
├── item_notificacoes_esus ──────────────────────────── DELETE CASCADE via cliente_id
├── offline_sync_log ────────────────────────────────── CASCADE implícito via usuario_id SET NULL
└── push_subscriptions ─────────────────────────────── DELETE CASCADE via cliente_id
```

---

*Gerado em auditoria QW-10 — Sentinella Web · 2026-03-26*
